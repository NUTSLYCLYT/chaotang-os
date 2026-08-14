from __future__ import annotations

import hashlib
import inspect
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import jsonschema
import pytest
from pydantic import ValidationError

import app.agents.runtime_skills.six_ministry_evidence_service as service_module
from app.agents.runtime_skills.evidence_spine import (
    RunLocatorV1,
    load_bound_decree_authority,
)
from app.agents.runtime_skills.execution_ledger import (
    ExecutionLedgerError,
    RuntimeBindingLedger,
)
from app.agents.runtime_skills.models import (
    CouncilReport,
    EvidenceSufficiency,
    MinistryReport,
    ReportStatus,
)
from app.agents.runtime_skills.registry import (
    DownstreamSkillRegistry,
    build_default_downstream_skill_registry,
)
from app.agents.runtime_skills.six_ministry_evidence_service import (
    DecisionErrorCode,
    DecisionRequestV1,
    MaterialRefV1,
    RequestConstraintsV1,
    SixMinistryEvidenceServiceError,
    resolve_six_ministry_decision,
)
from app.auth.models import AuthenticatedUser
from app.decree_jobs.models import AcceptDecreeJob
from app.decree_jobs.storage import DecreeJobStore
from app.jinyiwei import storage as evidence_storage
from app.jinyiwei.models import EvidencePack
from app.junjichu_cases import models as case_models
from app.junjichu_cases import storage as case_storage
from app.shiguan import storage as shiguan_storage

NOW = datetime(2026, 8, 14, 8, 0, tzinfo=UTC)
SCHEMA_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "contracts"
    / "six-ministry-evidence-spine.schema.json"
)


@pytest.fixture(autouse=True)
def _fixed_server_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service_module, "_utc_now", lambda: NOW)


def _validate_exchange(value: object) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.validate(value, schema, cls=jsonschema.Draft202012Validator)


def _user(owner: str = "owner-a") -> AuthenticatedUser:
    return AuthenticatedUser(
        id=owner,
        username=f"user-{owner}",
        email=f"{owner}@example.test",
    )


