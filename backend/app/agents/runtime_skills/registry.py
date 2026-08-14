import hashlib
import json
from collections.abc import Callable

from app.agents.bureaus import BUREAU_PROFILES
from app.agents.bureaus.capabilities import validate_legacy_capability_skill_bindings
from app.agents.runtime_skills.models import (
    AgentLayer,
    BureauReport,
    RuntimeService,
    RuntimeSkillDefinition,
)
from app.agents.runtime_skills.roles.bureaus.skill_registry import BUREAU_SKILL_SPECS
from app.agents.runtime_skills.roles.junjichu import JUNJICHU_SKILL
from app.agents.runtime_skills.roles.ministries import MINISTRY_SKILLS
from app.agents.runtime_skills.tool_registry import (
    bureau_tool_policy_for,
    validate_bureau_tool_registry,
)


class DownstreamSkillRegistryError(ValueError):
    """A stable fail-closed registry error."""


def runtime_skill_definition_digest(skill: RuntimeSkillDefinition) -> str:
    """Return the canonical content identity of one executable definition."""

    projection = {
        "skill_id": skill.skill_id,
        "version": skill.version,
        "agent_id": skill.agent_id,
        "layer": skill.layer.value,
        "purpose": skill.purpose,
        "responsibility_scope": skill.responsibility_scope,
        "data_requirements": skill.data_requirements,
        "analysis_procedure": skill.analysis_procedure,
        "required_findings": skill.required_findings,
        "allowed_services": sorted(service.value for service in skill.allowed_services),
        "forbidden_actions": skill.forbidden_actions,
        "report_type": f"{skill.report_type.__module__}.{skill.report_type.__qualname__}",
        "tool_policy": (
            skill.tool_policy.model_dump(mode="json")
            if skill.tool_policy is not None
            else None
        ),
    }
    canonical = json.dumps(
        projection, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    return f"sha256:{hashlib.sha256(canonical.encode('utf-8')).hexdigest()}"


_BUREAU_SPECS_BY_IDENTITY = {
    (spec.department, spec.bureau): spec for spec in BUREAU_SKILL_SPECS
}


def bureau_agent_id(department: str, bureau: str) -> str:
    """Return the stable agent ID for an authoritative compound identity."""

    try:
        return _BUREAU_SPECS_BY_IDENTITY[(department, bureau)].agent_id
    except KeyError as exc:
        raise DownstreamSkillRegistryError("unknown_bureau_identity") from exc


def _unique_map(
    skills: tuple[RuntimeSkillDefinition, ...],
    *,
    key: Callable[[RuntimeSkillDefinition], str],
    error_code: str,
) -> dict[str, RuntimeSkillDefinition]:
    result: dict[str, RuntimeSkillDefinition] = {}
    for skill in skills:
        item_key = key(skill)
        if item_key in result:
            raise DownstreamSkillRegistryError(error_code)
        result[item_key] = skill
    return result


class DownstreamSkillRegistry:
    def __init__(self, skills: tuple[RuntimeSkillDefinition, ...]) -> None:
        self.skills = skills
        self._by_skill_id = _unique_map(
            skills, key=lambda item: item.skill_id, error_code="duplicate_skill_id"
        )
        self._by_agent_id = _unique_map(
            skills, key=lambda item: item.agent_id, error_code="duplicate_agent_binding"
        )
        _validate_authoritative_inventory(skills)

    def get(self, skill_id: str) -> RuntimeSkillDefinition:
        try:
            return self._by_skill_id[skill_id]
        except KeyError as exc:
            raise DownstreamSkillRegistryError("skill_not_registered") from exc

    def get_by_agent(self, agent_id: str) -> RuntimeSkillDefinition:
        try:
            return self._by_agent_id[agent_id]
        except KeyError as exc:
            raise DownstreamSkillRegistryError("agent_skill_not_registered") from exc


def _build_bureau_skills() -> tuple[RuntimeSkillDefinition, ...]:
    authoritative = {(item.department, item.bureau) for item in BUREAU_PROFILES}
    declared = set(_BUREAU_SPECS_BY_IDENTITY)
    if declared != authoritative:
        raise DownstreamSkillRegistryError("bureau_registry_mismatch")
    return tuple(
        RuntimeSkillDefinition(
            skill_id=spec.skill_id,
            version="1.0.0",
            agent_id=spec.agent_id,
            layer=AgentLayer.BUREAU,
            purpose=f"以{profile.bureau}职责分析{'、'.join(profile.responsibilities)}。",
            responsibility_scope=profile.responsibilities,
            data_requirements=spec.method.data_requirements,
            analysis_procedure=spec.method.analysis_procedure,
            required_findings=spec.method.required_findings,
            allowed_services=frozenset(
                {
                    RuntimeService.REQUEST_MATERIALS,
                    RuntimeService.PARENT_TASK,
                    RuntimeService.APPROVED_DATA_SUMMARIES,
                    RuntimeService.CONTROLLED_CONTEXT,
                    RuntimeService.EVIDENCE_PROTOCOL,
                }
            ),
            forbidden_actions=spec.method.forbidden_actions,
            report_type=BureauReport,
            tool_policy=bureau_tool_policy_for(spec.agent_id),
        )
        for profile, spec in zip(BUREAU_PROFILES, BUREAU_SKILL_SPECS, strict=True)
    )


ALL_DOWNSTREAM_SKILLS = (
    JUNJICHU_SKILL,
    *MINISTRY_SKILLS,
    *_build_bureau_skills(),
)


_BUREAU_SERVICES = frozenset(
    {
        RuntimeService.REQUEST_MATERIALS,
        RuntimeService.PARENT_TASK,
        RuntimeService.APPROVED_DATA_SUMMARIES,
        RuntimeService.CONTROLLED_CONTEXT,
        RuntimeService.EVIDENCE_PROTOCOL,
    }
)


def _authoritative_bindings() -> dict[str, tuple[str, AgentLayer, frozenset[RuntimeService]]]:
    return {
        JUNJICHU_SKILL.agent_id: (
            JUNJICHU_SKILL.skill_id,
            AgentLayer.COUNCIL,
            frozenset({RuntimeService.MINISTRY_AGENTS}),
        ),
        **{
            skill.agent_id: (
                skill.skill_id,
                AgentLayer.MINISTRY,
                frozenset({RuntimeService.BUREAU_AGENTS}),
            )
            for skill in MINISTRY_SKILLS
        },
        **{
            bureau_agent_id(profile.department, profile.bureau): (
                _BUREAU_SPECS_BY_IDENTITY[(profile.department, profile.bureau)].skill_id,
                AgentLayer.BUREAU,
                _BUREAU_SERVICES,
            )
            for profile in BUREAU_PROFILES
        },
    }


def _validate_authoritative_inventory(
    skills: tuple[RuntimeSkillDefinition, ...],
) -> None:
    if len(skills) != 46:
        raise DownstreamSkillRegistryError("invalid_inventory_count")
    authoritative = _authoritative_bindings()
    registered = {skill.agent_id for skill in skills}
    unknown = registered - set(authoritative)
    if unknown:
        raise DownstreamSkillRegistryError("unknown_agent")
    if registered != set(authoritative):
        raise DownstreamSkillRegistryError("missing_agent")
    for skill in skills:
        expected_skill_id, expected_layer, expected_services = authoritative[skill.agent_id]
        if skill.skill_id != expected_skill_id:
            raise DownstreamSkillRegistryError("invalid_skill_binding")
        if skill.layer is not expected_layer:
            raise DownstreamSkillRegistryError("invalid_agent_layer")
        if skill.allowed_services != expected_services:
            raise DownstreamSkillRegistryError("invalid_service_policy")
        if expected_layer is AgentLayer.BUREAU:
            expected_policy = bureau_tool_policy_for(skill.agent_id)
            if skill.tool_policy != expected_policy:
                raise DownstreamSkillRegistryError("invalid_tool_policy_binding")
        elif skill.tool_policy is not None:
            raise DownstreamSkillRegistryError("upper_layer_tool_policy_forbidden")


def build_default_downstream_skill_registry() -> DownstreamSkillRegistry:
    validate_bureau_tool_registry()
    registry = DownstreamSkillRegistry(ALL_DOWNSTREAM_SKILLS)
    validate_legacy_capability_skill_bindings(registry)
    counts = {layer: 0 for layer in AgentLayer}
    for skill in registry.skills:
        counts[skill.layer] += 1
    if counts != {
        AgentLayer.BUREAU: 39,
        AgentLayer.MINISTRY: 6,
        AgentLayer.COUNCIL: 1,
    }:
        raise DownstreamSkillRegistryError("invalid_layer_counts")

    authoritative_agents = {
        bureau_agent_id(profile.department, profile.bureau) for profile in BUREAU_PROFILES
    }
    registered_agents = {
        skill.agent_id for skill in registry.skills if skill.layer is AgentLayer.BUREAU
    }
    if registered_agents != authoritative_agents:
        raise DownstreamSkillRegistryError("bureau_registry_mismatch")
    return registry
