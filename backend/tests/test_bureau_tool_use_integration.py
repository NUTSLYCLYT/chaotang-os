"""Production-boundary integration tests for controlled bureau Tool Use."""

from __future__ import annotations

import hashlib
import json
import re
from types import SimpleNamespace

import pytest

from app.agents.bureaus import BUREAU_PROFILES, invoke_bureau_agent_with_report
from app.agents.evidence_protocol import AgentEvidenceSession
from app.agents.runtime_skills import ReportStatus
from app.agents.runtime_skills.registry import bureau_agent_id
from app.agents.runtime_skills.tool_executor import (
    clear_tool_audits,
    tool_audit_snapshot,
)
from app.agents.runtime_skills.tool_models import ToolCallStatus, ToolName
from app.agents.runtime_skills.tool_registry import bureau_tool_policy_for
from app.jinyiwei.models import (
    CacheMetadata,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    InvestigationPlan,
    SourceType,
)


@pytest.fixture(autouse=True)
def _isolated_tool_audits():
    clear_tool_audits()
    yield
    clear_tool_audits()


@pytest.mark.parametrize(
    ("department", "bureau"),
    [(profile.department, profile.bureau) for profile in BUREAU_PROFILES],
)
def test_all_authoritative_bureaus_accept_one_immediate_final_without_second_call(
    department: str,
    bureau: str,
) -> None:
    calls = 0

    def model(_messages):
        nonlocal calls
        calls += 1
        return {
            "status": "FINAL",
            "report": {
                "opinion": f"{department}{bureau}专业意见",
                "analysis": [],
                "professional_findings": [],
                "risks": [],
                "recommendations": [f"{department}{bureau}专业建议"],
                "out_of_scope_items": [],
            },
        }

    result = invoke_bureau_agent_with_report(
        department,
        bureau,
        "approved request",
        "approved route",
        model,
    )

    assert calls == 1
    assert result.opinion == f"{department}{bureau}专业意见"
    assert result.runtime_report.agent_id
    assert result.runtime_report.status is ReportStatus.DEGRADED
    assert tool_audit_snapshot() == ()


@pytest.mark.parametrize(
    ("department", "bureau"),
    [(profile.department, profile.bureau) for profile in BUREAU_PROFILES],
)
def test_all_authoritative_bureaus_execute_one_policy_valid_professional_proposal(
    department: str,
    bureau: str,
) -> None:
    agent_id = bureau_agent_id(department, bureau)
    policy = bureau_tool_policy_for(agent_id)
    constraints = policy.tool_argument_constraints[ToolName.READ_APPROVED_MATERIALS]
    domain = sorted(policy.allowed_data_domains)[0]
    field = constraints["allowed_fields"][0]
    calls = 0
    decree = f"authorized decree for {agent_id}"
    rationale = f"authorized rationale for {agent_id}"

    def model(messages):
        nonlocal calls
        calls += 1
        if calls == 1:
            marker = "approved_input_refs="
            user_text = messages[-1]["content"]
            start = user_text.index(marker) + len(marker)
            approved_ref = user_text[start:].splitlines()[0]
            return {
                "status": "TOOL_CALLS",
                "calls": [{
                    "tool_call_id": f"call-{agent_id}",
                    "tool_name": "read_approved_materials",
                    "purpose": "read approved professional material",
                    "arguments": {
                        "operation": "read_summary",
                        "domain": domain,
                        "input_refs": [approved_ref],
                        "fields": [field],
                        "estimated_rows": 1,
                        "estimated_bytes": 128,
                    },
                    "required_for": ["professional finding"],
                    "expected_result_schema": "approved_materials_result.v1",
                }],
            }
        tool_result = json.loads(messages[-1]["content"])
        rendered = json.dumps(tool_result, ensure_ascii=False)
        assert decree in rendered
        assert rationale in rendered
        assert '"approved"' not in rendered
        assert "1970-01-01" not in rendered
        return {
            "status": "FINAL",
            "report": {
                "opinion": f"{department}{bureau}基于获准材料形成意见",
                "analysis": [],
                "professional_findings": [],
                "risks": [],
                "recommendations": ["按专业边界继续复核"],
                "out_of_scope_items": [],
            },
        }

    result = invoke_bureau_agent_with_report(
        department,
        bureau,
        decree,
        rationale,
        model,
    )

    audits = tool_audit_snapshot()
    assert calls == 2
    assert len(audits) == 1
    assert audits[0].agent_id == agent_id
    assert audits[0].status is ToolCallStatus.SUCCEEDED, audits[0].reason_code
    assert audits[0].input_refs == result.runtime_report.input_refs
    assert result.runtime_report.audit_refs == (audits[0].audit_ref,)
    assert audits[0].tool_call_id == audits[0].audit_ref
    assert f"call-{agent_id}" not in audits[0].audit_ref
    assert result.runtime_report.agent_id == agent_id
    assert result.runtime_report.status in {ReportStatus.COMPLETED, ReportStatus.DEGRADED}
    assert "fallback" not in result.opinion.casefold()


