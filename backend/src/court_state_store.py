"""src/court_state_store.py — court_doc 工作流状态持久化(修洞A:点了要存住)。

旅程走查发现:dispatch 返回 new_state 但 web 层没落库,用户点准奏→刷新又变回待审。
最小持久化:doc_id → {state, action, actor, updated_at}。JSON 文件(data/ 运行产物,不进提交)。

权威状态以**存储**为准,不信前端回传的 doc.workflow.state(防客户端伪造状态回退)。
path 可注入(测试隔离)。updated_at 由调用方传(脚本环境无 Date.now,保持可复现)。
"""
from __future__ import annotations

import contextlib
import json
from datetime import datetime
from pathlib import Path

from src.runtime_paths import resolve_runtime_paths

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows only
    fcntl = None

try:
    import msvcrt
except ImportError:  # pragma: no cover - Unix only
    msvcrt = None

_DEFAULT_PATH = resolve_runtime_paths().data / "court_state.json"
_IDEM_PATH = resolve_runtime_paths().data / "court_idempotency.json"


@contextlib.contextmanager
def _file_lock(path: Path):
    """跨进程互斥锁(阻塞式),包住某个落盘文件的"读-改-写"临界区。

    schneier:gunicorn/uvicorn 生产配置默认 workers=cpu*2+1,同一台机器已经是多进程——
    _load/_save 没锁,两个 worker 同时写同一个 JSON 文件会截断/写坏(实测复现过
    JSONDecodeError),幂等台账还会双跑不可逆动作(release/归档)。这把锁按 path 区分,
    court_state.json 和 court_idempotency.json 各自互斥,堵的是"单机多进程"竞态;
    跨机多副本仍需 Redis/DB(接口不变)。
    """
    lock_path = path.parent / (path.name + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fh = open(lock_path, "a+b")
    try:
        if fcntl is not None:
            fcntl.flock(fh, fcntl.LOCK_EX)
        elif msvcrt is not None:  # pragma: no cover - Windows only
            fh.seek(0)
            msvcrt.locking(fh.fileno(), msvcrt.LK_LOCK, 1)
        yield
    finally:
        try:
            if fcntl is not None:
                fcntl.flock(fh, fcntl.LOCK_UN)
            elif msvcrt is not None:  # pragma: no cover - Windows only
                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
        finally:
            fh.close()


def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_state(doc_id: str, *, path: Path | None = None) -> str | None:
    """取某文书当前权威状态。无记录 → None(调用方按初始态处理)。"""
    if not doc_id:
        return None
    rec = _load(path or _DEFAULT_PATH).get(doc_id)
    return rec.get("state") if isinstance(rec, dict) else None


def set_state(doc_id: str, state: str, *, action: str = "", actor: str = "",
              updated_at: str = "", dept: str = "", si: str = "", title: str = "",
              severity: int = 0, path: Path | None = None) -> dict:
    """落库新状态 + 审计痕 + pending 检索元数据(dept/si/title/severity)。

    dept/si/title/severity 缺省时**保留已有记录的旧值**(动作只改状态,不该抹掉登记时的元数据)。
    """
    p = path or _DEFAULT_PATH
    with _file_lock(p):
        data = _load(p)
        prev = data.get(doc_id) if isinstance(data.get(doc_id), dict) else {}
        rec = {
            "state": state, "action": action, "actor": actor, "updated_at": updated_at,
            "dept": dept or prev.get("dept", ""),
            "si": si or prev.get("si", ""),
            "title": title or prev.get("title", ""),
            "severity": severity or prev.get("severity", 0),
        }
        data[doc_id] = rec
        _save(p, data)
        return rec


# ---- 幂等台账(修 L:进程内 dict 重启即丢 → 落盘持久;单机多进程用文件锁互斥;跨机多副本换共享存储)----
# schneier:不可逆动作(release/归档)的防双发不能靠进程内存,重启/崩溃后必须还认得同一个 key;
# 单纯落盘还不够——check(get)和 act-then-write(set)分两步,同机多 worker 之间有竞态窗口。
# 接口稳定(claim/set/release),跨机多副本部署时把这三个函数换成 Redis/DB 实现即可,调用方不变。
def get_idempotent(key: str, *, path: Path | None = None) -> dict | None:
    """只读查缓存结果,不参与互斥判定。校验/展示用;真正防双发用 claim_idempotent。"""
    if not key:
        return None
    return _load(path or _IDEM_PATH).get(key)


def claim_idempotent(key: str, *, path: Path | None = None) -> dict | None:
    """原子声明:key 不存在 → 占位(status=pending)并返回 None(调用方去执行);
    key 已存在 → 直接返回该记录(pending=正在处理中;否则=已完成结果,可回放)。

    "读-判断-写"整体在文件锁内,同机多进程对同一个 key 只有一个能拿到 None。
    """
    if not key:
        return None
    p = path or _IDEM_PATH
    with _file_lock(p):
        data = _load(p)
        existing = data.get(key)
        if existing is not None:
            return existing
        data[key] = {"status": "pending"}
        _save(p, data)
        return None


def set_idempotent(key: str, result: dict, *, path: Path | None = None) -> None:
    """执行成功后落地最终结果,替换 claim 时占的位。"""
    if not key:
        return
    p = path or _IDEM_PATH
    with _file_lock(p):
        data = _load(p)
        data[key] = result
        _save(p, data)


def release_idempotent(key: str, *, path: Path | None = None) -> None:
    """执行未成功(error/needs_confirm,不缓存)→ 撤掉占位,不然重试永远卡在 pending。"""
    if not key:
        return
    p = path or _IDEM_PATH
    with _file_lock(p):
        data = _load(p)
        if key in data and data[key].get("status") == "pending":
            del data[key]
            _save(p, data)


# 需要用户决策的状态(pending action 的口径)
_NEEDS_DECISION = {"草拟", "待审"}


def pending(dept: str | None = None, si: str | None = None, *, path: Path | None = None) -> list[dict]:
    """待决文书列表:state 属待决,按严重度降序、其次最久未动(先来先决)。

    dept/si 传入则过滤到该部门/司(司级"此刻要我决什么")。
    """
    data = _load(path or _DEFAULT_PATH)
    out = []
    for doc_id, rec in data.items():
        if not isinstance(rec, dict) or rec.get("state") not in _NEEDS_DECISION:
            continue
        if dept and rec.get("dept") != dept:
            continue
        if si and rec.get("si") != si:
            continue
        out.append({**rec, "doc_id": doc_id})
    out.sort(key=lambda r: (-int(r.get("severity", 0)), str(r.get("updated_at", ""))))
    return out


def _human_elapsed(since: str, now: str) -> str | None:
    """把 waiting_since → now 的跨度换成"已等待 X"(张小龙:不知道等多久是最差体验)。

    只做**已经等了多久**(数据真实存在:waiting_since 就是待决队列里的记录),
    不做"预计还要多久"——预测需要历史处置时长的分布,这个仓目前没有任何地方
    保留过"进入待决→离开待决"的完整时间跨度(state 被覆盖式更新,历史丢失),
    没有数据就不编一个数字出来(和 F 项"未接地不冒充权威"同一个原则)。
    解析失败/时间戳缺失 → 诚实返回 None,调用方原样透传 waiting_since,不硬凑文案。
    """
    if not since or not now:
        return None
    try:
        t0, t1 = datetime.fromisoformat(since), datetime.fromisoformat(now)
    except ValueError:
        return None
    if (t0.tzinfo is None) != (t1.tzinfo is None):
        t0, t1 = t0.replace(tzinfo=None), t1.replace(tzinfo=None)
    delta = t1 - t0
    seconds = delta.total_seconds()
    if seconds < 0:
        return None
    if seconds < 3600:
        return "刚刚" if seconds < 60 else f"已等待 {int(seconds // 60)} 分钟"
    if seconds < 86400:
        return f"已等待 {int(seconds // 3600)} 小时"
    return f"已等待 {int(seconds // 86400)} 天"


def pending_action(dept: str | None = None, si: str | None = None, *,
                    now: str = "", path: Path | None = None) -> dict:
    """此刻最该决的一件事(张小龙:进来第一眼告诉用户干嘛)。空 → has_pending False。

    now 由调用方传(web 层用真实时钟;脚本/测试环境不传则不算等待时长,保持可复现)。
    """
    items = pending(dept, si, path=path)
    if not items:
        return {"has_pending": False, "count": 0, "top": None,
                "message": "此刻无待决事项 ✅"}
    top = items[0]
    sev = int(top.get("severity", 0))
    why = f"{sev} 项红灯待处置" if sev else "待你批阅"
    waiting_since = top.get("updated_at", "")
    return {
        "has_pending": True,
        "count": len(items),
        "top": {"doc_id": top["doc_id"], "title": top.get("title", ""),
                "severity": sev, "waiting_since": waiting_since,
                "waiting_hint": _human_elapsed(waiting_since, now) if now else None},
        "message": f"此刻最该决:「{top.get('title', '') or top['doc_id']}」—— {why}(共 {len(items)} 件待决)",
    }
