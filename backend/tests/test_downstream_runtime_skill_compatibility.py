"""Compatibility coverage for migrating legacy capabilities to Runtime Skills."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agents.bureaus.agent import invoke_bureau_agent
from app.agents.bureaus.capabilities import (
    CAPABILITY_PROFILES,
    capability_analysis_modes_for_skill,
    skill_id_for_legacy_capability,
    validate_legacy_capability_skill_bindings,
)
from app.agents.runtime_skills import (
    AgentLayer,
    build_default_downstream_skill_registry,
    bureau_agent_id,
)


def test_every_legacy_capability_maps_to_its_bureau_skill() -> None:
    registry = build_default_downstream_skill_registry()

    assert len(CAPABILITY_PROFILES) == 20
    for capability in CAPABILITY_PROFILES:
        skill = registry.get(skill_id_for_legacy_capability(capability.capability_id))
        assert skill.agent_id == bureau_agent_id(capability.department, capability.bureau)


def test_compound_bureau_identity_is_preserved_by_every_compatibility_mapping() -> None:
    registry = build_default_downstream_skill_registry()

    bindings = {
        (
            capability.department,
            capability.bureau,
            capability.capability_id,
        ): registry.get(skill_id_for_legacy_capability(capability.capability_id)).agent_id
        for capability in CAPABILITY_PROFILES
    }

    assert len(bindings) == 20
    assert all(
        agent_id == bureau_agent_id(department, bureau)
        for (department, bureau, _capability_id), agent_id in bindings.items()
    )


def test_legacy_metadata_is_available_only_as_modes_of_the_owning_skill() -> None:
    registry = build_default_downstream_skill_registry()

    for capability in CAPABILITY_PROFILES:
        skill_id = skill_id_for_legacy_capability(capability.capability_id)
        modes = capability_analysis_modes_for_skill(skill_id)
        assert capability in modes
        assert all(
            registry.get(skill_id).agent_id == bureau_agent_id(mode.department, mode.bureau)
            for mode in modes
        )
        assert capability.purpose
        assert capability.deliverables
        assert capability.guardrails


def test_unknown_legacy_capability_and_skill_ids_fail_closed() -> None:
    with pytest.raises(ValueError, match="Unknown capability ID"):
        skill_id_for_legacy_capability("missing-capability")
    with pytest.raises(ValueError, match="Unknown Runtime Skill ID"):
        capability_analysis_modes_for_skill("missing-skill")


def test_all_39_bureaus_work_without_legacy_capability() -> None:
    registry = build_default_downstream_skill_registry()

    bureau_skills = tuple(skill for skill in registry.skills if skill.layer is AgentLayer.BUREAU)
    assert len({skill.agent_id for skill in bureau_skills}) == 39
    assert len(bureau_skills) == 39
    assert (
        sum(not capability_analysis_modes_for_skill(skill.skill_id) for skill in bureau_skills)
        == 23
    )


def test_one_invocation_never_stacks_legacy_and_runtime_skill_prompts() -> None:
    captured: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        captured.append(messages)
        return '{"opinion":"bounded technical opinion"}'

    invoke_bureau_agent(
        "工部",
        "技术司",
        "approved technical request",
        "approved parent route",
        model,
    )

    system_text = captured[0][0]["content"]
    assert len(captured) == 1
    assert "analyze-technical-feasibility" in system_text
    for mode in capability_analysis_modes_for_skill("analyze-technical-feasibility"):
        assert system_text.count(mode.purpose) == 1
        assert all(system_text.count(deliverable) == 1 for deliverable in mode.deliverables)


@pytest.mark.parametrize(
    ("registered_skill", "error_code"),
    [
        (None, "legacy_capability_skill_not_registered"),
        (
            SimpleNamespace(
                skill_id="wrong-skill",
                agent_id="different-bureau",
                layer=AgentLayer.BUREAU,
            ),
            "legacy_capability_cross_bureau_binding",
        ),
        (
            SimpleNamespace(
                skill_id="wrong-layer",
                agent_id="bingbu-leads",
                layer=AgentLayer.MINISTRY,
            ),
            "legacy_capability_non_bureau_skill",
        ),
    ],
)
def test_authoritative_binding_validation_rejects_registry_mutations(
    registered_skill: object | None,
    error_code: str,
) -> None:
    capability = CAPABILITY_PROFILES[0]

    class MutatedRegistry:
        def get_by_agent(self, _agent_id: str) -> object:
            if registered_skill is None:
                raise ValueError("missing")
            return registered_skill

    with pytest.raises(ValueError, match=error_code):
        validate_legacy_capability_skill_bindings(MutatedRegistry(), profiles=(capability,))


def test_default_registry_construction_runs_legacy_binding_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.agents.runtime_skills.registry as registry_module

    real_validator = registry_module.validate_legacy_capability_skill_bindings
    calls = 0

    def recording_validator(registry: object) -> object:
        nonlocal calls
        calls += 1
        return real_validator(registry)

    monkeypatch.setattr(
        registry_module,
        "validate_legacy_capability_skill_bindings",
        recording_validator,
    )

    registry_module.build_default_downstream_skill_registry()

    assert calls == 1
