from __future__ import annotations

from app.agents.runtime_skills.tool_models import ToolFailureCode


class AccountingToolChainError(RuntimeError):
    """Sanitized terminal failure for the accounting artifact's required tools."""

    failure_stage = "bureau_tool"

    def __init__(self, code: ToolFailureCode) -> None:
        super().__init__(code.value)
        self.code = code.value
