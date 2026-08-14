from __future__ import annotations

import hashlib
import inspect
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest

from app.accounting_reports.contract import _ledger_fact_id
from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.storage import ArtifactStorage
from app.agents.runtime_skills.accounting_evidence_adapter import (
    ACCOUNTING_ISOLATION_SCOPE,
    AccountingEvidenceResolutionError,
    execute_accounting_evidence_gate,
)
from app.agents.runtime_skills.deterministic_gates import FinancialEvidenceProjection
from app.agents.runtime_skills.execution_ledger import RuntimeBindingLedger
from app.agents.runtime_skills.models import ReportStatus, SkillInvocation
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry
from app.agents.runtime_skills.six_ministry_evidence_service import (
    DecisionRequestV1,
    MaterialRefV1,
    RequestConstraintsV1,
    resolve_six_ministry_decision,
)
from app.auth.models import AuthenticatedUser
from app.decree_jobs.models import AcceptDecreeJob
from app.decree_jobs.storage import DecreeJobStore
from app.work_products import (
    ArtifactGateReceipt,
    ArtifactManifestItem,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
    semantic_digest,
)


def _job_store(tmp_path: Path) -> DecreeJobStore:
    return DecreeJobStore(tmp_path / "jobs.sqlite3")


def _artifact_storage(tmp_path: Path) -> ArtifactStorage:
    return ArtifactStorage(
        artifact_dir=tmp_path / "artifacts",
        db_path=tmp_path / "artifacts.sqlite3",
    )


def _accept_job(
    store: DecreeJobStore,
    *,
    owner: str = "owner-a",
    accounting_route: bool = True,
) -> str:
    route = {
        "approved_route": {
            "departments": [
                {
                    "department": "户部",
                    "required_bureaus": ["会计司" if accounting_route else "预算司"],
                }
            ]
        },
        "accounting_context": {
            "request_kind": "ACCOUNTING_REPORT",
            "period": {"start_year": 2025, "end_year": 2025},
            "source_fingerprint": None,
        },
    }
    value = uuid4().hex
    return store.accept(
        AcceptDecreeJob(
            owner_user_id=owner,
            idempotency_key=f"key-{value}",
            request_hash=f"hash-{value}",
            draft_fingerprint=hashlib.sha256(value.encode()).hexdigest(),
            decree_text="请户部会计司复核账务",
            approved_route_json=json.dumps(route, ensure_ascii=False),
            deadline_at=datetime.now(UTC) + timedelta(minutes=30),
        )
    ).job.job_id


def _facts() -> tuple[dict[str, object], ...]:
    facts: list[dict[str, object]] = []
    for index, (name, amount) in enumerate(
        (("1001", Decimal("100.00")), ("2202", Decimal("40.00"))), start=1
    ):
        digest = hashlib.sha256(f"source-{index}".encode()).hexdigest()
        source_ref = f"{digest}:总账:{index}"
        facts.append(
            {
                "fact_id": _ledger_fact_id(
                    source_ref=source_ref, account_code=name, amount=amount
                ),
                "name": name,
                "amount": amount,
                "source_ref": source_ref,
                "source_digest": digest,
                "rule_id": "accounting-rules-v1:ledger-closing",
                "source_human_confirmed": False,
            }
        )
    return tuple(facts)


def _work_product(
    *,
    owner: str,
    run_id: str,
    facts: tuple[dict[str, object], ...] | None = None,
    digest_valid: bool = True,
    capability_id: str = "accounting-report",
    work_status: WorkProductStatus = WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
) -> WorkProductEnvelope:
    facts = _facts() if facts is None else facts
    envelope = WorkProductEnvelope(
        work_product_id=uuid4().hex,
        version=1,
        owner_user_id=owner,
        run_id=run_id,
        reply_id=None,
        capability_id=capability_id,
        work_status=work_status,
        confirmation_status=ConfirmationStatus.PENDING,
        artifact_state="PENDING",
        decision="Review the deterministic accounting report.",
        facts=facts,
        assumptions=(),
        recommendations=("Review the accounting evidence.",),
        evidence_used=tuple(str(fact["source_digest"]) for fact in facts),
        missing_evidence=(),
        conflicts=(),
        risk_register=("No external action is authorized.",),
        artifact_manifest=(
            ArtifactManifestItem(
                kind="work_product_envelope",
                ref="work-product-envelope.json",
                content_digest="a" * 64,
                traceable=True,
            ),
        ),
        artifact_gate=ArtifactGateReceipt(
            status="PASSED",
            reason_codes=(),
            missing_kinds=(),
            unexpected_kinds=(),
        ),
        content_digest="0" * 64,
        created_at=datetime(2026, 8, 14, tzinfo=UTC),
    )
    correct = semantic_digest(envelope.model_dump(mode="python"))
    return envelope.model_copy(
        update={"content_digest": correct if digest_valid else "f" * 64}
    )


