"""Read-only CapabilityRegistry projection for existing Chaotang capabilities."""

from .projection import (
    build_capability_registry_projection,
    get_capability_registry_item,
)

__all__ = [
    "build_capability_registry_projection",
    "get_capability_registry_item",
]
