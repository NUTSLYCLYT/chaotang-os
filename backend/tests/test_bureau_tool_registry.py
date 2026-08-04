from dataclasses import fields, is_dataclass, replace

import pytest

import app.agents.runtime_skills.tool_registry as registry_module
from app.agents.runtime_skills.roles.bureaus.professional import (
    BUREAU_TOOL_POLICY_SPECS,
)
from app.agents.runtime_skills.roles.bureaus.skill_registry import BUREAU_SKILL_SPECS
from app.agents.runtime_skills.tool_models import ToolName
from app.agents.runtime_skills.tool_registry import (
    BUREAU_TOOL_POLICIES,
    TOOL_DESCRIPTORS,
    bureau_tool_policy_for,
    tool_descriptor_for,
    validate_bureau_tool_registry,
)


def test_exact_authoritative_descriptors() -> None:
    expected = {
        ToolName.REQUEST_EVIDENCE: ("evidence_request.v1", "evidence_result.v1", False),
        ToolName.READ_APPROVED_MATERIALS: (
            "approved_materials_query.v1",
            "approved_materials_result.v1",
            True,
        ),
        ToolName.INSPECT_APPROVED_DATA: ("approved_data_query.v1", "approved_data_result.v1", True),
        ToolName.COMPUTE_ANALYSIS: ("analysis_request.v1", "analysis_result.v1", True),
    }
    assert set(TOOL_DESCRIPTORS) == set(expected)
    for name, descriptor in TOOL_DESCRIPTORS.items():
        input_schema, output_schema, deterministic = expected[name]
        assert descriptor.version == "1.0.0"
        assert descriptor.tool_name is name
        assert descriptor.input_schema_id == input_schema
        assert descriptor.output_schema_id == output_schema
        assert descriptor.handler_id == f"bureau-handler.{name.value}.v1"
        assert descriptor.read_only is True
        assert descriptor.deterministic is deterministic


def test_exact_39_explicit_constrained_policies() -> None:
    assert len(BUREAU_TOOL_POLICIES) == 39
    assert len({policy.policy_id for policy in BUREAU_TOOL_POLICIES.values()}) == 39
    assert set(BUREAU_TOOL_POLICIES) == {
        policy.agent_id for policy in BUREAU_TOOL_POLICIES.values()
    }
    for policy in BUREAU_TOOL_POLICIES.values():
        assert policy.version == "1.0.0"
        assert ToolName.READ_APPROVED_MATERIALS in policy.allowed_tools
        assert policy.allowed_data_domains and "*" not in policy.allowed_data_domains
        assert set(policy.tool_operations) == set(policy.allowed_tools)
        assert set(policy.tool_argument_constraints) == set(policy.allowed_tools)
        assert all(policy.tool_operations.values())
        assert all(policy.tool_argument_constraints.values())
        assert policy.max_tool_calls <= 4
        assert policy.max_tool_rounds <= 2
        assert 0 < policy.max_result_rows <= 200
        assert 0 < policy.max_result_bytes <= 262_144


def test_lookups_fail_closed() -> None:
    with pytest.raises(ValueError, match="tool_descriptor_not_registered"):
        tool_descriptor_for("unknown")  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="bureau_tool_policy_not_registered"):
        bureau_tool_policy_for("unknown")


def test_registry_validator_accepts_authoritative_registry() -> None:
    validate_bureau_tool_registry()


def test_professional_specs_are_complete_authoritative_contracts() -> None:
    assert len(BUREAU_TOOL_POLICY_SPECS) == 39
    for agent_id, spec in BUREAU_TOOL_POLICY_SPECS.items():
        assert spec.agent_id == agent_id
        assert spec.version == "1.0.0"
        assert spec.allowed_tools
        assert spec.allowed_data_domains
        assert spec.tool_operations
        assert spec.tool_argument_constraints
        assert spec.required_data_refs
        assert spec.max_tool_calls > 0
        assert spec.max_tool_rounds > 0
        assert spec.max_result_rows > 0
        assert spec.max_result_bytes > 0


