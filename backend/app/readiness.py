"""Offline storage and configuration readiness preflight."""

from __future__ import annotations

import os
import sqlite3
import stat
import time
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.jinyiwei.mcp.oauth import CredentialStatus, OAuthCredentialStore
from app.jinyiwei.mcp.registry import load_default_registry
from app.jinyiwei.mcp.runtime import default_credential_store_path
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config
from app.operations.runtime_data_registry import (
    RUNTIME_DATA_ENTRIES,
    validate_registered_schema,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
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


def _path_has_symlink_component(path: Path) -> bool:
    absolute = path.absolute()
    for component in reversed((absolute, *absolute.parents)):
        try:
            if stat.S_ISLNK(component.lstat().st_mode):
                return True
        except OSError:
            return True
    return False


def _read_only(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)


def _registered_schema_supported(data_dir: Path) -> bool:
    for entry in RUNTIME_DATA_ENTRIES:
        path = data_dir / entry.relative_path
        try:
            status = path.lstat()
        except FileNotFoundError:
            continue
        except OSError:
            return False
        if not stat.S_ISREG(status.st_mode) or status.st_nlink != 1:
            return False
        if not validate_registered_schema(path, entry):
            return False
    return True


def _nonblank(environ: Mapping[str, str], key: str) -> bool:
    value = environ.get(key)
    return isinstance(value, str) and bool(value.strip())


def _report_directory_is_contained(data_dir: Path) -> bool:
    artifact_dir = data_dir / "report_artifacts"
    try:
        status = artifact_dir.lstat()
    except FileNotFoundError:
        return True
    except OSError:
        return False
    if not stat.S_ISDIR(status.st_mode) or stat.S_ISLNK(status.st_mode):
        return False
    try:
        artifact_dir.resolve(strict=True).relative_to(data_dir.resolve(strict=True))
    except (OSError, ValueError):
        return False
    return artifact_dir.is_dir()


def _runtime_layout_is_closed(data_dir: Path) -> bool:
    try:
        present = {entry.name for entry in os.scandir(data_dir)}
    except OSError:
        return False
    registered = {entry.relative_path for entry in RUNTIME_DATA_ENTRIES}
    allowed = set(registered)
    allowed.update(
        f"{database}{suffix}"
        for database in registered & present
        for suffix in ("-wal", "-shm")
    )
    if "report_artifacts.sqlite3" in present:
        allowed.add("report_artifacts")
    if present - allowed:
        return False
    if ("report_artifacts.sqlite3" in present) != ("report_artifacts" in present):
        return False
    for name in present:
        if not name.endswith(("-wal", "-shm")):
            continue
        try:
            status = (data_dir / name).lstat()
        except OSError:
            return False
        if not stat.S_ISREG(status.st_mode) or status.st_nlink != 1:
            return False
    return True


def run_readiness_preflight(
    settings: ReadinessSettings | None = None,
) -> ReadinessResult:
    current = settings or ReadinessSettings()
    codes: list[str] = []

    def fail(code: str) -> None:
        if code not in codes:
            codes.append(code)

    try:
        data_status = current.data_dir.lstat()
    except OSError:
        data_status = None
    if (
        data_status is None
        or not stat.S_ISDIR(data_status.st_mode)
        or stat.S_ISLNK(data_status.st_mode)
        or _path_has_symlink_component(current.data_dir)
    ):
        fail("data_volume_missing")
    else:
        try:
            _probe(current.data_dir)
        except OSError:
            fail("data_volume_not_writable")
        else:
            layout_closed = _runtime_layout_is_closed(current.data_dir)
            report_contained = _report_directory_is_contained(current.data_dir)
            if not layout_closed or not report_contained:
                fail("storage_layout_invalid")
            elif not _registered_schema_supported(current.data_dir):
                fail("storage_schema_unsupported")

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
        current.environ.get("JINYIWEI_EXTERNAL_NETWORK_ENABLED", "").strip().casefold() in _TRUTHY
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
        getattr(item, "server_id", None) == "westock" and getattr(item, "enabled", False) is True
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
