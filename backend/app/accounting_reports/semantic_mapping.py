from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
import secrets
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, model_validator

from .models import CellProbe, WorkbookProbe
from .validation import ValidationReceipt, receipt_matches_candidate, validate_probe

_APPROVED_DATA_REF = re.compile(
    r"^approved-data:case:[A-Za-z0-9][A-Za-z0-9._-]{0,127}:decree:"
    r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$"
)


class ConfidenceBand(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PublicationReadiness(StrEnum):
    VERIFIED = "verified"
    DISCLOSED = "disclosed"
    INFERRED_DRAFT = "inferred_draft"


@dataclass(frozen=True, slots=True, repr=False)
class MappingCandidate:
    candidate_id: str
    semantic_role: str
    source_ref: str
    sheet_index: int
    region: tuple[int, int, int, int]
    column: int
    score_components: tuple[tuple[str, float], ...]
    reason_codes: tuple[str, ...]
    confidence: float = field(init=False)

    def __post_init__(self) -> None:
        for value in (self.candidate_id, self.semantic_role, self.source_ref):
            if not isinstance(value, str) or not value.strip():
                raise ValueError("mapping_candidate_identity_required")
        if self.sheet_index < 0 or self.column < 1:
            raise ValueError("mapping_source_region_invalid")
        if len(self.region) != 4 or any(
            isinstance(value, bool) or not isinstance(value, int) or value < 1
            for value in self.region
        ):
            raise ValueError("mapping_source_region_invalid")
        if self.region[0] > self.region[1] or self.region[2] > self.region[3]:
            raise ValueError("mapping_source_region_invalid")
        if not self.score_components or len(self.score_components) > 16:
            raise ValueError("mapping_score_components_invalid")
        names: set[str] = set()
        total = 0.0
        for name, score in self.score_components:
            if not isinstance(name, str) or not name.strip() or name in names:
                raise ValueError("mapping_score_components_invalid")
            if isinstance(score, bool) or not isinstance(score, (int, float)):
                raise TypeError("mapping_score_component_invalid")
            if not math.isfinite(score) or not 0 <= score <= 1:
                raise ValueError("mapping_score_component_invalid")
            names.add(name)
            total += float(score)
        if total > 1.0 + 1e-9:
            raise ValueError("mapping_confidence_invalid")
        if not self.reason_codes or any(
            not isinstance(code, str) or not code.strip() for code in self.reason_codes
        ):
            raise ValueError("mapping_reason_codes_required")
        object.__setattr__(self, "confidence", round(total, 6))

    def __repr__(self) -> str:
        return (
            "MappingCandidate("
            f"candidate_id={self.candidate_id!r}, semantic_role={self.semantic_role!r}, "
            f"confidence={self.confidence!r}, <redacted>)"
        )


@dataclass(frozen=True, slots=True, repr=False)
class MappingDecision:
    selected: MappingCandidate
    candidates: tuple[MappingCandidate, ...]
    validation_receipt: ValidationReceipt
    band: ConfidenceBand
    readiness: PublicationReadiness
    reason_codes: tuple[str, ...]

    def __post_init__(self) -> None:
        if self.selected not in self.candidates or not self.candidates:
            raise ValueError("mapping_selected_candidate_invalid")
        if any(
            candidate.semantic_role != self.selected.semantic_role
            for candidate in self.candidates
        ):
            raise ValueError("mapping_candidate_role_mismatch")
        if self.candidates != tuple(
            sorted(self.candidates, key=lambda item: (-item.confidence, item.candidate_id))
        ):
            raise ValueError("mapping_candidates_not_ranked")
        if self.band is not _band(self.selected.confidence):
            raise ValueError("mapping_confidence_band_mismatch")
        if self.validation_receipt.candidate_id != self.selected.candidate_id:
            raise ValueError("mapping_validation_receipt_mismatch")
        if self.validation_receipt.system_validated and not receipt_matches_candidate(
            self.validation_receipt, self.selected
        ):
            raise ValueError("mapping_validation_binding_mismatch")
        expected = _readiness(self.band, self.validation_receipt)
        if self.readiness is not expected:
            raise ValueError("mapping_readiness_mismatch")

    def __repr__(self) -> str:
        return (
            "MappingDecision("
            f"band={self.band.value!r}, readiness={self.readiness.value!r}, <redacted>)"
        )


def _band(confidence: float) -> ConfidenceBand:
    if confidence >= 0.85:
        return ConfidenceBand.HIGH
    if confidence >= 0.60:
        return ConfidenceBand.MEDIUM
    return ConfidenceBand.LOW


def _readiness(
    band: ConfidenceBand, receipt: ValidationReceipt
) -> PublicationReadiness:
    if not receipt.system_validated or not receipt.passed or band is ConfidenceBand.LOW:
        return PublicationReadiness.INFERRED_DRAFT
    return (
        PublicationReadiness.VERIFIED
        if band is ConfidenceBand.HIGH
        else PublicationReadiness.DISCLOSED
    )


def _readiness_projection(
    band: ConfidenceBand, passed: bool
) -> PublicationReadiness:
    if not passed or band is ConfidenceBand.LOW:
        return PublicationReadiness.INFERRED_DRAFT
    return (
        PublicationReadiness.VERIFIED
        if band is ConfidenceBand.HIGH
        else PublicationReadiness.DISCLOSED
    )


SemanticRole = Literal[
    "closing_balance", "opening_balance", "debit_amount", "credit_amount",
    "current_amount", "comparison_amount",
]


class SourceRegionProjection(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    sheet_index: int = Field(ge=0)
    start_row: int = Field(ge=1)
    end_row: int = Field(ge=1)
    start_column: int = Field(ge=1)
    end_column: int = Field(ge=1)
    column: int = Field(ge=1)

    @model_validator(mode="after")
    def valid_bounds(self):
        if (
            self.start_row > self.end_row
            or self.start_column > self.end_column
            or not self.start_column <= self.column <= self.end_column
        ):
            raise ValueError("source_region_bounds_invalid")
        return self


class CandidateProjection(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    candidate_id: str
    semantic_role: SemanticRole
    source_ref: str
    confidence: float = Field(ge=0, le=1)
    reason_codes: list[str]
    score_components: list[tuple[str, float]]
    source_region: SourceRegionProjection

    @model_validator(mode="after")
    def consistent(self):
        if (
            not self.candidate_id.strip()
            or _APPROVED_DATA_REF.fullmatch(self.source_ref) is None
            or not self.reason_codes
            or len(set(self.reason_codes)) != len(self.reason_codes)
            or not self.score_components
            or len({name for name, _ in self.score_components}) != len(self.score_components)
            or abs(sum(score for _, score in self.score_components) - self.confidence) > 1e-9
        ):
            raise ValueError("candidate_projection_inconsistent")
        return self


class ReceiptProjection(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    candidate_id: str
    passed: bool
    reason_codes: list[str]
    difference: str | None = None
    system_validated: Literal[True]
    probe_sha256: str
    snapshot_digest: str
    candidate_binding_digest: str
    check_inputs_digest: str

    @model_validator(mode="after")
    def valid_digests(self):
        if (
            not self.reason_codes
            or len(set(self.reason_codes)) != len(self.reason_codes)
            or any(
                re.fullmatch(r"[0-9a-f]{64}", value) is None
                for value in (
                    self.probe_sha256, self.snapshot_digest,
                    self.candidate_binding_digest, self.check_inputs_digest,
                )
            )
        ):
            raise ValueError("receipt_projection_inconsistent")
        return self


class DecisionProjection(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    selected_candidate_id: str
    semantic_role: SemanticRole
    confidence: float = Field(ge=0, le=1)
    confidence_band: ConfidenceBand
    readiness: PublicationReadiness
    reason_codes: list[str]
    candidates: list[CandidateProjection] = Field(min_length=1, max_length=32)
    validation_receipt: ReceiptProjection

    @model_validator(mode="after")
    def consistent(self):
        selected = next(
            (item for item in self.candidates if item.candidate_id == self.selected_candidate_id),
            None,
        )
        ranked = sorted(
            self.candidates, key=lambda item: (-item.confidence, item.candidate_id)
        )
        if (
            selected is None
            or len({item.candidate_id for item in self.candidates}) != len(self.candidates)
            or self.candidates != ranked
            or selected is not self.candidates[0]
            or selected.semantic_role != self.semantic_role
            or any(item.semantic_role != self.semantic_role for item in self.candidates)
            or selected.confidence != self.confidence
            or self.validation_receipt.candidate_id != self.selected_candidate_id
            or self.confidence_band is not _band(self.confidence)
            or self.readiness is not _readiness_projection(
                self.confidence_band, self.validation_receipt.passed
            )
            or not self.reason_codes
            or len(set(self.reason_codes)) != len(self.reason_codes)
        ):
            raise ValueError("mapping_projection_inconsistent")
        return self


class AccountingContentProjection(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    cell_values: list[str | int | float | bool | None] = Field(max_length=200)
    mapping_decisions: list[DecisionProjection] = Field(min_length=1, max_length=32)
    _signature: str | None = PrivateAttr(default=None)

    @property
    def system_issued(self) -> bool:
        return bool(
            self._signature
            and hmac.compare_digest(self._signature, _content_signature(self))
        )


_CONTENT_PROJECTION_KEY = secrets.token_bytes(32)


def _content_signature(content: AccountingContentProjection) -> str:
    payload = json.dumps(
        content.model_dump(mode="json"), ensure_ascii=False, sort_keys=True,
        separators=(",", ":"),
    )
    return hmac.new(
        _CONTENT_PROJECTION_KEY,
        f"{id(content)}:{payload}".encode(),
        hashlib.sha256,
    ).hexdigest()


def build_accounting_content_projection(
    *, cell_values: list[str | int | float | bool | None],
    decisions: tuple[MappingDecision, ...],
) -> AccountingContentProjection:
    content = AccountingContentProjection(
        cell_values=cell_values,
        mapping_decisions=[project_decision(item) for item in decisions],
    )
    object.__setattr__(content, "_signature", _content_signature(content))
    return content


def project_decision(decision: MappingDecision) -> DecisionProjection:
    if not receipt_matches_candidate(decision.validation_receipt, decision.selected):
        raise ValueError("mapping_validation_binding_mismatch")
    def candidate(item: MappingCandidate) -> CandidateProjection:
        return CandidateProjection(
            candidate_id=item.candidate_id,
            semantic_role=item.semantic_role,  # type: ignore[arg-type]
            source_ref=item.source_ref,
            confidence=item.confidence,
            reason_codes=list(item.reason_codes),
            score_components=list(item.score_components),
            source_region=SourceRegionProjection(
                sheet_index=item.sheet_index,
                start_row=item.region[0], end_row=item.region[1],
                start_column=item.region[2], end_column=item.region[3],
                column=item.column,
            ),
        )
    return DecisionProjection(
        selected_candidate_id=decision.selected.candidate_id,
        semantic_role=decision.selected.semantic_role,  # type: ignore[arg-type]
        confidence=decision.selected.confidence,
        confidence_band=decision.band,
        readiness=decision.readiness,
        reason_codes=list(decision.reason_codes),
        candidates=[candidate(item) for item in decision.candidates],
        validation_receipt=ReceiptProjection(
            candidate_id=decision.validation_receipt.candidate_id,
            passed=decision.validation_receipt.passed,
            reason_codes=list(decision.validation_receipt.reason_codes),
            difference=decision.validation_receipt.difference,
            system_validated=True,
            probe_sha256=decision.validation_receipt.probe_sha256 or "",
            snapshot_digest=decision.validation_receipt.snapshot_digest or "",
            candidate_binding_digest=(
                decision.validation_receipt.candidate_binding_digest or ""
            ),
            check_inputs_digest=decision.validation_receipt.check_inputs_digest or "",
        ),
    )


def select_mapping(
    candidates: tuple[MappingCandidate, ...],
    receipts: tuple[ValidationReceipt, ...],
) -> MappingDecision:
    """Select the highest deterministic score without upgrading it to evidence."""

    if not candidates:
        raise ValueError("mapping_candidates_required")
    if len({item.candidate_id for item in candidates}) != len(candidates):
        raise ValueError("mapping_candidate_id_duplicate")
    receipt_by_id = {item.candidate_id: item for item in receipts}
    if len(receipt_by_id) != len(receipts) or set(receipt_by_id) != {
        item.candidate_id for item in candidates
    }:
        raise ValueError("mapping_validation_receipts_incomplete")
    ordered = tuple(
        sorted(candidates, key=lambda item: (-item.confidence, item.candidate_id))
    )
    selected = ordered[0]
    receipt = receipt_by_id[selected.candidate_id]
    band = _band(selected.confidence)
    trusted_receipt = receipt.system_validated and receipt_matches_candidate(
        receipt, selected
    )
    readiness = (
        _readiness(band, receipt)
        if trusted_receipt
        else PublicationReadiness.INFERRED_DRAFT
    )
    disclosures = (
        ("VALIDATION_FAILED",) if not receipt.passed else ()
    ) + (
        ("LOW_CONFIDENCE",)
        if band is ConfidenceBand.LOW
        else ("MEDIUM_CONFIDENCE",)
        if band is ConfidenceBand.MEDIUM
        else ()
    ) + (
        ("UNTRUSTED_VALIDATION",) if not trusted_receipt else ()
    )
    reasons = tuple(dict.fromkeys(
        selected.reason_codes + receipt.reason_codes + disclosures
    ))
    return MappingDecision(
        selected=selected,
        candidates=ordered,
        validation_receipt=receipt,
        band=band,
        readiness=readiness,
        reason_codes=reasons,
    )


_ROLE_HEADERS = {
    "closing_balance": ("期末余额", "期末数", "年末余额"),
    "opening_balance": ("期初余额", "期初数", "年初余额"),
    "debit_amount": ("借方", "借方金额"),
    "credit_amount": ("贷方", "贷方金额"),
    "current_amount": ("本期金额", "本年累计"),
    "comparison_amount": ("上期金额", "上年同期"),
}


def _candidate_from_header(
    *, probe: WorkbookProbe, source_ref: str, sheet_index: int,
    region_index: int, cell: CellProbe,
) -> MappingCandidate | None:
    text = cell.value.strip() if isinstance(cell.value, str) else ""
    role = next(
        (role for role, tokens in _ROLE_HEADERS.items() if any(token in text for token in tokens)),
        None,
    )
    exact_header = role is not None
    if role is None and "余额" in text:
        role = "closing_balance"
    if role is None:
        return None
    region = probe.sheets[sheet_index].regions[region_index]
    below = [
        item for item in region.cells
        if item.column == cell.column and item.row > cell.row
        and item.value_type in {"number", "formula"}
    ]
    neighbors = [
        item for item in region.cells
        if item.row == cell.row and item.column != cell.column and isinstance(item.value, str)
    ]
    labels = [item.value for item in region.cells if isinstance(item.value, str)]
    components = [("header_semantics", 0.65 if exact_header else 0.2)]
    reasons = ["HEADER_MATCH" if exact_header else "WEAK_HEADER_MATCH"]
    if below:
        components.append(("data_type", 0.15))
        reasons.append("NUMERIC_COLUMN")
    if probe.years:
        components.append(("period_tokens", 0.1))
        reasons.append("PERIOD_MATCH")
    if neighbors:
        components.append(("neighboring_labels", 0.05))
        reasons.append("NEIGHBOR_LABEL")
    if any("合计" in label for label in labels):
        components.append(("totals", 0.05))
        reasons.append("TOTAL_LABELS")
    digest = hashlib.sha256(
        f"{probe.sha256}:{sheet_index}:{region_index}:{cell.row}:{cell.column}:{role}".encode()
    ).hexdigest()[:20]
    return MappingCandidate(
        candidate_id=f"mapping:{digest}", semantic_role=role, source_ref=source_ref,
        sheet_index=sheet_index,
        region=(region.start_row, region.end_row, region.start_column, region.end_column),
        column=cell.column, score_components=tuple(components),
        reason_codes=tuple(reasons),
    )


def derive_mapping_decisions(
    probe: WorkbookProbe, source_ref: str
) -> tuple[MappingDecision, ...]:
    """Derive audited mappings using only a frozen WorkbookProbe."""
    if not isinstance(probe, WorkbookProbe):
        raise TypeError("workbook_probe_required")
    if not isinstance(source_ref, str) or _APPROVED_DATA_REF.fullmatch(source_ref) is None:
        raise ValueError("approved_accounting_source_ref_required")
    candidates = tuple(
        candidate
        for sheet_index, sheet in enumerate(probe.sheets)
        for region_index, region in enumerate(sheet.regions)
        for cell in region.cells
        if (candidate := _candidate_from_header(
            probe=probe, source_ref=source_ref, sheet_index=sheet_index,
            region_index=region_index, cell=cell,
        )) is not None
    )
    decisions = []
    for role in sorted({candidate.semantic_role for candidate in candidates}):
        role_candidates = tuple(item for item in candidates if item.semantic_role == role)
        receipts = tuple(validate_probe(item, probe) for item in role_candidates)
        decisions.append(select_mapping(role_candidates, receipts))
    return tuple(decisions)
