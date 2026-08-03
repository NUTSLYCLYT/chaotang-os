import pytest

from app.agents.bureaus import BUREAU_PROFILES
from app.agents.runtime_skills import (
    AgentLayer,
    DownstreamSkillRegistry,
    DownstreamSkillRegistryError,
    RuntimeService,
    build_default_downstream_skill_registry,
    bureau_agent_id,
)
from app.agents.runtime_skills.models import RuntimeSkillDefinition

EXPECTED_SKILL_IDS = {
    "conduct-joint-ministry-review",
    "synthesize-workforce-governance",
    "synthesize-finance-governance",
    "synthesize-communications-governance",
    "synthesize-commercial-governance",
    "synthesize-risk-governance",
    "synthesize-delivery-governance",
    "analyze-appointment-fit",
    "analyze-recruitment-pipeline",
    "analyze-labor-relations",
    "analyze-compensation-equity",
    "analyze-hr-policy",
    "analyze-workforce-coordination",
    "analyze-budget-performance",
    "analyze-cash-safety",
    "analyze-pricing-economics",
    "analyze-financing-options",
    "analyze-financial-controls",
    "analyze-accounting-position",
    "analyze-investment-case",
    "analyze-brand-consistency",
    "analyze-public-relations",
    "analyze-customer-communications",
    "analyze-content-quality",
    "analyze-government-enterprise-relations",
    "analyze-user-experience",
    "analyze-sales-opportunity",
    "analyze-lead-acquisition",
    "analyze-channel-performance",
    "analyze-customer-health",
    "analyze-competitive-position",
    "analyze-growth-funnel",
    "analyze-contract-risk",
    "analyze-compliance-posture",
    "analyze-enterprise-risk",
    "analyze-evidence-integrity",
    "analyze-dispute-resolution",
    "analyze-intellectual-property",
    "analyze-legal-policy",
    "analyze-product-strategy",
    "analyze-technical-feasibility",
    "analyze-supply-readiness",
    "analyze-delivery-schedule",
    "analyze-quality-readiness",
    "analyze-field-conditions",
    "analyze-commitment-fulfillment",
}


def test_default_registry_has_exactly_46_one_to_one_bindings() -> None:
    registry = build_default_downstream_skill_registry()
    assert len(registry.skills) == 46
    assert len({skill.skill_id for skill in registry.skills}) == 46
    assert len({skill.agent_id for skill in registry.skills}) == 46
    assert sum(s.layer is AgentLayer.BUREAU for s in registry.skills) == 39
    assert sum(s.layer is AgentLayer.MINISTRY for s in registry.skills) == 6
    assert sum(s.layer is AgentLayer.COUNCIL for s in registry.skills) == 1
    assert {skill.skill_id for skill in registry.skills} == EXPECTED_SKILL_IDS


def test_only_bureau_skills_may_use_evidence_protocol() -> None:
    for skill in build_default_downstream_skill_registry().skills:
        assert (RuntimeService.EVIDENCE_PROTOCOL in skill.allowed_services) == (
            skill.layer is AgentLayer.BUREAU
        )


@pytest.mark.parametrize(
    ("department", "bureau"),
    [(profile.department, profile.bureau) for profile in BUREAU_PROFILES],
)
def test_each_authoritative_bureau_identity_has_one_binding(department: str, bureau: str) -> None:
    registry = build_default_downstream_skill_registry()
    expected_agent_id = bureau_agent_id(department, bureau)
    matches = [skill for skill in registry.skills if skill.agent_id == expected_agent_id]
    assert len(matches) == 1
    assert matches[0].layer is AgentLayer.BUREAU


def test_each_bureau_has_a_substantive_distinct_professional_method() -> None:
    bureau_skills = [
        skill
        for skill in build_default_downstream_skill_registry().skills
        if skill.layer is AgentLayer.BUREAU
    ]
    assert all(len(skill.data_requirements) >= 2 for skill in bureau_skills)
    assert all(len(skill.analysis_procedure) >= 3 for skill in bureau_skills)
    assert all(len(skill.required_findings) >= 2 for skill in bureau_skills)
    assert all(len(skill.forbidden_actions) >= 2 for skill in bureau_skills)


@pytest.mark.parametrize(
    ("agent_id", "required_terms"),
    [
        ("libu-recruitment", ("候选人", "漏斗", "面试")),
        ("hubu-accounting", ("总账", "科目", "关账")),
        ("libu-rites-public-relations", ("舆情", "事实", "升级")),
        ("bingbu-channels", ("报备", "返佣", "归属")),
        ("xingbu-contracts", ("条款", "签署", "偏离")),
        ("gongbu-quality", ("缺陷", "验收", "返工")),
    ],
)
def test_representative_bureaus_encode_domain_methods(
    agent_id: str, required_terms: tuple[str, ...]
) -> None:
    skill = build_default_downstream_skill_registry().get_by_agent(agent_id)
    professional_text = " ".join(
        (
            *skill.data_requirements,
            *skill.analysis_procedure,
            *skill.required_findings,
            *skill.forbidden_actions,
        )
    )
    assert all(term in professional_text for term in required_terms)


