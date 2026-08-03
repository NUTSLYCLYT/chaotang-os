"""Public interface for the six ministries (六部) agent package.

Exposes the immutable enterprise positioning data, the derived fixed roster
and routing guide, the shared irreversible-action constraint, the
department-specific prompt builder, and the single-ministry invocation helper.
"""

from __future__ import annotations

from app.agents.ministries.prompts import (
    MINISTRIES,
    MINISTRY_POSITIONINGS,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    MinistryPositioning,
    ministry_routing_guide,
    ministry_synthesis_system_prompt,
    ministry_system_prompt,
)


def __getattr__(name: str):
    """Load invocation helpers lazily to keep bureau prompt imports acyclic."""

    if name in {
        "BureauOpinion",
        "MinistryAgentInvocationError",
        "MinistryAgentInvocationResult",
        "MinistryOpinion",
        "invoke_ministry_agent",
        "invoke_ministry_agent_with_report",
    }:
        from app.agents.ministries.agent import (
            BureauOpinion,
            MinistryAgentInvocationError,
            MinistryAgentInvocationResult,
            MinistryOpinion,
            invoke_ministry_agent,
            invoke_ministry_agent_with_report,
        )

        return {
            "BureauOpinion": BureauOpinion,
            "MinistryAgentInvocationError": MinistryAgentInvocationError,
            "MinistryAgentInvocationResult": MinistryAgentInvocationResult,
            "MinistryOpinion": MinistryOpinion,
            "invoke_ministry_agent": invoke_ministry_agent,
            "invoke_ministry_agent_with_report": invoke_ministry_agent_with_report,
        }[name]
    raise AttributeError(name)


__all__ = [
    "MINISTRIES",
    "MINISTRY_POSITIONINGS",
    "NO_IRREVERSIBLE_ACTION_CONSTRAINT",
    "BureauOpinion",
    "MinistryAgentInvocationError",
    "MinistryAgentInvocationResult",
    "MinistryOpinion",
    "MinistryPositioning",
    "invoke_ministry_agent",
    "invoke_ministry_agent_with_report",
    "ministry_routing_guide",
    "ministry_synthesis_system_prompt",
    "ministry_system_prompt",
]
