"""tests/test_jinyiwei_evidence_store.py — 锦衣卫共享情报池：写入/查询/幂等。

见 /home/ubuntu/.claude/plans/valiant-crunching-candy.md「锦衣卫作为跨阶段共享证据服务」阶段1。
"""
from __future__ import annotations
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.db.flow_store import ensure_jinyiwei_evidence_unique_constraint
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


def test_upsert_evidence_does_not_duplicate_under_concurrent_race(tmp_path):
    """P0(2026-07-12，外部审查指出):`(tenant_id, claim_key)` 此前只是索引，
    不是数据库级唯一约束——`upsert_evidence` 的去重逻辑是"先 SELECT 有没有，
    没有就 INSERT"，这是经典的 TOCTOU 竞态:两个并发写入(比如两个任务几乎
    同时发现同一条情报)都可能在对方提交前各自查到"不存在"，都插入，产生
    重复行，破坏 (tenant_id, claim_key) 应该唯一这个不变式。

    这里用两个独立连接同一个文件型 sqlite 的 Session(不是 :memory:，需要
    真实跨连接可见性)，把暂停点精确打在 `upsert_evidence` **自己内部**那次
    存在性查询返回结果之后、`db.add()` 插入之前——第一版测试曾经在
    `upsert_evidence` 外面手动做了一次存在性检查用来同步，结果掩盖了真正的
    竞态窗口(那次调用返回时 B 早已提交，`upsert_evidence` 内部自己重新查一次
    会正确看到 B 的行，走更新分支，测试对没修的代码也会通过——这是一次
    真实的自我发现:第一版竞态测试本身不可靠，因为它同步点扎错了地方)。
    改成 monkeypatch `session_a.query`只包一层，让 `upsert_evidence`
    内部对 `JinyiweiEvidence` 的 `.first()` 调用在拿到结果(None)后先等 B
    完全提交，再把这个(现在已经过期的)None 结果吐回去——这样 A 的内部判断
    仍然会走"不存在→插入"分支，即使这时候 B 的行已经真实落库，真实复现出
    竞态窗口。数据库唯一约束应该挡住 A 的重复插入，`upsert_evidence` 应该
    识别冲突、退回去原地更新，而不是让 IntegrityError 直接抛出去，也不能让
    重复行真的落进表里。"""
    import threading

    from sqlalchemy import create_engine

    from src.db.models import JinyiweiEvidence

    db_path = tmp_path / "race.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"timeout": 5})
    Base.metadata.create_all(engine)

    session_a = Session(engine)
    session_b = Session(engine)

    a_checked_existing = threading.Event()
    b_committed = threading.Event()
    errors: list[BaseException] = []

    # 只包一层 session_a.query：命中 JinyiweiEvidence 时，让 .first() 在拿到
    # 真实结果之后、返回给调用方之前，插入"等 B 提交"这一步。
    _original_query = session_a.query

    def _paced_query(*args, **kwargs):
        q = _original_query(*args, **kwargs)
        if args and args[0] is JinyiweiEvidence:
            _original_first = q.first

            def _paced_first():
                result = _original_first()
                a_checked_existing.set()
                b_committed.wait(timeout=5)
                return result

            q.first = _paced_first
        return q

    session_a.query = _paced_query

    def _run_a():
        try:
            upsert_evidence(
                session_a,
                tenant_id=1,
                query="qa",
                claim="并发竞态测试claim",
                sources=[],
                item=_item(grade="一手", decision="入库"),
                source_label="LIVE_SEARCH",
            )
            session_a.commit()
        except BaseException as exc:  # noqa: BLE001 - 测试线程里要能看到真实异常
            errors.append(exc)

    def _run_b():
        try:
            a_checked_existing.wait(timeout=5)
            upsert_evidence(
                session_b,
                tenant_id=1,
                query="qb",
                claim="并发竞态测试claim",
                sources=[],
                item=_item(grade="一手", decision="入库"),
                source_label="LIVE_SEARCH",
            )
            session_b.commit()
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

    assert not errors, f"竞态线程里出现未处理异常: {errors}"

    verify_session = Session(engine)
    try:
        rows = (
            verify_session.query(JinyiweiEvidence)
            .filter_by(tenant_id=1, claim_key="并发竞态测试claim")
            .all()
        )
        assert len(rows) == 1, f"应该只有 1 行，实际 {len(rows)} 行——唯一约束没能挡住并发重复插入"
    finally:
        verify_session.close()
        session_a.close()
        session_b.close()


def test_ensure_jinyiwei_evidence_unique_constraint_uses_savepoint_on_postgres():
    """2026-07-12 Codex 停止前审查纠正："PostgreSQL 写入路径会因重复添加约束
    而使事务失效"——PostgreSQL 的 ADD CONSTRAINT 不支持 IF NOT EXISTS(只有
    ADD COLUMN 才支持)，约束已存在时(每次重启后都是这个状态)裸 execute()
    报错会让 PostgreSQL 把当前事务标记为 aborted；catch 住 Python 异常并不
    能让 PostgreSQL 事务恢复，同一 session 后续任何语句(下一个 ensure_*、
    lifespan 里的 db.commit())都会级联失败。已用本机真实 PostgreSQL 16
    手工复现("current transaction is aborted")并验证 SAVEPOINT
    (session.begin_nested())能修复。这里断言:非 sqlite dialect 下 ALTER
    语句必须包在 session.begin_nested() 里，回归成裸 execute 会在真实
    PostgreSQL 上重新引入这个问题，但本仓库测试只跑 SQLite，光靠已有的
    upsert_evidence 测试挡不住这种回归。"""
    session = MagicMock()
    session.get_bind.return_value.dialect.name = "postgresql"

    ensure_jinyiwei_evidence_unique_constraint(session)

    session.begin_nested.assert_called_once()
    executed_sql = str(session.execute.call_args.args[0])
    assert "ADD CONSTRAINT" in executed_sql


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
