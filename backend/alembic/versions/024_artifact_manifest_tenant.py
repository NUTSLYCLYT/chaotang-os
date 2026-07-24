"""024 — tenant scope for artifact manifests."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision = "024_artifact_manifest_tenant"
down_revision = "023_artifact_manifests"
branch_labels = None
depends_on = None

def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("artifact_manifests")}
    if "tenant_id" not in columns:
        op.add_column("artifact_manifests", sa.Column("tenant_id", sa.Integer(), nullable=True))
    desired = ["tenant_id", "task_id", "final_memorial_id", "final_memorial_version"]
    unique = next((c for c in sa.inspect(op.get_bind()).get_unique_constraints("artifact_manifests") if c["name"] == "uq_artifact_manifest_lineage"), None)
    if unique is None or unique.get("column_names") != desired:
        with op.batch_alter_table("artifact_manifests") as batch:
            if unique is not None:
                batch.drop_constraint("uq_artifact_manifest_lineage", type_="unique")
            batch.create_unique_constraint("uq_artifact_manifest_lineage", ["tenant_id", "task_id", "final_memorial_id", "final_memorial_version"])

def downgrade() -> None:
    if "artifact_manifests" not in sa.inspect(op.get_bind()).get_table_names():
        return
    inspector = sa.inspect(op.get_bind())
    unique_names = {c["name"] for c in inspector.get_unique_constraints("artifact_manifests")}
    with op.batch_alter_table("artifact_manifests") as batch:
        if "uq_artifact_manifest_lineage" in unique_names:
            batch.drop_constraint("uq_artifact_manifest_lineage", type_="unique")
        if "tenant_id" in {c["name"] for c in inspector.get_columns("artifact_manifests")}:
            batch.drop_column("tenant_id")
