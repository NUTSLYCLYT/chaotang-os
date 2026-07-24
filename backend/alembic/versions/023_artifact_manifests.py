"""023 — persist canonical W06 ArtifactManifest records."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "023_artifact_manifests"
down_revision = "022_shiguan_memorial_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "artifact_manifests" not in inspector.get_table_names():
        op.create_table(
            "artifact_manifests",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("task_id", sa.Text(), nullable=False),
            sa.Column("final_memorial_id", sa.Text(), nullable=False),
            sa.Column("final_memorial_version", sa.Integer(), nullable=False),
            sa.Column("delivery_formula_version", sa.Text(), nullable=False),
            sa.Column("content_hash", sa.Text(), nullable=True),
            sa.Column("manifest_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("overall_status", sa.Text(), nullable=False, server_default="PARTIAL"),
            sa.Column("created_at", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("task_id", "final_memorial_id", "final_memorial_version", name="uq_artifact_manifest_lineage"),
        )


def downgrade() -> None:
    if "artifact_manifests" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("artifact_manifests")
