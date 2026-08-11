from __future__ import annotations

from collections.abc import Mapping

from app.agents.runtime_skills.tool_models import (
    BureauToolPolicy,
    DiscoveredTool,
    ToolDescriptor,
    ToolDiscoveryContext,
    ToolHealth,
    ToolName,
)


def discover_tools(
    context: ToolDiscoveryContext,
    descriptors: Mapping[ToolName, ToolDescriptor],
    policy: BureauToolPolicy,
    *,
    authoritative_skill_id: str,
    authoritative_skill_version: str,
) -> tuple[DiscoveredTool, ...]:
    if (
        context.agent_id != policy.agent_id
        or context.skill_id != authoritative_skill_id
        or context.skill_version != authoritative_skill_version
        or context.policy_id != policy.policy_id
        or context.policy_version != policy.version
    ):
        return ()

    return tuple(
        DiscoveredTool.from_descriptor(descriptor)
        for descriptor in sorted(descriptors.values(), key=lambda item: item.descriptor_id)
        if descriptor.tool_name in policy.allowed_tools
        and descriptor.required_scopes <= context.decree_scopes
        and descriptor.data_domains <= context.data_domains
        and descriptor.data_domains <= policy.allowed_data_domains
        and descriptor.side_effect in context.allowed_side_effects
        and descriptor.health is not ToolHealth.UNAVAILABLE
    )
