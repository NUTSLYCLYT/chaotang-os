from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from operator import attrgetter

from .models import CellProbe, WorkbookProbe

_VALIDATION_KEY = secrets.token_bytes(32)
_CANDIDATE_BINDING = attrgetter(
    "candidate_id", "semantic_role", "sheet_index", "region", "column", "source_ref"
)


@dataclass(frozen=True, slots=True, repr=False)
class ValidationReceipt:
    """Deterministic checks attached to one semantic candidate."""

    candidate_id: str
    passed: bool
    reason_codes: tuple[str, ...]
    difference: str | None = None
    probe_sha256: str | None = None
    snapshot_digest: str | None = None
    candidate_binding_digest: str | None = None
    check_inputs_digest: str | None = None
    _signature: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.candidate_id, str) or not self.candidate_id.strip():
            raise ValueError("candidate_id_required")
        if not isinstance(self.passed, bool):
            raise TypeError("passed_must_be_bool")
        if not self.reason_codes or any(
            not isinstance(code, str) or not code.strip() for code in self.reason_codes
        ):
            raise ValueError("validation_reason_codes_required")
        if self.difference is not None and (
            not isinstance(self.difference, str) or not self.difference.strip()
        ):
            raise ValueError("validation_difference_invalid")

    def __repr__(self) -> str:
        return (
            "ValidationReceipt("
            f"candidate_id={self.candidate_id!r}, passed={self.passed!r}, <redacted>)"
        )

    @property
    def system_validated(self) -> bool:
        return bool(
            self._signature
            and hmac.compare_digest(self._signature, _receipt_signature(self))
        )


