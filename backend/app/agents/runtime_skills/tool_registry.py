from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

from app.agents.runtime_skills.roles.bureaus.skill_registry import BUREAU_SKILL_SPECS
from app.agents.runtime_skills.tool_health import apply_tool_health
from app.agents.runtime_skills.tool_models import (
    BureauToolPolicy,
    ToolDescriptor,
    ToolHealth,
    ToolName,
    ToolSideEffect,
)

SYSTEM_MAX_TOOL_CALLS = 6
SYSTEM_MAX_TOOL_ROUNDS = 2
SYSTEM_MAX_RESULT_ROWS = 200
SYSTEM_MAX_RESULT_BYTES = 262_144

_EXPECTED_DESCRIPTOR_CONTRACTS = {
    ToolName.REQUEST_EVIDENCE: (
        "evidence_request.v1", "evidence_result.v1", False,
        "general", frozenset(), frozenset(), ToolSideEffect.READ, True,
    ),
    ToolName.READ_APPROVED_MATERIALS: (
        "approved_materials_query.v1", "approved_materials_result.v1", True,
        "general", frozenset(), frozenset(), ToolSideEffect.READ, True,
    ),
    ToolName.INSPECT_APPROVED_DATA: (
        "approved_data_query.v1", "approved_data_result.v1", True,
        "general", frozenset(), frozenset(), ToolSideEffect.READ, True,
    ),
    ToolName.COMPUTE_ANALYSIS: (
        "analysis_request.v1", "analysis_result.v1", True,
        "general", frozenset(), frozenset(), ToolSideEffect.READ, True,
    ),
    ToolName.INSPECT_ACCOUNTING_CONTENT: (
        "accounting_content_query.v1", "accounting_content_result.v1", True,
        "finance.accounting", frozenset({"finance.read"}),
        frozenset({"finance.accounting"}), ToolSideEffect.READ, True,
    ),
    ToolName.GENERATE_ACCOUNTING_WORKBOOK: (
        "accounting_workbook_request.v1", "accounting_workbook_result.v1", True,
        "finance.accounting", frozenset({"artifact.generate"}),
        frozenset({"finance.accounting"}), ToolSideEffect.ARTIFACT, False,
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
    name: ToolName,
    input_schema: str,
    output_schema: str,
    *,
    deterministic: bool,
    read_only: bool = True,
    risk_level: str = "controlled_read_only",
    capability_group: str = "general",
    required_scopes: frozenset[str] = frozenset(),
    data_domains: frozenset[str] = frozenset(),
    side_effect: ToolSideEffect = ToolSideEffect.READ,
) -> ToolDescriptor:
    return ToolDescriptor(
        descriptor_id=f"bureau-tool.{name.value}",
        handler_id=f"bureau-handler.{name.value}.v1",
        tool_name=name,
        version="1.0.0",
        input_schema_id=input_schema,
        output_schema_id=output_schema,
        read_only=read_only,
        risk_level=risk_level,
        deterministic=deterministic,
        max_tool_calls=SYSTEM_MAX_TOOL_CALLS,
        max_tool_rounds=SYSTEM_MAX_TOOL_ROUNDS,
        max_result_rows=SYSTEM_MAX_RESULT_ROWS,
        max_result_bytes=SYSTEM_MAX_RESULT_BYTES,
        capability_group=capability_group,
        required_scopes=required_scopes,
        data_domains=data_domains,
        side_effect=side_effect,
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
        ToolName.INSPECT_ACCOUNTING_CONTENT: _descriptor(
            ToolName.INSPECT_ACCOUNTING_CONTENT,
            "accounting_content_query.v1",
            "accounting_content_result.v1",
            deterministic=True,
            capability_group="finance.accounting",
            required_scopes=frozenset({"finance.read"}),
            data_domains=frozenset({"finance.accounting"}),
        ),
        ToolName.GENERATE_ACCOUNTING_WORKBOOK: _descriptor(
            ToolName.GENERATE_ACCOUNTING_WORKBOOK,
            "accounting_workbook_request.v1",
            "accounting_workbook_result.v1",
            deterministic=True,
            read_only=False,
            risk_level="controlled_artifact",
            capability_group="finance.accounting",
            required_scopes=frozenset({"artifact.generate"}),
            data_domains=frozenset({"finance.accounting"}),
            side_effect=ToolSideEffect.ARTIFACT,
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
    ToolName.INSPECT_ACCOUNTING_CONTENT: ("inspect_content",),
    ToolName.GENERATE_ACCOUNTING_WORKBOOK: ("generate_workbook",),
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


def tool_catalog_snapshot(
    health: Mapping[ToolName, ToolHealth],
) -> Mapping[ToolName, ToolDescriptor]:
    return apply_tool_health(TOOL_DESCRIPTORS, health)


def _validate_descriptor_safety(descriptor: ToolDescriptor) -> None:
    if (
        descriptor.max_tool_calls > SYSTEM_MAX_TOOL_CALLS
        or descriptor.max_tool_rounds > SYSTEM_MAX_TOOL_ROUNDS
        or descriptor.max_result_rows > SYSTEM_MAX_RESULT_ROWS
        or descriptor.max_result_bytes > SYSTEM_MAX_RESULT_BYTES
    ):
        raise ValueError("unsafe_tool_descriptor")
    if descriptor.side_effect is ToolSideEffect.READ and not descriptor.read_only:
        raise ValueError("unsafe_tool_descriptor")
    if descriptor.side_effect is ToolSideEffect.ARTIFACT and descriptor.read_only:
        raise ValueError("unsafe_tool_descriptor")
    if descriptor.side_effect not in {ToolSideEffect.READ, ToolSideEffect.ARTIFACT}:
        raise ValueError("unsafe_tool_descriptor")


def validate_bureau_tool_registry() -> None:
    expected_tools = frozenset(ToolName)
    if set(TOOL_DESCRIPTORS) != expected_tools:
        raise ValueError("invalid_tool_descriptor_inventory")
    descriptors = tuple(TOOL_DESCRIPTORS.values())
    if len({item.descriptor_id for item in descriptors}) != len(descriptors):
        raise ValueError("duplicate_tool_descriptor_id")
    if any(item.tool_name is not name for name, item in TOOL_DESCRIPTORS.items()):
        raise ValueError("invalid_tool_descriptor_binding")
    for name, descriptor in TOOL_DESCRIPTORS.items():
        (
            expected_input,
            expected_output,
            expected_deterministic,
            expected_capability_group,
            expected_required_scopes,
            expected_data_domains,
            expected_side_effect,
            expected_read_only,
        ) = _EXPECTED_DESCRIPTOR_CONTRACTS[name]
        if (
            descriptor.descriptor_id != _EXPECTED_DESCRIPTOR_IDS[name]
            or descriptor.handler_id != f"bureau-handler.{name.value}.v1"
            or
            descriptor.version != "1.0.0"
            or descriptor.input_schema_id != expected_input
            or descriptor.output_schema_id != expected_output
            or descriptor.deterministic is not expected_deterministic
            or descriptor.capability_group != expected_capability_group
            or descriptor.required_scopes != expected_required_scopes
            or descriptor.data_domains != expected_data_domains
            or descriptor.side_effect is not expected_side_effect
            or descriptor.read_only is not expected_read_only
        ):
            raise ValueError("invalid_tool_descriptor_contract")
    for descriptor in descriptors:
        _validate_descriptor_safety(descriptor)
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