def test_non_evidence_legacy_structured_envelope_remains_compatible() -> None:
    result = invoke_bureau_agent_with_report(
        "工部",
        "技术司",
        "approved request",
        "approved route",
        lambda _messages: json.dumps({"opinion": "legacy compatible"}),
    )

    assert result.opinion == "legacy compatible"
    assert tool_audit_snapshot() == ()


def test_immediate_final_cannot_promote_caller_claimed_refs_through_result_gate() -> None:
    from app.agents.runtime_skills import EvidenceSufficiency
    from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    forged = "approved-data:case:forged:decree:forged:ledger"
    result = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "approved request",
        "approved route",
        lambda _messages: {
            "status": "FINAL",
            "report": {
                "opinion": "bounded conclusion",
                "analysis": [],
                "professional_findings": [],
                "risks": [],
                "recommendations": ["obtain verified inputs"],
                "out_of_scope_items": [],
            },
        },
        approved_data_refs=(forged,),
        requirement_data_refs={
            requirement: (forged,) for requirement in skill.data_requirements
        },
    )

    assert forged not in result.runtime_report.input_refs
    assert forged not in result.runtime_report.evidence_refs
    assert result.runtime_report.data_gaps == skill.data_requirements
    assert result.runtime_report.evidence_sufficiency is EvidenceSufficiency.INSUFFICIENT


def test_agent_authorization_failure_precedes_handler_factory_and_all_effects(
    monkeypatch,
) -> None:
    import app.agents.runtime_skills.models as models_module
    import app.agents.runtime_skills.tool_handlers as handlers_module

    real_invocation = models_module.SkillInvocation
    real_factory = handlers_module.build_bureau_tool_handlers
    counters = {
        "handler_factory": 0,
        "model": 0,
        "evidence": 0,
        "report": 0,
        "accounting": 0,
    }

    def invalid_invocation(**kwargs):
        return real_invocation(**kwargs).model_copy(update={"agent_id": "invalid-agent"})

    def tracked_factory(**kwargs):
        counters["handler_factory"] += 1
        return real_factory(**kwargs)

    class AccessSpy:
        def __init__(self, counter: str) -> None:
            object.__setattr__(self, "counter", counter)

        def __getattribute__(self, name: str):
            if name in {"counter", "__class__", "__dict__"}:
                return object.__getattribute__(self, name)
            counters[object.__getattribute__(self, "counter")] += 1
            return object.__getattribute__(self, name)

    monkeypatch.setattr(models_module, "SkillInvocation", invalid_invocation)
    monkeypatch.setattr(handlers_module, "build_bureau_tool_handlers", tracked_factory)

    with pytest.raises(Exception, match="agent_skill_mismatch"):
        invoke_bureau_agent_with_report(
            "户部",
            "会计司",
            "生成财务报告",
            "approved route",
            lambda _messages: counters.__setitem__("model", counters["model"] + 1),
            evidence_session=AccessSpy("evidence"),
            report_session=AccessSpy("accounting"),
        )

    assert counters == {
        "handler_factory": 0,
        "model": 0,
        "evidence": 0,
        "report": 0,
        "accounting": 0,
    }


