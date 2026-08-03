"""Static capability packages bound to the existing bureau registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.agents.bureaus.profiles import bureau_profile_for

if TYPE_CHECKING:
    from app.agents.runtime_skills.registry import DownstreamSkillRegistry


@dataclass(frozen=True, slots=True)
class CapabilityProfile:
    """A bounded, static capability package for one existing bureau."""

    capability_id: str
    department: str
    bureau: str
    source_label: str
    purpose: str
    deliverables: tuple[str, ...]
    guardrails: tuple[str, ...]


_SOURCE_LABEL = "dev swarm migration"
_IRREVERSIBLE_TOPIC_GUARDRAIL = (
    "Quotes, contracts, payments, signing, publication, deployment, recruitment, "
    "and external commitments are advice or drafts only and remain pending approval."
)


def _capability(
    capability_id: str,
    department: str,
    bureau: str,
    purpose: str,
    deliverable: str,
    *guardrails: str,
) -> CapabilityProfile:
    return CapabilityProfile(
        capability_id=capability_id,
        department=department,
        bureau=bureau,
        source_label=_SOURCE_LABEL,
        purpose=purpose,
        deliverables=(deliverable,),
        guardrails=(*guardrails, _IRREVERSIBLE_TOPIC_GUARDRAIL),
    )


CAPABILITY_PROFILES: tuple[CapabilityProfile, ...] = (
    _capability(
        "lead_acquisition",
        "兵部",
        "线索司",
        "Assess lead-fit signals.",
        "Lead qualification brief.",
    ),
    _capability(
        "commercial_opportunity",
        "兵部",
        "报价司",
        "Assess commercial opportunity options.",
        "Opportunity recommendation draft.",
    ),
    _capability(
        "financial_analysis",
        "户部",
        "会计司",
        "Analyze financial assumptions.",
        "Financial analysis memo.",
    ),
    _capability(
        "quotation_analysis",
        "户部",
        "盐铁司",
        "Review quotation assumptions.",
        "Quotation analysis draft.",
    ),
    _capability(
        "contract_review",
        "刑部",
        "合同司",
        "Review contract terms for issues.",
        "Contract review notes.",
    ),
    _capability(
        "legal_compliance",
        "刑部",
        "合规稽查司",
        "Identify legal compliance considerations.",
        "Compliance review memo.",
    ),
    _capability(
        "product_planning",
        "工部",
        "产研司",
        "Frame product planning options.",
        "Product planning brief.",
    ),
    _capability(
        "trend_simulation",
        "工部",
        "产研司",
        "Explore scenario and risk alternatives.",
        "Scenario and risk simulation notes.",
        "Scenario analysis is not a factual prediction and must state its assumptions.",
    ),
    _capability(
        "sourcing", "工部", "物料司", "Assess sourcing options.", "Sourcing options brief."
    ),
    _capability(
        "pack_rd",
        "工部",
        "技术司",
        "Advise on battery pack research and development.",
        "Pack R&D advisory.",
    ),
    _capability(
        "hardware_design",
        "工部",
        "技术司",
        "Advise on hardware design trade-offs.",
        "Hardware design review.",
    ),
    _capability(
        "sdlc_advisory",
        "工部",
        "技术司",
        "Advise on software delivery lifecycle choices.",
        "SDLC advisory memo.",
    ),
    _capability(
        "code_review_advisory",
        "工部",
        "技术司",
        "Advise on code review findings.",
        "Code review advisory.",
    ),
    _capability(
        "battery_stage_gate",
        "工部",
        "质量司",
        "Assess battery stage-gate readiness.",
        "Stage-gate readiness assessment.",
    ),
    _capability(
        "process_manufacturing",
        "工部",
        "现场司",
        "Assess manufacturing process options.",
        "Manufacturing process notes.",
    ),
    _capability(
        "delivery_aftercare",
        "工部",
        "承诺司",
        "Advise on delivery and aftercare planning.",
        "Delivery aftercare plan draft.",
    ),
    _capability(
        "brand_strategy",
        "礼部",
        "品牌司",
        "Advise on brand strategy options.",
        "Brand strategy brief.",
    ),
    _capability(
        "content_quality",
        "礼部",
        "内容司",
        "Review content quality and risks.",
        "Content quality review.",
    ),
    _capability(
        "social_content_operations",
        "礼部",
        "客户沟通司",
        "Advise on social content operations.",
        "Social content operations draft.",
    ),
    _capability(
        "persona_screening",
        "吏部",
        "招聘司",
        "Assist with persona screening criteria.",
        "Screening criteria advisory.",
    ),
)


def _validate_capability_profiles(profiles: tuple[CapabilityProfile, ...]) -> None:
    capability_ids: set[str] = set()
    identities: set[tuple[str, str, str]] = set()
    for profile in profiles:
        if not isinstance(profile, CapabilityProfile):
            raise ValueError("Invalid capability profile.")
        if any(
            not isinstance(value, str) or not value.strip()
            for value in (
                profile.capability_id,
                profile.department,
                profile.bureau,
                profile.source_label,
                profile.purpose,
            )
        ):
            raise ValueError("Capability profile fields must be non-empty.")
        if (
            not profile.deliverables
            or not profile.guardrails
            or any(not isinstance(item, str) or not item.strip() for item in profile.deliverables)
            or any(not isinstance(item, str) or not item.strip() for item in profile.guardrails)
        ):
            raise ValueError("Capability profile deliverables and guardrails must be non-empty.")
        if profile.capability_id in capability_ids:
            raise ValueError("Capability IDs must be unique.")
        identity = (profile.department, profile.bureau, profile.capability_id)
        if identity in identities:
            raise ValueError("Capability profile identities must be unique.")
        try:
            bureau_profile_for(profile.department, profile.bureau)
        except ValueError as exc:
            raise ValueError("Capability profile references an unknown bureau.") from exc
        capability_ids.add(profile.capability_id)
        identities.add(identity)


_validate_capability_profiles(CAPABILITY_PROFILES)

_PROFILES_BY_ID = {profile.capability_id: profile for profile in CAPABILITY_PROFILES}


def capability_profiles_for(department: str, bureau: str) -> tuple[CapabilityProfile, ...]:
    """Return static packages for an existing bureau, preserving registry order."""

    bureau_profile_for(department, bureau)
    return tuple(
        profile
        for profile in CAPABILITY_PROFILES
        if profile.department == department and profile.bureau == bureau
    )


def capability_profile_for(capability_id: str) -> CapabilityProfile:
    """Resolve one static package by its globally unique identifier."""

    try:
        return _PROFILES_BY_ID[capability_id]
    except KeyError as exc:
        raise ValueError("Unknown capability ID.") from exc


def skill_id_for_legacy_capability(capability_id: str) -> str:
    """Map one legacy capability ID to its owning bureau's Runtime Skill."""

    profile = capability_profile_for(capability_id)
    from app.agents.runtime_skills import (
        build_default_downstream_skill_registry,
        bureau_agent_id,
    )

    registry = build_default_downstream_skill_registry()
    return registry.get_by_agent(bureau_agent_id(profile.department, profile.bureau)).skill_id


