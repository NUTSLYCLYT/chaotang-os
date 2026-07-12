"""007 — jinyiwei_evidence.(tenant_id, claim_key) 加真正的唯一约束。

Revision ID: 007_jinyiwei_evidence_unique_constraint
Revises: 006_jinyiwei_evidence
Create Date: 2026-07-12

P0(外部审查指出)：`upsert_evidence()` 的去重逻辑是"先 SELECT 有没有，
没有就 INSERT"——`(tenant_id, claim_key)` 此前只是普通索引，不是数据库级
唯一约束，两个并发写入(比如两个任务几乎同时发现同一条情报)都可能在对方
提交前各自查到"不存在"，都插入，产生重复行，破坏这张表本该是"按
(tenant_id, claim_key) 去重的内容池"这个不变式。

对已有行做一次性去重(保留 updated_at 最新的一行，删掉同组里其余的)，
再加真正的 UniqueConstraint——不依赖任何数据库方言特有语法，纯
SQLAlchemy Core，sqlite/postgres 通用。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "007_jinyiwei_evidence_unique_constraint"
down_revision = "006_jinyiwei_evidence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    evidence = sa.table(
        "jinyiwei_evidence",
        sa.column("id", sa.Text),
        sa.column("tenant_id", sa.Integer),
        sa.column("claim_key", sa.Text),
        sa.column("updated_at", sa.Text),
    )
    rows = conn.execute(
        sa.select(
            evidence.c.id, evidence.c.tenant_id, evidence.c.claim_key, evidence.c.updated_at
        ).order_by(evidence.c.tenant_id, evidence.c.claim_key, evidence.c.updated_at.desc())
    ).fetchall()
    seen: set[tuple[int, str]] = set()
    stale_ids: list[str] = []
    for row in rows:
        group_key = (row.tenant_id, row.claim_key)
        if group_key in seen:
            stale_ids.append(row.id)
        else:
            seen.add(group_key)
    for stale_id in stale_ids:
        conn.execute(evidence.delete().where(evidence.c.id == stale_id))

    op.drop_index("ix_jinyiwei_evidence_tenant_key", table_name="jinyiwei_evidence")
    op.create_unique_constraint(
        "uq_jinyiwei_evidence_tenant_claim_key",
        "jinyiwei_evidence",
        ["tenant_id", "claim_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_jinyiwei_evidence_tenant_claim_key",
        "jinyiwei_evidence",
        type_="unique",
    )
    op.create_index(
        "ix_jinyiwei_evidence_tenant_key", "jinyiwei_evidence", ["tenant_id", "claim_key"]
    )