def test_executor_consumes_exact_restricted_handler_without_privileged_closure(
    monkeypatch,
) -> None:
    import app.agents.runtime_skills.tool_executor as executor_module
    import app.agents.runtime_skills.tool_loop as tool_loop_module

    real_execute = executor_module.execute_approved_tool
    identities: list[tuple[int, int]] = []

    def tracked_execute(call, context, handlers, *args, **kwargs):
        binding = next(item for item in handlers._bindings if item.tool_name is call.tool_name)
        before = id(binding.handler)
        result = real_execute(call, context, handlers, *args, **kwargs)
        after_binding = next(
            item for item in handlers._bindings if item.tool_name is call.tool_name
        )
        identities.append((before, id(after_binding.handler)))

        pending = [binding.handler]
        seen: set[int] = set()
        while pending:
            value = pending.pop()
            if id(value) in seen:
                continue
            seen.add(id(value))
            forbidden = type(value).__name__.casefold()
            assert not any(
                token in forbidden
                for token in ("evidencesession", "reportsession", "mcp", "credential")
            )
            closure = getattr(value, "__closure__", None) or ()
            pending.extend(cell.cell_contents for cell in closure)
        return result

    monkeypatch.setattr(tool_loop_module, "execute_approved_tool", tracked_execute)
    policy = bureau_tool_policy_for("gongbu-technology")
    field = policy.tool_argument_constraints[ToolName.READ_APPROVED_MATERIALS][
        "allowed_fields"
    ][0]
    domain = next(iter(policy.allowed_data_domains))
    turns = 0

    def model(messages):
        nonlocal turns
        turns += 1
        if turns == 1:
            ref = messages[-1]["content"].split("approved_input_refs=", 1)[1]
            return {"status": "TOOL_CALLS", "calls": [{
                "tool_call_id": "identity-call",
                "tool_name": "read_approved_materials",
                "purpose": "inspect authorized request",
                "arguments": {
                    "operation": "read_summary",
                    "domain": domain,
                    "input_refs": [ref],
                    "fields": [field],
                    "estimated_rows": 1,
                    "estimated_bytes": 128,
                },
                "required_for": ["technical finding"],
                "expected_result_schema": "approved_materials_result.v1",
            }]}
        return {"status": "FINAL", "report": {"opinion": "bounded",}}

    invoke_bureau_agent_with_report("工部", "技术司", "decree", "route", model)

    assert len(identities) == 1
    assert identities[0][0] == identities[0][1]


def test_real_approved_data_payload_reaches_inspect_and_compute_with_exact_audits() -> None:
    policy = bureau_tool_policy_for("hubu-accounting")
    domain = next(iter(policy.allowed_data_domains))
    inspect_constraints = policy.tool_argument_constraints[ToolName.INSPECT_APPROVED_DATA]
    compute_constraints = policy.tool_argument_constraints[ToolName.COMPUTE_ANALYSIS]
    turns = 0

    def model(messages):
        nonlocal turns
        turns += 1
        if turns == 1:
            ref = (
                messages[-1]["content"]
                .split("approved_data_refs=", 1)[1]
                .splitlines()[0]
                .split(",", 1)[0]
            )
            return {"status": "TOOL_CALLS", "calls": [
                {
                    "tool_call_id": "sk-private-inspect",
                    "tool_name": "inspect_approved_data",
                    "purpose": "inspect authorized ledger",
                    "arguments": {
                        "operation": policy.tool_operations[ToolName.INSPECT_APPROVED_DATA][0],
                        "domain": domain, "data_ref": ref,
                        "fields": [inspect_constraints["allowed_fields"][0]],
                        "operators": ["eq"],
                        "dimensions": [inspect_constraints["allowed_dimensions"][0]],
                        "metrics": [inspect_constraints["allowed_metrics"][0]],
                        "estimated_rows": 1, "estimated_bytes": 128,
                    },
                    "required_for": ["ledger finding"],
                    "expected_result_schema": "approved_data_result.v1",
                },
                {
                    "tool_call_id": "Bearer-private-compute",
                    "tool_name": "compute_analysis",
                    "purpose": "compute authorized ledger mean",
                    "arguments": {
                        "operation": "difference", "domain": domain, "data_refs": [ref],
                        "algorithm_id": "difference", "algorithm_version": "1.0.0",
                        "metrics": [compute_constraints["allowed_metrics"][0]],
                        "dimensions": [compute_constraints["allowed_dimensions"][0]],
                        "thresholds": [], "estimated_rows": 1, "estimated_bytes": 128,
                    },
                    "required_for": ["ledger analysis"],
                    "expected_result_schema": "analysis_result.v1",
                },
            ]}
        rendered = messages[-1]["content"]
        assert "17" in rendered and "23" in rendered
        assert "sk-private-inspect" not in rendered
        assert "Bearer-private-compute" not in rendered
        return {"status": "FINAL", "report": {"opinion": "data checked"}}

    result = invoke_bureau_agent_with_report(
        "户部", "会计司", "analyze ledger", "approved route", model,
        approved_data_inputs={
            "ledger": {
                "columns": [compute_constraints["allowed_metrics"][0]],
                "rows": [
                    {compute_constraints["allowed_metrics"][0]: 17},
                    {compute_constraints["allowed_metrics"][0]: 23},
                ],
                "values": [17, 23], "unit": "count",
            }
        },
    )

    assert len(result.runtime_report.audit_refs) == 2
    assert len(set(result.runtime_report.audit_refs)) == 2
    assert all(ref.startswith("tool-audit:") for ref in result.runtime_report.audit_refs)
    serialized_audits = json.dumps(
        [audit.model_dump(mode="json") for audit in tool_audit_snapshot()]
    )
    assert "sk-private-inspect" not in serialized_audits
    assert "Bearer-private-compute" not in serialized_audits
    assert "sk-private-inspect" not in str(result.runtime_report)
    assert "Bearer-private-compute" not in str(result.runtime_report)
    records_by_ref = {audit.audit_ref: audit for audit in tool_audit_snapshot()}
    assert all(ref in records_by_ref for ref in result.runtime_report.audit_refs)


