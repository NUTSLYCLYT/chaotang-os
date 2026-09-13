"""Closed HTTP input contracts for the Mingshuo project fact-pack domain."""

from __future__ import annotations

import math
from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Identifier = Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$")]
RequestKey = Annotated[str, Field(pattern=r"^[A-Za-z0-9._:-]{16,128}$")]
Digest = Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]


class _ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=False)


class SkuCandidateInput(_ClosedModel):
    id: Identifier
    label: Annotated[str, Field(min_length=1, max_length=200)]
    status: Literal["RESERVED", "EVIDENCE_BOUND", "REJECTED"]
    parameter_status: Literal["MISSING", "PARTIAL", "EVIDENCE_BOUND"] = Field(
        alias="parameterStatus"
    )


class EvidenceInput(_ClosedModel):
    id: Identifier
    source_class: Literal[
        "PUBLIC_CANDIDATE",
        "SUPPLIER_ASSERTED",
        "INTERNAL_MEASURED",
        "THIRD_PARTY_VERIFIED",
        "FROZEN_RELEASED",
    ] = Field(alias="sourceClass")
    digest: Digest
    valid_until: Annotated[str, Field(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")] = Field(
        alias="validUntil"
    )
    adoption_status: Literal["PROPOSED", "ADOPTED", "REJECTED"] = Field(alias="adoptionStatus")

    @field_validator("valid_until")
    @classmethod
    def _valid_calendar_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value


def _json_value_is_finite(value: Any) -> bool:
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, dict):
        return all(
            isinstance(key, str) and _json_value_is_finite(item) for key, item in value.items()
        )
    if isinstance(value, list):
        return all(_json_value_is_finite(item) for item in value)
    return value is None or isinstance(value, (str, int, bool))


class FactInput(_ClosedModel):
    id: Identifier
    kind: Literal["PARAMETER", "CERTIFICATION", "PRICE", "LEAD_TIME", "WARRANTY", "MARKET", "RISK"]
    subject: Annotated[str, Field(min_length=1, max_length=500)]
    value: str | int | float | bool | dict[str, Any]
    evidence_refs: list[Identifier] = Field(alias="evidenceRefs", max_length=512)

    @field_validator("value")
    @classmethod
    def _finite_json_value(cls, value: Any) -> Any:
        if not _json_value_is_finite(value):
            raise ValueError("value must be finite JSON")
        return value


class ClaimInput(_ClosedModel):
    id: Identifier
    text: Annotated[str, Field(min_length=1, max_length=500)]
    evidence_refs: list[Identifier] = Field(alias="evidenceRefs", max_length=512)


class ChannelInput(_ClosedModel):
    id: Literal["ALIBABA_INTL", "WEBSITE", "MINIPROGRAM", "CUSTOMER_COACH"]


class _FactPackInput(_ClosedModel):
    request_key: RequestKey = Field(alias="requestKey")
    requirements_text: Annotated[str, Field(min_length=1, max_length=20_000)] = Field(
        alias="requirementsText"
    )
    product_lines: list[Literal["CELL", "PACK_POWER", "PV_STORAGE_CHARGING", "DESIGN_SOLUTION"]] = (
        Field(alias="productLines", min_length=1, max_length=4)
    )
    markets: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(
        min_length=1, max_length=16
    )
    languages: list[Annotated[str, Field(min_length=2, max_length=16)]] = Field(
        min_length=1, max_length=16
    )
    sku_candidates: list[SkuCandidateInput] = Field(
        alias="skuCandidates", min_length=3, max_length=5
    )
    evidence: list[EvidenceInput] = Field(max_length=512)
    facts: list[FactInput] = Field(max_length=512)
    claims: list[ClaimInput] = Field(max_length=512)
    channels: list[ChannelInput] = Field(max_length=4)
    quote_requested: bool = Field(default=False, alias="quoteRequested")

    @field_validator("requirements_text")
    @classmethod
    def _requirements_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 100_000:
            raise ValueError("requirements text exceeds byte limit")
        return value

    @field_validator("markets", "languages")
    @classmethod
    def _normalized_unique_text(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values]
        if any(not value for value in normalized) or len(
            {value.casefold() for value in normalized}
        ) != len(normalized):
            raise ValueError("values must be normalized and unique")
        return normalized

    @model_validator(mode="after")
    def _unique_candidate_ids(self) -> _FactPackInput:
        groups = (
            self.product_lines,
            [item.id for item in self.sku_candidates],
            [item.id for item in self.evidence],
            [item.id for item in self.facts],
            [item.id for item in self.claims],
            [item.id for item in self.channels],
        )
        if any(len(group) != len(set(group)) for group in groups):
            raise ValueError("identifiers must be unique")
        return self


class CreateProjectRequest(_FactPackInput):
    project_name: Annotated[str, Field(min_length=1, max_length=200)] = Field(alias="projectName")

    @field_validator("project_name")
    @classmethod
    def _project_name_nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("project name must not be blank")
        return value


class RevisionRequest(_FactPackInput):
    pass


class DraftRequest(_ClosedModel):
    request_key: RequestKey = Field(alias="requestKey")
    fact_pack_version: Annotated[int, Field(ge=1, le=64)] = Field(alias="factPackVersion")
    fact_pack_digest: Digest = Field(alias="factPackDigest")


__all__ = ["CreateProjectRequest", "DraftRequest", "RevisionRequest"]
