from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

from app.agents.runtime_skills.tool_models import ToolDescriptor, ToolHealth, ToolName


def apply_tool_health(
    descriptors: Mapping[ToolName, ToolDescriptor],
    health: Mapping[ToolName, ToolHealth],
) -> Mapping[ToolName, ToolDescriptor]:
    """Return an immutable catalog with system-observed health applied."""

    if not set(health) <= set(descriptors):
        raise ValueError("tool_health_not_registered")
    return MappingProxyType(
        {
            name: descriptor.model_copy(
                update={"health": health.get(name, descriptor.health)}
            )
            for name, descriptor in descriptors.items()
        }
    )