def test_professional_specs_store_every_contract_field_as_literal_data() -> None:
    expected_fields = {
        "policy_id",
        "version",
        "agent_id",
        "allowed_tools",
        "allowed_data_domains",
        "tool_operations",
        "tool_argument_constraints",
        "required_data_refs",
        "max_tool_calls",
        "max_tool_rounds",
        "max_result_rows",
        "max_result_bytes",
    }
    assert is_dataclass(next(iter(BUREAU_TOOL_POLICY_SPECS.values())))
    assert {field.name for field in fields(next(iter(BUREAU_TOOL_POLICY_SPECS.values())))} == (
        expected_fields
    )
    for spec in BUREAU_TOOL_POLICY_SPECS.values():
        assert set(spec.__dict__) == expected_fields


def test_professional_specs_select_domain_specific_operations_and_arguments() -> None:
    recruitment = BUREAU_TOOL_POLICY_SPECS["libu-recruitment"]
    budget = BUREAU_TOOL_POLICY_SPECS["hubu-budget"]
    quality = BUREAU_TOOL_POLICY_SPECS["gongbu-quality"]

    operation_sets = {
        tuple(recruitment.tool_operations),
        tuple(budget.tool_operations),
        tuple(quality.tool_operations),
    }
    constraint_sets = {
        tuple(recruitment.tool_argument_constraints),
        tuple(budget.tool_argument_constraints),
        tuple(quality.tool_argument_constraints),
    }
    assert len(operation_sets) == 3
    assert len(constraint_sets) == 3
    assert "workforce.recruitment.candidate_stage" in repr(recruitment.tool_argument_constraints)
    assert "finance.budget.variance" in repr(budget.tool_argument_constraints)
    assert "delivery.quality.defect_rate" in repr(quality.tool_argument_constraints)
    assert "share" in repr(recruitment.tool_operations)
    assert "reconcile" in repr(budget.tool_operations)
    assert "threshold" in repr(quality.tool_operations)


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("version", "1.0.1", "bureau_tool_policy_contract_mismatch"),
        ("policy_id", "renamed", "bureau_tool_policy_contract_mismatch"),
        ("allowed_data_domains", frozenset({"ANY"}), "bureau_tool_policy_contract_mismatch"),
        ("max_result_rows", 201, "bureau_tool_policy_contract_mismatch"),
    ],
)
def test_validator_rejects_any_policy_contract_mutation(
    monkeypatch: pytest.MonkeyPatch, field: str, value: object, code: str
) -> None:
    policies = dict(BUREAU_TOOL_POLICIES)
    agent_id, policy = next(iter(policies.items()))
    policies[agent_id] = policy.model_copy(update={field: value})
    monkeypatch.setattr(registry_module, "BUREAU_TOOL_POLICIES", policies)
    with pytest.raises(ValueError, match=code):
        validate_bureau_tool_registry()


def test_validator_rejects_wrong_descriptor_id(monkeypatch: pytest.MonkeyPatch) -> None:
    descriptors = dict(TOOL_DESCRIPTORS)
    name = ToolName.REQUEST_EVIDENCE
    descriptors[name] = descriptors[name].model_copy(update={"descriptor_id": "renamed"})
    monkeypatch.setattr(registry_module, "TOOL_DESCRIPTORS", descriptors)
    with pytest.raises(ValueError, match="invalid_tool_descriptor_contract"):
        validate_bureau_tool_registry()


@pytest.mark.parametrize("mutation", ["missing", "extra", "duplicate_id"])
def test_validator_rejects_descriptor_inventory_mutations(
    monkeypatch: pytest.MonkeyPatch, mutation: str
) -> None:
    descriptors = dict(TOOL_DESCRIPTORS)
    if mutation == "missing":
        descriptors.pop(ToolName.REQUEST_EVIDENCE)
        code = "invalid_tool_descriptor_inventory"
    elif mutation == "extra":
        descriptors["unregistered"] = next(iter(descriptors.values()))  # type: ignore[index]
        code = "invalid_tool_descriptor_inventory"
    else:
        names = tuple(descriptors)
        descriptors[names[1]] = descriptors[names[1]].model_copy(
            update={"descriptor_id": descriptors[names[0]].descriptor_id}
        )
        code = "duplicate_tool_descriptor_id"
    monkeypatch.setattr(registry_module, "TOOL_DESCRIPTORS", descriptors)
    with pytest.raises(ValueError, match=code):
        validate_bureau_tool_registry()


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("input_schema_id", "wrong.v1", "invalid_tool_descriptor_contract"),
        ("output_schema_id", "wrong.v1", "invalid_tool_descriptor_contract"),
        ("read_only", False, "unsafe_tool_descriptor"),
        ("max_tool_calls", 5, "unsafe_tool_descriptor"),
        ("max_tool_rounds", 3, "unsafe_tool_descriptor"),
        ("max_result_rows", 201, "unsafe_tool_descriptor"),
        ("max_result_bytes", 262_145, "unsafe_tool_descriptor"),
    ],
)
def test_validator_rejects_unsafe_descriptor_contracts(
    monkeypatch: pytest.MonkeyPatch, field: str, value: object, code: str
) -> None:
    descriptors = dict(TOOL_DESCRIPTORS)
    name = ToolName.READ_APPROVED_MATERIALS
    descriptors[name] = descriptors[name].model_copy(update={field: value})
    monkeypatch.setattr(registry_module, "TOOL_DESCRIPTORS", descriptors)
    with pytest.raises(ValueError, match=code):
        validate_bureau_tool_registry()


