import pytest
from pydantic import ValidationError

from app.agents.chancellor_runtime import (
    ChancellorEntrypoint,
    ChancellorSkillId,
    ChancellorSkillRegistry,
    ChancellorSkillRegistryError,
    RuntimeService,
    RuntimeSkillDefinition,
    build_default_skill_registry,
)


def test_default_registry_maps_each_live_entrypoint_to_one_skill() -> None:
    registry = build_default_skill_registry()

    assert (
        registry.resolve(ChancellorEntrypoint.CONSULT).skill_id
        is ChancellorSkillId.CONSULT
    )
    assert (
        registry.resolve(ChancellorEntrypoint.DRAFT).skill_id
        is ChancellorSkillId.DRAFT_DECREE
    )
    assert (
        registry.resolve(ChancellorEntrypoint.EXECUTE).skill_id
        is ChancellorSkillId.EXECUTE_DECREE
    )


def test_follow_up_is_registered_but_disabled() -> None:
    skill = build_default_skill_registry().get(ChancellorSkillId.FOLLOW_UP)

    assert skill.enabled is False
    assert skill.version == "0.0.0-disabled"
    assert skill.allowed_entrypoints == ()


@pytest.mark.parametrize(
    ("skill_id", "expected_services", "expected_enabled", "expected_version"),
    [
        (
            ChancellorSkillId.CONSULT,
            frozenset({RuntimeService.CONSULT_MODEL}),
            True,
            "1.0.0",
        ),
        (
            ChancellorSkillId.DRAFT_DECREE,
            frozenset(
                {
                    RuntimeService.DRAFT_MODEL,
                    RuntimeService.DRAFT_AUTHORITY,
                }
            ),
            True,
            "1.0.0",
        ),
        (
            ChancellorSkillId.EXECUTE_DECREE,
            frozenset(
                {
                    RuntimeService.DECREE_GRAPH,
                    RuntimeService.MINISTRIES,
                    RuntimeService.JUNJICHU,
                    RuntimeService.EVIDENCE_PROTOCOL,
                    RuntimeService.SHIGUAN,
                    RuntimeService.REPORT_ARTIFACTS,
                }
            ),
            True,
            "1.0.0",
        ),
        (
            ChancellorSkillId.FOLLOW_UP,
            frozenset({RuntimeService.OWNER_SCOPED_FOLLOW_UP_READS}),
            False,
            "0.0.0-disabled",
        ),
    ],
)
def test_default_registry_exposes_canonical_skill_metadata(
    skill_id: ChancellorSkillId,
    expected_services: frozenset[RuntimeService],
    expected_enabled: bool,
    expected_version: str,
) -> None:
    expected_ids = {
        ChancellorSkillId.CONSULT,
        ChancellorSkillId.DRAFT_DECREE,
        ChancellorSkillId.EXECUTE_DECREE,
        ChancellorSkillId.FOLLOW_UP,
    }
    assert set(ChancellorSkillId) == expected_ids

    skill = build_default_skill_registry().get(skill_id)

    assert skill.skill_id is skill_id
    assert skill.allowed_services == expected_services
    assert skill.enabled is expected_enabled
    assert skill.version == expected_version


def test_entrypoint_cannot_request_another_skill() -> None:
    registry = build_default_skill_registry()

    with pytest.raises(ChancellorSkillRegistryError, match="skill_not_allowed"):
        registry.require_allowed(
            ChancellorEntrypoint.CONSULT,
            ChancellorSkillId.EXECUTE_DECREE,
        )


def test_registry_rejects_duplicate_skill_ids() -> None:
    skill = build_default_skill_registry().get(ChancellorSkillId.CONSULT)

    with pytest.raises(ChancellorSkillRegistryError, match="duplicate_skill_id"):
        ChancellorSkillRegistry((skill, skill))


def test_disabled_skill_never_resolves() -> None:
    with pytest.raises(
        ChancellorSkillRegistryError,
        match="entrypoint_not_registered",
    ):
        build_default_skill_registry().resolve(ChancellorEntrypoint.FOLLOW_UP)


def test_registry_rejects_ambiguous_entrypoint() -> None:
    consult = build_default_skill_registry().get(ChancellorSkillId.CONSULT)
    duplicate_entrypoint = RuntimeSkillDefinition(
        skill_id=ChancellorSkillId.DRAFT_DECREE,
        version="1.0.0",
        description="Another enabled skill for the consult entrypoint.",
        enabled=True,
        allowed_entrypoints=(ChancellorEntrypoint.CONSULT,),
        allowed_services=frozenset({RuntimeService.DRAFT_MODEL}),
        forbidden_actions=("execute a decree",),
        authorization_policy="consult entrypoint only",
    )

    registry = ChancellorSkillRegistry((consult, duplicate_entrypoint))

    with pytest.raises(
        ChancellorSkillRegistryError,
        match="entrypoint_ambiguous",
    ):
        registry.resolve(ChancellorEntrypoint.CONSULT)


def test_registry_rejects_unknown_skill() -> None:
    registry = ChancellorSkillRegistry(())

    with pytest.raises(
        ChancellorSkillRegistryError,
        match="skill_not_registered",
    ):
        registry.get(ChancellorSkillId.CONSULT)


def test_skill_definitions_are_immutable() -> None:
    skill = build_default_skill_registry().get(ChancellorSkillId.CONSULT)

    with pytest.raises(ValidationError):
        skill.version = "2.0.0"


@pytest.mark.parametrize(
    ("field_name", "blank_value"),
    [
        ("version", ""),
        ("description", " "),
        ("forbidden_actions", ("\t",)),
        ("authorization_policy", "\n"),
    ],
)
def test_skill_definition_rejects_blank_metadata(
    field_name: str,
    blank_value: object,
) -> None:
    skill = build_default_skill_registry().get(ChancellorSkillId.CONSULT)
    invalid = skill.model_dump()
    invalid[field_name] = blank_value

    with pytest.raises(ValidationError):
        RuntimeSkillDefinition.model_validate(invalid)
