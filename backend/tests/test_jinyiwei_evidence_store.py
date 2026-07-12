"""tests/test_jinyiwei_evidence_store.py — 锦衣卫共享情报池：写入/查询/幂等。

见 /home/ubuntu/.claude/plans/valiant-crunching-candy.md「锦衣卫作为跨阶段共享证据服务」阶段1。
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.db.models import Base
from src.jinyiwei_evidence_store import query_evidence, upsert_evidence


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture()
def db(engine):
    with Session(engine) as session:
        yield session


def _item(grade="一手", decision="入库"):
    return {"odds": grade, "impact": decision}


def test_create_all_builds_jinyiwei_evidence_table(engine):
    """冒烟测试:create_all(checkfirst=True) 对全新表能正确建表，
    不需要任何 ensure_*_column 自愈(这是新表，没有历史行需要回填)。"""
    from sqlalchemy import inspect

    assert "jinyiwei_evidence" in inspect(engine).get_table_names()


def test_upsert_evidence_inserts_new_row(db):
    evidence_id = upsert_evidence(
        db,
        tenant_id=1,
        query="竞品储能动态",
        claim="竞品A中标某储能电站",
        sources=[{"name": "https://a.com"}],
        item=_item(),
        source_label="CALLER_FINDINGS",
    )
    db.commit()

    rows = query_evidence(db, tenant_id=1)
    assert len(rows) == 1
    assert rows[0]["id"] == evidence_id
    assert rows[0]["claim"] == "竞品A中标某储能电站"
    assert rows[0]["trust"] == "jinyiwei_verified"


def test_upsert_evidence_is_idempotent_by_claim_key(db):
    """同一条 claim(忽略首尾空白/大小写)第二次 upsert 应该原地更新，
    不产生第二行——否则共享情报池会随时间积累重复条目。"""
    upsert_evidence(
        db,
        tenant_id=1,
        query="q1",
        claim="  竞品A中标某储能电站  ",
        sources=[],
        item=_item(grade="未证实", decision="待核"),
        source_label="LIVE_SEARCH",
    )
    db.commit()

    second_id = upsert_evidence(
        db,
        tenant_id=1,
        query="q2",
        claim="竞品A中标某储能电站",
        sources=[{"name": "https://b.com"}],
        item=_item(grade="一手", decision="入库"),
        source_label="LIVE_SEARCH",
    )
    db.commit()

    all_rows = query_evidence(db, tenant_id=1, include_pending=True)
    assert len(all_rows) == 1
    assert all_rows[0]["id"] == second_id
    assert all_rows[0]["decision"] == "入库"
    assert all_rows[0]["grade"] == "一手"


def test_query_evidence_excludes_rejected_even_with_include_pending(db):
    upsert_evidence(
        db, tenant_id=1, query="q", claim="脏情报", sources=[],
        item=_item(grade="未证实", decision="拒"), source_label="LIVE_SEARCH",
    )
    db.commit()

    assert query_evidence(db, tenant_id=1, include_pending=True) == []
    assert query_evidence(db, tenant_id=1, include_pending=False) == []


def test_query_evidence_excludes_pending_by_default(db):
    upsert_evidence(
        db, tenant_id=1, query="q", claim="待核情报", sources=[],
        item=_item(grade="二手(单源)", decision="待核"), source_label="LIVE_SEARCH",
    )
    db.commit()

    assert query_evidence(db, tenant_id=1) == []
    assert len(query_evidence(db, tenant_id=1, include_pending=True)) == 1


def test_query_evidence_filters_by_dept_affinity(db):
    upsert_evidence(
        db, tenant_id=1, query="q", claim="户部专属情报", sources=[],
        item=_item(), source_label="LIVE_SEARCH", dept_affinity=["finance"],
    )
    upsert_evidence(
        db, tenant_id=1, query="q", claim="不限部门情报", sources=[],
        item=_item(), source_label="LIVE_SEARCH",
    )
    db.commit()

    finance_rows = query_evidence(db, tenant_id=1, dept="finance")
    assert {r["claim"] for r in finance_rows} == {"户部专属情报", "不限部门情报"}

    legal_rows = query_evidence(db, tenant_id=1, dept="legal")
    assert {r["claim"] for r in legal_rows} == {"不限部门情报"}


def test_query_evidence_keyword_matches_claim_or_query(db):
    upsert_evidence(
        db, tenant_id=1, query="厦门合作方尽调", claim="某供应商资质齐全",
        sources=[], item=_item(), source_label="LIVE_SEARCH",
    )
    db.commit()

    assert len(query_evidence(db, tenant_id=1, keyword="厦门")) == 1
    assert len(query_evidence(db, tenant_id=1, keyword="资质")) == 1
    assert len(query_evidence(db, tenant_id=1, keyword="不存在的关键词")) == 0


def test_query_evidence_is_tenant_scoped(db):
    upsert_evidence(
        db, tenant_id=1, query="q", claim="租户1的情报", sources=[],
        item=_item(), source_label="LIVE_SEARCH",
    )
    upsert_evidence(
        db, tenant_id=2, query="q", claim="租户2的情报", sources=[],
        item=_item(), source_label="LIVE_SEARCH",
    )
    db.commit()

    assert [r["claim"] for r in query_evidence(db, tenant_id=1)] == ["租户1的情报"]
    assert [r["claim"] for r in query_evidence(db, tenant_id=2)] == ["租户2的情报"]