def _store_work_product(
    storage: ArtifactStorage,
    product: WorkProductEnvelope,
) -> WorkProductEnvelope:
    content = b"deterministic workbook"
    incoming = storage.artifact_dir / f".{uuid4().hex}.xlsx"
    incoming.write_bytes(content)
    artifact = storage.create_pending(
        owner_user_id=product.owner_user_id,
        run_id=product.run_id,
        report_type="management",
        display_name="management.xlsx",
        period=ReportPeriod(2025, 2025),
        source_hashes=("a" * 64,),
        file_sha256=hashlib.sha256(content).hexdigest(),
        pending_path=incoming,
    )
    return storage.create_work_product(
        product.owner_user_id, artifact.artifact_id, product
    )


def _invocation(facts: tuple[dict[str, object], ...] | None = None) -> SkillInvocation:
    skill = build_default_downstream_skill_registry().get_by_agent("hubu-accounting")
    facts = _facts() if facts is None else facts
    refs = tuple(str(fact["source_ref"]) for fact in facts)
    return SkillInvocation(
        request_id=f"request-{uuid4().hex}",
        agent_id=skill.agent_id,
        skill_id=skill.skill_id,
        skill_version=skill.version,
        # Caller refs are replaced by reloaded server-owned refs.
        evidence_refs=tuple(f"caller:{index}" for index in range(len(refs))),
        requirement_data_refs={
            requirement: (f"caller:{index}",)
            for index, requirement in enumerate(skill.data_requirements)
        },
    )


def _execute(
    *,
    owner: str,
    job_id: str,
    product: WorkProductEnvelope,
    job_store: DecreeJobStore,
    artifact_storage: ArtifactStorage,
):
    return execute_accounting_evidence_gate(
        owner_user_id=owner,
        job_id=job_id,
        work_product_id=product.work_product_id,
        invocation=_invocation(tuple(dict(fact) for fact in product.facts)),
        decree_job_store=job_store,
        artifact_storage=artifact_storage,
    )


def test_hubu_reloads_owner_scoped_records_and_completes_with_no_side_effects(
    tmp_path: Path,
) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _store_work_product(
        artifacts, _work_product(owner="owner-a", run_id=job_id)
    )

    result = _execute(
        owner="owner-a",
        job_id=job_id,
        product=product,
        job_store=jobs,
        artifact_storage=artifacts,
    )

    assert result.report.status is ReportStatus.COMPLETED
    assert result.report.evidence_sufficiency.value == "sufficient"
    assert result.report.agent_id == "hubu-accounting"
    assert result.report.input_refs == (f"work-product:{product.work_product_id}",)
    assert all(not ref.startswith("caller:") for ref in result.report.evidence_refs)
    assert result.report.out_of_scope_items == (
        "posting, payment, tax filing, or any external action",
    )
    assert result.audit.status is ReportStatus.COMPLETED
    assert ACCOUNTING_ISOLATION_SCOPE == "owner_only"


@pytest.mark.parametrize(
    "work_status",
    (WorkProductStatus.NEEDS_DATA, WorkProductStatus.NEEDS_REVIEW),
)
def test_hubu_cannot_promote_ineligible_work_product_lifecycle(
    tmp_path: Path, work_status: WorkProductStatus
) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _store_work_product(
        artifacts,
        _work_product(owner="owner-a", run_id=job_id, work_status=work_status),
    )

    with pytest.raises(
        AccountingEvidenceResolutionError,
        match="accounting_work_product_lifecycle_invalid",
    ):
        _execute(
            owner="owner-a",
            job_id=job_id,
            product=product,
            job_store=jobs,
            artifact_storage=artifacts,
        )


