"""Runtime gate for the R0-W05 contract evidence rework capability."""

from __future__ import annotations

import os

W05_CONTRACT_REWORK_ENV = "FENGQUN_W05_CONTRACT_REWORK"
_ENABLED_VALUES = {"1", "true", "yes", "on"}


def w05_contract_rework_active() -> bool:
    """Return the live switch state; absence is deliberately fail-closed."""
    return (
        os.environ.get(W05_CONTRACT_REWORK_ENV, "false").strip().lower()
        in _ENABLED_VALUES
    )


def require_w05_contract_rework() -> None:
    if not w05_contract_rework_active():
        raise ValueError("W05 合同补证重审能力未启用")