def _receipt_signature(receipt: ValidationReceipt) -> str:
    fields = (
        receipt.candidate_id, receipt.passed, receipt.reason_codes,
        receipt.difference, receipt.probe_sha256, receipt.snapshot_digest,
        receipt.candidate_binding_digest, receipt.check_inputs_digest,
    )
    payload = json.dumps(fields, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hmac.new(
        _VALIDATION_KEY, f"{id(receipt)}:{payload}".encode(), hashlib.sha256
    ).hexdigest()


def receipt_matches_candidate(receipt: ValidationReceipt, candidate: object) -> bool:
    binding = _CANDIDATE_BINDING(candidate)
    digest = hashlib.sha256(json.dumps(
        binding, ensure_ascii=False, default=str, separators=(",", ":"),
    ).encode()).hexdigest()
    return bool(receipt.system_validated and receipt.candidate_binding_digest == digest)


def _number(value: object) -> Decimal | None:
    if isinstance(value, bool):
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return result if result.is_finite() else None


def _labeled_amounts(probe: WorkbookProbe, candidate: object) -> tuple[dict[str, Decimal], ...]:
    sheets: list[dict[str, Decimal]] = []
    _, _, selected_sheet, selected_region, selected_column, _ = _CANDIDATE_BINDING(
        candidate
    )
    if not isinstance(selected_sheet, int) or not 0 <= selected_sheet < len(probe.sheets):
        raise ValueError("candidate_source_region_invalid")
    selected_sheet_probe = probe.sheets[selected_sheet]
    exact_regions = [
        region for region in selected_sheet_probe.regions
        if (
            region.start_row, region.end_row,
            region.start_column, region.end_column,
        ) == selected_region
    ]
    if (
        len(exact_regions) != 1
        or not selected_region[2] <= selected_column <= selected_region[3]
    ):
        raise ValueError("candidate_source_region_invalid")
    for sheet in probe.sheets:
        values: dict[tuple[int, int], CellProbe] = {}
        for region in sheet.regions:
            if (
                region.start_row, region.end_row,
                region.start_column, region.end_column,
            ) != selected_region:
                continue
            values.update({(cell.row, cell.column): cell for cell in region.cells})
        if not values:
            continue
        labeled: dict[str, Decimal] = {}
        for (row, _column), cell in values.items():
            if not isinstance(cell.value, str):
                continue
            amount_cell = values.get((row, selected_column))
            amount = _number(amount_cell.value) if amount_cell else None
            if amount is not None:
                labeled[cell.value.strip()] = amount
        sheets.append(labeled)
    return tuple(sheets)


def validate_probe(candidate: object, probe: WorkbookProbe) -> ValidationReceipt:
    """Run applicable deterministic accounting identities over frozen probe cells."""

    candidate_id, semantic_role, sheet_index, region, column, source_ref = (
        _CANDIDATE_BINDING(candidate)
    )
    sheets = _labeled_amounts(probe, candidate)
    reasons: list[str] = []
    differences: list[Decimal] = []
    passed = True
    applied = False
    for values in sheets:
        assets = values.get("资产合计")
        liabilities = values.get("负债合计")
        equity = values.get("所有者权益合计")
        if equity is None:
            equity = values.get("股东权益合计")
        if None not in (assets, liabilities, equity):
            applied = True
            difference = assets - liabilities - equity  # type: ignore[operator]
            differences.append(difference)
            ok = difference == 0
            passed &= ok
            reasons.append(
                "STATEMENT_EQUATION_PASSED" if ok else "STATEMENT_EQUATION_FAILED"
            )
        debit = values.get("借方合计")
        credit = values.get("贷方合计")
        if debit is not None and credit is not None:
            applied = True
            difference = debit - credit
            differences.append(difference)
            ok = difference == 0
            passed &= ok
            reasons.append("DEBIT_CREDIT_BALANCED" if ok else "DEBIT_CREDIT_IMBALANCE")
        total = values.get("合计")
        parts = [amount for label, amount in values.items() if label.startswith("其中")]
        if total is not None and parts:
            applied = True
            difference = total - sum(parts, Decimal(0))
            differences.append(difference)
            ok = difference == 0
            passed &= ok
            reasons.append("TOTAL_RECONCILED" if ok else "TOTAL_MISMATCH")
    shared_labels = (
        set.intersection(*(set(sheet) for sheet in sheets))
        if len(sheets) > 1
        else set()
    )
    for label in sorted(shared_labels):
        amounts = {sheet[label] for sheet in sheets}
        applied = True
        ok = len(amounts) == 1
        passed &= ok
        reasons.append("CROSS_SHEET_AGREEMENT" if ok else "CROSS_SHEET_MISMATCH")
    if not applied:
        passed = False
        reasons.append("NO_APPLICABLE_DETERMINISTIC_CHECK")
    snapshot = [
        (sheet.name, region.start_row, region.end_row, region.start_column,
         region.end_column, [(cell.row, cell.column, cell.value_type, cell.value)
                             for cell in region.cells])
        for sheet in probe.sheets for region in sheet.regions
    ]
    snapshot_digest = hashlib.sha256(json.dumps(
        snapshot, ensure_ascii=False, sort_keys=True, default=str,
        separators=(",", ":"),
    ).encode()).hexdigest()
    candidate_binding = (
        candidate_id, semantic_role, sheet_index, region, column, source_ref
    )
    check_inputs_digest = hashlib.sha256(json.dumps(
        sheets, ensure_ascii=False, sort_keys=True, default=str,
        separators=(",", ":"),
    ).encode()).hexdigest()
    receipt = ValidationReceipt(
        candidate_id,
        passed,
        tuple(dict.fromkeys(reasons)),
        difference=(str(max(differences, key=abs)) if differences else None),
        probe_sha256=probe.sha256,
        snapshot_digest=snapshot_digest,
        candidate_binding_digest=hashlib.sha256(json.dumps(
            candidate_binding, ensure_ascii=False, default=str,
            separators=(",", ":"),
        ).encode()).hexdigest(),
        check_inputs_digest=check_inputs_digest,
    )
    object.__setattr__(receipt, "_signature", _receipt_signature(receipt))
    return receipt
