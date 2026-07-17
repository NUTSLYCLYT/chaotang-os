"""Public interface for the six ministries (六部) agent package.

Exposes the immutable enterprise positioning data, the derived fixed roster
and routing guide, the shared irreversible-action constraint, the
department-specific prompt builder, and the single-ministry invocation helper.
"""

from __future__ import annotations

from app.agents.ministries.agent import MinistryAgentInvocationError, invoke_ministry_agent
from app.agents.ministries.prompts import (
    MINISTRIES,
    MINISTRY_POSITIONINGS,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    MinistryPositioning,
    ministry_routing_guide,
    ministry_system_prompt,
)

__all__ = [
    "MINISTRIES",
    "MINISTRY_POSITIONINGS",
    "NO_IRREVERSIBLE_ACTION_CONSTRAINT",
    "MinistryAgentInvocationError",
    "MinistryPositioning",
    "invoke_ministry_agent",
    "ministry_routing_guide",
    "ministry_system_prompt",
]
