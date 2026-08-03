"""Public interface for the data-driven bureau-level agent package."""

from __future__ import annotations

from app.agents.bureaus.agent import (
    BureauAgentInvocationError,
    BureauAgentInvocationResult,
    invoke_bureau_agent,
    invoke_bureau_agent_with_report,
)
from app.agents.bureaus.capabilities import (
    CAPABILITY_PROFILES,
    CapabilityProfile,
    capability_profile_for,
    capability_profiles_for,
)
from app.agents.bureaus.profiles import (
    BUREAU_PROFILES,
    BureauProfile,
    bureau_profile_for,
    bureau_profiles_for,
)
from app.agents.bureaus.prompts import bureau_system_prompt

__all__ = [
    "BUREAU_PROFILES",
    "CAPABILITY_PROFILES",
    "BureauAgentInvocationError",
    "BureauAgentInvocationResult",
    "BureauProfile",
    "CapabilityProfile",
    "bureau_profile_for",
    "bureau_profiles_for",
    "bureau_system_prompt",
    "capability_profile_for",
    "capability_profiles_for",
    "invoke_bureau_agent",
    "invoke_bureau_agent_with_report",
]
