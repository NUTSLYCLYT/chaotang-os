"""幂等台账并发测试(修 L 续:schneier 天才建议)——不可逆动作(release/归档)防双发,
不能只测"重启不丢",还要测"同机多 worker 同时命中同一个 key 是否真的只放行一个"。

gunicorn.conf.py/uvicorn.conf.py 生产默认 workers=cpu*2+1,"单实例"本身已经是多进程;
get()+dispatch()+set() 分三步、中间没锁的话,两个 worker 都能在 get() 未命中时
一起冲过闸,各跑一次不可逆动作。claim_idempotent 用文件锁把这段"读-判断-写"包成原子操作。
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from src import court_state_store as css


def test_claim_then_release_lets_retry_proceed(tmp_path: Path):
    p = tmp_path / "idem.json"
    key = "k1"
    assert css.claim_idempotent(key, path=p) is None          # 首次声明:占位成功,调用方去执行
    pending = css.claim_idempotent(key, path=p)                # 执行中重放:看到 pending,不再重复跑
    assert pending == {"status": "pending"}
    css.release_idempotent(key, path=p)                        # 执行失败(error/needs_confirm):撤占位
    assert css.claim_idempotent(key, path=p) is None            # 重试可以再次声明


def test_claim_after_set_returns_completed_result_for_replay(tmp_path: Path):
    p = tmp_path / "idem.json"
    key = "k2"
    assert css.claim_idempotent(key, path=p) is None
    css.set_idempotent(key, {"status": "ok", "new_state": "已归档"}, path=p)
    replay = css.claim_idempotent(key, path=p)
    assert replay == {"status": "ok", "new_state": "已归档"}    # 已完成 → 回放缓存结果,不重跑


def test_concurrent_claims_only_one_caller_proceeds(tmp_path: Path):
    """真正的竞态复现:N 个线程(各自独立 open() 文件句柄,flock 语义等价多进程)
    同时对同一个 idempotency_key 发起 claim。修复前(裸 get/set,无锁)会有多个线程
    都在 get() 阶段看到"无记录"从而都判定"我去执行"——这条测试就是照这个真实生产
    并发场景写的:同一台机器上的多个 gunicorn worker,而不是假设的"多实例"未来才会踩。
    """
    p = tmp_path / "idem.json"
    key = "release-doc-42"
    n_workers = 16

    def _claim(_i: int):
        return css.claim_idempotent(key, path=p)

    with ThreadPoolExecutor(max_workers=n_workers) as pool:
        results = list(pool.map(_claim, range(n_workers)))

    proceed = [r for r in results if r is None]
    blocked = [r for r in results if r == {"status": "pending"}]
    assert len(proceed) == 1, (
        f"不可逆动作(release/归档)本该只放行一个执行者,实际放行了 {len(proceed)} 个——"
        "check-then-act 竞态没堵住"
    )
    assert len(blocked) == n_workers - 1


# ---- M 项(karpathy:顺手用同款锁修掉,增量很小)——court_state.json 同款并发写风险 ----
def test_concurrent_set_state_no_lost_writes(tmp_path: Path):
    """N 个线程各自 set_state 不同 doc_id,写同一个文件。没锁的话是经典 lost-update:
    两个线程都基于同一份旧快照 read-modify-write,后写的会把先写的那条记录整个覆盖掉。
    """
    p = tmp_path / "s.json"
    n = 20

    def _set(i: int):
        css.set_state(f"doc-{i}", "待审", dept="hubu", si="accounting",
                      title=f"t{i}", severity=1, updated_at="2026-07-01", path=p)

    with ThreadPoolExecutor(max_workers=n) as pool:
        list(pool.map(_set, range(n)))

    import json
    data = json.loads(p.read_text(encoding="utf-8"))
    assert len(data) == n, f"应有 {n} 条记录,实际 {len(data)} 条——并发写互相覆盖丢了记录"
