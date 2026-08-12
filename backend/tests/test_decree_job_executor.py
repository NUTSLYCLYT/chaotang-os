from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.decree_jobs.models import DecreeJob, DecreeJobState
from app.decree_jobs.worker import PermanentJobError, TransientJobError


def _job() -> DecreeJob:
    now = datetime(2026, 8, 7, tzinfo=UTC)
    return DecreeJob(
        job_id="a" * 32,
        owner_user_id="owner-a",
        idempotency_key="key",
        request_hash="hash",
        draft_fingerprint="b" * 64,
        decree_text="请户部核查国库",
        approved_route_json=json.dumps(
            {
                "approved_route": {
                    "departments": [
                        {"department": "户部", "required_bureaus": ["预算司"]}
                    ]
                },
                "accounting_context": None,
            }
        ),
        state=DecreeJobState.RUNNING,
        attempt_count=1,
        provider_request_count=0,
        cancel_requested=False,
        result_json=None,
        reply_id=None,
        error_code=None,
        deadline_at=now + timedelta(minutes=30),
        retry_at=None,
        lease_owner="worker-a",
        lease_expires_at=now + timedelta(seconds=90),
        created_at=now,
        updated_at=now,
    )


def _executor_module():
    import app.decree_jobs.executor as executor_module

    return executor_module


def test_executor_rebuilds_owner_snapshot_and_uses_job_as_execution_identity(
    monkeypatch,
) -> None:
    executor_module = _executor_module()
    seen: dict[str, object] = {}

    def execute(payload, current_user, **kwargs):
        seen.update(payload=payload, owner=current_user.id, **kwargs)
        return SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')

    monkeypatch.setattr(executor_module, "execute_decree_now", execute)
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    result = executor_module.PersistentDecreeJobExecutor().execute(_job(), control)

    assert result == '{"status":"ok"}'
    assert seen["owner"] == "owner-a"
    assert seen["execution_id"] == "a" * 32
    assert seen["defer_business_side_effects"] is True
    assert seen["consumed_authority"].route_snapshot.departments[0].department == "户部"


def test_accounting_job_reaches_agent_without_executor_source_preflight(monkeypatch) -> None:
    executor_module = _executor_module()
    authority = {
        "approved_route": {
            "departments": [{"department": "户部", "required_bureaus": ["会计司"]}]
        },
        "accounting_context": {
            "request_kind": "ACCOUNTING_REPORT",
            "period": {"start_year": 2025, "end_year": 2025},
            "source_fingerprint": None,
        },
    }
    job = replace(_job(), approved_route_json=json.dumps(authority))
    called: list[str] = []
    monkeypatch.setattr(
        executor_module,
        "build_accounting_report_session",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("preflight forbidden")),
    )
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (
            called.append("agent")
            or SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')
        ),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    assert executor_module.PersistentDecreeJobExecutor().execute(job, control) == '{"status":"ok"}'
    assert called == ["agent"]


def test_executor_does_not_fake_archive_and_publish_checkpoints(monkeypatch) -> None:
    executor_module = _executor_module()
    calls: list[str] = []
    monkeypatch.setattr(
        executor_module,
        "archive_prepared_decree",
        lambda job: calls.append("archive") or job.job_id,
        raising=False,
    )
    monkeypatch.setattr(
        executor_module,
        "publish_prepared_decree",
        lambda job: calls.append("publish") or '{"status":"ok"}',
        raising=False,
    )
    executor = executor_module.PersistentDecreeJobExecutor()

    assert executor.archive(_job()) == "a" * 32
    assert executor.publish(_job()) == '{"status":"ok"}'
    assert calls == ["archive", "publish"]


def test_archive_checkpoint_rehydrates_frozen_evidence_dataclass() -> None:
    executor_module = _executor_module()
    from app.agents.evidence_protocol import AgentEvidenceSnapshot

    internal = executor_module._archive_internal_result(
        SimpleNamespace(
            internal_result={
                "approved_route": {
                    "departments": [
                        {"department": "户部", "required_bureaus": ["预算司"]}
                    ]
                },
                "evidence_snapshot": {
                    "packs": [],
                    "available_evidence_ids": [],
                    "bureau_selections": [],
                    "adopted_evidence_ids": [],
                    "investigation_count": 0,
                    "extractor_count": 0,
                    "used": False,
                    "investigating_bureau_node_ids": [],
                    "degradation_reasons": [],
                },
            }
        )
    )

    assert isinstance(internal["evidence_snapshot"], AgentEvidenceSnapshot)