def test_accounting_artifact_direct_generate_fails_without_inspect() -> None:
    policy = bureau_tool_policy_for("hubu-accounting")
    domain = next(iter(policy.allowed_data_domains))
    constraints = policy.tool_argument_constraints[
        ToolName.GENERATE_ACCOUNTING_WORKBOOK
    ]
    generated = 0

    class ReportSession:
        dataset = None
        run_id = "run-one"

        def maybe_generate(self, department, bureau, decree_text, *, decree_id=None):
            nonlocal generated
            generated += 1
            assert (department, bureau) == ("户部", "会计司")
            assert decree_id and decree_id.startswith("decree-")
            return SimpleNamespace(
                artifact_id="artifact-one",
                publication_readiness="inferred_draft",
            )

    turns = 0

    def model(messages):
        nonlocal turns
        turns += 1
        if turns == 1:
            ref = (
                messages[-1]["content"]
                .split("approved_data_refs=", 1)[1]
                .splitlines()[0]
                .split(",", 1)[0]
            )
            return {"status": "TOOL_CALLS", "calls": [{
                "tool_call_id": "generate-one",
                "tool_name": "generate_accounting_workbook",
                "purpose": "generate the authorized accounting artifact",
                "arguments": {
                    "operation": "generate_workbook",
                    "domain": domain,
                    "data_ref": ref,
                    "fields": [constraints["allowed_fields"][0]],
                    "estimated_rows": 1,
                    "estimated_bytes": 256,
                },
                "required_for": ["management workbook"],
                "expected_result_schema": "accounting_workbook_result.v1",
            }]}
        return {"status": "FINAL", "report": {"opinion": "draft disclosed"}}

    result = invoke_bureau_agent_with_report(
        "户部", "会计司", "生成2025年管理层综合财务报表", "approved route", model,
        report_session=ReportSession(),
        approved_data_inputs={
            "accounting": {
                "columns": ["amount"], "rows": [{"amount": 1}],
                "values": [1], "unit": "CNY",
            }
        },
    )

    assert generated == 0
    assert result.runtime_report.artifact_manifest == ()