def test_hubu_cannot_promote_escalated_or_aborted_work_product(
    tmp_path: Path,
) -> None:
    jobs = _job_store(tmp_path)
    job_id = _accept_job(jobs)

    escalated_storage = _artifact_storage(tmp_path / "escalated")
    escalated = _store_work_product(
        escalated_storage, _work_product(owner="owner-a", run_id=job_id)
    )
    escalated_storage.append_confirmation(
        "owner-a",
        escalated.work_product_id,
        ConfirmationStatus.ESCALATED,
        "user:owner-a",
        "requires additional authority",
    )
    escalated = escalated_storage.get_work_product(
        "owner-a", escalated.work_product_id
    )
    with pytest.raises(
        AccountingEvidenceResolutionError,
        match="accounting_work_product_lifecycle_invalid",
    ):
        _execute(
            owner="owner-a",
            job_id=job_id,
            product=escalated,
            job_store=jobs,
            artifact_storage=escalated_storage,
        )

    aborted_storage = _artifact_storage(tmp_path / "aborted")
    aborted = _store_work_product(
        aborted_storage, _work_product(owner="owner-a", run_id=job_id)
    )
    aborted_storage.abort_run("owner-a", job_id)
    with pytest.raises(
        AccountingEvidenceResolutionError,
        match="accounting_work_product_lifecycle_invalid",
    ):
        _execute(
            owner="owner-a",
            job_id=job_id,
            product=aborted,
            job_store=jobs,
            artifact_storage=aborted_storage,
        )


def test_hubu_real_work_product_uses_the_unified_decision_envelope(
    tmp_path: Path,
) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _store_work_product(
        artifacts, _work_product(owner="owner-a", run_id=job_id)
    )
    request = DecisionRequestV1(
        request_id=f"decision-{uuid4().hex}",
        objective="复核已持久化会计事实并形成只读预览",
        material_refs=(
            MaterialRefV1(
                kind="work_product",
                opaque_id=product.work_product_id,
                expected_digest=f"sha256:{product.content_digest}",
                version=product.version,
            ),
        ),
        constraints=RequestConstraintsV1(
            as_of=datetime(2026, 8, 14, tzinfo=UTC),
            output_language="zh-CN",
        ),
    )

    envelope = resolve_six_ministry_decision(
        request,
        current_user=AuthenticatedUser(
            id="owner-a",
            username="user-owner-a",
            email="owner-a@example.test",
        ),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=tmp_path / "unused-evidence.sqlite3",
        binding_ledger=RuntimeBindingLedger(tmp_path / "bindings.sqlite3"),
        artifact_storage=artifacts,
    )

    assert envelope.routing.accountable_ministry == "hubu"
    assert envelope.runtime_binding.skill_id == "analyze-accounting-position"
    assert envelope.evidence.projection_mode == "accounting_grounding"
    assert envelope.decision.status == "completed"
    assert envelope.decision.artifact_refs == (
        envelope.decision.artifact_refs[0],
    )
    assert envelope.decision.artifact_refs[0].artifact_type == "work_product_preview"
    assert envelope.external_effects.authorized is False


