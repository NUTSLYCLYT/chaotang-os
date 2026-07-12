"""tests/test_build_ledger_persist_concurrency.py

`_persist`(P0-A 独立审查第二轮发现)当前是"查当前 owner 范围内有没有 → 查全局
ID 冲突 → INSERT"的多步 check-then-insert，两个并发请求可能都在对方提交前
通过检查，随后一个在 commit 时因主键冲突抛 IntegrityError，变成未处理的
500——这是跟 upsert_evidence 完全同源的 TOCTOU 竞态(见 P0-1/P0-C 的
test_upsert_evidence_does_not_duplicate_under_concurrent_race)。

这里没有照搬那份测试"暂停在读查询返回之后"的技术——`_persist` 在插入前有
不止一次读查询，暂停哪一次读都只能精确复现某一种特定实现的竞态，换实现
(比如本文件要验证的修复版本，读查询次数和顺序都会变)测试就失真了。改成
把暂停点打在 `session.add()` 之后、`db.commit()`/`db.flush()` 真正执行前——
不管插入前做了几次读检查，这样都能精确复现"两边都以为自己是第一个"的
竞态：A 走完自己的读检查(此时 B 还没做任何事，A 合理地认为路是通的)、
调用 add() 之后暂停；B 完整走一遍自己的读检查(此时 A 只在自己的 session
里 add() 了，还没 commit，B 的独立 session 看不到，B 也合理地认为路是通的)、
正常插入并提交成功；A 恢复后继续执行，此时才会撞见真正的主键冲突。
"""
from __future__ import annotations

import importlib
import threading

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# 2026-07-12:不能用 `import src.db.engine as engine_mod`——src/db/__init__.py
# 里的 `from .engine import engine` 会把 `src.db` 包命名空间上的 `engine`
# 属性从"子模块"覆盖成"Engine 实例"(经典 Python 陷阱:包 __init__.py 里
# `from .submodule import 同名对象` 会遮蔽子模块本身)，属性链解析
# `src.db.engine` 拿到的就是这个被遮蔽的值，不是真正的模块，
# monkeypatch.setattr 会打在 Engine 对象上而不是模块上。用
# importlib.import_module 直接从 sys.modules 拿真正的模块——跟本仓库
# conftest.py::isolated_session_local 已经在用的同一个规避手法。
engine_mod = importlib.import_module("src.db.engine")
build_ledger_router = importlib.import_module("web.routers.build_ledger")
from src.db.models import Base, BuildLedgerEntry


def _make_racing_sessions(tmp_path, race_name: str):
    """建两个共享同一个文件型 sqlite 的独立 Session，外加一个把 SessionLocal()
    调用按顺序分发给它俩的假工厂——`_persist` 内部是
    `from src.db.engine import SessionLocal; db = SessionLocal()`，这个假工厂
    monkeypatch 到 `src.db.engine.SessionLocal` 之后，`_persist` 两次调用会
    分别拿到 session_a / session_b，而不是各自新开一个真实独立的内存库。"""
    db_path = tmp_path / f"{race_name}.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"timeout": 5})
    Base.metadata.create_all(engine)

    session_a = Session(engine)
    session_b = Session(engine)
    sessions = [session_a, session_b]
    call_count = {"n": 0}
    lock = threading.Lock()

    def _fake_session_local():
        with lock:
            idx = call_count["n"]
            call_count["n"] += 1
        return sessions[idx]

    return engine, session_a, session_b, _fake_session_local


def _pace_add_of_build_ledger_entry(session, ready_event, release_event):
    """在 session.add(新行) 之后、这次调用真正提交前插入等待点。不管
    `_persist` 在这之前做了几次读检查，这个暂停点都精确落在"A 已经决定要
    插入、但还没真正落库"和"B 完整跑完一遍、抢先提交成功"之间——这才是
    review 指出的那个真实竞态窗口，跟具体实现的读查询次数无关。"""
    original_add = session.add

    def _paced_add(instance, *args, **kwargs):
        original_add(instance, *args, **kwargs)
        if isinstance(instance, BuildLedgerEntry):
            ready_event.set()
            release_event.wait(timeout=5)

    session.add = _paced_add