def _accept_job(
    store: DecreeJobStore,
    *,
    department: str,
    bureau: str | tuple[str, ...],
    owner: str = "owner-a",
) -> str:
    nonce = uuid4().hex
    bureaus = (bureau,) if isinstance(bureau, str) else bureau
    authority = {
        "approved_route": {
            "departments": [
                {"department": department, "required_bureaus": list(bureaus)}
            ]
        },
        "accounting_context": None,
    }
    return store.accept(
        AcceptDecreeJob(
            owner_user_id=owner,
            idempotency_key=f"submission:{nonce}",
            request_hash=f"request:{nonce}",
            draft_fingerprint=hashlib.sha256(f"draft:{nonce}".encode()).hexdigest(),
            decree_text=f"请{department}{bureau}只读分析已批准材料",
            approved_route_json=json.dumps(
                authority, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job.job_id


def _accept_multi_job(store: DecreeJobStore, *, owner: str = "owner-a") -> str:
    nonce = uuid4().hex
    authority = {
        "approved_route": {
            "departments": [
                {"department": "户部", "required_bureaus": ["预算司"]},
                {"department": "刑部", "required_bureaus": ["缺证核查司"]},
            ]
        },
        "accounting_context": None,
    }
    return store.accept(
        AcceptDecreeJob(
            owner_user_id=owner,
            idempotency_key=f"submission:{nonce}",
            request_hash=f"request:{nonce}",
            draft_fingerprint=hashlib.sha256(f"draft:{nonce}".encode()).hexdigest(),
            decree_text="请户部、刑部只读会审已批准证据",
            approved_route_json=json.dumps(
                authority, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            ),
            deadline_at=NOW + timedelta(minutes=30),
        ),
        now=NOW,
    ).job.job_id


def _pack(*, owner: str, investigation_id: str) -> EvidencePack:
    evidence_id = f"evidence:{owner}:{investigation_id}"
    return EvidencePack.model_validate(
        {
            "pack_id": f"pack:{owner}:{investigation_id}",
            "investigation_id": investigation_id,
            "status": "RESOLVED",
            "request": {
                "request_id": f"request:{owner}:{investigation_id}",
                "requesting_agent": "libu-rites-content",
                "question": "What approved fact may be cited?",
                "required_facts": [
                    {
                        "key": "approved_fact",
                        "description": "Approved public fact",
                        "category": "ENTITY_REFERENCE",
                        "data_scope": "EXTERNAL_PUBLIC",
                        "subject": "Public draft",
                    }
                ],
                "decision_context": "Citation draft",
                "freshness": {"max_age_seconds": 3600},
                "existing_evidence_ids": [],
                "timeout_seconds": 30,
                "source_scope": ["PUBLIC_API"],
            },
            "investigation_plan": {
                "fact_keys": ["approved_fact"],
                "source_scope": ["PUBLIC_API"],
            },
            "evidence_by_fact": {
                "approved_fact": [
                    {
                        "evidence_id": evidence_id,
                        "fact_key": "approved_fact",
                        "value": "verified public statement",
                        "unit": None,
                        "as_of": "2026-08-14T07:30:00+00:00",
                        "retrieved_at": "2026-08-14T07:35:00+00:00",
                        "source_url": "https://example.test/fact",
                        "publisher": "Example Authority",
                        "source_type": "PUBLIC_API",
                        "quality": "AUTHORITATIVE",
                        "stance": "SUPPORTS",
                        "excerpt": "The public statement was verified.",
                        "content_hash": hashlib.sha256(b"verified-fact").hexdigest(),
                        "confidence": 0.95,
                    }
                ]
            },
            "historical_evidence_by_fact": {"approved_fact": []},
            "resolved_facts": ["approved_fact"],
            "unresolved_facts": [],
            "conflicts": [],
            "source_attempts": [],
            "investigation_started_at": "2026-08-14T07:00:00+00:00",
            "investigation_completed_at": "2026-08-14T07:40:00+00:00",
            "cache": {"hit": False},
            "do_not_infer": [],
        }
    )


def _request(
    investigation_id: str,
    *,
    as_of: datetime | None = NOW,
) -> DecisionRequestV1:
    return DecisionRequestV1(
        request_id=f"decision:{investigation_id}",
        objective="生成只读机器裁决",
        material_refs=(
            MaterialRefV1(
                kind="evidence_pack",
                opaque_id=investigation_id,
                expected_digest=None,
                version=1,
            ),
        ),
        constraints=RequestConstraintsV1(as_of=as_of, output_language="zh-CN"),
    )


def _store_pack(
    path: Path,
    *,
    owner: str,
    investigation_id: str,
    pack: EvidencePack | None = None,
) -> EvidencePack:
    pack = pack or _pack(owner=owner, investigation_id=investigation_id)
    evidence_storage.store_evidence_pack(
        pack,
        owner_user_id=owner,
        db_path=path,
    )
    return pack


def _pack_with_timing(
    *,
    owner: str,
    investigation_id: str,
    as_of: str,
    retrieved_at: str,
    freshness: dict[str, object],
) -> EvidencePack:
    payload = _pack(owner=owner, investigation_id=investigation_id).model_dump(
        mode="json"
    )
    payload["request"]["freshness"] = freshness
    item = payload["evidence_by_fact"]["approved_fact"][0]
    item["as_of"] = as_of
    item["retrieved_at"] = retrieved_at
    return EvidencePack.model_validate(payload)


def _partial_unverified_pack(*, owner: str, investigation_id: str) -> EvidencePack:
    payload = _pack(owner=owner, investigation_id=investigation_id).model_dump(
        mode="json"
    )
    payload["status"] = "PARTIAL"
    payload["resolved_facts"] = []
    payload["unresolved_facts"] = ["approved_fact"]
    payload["do_not_infer"] = ["approved_fact must not be inferred"]
    payload["evidence_by_fact"]["approved_fact"][0]["quality"] = "UNVERIFIED"
    return EvidencePack.model_validate(payload)


def _ministry_report_for_council(
    department: str, *, evidence_id: str | None
) -> MinistryReport:
    values = {
        "户部": ("hubu", "synthesize-finance-governance", "预算司"),
        "刑部": ("xingbu", "synthesize-risk-governance", "缺证核查司"),
    }
    slug, skill_id, bureau = values[department]
    return MinistryReport(
        report_id=f"ministry-report:{slug}:joint",
        request_id="request:joint",
        agent_id=f"ministry-{slug}",
        skill_id=skill_id,
        skill_version="1.0.0",
        subject=department,
        executive_summary=f"{department}完成只读复核",
        input_refs=(f"bureau-report:{slug}",),
        evidence_refs=(evidence_id,) if evidence_id is not None else (),
        audit_refs=(f"audit:{slug}",),
        data_gaps=(),
        evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
        status=ReportStatus.COMPLETED,
        selected_bureaus=(bureau,),
        selection_reasons=("approved route",),
        bureau_report_refs=(f"bureau-report:{slug}",),
        shared_findings=(f"{department} finding",),
        conflicts=(),
        cross_bureau_impacts=(),
        ministry_position=(f"{department} position",),
        unresolved_items=(),
        created_at=NOW,
    )


def _council_report_for_case(
    reports: tuple[MinistryReport, ...], *, evidence_id: str | None
) -> CouncilReport:
    return CouncilReport(
        report_id="council-report:joint",
        request_id="request:joint",
        agent_id="junjichu",
        skill_id="conduct-joint-ministry-review",
        skill_version="1.0.0",
        subject="户部刑部跨部会审",
        executive_summary="军机处完成只读合议",
        input_refs=tuple(report.report_id for report in reports),
        evidence_refs=(evidence_id,) if evidence_id is not None else (),
        audit_refs=tuple(ref for report in reports for ref in report.audit_refs),
        data_gaps=(),
        evidence_sufficiency=EvidenceSufficiency.SUFFICIENT,
        status=ReportStatus.COMPLETED,
        participating_ministries=("户部", "刑部"),
        review_order=("户部", "刑部"),
        ministry_report_refs=tuple(report.report_id for report in reports),
        consensus=("两部同意保持只读预览",),
        disagreements=(),
        cross_ministry_dependencies=("财务判断受证据完整性边界约束",),
        joint_options=("由丞相审阅预览",),
        matters_for_chancellor_decision=(),
        created_at=NOW,
    )


def test_request_contract_is_closed_and_cannot_carry_identity_or_authority() -> None:
    request = _request("investigation-a")
    assert request.schema_version == "1.0.0"
    assert request.message_type == "decision_request"
    _validate_exchange(request.model_dump(mode="json"))

    for field, value in (
        ("owner_user_id", "owner-a"),
        ("tenant_id", "tenant-a"),
        ("ministry", "户部"),
        ("skill_id", "analyze-accounting-position"),
        ("approved", True),
        ("verified", True),
        ("tool", "all"),
        ("status", "completed"),
    ):
        raw = request.model_dump(mode="json")
        raw[field] = value
        with pytest.raises(ValidationError, match="extra_forbidden"):
            DecisionRequestV1.model_validate(raw)


def test_public_service_requires_authenticated_user_not_owner_string() -> None:
    signature = inspect.signature(resolve_six_ministry_decision)
    assert "current_user" in signature.parameters
    assert "owner_user_id" not in signature.parameters
    assert "trusted_evidence" not in signature.parameters
    assert "authority_projection" not in signature.parameters
    assert "ministry_reports" not in signature.parameters
    assert "council_report" not in signature.parameters


def test_rites_requires_confirmed_adoption_before_emitting_citation_draft(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="礼部", bureau="内容司")
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-rites"
    )

    pending = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )
    assert pending.decision.status == "degraded"
    assert pending.decision.action_disposition == "hold"
    assert [error.code for error in pending.errors] == [
        DecisionErrorCode.EVIDENCE_INCOMPLETE
    ]
    assert pending.decision.artifact_refs == ()

    evidence_id = next(iter(pack.evidence_by_fact["approved_fact"])).evidence_id
    evidence_storage.upsert_evidence_adoption(
        evidence_id,
        "reply:confirmed",
        "CONFIRMED",
        owner_user_id="owner-a",
        at=NOW,
        db_path=evidence_path,
    )
    completed = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )

    assert completed.decision.status == "completed"
    assert completed.decision.action_disposition == "preview"
    assert completed.evidence.projection_mode == "citation_draft"
    assert completed.decision.artifact_refs[0].artifact_type == "citation_draft"
    assert completed.external_effects.authorized is False
    assert completed.external_effects.effect_count == 0
    _validate_exchange(completed.model_dump(mode="json"))


