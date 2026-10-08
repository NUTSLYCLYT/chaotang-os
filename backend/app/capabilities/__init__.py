"""Read-only CapabilityRegistry projection for existing Chaotang capabilities."""

from .projection import (
    build_capability_registry_projection,
    get_capability_registry_item,
    get_crm_provider_passport,
)

__all__ = [
    "build_capability_registry_projection",
    "get_crm_provider_passport",
    "get_capability_registry_item",
]