def test_accounting_artifact_requires_inspect_then_generate() -> None:
    from tests.test_bureau_tool_handlers import _accounting_payload

    policy = bureau_tool_policy_for("hubu-accounting")
    domain = next(iter(policy.allowed_data_domains))
    generated = 0

    class ReportSession:
        dataset = None
        run_id = "run-inspected"

        def inspect_accounting_content(self, **_kwargs):
            return _accounting_payload("closing balance")

        def maybe_generate(self, *_args, **_kwargs):
            nonlocal generated
            generated += 1
            return SimpleNamespace(
                artifact_id="artifact-inspected",
                publication_readiness="verified",
            )

    turn = 0

    def model(messages):
        nonlocal turn
        turn += 1
        refs = messages[1]["content"].split("approved_data_refs=", 1)[1]
        refs = refs.splitlines()[0].split(",")
        if turn > 1:
            return {"status": "FINAL", "report": {
                "opinion": "verified", "analysis": [],
                "professional_findings": [], "risks": [],
                "recommendations": ["review workbook"],
                "out_of_scope_items": [],
            }}
        source_ref = next(item for item in refs if item.endswith("accounting-source-root"))
        content_ref = next(item for item in refs if ":accounting-content-" in item)
        def call(call_id, tool, operation, schema, ref):
            return {
                "tool_call_id": call_id, "tool_name": tool,
                "purpose": "authorized accounting workflow",
                "arguments": {
                    "operation": operation, "domain": domain, "data_ref": ref,
                    "fields": ["finance.accounting.ledger_ref"],
                    "estimated_rows": 1, "estimated_bytes": 256,
                },
                "required_for": ["management workbook"],
                "expected_result_schema": schema,
            }
        return {"status": "TOOL_CALLS", "calls": [
            call("accounting-inspect", "inspect_accounting_content", "inspect_content",
                 "accounting_content_result.v1", source_ref),
            call("accounting-generate", "generate_accounting_workbook", "generate_workbook",
                 "accounting_workbook_result.v1", content_ref),
        ]}

    try:
        result = invoke_bureau_agent_with_report(
            "户部", "会计司", "生成2025年管理层综合财务报表", "approved route",
            model, report_session=ReportSession(),
        )
    except Exception as error:
        pytest.fail(f"unexpected boundary failure: {error.__cause__!r}")

    assert generated == 1, [
        (item.tool_name.value, item.status.value, item.reason_code)
        for item in tool_audit_snapshot()
    ]
    assert len(result.runtime_report.audit_refs) == 2
    assert result.runtime_report.artifact_manifest[0].artifact_id == "artifact-inspected"


@pytest.mark.parametrize(
    ("failure_code", "failure_factory"),
    [
        ("format_unrecognized", lambda: ValueError("format_unrecognized")),
        ("tool_unavailable", lambda: ValueError("tool_unavailable")),
        ("source_not_found", FileNotFoundError),
    ],
)
def test_accounting_required_inspect_failure_is_typed_and_not_degraded_success(
    failure_code: str, failure_factory,
) -> None:
    from app.agents.runtime_skills.tool_failures import AccountingToolChainError

    policy = bureau_tool_policy_for("hubu-accounting")
    domain = next(iter(policy.allowed_data_domains))

    class ReportSession:
        dataset = None
        run_id = f"run-{failure_code}"

        def inspect_accounting_content(self, **_kwargs):
            raise failure_factory()

    turns = 0

    def model(messages):
        nonlocal turns
        turns += 1
        refs = messages[1]["content"].split("approved_data_refs=", 1)[1]
        source_ref = next(
            item for item in refs.splitlines()[0].split(",")
            if item.endswith("accounting-source-root")
        )
        return {"status": "TOOL_CALLS", "calls": [{
            "tool_call_id": f"inspect-{turns}",
            "tool_name": "inspect_accounting_content",
            "purpose": "inspect required accounting content",
            "arguments": {
                "operation": "inspect_content", "domain": domain,
                "data_ref": source_ref,
                "fields": ["finance.accounting.ledger_ref"],
                "estimated_rows": 1, "estimated_bytes": 256,
            },
            "required_for": ["management workbook"],
            "expected_result_schema": "accounting_content_result.v1",
        }]}

    with pytest.raises(AccountingToolChainError) as raised:
        invoke_bureau_agent_with_report(
            "户部", "会计司", "生成2025年管理层综合财务报表", "approved route",
            model, report_session=ReportSession(),
        )

    assert raised.value.code == failure_code
    assert str(raised.value) == failure_code
    from app.agents.chancellor.graph import ChancellorGraphInvocationError
    from app.decree_jobs import executor as executor_module
    from app.decree_jobs.worker import PermanentJobError

    graph = ChancellorGraphInvocationError("sanitized")
    graph.failure_stage = "bureau"
    graph.__cause__ = raised.value
    with pytest.raises(PermanentJobError, match=failure_code) as job_failure:
        executor_module._raise_provider_failure(graph)
    assert job_failure.value.stage == "bureau_tool"


