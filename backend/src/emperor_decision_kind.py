"""Frozen semantic classification for persisted emperor decisions."""

from __future__ import annotations


EMPEROR_DECISION_KINDS = frozenset(
    {"edict_confirm", "compat_dispatch", "final_verdict"}
)

_KIND_BY_ACTION = {
    "confirm_direct_task": "edict_confirm",
    "confirm_edict": "edict_confirm",
    "compat_court_dispatch": "compat_dispatch",
    "adopt": "final_verdict",
    "approve": "final_verdict",
    "archive": "final_verdict",
    "reject": "final_verdict",
    "request_evidence": "final_verdict",
    "recheck": "final_verdict",
    "followup": "final_verdict",
    "cancel": "final_verdict",
}


def emperor_decision_kind(action: str) -> str:
    """Return the frozen semantic kind for a known persisted action.

    Unknown spellings fail closed so a new action cannot silently enter the
    decision ledger without an explicit semantic classification.
    """

    try:
        return _KIND_BY_ACTION[action]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"unknown EmperorDecision action: {action!r}") from exc