def test_nonempty_evidence_survives_checkpoint_json_and_archive_resolution() -> None:
    executor_module = _executor_module()
    from app.agents.evidence_protocol import AgentEvidenceSnapshot
    from app.api.decrees import (
        BureauOpinionResponse,
        ChancellorDecreeResponse,
        DeliveryKind,
        MinistryOpinionResponse,
        PreparedDecreeExecution,
    )
    from app.jinyiwei.models import DataGapRequest, EvidenceItem, EvidencePack
    from app.shiguan.archive_decree import resolve_adopted_evidence_references

    evidence_id = "evidence-checkpoint-1"
    request = DataGapRequest.model_validate(
        {
            "request_id": "request-checkpoint-1",
            "requesting_agent": "户部",
            "question": "请核实预算总额",
            "required_facts": [
                {
                    "key": "amount",
                    "description": "预算总额",
                    "category": "PUBLIC_STATISTIC",
                    "data_scope": "EXTERNAL_PUBLIC",
                    "subject": "年度预算",
                    "jurisdiction": "CN",
                    "expected_unit": "CNY",
                }
            ],
            "decision_context": "形成回奏",
            "freshness": {"max_age_seconds": 3600},
            "timeout_seconds": 30,
            "source_scope": ["PUBLIC_API"],
        }
    )
    item = EvidenceItem.model_validate(
        {
            "evidence_id": evidence_id,
            "fact_key": "amount",
            "value": {"total": 42},
            "unit": "CNY",
            "as_of": "2026-08-07T08:00:00+00:00",
            "retrieved_at": "2026-08-07T09:00:00+00:00",
            "source_url": "https://example.test/budget",
            "publisher": "财政署",
            "source_type": "PUBLIC_API",
            "quality": "AUTHORITATIVE",
            "stance": "SUPPORTS",
            "excerpt": "预算总额为四十二。",
            "content_hash": hashlib.sha256(b"source").hexdigest(),
            "confidence": 0.9,
        }
    )
    pack = EvidencePack.model_validate(
        {
            "pack_id": "pack-checkpoint-1",
            "investigation_id": "investigation-checkpoint-1",
            "status": "RESOLVED",
            "request": request.model_dump(mode="json"),
            "investigation_plan": {
                "fact_keys": ["amount"],
                "source_scope": ["PUBLIC_API"],
            },
            "evidence_by_fact": {"amount": [item.model_dump(mode="json")]},
            "historical_evidence_by_fact": {"amount": []},
            "resolved_facts": ["amount"],
            "unresolved_facts": [],
            "conflicts": [],
            "source_attempts": [],
            "investigation_started_at": "2026-08-07T08:00:00+00:00",
            "investigation_completed_at": "2026-08-07T09:00:00+00:00",
            "cache": {"hit": False},
            "do_not_infer": [],
        }
    )
    snapshot = AgentEvidenceSnapshot(
        packs=(pack,),
        available_evidence_ids=(evidence_id,),
        bureau_selections=(("户部·预算司", (evidence_id,)),),
        adopted_evidence_ids=(evidence_id,),
        investigation_count=1,
        extractor_count=1,
        used=True,
    )
    response = ChancellorDecreeResponse(
        status="ok",
        chancellor="丞相",
        route_type="single",
        rationale="交户部办理",
        processing_path=["上书房", "户部", "丞相"],
        departments=["户部"],
        ministry_opinions=[
            MinistryOpinionResponse(
                department="户部",
                bureau_opinions=[
                    BureauOpinionResponse(bureau="预算司", opinion="已核验")
                ],
                opinion="准予办理",
            )
        ],
        council_verdict=None,
        final_verdict="准奏",
        recommendations=["复核来源", "保留证据", "形成回奏"],
        delivery_kind=DeliveryKind.NONE,
    )
    prepared = PreparedDecreeExecution(
        response=response,
        internal_result={
            "approved_route": json.loads(_job().approved_route_json)[
                "approved_route"
            ],
            "draft_version": 1,
            "draft_fingerprint": "b" * 64,
            "evidence_snapshot": snapshot,
            "adopted_evidence_ids": [evidence_id],
        },
    )

    reloaded = PreparedDecreeExecution.model_validate_json(
        prepared.model_dump_json()
    )
    internal = executor_module._archive_internal_result(reloaded)
    restored = internal["evidence_snapshot"]
    references = resolve_adopted_evidence_references(
        restored, internal["adopted_evidence_ids"]
    )

    assert isinstance(restored, AgentEvidenceSnapshot)
    assert restored.packs[0] == pack
    assert [reference.snapshot.evidence_id for reference in references] == [
        evidence_id
    ]


