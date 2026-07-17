"""Public interface for the six ministries (六部) agent package.

Exposes the single source of truth for the fixed six-ministries roster
(``MINISTRIES``), the shared irreversible-action constraint constant, the
department-specific prompt builder, and the single-ministry invocation
helper shared by the Chancellor graph's single-department branch (module 1)
and the 军机处/junjichu multi-department council orchestration
(module 2).
"""

from __future__ import annotations

from app.agents.ministries.agent import MinistryAgentInvocationError, invoke_ministry_agent
from app.agents.ministries.prompts import (
    MINISTRIES,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    ministry_system_prompt,
)

__all__ = [
    "MINISTRIES",
    "NO_IRREVERSIBLE_ACTION_CONSTRAINT",
    "MinistryAgentInvocationError",
    "invoke_ministry_agent",
    "ministry_system_prompt",
]
