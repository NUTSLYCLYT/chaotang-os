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