def test_xingbu_can_complete_evidence_integrity_analysis_without_claiming_legal_approval(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="刑部", bureau="缺证核查司")
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-xingbu"
    )

    envelope = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )

    assert envelope.decision.status == "completed"
    assert envelope.evidence.projection_mode == "evidence_integrity"
    assert envelope.routing.accountable_ministry == "xingbu"
    assert envelope.runtime_binding.skill_id == "analyze-evidence-integrity"
    assert envelope.decision.facts == ()
    assert any("采纳" in finding.statement for finding in envelope.decision.findings)
    assert envelope.external_effects.authorized is False


@pytest.mark.parametrize(
    ("department", "bureau", "expected_ministry", "expected_requirement"),
    [
        ("吏部", "任免司", "libu", "personnel_authority_source"),
        ("工部", "质量司", "gongbu", "delivery_authority_source"),
        ("兵部", "报价司", "bingbu", "commercial_authority_source"),
        ("刑部", "合同司", "xingbu", "legal_authority_source"),
    ],
)
def test_missing_domain_authorities_produce_distinct_machine_holds(
    tmp_path: Path,
    department: str,
    bureau: str,
    expected_ministry: str,
    expected_requirement: str,
) -> None:
    jobs = DecreeJobStore(tmp_path / f"{expected_ministry}-jobs.sqlite3")
    job_id = _accept_job(jobs, department=department, bureau=bureau)
    evidence_path = tmp_path / f"{expected_ministry}-evidence.sqlite3"
    pack = _store_pack(
        evidence_path,
        owner="owner-a",
        investigation_id=f"investigation-{expected_ministry}",
    )

    envelope = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(
            tmp_path / f"{expected_ministry}-bindings.sqlite3"
        ),
    )

    assert envelope.routing.accountable_ministry == expected_ministry
    assert envelope.decision.status == "degraded"
    assert envelope.decision.action_disposition == "hold"
    assert [error.code for error in envelope.errors] == [
        DecisionErrorCode.AUTHORITY_UNAVAILABLE
    ]
    assert envelope.decision.missing_evidence[0].requirement_id == expected_requirement
    assert envelope.external_effects.authorized is False


