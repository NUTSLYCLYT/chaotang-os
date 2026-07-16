"""Fail-closed registries for legacy business-fact writers during convergence."""

from __future__ import annotations

import os
from types import MappingProxyType

_BLOCKED_WRITERS = MappingProxyType(
    {
        "legacy-court-flywheel-writers": {
            "code": "LEGACY_WRITE_BLOCKED",
            "entryId": "legacy-court-flywheel-writers",
            "canonicalTarget": "canonical-archive-outcome-knowledge-promotion",
        },
        "legacy-knowledge-api-writers": {
            "code": "LEGACY_WRITE_BLOCKED",
            "entryId": "legacy-knowledge-api-writers",
            "canonicalTarget": "canonical-archive-outcome-knowledge-promotion",
        },
    }
)

_LEGACY_WRITER_ALLOWLIST = MappingProxyType(
    {
        "pytest-flow-store": frozenset(
            {
                "flow_store.upsert_persisted_task",
                "flow_store.patch_persisted_task_result",
                "flow_store.save_decree_and_task",
                "flow_store.update_task_status",
                "flow_store.upsert_memorial",
                "flow_store.save_review_db",
                "flow_store.save_retrospective_db",
            }
        ),
        "pytest-chaotang-store": frozenset(
            {
                "chaotang_store.save_review",
                "chaotang_store.save_retrospective",
                "chaotang_store.write_review_files",
                "flow_store.save_review_db",
                "flow_store.save_retrospective_db",
            }
        ),
    }
)

_TEST_ONLY_WRITERS = frozenset({"pytest-flow-store", "pytest-chaotang-store"})


def blocked_write_detail(entry_id: str) -> dict[str, str]:
    """Return an immutable-policy copy; unknown legacy writers fail closed."""
    try:
        return dict(_BLOCKED_WRITERS[entry_id])
    except KeyError as exc:
        raise RuntimeError(f"unregistered legacy writer: {entry_id}") from exc


def _tripwire_enabled() -> bool:
    return os.environ.get("FENGQUN_LEGACY_WRITE_TRIPWIRE", "1").strip().lower() not in {
        "0",
        "false",
        "off",
    }


def _record_attempt(operation: str, writer_id: str, outcome: str) -> None:
    try:
        from src.migration_telemetry import record_legacy_writer_call

        record_legacy_writer_call(
            operation=operation,
            caller_id=writer_id or "missing",
            outcome=outcome,
        )
    except Exception:
        pass


def require_legacy_write(operation: str, writer_id: str | None) -> None:
    """Authorize one exact legacy mutation before it changes session/file state."""
    normalized = (writer_id or "").strip()
    if not _tripwire_enabled():
        _record_attempt(operation, normalized, "rollback_bypass")
        return

    allowed_operations = _LEGACY_WRITER_ALLOWLIST.get(normalized)
    test_writer_outside_pytest = normalized in _TEST_ONLY_WRITERS and os.environ.get("FENGQUN_TEST_DB_GUARD") != "1"
    if allowed_operations is None or test_writer_outside_pytest:
        _record_attempt(operation, normalized, "blocked_unregistered")
        raise RuntimeError(f"unregistered legacy writer: {normalized or '<missing>'}")
    if operation not in allowed_operations:
        _record_attempt(operation, normalized, "blocked_operation")
        raise RuntimeError(f"legacy writer {normalized} is not registered for operation: {operation}")
    _record_attempt(operation, normalized, "allowed")
