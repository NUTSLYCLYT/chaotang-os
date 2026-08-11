from __future__ import annotations

import pytest

from app.accounting_reports.models import CellProbe, CellRegion, SheetProbe, WorkbookProbe
from app.accounting_reports.semantic_mapping import (
    ConfidenceBand,
    DecisionProjection,
    MappingCandidate,
    MappingDecision,
    PublicationReadiness,
    derive_mapping_decisions,
    select_mapping,
)
from app.accounting_reports.validation import ValidationReceipt, validate_probe


def _candidate(candidate_id: str, role: str, score: float) -> MappingCandidate:
    return MappingCandidate(
        candidate_id=candidate_id,
        semantic_role=role,
        source_ref="approved-data:case:case-1:decree:decree-1:probe",
        sheet_index=0,
        region=(2, 10, 1, 6),
        column=5,
        score_components=(
            ("header_semantics", score - 0.1),
            ("period_tokens", 0.1),
        ),
        reason_codes=("HEADER_MATCH", "PERIOD_MATCH"),
    )


def test_highest_scored_mapping_is_selected_and_audited() -> None:
    candidates = (
        _candidate("closing", "closing_balance", 0.92),
        _candidate("alternate", "closing_balance", 0.71),
    )
    receipts = (
        ValidationReceipt("closing", True, ("NUMERIC_COLUMN",)),
        ValidationReceipt("alternate", True, ("NUMERIC_COLUMN",)),
    )

    decision = select_mapping(candidates, receipts)

    assert decision.selected.semantic_role == "closing_balance"
    assert decision.candidates[0].confidence > decision.candidates[1].confidence
    assert decision.reason_codes == (
        "HEADER_MATCH", "PERIOD_MATCH", "NUMERIC_COLUMN", "UNTRUSTED_VALIDATION"
    )
    assert decision.band is ConfidenceBand.HIGH
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT


def test_low_confidence_mapping_is_explicitly_draft_only() -> None:
    candidate = _candidate("guess", "closing_balance", 0.39)
    decision = select_mapping(
        (candidate,), (ValidationReceipt("guess", True, ("NUMERIC_COLUMN",)),)
    )

    assert decision.band is ConfidenceBand.LOW
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT
    assert "LOW_CONFIDENCE" in decision.reason_codes


def test_failed_deterministic_validation_is_draft_even_with_high_score() -> None:
    candidate = _candidate("closing", "closing_balance", 0.95)
    receipt = ValidationReceipt(
        "closing", False, ("STATEMENT_EQUATION_FAILED",), difference="12.50"
    )

    decision = select_mapping((candidate,), (receipt,))

    assert decision.band is ConfidenceBand.HIGH
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT
    assert decision.validation_receipt is receipt
    assert "VALIDATION_FAILED" in decision.reason_codes


def test_medium_confidence_is_selected_but_disclosed() -> None:
    candidate = _candidate("closing", "closing_balance", 0.72)
    decision = select_mapping(
        (candidate,), (ValidationReceipt("closing", True, ("NUMERIC_COLUMN",)),)
    )
    assert decision.band is ConfidenceBand.MEDIUM
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT
    assert "UNTRUSTED_VALIDATION" in decision.reason_codes


def test_candidate_score_is_derived_from_bounded_components() -> None:
    candidate = MappingCandidate(
        candidate_id="derived",
        semantic_role="closing_balance",
        source_ref="approved-data:case:case-1:decree:decree-1:probe",
        sheet_index=0,
        region=(1, 5, 1, 3),
        column=3,
        score_components=(("header_semantics", 0.6), ("data_type", 0.2)),
        reason_codes=("HEADER_MATCH",),
    )
    assert candidate.confidence == 0.8