def test_executor_checks_control_before_every_provider_dispatch(monkeypatch) -> None:
    executor_module = _executor_module()
    from app.langgraph_runtime.provider_budget import get_provider_attempt_budget

    events: list[str] = []

    def execute(*_args, **_kwargs):
        get_provider_attempt_budget().reserve()
        events.append("dispatch")
        return SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')

    control = SimpleNamespace(
        raise_if_cancelled=lambda: events.append("boundary"),
        record_provider_request=lambda: events.append("persist"),
    )
    monkeypatch.setattr(executor_module, "execute_decree_now", execute)

    executor_module.PersistentDecreeJobExecutor().execute(_job(), control)

    assert events == ["boundary", "persist", "dispatch"]


def test_executor_charges_process_and_persistent_budget_once_per_dispatch(
    monkeypatch,
) -> None:
    executor_module = _executor_module()
    from app.langgraph_runtime.provider_budget import (
        configure_provider_attempt_budget,
        get_provider_attempt_budget,
    )

    process_budget = configure_provider_attempt_budget(8)
    persisted: list[str] = []
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (
            get_provider_attempt_budget().reserve()
            or SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')
        ),
    )
    control = SimpleNamespace(
        raise_if_cancelled=lambda: None,
        record_provider_request=lambda: persisted.append("persist"),
    )
    try:
        executor_module.PersistentDecreeJobExecutor().execute(_job(), control)
        assert process_budget is not None
        assert process_budget.attempts_used == 1
        assert persisted == ["persist"]
    finally:
        configure_provider_attempt_budget(None)


def test_executor_does_not_prepare_accounting_before_agent_execution(
    monkeypatch,
) -> None:
    executor_module = _executor_module()
    events: list[str] = []
    authority = {
        "approved_route": {
            "departments": [
                {"department": "户部", "required_bureaus": ["预算司"]}
            ]
        },
        "accounting_context": {
            "request_kind": "ACCOUNTING_REPORT",
            "period": {"start_year": 2020, "end_year": 2025},
            "source_fingerprint": "c" * 64,
        },
    }
    job = replace(_job(), approved_route_json=json.dumps(authority))
    monkeypatch.setattr(
        executor_module,
        "build_accounting_report_session",
        lambda **_kwargs: SimpleNamespace(abort=lambda: events.append("abort")),
    )
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (
            events.append("execute")
            or SimpleNamespace(model_dump_json=lambda: '{"status":"ok"}')
        ),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    executor_module.PersistentDecreeJobExecutor().execute(job, control)

    assert events == ["execute"]


def test_executor_does_not_turn_pre_agent_source_error_into_blocked_success(
    monkeypatch,
) -> None:
    executor_module = _executor_module()
    from app.api.decrees import SourceNotCurrentError
    authority = {
        "approved_route": {
            "departments": [
                {"department": "户部", "required_bureaus": ["会计司"]}
            ]
        },
        "accounting_context": {
            "request_kind": "ACCOUNTING_REPORT",
            "period": {"start_year": 2025, "end_year": 2025},
            "source_fingerprint": None,
        },
    }
    job = replace(_job(), approved_route_json=json.dumps(authority))
    monkeypatch.setattr(
        executor_module,
        "build_accounting_report_session",
        lambda **_kwargs: (_ for _ in ()).throw(SourceNotCurrentError()),
    )
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: SimpleNamespace(
            model_dump_json=lambda: '{"status":"ok"}'
        ),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    result = executor_module.PersistentDecreeJobExecutor().execute(job, control)

    assert result == '{"status":"ok"}'