@pytest.mark.parametrize(
    ("department", "bureau", "report_session"),
    [
        ("户部", "会计司", SimpleNamespace(dataset=None, run_id="early-accounting")),
        ("吏部", "任免司", None),
    ],
)
def test_early_approved_data_error_keeps_sanitized_bureau_contract(
    department: str, bureau: str, report_session,
) -> None:
    from app.agents.bureaus import BureauAgentInvocationError

    with pytest.raises(BureauAgentInvocationError) as raised:
        invoke_bureau_agent_with_report(
            department, bureau, "approved decree", "approved route",
            lambda _messages: {"status": "FINAL", "report": {"opinion": "unused"}},
            report_session=report_session,
            approved_data_inputs={"bad:key": {}},
        )

    assert type(raised.value) is BureauAgentInvocationError
    assert str(raised.value) == "Bureau structured response failed."
    assert isinstance(raised.value.__cause__, ValueError)


@pytest.mark.parametrize(
    "invalid_ref_kind",
    ("source-root", "cross-run", "cross-case", "forged", "ordinary"),
)
def test_accounting_artifact_rejects_unbound_generate_refs(
    invalid_ref_kind: str,
) -> None:
    from tests.test_bureau_tool_handlers import _accounting_payload

    policy = bureau_tool_policy_for("hubu-accounting")
    domain = next(iter(policy.allowed_data_domains))
    generated = 0

    class ReportSession:
        dataset = None
        run_id = "run-boundary"

        def inspect_accounting_content(self, **_kwargs):
            return _accounting_payload("closing balance")

        def maybe_generate(self, *_args, **_kwargs):
            nonlocal generated
            generated += 1
            return SimpleNamespace(
                artifact_id="artifact-forbidden",
                publication_readiness="verified",
            )

    turns = 0

    def model(messages):
        nonlocal turns
        turns += 1
        refs = messages[1]["content"].split("approved_data_refs=", 1)[1]
        refs = refs.splitlines()[0].split(",")
        source_ref = next(item for item in refs if item.endswith("accounting-source-root"))
        content_ref = next(item for item in refs if ":accounting-content-" in item)
        if invalid_ref_kind == "source-root":
            invalid_ref = source_ref
        elif invalid_ref_kind == "cross-run":
            invalid_ref = content_ref.replace("run-boundary", "run-other")
        elif invalid_ref_kind == "cross-case":
            invalid_ref = content_ref.replace("case:", "case:other-")
        elif invalid_ref_kind == "forged":
            invalid_ref = f"{content_ref}-forged"
        else:
            invalid_ref = "approved-data:accounting-content"
        if turns > 1:
            return {"status": "FINAL", "report": {"opinion": "generation rejected"}}

        def call(call_id, tool, operation, schema, ref):
            return {
                "tool_call_id": call_id,
                "tool_name": tool,
                "purpose": "exercise accounting authorization boundary",
                "arguments": {
                    "operation": operation,
                    "domain": domain,
                    "data_ref": ref,
                    "fields": ["finance.accounting.ledger_ref"],
                    "estimated_rows": 1,
                    "estimated_bytes": 256,
                },
                "required_for": ["management workbook"],
                "expected_result_schema": schema,
            }

        return {"status": "TOOL_CALLS", "calls": [
            call(
                "accounting-inspect",
                "inspect_accounting_content",
                "inspect_content",
                "accounting_content_result.v1",
                source_ref,
            ),
            call(
                "accounting-generate",
                "generate_accounting_workbook",
                "generate_workbook",
                "accounting_workbook_result.v1",
                invalid_ref,
            ),
        ]}

    result = invoke_bureau_agent_with_report(
        "户部",
        "会计司",
        "生成2025年管理层综合财务报表",
        "approved route",
        model,
        report_session=ReportSession(),
    )

    assert generated == 0
    assert result.runtime_report.artifact_manifest == ()