def _balance_probe(*, assets: int = 100, liabilities: int = 40, equity: int = 60):
    cells = (
        CellProbe(1, 1, "text", "2025年资产负债表"),
        CellProbe(2, 1, "text", "项目"),
        CellProbe(2, 2, "text", "期末余额"),
        CellProbe(3, 1, "text", "资产合计"), CellProbe(3, 2, "number", assets),
        CellProbe(4, 1, "text", "负债合计"), CellProbe(4, 2, "number", liabilities),
        CellProbe(5, 1, "text", "所有者权益合计"), CellProbe(5, 2, "number", equity),
    )
    region = CellRegion(1, 5, 1, 2, 2, cells)
    return WorkbookProbe(
        "a" * 64,
        (2025,),
        (SheetProbe("任意名称", 5, 2, (region,)),),
    )


def test_real_probe_derives_candidate_and_financial_validation() -> None:
    decisions = derive_mapping_decisions(
        _balance_probe(),
        "approved-data:case:case-1:decree:decree-1:probe",
    )
    closing = next(item for item in decisions if item.selected.semantic_role == "closing_balance")
    assert closing.selected.column == 2
    assert "HEADER_MATCH" in closing.reason_codes
    assert "STATEMENT_EQUATION_PASSED" in closing.reason_codes
    assert closing.validation_receipt.passed is True
    assert closing.readiness is PublicationReadiness.VERIFIED


def test_failed_balance_equation_from_probe_is_draft() -> None:
    decision = derive_mapping_decisions(
        _balance_probe(equity=50),
        "approved-data:case:case-1:decree:decree-1:probe",
    )[0]
    assert decision.validation_receipt.passed is False
    assert "STATEMENT_EQUATION_FAILED" in decision.reason_codes
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT


def test_weak_header_from_real_probe_is_low_confidence_draft_with_disclosure() -> None:
    probe = _balance_probe()
    cells = tuple(
        CellProbe(cell.row, cell.column, cell.value_type,
                  "余额" if cell.value == "期末余额" else cell.value)
        for cell in probe.sheets[0].regions[0].cells
    )
    weak = WorkbookProbe(
        probe.sha256, probe.years,
        (SheetProbe("任意名称", 5, 2, (CellRegion(1, 5, 1, 2, 2, cells),)),),
    )
    decision = derive_mapping_decisions(
        weak, "approved-data:case:case-1:decree:decree-1:probe"
    )[0]
    assert decision.validation_receipt.passed is True
    assert decision.band is ConfidenceBand.LOW
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT
    assert "LOW_CONFIDENCE" in decision.reason_codes


def test_medium_mapping_with_valid_checks_is_disclosed_not_verified() -> None:
    probe = _balance_probe()
    cells = tuple(
        CellProbe(cell.row, cell.column, "text", cell.value)
        if cell.value_type == "number"
        else cell
        for cell in probe.sheets[0].regions[0].cells
    )
    medium_probe = WorkbookProbe(
        probe.sha256, (),
        (SheetProbe("任意名称", 5, 2, (CellRegion(1, 5, 1, 2, 2, cells),)),),
    )
    decision = derive_mapping_decisions(
        medium_probe, "approved-data:case:case-1:decree:decree-1:probe"
    )[0]
    assert decision.validation_receipt.passed is True
    assert decision.band is ConfidenceBand.MEDIUM
    assert decision.readiness is PublicationReadiness.DISCLOSED


def test_forged_high_confidence_receipt_cannot_become_verified() -> None:
    candidate = _candidate("forged", "closing_balance", 0.95)
    receipt = ValidationReceipt("forged", True, ("STATEMENT_EQUATION_PASSED",))
    decision = select_mapping((candidate,), (receipt,))
    assert decision.readiness is PublicationReadiness.INFERRED_DRAFT
    assert "UNTRUSTED_VALIDATION" in decision.reason_codes