def test_cross_owner_job_and_evidence_fail_with_the_same_non_enumerating_code(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    owner_b_job = _accept_job(
        jobs, department="礼部", bureau="内容司", owner="owner-b"
    )
    owner_a_job = _accept_job(
        jobs, department="礼部", bureau="内容司", owner="owner-a"
    )
    evidence_path = tmp_path / "evidence.sqlite3"
    _store_pack(
        evidence_path, owner="owner-b", investigation_id="investigation-owner-b"
    )

    attempts = (
        (owner_b_job, "investigation-owner-b"),
        (owner_a_job, "investigation-owner-b"),
    )
    for job_id, investigation_id in attempts:
        with pytest.raises(SixMinistryEvidenceServiceError) as caught:
            resolve_six_ministry_decision(
                _request(investigation_id),
                current_user=_user("owner-a"),
                job_id=job_id,
                decree_job_store=jobs,
                jinyiwei_db_path=evidence_path,
                binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
            )
        assert caught.value.code is DecisionErrorCode.MATERIAL_NOT_FOUND
        assert str(caught.value) == "MATERIAL_NOT_FOUND"


@pytest.mark.parametrize(
    ("receipt_mode", "reports_use_evidence", "registry_drift", "expected_status"),
    (
        ("verified", True, None, "completed"),
        ("substituted", True, None, "degraded"),
        ("orphan", True, None, "degraded"),
        ("verified", False, None, "degraded"),
        ("verified", True, "definition", "degraded"),
        ("verified", True, "version", "degraded"),
    ),
    ids=(
        "verified-chain",
        "same-owner-cross-run-receipt",
        "orphan-receipt",
        "reports-ignore-evidence",
        "definition-drift",
        "version-drift",
    ),
)
def test_multi_route_completes_only_from_owner_bound_case_and_typed_reports(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    receipt_mode: str,
    reports_use_evidence: bool,
    registry_drift: str | None,
    expected_status: str,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_multi_job(jobs)
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-joint"
    )
    evidence_id = pack.evidence_by_fact["approved_fact"][0].evidence_id
    bound = load_bound_decree_authority(
        jobs,
        authenticated_owner_user_id="owner-a",
        run_locator=RunLocatorV1(job_id=job_id),
    )
    cases_path = tmp_path / "cases.sqlite3"
    case = case_storage.open_case(
        case_models.JunjichuCaseOpenInput(
            decree_text="请户部、刑部只读会审已批准证据",
            route_type="multi",
            departments=["户部", "刑部"],
            processing_path=["军机处（召集）"],
            run_id=job_id,
            decree_id=job_id,
            draft_fingerprint=bound.scope.draft_fingerprint,
            route_digest=bound.scope.route_digest,
        ),
        owner_user_id="owner-a",
        db_path=cases_path,
    )
    report_evidence_id = evidence_id if reports_use_evidence else None
    reports = (
        _ministry_report_for_council("户部", evidence_id=report_evidence_id),
        _ministry_report_for_council("刑部", evidence_id=report_evidence_id),
    )
    for report in reports:
        case_storage.append_runtime_ministry_report(
            case.id,
            owner_user_id="owner-a",
            run_id=job_id,
            report=report,
            db_path=cases_path,
        )
    case_storage.append_runtime_council_report(
        case.id,
        owner_user_id="owner-a",
        run_id=job_id,
        report=_council_report_for_case(reports, evidence_id=report_evidence_id),
        db_path=cases_path,
    )
    ledger = RuntimeBindingLedger(tmp_path / "bindings.sqlite3")
    pending = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=ledger,
        case_id=case.id,
        junjichu_db_path=cases_path,
    )
    assert pending.decision.status == "degraded"
    assert pending.routing.joint_review.status == "pending"
    assert pending.routing.joint_review.receipt_ref is None
    assert [error.code for error in pending.errors] == [
        DecisionErrorCode.JOINT_REVIEW_REQUIRED
    ]
    case_storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="COUNCIL_REVIEWING",
        council_verdict="军机处完成只读合议",
        db_path=cases_path,
    )
    case_storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        db_path=cases_path,
    )
    shiguan_path = tmp_path / "shiguan.sqlite3"
    reply_id = "orphan-reply"
    if receipt_mode in {"verified", "substituted"}:
        reply_id = (
            job_id if receipt_mode == "verified" else "same-owner-other-run-reply"
        )
        reply = shiguan_storage.create_reply_with_evidence(
            {
                "type": "REPLY",
                "title": "丞相回奏：户部刑部只读会审",
                "content": "两部已完成证据约束下的只读合议",
                "matter_type": "跨部会审",
                "department": "户部",
                "source_kind": "DECREE",
                "source_text": "请户部、刑部只读会审已批准证据",
                "participating_departments": ["户部", "刑部"],
                "reply_process": "军机处合议后由丞相回奏",
                "reply_conclusion": "维持只读预览，不执行外部动作",
                "reply_time": NOW.isoformat(),
                "respondent": "丞相",
            },
            (),
            reply_id=reply_id,
            owner_user_id="owner-a",
            db_path=shiguan_path,
        )
        reply_id = reply.id
    case_storage.archive_case(
        case.id,
        owner_user_id="owner-a",
        reply_id=reply_id,
        db_path=cases_path,
    )
    if registry_drift is not None:
        current = build_default_downstream_skill_registry()
        changed = tuple(
            (
                item.model_copy(
                    update={
                        "purpose": f"{item.purpose} changed",
                    }
                )
                if item.agent_id == "ministry-hubu" and registry_drift == "definition"
                else item.model_copy(update={"version": "1.0.1"})
                if item.agent_id == "ministry-hubu" and registry_drift == "version"
                else item
            )
            for item in current.skills
        )
        drifted = DownstreamSkillRegistry(changed)
        monkeypatch.setattr(
            service_module,
            "build_default_downstream_skill_registry",
            lambda: drifted,
        )

    envelope = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=ledger,
        case_id=case.id,
        junjichu_db_path=cases_path,
        shiguan_db_path=shiguan_path,
    )

    assert envelope.decision.status == expected_status
    assert envelope.routing.route_mode == "multi"
    assert envelope.routing.joint_review.status == (
        "completed" if expected_status == "completed" else "pending"
    )
    assert envelope.routing.joint_review.receipt_ref == (
        reply_id if expected_status == "completed" else None
    )
    assert envelope.runtime_binding.skill_id == "conduct-joint-ministry-review"
    assert envelope.evidence.projection_mode == "joint_review"
    assert envelope.identity.case_id == case.id
    assert envelope.external_effects.authorized is False
    if expected_status == "degraded":
        assert [error.code for error in envelope.errors] == [
            DecisionErrorCode.JOINT_REVIEW_REQUIRED
        ]
    _validate_exchange(envelope.model_dump(mode="json"))


