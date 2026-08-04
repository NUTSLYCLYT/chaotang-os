"""Frozen source contract for one explicitly declared bureau Runtime Skill."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.agents.runtime_skills.tool_models import ToolName

_SEMANTIC_VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def _valid_text_tuple(value: object, *, length: int | None = None) -> bool:
    return (
        isinstance(value, tuple)
        and (length is None or len(value) == length)
        and bool(value)
        and all(isinstance(item, str) and bool(item.strip()) for item in value)
    )


@dataclass(frozen=True)
class BureauMethod:
    """Complete immutable professional method owned by one bureau Skill."""

    data_requirements: tuple[str, str]
    analysis_procedure: tuple[str, str, str]
    required_findings: tuple[str, str]
    forbidden_actions: tuple[str, str]

    def __post_init__(self) -> None:
        if not all(
            (
                _valid_text_tuple(self.data_requirements, length=2),
                _valid_text_tuple(self.analysis_procedure, length=3),
                _valid_text_tuple(self.required_findings, length=2),
                _valid_text_tuple(self.forbidden_actions, length=2),
            )
        ):
            raise ValueError("invalid_bureau_method")


@dataclass(frozen=True)
class BureauToolPolicySpec:
    """Complete immutable source Tool Policy for one bureau Skill."""

    policy_id: str
    version: str
    agent_id: str
    allowed_tools: tuple[ToolName, ...]
    allowed_data_domains: tuple[str, ...]
    tool_operations: tuple[tuple[ToolName, tuple[str, ...]], ...]
    tool_argument_constraints: tuple[
        tuple[ToolName, tuple[tuple[str, object], ...]], ...
    ]
    required_data_refs: tuple[str, ...]
    max_tool_calls: int
    max_tool_rounds: int
    max_result_rows: int
    max_result_bytes: int

    def __post_init__(self) -> None:
        if any(
            not isinstance(value, str) or not value.strip()
            for value in (self.policy_id, self.agent_id)
        ):
            raise ValueError("invalid_bureau_tool_policy_identity")
        if not isinstance(self.version, str) or _SEMANTIC_VERSION.fullmatch(
            self.version
        ) is None:
            raise ValueError("invalid_bureau_tool_policy_version")
        if (
            not isinstance(self.allowed_tools, tuple)
            or not self.allowed_tools
            or any(not isinstance(tool, ToolName) for tool in self.allowed_tools)
            or len(set(self.allowed_tools)) != len(self.allowed_tools)
        ):
            raise ValueError("invalid_bureau_tool_policy_tools")
        if not _valid_text_tuple(self.allowed_data_domains):
            raise ValueError("invalid_bureau_tool_policy_domains")
        operation_tools: list[ToolName] = []
        if not isinstance(self.tool_operations, tuple):
            raise ValueError("invalid_bureau_tool_policy_operations")
        for declaration in self.tool_operations:
            if (
                not isinstance(declaration, tuple)
                or len(declaration) != 2
                or not isinstance(declaration[0], ToolName)
                or not _valid_text_tuple(declaration[1])
            ):
                raise ValueError("invalid_bureau_tool_policy_operations")
            operation_tools.append(declaration[0])
        if tuple(operation_tools) != self.allowed_tools:
            raise ValueError("invalid_bureau_tool_policy_operations")
        constraint_tools: list[ToolName] = []
        if not isinstance(self.tool_argument_constraints, tuple):
            raise ValueError("invalid_bureau_tool_policy_constraints")
        for declaration in self.tool_argument_constraints:
            if (
                not isinstance(declaration, tuple)
                or len(declaration) != 2
                or not isinstance(declaration[0], ToolName)
                or not isinstance(declaration[1], tuple)
                or not declaration[1]
                or any(
                    not isinstance(item, tuple)
                    or len(item) != 2
                    or not isinstance(item[0], str)
                    or not item[0].strip()
                    for item in declaration[1]
                )
            ):
                raise ValueError("invalid_bureau_tool_policy_constraints")
            constraint_tools.append(declaration[0])
        if tuple(constraint_tools) != self.allowed_tools:
            raise ValueError("invalid_bureau_tool_policy_constraints")
        if not _valid_text_tuple(self.required_data_refs):
            raise ValueError("invalid_bureau_tool_policy_data_refs")
        budgets = (
            self.max_tool_calls,
            self.max_tool_rounds,
            self.max_result_rows,
            self.max_result_bytes,
        )
        if any(
            not isinstance(value, int) or isinstance(value, bool) or value <= 0
            for value in budgets
        ):
            raise ValueError("invalid_bureau_tool_policy_budget")


@dataclass(frozen=True)
class BureauRuntimeSkillSpec:
    """Bind every source-owned identity and behavior field without inference."""

    department: str
    bureau: str
    agent_id: str
    skill_id: str
    method: BureauMethod
    tool_policy: BureauToolPolicySpec

    def __post_init__(self) -> None:
        if any(
            not isinstance(value, str) or not value.strip()
            for value in (self.department, self.bureau, self.agent_id, self.skill_id)
        ):
            raise ValueError("bureau_skill_identity_must_be_nonblank")
        if not isinstance(self.method, BureauMethod):
            raise TypeError("invalid_bureau_method")
        if not isinstance(self.tool_policy, BureauToolPolicySpec):
            raise TypeError("invalid_bureau_tool_policy")
        if self.tool_policy.agent_id != self.agent_id:
            raise ValueError("tool_policy_agent_mismatch")

    @property
    def identity(self) -> tuple[str, str, str, str, str]:
        """Return the complete explicitly declared registration identity."""

        return (
            self.department,
            self.bureau,
            self.agent_id,
            self.skill_id,
            self.tool_policy.policy_id,
        )
