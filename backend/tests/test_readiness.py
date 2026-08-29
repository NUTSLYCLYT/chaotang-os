from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import subprocess
from contextlib import closing
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.agents.runtime_skills.execution_ledger import RuntimeBindingLedger
from app.jinyiwei import db as jinyiwei_db
from app.main import app
from app.operations.runtime_data_registry import (
    RUNTIME_DATA_ENTRIES,
    RUNTIME_DATA_REGISTRY,
    RUNTIME_DATA_REGISTRY_DIGEST,
    SHIGUAN_V5_PREDECESSOR,
    RuntimeDataEntry,
    observe_schema_contract_connection,
    validate_registered_schema_connection,
)
from app.readiness import (
    ReadinessResult,
    ReadinessSettings,
    _local_credential_available,
    run_readiness_preflight,
)
from app.shiguan import db as shiguan_db
from app.shiguan import maintenance
from app.shiguan.errors import ShiguanStorageError


def _settings(tmp_path: Path) -> ReadinessSettings:
    data = tmp_path / "data"
    data.mkdir()
    providers = tmp_path / "providers.yaml"
    providers.write_text(
        "active: deepseek\nproviders:\n  deepseek:\n"
        "    base_url: https://example.invalid/v1\n    api_key_env: TEST_KEY\n"
        "    default_model: fake\n    models: [fake]\n",
        encoding="utf-8",
    )
    return ReadinessSettings(
        data_dir=data,
        providers_config_path=providers,
        environ={"TEST_KEY": "fake", "JINYIWEI_MCP_CREDENTIAL_SOURCE": "local"},
        mcp_registry_loader=lambda: SimpleNamespace(servers=(), approvals=()),
        local_credential_available=lambda: True,
    )


def test_readyz_is_additive_and_preserves_all_existing_routes(monkeypatch) -> None:
    import app.main as main

    monkeypatch.setattr(main, "run_readiness_preflight", lambda: ReadinessResult(()))
    monkeypatch.setattr(
        main.app.state,
        "decree_job_worker",
        SimpleNamespace(is_alive=lambda: True),
        raising=False,
    )
    response = main.readiness()
    assert response.status_code == 200
    assert json.loads(response.body) == {"codes": ["ready"]}
    assert {
        "/health",
        "/readyz",
        "/api/v1/auth/login",
        "/api/v1/chancellor-consult",
        "/api/v1/chancellor-drafts",
        "/api/v1/daily-memorial-drafts/latest",
        "/api/v1/daily-memorial-drafts/{draft_id}/confirm",
        "/api/v1/decree-jobs/{job_id}",
        "/api/v1/decree-jobs/{job_id}/cancel",
        "/api/v1/decrees/chancellor",
        "/api/v1/jinyiwei/investigations",
        "/api/v1/junjichu/cases",
        "/api/v1/qintianjian/consult",
        "/api/v1/report-artifacts/{artifact_id}/download",
        "/api/v1/shiguan/archives",
    } <= set(app.openapi()["paths"])


def test_readyz_rejects_a_missing_or_stopped_decree_worker(monkeypatch) -> None:
    import app.main as main

    monkeypatch.setattr(main, "run_readiness_preflight", lambda: ReadinessResult(()))
    monkeypatch.delattr(main.app.state, "decree_job_worker", raising=False)

    missing_response = main.readiness()

    assert missing_response.status_code == 503
    assert json.loads(missing_response.body) == {"codes": ["worker_not_running"]}

    monkeypatch.setattr(
        main.app.state,
        "decree_job_worker",
        SimpleNamespace(is_alive=lambda: False),
        raising=False,
    )

    response = main.readiness()

    assert response.status_code == 503
    assert json.loads(response.body) == {"codes": ["worker_not_running"]}


def test_readyz_reports_stable_unready_and_exception_codes(monkeypatch) -> None:
    import app.main as main

    monkeypatch.setattr(
        main,
        "run_readiness_preflight",
        lambda: ReadinessResult(("provider_credential_missing",)),
    )
    response = main.readiness()
    assert response.status_code == 503
    assert json.loads(response.body) == {"codes": ["provider_credential_missing"]}

    def fail_preflight() -> ReadinessResult:
        raise RuntimeError("sensitive implementation detail")

    monkeypatch.setattr(main, "run_readiness_preflight", fail_preflight)
    response = main.readiness()
    assert response.status_code == 503
    assert json.loads(response.body) == {"codes": ["readiness_check_failed"]}