def test_evidence_ready_still_enters_the_shared_bureau_tool_loop(monkeypatch) -> None:
    import app.agents.runtime_skills.tool_loop as loop_module

    real_loop = loop_module.run_bureau_tool_loop
    calls = 0

    def tracked_loop(*args, **kwargs):
        nonlocal calls
        calls += 1
        return real_loop(*args, **kwargs)

    monkeypatch.setattr(loop_module, "run_bureau_tool_loop", tracked_loop)
    profile = BUREAU_PROFILES[0]
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())
    ready = {
        "status": "READY",
        "result": {
            "opinion": "continue processing",
            "factual_claims": [{
                "claim": "continue processing",
                "basis": "NORMATIVE",
                "evidence_ids": [],
                "fact_key": None,
                "category": None,
                "subject": None,
            }],
        },
        "adopted_evidence_ids": [],
        "fact_basis": "NOT_REQUIRED",
    }

    result = invoke_bureau_agent_with_report(
        profile.department,
        profile.bureau,
        "decree",
        "route",
        lambda _messages: json.dumps(ready),
        evidence_session=session,
    )

    assert result.opinion == "continue processing"
    assert calls == 1
    assert session.snapshot().used is False


def test_legacy_needs_data_uses_signed_request_evidence_and_explicit_adoption() -> None:
    class Coordinator:
        calls = 0

        def investigate(self, request, **_kwargs):
            self.calls += 1
            fact_key = request.required_facts[0].key
            item = EvidenceItem(
                evidence_id="e-1", fact_key=fact_key, value=100, unit="count",
                as_of="2026-08-04T00:00:00Z", retrieved_at="2026-08-04T00:00:01Z",
                source_url="internal://archive/e-1", publisher="archive",
                source_type=SourceType.SHIGUAN, quality=EvidenceQuality.PRIMARY,
                stance=EvidenceStance.SUPPORTS, excerpt="verified 100",
                content_hash=hashlib.sha256(b"e-1").hexdigest(), confidence=0.9,
            )
            return EvidencePack(
                pack_id="pack-1", investigation_id="investigation-1",
                status=EvidencePackStatus.RESOLVED, request=request,
                investigation_plan=InvestigationPlan(
                    fact_keys=(fact_key,), source_scope=request.source_scope,
                ),
                evidence_by_fact={fact_key: (item,)},
                historical_evidence_by_fact={}, resolved_facts=(fact_key,),
                unresolved_facts=(), conflicts=(), source_attempts=(),
                investigation_started_at="2026-08-04T00:00:00Z",
                investigation_completed_at="2026-08-04T00:00:01Z",
                cache=CacheMetadata(hit=False), do_not_infer=(),
            )

    coordinator = Coordinator()
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=coordinator)
    node = "bureau:吏部:制度司"
    turns = 0

    def model(messages):
        nonlocal turns
        turns += 1
        if turns == 1:
            return json.dumps({
                "status": "NEEDS_DATA",
                "data_gap": {
                    "requesting_agent": node,
                    "question": "What is the verified policy count?",
                    "required_facts": [{
                        "key": "policy_count", "description": "verified policy count",
                        "category": "PUBLIC_STATISTIC",
                        "data_scope": "EXTERNAL_PUBLIC", "subject": "policy corpus",
                        "jurisdiction": None, "expected_unit": "count",
                        "expected_shape": "number", "market_metric": None,
                    }],
                    "decision_context": "support policy recommendation",
                    "freshness": {"max_age_seconds": 3600},
                    "existing_evidence_ids": [],
                },
            })
        match = re.search(r"evidence:case:[^\"\\]+:e-1", messages[-1]["content"])
        assert match is not None
        evidence_ref = match.group(0)
        return json.dumps({
            "status": "READY",
            "result": {
                "opinion": "verified policy count is 100",
                "factual_claims": [{
                    "claim": "verified policy count is 100", "basis": "CITED",
                    "evidence_ids": [evidence_ref], "fact_key": "policy_count",
                    "category": "PUBLIC_STATISTIC", "subject": "policy corpus",
                }],
            },
            "adopted_evidence_ids": [evidence_ref], "fact_basis": "CITED",
        })

    result = invoke_bureau_agent_with_report(
        "吏部", "制度司", "verify policy count", "route", model,
        evidence_session=session,
    )

    assert result.opinion == "verified policy count is 100"
    assert coordinator.calls == 1
    assert session.snapshot().bureau_selections == ((node, ("e-1",)),)
    assert result.runtime_report.audit_refs[0].startswith("tool-audit:")
    assert "request-evidence-" not in result.runtime_report.audit_refs[0]