def validate_legacy_capability_skill_bindings(
    registry: DownstreamSkillRegistry,
    *,
    profiles: tuple[CapabilityProfile, ...] = CAPABILITY_PROFILES,
) -> None:
    """Fail closed unless every legacy profile resolves to its owning bureau Skill."""

    from app.agents.runtime_skills.models import AgentLayer
    from app.agents.runtime_skills.registry import bureau_agent_id

    for profile in profiles:
        expected_agent_id = bureau_agent_id(profile.department, profile.bureau)
        try:
            skill = registry.get_by_agent(expected_agent_id)
        except ValueError as exc:
            raise ValueError("legacy_capability_skill_not_registered") from exc
        if skill.layer is not AgentLayer.BUREAU:
            raise ValueError("legacy_capability_non_bureau_skill")
        if skill.agent_id != expected_agent_id:
            raise ValueError("legacy_capability_cross_bureau_binding")


def capability_analysis_modes_for_skill(skill_id: str) -> tuple[CapabilityProfile, ...]:
    """Return legacy metadata as optional modes of one authoritative bureau Skill."""

    # Resolve through the authoritative registry so unknown and non-bureau IDs fail closed.
    # The local import avoids a registry -> bureau package initialization cycle.
    from app.agents.runtime_skills import AgentLayer, build_default_downstream_skill_registry

    registry = build_default_downstream_skill_registry()
    try:
        skill = registry.get(skill_id)
    except ValueError as exc:
        raise ValueError("Unknown Runtime Skill ID.") from exc
    if skill.layer is not AgentLayer.BUREAU:
        raise ValueError("Unknown Runtime Skill ID.")
    from app.agents.runtime_skills import bureau_agent_id

    return tuple(
        profile
        for profile in CAPABILITY_PROFILES
        if bureau_agent_id(profile.department, profile.bureau) == skill.agent_id
    )