@pytest.mark.parametrize(
    ("category", "expected_type", "expected_code"),
    [
        ("timeout", TransientJobError, "provider_timeout"),
        ("connection", TransientJobError, "provider_failed"),
        ("rate_limit", TransientJobError, "provider_failed"),
        ("provider_server", TransientJobError, "provider_failed"),
        ("provider_client", PermanentJobError, "provider_failed"),
        ("unexpected", PermanentJobError, "model_failed"),
        ("budget_exhausted", PermanentJobError, "provider_budget_exceeded"),
    ],
)
def test_executor_maps_provider_failures_to_exact_public_allowlist(
    monkeypatch, category, expected_type, expected_code
) -> None:
    executor_module = _executor_module()
    from app.agents.chancellor.graph import ChancellorGraphInvocationError
    from app.langgraph_runtime.deepseek_client import DeepSeekModelInvocationError

    provider = DeepSeekModelInvocationError(
        "sanitized",
        failure_category=category,
        provider_http_status=504,
        retry_count=1,
    )
    graph = ChancellorGraphInvocationError("sanitized")
    graph.__cause__ = provider
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(graph),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    with pytest.raises(expected_type) as raised:
        executor_module.PersistentDecreeJobExecutor().execute(_job(), control)
    assert raised.value.code == expected_code
    if expected_code == "model_failed":
        assert (raised.value.stage, raised.value.category) == ("model", "model")


def test_executor_reports_local_contract_failure_as_validation_not_model(monkeypatch) -> None:
    executor_module = _executor_module()
    from app.agents.chancellor.graph import ChancellorGraphInvocationError

    graph = ChancellorGraphInvocationError("sanitized")
    graph.failure_stage = "bureau"
    graph.__cause__ = ValueError("malformed_model_envelope")
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(graph),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    with pytest.raises(PermanentJobError, match="validation_failed") as raised:
        executor_module.PersistentDecreeJobExecutor().execute(_job(), control)
    assert (raised.value.stage, raised.value.category) == (
        "validation",
        "validation",
    )


@pytest.mark.parametrize(
    ("tool_code", "category"),
    [
        ("format_unrecognized", "format"),
        ("tool_unavailable", "tool"),
        ("source_not_found", "data"),
    ],
)
def test_executor_preserves_typed_accounting_tool_failure_from_graph_cause(
    monkeypatch, tool_code: str, category: str
) -> None:
    executor_module = _executor_module()
    from app.agents.chancellor.graph import ChancellorGraphInvocationError
    from app.agents.runtime_skills.tool_failures import AccountingToolChainError
    from app.agents.runtime_skills.tool_models import ToolFailureCode

    graph = ChancellorGraphInvocationError("sanitized")
    graph.failure_stage = "bureau"
    graph.__cause__ = AccountingToolChainError(ToolFailureCode(tool_code))
    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(graph),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    with pytest.raises(PermanentJobError, match=tool_code) as raised:
        executor_module.PersistentDecreeJobExecutor().execute(_job(), control)
    assert (raised.value.stage, raised.value.category) == ("bureau_tool", category)


@pytest.mark.parametrize(
    ("private_code", "public_code", "stage", "category"),
    [
        ("report_generation_invalid", "validation_failed", "validation", "validation"),
        ("publication_failed", "artifact_failed", "artifact", "artifact"),
    ],
)
def test_executor_sanitizes_accounting_boundary_failures(
    monkeypatch, private_code: str, public_code: str, stage: str, category: str
) -> None:
    executor_module = _executor_module()
    from app.api.decrees import AccountingReportPublicationError

    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AccountingReportPublicationError(private_code + r" C:\private\ledger.xlsx A1")
        ),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: None,
        raise_if_cancelled=lambda: None,
    )

    with pytest.raises(PermanentJobError, match=public_code) as raised:
        executor_module.PersistentDecreeJobExecutor().execute(_job(), control)
    assert (raised.value.stage, raised.value.category) == (stage, category)
    assert "private" not in str(raised.value)


def test_executor_maps_frozen_provider_limit_to_typed_budget_failure(
    monkeypatch,
) -> None:
    executor_module = _executor_module()
    from app.langgraph_runtime.provider_budget import get_provider_attempt_budget

    monkeypatch.setattr(
        executor_module,
        "execute_decree_now",
        lambda *_args, **_kwargs: get_provider_attempt_budget().reserve(),
    )
    control = SimpleNamespace(
        record_provider_request=lambda: pytest.fail(
            "limit must fail before persistence"
        ),
        raise_if_cancelled=lambda: None,
    )

    with pytest.raises(PermanentJobError, match="provider_budget_exceeded"):
        executor_module.PersistentDecreeJobExecutor().execute(
            replace(_job(), provider_request_count=8), control
        )