def test_readiness_rejects_a_symlinked_data_root(tmp_path: Path) -> None:
    settings_root = tmp_path / "settings"
    settings_root.mkdir()
    settings = _settings(settings_root)
    settings.data_dir.rmdir()
    real_root = tmp_path / "real-data"
    real_root.mkdir()
    settings.data_dir.symlink_to(real_root, target_is_directory=True)

    assert "data_volume_missing" in run_readiness_preflight(settings).codes


def test_readiness_rejects_a_symlinked_data_root_parent(tmp_path: Path) -> None:
    real_parent = tmp_path / "real-parent"
    real_parent.mkdir()
    (real_parent / "data").mkdir()
    linked_parent = tmp_path / "linked-parent"
    linked_parent.symlink_to(real_parent, target_is_directory=True)
    settings_root = tmp_path / "settings"
    settings_root.mkdir()
    settings = replace(_settings(settings_root), data_dir=linked_parent / "data")

    assert "data_volume_missing" in run_readiness_preflight(settings).codes


def test_readiness_checks_existing_decree_job_schema(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    database = settings.data_dir / "decree_jobs.sqlite3"
    with closing(sqlite3.connect(database)) as connection:
        connection.execute("CREATE TABLE decree_jobs (job_id TEXT)")
        connection.commit()
    assert run_readiness_preflight(settings).codes == ("storage_schema_unsupported",)


def test_readiness_accepts_current_shiguan_v6_and_jinyiwei_v5(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    jinyiwei_db.initialize_database(settings.data_dir / "jinyiwei.sqlite3")
    with closing(shiguan_db.get_connection(settings.data_dir / "shiguan.sqlite3")):
        pass

    assert run_readiness_preflight(settings).codes == ()


def test_registry_preserves_exact_shiguan_v5_predecessor_fact() -> None:
    assert SHIGUAN_V5_PREDECESSOR == RuntimeDataEntry(
        name="shiguan.sqlite3",
        relative_path="shiguan.sqlite3",
        user_version=5,
        required_tables=(
            "archive_decisions",
            "archive_evidence",
            "archive_evidence_references",
            "archive_relations",
            "archive_review_status",
            "archives",
            "auth_sessions",
            "daily_memorial_fact_snapshots",
            "daily_memorial_runs",
            "daily_memorial_stage_results",
            "users",
        ),
        required_triggers=(),
        schema_contract_digest=(
            "sha256:be55daeb1f9fa9602915351b8b26831103557a54bfa628a4c3bac70e14da8493"
        ),
    )


def test_connection_schema_observation_restores_query_only_state(tmp_path: Path) -> None:
    path = tmp_path / "runtime_bindings.sqlite3"
    RuntimeBindingLedger(path)
    entry = next(item for item in RUNTIME_DATA_ENTRIES if item.name == path.name)

    with sqlite3.connect(path) as connection:
        assert connection.execute("PRAGMA query_only").fetchone() == (0,)
        assert validate_registered_schema_connection(connection, entry) is True
        assert connection.execute("PRAGMA query_only").fetchone() == (0,)

        connection.execute("PRAGMA query_only = ON")
        observe_schema_contract_connection(connection)
        assert connection.execute("PRAGMA query_only").fetchone() == (1,)

        def mapping_factory(cursor, row):
            return {column[0]: row[index] for index, column in enumerate(cursor.description)}

        connection.row_factory = mapping_factory
        assert validate_registered_schema_connection(connection, entry) is True
        assert connection.row_factory is mapping_factory
        assert connection.execute("PRAGMA query_only").fetchone()["query_only"] == 1


def test_shiguan_registry_requires_one_verified_migration_state(tmp_path: Path) -> None:
    path = tmp_path / "shiguan.sqlite3"
    with closing(shiguan_db.get_connection(path)):
        pass
    entry = next(item for item in RUNTIME_DATA_ENTRIES if item.name == path.name)

    with sqlite3.connect(path) as connection:
        observed = observe_schema_contract_connection(connection)
        connection.execute("DROP TRIGGER schema_migration_verification_guard_update")
        connection.execute(
            "UPDATE schema_migration_verification "
            "SET status = 'PENDING_VERIFICATION', verified_at = NULL WHERE id = 1"
        )
        drifted = observe_schema_contract_connection(connection)
        semantic_entry = replace(
            entry,
            required_triggers=tuple(item["name"] for item in drifted["triggers"]),
            schema_contract_digest=(
                "sha256:"
                + hashlib.sha256(
                    json.dumps(
                        drifted,
                        ensure_ascii=True,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest()
            ),
        )
        assert observed["userVersion"] == 6
        assert validate_registered_schema_connection(connection, semantic_entry) is False


def test_shiguan_consumers_reject_empty_verified_timestamp(tmp_path: Path) -> None:
    path = tmp_path / "shiguan.sqlite3"
    with closing(shiguan_db.get_connection(path)):
        pass
    entry = next(item for item in RUNTIME_DATA_ENTRIES if item.name == path.name)

    with sqlite3.connect(path) as connection:
        trigger_sql = connection.execute(
            "SELECT sql FROM sqlite_master "
            "WHERE type='trigger' AND name='schema_migration_verification_guard_update'"
        ).fetchone()[0]
        connection.execute("DROP TRIGGER schema_migration_verification_guard_update")
        connection.execute("PRAGMA ignore_check_constraints = ON")
        connection.execute(
            "UPDATE schema_migration_verification SET verified_at = '' WHERE id = 1"
        )
        connection.execute("PRAGMA ignore_check_constraints = OFF")
        connection.execute(trigger_sql)
        connection.commit()
        assert validate_registered_schema_connection(connection, entry) is False

    with pytest.raises(ShiguanStorageError, match="验证"):
        shiguan_db.get_connection(path)
    assert maintenance.inspect_runtime_database(path).ready is False


@pytest.mark.parametrize(
    "rows",
    [
        (),
        ((1, "PENDING_VERIFICATION", None),),
        ((1, "INVALID", "2026-08-28T00:00:00+00:00"),),
        (
            (1, "VERIFIED", "2026-08-28T00:00:00+00:00"),
            (2, "VERIFIED", "2026-08-28T00:00:00+00:00"),
        ),
    ],
)
def test_shiguan_semantic_validator_rejects_missing_invalid_or_duplicate_state(
    rows: tuple[tuple[object, ...], ...],
) -> None:
    with sqlite3.connect(":memory:") as connection:
        connection.execute("PRAGMA user_version = 6")
        connection.execute(
            "CREATE TABLE schema_migration_verification "
            "(id INTEGER, status TEXT, verified_at TEXT)"
        )
        connection.executemany(
            "INSERT INTO schema_migration_verification VALUES (?,?,?)", rows
        )
        observed = observe_schema_contract_connection(connection)
        entry = RuntimeDataEntry(
            name="shiguan.sqlite3",
            relative_path="shiguan.sqlite3",
            user_version=6,
            required_tables=("schema_migration_verification",),
            required_triggers=(),
            schema_contract_digest=(
                "sha256:"
                + hashlib.sha256(
                    json.dumps(
                        observed,
                        ensure_ascii=True,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest()
            ),
        )

        assert validate_registered_schema_connection(connection, entry) is False


def test_runtime_data_registry_is_closed_and_includes_all_seven_stores() -> None:
    assert tuple(entry.name for entry in RUNTIME_DATA_ENTRIES) == (
        "decree_jobs.sqlite3",
        "jinyiwei.sqlite3",
        "junjichu_cases.sqlite3",
        "qintianjian.sqlite3",
        "report_artifacts.sqlite3",
        "runtime_bindings.sqlite3",
        "shiguan.sqlite3",
    )
    assert RUNTIME_DATA_REGISTRY["schemaVersion"] == ("chaotang.runtime-data-registry.v2")
    assert RUNTIME_DATA_REGISTRY["registryDigest"] == RUNTIME_DATA_REGISTRY_DIGEST
    assert RUNTIME_DATA_REGISTRY_DIGEST.startswith("sha256:")
    assert len(RUNTIME_DATA_REGISTRY_DIGEST) == 71


def test_readiness_accepts_exact_runtime_binding_schema(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    RuntimeBindingLedger(settings.data_dir / "runtime_bindings.sqlite3")

    assert run_readiness_preflight(settings).codes == ()


def test_readiness_rejects_runtime_binding_schema_without_append_only_triggers(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    with sqlite3.connect(settings.data_dir / "runtime_bindings.sqlite3") as connection:
        connection.execute("CREATE TABLE runtime_resource_bindings(binding_id TEXT)")

    assert run_readiness_preflight(settings).codes == ("storage_schema_unsupported",)


def test_readiness_accepts_explicit_local_credential_source(tmp_path: Path) -> None:
    assert run_readiness_preflight(_settings(tmp_path)).codes == ()


def test_default_local_credential_check_accepts_only_usable_statuses(monkeypatch) -> None:
    import app.readiness as readiness

    seen: list[tuple[Path, str]] = []

    class Store:
        def __init__(self, path: Path) -> None:
            seen.append((path, "init"))

        def status(self, server_id: str, _now: float):
            seen.append((Path(server_id), "status"))
            return readiness.CredentialStatus.VALID

    monkeypatch.setattr(readiness, "OAuthCredentialStore", Store)
    assert _local_credential_available() is True
    assert seen[-1] == (Path("westock"), "status")


def test_default_local_credential_check_fails_closed_on_store_error(monkeypatch) -> None:
    import app.readiness as readiness

    class Store:
        def __init__(self, _path: Path) -> None:
            pass

        def status(self, _server_id: str, _now: float):
            raise RuntimeError("secret material must not escape")

    monkeypatch.setattr(readiness, "OAuthCredentialStore", Store)
    assert _local_credential_available() is False


def test_readiness_rejects_report_artifact_directory_resolving_outside_volume(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    outside = tmp_path / "outside-artifacts"
    outside.mkdir()
    link = settings.data_dir / "report_artifacts"
    if os.name == "nt":
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link), str(outside)],
            check=True,
            capture_output=True,
        )
    else:
        link.symlink_to(outside, target_is_directory=True)

    assert run_readiness_preflight(settings).codes == ("storage_layout_invalid",)


def test_readiness_rejects_report_artifact_directory_symlink_inside_volume(
    tmp_path: Path,
) -> None:
    settings = _settings(tmp_path)
    target = settings.data_dir / "actual-artifacts"
    target.mkdir()
    (settings.data_dir / "report_artifacts").symlink_to(target, target_is_directory=True)

    assert run_readiness_preflight(settings).codes == ("storage_layout_invalid",)


@pytest.mark.parametrize("entry_name", ["unknown.sqlite3", "credentials"])
def test_readiness_rejects_unknown_or_sensitive_runtime_entry(
    tmp_path: Path,
    entry_name: str,
) -> None:
    settings = _settings(tmp_path)
    unexpected = settings.data_dir / entry_name
    if entry_name == "credentials":
        unexpected.mkdir()
        (unexpected / "must-not-be-read").write_text("secret", encoding="utf-8")
    else:
        unexpected.write_bytes(b"not a registered database")

    assert run_readiness_preflight(settings).codes == ("storage_layout_invalid",)


@pytest.mark.parametrize(
    "entry_name",
    ["decree_jobs.sqlite3-wal", "decree_jobs.sqlite3-shm", "report_artifacts"],
)
def test_readiness_rejects_orphan_runtime_sidecar_or_artifact_root(
    tmp_path: Path,
    entry_name: str,
) -> None:
    settings = _settings(tmp_path)
    orphan = settings.data_dir / entry_name
    if entry_name == "report_artifacts":
        orphan.mkdir()
    else:
        orphan.write_bytes(b"orphan")

    assert run_readiness_preflight(settings).codes == ("storage_layout_invalid",)


def test_readiness_rejects_registered_artifact_database_without_its_root(
    tmp_path: Path,
) -> None:
    from app.accounting_reports.storage import ArtifactStorage

    settings = _settings(tmp_path)
    ArtifactStorage(
        settings.data_dir / "report_artifacts",
        settings.data_dir / "report_artifacts.sqlite3",
    )
    (settings.data_dir / "report_artifacts").rmdir()

    assert run_readiness_preflight(settings).codes == ("storage_layout_invalid",)


def test_readiness_rejects_symlinked_sidecar_for_registered_database(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    RuntimeBindingLedger(settings.data_dir / "runtime_bindings.sqlite3")
    outside = tmp_path / "outside-wal"
    outside.write_bytes(b"not a sidecar")
    (settings.data_dir / "runtime_bindings.sqlite3-wal").symlink_to(outside)

    assert run_readiness_preflight(settings).codes == ("storage_layout_invalid",)
