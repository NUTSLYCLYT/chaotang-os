"""005 — decree_execution_events.sequence：给状态时间线加确定性排序序号。

Revision ID: 005_decree_execution_event_sequence
Revises: 004_retrospective_outcome
Create Date: 2026-07-12

见 /home/ubuntu/.claude/plans/valiant-crunching-candy.md 阶段4："TimelineEvent 加序号，
消除排序脆弱性"。occurred_at 只精确到秒，同一秒内触发的多个事件(例如
confirm-edict 写的 chancellor 事件和几乎同一秒触发的 worker 事件)排序会退化成
不确定的插入顺序。这里加一个 task_id 内单调递增的 sequence 列，_load_timeline()
改用它排序，occurred_at 仍保留用于展示时间戳。

对已有行做一次性回填：按 task_id 分组、occurred_at/id 排序后逐行编号，
不依赖任何数据库方言特有的窗口函数语法，纯 SQLAlchemy Core，sqlite/postgres 通用。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "005_decree_execution_event_sequence"
# 2026-07-14: 原 down_revision 是 004,但 005 假设 create_all 已建好
# decree_execution_events 才去 ALTER 它,干净库上会崩。插入 004b 先按 004 时代
# schema 建该表(及其余 14 张裸表),让迁移链自包含。见 004b 迁移文件说明。
down_revision = "004b_create_untracked_base_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "decree_execution_events",
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_decree_execution_events_task_sequence",
        "decree_execution_events",
        ["task_id", "sequence"],
    )
    op.drop_index(
        "ix_decree_execution_events_task_occurred",
        table_name="decree_execution_events",
    )

    conn = op.get_bind()
    events = sa.table(
        "decree_execution_events",
        sa.column("id", sa.Text),
        sa.column("task_id", sa.Text),
        sa.column("occurred_at", sa.Text),
        sa.column("sequence", sa.Integer),
    )
    rows = conn.execute(
        sa.select(events.c.id, events.c.task_id).order_by(
            events.c.task_id, events.c.occurred_at, events.c.id
        )
    ).fetchall()
    counters: dict[str, int] = {}
    for row in rows:
        counters[row.task_id] = counters.get(row.task_id, 0) + 1
        conn.execute(
            events.update()
            .where(events.c.id == row.id)
            .values(sequence=counters[row.task_id])
        )


def downgrade() -> None:
    op.create_index(
        "ix_decree_execution_events_task_occurred",
        "decree_execution_events",
        ["task_id", "occurred_at"],
    )
    op.drop_index(
        "ix_decree_execution_events_task_sequence",
        table_name="decree_execution_events",
    )
    op.drop_column("decree_execution_events", "sequence")
