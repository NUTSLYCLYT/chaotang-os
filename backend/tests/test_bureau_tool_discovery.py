import pytest
from pydantic import ValidationError

from app.agents.runtime_skills.tool_discovery import discover_tools
from app.agents.runtime_skills.tool_models import (
    BureauToolPolicy,
    ToolDescriptor,
    ToolDiscoveryContext,
    ToolHealth,
    ToolName,
    ToolSideEffect,
)


def _descriptor(
    name: ToolName,
    *,
    scopes: frozenset[str],
    domains: frozenset[str],
    side_effect: ToolSideEffect = ToolSideEffect.READ,
    health: ToolHealth = ToolHealth.AVAILABLE,
) -> ToolDescriptor:
    return ToolDescriptor(
        descriptor_id=f"descriptor.{name.value}",
        handler_id=f"handler.{name.value}",
        tool_name=name,
        version="1.0.0",
        input_schema_id=f"{name.value}.input.v1",
        output_schema_id=f"{name.value}.output.v1",
        read_only=side_effect is ToolSideEffect.READ,
        risk_level="low",
        deterministic=True,
        max_tool_calls=4,
        max_tool_rounds=2,
        max_result_rows=100,
        max_result_bytes=4096,
        capability_group="finance.accounting",
        required_scopes=scopes,
        data_domains=domains,
        side_effect=side_effect,
        health=health,
    )


def _policy() -> BureauToolPolicy:
    tools = frozenset(
        {
            ToolName.READ_APPROVED_MATERIALS,
            ToolName.INSPECT_APPROVED_DATA,
            ToolName.COMPUTE_ANALYSIS,
            ToolName.REQUEST_EVIDENCE,
        }
    )
    return BureauToolPolicy(
        policy_id="policy.hubu-accounting",
        version="1.0.0",
        agent_id="hubu-accounting",
        allowed_tools=tools,
        allowed_data_domains=frozenset({"finance.accounting"}),
        tool_operations={name: ("read",) for name in tools},
        tool_argument_constraints={name: {"domain": "finance.accounting"} for name in tools},
        required_data_refs=("approved-data:ledger",),
        max_tool_calls=4,
        max_tool_rounds=2,
        max_result_rows=100,
        max_result_bytes=4096,
    )


def _context() -> ToolDiscoveryContext:
    return ToolDiscoveryContext(
        version="1.0.0",
        agent_id="hubu-accounting",
        skill_id="analyze-accounting-position",
        skill_version="1.0.0",
        policy_id="policy.hubu-accounting",
        policy_version="1.0.0",
        decree_scopes=frozenset({"finance.read", "artifact.generate"}),
        data_domains=frozenset({"finance.accounting"}),
        allowed_side_effects=frozenset({ToolSideEffect.READ, ToolSideEffect.ARTIFACT}),
    )


def _discover(
    context: ToolDiscoveryContext,
    descriptors: dict[ToolName, ToolDescriptor],
    policy: BureauToolPolicy,
):
    return discover_tools(
        context,
        descriptors,
        policy,
        authoritative_skill_id="analyze-accounting-position",
        authoritative_skill_version="1.0.0",
    )


def test_discover_tools_returns_only_full_permission_intersection() -> None:
    descriptors = {
        ToolName.READ_APPROVED_MATERIALS: _descriptor(
            ToolName.READ_APPROVED_MATERIALS,
            scopes=frozenset({"finance.read"}),
            domains=frozenset({"finance.accounting"}),
        ),
        ToolName.INSPECT_APPROVED_DATA: _descriptor(
            ToolName.INSPECT_APPROVED_DATA,
            scopes=frozenset({"finance.read"}),
            domains=frozenset({"finance.accounting"}),
        ),
        ToolName.COMPUTE_ANALYSIS: _descriptor(
            ToolName.COMPUTE_ANALYSIS,
            scopes=frozenset({"finance.write"}),
            domains=frozenset({"finance.accounting"}),
        ),
        ToolName.REQUEST_EVIDENCE: _descriptor(
            ToolName.REQUEST_EVIDENCE,
            scopes=frozenset({"finance.read"}),
            domains=frozenset({"hr.records"}),
        ),
    }

    tools = _discover(_context(), descriptors, _policy())

    assert [item.name for item in tools] == [
        ToolName.INSPECT_APPROVED_DATA,
        ToolName.READ_APPROVED_MATERIALS,
    ]
    assert all(item.handler_id is None for item in tools)


def test_discovery_excludes_unhealthy_and_disallowed_side_effect_tools() -> None:
    descriptors = {
        ToolName.READ_APPROVED_MATERIALS: _descriptor(
            ToolName.READ_APPROVED_MATERIALS,
            scopes=frozenset({"finance.read"}),
            domains=frozenset({"finance.accounting"}),
            health=ToolHealth.UNAVAILABLE,
        ),
        ToolName.INSPECT_APPROVED_DATA: _descriptor(
            ToolName.INSPECT_APPROVED_DATA,
            scopes=frozenset({"finance.read"}),
            domains=frozenset({"finance.accounting"}),
            side_effect=ToolSideEffect.SYSTEM_WRITE,
        ),
    }

    assert _discover(_context(), descriptors, _policy()) == ()


def test_discovery_excludes_cross_domain_tool() -> None:
    descriptor = _descriptor(
        ToolName.READ_APPROVED_MATERIALS,
        scopes=frozenset({"finance.read"}),
        domains=frozenset({"hr.records"}),
    )

    assert _discover(
        _context(),
        {descriptor.tool_name: descriptor},
        _policy(),
    ) == ()


@pytest.mark.parametrize(
    ("context_update", "authoritative_skill_id", "authoritative_skill_version"),
    [
        ({"skill_id": "other-skill"}, "analyze-accounting-position", "1.0.0"),
        ({"skill_version": "1.0.1"}, "analyze-accounting-position", "1.0.0"),
    ],
)
def test_discovery_fails_closed_when_skill_identity_or_version_mismatches_authority(
    context_update: dict[str, str],
    authoritative_skill_id: str,
    authoritative_skill_version: str,
) -> None:
    descriptor = _descriptor(
        ToolName.READ_APPROVED_MATERIALS,
        scopes=frozenset({"finance.read"}),
        domains=frozenset({"finance.accounting"}),
    )

    assert discover_tools(
        _context().model_copy(update=context_update),
        {descriptor.tool_name: descriptor},
        _policy(),
        authoritative_skill_id=authoritative_skill_id,
        authoritative_skill_version=authoritative_skill_version,
    ) == ()


def test_discovery_fails_closed_when_system_owned_identity_versions_do_not_match() -> None:
    descriptor = _descriptor(
        ToolName.READ_APPROVED_MATERIALS,
        scopes=frozenset({"finance.read"}),
        domains=frozenset({"finance.accounting"}),
    )
    policy = _policy()
    context = _context()

    for update in (
        {"agent_id": "hubu-budget"},
        {"policy_id": "other-policy"},
        {"policy_version": "1.0.1"},
    ):
        assert _discover(
            context.model_copy(update=update),
            {descriptor.tool_name: descriptor},
            policy,
        ) == ()


def test_discovery_contracts_are_immutable_and_versioned() -> None:
    with pytest.raises(ValidationError, match="unsupported_semantic_version"):
        _context().model_copy(update={"version": "v1"}).model_validate(
            {**_context().model_dump(), "version": "v1"}
        )
    with pytest.raises(ValidationError):
        _context().agent_id = "hubu-budget"  # type: ignore[misc]