def test_single_department_multi_bureau_route_is_rejected_not_truncated(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(
        jobs,
        department="礼部",
        bureau=("内容司", "品牌司"),
    )
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path,
        owner="owner-a",
        investigation_id="investigation-multi-bureau",
    )

    with pytest.raises(SixMinistryEvidenceServiceError) as caught:
        resolve_six_ministry_decision(
            _request(pack.investigation_id),
            current_user=_user(),
            job_id=job_id,
            decree_job_store=jobs,
            jinyiwei_db_path=evidence_path,
            binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
        )

    assert caught.value.code is DecisionErrorCode.ROUTE_UNAPPROVED


@pytest.mark.parametrize(
    ("decision_as_of", "evidence_as_of", "retrieved_at", "freshness"),
    [
        (
            datetime(2020, 1, 1, 0, 30, tzinfo=UTC),
            "2020-01-01T00:00:00+00:00",
            "2020-01-01T00:05:00+00:00",
            {"max_age_seconds": 3600},
        ),
        (
            datetime(2030, 1, 1, tzinfo=UTC),
            "2026-08-14T07:30:00+00:00",
            "2026-08-14T07:35:00+00:00",
            {"max_age_seconds": 3600},
        ),
        (
            NOW,
            "2026-08-14T09:00:00+00:00",
            "2026-08-14T09:00:00+00:00",
            {"max_age_seconds": 3600},
        ),
        (
            NOW,
            "2026-08-14T07:30:00+00:00",
            "2026-08-14T07:35:00+00:00",
            {"not_before": "2026-08-14T07:45:00+00:00"},
        ),
    ],
    ids=(
        "caller-backdating-cannot-refresh-old-evidence",
        "expired",
        "future_observation",
        "before_not_before",
    ),
)
def test_jinyiwei_freshness_policy_blocks_stale_future_and_not_before_evidence(
    tmp_path: Path,
    decision_as_of: datetime,
    evidence_as_of: str,
    retrieved_at: str,
    freshness: dict[str, object],
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="刑部", bureau="缺证核查司")
    investigation_id = f"investigation-freshness-{uuid4().hex}"
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _pack_with_timing(
        owner="owner-a",
        investigation_id=investigation_id,
        as_of=evidence_as_of,
        retrieved_at=retrieved_at,
        freshness=freshness,
    )
    _store_pack(
        evidence_path,
        owner="owner-a",
        investigation_id=investigation_id,
        pack=pack,
    )

    envelope = resolve_six_ministry_decision(
        _request(investigation_id, as_of=decision_as_of),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )

    assert envelope.decision.status == "degraded"
    assert envelope.evidence.status == "partial"
    assert envelope.evidence.freshness == "stale"
    assert envelope.evidence_refs == ()
    assert [error.code for error in envelope.errors] == [
        DecisionErrorCode.EVIDENCE_STALE
    ]
    assert envelope.external_effects.authorized is False
    _validate_exchange(envelope.model_dump(mode="json"))


