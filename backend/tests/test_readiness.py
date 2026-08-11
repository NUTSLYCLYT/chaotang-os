from __future__ import annotations

import os
import sqlite3
import subprocess
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from app.readiness import (
    ReadinessResult,
    ReadinessSettings,
    _local_credential_available,
    run_readiness_preflight,
)


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
    client = TestClient(app)

    assert client.get("/health").status_code == 200
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"codes": ["ready"]}
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


def test_readyz_reports_stable_unready_and_exception_codes(monkeypatch) -> None:
    import app.main as main

    client = TestClient(app)
    monkeypatch.setattr(
        main,
        "run_readiness_preflight",
        lambda: ReadinessResult(("provider_credential_missing",)),
    )
    response = client.get("/readyz")
    assert response.status_code == 503
    assert response.json() == {"codes": ["provider_credential_missing"]}

    def fail_preflight() -> ReadinessResult:
        raise RuntimeError("sensitive implementation detail")

    monkeypatch.setattr(main, "run_readiness_preflight", fail_preflight)
    response = client.get("/readyz")
    assert response.status_code == 503
    assert response.json() == {"codes": ["readiness_check_failed"]}


def test_readiness_checks_existing_decree_job_schema(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    database = settings.data_dir / "decree_jobs.sqlite3"
    with closing(sqlite3.connect(database)) as connection:
        connection.execute("CREATE TABLE decree_jobs (job_id TEXT)")
        connection.commit()
    assert run_readiness_preflight(settings).codes == ("storage_schema_unsupported",)


def test_readiness_accepts_current_shiguan_v5_and_jinyiwei_v5(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    for filename, version in (("shiguan.sqlite3", 5), ("jinyiwei.sqlite3", 5)):
        with closing(sqlite3.connect(settings.data_dir / filename)) as connection:
            connection.execute(f"PRAGMA user_version = {version}")
            connection.commit()

    assert run_readiness_preflight(settings).codes == ()


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
