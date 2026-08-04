from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

from app.agents.runtime_skills.roles.bureaus.skill_registry import BUREAU_SKILL_SPECS
from app.agents.runtime_skills.tool_models import (
    BureauToolPolicy,
    ToolDescriptor,
    ToolName,
)

SYSTEM_MAX_TOOL_CALLS = 4
SYSTEM_MAX_TOOL_ROUNDS = 2
SYSTEM_MAX_RESULT_ROWS = 200
SYSTEM_MAX_RESULT_BYTES = 262_144

_EXPECTED_DESCRIPTOR_CONTRACTS = {
    ToolName.REQUEST_EVIDENCE: (
        "evidence_request.v1", "evidence_result.v1", False
    ),
    ToolName.READ_APPROVED_MATERIALS: (
        "approved_materials_query.v1", "approved_materials_result.v1", True
    ),
    ToolName.INSPECT_APPROVED_DATA: (
        "approved_data_query.v1", "approved_data_result.v1", True
    ),
    ToolName.COMPUTE_ANALYSIS: (
        "analysis_request.v1", "analysis_result.v1", True
    ),
}
_EXPECTED_DESCRIPTOR_IDS = {
    name: f"bureau-tool.{name.value}" for name in ToolName
}
_ALLOWED_CONSTRAINT_KEYS = frozenset(
    {
        "allowed_domains", "operation_required", "approved_refs_only",
        "allowed_fields", "allowed_dimensions", "allowed_metrics",
    }
)


def _descriptor(
    name: ToolName, input_schema: str, output_schema: str, *, deterministic: bool
) -> ToolDescriptor:
    return ToolDescriptor(
        descriptor_id=f"bureau-tool.{name.value}",
        handler_id=f"bureau-handler.{name.value}.v1",
        tool_name=name,
        version="1.0.0",
        input_schema_id=input_schema,
        output_schema_id=output_schema,
        read_only=True,
        risk_level="controlled_read_only",
        deterministic=deterministic,
        max_tool_calls=SYSTEM_MAX_TOOL_CALLS,
        max_tool_rounds=SYSTEM_MAX_TOOL_ROUNDS,
        max_result_rows=SYSTEM_MAX_RESULT_ROWS,
        max_result_bytes=SYSTEM_MAX_RESULT_BYTES,
    )


TOOL_DESCRIPTORS: Mapping[ToolName, ToolDescriptor] = MappingProxyType(
    {
        ToolName.REQUEST_EVIDENCE: _descriptor(
            ToolName.REQUEST_EVIDENCE,
            "evidence_request.v1",
            "evidence_result.v1",
            deterministic=False,
        ),
        ToolName.READ_APPROVED_MATERIALS: _descriptor(
            ToolName.READ_APPROVED_MATERIALS,
            "approved_materials_query.v1",
            "approved_materials_result.v1",
            deterministic=True,
        ),
        ToolName.INSPECT_APPROVED_DATA: _descriptor(
            ToolName.INSPECT_APPROVED_DATA,
            "approved_data_query.v1",
            "approved_data_result.v1",
            deterministic=True,
        ),
        ToolName.COMPUTE_ANALYSIS: _descriptor(
            ToolName.COMPUTE_ANALYSIS,
            "analysis_request.v1",
            "analysis_result.v1",
            deterministic=True,
        ),
    }
)

_OPERATIONS = {
    ToolName.REQUEST_EVIDENCE: ("request_fact_slots",),
    ToolName.READ_APPROVED_MATERIALS: ("read_summary", "lookup_section"),
    ToolName.INSPECT_APPROVED_DATA: (
        "describe",
        "filter",
        "aggregate",
        "compare",
        "top_n",
        "lookup",
    ),
    ToolName.COMPUTE_ANALYSIS: (
        "arithmetic",
        "percentage",
        "year_over_year",
        "period_over_period",
        "share",
        "difference",
        "mean",
        "median",
        "extrema",
        "rank",
        "group_summary",
        "trend",
        "threshold",
        "reconcile",
    ),
}


def _policy(spec) -> BureauToolPolicy:
    spec = spec.tool_policy
    tools = frozenset(spec.allowed_tools)
    domains = frozenset(spec.allowed_data_domains)
    constraints = {
        tool: dict(items) for tool, items in spec.tool_argument_constraints
    }
    return BureauToolPolicy(
        policy_id=spec.policy_id,
        version=spec.version,
        agent_id=spec.agent_id,
        allowed_tools=tools,
        allowed_data_domains=domains,
        tool_operations=dict(spec.tool_operations),
        tool_argument_constraints=constraints,
        required_data_refs=spec.required_data_refs,
        max_tool_calls=spec.max_tool_calls,
        max_tool_rounds=spec.max_tool_rounds,
        max_result_rows=spec.max_result_rows,
        max_result_bytes=spec.max_result_bytes,
    )


BUREAU_TOOL_POLICIES: Mapping[str, BureauToolPolicy] = MappingProxyType(
    {spec.agent_id: _policy(spec) for spec in BUREAU_SKILL_SPECS}
)