def test_caller_future_cutoff_cannot_make_server_future_evidence_current(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    server_now = datetime(2026, 8, 14, 4, 36, tzinfo=UTC)
    monkeypatch.setattr(service_module, "_utc_now", lambda: server_now)
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="刑部", bureau="缺证核查司")
    investigation_id = f"investigation-server-clock-{uuid4().hex}"
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _pack_with_timing(
        owner="owner-a",
        investigation_id=investigation_id,
        as_of="2026-08-14T07:30:00+00:00",
        retrieved_at="2026-08-14T07:35:00+00:00",
        freshness={"max_age_seconds": 3600},
    )
    _store_pack(
        evidence_path,
        owner="owner-a",
        investigation_id=investigation_id,
        pack=pack,
    )

    envelope = resolve_six_ministry_decision(
        _request(investigation_id, as_of=NOW),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )

    assert envelope.decision.status == "degraded"
    assert envelope.evidence.freshness == "stale"
    assert envelope.evidence_refs == ()
    assert [error.code for error in envelope.errors] == [
        DecisionErrorCode.EVIDENCE_STALE
    ]


def test_partial_unverified_pack_cannot_be_promoted_to_resolved(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="刑部", bureau="缺证核查司")
    investigation_id = f"investigation-partial-{uuid4().hex}"
    evidence_path = tmp_path / "evidence.sqlite3"
    _store_pack(
        evidence_path,
        owner="owner-a",
        investigation_id=investigation_id,
        pack=_partial_unverified_pack(
            owner="owner-a", investigation_id=investigation_id
        ),
    )

    envelope = resolve_six_ministry_decision(
        _request(investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )

    assert envelope.decision.status == "degraded"
    assert envelope.evidence.status == "partial"
    assert envelope.evidence_refs == ()
    assert [error.code for error in envelope.errors] == [
        DecisionErrorCode.EVIDENCE_INCOMPLETE
    ]
    assert envelope.external_effects.authorized is False


def test_multi_route_without_bound_case_stays_machine_blocked(tmp_path: Path) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_multi_job(jobs)
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-no-case"
    )

    envelope = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
    )

    assert envelope.decision.status == "degraded"
    assert envelope.identity.case_id is None
    assert [error.code for error in envelope.errors] == [
        DecisionErrorCode.JOINT_REVIEW_REQUIRED
    ]
    assert envelope.routing.joint_review.status == "pending"


