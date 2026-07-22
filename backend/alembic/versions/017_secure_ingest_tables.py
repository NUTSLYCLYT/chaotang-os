"""017 — R0-W03 安全摄取：secure_ingest_artifacts / secure_ingest_download_tickets /
secure_ingest_audit_events。

Revision ID: 017_secure_ingest_tables
Revises: 016_schema_literal_contract_guard
Create Date: 2026-07-22

不涉及 tenants/users（由 src/tenant.py sqlite3 原生管理）；tenant_id/user_id 为逻辑 FK，
沿用本仓库既有惯例（见 003_dept_admin_tables.py / 013_core_tenant_lineage.py）。
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "017_secure_ingest_tables"
down_revision = "016_schema_literal_contract_guard"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "secure_ingest_artifacts",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("user_id", sa.Text, nullable=False, server_default="anonymous"),
        sa.Column("mission_contract_id", sa.Text, nullable=False),
        sa.Column("original_filename", sa.Text, nullable=False, server_default=""),
        sa.Column("declared_content_type", sa.Text, nullable=False, server_default=""),
        sa.Column("detected_format", sa.Text, nullable=False),
        sa.Column("file_size_bytes", sa.Integer, nullable=False),
        sa.Column("page_count", sa.Integer, nullable=True),
        sa.Column("digest_sha256", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("reject_reason", sa.Text, nullable=True),
        sa.Column("ocr_status", sa.Text, nullable=False, server_default="NOT_APPLICABLE"),
        sa.Column("macro_detected", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("zip_bomb_suspected", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("injection_flag_categories_json", sa.Text, nullable=False, server_default="[]"),
        sa.Column("storage_path", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
    )
    op.create_index(
        "ix_secure_ingest_artifacts_tenant_mission",
        "secure_ingest_artifacts",
        ["tenant_id", "mission_contract_id"],
    )
    op.create_index(
        "ix_secure_ingest_artifacts_tenant_status",
        "secure_ingest_artifacts",
        ["tenant_id", "status"],
    )

    op.create_table(
        "secure_ingest_download_tickets",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("user_id", sa.Text, nullable=False, server_default="anonymous"),
        sa.Column("artifact_id", sa.Text, nullable=False),
        sa.Column("purpose", sa.Text, nullable=False),
        sa.Column("issued_at", sa.Text, nullable=False, server_default=""),
        sa.Column("expires_at", sa.Text, nullable=False),
        sa.Column("redeemed_at", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_secure_ingest_tickets_tenant_artifact",
        "secure_ingest_download_tickets",
        ["tenant_id", "artifact_id"],
    )

    op.create_table(
        "secure_ingest_audit_events",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("tenant_id", sa.Integer, nullable=False, server_default="1"),
        sa.Column("user_id", sa.Text, nullable=False, server_default="anonymous"),
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("task_id", sa.Text, nullable=True),
        sa.Column("artifact_id", sa.Text, nullable=True),
        sa.Column("input_digest", sa.Text, nullable=True),
        sa.Column("provider_id", sa.Text, nullable=True),
        sa.Column("model_id", sa.Text, nullable=True),
        sa.Column("policy_version", sa.Text, nullable=True),
        sa.Column("purpose", sa.Text, nullable=True),
        sa.Column("created_at", sa.Text, nullable=False, server_default=""),
    )
    op.create_index(
        "ix_secure_ingest_audit_tenant_event",
        "secure_ingest_audit_events",
        ["tenant_id", "event_type"],
    )
    op.create_index(
        "ix_secure_ingest_audit_artifact",
        "secure_ingest_audit_events",
        ["artifact_id"],
    )


def downgrade() -> None:
    op.drop_table("secure_ingest_audit_events")
    op.drop_table("secure_ingest_download_tickets")
    op.drop_table("secure_ingest_artifacts")
