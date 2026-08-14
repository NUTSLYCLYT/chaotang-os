from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.agents.runtime_skills.deterministic_gates import (
    FinancialClaim,
    FinancialEvidenceProjection,
    FinancialGroundingInput,
    GateDecision,
    GateExecutionIdentity,
    PaymentAuthorityProjection,
    PaymentEvidenceProjection,
    PaymentGateDecision,
    PaymentGateInput,
    ResponsibilityAuthorityInput,
    ResponsibilityAuthorityProjection,
    evaluate_financial_grounding,
    evaluate_payment_three_gates,
    evaluate_responsibility_authority,
)
from app.work_products import (
    ArtifactGateReceipt,
    ArtifactManifestItem,
    ConfirmationReceipt,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
    semantic_digest,
)


def _claim(**overrides: object) -> FinancialClaim:
    payload: dict[str, object] = {
        "claim_id": "revenue",
        "amount": Decimal("100.00"),
        "source_ref": "evidence:ledger-2026-q2",
        "period": "2026-Q2",
        "basis": "accrual",
        "currency": "CNY",
    }
    payload.update(overrides)
    return FinancialClaim.model_validate(payload)


def _preview(
    *,
    owner_user_id: str = "owner-1",
    version: int = 3,
    confirmation_status: ConfirmationStatus = ConfirmationStatus.CONFIRMED,
) -> WorkProductEnvelope:
    envelope = WorkProductEnvelope(
        work_product_id="payment-preview-1",
        version=version,
        owner_user_id=owner_user_id,
        run_id="run-1",
        reply_id=None,
        capability_id="hubu-payment-preview",
        work_status=WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
        confirmation_status=ConfirmationStatus.PENDING,
        artifact_state="PUBLISHED",
        decision="Preview only; no payment was executed.",
        facts=(
            {
                "amount": Decimal("100.00"),
                "currency": "CNY",
                "payee_ref": "payee:supplier-1",
            },
        ),
        assumptions=(),
        recommendations=("Keep execution outside this capability.",),
        evidence_used=("contract:1", "acceptance:1"),
        missing_evidence=(),
        conflicts=(),
        risk_register=("Payment remains unexecuted.",),
        artifact_manifest=(
            ArtifactManifestItem(
                kind="payment_preview",
                ref="artifacts/payment-preview.json",
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
    issued = envelope.model_copy(
        update={"content_digest": semantic_digest(envelope.model_dump(mode="python"))}
    )
    return issued.model_copy(update={"confirmation_status": confirmation_status})


def _receipt(
    preview: WorkProductEnvelope,
    **overrides: object,
) -> ConfirmationReceipt:
    payload: dict[str, object] = {
        "work_product_id": preview.work_product_id,
        "version": preview.version,
        "sequence": 1,
        "decision": ConfirmationStatus.CONFIRMED,
        "actor_ref": f"user:{preview.owner_user_id}",
        "structured_reason": "Contract, acceptance, and amount were reviewed.",
        "created_at": datetime(2026, 8, 14, tzinfo=UTC),
    }
    payload.update(overrides)
    return ConfirmationReceipt.model_validate(payload)


def _financial_evidence(*claims: FinancialClaim) -> FinancialEvidenceProjection:
    return FinancialEvidenceProjection(
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        facts=tuple(
            {
                "claim_id": claim.claim_id,
                "source_ref": claim.source_ref or "evidence:missing",
                "requirement_key": "financial-records",
                "amount": claim.amount,
                "period": claim.period or "missing",
                "basis": claim.basis or "missing",
                "currency": claim.currency or "CNY",
                "tenant_id": "tenant-1",
                "owner_user_id": "owner-1",
                "run_id": "run-1",
            }
            for claim in claims
        ),
    )


def _payment_authority(
    preview: WorkProductEnvelope,
    receipt: ConfirmationReceipt,
    **overrides: object,
) -> PaymentAuthorityProjection:
    payload: dict[str, object] = {
        "tenant_id": "tenant-1",
        "owner_user_id": preview.owner_user_id,
        "run_id": preview.run_id,
        "preview_digest": preview.content_digest,
        "receipt_work_product_id": receipt.work_product_id,
        "receipt_version": receipt.version,
        "receipt_sequence": receipt.sequence,
        "evidence": (
            PaymentEvidenceProjection(
                ref="contract:1",
                kind="contract_basis",
                tenant_id="tenant-1",
                owner_user_id=preview.owner_user_id,
                run_id=preview.run_id,
                content_digest="b" * 64,
                authorized_amount="100.00",
                currency="CNY",
                payee_ref="payee:supplier-1",
            ),
            PaymentEvidenceProjection(
                ref="acceptance:1",
                kind="acceptance",
                tenant_id="tenant-1",
                owner_user_id=preview.owner_user_id,
                run_id=preview.run_id,
                content_digest="c" * 64,
            ),
        ),
    }
    payload.update(overrides)
    return PaymentAuthorityProjection.model_validate(payload)


def _responsibility_authority(
    request: ResponsibilityAuthorityInput,
) -> ResponsibilityAuthorityProjection:
    payload = dict(
        task_id=request.task_id,
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        projection_ref="authority:task-1",
        projection_digest="d" * 64,
        role_description_ref="approved:role-description",
        appointment_record_ref="approved:appointment-record",
        human_owner_ref=request.human_owner_ref or "user:missing",
        responsible_ref=request.responsible_ref or "user:missing-responsible",
        approver_ref=request.approver_ref or "user:missing-approver",
        independent_reviewer_ref=(
            request.independent_reviewer_ref or "user:missing-reviewer"
        ),
        substitute_ref=request.substitute_ref or "user:missing-substitute",
        high_privilege=request.high_privilege,
    )
    payload["projection_digest"] = semantic_digest(payload)
    return ResponsibilityAuthorityProjection.model_validate(payload)


def _identity() -> GateExecutionIdentity:
    return GateExecutionIdentity(
        tenant_id="tenant-1", owner_user_id="owner-1", run_id="run-1"
    )


def test_financial_grounding_requires_source_period_basis_and_currency() -> None:
    request = FinancialGroundingInput(
        claims=(
            _claim(
                source_ref=None,
                period=" ",
                basis=None,
                currency=None,
            ),
        )
    )

    result = evaluate_financial_grounding(
        request,
        execution_identity=_identity(),
        trusted_evidence=_financial_evidence(*request.claims),
    )

    assert result.decision is GateDecision.BLOCK
    assert result.reason_codes == (
        "FINANCIAL_SOURCE_MISSING",
        "FINANCIAL_PERIOD_MISSING",
        "FINANCIAL_BASIS_MISSING",
        "FINANCIAL_CURRENCY_MISSING",
    )
    assert result.claim_gaps[0].missing_fields == (
        "source_ref",
        "period",
        "basis",
        "currency",
    )


def test_financial_grounding_fails_closed_on_conflicting_facts_without_averaging() -> None:
    request = FinancialGroundingInput(
        claims=(
            _claim(amount=Decimal("100"), source_ref="evidence:ledger-a"),
            _claim(amount=Decimal("140"), source_ref="evidence:ledger-b"),
        )
    )

    result = evaluate_financial_grounding(
        request,
        execution_identity=_identity(),
        trusted_evidence=_financial_evidence(*request.claims),
    )

    assert result.decision is GateDecision.BLOCK
    assert result.reason_codes == ("FINANCIAL_FACT_CONFLICT",)
    assert result.conflicting_claim_ids == ("revenue",)
    assert result.grounded_claim_ids == ()
    assert "amount" not in type(result).model_fields
    assert "resolved_amount" not in type(result).model_fields


def test_financial_grounding_accepts_identical_fact_from_multiple_sources() -> None:
    request = FinancialGroundingInput(
            claims=(
                _claim(source_ref="evidence:ledger-a"),
                _claim(source_ref="evidence:ledger-b"),
            )
    )
    result = evaluate_financial_grounding(
        request,
        execution_identity=_identity(),
        trusted_evidence=_financial_evidence(*request.claims),
    )

    assert result.decision is GateDecision.PASS
    assert result.reason_codes == ()
    assert result.grounded_claim_ids == ("revenue",)


def test_financial_models_are_strict_frozen_and_reject_float_amounts() -> None:
    request = FinancialGroundingInput(claims=(_claim(),))
    with pytest.raises(ValidationError):
        FinancialGroundingInput.model_validate({"claims": [], "approved": True})
    with pytest.raises(ValidationError):
        FinancialClaim.model_validate(
            {
                **_claim().model_dump(),
                "amount": 1.5,
            }
        )
    with pytest.raises(ValidationError):
        FinancialClaim.model_validate({**_claim().model_dump(), "amount": "NaN"})
    with pytest.raises(ValidationError):
        request.claims += (_claim(claim_id="profit"),)


def test_financial_claim_must_match_the_tenant_bound_evidence_fact() -> None:
    claim = _claim(amount=Decimal("999999999"), period="2099-Q9", currency="USD")
    trusted = _financial_evidence(_claim(source_ref=claim.source_ref))

    result = evaluate_financial_grounding(
        FinancialGroundingInput(claims=(claim,)),
        execution_identity=_identity(),
        trusted_evidence=trusted,
    )

    assert result.decision is GateDecision.BLOCK
    assert "FINANCIAL_FACT_EVIDENCE_MISMATCH" in result.reason_codes
    assert result.grounded_claim_ids == ()


def test_payment_three_gates_only_returns_non_executing_preview_when_all_bind() -> None:
    preview = _preview()
    request = PaymentGateInput(
        contract_basis_refs=("contract:1",),
        acceptance_evidence_refs=("acceptance:1",),
    )

    receipt = _receipt(preview)
    result = evaluate_payment_three_gates(
        request,
        trusted_preview=preview,
        trusted_confirmation_receipt=receipt,
        execution_identity=_identity(),
        trusted_authority=_payment_authority(preview, receipt),
    )

    assert result.decision is PaymentGateDecision.PREVIEW
    assert result.reason_codes == ()
    assert result.preview_digest == preview.content_digest
    assert result.owner_user_id == preview.owner_user_id
    assert result.version == preview.version
    assert result.payment_executed is False
    assert result.side_effects == ()


def test_payment_gate_holds_when_a_gate_is_missing() -> None:
    preview = _preview(confirmation_status=ConfirmationStatus.PENDING)

    result = evaluate_payment_three_gates(
        PaymentGateInput(),
        trusted_preview=preview,
        trusted_confirmation_receipt=None,
        execution_identity=_identity(),
        trusted_authority=_payment_authority(preview, _receipt(preview)),
    )

    assert result.decision is PaymentGateDecision.HOLD
    assert result.reason_codes == (
        "PAYMENT_CONTRACT_BASIS_MISSING",
        "PAYMENT_ACCEPTANCE_EVIDENCE_MISSING",
        "PAYMENT_CONFIRMATION_MISSING",
    )
    assert result.payment_executed is False


@pytest.mark.parametrize(
    ("receipt_overrides", "reason_code"),
    [
        ({"work_product_id": "another-preview"}, "PAYMENT_CONFIRMATION_PREVIEW_MISMATCH"),
        ({"version": 2}, "PAYMENT_CONFIRMATION_VERSION_MISMATCH"),
        ({"actor_ref": "user:another-owner"}, "PAYMENT_CONFIRMATION_OWNER_MISMATCH"),
    ],
)
def test_payment_confirmation_must_bind_current_preview_owner_and_version(
    receipt_overrides: dict[str, object], reason_code: str
) -> None:
    preview = _preview()
    receipt = _receipt(preview, **receipt_overrides)
    result = evaluate_payment_three_gates(
        PaymentGateInput(
            contract_basis_refs=("contract:1",),
            acceptance_evidence_refs=("acceptance:1",),
        ),
        trusted_preview=preview,
        trusted_confirmation_receipt=receipt,
        execution_identity=_identity(),
        trusted_authority=_payment_authority(preview, receipt),
    )

    assert result.decision is PaymentGateDecision.BLOCK
    assert reason_code in result.reason_codes
    assert result.payment_executed is False


def test_payment_gate_blocks_tampered_digest_and_unbound_evidence() -> None:
    preview = _preview().model_copy(update={"decision": "Tampered preview."})

    receipt = _receipt(preview)
    result = evaluate_payment_three_gates(
        PaymentGateInput(
            contract_basis_refs=("contract:not-in-preview",),
            acceptance_evidence_refs=("acceptance:not-in-preview",),
        ),
        trusted_preview=preview,
        trusted_confirmation_receipt=receipt,
        execution_identity=_identity(),
        trusted_authority=_payment_authority(preview, receipt),
    )

    assert result.decision is PaymentGateDecision.BLOCK
    assert result.reason_codes == (
        "PAYMENT_PREVIEW_DIGEST_MISMATCH",
        "PAYMENT_CONTRACT_BASIS_UNBOUND",
        "PAYMENT_ACCEPTANCE_EVIDENCE_UNBOUND",
        "PAYMENT_CONTRACT_EVIDENCE_KIND_INVALID",
        "PAYMENT_ACCEPTANCE_EVIDENCE_KIND_INVALID",
    )


def test_payment_payload_cannot_self_assert_confirmation_owner_or_execution() -> None:
    with pytest.raises(ValidationError):
        PaymentGateInput.model_validate(
            {
                "contract_basis_refs": ["contract:1"],
                "acceptance_evidence_refs": ["acceptance:1"],
                "confirmed": True,
                "owner_user_id": "owner-1",
                "payment_executed": True,
            }
        )


def test_payment_gate_rejects_old_receipt_for_replaced_content_or_another_run() -> None:
    original = _preview()
    receipt = _receipt(original)
    replacement = _preview().model_copy(
        update={"run_id": "run-2", "decision": "Replacement preview."}
    )
    replacement = replacement.model_copy(
        update={
            "content_digest": semantic_digest(
                replacement.model_copy(
                    update={"confirmation_status": ConfirmationStatus.PENDING}
                ).model_dump(mode="python")
            )
        }
    )

    result = evaluate_payment_three_gates(
        PaymentGateInput(
            contract_basis_refs=("contract:1",),
            acceptance_evidence_refs=("acceptance:1",),
        ),
        trusted_preview=replacement,
        trusted_confirmation_receipt=receipt,
        execution_identity=_identity(),
        trusted_authority=_payment_authority(original, receipt),
    )

    assert result.decision is PaymentGateDecision.BLOCK
    assert "PAYMENT_AUTHORITY_IDENTITY_MISMATCH" in result.reason_codes
    assert "PAYMENT_AUTHORITY_PREVIEW_DIGEST_MISMATCH" in result.reason_codes


def test_payment_gate_rejects_wrong_evidence_kind_and_contract_terms() -> None:
    preview = _preview()
    receipt = _receipt(preview)
    authority = _payment_authority(
        preview,
        receipt,
        evidence=(
            PaymentEvidenceProjection(
                ref="contract:1",
                kind="contract_basis",
                tenant_id="tenant-1",
                owner_user_id=preview.owner_user_id,
                run_id=preview.run_id,
                content_digest="b" * 64,
                authorized_amount="90.00",
                currency="CNY",
                payee_ref="payee:other",
            ),
            PaymentEvidenceProjection(
                ref="acceptance:1",
                kind="acceptance",
                tenant_id="tenant-1",
                owner_user_id=preview.owner_user_id,
                run_id=preview.run_id,
                content_digest="c" * 64,
            ),
        ),
    )

    result = evaluate_payment_three_gates(
        PaymentGateInput(
            contract_basis_refs=("contract:1",),
            acceptance_evidence_refs=("acceptance:1",),
        ),
        trusted_preview=preview,
        trusted_confirmation_receipt=receipt,
        execution_identity=_identity(),
        trusted_authority=authority,
    )

    assert result.decision is PaymentGateDecision.BLOCK
    assert "PAYMENT_PREVIEW_CONTRACT_TERMS_MISMATCH" in result.reason_codes


def test_responsibility_chain_requires_complete_human_accountability() -> None:
    request = ResponsibilityAuthorityInput(
            task_id="task-1",
            human_owner_ref="user:owner-1",
            responsible_ref="user:operator-1",
            approver_ref="user:approver-1",
            independent_reviewer_ref="user:reviewer-1",
            substitute_ref="user:substitute-1",
            high_privilege=False,
    )
    result = evaluate_responsibility_authority(
        request,
        execution_identity=_identity(),
        trusted_authority=_responsibility_authority(request),
    )

    assert result.decision is GateDecision.PASS
    assert result.reason_codes == ()
    assert result.side_effects == ()


def test_high_privilege_chain_blocks_nonhuman_owner_and_self_review() -> None:
    result = evaluate_responsibility_authority(
        ResponsibilityAuthorityInput(
            task_id="task-1",
            human_owner_ref="agent:libu",
            responsible_ref="user:operator-1",
            approver_ref="user:operator-1",
            independent_reviewer_ref="user:operator-1",
            substitute_ref="user:substitute-1",
            high_privilege=True,
        ),
        execution_identity=_identity(),
        trusted_authority=_responsibility_authority(
            ResponsibilityAuthorityInput(
                task_id="task-1",
                human_owner_ref="user:real-owner",
                responsible_ref="user:responsible",
                approver_ref="user:approver",
                independent_reviewer_ref="user:reviewer",
                substitute_ref="user:substitute",
                high_privilege=True,
            )
        ),
    )

    assert result.decision is GateDecision.BLOCK
    assert result.reason_codes == (
        "HIGH_PRIVILEGE_HUMAN_OWNER_REQUIRED",
        "RESPONSIBLE_APPROVER_CONFLICT",
        "INDEPENDENT_REVIEWER_CONFLICT",
        "RESPONSIBILITY_AUTHORITY_MISMATCH",
    )


def test_incomplete_normal_responsibility_chain_holds_with_stable_codes() -> None:
    incomplete = ResponsibilityAuthorityInput(task_id="task-1")
    result = evaluate_responsibility_authority(
        incomplete,
        execution_identity=_identity(),
        trusted_authority=_responsibility_authority(incomplete),
    )

    assert result.decision is GateDecision.BLOCK
    assert result.reason_codes == (
        "HUMAN_OWNER_MISSING",
        "RESPONSIBLE_PARTY_MISSING",
        "APPROVER_MISSING",
        "INDEPENDENT_REVIEWER_MISSING",
        "SUBSTITUTE_MISSING",
        "RESPONSIBILITY_AUTHORITY_MISMATCH",
    )


def test_responsibility_models_are_strict_and_frozen() -> None:
    request = ResponsibilityAuthorityInput(task_id="task-1")
    with pytest.raises(ValidationError):
        ResponsibilityAuthorityInput.model_validate(
            {"task_id": "task-1", "is_authorized": True}
        )
    with pytest.raises(ValidationError):
        request.task_id = "task-2"


def test_responsibility_chain_cannot_self_assert_different_authority_roles() -> None:
    request = ResponsibilityAuthorityInput(
        task_id="task-1",
        human_owner_ref="user:attacker-owner",
        responsible_ref="agent:attacker-responsible",
        approver_ref="agent:attacker-approver",
        independent_reviewer_ref="agent:attacker-reviewer",
        substitute_ref="agent:attacker-substitute",
    )
    payload = dict(
        task_id="task-1",
        tenant_id="tenant-1",
        owner_user_id="owner-1",
        run_id="run-1",
        projection_ref="authority:task-1",
        projection_digest="d" * 64,
        role_description_ref="approved:role-description",
        appointment_record_ref="approved:appointment-record",
        human_owner_ref="user:real-owner",
        responsible_ref="agent:real-responsible",
        approver_ref="user:real-approver",
        independent_reviewer_ref="user:real-reviewer",
        substitute_ref="user:real-substitute",
        high_privilege=False,
    )
    payload["projection_digest"] = semantic_digest(payload)
    trusted = ResponsibilityAuthorityProjection.model_validate(payload)

    result = evaluate_responsibility_authority(
        request, execution_identity=_identity(), trusted_authority=trusted
    )

    assert result.decision is GateDecision.BLOCK
    assert result.reason_codes == ("RESPONSIBILITY_AUTHORITY_MISMATCH",)


def test_classifier_values_do_not_claim_server_issuance_and_identity_mismatch_blocks() -> None:
    claim = _claim()
    evidence = _financial_evidence(claim).model_copy(update={"tenant_id": "tenant-evil"})
    result = evaluate_financial_grounding(
        FinancialGroundingInput(claims=(claim,)),
        execution_identity=_identity(),
        trusted_evidence=evidence,
    )

    assert result.decision is GateDecision.BLOCK
    assert "FINANCIAL_EVIDENCE_EXECUTION_IDENTITY_MISMATCH" in result.reason_codes
