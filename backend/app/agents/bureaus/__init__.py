"""Public interface for the data-driven bureau-level agent package."""

from __future__ import annotations

from app.agents.bureaus.agent import BureauAgentInvocationError, invoke_bureau_agent
from app.agents.bureaus.profiles import (
    BUREAU_PROFILES,
    BureauProfile,
    bureau_profile_for,
    bureau_profiles_for,
)
from app.agents.bureaus.prompts import bureau_system_prompt

__all__ = [
    "BUREAU_PROFILES",
    "BureauAgentInvocationError",
    "BureauProfile",
    "bureau_profile_for",
    "bureau_profiles_for",
    "bureau_system_prompt",
    "invoke_bureau_agent",
]