def test_all_bureau_methods_have_distinct_domain_checklists() -> None:
    skills = tuple(
        skill
        for skill in build_default_downstream_skill_registry().skills
        if skill.layer is AgentLayer.BUREAU
    )
    signatures = {
        (
            skill.data_requirements,
            skill.analysis_procedure,
            skill.required_findings,
            skill.forbidden_actions,
        )
        for skill in skills
    }
    assert len(signatures) == 39
    assert all(len(set(skill.analysis_procedure)) == 3 for skill in skills)


def test_upper_layers_have_only_their_layer_service() -> None:
    for skill in build_default_downstream_skill_registry().skills:
        if skill.layer is AgentLayer.MINISTRY:
            assert skill.allowed_services == frozenset({RuntimeService.BUREAU_AGENTS})
        elif skill.layer is AgentLayer.COUNCIL:
            assert skill.allowed_services == frozenset({RuntimeService.MINISTRY_AGENTS})


def test_registry_rejects_duplicate_bindings_and_unknown_lookups() -> None:
    skill = build_default_downstream_skill_registry().skills[0]
    with pytest.raises(DownstreamSkillRegistryError, match="duplicate_skill_id"):
        DownstreamSkillRegistry((skill, skill))

    registry = build_default_downstream_skill_registry()
    with pytest.raises(DownstreamSkillRegistryError, match="skill_not_registered"):
        registry.get("missing")
    with pytest.raises(DownstreamSkillRegistryError, match="agent_skill_not_registered"):
        registry.get_by_agent("missing")


def _replace(skill: RuntimeSkillDefinition, **changes: object) -> RuntimeSkillDefinition:
    return skill.model_copy(update=changes)


def test_registry_rejects_two_skill_ids_for_one_agent() -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    skills[1] = _replace(skills[1], agent_id=skills[0].agent_id)
    with pytest.raises(DownstreamSkillRegistryError, match="duplicate_agent_binding"):
        DownstreamSkillRegistry(tuple(skills))


def test_registry_rejects_unique_non_authoritative_skill_id() -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    skills[-1] = _replace(skills[-1], skill_id="analyze-invented-domain")
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_skill_binding"):
        DownstreamSkillRegistry(tuple(skills))


def test_registry_rejects_swapped_authoritative_skill_ids() -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    first, second = 1, 2
    first_skill_id = skills[first].skill_id
    second_skill_id = skills[second].skill_id
    skills[first] = _replace(skills[first], skill_id=second_skill_id)
    skills[second] = _replace(skills[second], skill_id=first_skill_id)
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_skill_binding"):
        DownstreamSkillRegistry(tuple(skills))


def test_registry_rejects_unknown_agent() -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    skills[-1] = _replace(skills[-1], agent_id="unknown-agent")
    with pytest.raises(DownstreamSkillRegistryError, match="unknown_agent"):
        DownstreamSkillRegistry(tuple(skills))


def test_registry_rejects_wrong_agent_layer() -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    skills[-1] = _replace(skills[-1], layer=AgentLayer.MINISTRY)
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_agent_layer"):
        DownstreamSkillRegistry(tuple(skills))


def test_registry_rejects_wrong_inventory_count() -> None:
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_inventory_count"):
        DownstreamSkillRegistry(build_default_downstream_skill_registry().skills[:-1])


@pytest.mark.parametrize("layer", [AgentLayer.MINISTRY, AgentLayer.COUNCIL])
def test_registry_rejects_upper_layer_evidence_protocol(layer: AgentLayer) -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    index = next(i for i, skill in enumerate(skills) if skill.layer is layer)
    skills[index] = _replace(
        skills[index],
        allowed_services=skills[index].allowed_services | {RuntimeService.EVIDENCE_PROTOCOL},
    )
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_service_policy"):
        DownstreamSkillRegistry(tuple(skills))


def test_registry_rejects_bureau_missing_or_having_illegal_service() -> None:
    skills = list(build_default_downstream_skill_registry().skills)
    index = next(i for i, skill in enumerate(skills) if skill.layer is AgentLayer.BUREAU)
    skills[index] = _replace(
        skills[index],
        allowed_services=skills[index].allowed_services - {RuntimeService.EVIDENCE_PROTOCOL},
    )
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_service_policy"):
        DownstreamSkillRegistry(tuple(skills))

    skills = list(build_default_downstream_skill_registry().skills)
    skills[index] = _replace(
        skills[index],
        allowed_services=skills[index].allowed_services | {RuntimeService.BUREAU_AGENTS},
    )
    with pytest.raises(DownstreamSkillRegistryError, match="invalid_service_policy"):
        DownstreamSkillRegistry(tuple(skills))
