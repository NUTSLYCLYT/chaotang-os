from __future__ import annotations

from importlib import import_module
from typing import Any

from app.agents.runtime_skills.models import (
    AgentLayer,
    BureauReport,
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
    RuntimeService,
    RuntimeSkillDefinition,
    SkillAuditRecord,
    SkillInvocation,
)
from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    BureauToolPolicy,
    ToolAuditRecord,
    ToolAuthorizationContext,
    ToolBudget,
    ToolCallProposal,
    ToolCallStatus,
    ToolDataQuality,
    ToolDescriptor,
    ToolHandlerContext,
    ToolName,
    ToolResultEnvelope,
)

_LAZY_EXPORTS = {
    "ClaimEvidenceEvaluationV1": ("claim_evidence_gate", "ClaimEvidenceEvaluationV1"),
    "ClaimEvidenceGateError": ("claim_evidence_gate", "ClaimEvidenceGateError"),
    "TrustedEvidenceContextV1": ("claim_evidence_gate", "TrustedEvidenceContextV1"),
    "evaluate_claim_evidence_v1": ("claim_evidence_gate", "evaluate_claim_evidence_v1"),
    "parse_claim_evidence_candidate_v1": (
        "claim_evidence_gate",
        "parse_claim_evidence_candidate_v1",
    ),
    "AuditSink": ("executor", "AuditSink"),
    "RuntimeSkillExecutionError": ("executor", "RuntimeSkillExecutionError"),
    "RuntimeSkillReport": ("executor", "RuntimeSkillReport"),
    "SkillExecutionResult": ("executor", "SkillExecutionResult"),
    "execute_runtime_skill": ("executor", "execute_runtime_skill"),
    "ALL_DOWNSTREAM_SKILLS": ("registry", "ALL_DOWNSTREAM_SKILLS"),
    "DownstreamSkillRegistry": ("registry", "DownstreamSkillRegistry"),
    "DownstreamSkillRegistryError": ("registry", "DownstreamSkillRegistryError"),
    "build_default_downstream_skill_registry": (
        "registry", "build_default_downstream_skill_registry"
    ),
    "bureau_agent_id": ("registry", "bureau_agent_id"),
    "TOOL_DESCRIPTORS": ("tool_registry", "TOOL_DESCRIPTORS"),
    "bureau_tool_policy_for": ("tool_registry", "bureau_tool_policy_for"),
    "tool_descriptor_for": ("tool_registry", "tool_descriptor_for"),
    "validate_bureau_tool_registry": (
        "tool_registry", "validate_bureau_tool_registry"
    ),
    "ToolPolicyError": ("tool_policy", "ToolPolicyError"),
    "approve_tool_call": ("tool_policy", "approve_tool_call"),
    "ToolExecutionError": ("tool_executor", "ToolExecutionError"),
    "ToolHandler": ("tool_executor", "ToolHandler"),
    "ToolAuditSink": ("tool_executor", "ToolAuditSink"),
    "execute_approved_tool": ("tool_executor", "execute_approved_tool"),
    "record_tool_audit": ("tool_executor", "record_tool_audit"),
    "tool_audit_snapshot": ("tool_executor", "tool_audit_snapshot"),
    "clear_tool_audits": ("tool_executor", "clear_tool_audits"),
    "build_bureau_tool_handlers": ("tool_handlers", "build_bureau_tool_handlers"),
}


def __getattr__(name: str) -> Any:
    if name not in _LAZY_EXPORTS:
        raise AttributeError(name)
    module_name, attribute_name = _LAZY_EXPORTS[name]
    module = import_module(f"app.agents.runtime_skills.{module_name}")
    return getattr(module, attribute_name)


__all__ = [
    "AgentLayer", "ApprovedToolCall", "BureauReport", "BureauToolPolicy",
    "CouncilReport", "EvidenceSufficiency", "MinistryReport", "ReportStatus",
    "RuntimeService", "RuntimeSkillDefinition", "SkillAuditRecord", "SkillInvocation",
    "ToolAuditRecord", "ToolAuthorizationContext", "ToolBudget", "ToolCallProposal",
    "ToolCallStatus", "ToolDataQuality", "ToolDescriptor", "ToolHandlerContext",
    "ToolName", "ToolResultEnvelope", *_LAZY_EXPORTS,
]
