from collections.abc import Callable

from app.agents.bureaus import BUREAU_PROFILES
from app.agents.bureaus.capabilities import validate_legacy_capability_skill_bindings
from app.agents.runtime_skills.models import (
    AgentLayer,
    BureauReport,
    RuntimeService,
    RuntimeSkillDefinition,
)
from app.agents.runtime_skills.roles.bureaus.bingbu import SKILL_IDS as BINGBU_IDS
from app.agents.runtime_skills.roles.bureaus.gongbu import SKILL_IDS as GONGBU_IDS
from app.agents.runtime_skills.roles.bureaus.hubu import SKILL_IDS as HUBU_IDS
from app.agents.runtime_skills.roles.bureaus.libu import SKILL_IDS as LIBU_IDS
from app.agents.runtime_skills.roles.bureaus.libu_rites import (
    SKILL_IDS as LIBU_RITES_IDS,
)
from app.agents.runtime_skills.roles.bureaus.professional import BUREAU_METHODS
from app.agents.runtime_skills.roles.bureaus.xingbu import SKILL_IDS as XINGBU_IDS
from app.agents.runtime_skills.roles.junjichu import JUNJICHU_SKILL
from app.agents.runtime_skills.roles.ministries import MINISTRY_SKILLS


class DownstreamSkillRegistryError(ValueError):
    """A stable fail-closed registry error."""


_DEPARTMENT_SLUGS = {
    "吏部": "libu",
    "户部": "hubu",
    "礼部": "libu-rites",
    "兵部": "bingbu",
    "刑部": "xingbu",
    "工部": "gongbu",
}
_BUREAU_SLUGS = {
    "任免司": "appointments",
    "招聘司": "recruitment",
    "劳关司": "labor-relations",
    "薪酬司": "compensation",
    "制度司": "policy",
    "协同司": "coordination",
    "预算司": "budget",
    "出纳司": "treasury",
    "盐铁司": "pricing",
    "融资司": "financing",
    "审计司": "audit",
    "会计司": "accounting",
    "投资司": "investment",
    "品牌司": "brand",
    "公关司": "public-relations",
    "客户沟通司": "customer-communications",
    "内容司": "content",
    "政企司": "government-enterprise",
    "体验司": "experience",
    "报价司": "sales-opportunity",
    "线索司": "leads",
    "渠道司": "channels",
    "客户司": "customers",
    "竞情司": "competition",
    "增长司": "growth",
    "合同司": "contracts",
    "合规稽查司": "compliance",
    "风控司": "risk-control",
    "缺证核查司": "evidence-integrity",
    "争议处置司": "disputes",
    "知识产权司": "intellectual-property",
    "产研司": "product",
    "技术司": "technology",
    "物料司": "supply",
    "进度司": "schedule",
    "质量司": "quality",
    "现场司": "field",
    "承诺司": "commitments",
}
_SKILL_IDS_BY_DEPARTMENT = {
    "吏部": LIBU_IDS,
    "户部": HUBU_IDS,
    "礼部": LIBU_RITES_IDS,
    "兵部": BINGBU_IDS,
    "刑部": XINGBU_IDS,
    "工部": GONGBU_IDS,
}


def bureau_agent_id(department: str, bureau: str) -> str:
    """Return the stable agent ID for an authoritative compound identity."""

    try:
        return f"{_DEPARTMENT_SLUGS[department]}-{_BUREAU_SLUGS[bureau]}"
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
    declared = {
        (department, bureau)
        for department, skill_ids in _SKILL_IDS_BY_DEPARTMENT.items()
        for bureau in skill_ids
    }
    if declared != authoritative:
        raise DownstreamSkillRegistryError("bureau_registry_mismatch")
    if set(BUREAU_METHODS) != authoritative:
        raise DownstreamSkillRegistryError("bureau_method_registry_mismatch")

    return tuple(
        RuntimeSkillDefinition(
            skill_id=_SKILL_IDS_BY_DEPARTMENT[profile.department][profile.bureau],
            version="1.0.0",
            agent_id=bureau_agent_id(profile.department, profile.bureau),
            layer=AgentLayer.BUREAU,
            purpose=f"以{profile.bureau}职责分析{'、'.join(profile.responsibilities)}。",
            responsibility_scope=profile.responsibilities,
            data_requirements=BUREAU_METHODS[
                (profile.department, profile.bureau)
            ].data_requirements,
            analysis_procedure=BUREAU_METHODS[
                (profile.department, profile.bureau)
            ].analysis_procedure,
            required_findings=BUREAU_METHODS[
                (profile.department, profile.bureau)
            ].required_findings,
            allowed_services=frozenset(
                {
                    RuntimeService.REQUEST_MATERIALS,
                    RuntimeService.PARENT_TASK,
                    RuntimeService.APPROVED_DATA_SUMMARIES,
                    RuntimeService.CONTROLLED_CONTEXT,
                    RuntimeService.EVIDENCE_PROTOCOL,
                }
            ),
            forbidden_actions=BUREAU_METHODS[
                (profile.department, profile.bureau)
            ].forbidden_actions,
            report_type=BureauReport,
        )
        for profile in BUREAU_PROFILES
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
                _SKILL_IDS_BY_DEPARTMENT[profile.department][profile.bureau],
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


def build_default_downstream_skill_registry() -> DownstreamSkillRegistry:
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