def test_multi_route_rejects_report_evidence_not_bound_to_requested_material(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_multi_job(jobs)
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-mismatch"
    )
    bound = load_bound_decree_authority(
        jobs,
        authenticated_owner_user_id="owner-a",
        run_locator=RunLocatorV1(job_id=job_id),
    )
    cases_path = tmp_path / "cases.sqlite3"
    case = case_storage.open_case(
        case_models.JunjichuCaseOpenInput(
            decree_text="请户部、刑部只读会审已批准证据",
            route_type="multi",
            departments=["户部", "刑部"],
            run_id=job_id,
            decree_id=job_id,
            draft_fingerprint=bound.scope.draft_fingerprint,
            route_digest=bound.scope.route_digest,
        ),
        owner_user_id="owner-a",
        db_path=cases_path,
    )
    reports = (
        _ministry_report_for_council("户部", evidence_id="evidence:invented"),
        _ministry_report_for_council("刑部", evidence_id="evidence:invented"),
    )
    for report in reports:
        case_storage.append_runtime_ministry_report(
            case.id,
            owner_user_id="owner-a",
            run_id=job_id,
            report=report,
            db_path=cases_path,
        )
    case_storage.append_runtime_council_report(
        case.id,
        owner_user_id="owner-a",
        run_id=job_id,
        report=_council_report_for_case(
            reports, evidence_id="evidence:invented"
        ),
        db_path=cases_path,
    )

    envelope = resolve_six_ministry_decision(
        _request(pack.investigation_id),
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
        case_id=case.id,
        junjichu_db_path=cases_path,
    )

    assert envelope.decision.status == "degraded"
    assert [error.code for error in envelope.errors] == [
        DecisionErrorCode.JOINT_REVIEW_REQUIRED
    ]
    assert envelope.routing.joint_review.status == "pending"


