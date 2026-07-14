"""Canonical locations for mutable backend runtime state.

Versioned source and mutable state must not share a directory.  All new local
state lives below ``backend/var`` (or ``FENGQUN_RUNTIME_ROOT``).  The legacy
top-level directories are intentionally *not* used as a fallback: callers can
detect them and require an explicit migration before creating a fresh DB.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class RuntimePaths:
    root: Path
    data: Path
    events: Path
    memory: Path
    chat_sessions: Path
    swarm_sessions: Path
    traces: Path
    direct_cache: Path
    direct_feedback: Path
    runs: Path
    repairs: Path
    drafts: Path
    reports: Path
    cases: Path
    ab_tests: Path
    database: Path


def _configured_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default.resolve()


def resolve_runtime_paths() -> RuntimePaths:
    root = _configured_path("FENGQUN_RUNTIME_ROOT", BACKEND_ROOT / "var")
    data = root / "data"
    database = _configured_path("FENGQUN_DB_PATH", data / "fengqun.db")
    return RuntimePaths(
        root=root,
        data=data,
        events=root / "events",
        memory=root / "memory",
        chat_sessions=root / "sessions",
        swarm_sessions=root / "swarm_sessions",
        traces=root / "traces",
        direct_cache=root / "direct_cache",
        direct_feedback=root / "direct_feedback",
        runs=data / "default" / "runs",
        repairs=root / "repairs",
        drafts=root / "drafts",
        reports=root / "reports",
        cases=root / "cases",
        ab_tests=root / "ab_tests",
        database=database,
    )


RUNTIME_PATHS = resolve_runtime_paths()


def guard_legacy_database(*, destination: Path | None = None) -> None:
    """Refuse to create an empty new DB while a legacy DB still exists.

    This is deliberately a guard, not an automatic move.  Moving a live SQLite
    database (including WAL/SHM files) is an operator action and must be done
    while the service is stopped.
    """
    target = (destination or resolve_runtime_paths().database).resolve()
    legacy = (BACKEND_ROOT / "data" / "fengqun.db").resolve()
    if target == legacy or target.exists() or not legacy.exists():
        return
    raise RuntimeError(
        "Legacy runtime database detected at "
        f"{legacy}, but the configured database is {target}. "
        "Stop the service and run `python scripts/migrate_runtime_layout.py` "
        "before startup; no implicit fallback is performed."
    )
