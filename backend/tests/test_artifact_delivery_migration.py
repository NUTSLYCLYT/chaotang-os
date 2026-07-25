"""Disposable SQLite verification for artifact delivery revision 025."""

from __future__ import annotations

import hashlib
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


def _database_snapshot(path: Path) -> dict:
    engine = create_engine(f"sqlite:///{path}")
    try:
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        with engine.connect() as connection:
            return {
                "head": connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one(),
                "manifest_columns": tuple(
                    column["name"]
                    for column in inspector.get_columns("artifact_manifests")
                ),
                "manifest_rows": tuple(
                    connection.execute(
                        text("SELECT * FROM artifact_manifests ORDER BY id")
                    ).all()
                ),
                "item_table": "artifact_delivery_items" in table_names,
                "item_rows": tuple(
                    connection.execute(
                        text("SELECT * FROM artifact_delivery_items ORDER BY id")
                    ).all()
                )
                if "artifact_delivery_items" in table_names
                else (),
                "audit_table": "artifact_delivery_audit_events" in table_names,
                "audit_rows": tuple(
                    connection.execute(
                        text(
                            "SELECT * FROM artifact_delivery_audit_events "
                            "ORDER BY id"
                        )
                    ).all()
                )
                if "artifact_delivery_audit_events" in table_names
                else (),
                "temporary_tables": tuple(
                    sorted(
                        table_name
                        for table_name in table_names
                        if table_name.startswith("_alembic_tmp")
                    )
                ),
            }
    finally:
        engine.dispose()


def _attempt_downgrade(cfg) -> Exception | None:
    try:
        alembic_command.downgrade(cfg, "024_artifact_manifest_tenant")
    except Exception as exc:  # noqa: BLE001 - the probe inspects Alembic's failure type
        return exc
    return None


def _assert_preflight_refusal_preserved_database(
    *,
    before: dict,
    after: dict,
    error: Exception | None,
    message: str,
) -> None:
    assert after["head"] == _REVISION
    assert after["manifest_columns"] == before["manifest_columns"]
    assert after["manifest_rows"] == before["manifest_rows"]
    assert after["item_table"] is before["item_table"] is True
    assert after["item_rows"] == before["item_rows"]
    assert after["audit_table"] is before["audit_table"] is True
    assert after["audit_rows"] == before["audit_rows"]
    assert after["temporary_tables"] == before["temporary_tables"] == ()
    assert isinstance(error, RuntimeError)
    assert message in str(error)


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
        item_columns = {
            column["name"]
            for column in inspector.get_columns("artifact_delivery_items")
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
            "source_payload_json",
        }.issubset(manifest_columns)
        from src.contracts.artifact_manifest import ArtifactManifestV1

        assert "source_payload_json" not in ArtifactManifestV1.model_fields
        assert "artifact_delivery_items" in table_names
        assert "artifact_delivery_audit_events" in table_names
        assert "last_failure" in item_columns
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