def test_material_digest_tamper_and_audit_failure_are_stable_machine_errors(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="刑部", bureau="缺证核查司")
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-errors"
    )
    tampered = _request(pack.investigation_id).model_copy(
        update={
            "material_refs": (
                MaterialRefV1(
                    kind="evidence_pack",
                    opaque_id=pack.investigation_id,
                    expected_digest=f"sha256:{'f' * 64}",
                    version=1,
                ),
            )
        }
    )
    with pytest.raises(SixMinistryEvidenceServiceError) as digest_error:
        resolve_six_ministry_decision(
            tampered,
            current_user=_user(),
            job_id=job_id,
            decree_job_store=jobs,
            jinyiwei_db_path=evidence_path,
            binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
        )
    assert digest_error.value.code is DecisionErrorCode.MATERIAL_BINDING_MISMATCH

    class _FailingLedger:
        def get_for_execution(self, *args, **kwargs):
            del args, kwargs
            raise ExecutionLedgerError("runtime_binding_store_unavailable")

    with pytest.raises(SixMinistryEvidenceServiceError) as audit_error:
        resolve_six_ministry_decision(
            _request(pack.investigation_id),
            current_user=_user(),
            job_id=job_id,
            decree_job_store=jobs,
            jinyiwei_db_path=evidence_path,
            binding_ledger=_FailingLedger(),  # type: ignore[arg-type]
        )
    assert audit_error.value.code is DecisionErrorCode.AUDIT_WRITE_FAILED


def test_existing_binding_with_different_parent_lineage_fails_audit_closed(
    tmp_path: Path,
) -> None:
    jobs = DecreeJobStore(tmp_path / "jobs.sqlite3")
    job_id = _accept_job(jobs, department="刑部", bureau="缺证核查司")
    evidence_path = tmp_path / "evidence.sqlite3"
    pack = _store_pack(
        evidence_path, owner="owner-a", investigation_id="investigation-lineage"
    )
    ledger = RuntimeBindingLedger(tmp_path / "bindings.sqlite3")
    request = _request(pack.investigation_id)
    resolve_six_ministry_decision(
        request,
        current_user=_user(),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=evidence_path,
        binding_ledger=ledger,
    )

    class _ParentDriftLedger:
        def get_for_execution(self, *args, **kwargs):
            existing = ledger.get_for_execution(*args, **kwargs)
            return existing.model_copy(
                update={"parent_binding_ids": ("binding:unrelated-parent",)}
            )

        def append(self, binding):
            return ledger.append(binding)

    with pytest.raises(SixMinistryEvidenceServiceError) as caught:
        resolve_six_ministry_decision(
            request,
            current_user=_user(),
            job_id=job_id,
            decree_job_store=jobs,
            jinyiwei_db_path=evidence_path,
            binding_ledger=_ParentDriftLedger(),  # type: ignore[arg-type]
        )

    assert caught.value.code is DecisionErrorCode.AUDIT_WRITE_FAILED
