"""Offline storage and configuration readiness preflight."""

from __future__ import annotations

import os
import sqlite3
import time
import uuid
from collections.abc import Callable, Mapping
from contextlib import closing
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.jinyiwei.mcp.oauth import CredentialStatus, OAuthCredentialStore
from app.jinyiwei.mcp.registry import load_default_registry
from app.jinyiwei.mcp.runtime import default_credential_store_path
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_VERSIONED_DATABASES = {"shiguan.sqlite3": 5, "jinyiwei.sqlite3": 5}
_TABLE_SCHEMAS: dict[str, dict[str, frozenset[str]]] = {
    "decree_jobs.sqlite3": {
        "decree_jobs": frozenset(
            {
                "job_id",
                "owner_user_id",
                "idempotency_key",
                "request_hash",
                "draft_fingerprint",
                "decree_text",
                "approved_route_json",
                "state",
                "attempt_count",
                "provider_request_count",
                "cancel_requested",
                "provider_request_limit",
                "authority_committed",
                "acceptance_committed",
                "result_json",
                "reply_id",
                "error_code",
                "deadline_at",
                "retry_at",
                "lease_owner",
                "lease_expires_at",
                "created_at",
                "updated_at",
                "error_stage",
                "error_category",
            }
        ),
        "decree_job_idempotency_keys": frozenset(
            {
                "owner_user_id",
                "idempotency_key",
                "request_hash",
                "job_id",
            }
        ),
    },
    "junjichu_cases.sqlite3": {
        "junjichu_cases": frozenset(
            {
                "id",
                "owner_user_id",
                "decree_text",
                "departments_json",
                "status",
                "processing_path_json",
                "completed_ministry_opinions_json",
                "council_verdict",
                "reply_id",
                "failure_reason",
                "failure_stage",
                "failure_code",
                "created_at",
                "updated_at",
            }
        )
    },
    "qintianjian.sqlite3": {
        "forecasts": frozenset(
            {
                "id",
                "owner_user_id",
                "idempotency_key",
                "request_hash",
                "state",
                "payload_json",
                "created_at",
            }
        ),
        "reviews": frozenset(
            {
                "id",
                "forecast_id",
                "owner_user_id",
                "trigger_id",
                "decision",
                "observation",
                "judgment_invalidated",
                "created_at",
            }
        ),
    },
    "report_artifacts.sqlite3": {
        "report_artifacts": frozenset(
            {
                "artifact_id",
                "owner_user_id",
                "run_id",
                "reply_id",
                "report_type",
                "display_name",
                "period_start",
                "period_end",
                "source_hashes_json",
                "file_sha256",
                "state",
                "created_at",
                "published_at",
            }
        )
    },
}
_TRUTHY = frozenset({"1", "true", "yes", "on"})


def _local_credential_available() -> bool:
    """Read only the stable local OAuth status and fail closed on any error."""

    try:
        status = OAuthCredentialStore(default_credential_store_path()).status(
            "westock", time.time()
        )
    except Exception:
        return False
    return status in {CredentialStatus.VALID, CredentialStatus.EXPIRING_SOON}


@dataclass(frozen=True)
class ReadinessSettings:
    data_dir: Path = _BACKEND_ROOT / "data"
    providers_config_path: Path = _BACKEND_ROOT / "config" / "providers.yaml"
    environ: Mapping[str, str] = field(default_factory=lambda: os.environ)
    mcp_registry_loader: Callable[[], Any] = load_default_registry
    local_credential_available: Callable[[], bool] = _local_credential_available


@dataclass(frozen=True)
class ReadinessResult:
    codes: tuple[str, ...]

    @property
    def ready(self) -> bool:
        return not self.codes


def _probe(directory: Path) -> None:
    path = directory / f".readiness-{uuid.uuid4().hex}"
    try:
        with path.open("xb") as stream:
            stream.write(b"ready")
            stream.flush()
            os.fsync(stream.fileno())
    finally:
        path.unlink(missing_ok=True)


def _read_only(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)


def _version_supported(path: Path, expected: int) -> bool:
    if not path.is_file():
        return not path.exists()
    try:
        with closing(_read_only(path)) as connection:
            row = connection.execute("PRAGMA user_version").fetchone()
        return row is not None and row[0] == expected
    except (OSError, sqlite3.Error):
        return False


def _tables_supported(path: Path, tables: Mapping[str, frozenset[str]]) -> bool:
    if not path.is_file():
        return not path.exists()
    try:
        with closing(_read_only(path)) as connection:
            for table, required in tables.items():
                rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
                if not required.issubset({str(row[1]) for row in rows}):
                    return False
        return True
    except (OSError, sqlite3.Error):
        return False


def _nonblank(environ: Mapping[str, str], key: str) -> bool:
    value = environ.get(key)
    return isinstance(value, str) and bool(value.strip())


def _report_directory_is_contained(data_dir: Path) -> bool:
    artifact_dir = data_dir / "report_artifacts"
    if not artifact_dir.exists():
        return True
    try:
        artifact_dir.resolve(strict=True).relative_to(data_dir.resolve(strict=True))
    except (OSError, ValueError):
        return False
    return artifact_dir.is_dir()


def run_readiness_preflight(
    settings: ReadinessSettings | None = None,
) -> ReadinessResult:
    current = settings or ReadinessSettings()
    codes: list[str] = []

    def fail(code: str) -> None:
        if code not in codes:
            codes.append(code)

    if not current.data_dir.is_dir():
        fail("data_volume_missing")
    else:
        try:
            _probe(current.data_dir)
        except OSError:
            fail("data_volume_not_writable")
        else:
            for filename, version in _VERSIONED_DATABASES.items():
                if not _version_supported(current.data_dir / filename, version):
                    fail("storage_schema_unsupported")
            for filename, tables in _TABLE_SCHEMAS.items():
                if not _tables_supported(current.data_dir / filename, tables):
                    fail("storage_schema_unsupported")
            if not _report_directory_is_contained(current.data_dir):
                fail("storage_layout_invalid")

    try:
        provider = load_deepseek_provider_config(current.providers_config_path)
    except Exception:
        fail("provider_config_invalid")
    else:
        if not _nonblank(current.environ, provider.api_key_env):
            fail("provider_credential_missing")

    try:
        registry = current.mcp_registry_loader()
    except Exception:
        registry = None
        fail("mcp_registry_invalid")
    source = current.environ.get("JINYIWEI_MCP_CREDENTIAL_SOURCE", "env")
    if source not in {"env", "local"}:
        fail("credential_source_invalid")
    external = (
        current.environ.get("JINYIWEI_EXTERNAL_NETWORK_ENABLED", "")
        .strip()
        .casefold()
        in _TRUTHY
    )
    server_enabled = registry is not None and any(
        getattr(item, "server_id", None) == "westock"
        and getattr(item, "enabled", False) is True
        and getattr(
            getattr(item, "access_policy", None),
            "value",
            getattr(item, "access_policy", None),
        )
        != "ANONYMOUS_PUBLIC"
        for item in getattr(registry, "servers", ())
    )
    tool_enabled = registry is not None and any(
        getattr(item, "server_id", None) == "westock"
        and getattr(item, "enabled", False) is True
        for item in getattr(registry, "approvals", ())
    )
    if external and server_enabled and tool_enabled:
        available = (
            _nonblank(current.environ, "WESTOCK_MCP_CREDENTIAL")
            if source == "env"
            else current.local_credential_available()
        )
        if not available:
            fail("mcp_credential_missing")
    return ReadinessResult(tuple(codes))
