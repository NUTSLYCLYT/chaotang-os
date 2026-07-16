"""004b — 补建 15 张 create_all-only 裸表，让迁移链在干净库上自包含。

Revision ID: 004b_create_untracked_base_tables
Revises: 004_retrospective_outcome
Create Date: 2026-07-14

## 为什么需要这个迁移

审计发现:25 张模型表里 15 张从来没有任何迁移建过,只靠 `web/main.py` 启动时的
`Base.metadata.create_all(checkfirst=True)` 兜底。后果是迁移链**不是自包含的**——
干净库上 `alembic upgrade head` 跑到 005 就崩:
    no such table: decree_execution_events
    [SQL: ALTER TABLE decree_execution_events ADD COLUMN sequence ...]
因为 005/009 去 ALTER 一张从没被迁移 CREATE 的表(它假设 create_all 先建好)。

## 本迁移做什么

插在 004 和 005 之间(005 的 down_revision 已改指向本迁移),补建全部 15 张裸表:

- **decree_execution_events**:必须按 **004 时代 schema** 建(6 列 + task_occurred 索引,
  无 sequence、无 009 新增的 5 列),这样后续 005 加 sequence、009 加 5 列才能正常 ALTER。
  这是全库唯一被后续迁移改动的裸表(005+009),所以唯一需要手写历史 schema。
- **其余 14 张**(decision_tasks/court_reviews/swarm_runs/emperor_decisions/shiguan_archives/…):
  任何迁移都不 ALTER 它们,直接按**最终模型 schema** 用 Base.metadata 建。

## 现存库安全性

现存 dev/prod 库已在 head(010),alembic_version 记录已过 004b,**永不重跑本迁移**;
即便重跑,全部用 checkfirst=True / IF NOT EXISTS,已存在的表跳过,不破坏任何数据。
本迁移不停用 create_all(那是后续 Step 1C),两者暂时共存、幂等。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "004b_create_untracked_base_tables"
down_revision = "004_retrospective_outcome"
branch_labels = None
depends_on = None

# 被后续迁移 ALTER 的裸表——必须按【历史 schema】建,不能用最终模型:
#   decree_execution_events: 005 加 sequence/换索引, 009 加 5 列 → 建 004 时代 6 列版
#   build_ledger_entries / build_ledger_audit_events: 008 加 tenant_id+user_id+tenant_user 索引
#     → 建 pre-008 版(去掉这两列和该索引)
# (下面 robust 扫描 upgrade 路径确认只有这 3 张;测试会兜底任何遗漏。)
_ALTERED_LATER = {
    "chancellor_route_decisions",
    "court_reviews",
    "decision_tasks",
    "decree_execution_events",
    "emperor_decisions",
    "outbox_events",
    "shiguan_archives",
    "build_ledger_entries",
    "build_ledger_audit_events",
}

# 全部 15 张 create_all-only 裸表。
_UNTRACKED_TABLES = [
    "agent_skill_runs",
    "build_ledger_audit_events",
    "build_ledger_entries",
    "chancellor_route_decisions",
    "court_loop_runs",
    "court_reviews",
    "decision_tasks",
    "decree_execution_events",
    "emperor_decisions",
    "outbox_events",
    "shiguan_archives",
    "swarm_evidence_links",
    "swarm_quality_results",
    "swarm_runs",
    "swarm_task_runs",
]


def _create_decree_execution_events_004era(bind) -> None:
    """decree_execution_events 的 004 时代 schema:6 列 + task_occurred 索引。
    005 会加 sequence 列 / task_sequence 索引 / drop 掉 task_occurred 索引;
    009 会再加 event_type/trace_id/source_label/payload_json/idempotency_key 5 列。
    所以这里绝不能建成最终 schema,否则 005 的 add_column(sequence) 会撞'列已存在'。
    """
    insp = sa.inspect(bind)
    if "decree_execution_events" in insp.get_table_names():
        return  # 现存库已有(create_all 建的),跳过
    op.create_table(
        "decree_execution_events",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("task_id", sa.Text(), nullable=False),
        sa.Column("stage", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_decree_execution_events_task_occurred",
        "decree_execution_events",
        ["task_id", "occurred_at"],
    )


def _create_build_ledger_pre008(bind) -> None:
    """build_ledger_entries / build_ledger_audit_events 的 pre-008 schema:
    去掉 008 加的 tenant_id/user_id 两列和 ix_*_tenant_user 索引。008 upgrade 会补它们。"""
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())
    if "build_ledger_entries" not in existing:
        op.create_table(
            "build_ledger_entries",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("entry_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_build_ledger_entries_created", "build_ledger_entries", ["created_at"])
        op.create_index("ix_build_ledger_entries_task", "build_ledger_entries", ["task_id"])
    if "build_ledger_audit_events" not in existing:
        op.create_table(
            "build_ledger_audit_events",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("actor", sa.Text(), nullable=False),
            sa.Column("action", sa.Text(), nullable=False),
            sa.Column("from_status", sa.Text(), nullable=False),
            sa.Column("to_status", sa.Text(), nullable=False),
            sa.Column("note", sa.Text(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_build_ledger_audit_task", "build_ledger_audit_events", ["task_id"])


def _create_core_authority_pre012_013(bind) -> None:
    """Freeze the actual 011-era shape of tables changed by 012/013.

    Importing current ``Base.metadata`` here made historical revision 011 change
    whenever a later ORM column was added.  That destroys migration
    reproducibility and caused clean 011 databases to contain future columns.
    These definitions therefore intentionally omit EmperorDecision.kind and all
    P4.5 nullable tenant lineage columns.
    """
    existing = set(sa.inspect(bind).get_table_names())
    if "decision_tasks" not in existing:
        op.create_table(
            "decision_tasks",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("user_id", sa.Text(), nullable=False),
            sa.Column("raw_question", sa.Text(), nullable=False),
            sa.Column("refined_edict", sa.Text(), nullable=True),
            sa.Column("decision_type", sa.Text(), nullable=True),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("source_label", sa.Text(), nullable=False),
            sa.Column("risk_flags_json", sa.Text(), nullable=False),
            sa.Column("known_facts_json", sa.Text(), nullable=False),
            sa.Column("unknown_gaps_json", sa.Text(), nullable=False),
            sa.Column("recommended_departments_json", sa.Text(), nullable=False),
            sa.Column("draft_edict_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
        )
        op.create_index("ix_decision_tasks_status_created", "decision_tasks", ["status", "created_at"])
        op.create_index("ix_decision_tasks_user_updated", "decision_tasks", ["user_id", "updated_at"])
    if "court_reviews" not in existing:
        op.create_table(
            "court_reviews",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("routing_plan_json", sa.Text(), nullable=False),
            sa.Column("review_status", sa.Text(), nullable=False),
            sa.Column("ministry_outputs_json", sa.Text(), nullable=False),
            sa.Column("conflict_summary_json", sa.Text(), nullable=False),
            sa.Column("memorial_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
        )
        op.create_index("ix_court_reviews_task_status", "court_reviews", ["task_id", "review_status"])
    if "emperor_decisions" not in existing:
        op.create_table(
            "emperor_decisions",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("action", sa.Text(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("human_confirmed", sa.Boolean(), nullable=False),
            sa.Column("confirmation_record_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.Text(), nullable=False),
        )
        op.create_index("ix_emperor_decisions_task_created", "emperor_decisions", ["task_id", "created_at"])
    if "shiguan_archives" not in existing:
        op.create_table(
            "shiguan_archives",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("raw_question", sa.Text(), nullable=False),
            sa.Column("refined_edict", sa.Text(), nullable=False),
            sa.Column("final_memorial_json", sa.Text(), nullable=True),
            sa.Column("emperor_decision_json", sa.Text(), nullable=True),
            sa.Column("evidence_chain_json", sa.Text(), nullable=False),
            sa.Column("source_label", sa.Text(), nullable=False),
            sa.Column("synthetic_flag", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
        )
        op.create_index("ix_shiguan_archives_task_created", "shiguan_archives", ["task_id", "created_at"])
    if "chancellor_route_decisions" not in existing:
        op.create_table(
            "chancellor_route_decisions",
            sa.Column("decision_id", sa.Text(), primary_key=True),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("idempotency_key", sa.Text(), nullable=False),
            sa.Column("mode", sa.Text(), nullable=False),
            sa.Column("primary_department", sa.Text(), nullable=False),
            sa.Column("source_label", sa.Text(), nullable=False),
            sa.Column("supersedes_decision_id", sa.Text(), nullable=True),
            sa.Column("decision_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.UniqueConstraint("task_id", "idempotency_key", name="uq_chancellor_route_task_idem"),
        )
        op.create_index(
            "ix_chancellor_route_decisions_task_created",
            "chancellor_route_decisions",
            ["task_id", "created_at"],
        )
    if "outbox_events" not in existing:
        op.create_table(
            "outbox_events",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("decision_id", sa.Text(), nullable=False),
            sa.Column("event_type", sa.Text(), nullable=False),
            sa.Column("status", sa.Text(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False),
            sa.Column("max_attempts", sa.Integer(), nullable=False),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.Text(), nullable=False),
        )
        op.create_index("ix_outbox_events_status_created", "outbox_events", ["status", "created_at"])
        op.create_index("ix_outbox_events_task", "outbox_events", ["task_id"])


def upgrade() -> None:
    bind = op.get_bind()
    from src.db.models import Base

    # ① 被后续迁移 ALTER 的 3 张裸表:按历史(pre-alter)schema 手建。
    _create_decree_execution_events_004era(bind)  # 供 005/009 ALTER
    _create_build_ledger_pre008(bind)             # 供 008 ALTER
    _create_core_authority_pre012_013(bind)        # 供 012/013 ALTER

    # ② 其余 12 张纯裸表(任何迁移都不碰):最终模型 schema,checkfirst 幂等。
    for name in _UNTRACKED_TABLES:
        if name in _ALTERED_LATER:
            continue
        Base.metadata.tables[name].create(bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())
    # 逆序 drop(仅 drop 存在的,避免半途报错)。
    for name in reversed(_UNTRACKED_TABLES):
        if name in existing:
            op.drop_table(name)
