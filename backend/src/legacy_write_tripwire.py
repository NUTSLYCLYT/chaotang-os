"""Fail-closed registry for legacy business-fact writers during K0C convergence."""
from __future__ import annotations

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


def blocked_write_detail(entry_id: str) -> dict[str, str]:
    """Return an immutable-policy copy; unknown legacy writers fail closed."""
    try:
        return dict(_BLOCKED_WRITERS[entry_id])
    except KeyError as exc:
        raise RuntimeError(f"unregistered legacy writer: {entry_id}") from exc