def test_hubu_binds_existing_confirmation_receipt_without_authorizing_effects(
    tmp_path: Path,
) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _store_work_product(
        artifacts, _work_product(owner="owner-a", run_id=job_id)
    )
    receipt = artifacts.append_confirmation(
        "owner-a",
        product.work_product_id,
        ConfirmationStatus.CONFIRMED,
        "user:owner-a",
        "human-reviewed-accounting-preview",
    )
    ledger = RuntimeBindingLedger(tmp_path / "bindings.sqlite3")
    request = DecisionRequestV1(
        request_id=f"decision-{uuid4().hex}",
        objective="复核已由当前用户确认的会计预览，但不得执行付款或过账",
        material_refs=(
            MaterialRefV1(
                kind="work_product",
                opaque_id=product.work_product_id,
                expected_digest=f"sha256:{product.content_digest}",
                version=product.version,
            ),
        ),
        constraints=RequestConstraintsV1(
            as_of=datetime(2026, 8, 14, tzinfo=UTC),
            output_language="zh-CN",
        ),
    )

    envelope = resolve_six_ministry_decision(
        request,
        current_user=AuthenticatedUser(
            id="owner-a",
            username="user-owner-a",
            email="owner-a@example.test",
        ),
        job_id=job_id,
        decree_job_store=jobs,
        jinyiwei_db_path=tmp_path / "unused-evidence.sqlite3",
        binding_ledger=ledger,
        artifact_storage=artifacts,
    )

    receipt_audit = next(
        item
        for item in envelope.audit_refs
        if item.ref_id.startswith("binding:confirmation-receipt:")
    )
    stored = ledger.get_for_execution(
        receipt_audit.ref_id,
        owner_user_id="owner-a",
        run_id=job_id,
    )
    assert stored.resource_ref == (
        f"confirmation-receipt:{receipt.work_product_id}:{receipt.sequence}"
    )
    assert receipt_audit.event_type == "authority_decision"
    assert envelope.decision.status == "completed"
    assert envelope.decision.action_disposition == "preview"
    assert envelope.external_effects.authorized is False
    assert envelope.external_effects.effect_count == 0


def test_public_entry_cannot_accept_a_caller_financial_projection() -> None:
    signature = inspect.signature(execute_accounting_evidence_gate)

    assert "trusted_evidence" not in signature.parameters
    assert "financial_projection" not in signature.parameters
    assert not any(
        parameter.annotation is FinancialEvidenceProjection
        for parameter in signature.parameters.values()
    )


@pytest.mark.parametrize("case", ["cross_owner", "wrong_run", "tamper"])
def test_hubu_sensitive_failures_use_stable_non_enumerating_codes(
    tmp_path: Path,
    case: str,
) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _work_product(
        owner="owner-a",
        run_id="different-job" if case == "wrong_run" else job_id,
        digest_valid=case != "tamper",
    )
    product = _store_work_product(artifacts, product)

    with pytest.raises(AccountingEvidenceResolutionError) as caught:
        _execute(
            owner="owner-b" if case == "cross_owner" else "owner-a",
            job_id=job_id,
            product=product,
            job_store=jobs,
            artifact_storage=artifacts,
        )

    expected = {
        "cross_owner": "accounting_evidence_unavailable",
        "wrong_run": "accounting_execution_identity_mismatch",
        "tamper": "accounting_evidence_integrity_invalid",
    }[case]
    assert caught.value.args == (expected,)
    message = str(caught.value)
    assert product.work_product_id not in message
    assert job_id not in message
    assert "owner-a" not in message


def test_hubu_missing_facts_is_an_honest_degraded_runtime_report(tmp_path: Path) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _store_work_product(
        artifacts,
        _work_product(owner="owner-a", run_id=job_id, facts=()),
    )

    result = _execute(
        owner="owner-a",
        job_id=job_id,
        product=product,
        job_store=jobs,
        artifact_storage=artifacts,
    )

    assert result.report.status is ReportStatus.DEGRADED
    assert "FINANCIAL_CLAIMS_MISSING" in result.report.data_gaps
    assert result.audit.status is ReportStatus.DEGRADED


def test_hubu_rejects_job_without_accounting_bureau_authority(tmp_path: Path) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs, accounting_route=False)
    product = _store_work_product(
        artifacts, _work_product(owner="owner-a", run_id=job_id)
    )

    with pytest.raises(
        AccountingEvidenceResolutionError,
        match="^accounting_route_unauthorized$",
    ):
        _execute(
            owner="owner-a",
            job_id=job_id,
            product=product,
            job_store=jobs,
            artifact_storage=artifacts,
        )


def test_hubu_rejects_non_accounting_work_product_capability(tmp_path: Path) -> None:
    jobs = _job_store(tmp_path)
    artifacts = _artifact_storage(tmp_path)
    job_id = _accept_job(jobs)
    product = _store_work_product(
        artifacts,
        _work_product(
            owner="owner-a",
            run_id=job_id,
            capability_id="payment-preview",
        ),
    )

    with pytest.raises(
        AccountingEvidenceResolutionError,
        match="^accounting_work_product_invalid$",
    ):
        _execute(
            owner="owner-a",
            job_id=job_id,
            product=product,
            job_store=jobs,
            artifact_storage=artifacts,
        )
