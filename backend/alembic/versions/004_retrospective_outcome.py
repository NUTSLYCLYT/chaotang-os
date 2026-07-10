"""004 — retrospectives.outcome：给复盘加简单三态结果字段。

Revision ID: 004_retrospective_outcome
Revises: 003_dept_admin_tables
Create Date: 2026-07-10

前端史馆有个简单三态复盘标签(成功/受阻/待定)，但后端复盘概念此前只有
score(1-5 打分)+successes/failures/lessons(经验教训列表)，没有对应的三态字段——
score/failures 是否为空都不能可靠推出三态结果(见 docs/shiguan-jinyiwei-wiring-plan
复审)。这里加一个真实存储的字段，不用计算派生，避免"score=3 但 failures 非空"
之类的模糊态硬要拍成某一态。
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "004_retrospective_outcome"
down_revision = "003_dept_admin_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "retrospectives",
        sa.Column("outcome", sa.Text(), nullable=False, server_default="pending"),
    )


def downgrade() -> None:
    op.drop_column("retrospectives", "outcome")
