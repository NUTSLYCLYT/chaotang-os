"""025 - persist artifact delivery revisions, item state, and audit events."""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "025_artifact_delivery_state"
down_revision = "024_artifact_manifest_tenant"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("artifact_manifests") as batch:
        batch.add_column(sa.Column("delivery_revision", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("idempotency_key_hash", sa.Text(), nullable=True))
        batch.add_column(sa.Column("payload_hash", sa.Text(), nullable=True))
        batch.add_column(sa.Column("source_payload_json", sa.Text(), nullable=True))
        batch.drop_constraint("uq_artifact_manifest_lineage", type_="unique")
        batch.create_unique_constraint(
            "uq_artifact_manifest_lineage",
            [
                "tenant_id",
                "task_id",
                "final_memorial_id",
                "final_memorial_version",
                "delivery_formula_version",
                "delivery_revision",
            ],
        )
        batch.create_unique_constraint(
            "uq_artifact_manifest_tenant_idempotency",
            ["tenant_id", "idempotency_key_hash"],
        )

    op.create_table(
        "artifact_delivery_items",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("manifest_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("state", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("storage_path", sa.Text(), nullable=True),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("incomplete_reason", sa.Text(), nullable=True),
        sa.Column("last_failure", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("resume_token_hash", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "manifest_id",
            "kind",
            name="uq_artifact_delivery_items_manifest_kind",
        ),
    )
    op.create_index(
        "ix_artifact_delivery_items_tenant_manifest",
        "artifact_delivery_items",
        ["tenant_id", "manifest_id"],
    )

    op.create_table(
        "artifact_delivery_audit_events",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("manifest_id", sa.Text(), nullable=False),
        sa.Column("artifact_id", sa.Text(), nullable=True),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("detail_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_artifact_delivery_audit_tenant_manifest_created",
        "artifact_delivery_audit_events",
        ["tenant_id", "manifest_id", "created_at"],
    )
    op.create_index(
        "ix_artifact_delivery_audit_artifact",
        "artifact_delivery_audit_events",
        ["artifact_id"],
    )


def _preflight_downgrade() -> None:
    bind = op.get_bind()
    duplicate_lineage = bind.execute(
        sa.text(
            """
            SELECT
                tenant_id,
                task_id,
                final_memorial_id,
                final_memorial_version,
                COUNT(*) AS revision_count
            FROM artifact_manifests
            WHERE tenant_id IS NOT NULL
            GROUP BY
                tenant_id,
                task_id,
                final_memorial_id,
                final_memorial_version
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).mappings().first()
    if duplicate_lineage is not None:
        raise RuntimeError(
            "refusing downgrade 025 to 024: multiple delivery revisions "
            "cannot fit the revision 024 lineage constraint"
        )

    fact_counts = {
        table_name: bind.execute(
            sa.text(f"SELECT COUNT(*) FROM {table_name}")
        ).scalar_one()
        for table_name in (
            "artifact_delivery_items",
            "artifact_delivery_audit_events",
        )
    }
    populated_tables = [
        f"{table_name}={row_count}"
        for table_name, row_count in fact_counts.items()
        if row_count
    ]
    if populated_tables:
        raise RuntimeError(
            "refusing downgrade 025 to 024: persisted delivery facts would "
            f"be deleted ({', '.join(populated_tables)})"
        )

    identity_count = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM artifact_manifests
            WHERE delivery_revision IS NOT NULL
               OR idempotency_key_hash IS NOT NULL
               OR payload_hash IS NOT NULL
               OR source_payload_json IS NOT NULL
            """
        )
    ).scalar_one()
    if identity_count:
        raise RuntimeError(
            "refusing downgrade 025 to 024: revision 025 identity facts "
            f"would be deleted (artifact_manifests={identity_count})"
        )


def downgrade() -> None:
    _preflight_downgrade()

    op.drop_table("artifact_delivery_audit_events")
    op.drop_table("artifact_delivery_items")

    with op.batch_alter_table("artifact_manifests") as batch:
        batch.drop_constraint(
            "uq_artifact_manifest_tenant_idempotency",
            type_="unique",
        )
        batch.drop_constraint("uq_artifact_manifest_lineage", type_="unique")
        batch.drop_column("source_payload_json")
        batch.drop_column("payload_hash")
        batch.drop_column("idempotency_key_hash")
        batch.drop_column("delivery_revision")
        batch.create_unique_constraint(
            "uq_artifact_manifest_lineage",
            [
                "tenant_id",
                "task_id",
                "final_memorial_id",
                "final_memorial_version",
            ],
        )