def tool_descriptor_for(name: ToolName) -> ToolDescriptor:
    try:
        return TOOL_DESCRIPTORS[name]
    except (KeyError, TypeError) as exc:
        raise ValueError("tool_descriptor_not_registered") from exc


def bureau_tool_policy_for(agent_id: str) -> BureauToolPolicy:
    try:
        return BUREAU_TOOL_POLICIES[agent_id]
    except (KeyError, TypeError) as exc:
        raise ValueError("bureau_tool_policy_not_registered") from exc


def validate_bureau_tool_registry() -> None:
    expected_tools = frozenset(ToolName)
    if set(TOOL_DESCRIPTORS) != expected_tools or len(TOOL_DESCRIPTORS) != 4:
        raise ValueError("invalid_tool_descriptor_inventory")
    descriptors = tuple(TOOL_DESCRIPTORS.values())
    if len({item.descriptor_id for item in descriptors}) != 4:
        raise ValueError("duplicate_tool_descriptor_id")
    if any(item.tool_name is not name for name, item in TOOL_DESCRIPTORS.items()):
        raise ValueError("invalid_tool_descriptor_binding")
    for name, descriptor in TOOL_DESCRIPTORS.items():
        expected_input, expected_output, expected_deterministic = (
            _EXPECTED_DESCRIPTOR_CONTRACTS[name]
        )
        if (
            descriptor.descriptor_id != _EXPECTED_DESCRIPTOR_IDS[name]
            or descriptor.handler_id != f"bureau-handler.{name.value}.v1"
            or
            descriptor.version != "1.0.0"
            or descriptor.input_schema_id != expected_input
            or descriptor.output_schema_id != expected_output
            or descriptor.deterministic is not expected_deterministic
        ):
            raise ValueError("invalid_tool_descriptor_contract")
    if any(
        not item.read_only
        or item.max_tool_calls > SYSTEM_MAX_TOOL_CALLS
        or item.max_tool_rounds > SYSTEM_MAX_TOOL_ROUNDS
        or item.max_result_rows > SYSTEM_MAX_RESULT_ROWS
        or item.max_result_bytes > SYSTEM_MAX_RESULT_BYTES
        for item in descriptors
    ):
        raise ValueError("unsafe_tool_descriptor")
    authoritative_specs = {spec.agent_id: spec for spec in BUREAU_SKILL_SPECS}
    if len(BUREAU_TOOL_POLICIES) != 39 or set(BUREAU_TOOL_POLICIES) != set(
        authoritative_specs
    ):
        raise ValueError("invalid_bureau_tool_policy_inventory")
    policies = tuple(BUREAU_TOOL_POLICIES.values())
    if len({item.policy_id for item in policies}) != 39:
        raise ValueError("duplicate_bureau_tool_policy_id")
    for agent_id, policy in BUREAU_TOOL_POLICIES.items():
        try:
            authoritative_policy = _policy(authoritative_specs[agent_id])
        except (TypeError, ValueError) as exc:
            raise ValueError("bureau_tool_policy_contract_mismatch") from exc
        if policy != authoritative_policy:
            raise ValueError("bureau_tool_policy_contract_mismatch")
        if policy.agent_id != agent_id:
            raise ValueError("invalid_bureau_tool_policy_binding")
        if (
            not policy.allowed_tools <= expected_tools
            or ToolName.READ_APPROVED_MATERIALS not in policy.allowed_tools
        ):
            raise ValueError("invalid_bureau_tool_policy_tools")
        if not policy.allowed_data_domains or any(
            "*" in domain or domain.casefold() in {"any", "all"}
            for domain in policy.allowed_data_domains
        ):
            raise ValueError("invalid_bureau_tool_policy_domain")
        if (
            set(policy.tool_operations) != set(policy.allowed_tools)
            or any(
                not set(operations) <= set(_OPERATIONS[tool])
                for tool, operations in policy.tool_operations.items()
            )
        ):
            raise ValueError("invalid_bureau_tool_policy_operations")
        for tool, constraints in policy.tool_argument_constraints.items():
            if tool not in policy.allowed_tools:
                raise ValueError("invalid_bureau_tool_policy_constraints")
            if set(constraints) != _ALLOWED_CONSTRAINT_KEYS:
                raise ValueError("invalid_bureau_tool_policy_constraints")
            constrained_domains = constraints.get("allowed_domains")
            if not constrained_domains or not set(constrained_domains) <= set(
                policy.allowed_data_domains
            ):
                raise ValueError("invalid_bureau_tool_policy_constraints")
        if (
            policy.max_tool_calls > SYSTEM_MAX_TOOL_CALLS
            or policy.max_tool_rounds > SYSTEM_MAX_TOOL_ROUNDS
            or policy.max_result_rows > SYSTEM_MAX_RESULT_ROWS
            or policy.max_result_bytes > SYSTEM_MAX_RESULT_BYTES
        ):
            raise ValueError("bureau_tool_policy_budget_exceeded")


validate_bureau_tool_registry()
