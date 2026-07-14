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
    # 2026-07-14 复审:004b 对已经靠 create_all 建过表的库是 checkfirst 直接跳过
    # 创建——那种库里 decree_execution_events 已经是"最终" ORM schema(sequence
    # 列、索引都已存在),这里如果不判断存在性直接 add_column/create_index/
    # drop_index,会在这类库上炸"duplicate column"/"index already exists"/
    # "no such index",迁移链在非干净库上会中途崩溃(数据丢失风险)。
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_cols = {c["name"] for c in insp.get_columns("decree_execution_events")}
    existing_idx = {i["name"] for i in insp.get_indexes("decree_execution_events")}

    sequence_is_new = "sequence" not in existing_cols
    if sequence_is_new:
        op.add_column(
            "decree_execution_events",
            sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
        )
    if "ix_decree_execution_events_task_sequence" not in existing_idx:
        op.create_index(
            "ix_decree_execution_events_task_sequence",
            "decree_execution_events",
            ["task_id", "sequence"],
        )
    if "ix_decree_execution_events_task_occurred" in existing_idx:
        op.drop_index(
            "ix_decree_execution_events_task_occurred",
            table_name="decree_execution_events",
        )

    # 2026-07-14 复审 #2:回填不能只靠"sequence 是不是本迁移新建的"判断——
    # sequence_is_new=False 不代表数据可信,列可能是本迁移上一次跑到一半崩溃
    # (SQLite 下 alembic 按非事务性 DDL 跑,见 env.py)留下的:列已 add_column,
    # 但回填循环还没跑完/根本没跑,retry 时会看到"列已存在"就误判成合法数据、
    # 永久跳过回填,行数据永远卡在退化的 DEFAULT 0。
    #
    # 复用 src/db/flow_store.py::_repair_decree_execution_event_sequence_if_degenerate
    # 已经过 3 轮 Codex 审查定型的判据:合法 sequence 永远从 1 开始(本回填、
    # ORM 自愈回填、record_timeline_event 写入时的 MAX(已有值)+1 都是从 1 起),
    # 所以任何 sequence=0 的行只可能是"从未被回填过"的残留状态,不可能是合法
    # 写入产生的值。改判"是否存在 sequence=0 的行"而不是"列是否新建",
    # 才能同时覆盖:全新库(全表都是 0)、退化 retry(部分/全部卡 0)两种要回填
    # 的场景,又不会碰真正已经合法赋值(全表都 >=1)的历史数据。
    #
    # 2026-07-14 复审 #3:上一版判据只看"表里存不存在 sequence=0 的行"决定要不
    # 要回填,但回填循环没按这个判据收窄——只要任意一个 task_id 有一行退化,就把
    # 全表所有 task_id 都按 occurred_at/id 重排一遍,会拿"事后猜的"顺序覆盖跟这
    # 行退化数据完全无关的其它 task_id 已经合法的 sequence。改成:只把"存在退化
    # 行"的那些 task_id 挑出来重排,其余 task_id 的行完全不碰。回填仍是幂等的
    # 纯重新推导,同一 task_id 内重复跑不会破坏排序;跨 task_id 不再互相牵连。
    conn = bind
    events = sa.table(
        "decree_execution_events",
        sa.column("id", sa.Text),
        sa.column("task_id", sa.Text),
        sa.column("occurred_at", sa.Text),
        sa.column("sequence", sa.Integer),
    )
    degenerate_task_ids = {
        row.task_id
        for row in conn.execute(
            sa.select(events.c.task_id).where(events.c.sequence == 0).distinct()
        )
    }
    if degenerate_task_ids:
        rows = conn.execute(
            sa.select(events.c.id, events.c.task_id)
            .where(events.c.task_id.in_(degenerate_task_ids))
            .order_by(events.c.task_id, events.c.occurred_at, events.c.id)
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