@pytest.mark.parametrize("mutation", ["missing", "extra", "duplicate_id"])
def test_validator_rejects_policy_inventory_mutations(
    monkeypatch: pytest.MonkeyPatch, mutation: str
) -> None:
    policies = dict(BUREAU_TOOL_POLICIES)
    if mutation == "missing":
        policies.pop(next(iter(policies)))
        code = "invalid_bureau_tool_policy_inventory"
    elif mutation == "extra":
        policies["unregistered-agent"] = next(iter(policies.values()))
        code = "invalid_bureau_tool_policy_inventory"
    else:
        agents = tuple(policies)
        policies[agents[1]] = policies[agents[1]].model_copy(
            update={"policy_id": policies[agents[0]].policy_id}
        )
        code = "duplicate_bureau_tool_policy_id"
    monkeypatch.setattr(registry_module, "BUREAU_TOOL_POLICIES", policies)
    with pytest.raises(ValueError, match=code):
        validate_bureau_tool_registry()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("agent_id", "wrong-agent"),
        ("allowed_tools", frozenset({"unknown_tool"})),
        ("allowed_data_domains", frozenset({""})),
        ("allowed_data_domains", frozenset({"unregistered.domain"})),
        ("allowed_data_domains", frozenset({"*"})),
        (
            "tool_operations",
            {ToolName.READ_APPROVED_MATERIALS: ("unknown_operation",)},
        ),
        ("max_tool_calls", 5),
        ("max_tool_rounds", 3),
        ("max_result_rows", 201),
        ("max_result_bytes", 262_145),
    ],
)
def test_validator_rejects_unsafe_policy_mutations(
    monkeypatch: pytest.MonkeyPatch, field: str, value: object
) -> None:
    policies = dict(BUREAU_TOOL_POLICIES)
    agent_id, policy = next(iter(policies.items()))
    policies[agent_id] = policy.model_copy(update={field: value})
    monkeypatch.setattr(registry_module, "BUREAU_TOOL_POLICIES", policies)
    with pytest.raises(ValueError):
        validate_bureau_tool_registry()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("policy_id", "renamed"),
        ("version", "1.0.1"),
        ("agent_id", "wrong-agent"),
        ("allowed_tools", (ToolName.READ_APPROVED_MATERIALS,)),
        ("allowed_data_domains", ("wrong.domain",)),
        (
            "tool_operations",
            ((ToolName.READ_APPROVED_MATERIALS, ("lookup_section",)),),
        ),
        ("tool_argument_constraints", ()),
        ("required_data_refs", ("case",)),
        ("max_tool_calls", 3),
        ("max_tool_rounds", 1),
        ("max_result_rows", 199),
        ("max_result_bytes", 262_143),
    ],
)
def test_validator_rejects_every_authoritative_spec_mutation(
    monkeypatch: pytest.MonkeyPatch, field: str, value: object
) -> None:
    first, *rest = BUREAU_SKILL_SPECS
    try:
        mutated_policy = replace(first.tool_policy, **{field: value})
    except ValueError:
        return
    if field == "agent_id":
        with pytest.raises(ValueError, match="tool_policy_agent_mismatch"):
            replace(first, tool_policy=mutated_policy)
        return
    monkeypatch.setattr(
        registry_module,
        "BUREAU_SKILL_SPECS",
        (replace(first, tool_policy=mutated_policy), *rest),
    )
    with pytest.raises(ValueError, match="bureau_tool_policy_contract_mismatch"):
        validate_bureau_tool_registry()