def test_investment_fact_plan_uses_the_same_signed_tool_loop_without_model_call() -> None:
    class QuoteCoordinator:
        calls = 0

        def investigate(self, request, **_kwargs):
            self.calls += 1
            fact = request.required_facts[0]
            item = EvidenceItem(
                evidence_id="quote-1", fact_key=fact.key, value=12.34, unit="CNY",
                as_of="2026-08-04T00:00:00Z", retrieved_at="2026-08-04T00:00:01Z",
                source_url="internal://quote/1", publisher="market archive",
                source_type=SourceType.SHIGUAN, quality=EvidenceQuality.PRIMARY,
                stance=EvidenceStance.SUPPORTS, excerpt="12.34 CNY",
                content_hash=hashlib.sha256(b"quote-1").hexdigest(), confidence=0.9,
            )
            return EvidencePack(
                pack_id="quote-pack", investigation_id="quote-investigation",
                status=EvidencePackStatus.RESOLVED, request=request,
                investigation_plan=InvestigationPlan(
                    fact_keys=(fact.key,), source_scope=request.source_scope,
                ),
                evidence_by_fact={fact.key: (item,)}, historical_evidence_by_fact={},
                resolved_facts=(fact.key,), unresolved_facts=(), conflicts=(),
                source_attempts=(), investigation_started_at="2026-08-04T00:00:00Z",
                investigation_completed_at="2026-08-04T00:00:02Z",
                cache=CacheMetadata(hit=False), do_not_infer=(),
            )

    coordinator = QuoteCoordinator()
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=coordinator)

    result = invoke_bureau_agent_with_report(
        "户部", "投资司", "查询 000001.SZ 股票价格", "大陆股票最新价查询",
        lambda _messages: pytest.fail("deterministic fact plan must own synthesis"),
        evidence_session=session,
    )

    assert "12.34" in result.opinion
    assert coordinator.calls == 1
    assert session.snapshot().adopted_evidence_ids == ("quote-1",)
    assert len(result.runtime_report.audit_refs) == 1


def test_rites_content_entity_plan_uses_signed_evidence_loop_without_model_call() -> None:
    class EntityCoordinator:
        calls = 0

        def investigate(self, request, **_kwargs):
            self.calls += 1
            fact = request.required_facts[0]
            item = EvidenceItem(
                evidence_id="entity-1", fact_key=fact.key,
                value="美国人工智能研究与部署公司", unit=None,
                as_of="2026-08-04T00:00:00Z", retrieved_at="2026-08-04T00:00:01Z",
                source_url="https://zh.wikipedia.org/wiki/OpenAI", publisher="Wikipedia",
                source_type=SourceType.PUBLIC_API, quality=EvidenceQuality.SECONDARY,
                stance=EvidenceStance.SUPPORTS, excerpt="OpenAI",
                content_hash=hashlib.sha256(b"entity-1").hexdigest(), confidence=0.9,
            )
            return EvidencePack(
                pack_id="entity-pack", investigation_id="entity-investigation",
                status=EvidencePackStatus.RESOLVED, request=request,
                investigation_plan=InvestigationPlan(
                    fact_keys=(fact.key,), source_scope=request.source_scope,
                ),
                evidence_by_fact={fact.key: (item,)}, historical_evidence_by_fact={},
                resolved_facts=(fact.key,), unresolved_facts=(), conflicts=(),
                source_attempts=(), investigation_started_at="2026-08-04T00:00:00Z",
                investigation_completed_at="2026-08-04T00:00:02Z",
                cache=CacheMetadata(hit=False), do_not_infer=(),
            )

    coordinator = EntityCoordinator()
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=coordinator)

    result = invoke_bureau_agent_with_report(
        "礼部", "内容司",
        "通过锦衣卫外网调查核查 OpenAI 是什么公开实体，只需要一个 ENTITY_REFERENCE",
        "公开实体事实核查",
        lambda _messages: pytest.fail("deterministic entity plan must own synthesis"),
        evidence_session=session,
    )

    assert "美国人工智能研究与部署公司" in result.opinion
    assert coordinator.calls == 1
    assert session.snapshot().adopted_evidence_ids == ("entity-1",)
    assert len(result.runtime_report.audit_refs) == 1