def test_persist_concurrent_same_id_different_owners_arbitrated_by_db_not_500(
    tmp_path, monkeypatch
):
    """两个不同 owner 并发提交同一个 id：数据库唯一约束(主键)才是最终仲裁，
    不能让 IntegrityError 变成未处理的 500，最终只应该有一行落库，输给竞态
    的一方应该拿到稳定的 id_conflict，不泄露赢家是谁。"""
    engine, session_a, session_b, fake_session_local = _make_racing_sessions(
        tmp_path, "persist_race_diff_owner"
    )
    a_added = threading.Event()
    b_committed = threading.Event()
    _pace_add_of_build_ledger_entry(session_a, a_added, b_committed)
    monkeypatch.setattr(engine_mod, "SessionLocal", fake_session_local)

    errors: list[BaseException] = []
    result_a: dict = {}
    result_b: dict = {}

    def _run_a():
        try:
            result_a["value"] = build_ledger_router._persist(
                {"id": "race-entry", "taskId": "task-race", "title": "A的提交"},
                tenant_id=1, user_id="user-a",
            )
        except BaseException as exc:  # noqa: BLE001 - 测试线程里要能看到真实异常
            errors.append(exc)

    def _run_b():
        try:
            a_added.wait(timeout=5)
            result_b["value"] = build_ledger_router._persist(
                {"id": "race-entry", "taskId": "task-race", "title": "B的提交"},
                tenant_id=1, user_id="user-b",
            )
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            b_committed.set()

    t_a = threading.Thread(target=_run_a)
    t_b = threading.Thread(target=_run_b)
    t_a.start()
    t_b.start()
    t_a.join(timeout=10)
    t_b.join(timeout=10)

    assert not errors, f"竞态线程里出现未处理异常(应该被 IntegrityError 捕获,不该是 500): {errors}"
    assert result_b["value"]["success"] is True, "B(真正抢到 id 的一方)应该成功"
    assert result_a["value"]["success"] is False
    assert result_a["value"]["error"] == "id_conflict", "A(输给竞态的一方)应该稳定拿到 id_conflict,不是异常"

    verify_session = Session(engine)
    try:
        rows = verify_session.query(BuildLedgerEntry).filter_by(id="race-entry").all()
        assert len(rows) == 1, f"应该只有 1 行落库，实际 {len(rows)} 行——数据库约束没能挡住并发重复插入"
        assert rows[0].user_id == "user-b", "落库的应该是真正抢到 id 的那个 owner"
    finally:
        verify_session.close()
        session_a.close()
        session_b.close()


def test_persist_concurrent_same_id_same_owner_updates_without_crashing(tmp_path, monkeypatch):
    """同一个 owner 并发提交同一个 id(比如同一个人两次几乎同时点了"立项")：
    定义明确的语义——不能是未处理的 500，两次都应该成功，最终只落一行，且
    这一行是"最后一个真正把更新应用上去的"那次的内容(不是谁先发起请求)：
    输掉插入竞态的一方会退回去做一次原地更新，这次更新天然发生在赢家的
    INSERT 提交之后。"""
    engine, session_a, session_b, fake_session_local = _make_racing_sessions(
        tmp_path, "persist_race_same_owner"
    )
    a_added = threading.Event()
    b_committed = threading.Event()
    _pace_add_of_build_ledger_entry(session_a, a_added, b_committed)
    monkeypatch.setattr(engine_mod, "SessionLocal", fake_session_local)

    errors: list[BaseException] = []
    result_a: dict = {}
    result_b: dict = {}

    def _run_a():
        try:
            result_a["value"] = build_ledger_router._persist(
                {"id": "shared-entry", "taskId": "task-shared", "title": "A提交的版本"},
                tenant_id=1, user_id="same-user",
            )
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    def _run_b():
        try:
            a_added.wait(timeout=5)
            result_b["value"] = build_ledger_router._persist(
                {"id": "shared-entry", "taskId": "task-shared", "title": "B提交的版本"},
                tenant_id=1, user_id="same-user",
            )
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            b_committed.set()

    t_a = threading.Thread(target=_run_a)
    t_b = threading.Thread(target=_run_b)
    t_a.start()
    t_b.start()
    t_a.join(timeout=10)
    t_b.join(timeout=10)

    assert not errors, f"同一个 owner 并发写入不该产生未处理异常: {errors}"
    assert result_a["value"]["success"] is True
    assert result_b["value"]["success"] is True

    verify_session = Session(engine)
    try:
        import json

        rows = verify_session.query(BuildLedgerEntry).filter_by(id="shared-entry").all()
        assert len(rows) == 1, f"同一个 owner 并发写入不该产生重复行，实际 {len(rows)} 行"
        assert rows[0].user_id == "same-user"
        # A 是输掉插入竞态、退回去做原地更新的一方(B 先提交成功，A 恢复后
        # 才发现冲突、识别出是同一个 owner、再把自己的字段写回去)——所以
        # 最终内容应该是 A 提交的版本，不是 B 的。
        assert json.loads(rows[0].entry_json)["title"] == "A提交的版本"
    finally:
        verify_session.close()
        session_a.close()
        session_b.close()
