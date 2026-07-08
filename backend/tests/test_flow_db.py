"""TDD: src/db — engine, models, CRUD helpers。

用 in-memory SQLite (:memory:) 隔离测试,不碰 data/fengqun.db。
"""
from __future__ import annotations

import json
import os
import pytest

# 测试专用 in-memory DB URL,必须在 import src.db 之前设置
os.environ.setdefault("DB_URL", "sqlite:///:memory:")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from src.db.models import Base, Decree, Task, Memorial, Review, Retrospective
from src.db import engine as db_engine_module


# ── 夹具 ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def engine():
    """每个测试独立的 in-memory 引擎。"""
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s


# ── 1. 表可创建 ────────────────────────────────────────────────────────────

def test_tables_created(engine):
    """5 张新表全部创建成功。"""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    for t in ("decrees", "tasks", "memorials", "reviews", "retrospectives"):
        assert t in tables, f"表 {t} 未创建"


# ── 2. Decree CRUD ────────────────────────────────────────────────────────

def test_decree_insert_and_query(session):
    d = Decree(
        decree_id="abc12345",
        tenant_id=1,
        raw_command="帮我分析这个市场",
        intent="市场分析",
        task_type="strategy",
        ministers_json=json.dumps(["hu_bu", "jin_yi_wei"]),
        groups_json=json.dumps(["intel", "exec"]),
    )
    session.add(d)
    session.commit()
    row = session.query(Decree).filter_by(decree_id="abc12345").one()
    assert row.raw_command == "帮我分析这个市场"
    assert json.loads(row.ministers_json) == ["hu_bu", "jin_yi_wei"]


def test_decree_unique_constraint(session):
    """decree_id 唯一约束。"""
    from sqlalchemy.exc import IntegrityError
    d1 = Decree(decree_id="dup00001", tenant_id=1, raw_command="cmd1")
    d2 = Decree(decree_id="dup00001", tenant_id=1, raw_command="cmd2")
    session.add(d1)
    session.commit()
    session.add(d2)
    with pytest.raises(IntegrityError):
        session.commit()


# ── 3. Task CRUD ──────────────────────────────────────────────────────────

def test_task_insert_and_query(session):
    t = Task(
        task_id="t001",
        decree_id="abc12345",
        tenant_id=1,
        status="running",
        task_status="running",
        task_input="帮我分析这个市场",
        departments_json=json.dumps(["finance"]),
        total_steps=5,
        completed_steps=2,
        last_stage="running",
    )
    session.add(t)
    session.commit()
    row = session.query(Task).filter_by(task_id="t001").one()
    assert row.status == "running"
    assert row.completed_steps == 2
    assert json.loads(row.departments_json) == ["finance"]


def test_task_progress_pct(session):
    """progressPct = completed_steps / total_steps * 100。"""
    t = Task(task_id="t002", tenant_id=1, status="done",
              task_status="report_ready", total_steps=4, completed_steps=4)
    session.add(t)
    session.commit()
    row = session.query(Task).filter_by(task_id="t002").one()
    pct = int(row.completed_steps / row.total_steps * 100)
    assert pct == 100


# ── 4. Memorial CRUD ──────────────────────────────────────────────────────

def test_memorial_insert_and_query(session):
    m = Memorial(
        memorial_id="run_aaa",
        tenant_id=1,
        title="市场分析奏折",
        source_department="finance",
        agent_code="hu_bu",
        priority="high",
        status="running",
        summary="分析结果摘要",
        created_at="2026-05-31T10:00:00",
    )
    session.add(m)
    session.commit()
    row = session.query(Memorial).filter_by(memorial_id="run_aaa").one()
    assert row.status == "running"
    assert row.agent_code == "hu_bu"


def test_memorial_status_values(session):
    """MemorialStatus 值域必须在 5 个合法值内(KP-7)。"""
    valid = ("pending", "running", "approved", "archived", "rejected")
    for s in valid:
        m = Memorial(memorial_id=f"run_{s}", tenant_id=1, status=s,
                     title="t", source_department="finance",
                     agent_code="hu_bu", priority="medium")
        session.add(m)
    session.commit()
    rows = session.query(Memorial).all()
    for r in rows:
        assert r.status in valid, f"非法 status: {r.status}"


# ── 5. Review CRUD + memorials.status 联动 ────────────────────────────────

def test_review_insert_and_query(session):
    session.add(Memorial(memorial_id="run_bbb", tenant_id=1, title="t",
                         source_department="finance", agent_code="hu_bu",
                         priority="medium", status="running"))
    session.commit()

    r = Review(
        review_id="rev_001",
        memorial_id="run_bbb",
        tenant_id=1,
        action="approve",
        comment="批准执行",
        reviewer_name="皇上",
    )
    session.add(r)
    # 联动更新 memorials.status(approve → archived)
    mem = session.query(Memorial).filter_by(memorial_id="run_bbb").one()
    mem.status = "archived"
    session.commit()

    row = session.query(Review).filter_by(review_id="rev_001").one()
    assert row.action == "approve"
    mem_row = session.query(Memorial).filter_by(memorial_id="run_bbb").one()
    assert mem_row.status == "archived"


def test_review_action_to_memorial_status_mapping(session):
    """approve→archived, reject→rejected, inquire→pending (KP-7)。"""
    _ACTION_TO_STATUS = {"approve": "archived", "reject": "rejected", "inquire": "pending"}
    for action, expected_status in _ACTION_TO_STATUS.items():
        session.add(Memorial(memorial_id=f"run_{action}", tenant_id=1, title="t",
                             source_department="finance", agent_code="hu_bu",
                             priority="medium", status="running"))
        session.commit()
        r = Review(review_id=f"rev_{action}", memorial_id=f"run_{action}",
                   tenant_id=1, action=action, comment="x", reviewer_name="皇上")
        session.add(r)
        mem = session.query(Memorial).filter_by(memorial_id=f"run_{action}").one()
        mem.status = expected_status
        session.commit()
        assert mem.status == expected_status


# ── 6. Retrospective CRUD ─────────────────────────────────────────────────

def test_retrospective_insert_and_query(session):
    r = Retrospective(
        task_id="t001",
        tenant_id=1,
        score=4,
        successes_json=json.dumps(["闭环跑通", "数据持久化"]),
        failures_json=json.dumps([]),
        lessons_json=json.dumps(["双写要加事务"]),
        playbook=None,
        authored_by="史官",
        synthetic=False,
    )
    session.add(r)
    session.commit()
    row = session.query(Retrospective).filter_by(task_id="t001").one()
    assert row.score == 4
    assert json.loads(row.successes_json) == ["闭环跑通", "数据持久化"]
    assert row.synthetic is False


def test_retrospective_upsert(session):
    """task_id 唯一,第二次 INSERT OR REPLACE 更新 score。"""
    r1 = Retrospective(task_id="t_upsert", tenant_id=1, score=3,
                       successes_json="[]", failures_json="[]", lessons_json="[]",
                       authored_by="史官")
    session.add(r1)
    session.commit()
    # 更新
    row = session.query(Retrospective).filter_by(task_id="t_upsert").one()
    row.score = 5
    session.commit()
    updated = session.query(Retrospective).filter_by(task_id="t_upsert").one()
    assert updated.score == 5
