import json
import logging
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import RLock
from time import monotonic_ns
from typing import TypeVar

from pydantic import BaseModel

from app.agents.runtime_skills.models import (
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

StructuredModelAdapter = Callable[[list[object]], str]
AuditSink = Callable[[SkillAuditRecord], None]
RuntimeSkillReport = BureauReport | MinistryReport | CouncilReport
OperationResult = TypeVar("OperationResult")
_RUNTIME_SKILL_AUDITS: deque[SkillAuditRecord] = deque(maxlen=4096)
_RUNTIME_SKILL_AUDIT_LOCK = RLock()
_AUDIT_LOGGER = logging.getLogger("chaotang.runtime_skills.audit")


def record_runtime_skill_audit(audit: SkillAuditRecord) -> None:
    """Persist the bounded audit projection in the process audit buffer."""

    with _RUNTIME_SKILL_AUDIT_LOCK:
        _RUNTIME_SKILL_AUDITS.append(audit)
    _AUDIT_LOGGER.info(audit.model_dump_json())


def runtime_skill_audit_snapshot() -> tuple[SkillAuditRecord, ...]:
    with _RUNTIME_SKILL_AUDIT_LOCK:
        return tuple(_RUNTIME_SKILL_AUDITS)


def clear_runtime_skill_audits() -> None:
    with _RUNTIME_SKILL_AUDIT_LOCK:
        _RUNTIME_SKILL_AUDITS.clear()


class RuntimeSkillExecutionError(ValueError):
    """A stable, redacted runtime-skill execution error."""

    def __init__(self, code: str, audit: SkillAuditRecord) -> None:
        super().__init__(code)
        self.audit = audit


class SkillExecutionResult(BaseModel):
    """The validated report and its bounded audit projection."""

    report: RuntimeSkillReport
    audit: SkillAuditRecord


@dataclass(frozen=True)
class _PreparedContext:
    input_refs: tuple[str, ...]
    evidence_refs: tuple[str, ...]
    requirement_data_refs: dict[str, tuple[str, ...]]
    missing_required_data: tuple[str, ...]


def _require_binding(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
) -> None:
    if (
        invocation.agent_id != skill.agent_id
        or invocation.skill_id != skill.skill_id
        or invocation.skill_version != skill.version
    ):
        raise ValueError("agent_skill_mismatch")


def _runtime_skill_contract_is_valid(skill: RuntimeSkillDefinition) -> bool:
    expected = {
        "bureau": BureauReport,
        "ministry": MinistryReport,
        "council": CouncilReport,
    }.get(skill.layer.value)
    return skill.report_type is expected


def _require_allowed_services(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    services: Mapping[RuntimeService, object],
) -> None:
    supplied = frozenset(services)
    if not supplied <= skill.allowed_services:
        raise ValueError("service_not_allowed")
    if not invocation.requested_services <= skill.allowed_services:
        raise ValueError("service_not_allowed")
    if not invocation.requested_services <= supplied:
        raise ValueError("service_unavailable")


def _prepare_minimal_context(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
) -> _PreparedContext:
    approved_refs = frozenset((*invocation.input_refs, *invocation.evidence_refs))
    candidate_coverage = {
        requirement: tuple(
            ref
            for ref in invocation.requirement_data_refs.get(requirement, ())
            if ref in approved_refs
        )
        for requirement in skill.data_requirements
    }
    ref_use_count: dict[str, int] = {}
    for refs in candidate_coverage.values():
        for ref in set(refs):
            ref_use_count[ref] = ref_use_count.get(ref, 0) + 1
    coverage = {
        requirement: tuple(ref for ref in refs if ref_use_count[ref] == 1)
        for requirement, refs in candidate_coverage.items()
    }
    missing = tuple(
        requirement for requirement in skill.data_requirements if not coverage[requirement]
    )
    return _PreparedContext(
        input_refs=invocation.input_refs,
        evidence_refs=invocation.evidence_refs,
        requirement_data_refs=coverage,
        missing_required_data=missing,
    )


def _build_messages(
    prepared: _PreparedContext,
    skill: RuntimeSkillDefinition,
) -> list[object]:
    return [
        {
            "skill_id": skill.skill_id,
            "skill_version": skill.version,
            "agent_id": skill.agent_id,
            "purpose": skill.purpose,
            "responsibility_scope": skill.responsibility_scope,
            "data_requirements": skill.data_requirements,
            "analysis_procedure": skill.analysis_procedure,
            "required_findings": skill.required_findings,
            "forbidden_actions": skill.forbidden_actions,
            "input_refs": prepared.input_refs,
            "evidence_refs": prepared.evidence_refs,
            "requirement_data_refs": prepared.requirement_data_refs,
        }
    ]


def _degraded_report(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    data_gaps: tuple[str, ...],
) -> RuntimeSkillReport:
    common: dict[str, object] = {
        "report_id": f"{invocation.request_id}:{skill.skill_id}:degraded",
        "request_id": invocation.request_id,
        "parent_report_id": invocation.parent_report_id,
        "agent_id": skill.agent_id,
        "skill_id": skill.skill_id,
        "skill_version": skill.version,
        "subject": skill.purpose,
        "executive_summary": "required professional data is unavailable",
        "input_refs": invocation.input_refs,
        "evidence_refs": invocation.evidence_refs,
        "data_gaps": data_gaps,
        "evidence_sufficiency": (
            EvidenceSufficiency.INSUFFICIENT
            if len(data_gaps) == len(skill.data_requirements)
            else EvidenceSufficiency.PARTIAL
        ),
        "status": ReportStatus.DEGRADED,
    }
    if skill.report_type is BureauReport:
        return BureauReport(
            **common,
            analysis=(),
            professional_findings=(),
            risks=(),
            recommendations=tuple(
                f"provide approved data for: {requirement}" for requirement in data_gaps
            ),
        )
    if skill.report_type is MinistryReport:
        return MinistryReport(
            **common,
            selected_bureaus=(),
            selection_reasons=(),
            bureau_report_refs=(),
            shared_findings=(),
            conflicts=(),
            cross_bureau_impacts=(),
            ministry_position=(),
            unresolved_items=data_gaps,
        )
    if skill.report_type is CouncilReport:
        return CouncilReport(
            **common,
            participating_ministries=(),
            review_order=(),
            ministry_report_refs=(),
            consensus=(),
            disagreements=(),
            cross_ministry_dependencies=(),
            joint_options=(),
            matters_for_chancellor_decision=data_gaps,
        )
    raise ValueError("skill_report_invalid")


def _audit(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    report: RuntimeSkillReport,
    started_ns: int,
) -> SkillAuditRecord:
    return SkillAuditRecord(
        request_id=invocation.request_id,
        parent_report_id=invocation.parent_report_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=invocation.input_refs,
        evidence_refs=invocation.evidence_refs,
        allowed_services=invocation.requested_services,
        status=report.status,
        failure_code=None,
        duration_ms=max(0, (monotonic_ns() - started_ns) // 1_000_000),
    )


def _failure_audit(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    code: str,
    started_ns: int,
) -> SkillAuditRecord:
    return SkillAuditRecord(
        request_id=invocation.request_id,
        parent_report_id=invocation.parent_report_id,
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        input_refs=invocation.input_refs,
        evidence_refs=invocation.evidence_refs,
        allowed_services=invocation.requested_services & skill.allowed_services,
        status=ReportStatus.FAILED,
        failure_code=code,
        duration_ms=max(0, (monotonic_ns() - started_ns) // 1_000_000),
    )


def _publish_audit(audit: SkillAuditRecord, audit_sink: AuditSink | None) -> None:
    if audit_sink is None:
        return
    try:
        audit_sink(audit)
    except Exception:
        return


def _raise_failure(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    code: str,
    started_ns: int,
    audit_sink: AuditSink | None,
) -> None:
    audit = _failure_audit(invocation, skill, code, started_ns)
    _publish_audit(audit, audit_sink)
    raise RuntimeSkillExecutionError(code, audit) from None


def run_authorized_runtime_operation(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    services: Mapping[RuntimeService, object],
    operation: Callable[[], OperationResult],
    *,
    audit_sink: AuditSink | None = None,
) -> OperationResult:
    """Authorize a production operation before it can perform any side effect."""

    sink = audit_sink or record_runtime_skill_audit
    started_ns = monotonic_ns()
    try:
        _require_binding(invocation, skill)
    except ValueError:
        _raise_failure(invocation, skill, "agent_skill_mismatch", started_ns, sink)
    if not _runtime_skill_contract_is_valid(skill):
        _raise_failure(invocation, skill, "skill_report_invalid", started_ns, sink)
    try:
        _require_allowed_services(invocation, skill, services)
    except ValueError as exc:
        code = (
            "service_unavailable" if exc.args == ("service_unavailable",) else "service_not_allowed"
        )
        _raise_failure(invocation, skill, code, started_ns, sink)
    try:
        return operation()
    except Exception:
        _publish_audit(
            _failure_audit(invocation, skill, "skill_execution_failed", started_ns),
            sink,
        )
        raise


def _parse_report(
    raw: str,
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
) -> RuntimeSkillReport:
    values = json.loads(raw)
    if not isinstance(values, dict):
        raise ValueError("skill_report_invalid")
    values.update(
        {
            "report_id": f"{invocation.request_id}:{skill.skill_id}",
            "request_id": invocation.request_id,
            "parent_report_id": invocation.parent_report_id,
            "agent_id": skill.agent_id,
            "skill_id": skill.skill_id,
            "skill_version": skill.version,
            "input_refs": invocation.input_refs,
            "evidence_refs": invocation.evidence_refs,
            "created_at": datetime.now(UTC),
        }
    )
    report = skill.report_type.model_validate(values)
    if not isinstance(report, (BureauReport, MinistryReport, CouncilReport)):
        raise ValueError("skill_report_invalid")
    return report


def execute_runtime_skill(
    invocation: SkillInvocation,
    skill: RuntimeSkillDefinition,
    services: Mapping[RuntimeService, object],
    model: StructuredModelAdapter,
    *,
    audit_sink: AuditSink | None = None,
    precomputed_report: RuntimeSkillReport | None = None,
) -> SkillExecutionResult:
    """Execute one bound skill without exposing privileged runtime objects."""

    if audit_sink is None:
        audit_sink = record_runtime_skill_audit
    started_ns = monotonic_ns()
    failure_code: str | None = None
    try:
        _require_binding(invocation, skill)
    except ValueError:
        failure_code = "agent_skill_mismatch"
    if failure_code is not None:
        _raise_failure(invocation, skill, failure_code, started_ns, audit_sink)

    if not _runtime_skill_contract_is_valid(skill):
        _raise_failure(invocation, skill, "skill_report_invalid", started_ns, audit_sink)

    try:
        _require_allowed_services(invocation, skill, services)
    except ValueError as exc:
        failure_code = (
            "service_unavailable" if exc.args == ("service_unavailable",) else "service_not_allowed"
        )
    if failure_code is not None:
        _raise_failure(invocation, skill, failure_code, started_ns, audit_sink)

    prepared: _PreparedContext | None = None
    try:
        prepared = _prepare_minimal_context(invocation, skill)
    except Exception:
        failure_code = "skill_execution_failed"
    if failure_code is not None or prepared is None:
        _raise_failure(
            invocation,
            skill,
            failure_code or "skill_execution_failed",
            started_ns,
            audit_sink,
        )

    if prepared.missing_required_data and precomputed_report is None:
        result: SkillExecutionResult | None = None
        try:
            report = _degraded_report(invocation, skill, prepared.missing_required_data)
            result = SkillExecutionResult(
                report=report,
                audit=_audit(invocation, skill, report, started_ns),
            )
        except Exception:
            failure_code = "skill_execution_failed"
        if failure_code is not None or result is None:
            _raise_failure(
                invocation,
                skill,
                failure_code or "skill_execution_failed",
                started_ns,
                audit_sink,
            )
        _publish_audit(result.audit, audit_sink)
        return result

    report: RuntimeSkillReport | None = None
    try:
        if precomputed_report is None:
            raw = model(_build_messages(prepared, skill))
        else:
            values = precomputed_report.model_dump(mode="json")
            if prepared.missing_required_data:
                values["status"] = ReportStatus.DEGRADED.value
                values["evidence_sufficiency"] = (
                    EvidenceSufficiency.INSUFFICIENT.value
                    if len(prepared.missing_required_data) == len(skill.data_requirements)
                    else EvidenceSufficiency.PARTIAL.value
                )
                values["data_gaps"] = list(
                    dict.fromkeys((*values.get("data_gaps", ()), *prepared.missing_required_data))
                )
            raw = json.dumps(values)
        report = _parse_report(raw, invocation, skill)
    except Exception:
        failure_code = "skill_report_invalid"
    if failure_code is not None or report is None:
        _raise_failure(
            invocation,
            skill,
            failure_code or "skill_report_invalid",
            started_ns,
            audit_sink,
        )

    result = None
    try:
        result = SkillExecutionResult(
            report=report,
            audit=_audit(invocation, skill, report, started_ns),
        )
    except Exception:
        failure_code = "skill_execution_failed"
    if failure_code is not None or result is None:
        _raise_failure(
            invocation,
            skill,
            failure_code or "skill_execution_failed",
            started_ns,
            audit_sink,
        )
    _publish_audit(result.audit, audit_sink)
    return result