def test_mapping_decision_rejects_inconsistent_selected_candidate() -> None:
    selected = _candidate("selected", "closing_balance", 0.9)
    other = _candidate("other", "closing_balance", 0.8)
    with pytest.raises(ValueError, match="mapping_selected_candidate_invalid"):
        MappingDecision(
            selected=selected,
            candidates=(other,),
            validation_receipt=ValidationReceipt(
                "selected", True, ("STATEMENT_EQUATION_PASSED",)
            ),
            band=ConfidenceBand.HIGH,
            readiness=PublicationReadiness.INFERRED_DRAFT,
            reason_codes=("UNTRUSTED_VALIDATION",),
        )


def test_validation_cannot_borrow_balancing_values_from_another_column() -> None:
    probe = _balance_probe()
    cells = tuple(
        CellProbe(cell.row, 3, cell.value_type, cell.value)
        if cell.value == "期末余额"
        else cell
        for cell in probe.sheets[0].regions[0].cells
    )
    wrong_column = WorkbookProbe(
        probe.sha256, probe.years,
        (SheetProbe("任意名称", 5, 3, (CellRegion(1, 5, 1, 3, 2, cells),)),),
    )
    decision = derive_mapping_decisions(
        wrong_column, "approved-data:case:case-1:decree:decree-1:probe"
    )[0]
    assert decision.selected.column == 3
    assert decision.validation_receipt.passed is False
    assert "NO_APPLICABLE_DETERMINISTIC_CHECK" in decision.reason_codes


def test_projection_rejects_confidence_component_contradiction() -> None:
    decision = derive_mapping_decisions(
        _balance_probe(), "approved-data:case:case-1:decree:decree-1:probe"
    )[0]
    from app.accounting_reports.semantic_mapping import project_decision

    payload = project_decision(decision).model_dump(mode="json")
    payload["candidates"][0]["confidence"] = 0.1
    with pytest.raises(ValueError):
        DecisionProjection.model_validate(payload)


@pytest.mark.parametrize(
    "candidate",
    [
        _candidate("bad-sheet", "closing_balance", 0.9),
        MappingCandidate(
            candidate_id="bad-region", semantic_role="closing_balance",
            source_ref="approved-data:case:case-1:decree:decree-1:probe",
            sheet_index=0, region=(2, 4, 1, 2), column=2,
            score_components=(("header_semantics", 0.9),), reason_codes=("HEADER_MATCH",),
        ),
        MappingCandidate(
            candidate_id="bad-column", semantic_role="closing_balance",
            source_ref="approved-data:case:case-1:decree:decree-1:probe",
            sheet_index=0, region=(1, 5, 1, 2), column=3,
            score_components=(("header_semantics", 0.9),), reason_codes=("HEADER_MATCH",),
        ),
    ],
)
def test_validation_refuses_invalid_candidate_location(candidate: MappingCandidate) -> None:
    if candidate.candidate_id == "bad-sheet":
        object.__setattr__(candidate, "sheet_index", 99)
    with pytest.raises(ValueError, match="candidate_source_region_invalid"):
        validate_probe(candidate, _balance_probe())


def test_mapping_decision_rejects_mixed_semantic_roles() -> None:
    selected = _candidate("closing", "closing_balance", 0.9)
    mixed = _candidate("opening", "opening_balance", 0.8)
    with pytest.raises(ValueError, match="mapping_candidate_role_mismatch"):
        MappingDecision(
            selected=selected, candidates=(selected, mixed),
            validation_receipt=ValidationReceipt("closing", True, ("CHECK",)),
            band=ConfidenceBand.HIGH,
            readiness=PublicationReadiness.INFERRED_DRAFT,
            reason_codes=("UNTRUSTED_VALIDATION",),
        )


def test_decision_projection_rejects_mixed_semantic_roles() -> None:
    decision = derive_mapping_decisions(
        _balance_probe(), "approved-data:case:case-1:decree:decree-1:probe"
    )[0]
    from app.accounting_reports.semantic_mapping import project_decision

    payload = project_decision(decision).model_dump(mode="json")
    payload["candidates"][0]["semantic_role"] = "opening_balance"
    with pytest.raises(ValueError, match="mapping_projection_inconsistent"):
        DecisionProjection.model_validate(payload)
