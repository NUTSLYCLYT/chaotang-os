"""TDD: 双写层 — src/db/flow_store.py。

隔离测试:in-memory SQLite + 临时 JSON 目录(不碰 data/default/)。
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

os.environ.setdefault("DB_URL", "sqlite:///:memory:")

from src.db.models import Base, Decree, Task, Memorial, Review, Retrospective
from src.db import flow_store

# ── 夹具 ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s


@pytest.fixture()
def tmp_data(tmp_path):
    """临时数据目录,模拟 data/default/。"""
    for d in ("reviews", "memorial_status", "retrospectives"):
        (tmp_path / d).mkdir()
    return tmp_path


# ── 1. save_decree_and_task ────────────────────────────────────────────────


def test_save_decree_and_task(session):
    """dispatch 后写 decrees + tasks。"""
    flow_store.save_decree_and_task(
        session=session,
        task_id="abc00001",
        raw_command="帮我分析市场",
        intent="市场分析",
        task_type="strategy",
        ministers=["hu_bu", "jin_yi_wei"],
        groups=["intel", "exec"],
        departments=["finance", "guard"],
        started_at="2026-05-31T10:00:00",
        tenant_id=1,
    )
    d = session.query(Decree).filter_by(decree_id="abc00001").one()
    assert d.raw_command == "帮我分析市场"
    assert json.loads(d.ministers_json) == ["hu_bu", "jin_yi_wei"]

    t = session.query(Task).filter_by(task_id="abc00001").one()
    assert t.status == "running"
    assert t.last_stage == "dispatched"
    assert json.loads(t.departments_json) == ["finance", "guard"]


# ── 2. update_task_status ─────────────────────────────────────────────────


def test_update_task_status(session):
    """mark_status 后更新 tasks 表。"""
    flow_store.save_decree_and_task(
        session=session,
        task_id="t_update",
        raw_command="cmd",
        tenant_id=1,
    )
    flow_store.update_task_status(
        session=session,
        task_id="t_update",
        status="done",
        task_status="report_ready",
        run_id="run_xyz",
        finished_at="2026-05-31T11:00:00",
        last_stage="report_ready",
        completed_steps=5,
        total_steps=5,
    )
    t = session.query(Task).filter_by(task_id="t_update").one()
    assert t.status == "done"
    assert t.task_status == "report_ready"
    assert t.run_id == "run_xyz"
    assert t.completed_steps == 5


def test_update_task_status_missing_noop(session):
    """不存在的 task_id 不报错(幂等)。"""
    flow_store.update_task_status(session=session, task_id="nonexistent", status="done")


# ── 3. upsert_memorial ────────────────────────────────────────────────────


def test_upsert_memorial_insert(session):
    """新 memorial 插入。"""
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_aaa",
        tenant_id=1,
        title="市场奏折",
        source_department="finance",
        agent_code="hu_bu",
        priority="high",
        status="running",
        summary="摘要",
        created_at="2026-05-31T10:00:00",
    )
    m = session.query(Memorial).filter_by(memorial_id="run_aaa").one()
    assert m.title == "市场奏折"
    assert m.status == "running"


def test_upsert_memorial_update(session):
    """已存在则更新 status + summary。"""
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_bbb",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="running",
        summary="old",
        created_at="2026-05-31T09:00:00",
    )
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_bbb",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="approved",
        summary="new",
        created_at="2026-05-31T09:00:00",
    )
    m = session.query(Memorial).filter_by(memorial_id="run_bbb").one()
    assert m.status == "approved"
    assert m.summary == "new"


# ── 4. save_review_db ─────────────────────────────────────────────────────


def test_save_review_db(session):
    """写 reviews + 联动更新 memorials.status。"""
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_ccc",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="running",
        summary="",
        created_at="",
    )
    rec = flow_store.save_review_db(
        session=session,
        review_id="rev_001",
        memorial_id="run_ccc",
        action="approve",
        comment="批准",
        reviewer_name="皇上",
        tenant_id=1,
    )
    assert rec["action"] == "approve"
    # memorials.status 联动更新为 archived(KP-7)
    m = session.query(Memorial).filter_by(memorial_id="run_ccc").one()
    assert m.status == "archived"


def test_save_review_db_reject(session):
    """reject → rejected。"""
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_ddd",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="running",
        summary="",
        created_at="",
    )
    flow_store.save_review_db(
        session=session,
        review_id="rev_002",
        memorial_id="run_ddd",
        action="reject",
        comment="驳回",
        reviewer_name="皇上",
        tenant_id=1,
    )
    m = session.query(Memorial).filter_by(memorial_id="run_ddd").one()
    assert m.status == "rejected"


def test_save_review_db_inquire(session):
    """inquire → pending。"""
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_eee",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="running",
        summary="",
        created_at="",
    )
    flow_store.save_review_db(
        session=session,
        review_id="rev_003",
        memorial_id="run_eee",
        action="inquire",
        comment="询问",
        reviewer_name="皇上",
        tenant_id=1,
    )
    m = session.query(Memorial).filter_by(memorial_id="run_eee").one()
    assert m.status == "pending"


# ── 5. save_retrospective_db ──────────────────────────────────────────────


def test_save_retrospective_db_insert(session):
    rec = flow_store.save_retrospective_db(
        session=session,
        task_id="t_retro",
        score=4,
        successes=["A", "B"],
        failures=[],
        lessons=["C"],
        playbook=None,
        authored_by="史官",
        tenant_id=1,
    )
    assert rec["score"] == 4
    r = session.query(Retrospective).filter_by(task_id="t_retro").one()
    assert r.synthetic is False
    assert json.loads(r.successes_json) == ["A", "B"]


def test_save_retrospective_db_upsert(session):
    """重复写同一 task_id 更新 score。"""
    flow_store.save_retrospective_db(
        session=session,
        task_id="t_retro2",
        score=3,
        successes=[],
        failures=[],
        lessons=[],
        tenant_id=1,
    )
    flow_store.save_retrospective_db(
        session=session,
        task_id="t_retro2",
        score=5,
        successes=["X"],
        failures=[],
        lessons=[],
        tenant_id=1,
    )
    r = session.query(Retrospective).filter_by(task_id="t_retro2").one()
    assert r.score == 5
    assert json.loads(r.successes_json) == ["X"]


def test_retrospective_outcome_self_heals_on_old_table():
    """2026-07-10 独立复审:Alembic 004 只在生产迁移路径跑,老 DB 文件(create_all
    补救、未跑迁移)的 retrospectives 表没有 outcome 列——save/get 不能因此崩,
    必须现场补列(同 ensure_task_result_json_column 的既有惯例)。"""
    from sqlalchemy import create_engine, text as sa_text

    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    with eng.begin() as conn:
        conn.execute(sa_text("""CREATE TABLE retrospectives (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT UNIQUE NOT NULL,
                    tenant_id INTEGER NOT NULL DEFAULT 1,
                    score INTEGER NOT NULL DEFAULT 3,
                    successes_json TEXT NOT NULL DEFAULT '[]',
                    failures_json TEXT NOT NULL DEFAULT '[]',
                    lessons_json TEXT NOT NULL DEFAULT '[]',
                    playbook TEXT,
                    authored_by TEXT NOT NULL DEFAULT '史官',
                    authored_at TEXT NOT NULL DEFAULT '',
                    synthetic BOOLEAN NOT NULL DEFAULT 0
                )"""))
    with Session(eng) as old_session:
        rec = flow_store.save_retrospective_db(
            session=old_session, task_id="t_old_schema", score=4, outcome="success"
        )
        old_session.commit()
        assert rec["outcome"] == "success"

        fetched = flow_store.get_retrospective_db(old_session, "t_old_schema")
        assert fetched is not None
        assert fetched["outcome"] == "success"
    eng.dispose()


def test_decree_execution_event_sequence_self_heals_and_backfills_existing_rows():
    """2026-07-12 Codex 停止前二次审查纠正:"自愈避免了崩溃，但没有完成旧库的
    正确迁移"——第一版自愈只加列，旧表里本来就有的历史行全部落到 DEFAULT 0，
    同一 task_id 下互相之间还是没有确定顺序，等于没修 sequence 要解决的问题
    本身。这里验证:老表里已经有多条同 task_id 历史行(含两条 occurred_at
    完全相同、模拟同秒碰撞)时，第一次调用 record_timeline_event/_load_timeline
    触发的自愈，必须把这些历史行也按 occurred_at/id 顺序回填出单调递增、
    互不相同的 sequence，而不只是让"新写入"不报错。"""
    from sqlalchemy import create_engine
    from sqlalchemy import text as sa_text

    from src.chancellor.decree_status import _load_timeline, record_timeline_event

    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    with eng.begin() as conn:
        conn.execute(
            sa_text(
                """CREATE TABLE decree_execution_events (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    message TEXT NOT NULL,
                    occurred_at TEXT NOT NULL
                )"""
            )
        )
        for row in [
            ("evt_old_1", "t_old", "drafting", "chancellor", "旧-第一条", "2026-07-01T00:00:00+00:00"),
            ("evt_old_2", "t_old", "executing", "worker", "旧-第二条", "2026-07-01T00:00:00+00:00"),
            ("evt_old_3", "t_old", "reporting", "worker", "旧-第三条", "2026-07-01T00:00:05+00:00"),
        ]:
            conn.execute(
                sa_text(
                    "INSERT INTO decree_execution_events "
                    "(id, task_id, stage, actor, message, occurred_at) "
                    "VALUES (:id, :task_id, :stage, :actor, :message, :occurred_at)"
                ),
                dict(zip(["id", "task_id", "stage", "actor", "message", "occurred_at"], row)),
            )

    with Session(eng) as old_session:
        # 触发自愈的是新事件写入——真实场景里，老库升级后第一次有任务被
        # 操作就会经过 record_timeline_event，不需要额外的一次性迁移步骤。
        record_timeline_event(
            old_session,
            task_id="t_old",
            stage="d",
            actor="chancellor",
            message="新-第四条",
        )
        old_session.commit()

        timeline = _load_timeline(old_session, "t_old")
        assert [e.message for e in timeline] == [
            "旧-第一条",
            "旧-第二条",
            "旧-第三条",
            "新-第四条",
        ]
        assert [e.sequence for e in timeline] == [1, 2, 3, 4]
    eng.dispose()


def test_decree_execution_event_sequence_repairs_previously_broken_intermediate_state():
    """2026-07-12 Codex 停止前三次审查纠正:"自愈仍然没有修复此前遗留在中间坏
    状态的数据库"——上一版只在"本次调用真的把列加上"时才回填，如果一个库已经
    在早期(只加列不回填的)自愈版本下跑过一次、卡在"sequence 列已存在但全部
    是残留的 0"这种中间坏状态(本沙箱 data/fengqun.db 在这次修复过程中真实
    经历过这个状态)，之后每次调用只会在探测到列已存在时直接放行，永远不会
    再去补回填。这里模拟这种中间坏状态本身(不是"列不存在"，而是"列存在但
    是坏的")：预先建好带 sequence 列的表，同一 task_id 下插入 3 条历史行，
    全部卡在 sequence=0(模拟已经跑过一次旧版自愈、但从未真正回填过)，验证
    下一次调用 record_timeline_event 时能检测到这个退化状态并重新回填出
    确定顺序，而不是因为"列已经在"就什么也不做。"""
    from sqlalchemy import create_engine
    from sqlalchemy import text as sa_text

    from src.chancellor.decree_status import _load_timeline, record_timeline_event

    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    with eng.begin() as conn:
        conn.execute(
            sa_text(
                """CREATE TABLE decree_execution_events (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    message TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    sequence INTEGER NOT NULL DEFAULT 0
                )"""
            )
        )
        for row in [
            ("evt_broken_1", "t_broken", "drafting", "chancellor", "坏态-第一条", "2026-07-01T00:00:00+00:00"),
            ("evt_broken_2", "t_broken", "executing", "worker", "坏态-第二条", "2026-07-01T00:00:03+00:00"),
            ("evt_broken_3", "t_broken", "reporting", "worker", "坏态-第三条", "2026-07-01T00:00:03+00:00"),
        ]:
            conn.execute(
                sa_text(
                    "INSERT INTO decree_execution_events "
                    "(id, task_id, stage, actor, message, occurred_at, sequence) "
                    "VALUES (:id, :task_id, :stage, :actor, :message, :occurred_at, 0)"
                ),
                dict(zip(["id", "task_id", "stage", "actor", "message", "occurred_at"], row)),
            )

    with Session(eng) as old_session:
        # 触发点是任意一次读写调用——不需要针对 t_broken 本身操作，
        # 真实场景里可能是任何任务的状态变更先撞上这次修复上线后的第一次调用。
        record_timeline_event(
            old_session,
            task_id="t_unrelated",
            stage="a",
            actor="chancellor",
            message="无关任务的新事件",
        )
        old_session.commit()

        repaired = _load_timeline(old_session, "t_broken")
        assert [e.message for e in repaired] == [
            "坏态-第一条",
            "坏态-第二条",
            "坏态-第三条",
        ]
        assert [e.sequence for e in repaired] == [1, 2, 3]
    eng.dispose()


# ── 6. get_memorial_status_db ──────────────────────────────────────────────


def test_get_memorial_status_db_exists(session):
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_fff",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="archived",
        summary="",
        created_at="",
    )
    status = flow_store.get_memorial_status_db(session, "run_fff")
    assert status == "archived"


def test_get_memorial_status_db_missing(session):
    """不存在返回 None。"""
    assert flow_store.get_memorial_status_db(session, "no_such_run") is None


# ── 7. get_review_for_memorial_db ────────────────────────────────────────


def test_get_review_for_memorial_db(session):
    flow_store.upsert_memorial(
        session=session,
        memorial_id="run_ggg",
        tenant_id=1,
        title="t",
        source_department="finance",
        agent_code="hu_bu",
        priority="medium",
        status="running",
        summary="",
        created_at="",
    )
    flow_store.save_review_db(
        session=session,
        review_id="rev_ggg",
        memorial_id="run_ggg",
        action="approve",
        comment="好",
        reviewer_name="皇上",
        tenant_id=1,
    )
    rev = flow_store.get_review_for_memorial_db(session, "run_ggg")
    assert rev is not None
    assert rev["action"] == "approve"
    assert rev["memorialId"] == "run_ggg"


def test_get_review_for_memorial_db_missing(session):
    assert flow_store.get_review_for_memorial_db(session, "no_such") is None