def test_downgrade_refuses_duplicate_revision_024_lineage_before_ddl(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "duplicate-legacy-lineage.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, _REVISION)

    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        for revision_number in (1, 2):
            connection.execute(
                text(
                    """
                    INSERT INTO artifact_manifests (
                        id, tenant_id, task_id, final_memorial_id,
                        final_memorial_version, delivery_formula_version,
                        delivery_revision, idempotency_key_hash, payload_hash,
                        content_hash, manifest_json, overall_status, created_at
                    ) VALUES (
                        :id, 1, 'task-revisions', 'memorial-revisions',
                        1, 'w06-v1', :delivery_revision, :idempotency_key_hash,
                        :payload_hash, :content_hash, :manifest_json, 'READY',
                        '2026-07-25T00:00:00+00:00'
                    )
                    """
                ),
                {
                    "id": f"manifest-revision-{revision_number}",
                    "delivery_revision": revision_number,
                    "idempotency_key_hash": str(revision_number) * 64,
                    "payload_hash": chr(99 + revision_number) * 64,
                    "content_hash": chr(101 + revision_number) * 64,
                    "manifest_json": f'{{"delivery_revision":{revision_number}}}',
                },
            )
    engine.dispose()

    before = _database_snapshot(path)
    error = _attempt_downgrade(cfg)
    after = _database_snapshot(path)

    _assert_preflight_refusal_preserved_database(
        before=before,
        after=after,
        error=error,
        message="revision 024 lineage",
    )


@pytest.mark.parametrize(
    ("fact_table", "insert_sql"),
    [
        (
            "artifact_delivery_items",
            """
            INSERT INTO artifact_delivery_items (
                id, tenant_id, manifest_id, kind, mime_type, state,
                storage_path, content_hash, byte_size, incomplete_reason,
                retry_count, resume_token_hash, expires_at, created_at,
                updated_at
            ) VALUES (
                'artifact-fact', 1, 'manifest-facts', 'PDF',
                'application/pdf', 'STORED', '/tmp/disposable-artifact.pdf',
                :content_hash, 4, NULL, 0, NULL, NULL,
                '2026-07-25T00:00:00+00:00',
                '2026-07-25T00:00:00+00:00'
            )
            """,
        ),
        (
            "artifact_delivery_audit_events",
            """
            INSERT INTO artifact_delivery_audit_events (
                id, tenant_id, manifest_id, artifact_id, event_type,
                outcome, detail_json, created_at
            ) VALUES (
                'audit-fact', 1, 'manifest-facts', NULL,
                'delivery.persisted', 'SUCCESS', :detail_json,
                '2026-07-25T00:00:00+00:00'
            )
            """,
        ),
    ],
)
def test_downgrade_refuses_persisted_delivery_facts_before_ddl(
    tmp_path: Path,
    monkeypatch,
    fact_table: str,
    insert_sql: str,
) -> None:
    path = tmp_path / f"{fact_table}.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, _REVISION)

    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO artifact_manifests (
                    id, tenant_id, task_id, final_memorial_id,
                    final_memorial_version, delivery_formula_version,
                    delivery_revision, idempotency_key_hash, payload_hash,
                    content_hash, manifest_json, overall_status, created_at
                    ) VALUES (
                        'manifest-facts', 1, 'task-facts', 'memorial-facts',
                        1, 'w06-v1', 1, :idempotency_key_hash, :payload_hash,
                        :content_hash, :manifest_json, 'READY',
                        '2026-07-25T00:00:00+00:00'
                    )
                """
            ),
            {
                "idempotency_key_hash": "7" * 64,
                "payload_hash": "8" * 64,
                "content_hash": "9" * 64,
                "manifest_json": '{"delivery_revision":1}',
            },
        )
        connection.execute(
            text(insert_sql),
            {
                "content_hash": "a" * 64,
                "detail_json": '{"stored":true}',
            },
        )
    engine.dispose()

    before = _database_snapshot(path)
    error = _attempt_downgrade(cfg)
    after = _database_snapshot(path)

    _assert_preflight_refusal_preserved_database(
        before=before,
        after=after,
        error=error,
        message="persisted delivery facts",
    )


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
                SELECT delivery_revision, idempotency_key_hash, payload_hash,
                       source_payload_json
                FROM artifact_manifests WHERE id = 'legacy-manifest'
                """
            )
        ).one() == (None, None, None, None)
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
            "source_payload_json",
        } <= {
            column["name"]
            for column in inspector.get_columns("artifact_manifests")
        }
    finally:
        engine.dispose()


def test_downgrade_refuses_internal_source_payload_before_ddl(
    tmp_path: Path,
    monkeypatch,
) -> None:
    path = tmp_path / "source-payload-fact.db"
    cfg = _config(path, monkeypatch)
    alembic_command.upgrade(cfg, _REVISION)
    source_payload_json = '{"title":"durable source"}'

    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO artifact_manifests (
                    id, tenant_id, task_id, final_memorial_id,
                    final_memorial_version, delivery_formula_version,
                    delivery_revision, idempotency_key_hash, payload_hash,
                    source_payload_json, content_hash, manifest_json,
                    overall_status, created_at
                ) VALUES (
                    'manifest-source', 1, 'task-source', 'memorial-source',
                    1, 'w06-v1', 1, :idempotency_key_hash, :payload_hash,
                    :source_payload_json, :content_hash, :manifest_json,
                    'READY', '2026-07-25T00:00:00+00:00'
                )
                """
            ),
            {
                "idempotency_key_hash": "a" * 64,
                "payload_hash": hashlib.sha256(source_payload_json.encode()).hexdigest(),
                "source_payload_json": source_payload_json,
                "content_hash": "b" * 64,
                "manifest_json": '{"delivery_revision":1}',
            },
        )
    engine.dispose()

    before = _database_snapshot(path)
    error = _attempt_downgrade(cfg)
    after = _database_snapshot(path)

    _assert_preflight_refusal_preserved_database(
        before=before,
        after=after,
        error=error,
        message="source payload",
    )
