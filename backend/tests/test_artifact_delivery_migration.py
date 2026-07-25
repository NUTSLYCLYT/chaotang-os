"""Disposable SQLite verification for artifact delivery revision 025."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

alembic_command = pytest.importorskip("alembic.command")
alembic_config = pytest.importorskip("alembic.config")

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"
_REVISION = "025_artifact_delivery_state"


def _config(path: Path, monkeypatch):
    monkeypatch.setenv("DB_URL", f"sqlite:///{path}")
    monkeypatch.chdir(_BACKEND_ROOT)
    return alembic_config.Config(str(_ALEMBIC_INI))


def _unique_columns(inspector, table_name: str) -> set[tuple[str, ...]]:
    return {
        tuple(constraint["column_names"])
        for constraint in inspector.get_unique_constraints(table_name)
    }


def test_upgrade_creates_delivery_state_schema(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "artifact-delivery.db"
    cfg = _config(path, monkeypatch)

    alembic_command.upgrade(cfg, _REVISION)

    engine = create_engine(f"sqlite:///{path}")
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        manifest_columns = {
            column["name"] for column in inspector.get_columns("artifact_manifests")
        }
        with engine.connect() as connection:
            head = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()

        assert head == _REVISION
        assert {
            "delivery_revision",
            "idempotency_key_hash",
            "payload_hash",
        }.issubset(manifest_columns)
        assert "artifact_delivery_items" in table_names
        assert "artifact_delivery_audit_events" in table_names
        assert (
            "tenant_id",
            "idempotency_key_hash",
        ) in _unique_columns(inspector, "artifact_manifests")
        assert (
            "tenant_id",
            "task_id",
            "final_memorial_id",
            "final_memorial_version",
            "delivery_formula_version",
            "delivery_revision",
        ) in _unique_columns(inspector, "artifact_manifests")
        assert (
            "manifest_id",
            "kind",
        ) in _unique_columns(inspector, "artifact_delivery_items")
    finally:
        engine.dispose()


def test_upgrade_downgrade_reupgrade_preserves_legacy_manifest(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "artifact-delivery-loop.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, "024_artifact_manifest_tenant")

    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO artifact_manifests (
                    id, tenant_id, task_id, final_memorial_id,
                    final_memorial_version, delivery_formula_version,
                    content_hash, manifest_json, overall_status, created_at
                ) VALUES (
                    'legacy-manifest', 1, 'legacy-task', 'legacy-memorial',
                    1, 'w06-v1', NULL, '{}', 'PARTIAL',
                    '2026-07-25T00:00:00+00:00'
                )
                """
            )
        )
    engine.dispose()

    alembic_command.upgrade(cfg, _REVISION)
    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        assert connection.execute(
            text(
                """
                SELECT delivery_revision, idempotency_key_hash, payload_hash
                FROM artifact_manifests WHERE id = 'legacy-manifest'
                """
            )
        ).one() == (None, None, None)
    engine.dispose()

    alembic_command.downgrade(cfg, "024_artifact_manifest_tenant")
    engine = create_engine(f"sqlite:///{path}")
    try:
        inspector = inspect(engine)
        assert "delivery_revision" not in {
            column["name"]
            for column in inspector.get_columns("artifact_manifests")
        }
        assert "artifact_delivery_items" not in inspector.get_table_names()
        assert "artifact_delivery_audit_events" not in inspector.get_table_names()
        with engine.connect() as connection:
            assert connection.execute(
                text(
                    "SELECT manifest_json FROM artifact_manifests "
                    "WHERE id = 'legacy-manifest'"
                )
            ).scalar_one() == "{}"
    finally:
        engine.dispose()

    alembic_command.upgrade(cfg, _REVISION)
    engine = create_engine(f"sqlite:///{path}")
    try:
        inspector = inspect(engine)
        assert {
            "delivery_revision",
            "idempotency_key_hash",
            "payload_hash",
        } <= {
            column["name"]
            for column in inspector.get_columns("artifact_manifests")
        }
    finally:
        engine.dispose()
