"""Approved synchronous contracts for Jinyiwei evidence collection."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType
from typing import Annotated, Any
from urllib.parse import urlsplit

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    ValidationInfo,
    field_serializer,
    field_validator,
    model_validator,
)

StrictFreshnessAge = Annotated[StrictInt, Field(gt=0, le=31_536_000)]
StrictTimeout = Annotated[StrictInt, Field(ge=1, le=120)]
StrictConfidence = Annotated[StrictFloat | StrictInt, Field(ge=0, le=1)]
Sha256 = Annotated[StrictStr, Field(pattern=r"^[0-9a-f]{64}$")]

_ISO_3166_ALPHA2_CODES = frozenset(
    """
    AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
    BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
    CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
    DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
    GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
    HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
    KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
    MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
    NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY
    QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
    TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
    VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
    """.split()
)


class SourceType(StrEnum):
    SHIGUAN = "SHIGUAN"
    MCP = "MCP"
    PUBLIC_API = "PUBLIC_API"
    PUBLIC_WEB = "PUBLIC_WEB"


class FactCategory(StrEnum):
    MARKET_QUOTE = "MARKET_QUOTE"
    REGULATORY_FILING = "REGULATORY_FILING"
    NEWS_EVENT = "NEWS_EVENT"
    PUBLIC_STATISTIC = "PUBLIC_STATISTIC"
    ENTITY_REFERENCE = "ENTITY_REFERENCE"


class MarketMetric(StrEnum):
    LAST_PRICE = "LAST_PRICE"
    VOLUME = "VOLUME"
    CHANGE_PERCENT = "CHANGE_PERCENT"
    INTRADAY_SERIES = "INTRADAY_SERIES"
    PE_RATIO = "PE_RATIO"
    PB_RATIO = "PB_RATIO"
    MARKET_CAP = "MARKET_CAP"
    PRICE_TREND_30D = "PRICE_TREND_30D"


class DataScope(StrEnum):
    INTERNAL_BUSINESS = "INTERNAL_BUSINESS"
    EXTERNAL_PUBLIC = "EXTERNAL_PUBLIC"
    HYBRID = "HYBRID"


class EvidenceQuality(StrEnum):
    PRIMARY = "PRIMARY"
    AUTHORITATIVE = "AUTHORITATIVE"
    SECONDARY = "SECONDARY"
    UNVERIFIED = "UNVERIFIED"


class EvidenceStance(StrEnum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"


class SourceAttemptStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    BLOCKED = "BLOCKED"


class EvidencePackStatus(StrEnum):
    RESOLVED = "RESOLVED"
    PARTIAL = "PARTIAL"
    BLOCKED = "BLOCKED"
    UNAVAILABLE = "UNAVAILABLE"


def _normalize_text(value: str, field_name: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError(f"{field_name} must not be blank")
    return normalized


def _validate_iso8601(value: str, field_name: str) -> str:
    normalized = _normalize_text(value, field_name)
    candidate = normalized[:-1] + "+00:00" if normalized.endswith("Z") else normalized
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone offset")
    return normalized


def _ensure_unique(values: tuple[Any, ...], field_name: str) -> tuple[Any, ...]:
    if len(values) != len(set(values)):
        raise ValueError(f"{field_name} must contain unique values")
    return values


class FrozenJsonMapping(Mapping[str, Any]):
    """Read-only JSON object that cannot be bypassed via ``dict`` methods."""

    __slots__ = ("__data",)

    def __init__(self, values: Mapping[str, Any]) -> None:
        ordered = {key: values[key] for key in sorted(values)}
        self.__data = MappingProxyType(ordered)

    def __getitem__(self, key: str) -> Any:
        return self.__data[key]

    def __iter__(self) -> Any:
        return iter(self.__data)

    def __len__(self) -> int:
        return len(self.__data)

    def __or__(self, other: object) -> Any:
        raise TypeError("JSON value is immutable")

    def __ror__(self, other: object) -> Any:
        raise TypeError("JSON value is immutable")

    def __ior__(self, other: object) -> Any:
        raise TypeError("JSON value is immutable")


def _freeze_json(value: JsonValue) -> Any:
    if isinstance(value, dict):
        return FrozenJsonMapping(
            {key: _freeze_json(item) for key, item in value.items()}
        )
    if isinstance(value, list):
        return tuple(_freeze_json(item) for item in value)
    return value


def _thaw_json(value: Any) -> JsonValue:
    if isinstance(value, Mapping):
        return {key: _thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw_json(item) for item in value]
    return value


class _FrozenContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class RequiredFact(_FrozenContract):
    key: StrictStr
    description: StrictStr
    category: FactCategory
    data_scope: DataScope
    subject: StrictStr
    jurisdiction: StrictStr | None = None
    expected_unit: StrictStr | None = None
    expected_shape: StrictStr | None = None
    market_metric: MarketMetric | None = None

    @field_validator("key", "description", "subject")
    @classmethod
    def _required_text(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_text(value, info.field_name)

    @field_validator("jurisdiction")
    @classmethod
    def _jurisdiction_is_iso_alpha2(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = _normalize_text(value, "jurisdiction").upper()
        if normalized not in _ISO_3166_ALPHA2_CODES:
            raise ValueError("jurisdiction must be an ISO 3166-1 alpha-2 code")
        return normalized

    @field_validator("expected_unit", "expected_shape")
    @classmethod
    def _optional_nonempty_text(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        return None if value is None else _normalize_text(value, info.field_name)

    @model_validator(mode="after")
    def _metric_matches_category(self) -> RequiredFact:
        if self.category is FactCategory.MARKET_QUOTE:
            if self.market_metric is None:
                raise ValueError("MARKET_QUOTE requires market_metric")
        elif self.market_metric is not None:
            raise ValueError("market_metric is only valid for MARKET_QUOTE")
        return self


class FreshnessRequirement(_FrozenContract):
    max_age_seconds: StrictFreshnessAge | None = None
    not_before: StrictStr | None = None

    @field_validator("not_before")
    @classmethod
    def _not_before_is_iso8601(cls, value: str | None) -> str | None:
        return None if value is None else _validate_iso8601(value, "not_before")

    @model_validator(mode="after")
    def _requires_constraint(self) -> FreshnessRequirement:
        if self.max_age_seconds is None and self.not_before is None:
            raise ValueError("freshness requires max_age_seconds or not_before")
        return self


class DataGapDraft(_FrozenContract):
    requesting_agent: StrictStr
    question: StrictStr
    required_facts: tuple[RequiredFact, ...] = Field(min_length=1, max_length=5)
    decision_context: StrictStr
    freshness: FreshnessRequirement
    existing_evidence_ids: tuple[StrictStr, ...] = ()

    @field_validator("requesting_agent", "question", "decision_context")
    @classmethod
    def _required_text(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_text(value, info.field_name)

    @field_validator("existing_evidence_ids")
    @classmethod
    def _normalize_evidence_ids(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(_normalize_text(item, "existing_evidence_ids") for item in value)
        return _ensure_unique(normalized, "existing_evidence_ids")

    @model_validator(mode="after")
    def _unique_fact_keys(self) -> DataGapDraft:
        _ensure_unique(tuple(fact.key for fact in self.required_facts), "required_facts")
        return self


class DataGapRequest(DataGapDraft):
    request_id: StrictStr
    timeout_seconds: StrictTimeout
    source_scope: tuple[SourceType, ...] = Field(min_length=1)

    @field_validator("request_id")
    @classmethod
    def _request_id_nonempty(cls, value: str) -> str:
        return _normalize_text(value, "request_id")

    @field_validator("source_scope")
    @classmethod
    def _unique_source_scope(
        cls, value: tuple[SourceType, ...]
    ) -> tuple[SourceType, ...]:
        return _ensure_unique(value, "source_scope")

    @property
    def request_fingerprint(self) -> str:
        facts = sorted(
            (
                {
                    "key": fact.key,
                    "description": fact.description,
                    "category": fact.category,
                    "data_scope": fact.data_scope,
                    "subject": fact.subject,
                    "jurisdiction": fact.jurisdiction,
                    "expected_unit": fact.expected_unit,
                    "expected_shape": fact.expected_shape,
                    "market_metric": fact.market_metric,
                }
                for fact in self.required_facts
            ),
            key=lambda item: item["key"] or "",
        )
        semantic_payload = {
            "requesting_agent": self.requesting_agent,
            "required_facts": facts,
            "freshness": self.freshness.model_dump(mode="json"),
            "source_scope": sorted(source.value for source in self.source_scope),
            "existing_evidence_ids": sorted(self.existing_evidence_ids),
        }
        canonical = json.dumps(
            semantic_payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
        return hashlib.sha256(canonical).hexdigest()


class EvidenceItem(_FrozenContract):
    evidence_id: StrictStr
    fact_key: StrictStr
    value: JsonValue
    unit: StrictStr | None = None
    as_of: StrictStr
    published_at: StrictStr | None = None
    retrieved_at: StrictStr
    source_url: StrictStr
    publisher: StrictStr
    source_type: SourceType
    coverage: tuple[StrictStr, ...] | None = None
    license_note: StrictStr | None = None
    quality: EvidenceQuality
    stance: EvidenceStance
    excerpt: StrictStr
    content_hash: Sha256
    confidence: StrictConfidence
    access_url: StrictStr | None = None
    access_metadata: Mapping[StrictStr, Any] | None = None

    @field_validator("evidence_id", "fact_key", "publisher")
    @classmethod
    def _required_text(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_text(value, info.field_name)

    @field_validator("excerpt")
    @classmethod
    def _literal_excerpt(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("excerpt must not be blank")
        return normalized

    @field_validator("unit")
    @classmethod
    def _unit_nonempty(cls, value: str | None) -> str | None:
        return None if value is None else _normalize_text(value, "unit")

    @field_validator("as_of", "retrieved_at")
    @classmethod
    def _times_are_iso8601(cls, value: str, info: ValidationInfo) -> str:
        return _validate_iso8601(value, info.field_name)

    @field_validator("published_at")
    @classmethod
    def _published_at_is_iso8601(cls, value: str | None) -> str | None:
        return None if value is None else _validate_iso8601(value, "published_at")

    @field_validator("coverage")
    @classmethod
    def _coverage_is_named_and_unique(cls, value: tuple[str, ...] | None) -> tuple[str, ...] | None:
        if value is None:
            return None
        normalized = tuple(_normalize_text(item, "coverage") for item in value)
        return _ensure_unique(normalized, "coverage")

    @field_validator("license_note")
    @classmethod
    def _license_note_is_nonempty(cls, value: str | None) -> str | None:
        return None if value is None else _normalize_text(value, "license_note")

    @field_validator("source_url")
    @classmethod
    def _source_is_safe(cls, value: str) -> str:
        normalized = _normalize_text(value, "source_url")
        if any(character.isspace() for character in normalized):
            raise ValueError("source_url must not contain whitespace")
        parsed = urlsplit(normalized)
        if parsed.scheme not in {"https", "internal"} or not parsed.netloc:
            raise ValueError("source_url must use https:// or internal://")
        return normalized

    @field_validator("access_url")
    @classmethod
    def _access_url_is_safe(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return cls._source_is_safe(value)

    @field_validator("access_metadata")
    @classmethod
    def _access_metadata_is_immutable(
        cls, value: Mapping[str, Any] | None
    ) -> Mapping[str, Any] | None:
        return None if value is None else _freeze_json(dict(value))

    @field_serializer("access_metadata")
    def _serialize_access_metadata(
        self, value: Mapping[str, Any] | None
    ) -> JsonValue | None:
        return None if value is None else _thaw_json(value)

    @field_validator("value")
    @classmethod
    def _value_is_immutable_json(cls, value: JsonValue) -> Any:
        return _freeze_json(value)

    @field_serializer("value")
    def _serialize_value(self, value: Any) -> JsonValue:
        return _thaw_json(value)


class McpCallAudit(_FrozenContract):
    """Credential-free metadata for one approved MCP tool invocation."""

    server_id: StrictStr
    tool_name: StrictStr
    approval_version: StrictStr
    duration_ms: StrictInt = Field(ge=0)
    arguments_hash: Sha256
    response_bytes: StrictInt | None = Field(default=None, ge=0)
    response_hash: Sha256 | None = None
    mapping_outcome: StrictStr
    cache_hit: StrictBool = False
    error: StrictStr | None = None

    @field_validator(
        "server_id",
        "tool_name",
        "approval_version",
        "mapping_outcome",
    )
    @classmethod
    def _required_audit_text(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_text(value, info.field_name)

    @field_validator("error")
    @classmethod
    def _safe_audit_error(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\n" in value or "\r" in value:
            raise ValueError("audit error must be a single sanitized line")
        return _normalize_text(value, "error")

    @model_validator(mode="after")
    def _response_metadata_is_complete(self) -> McpCallAudit:
        if (self.response_bytes is None) != (self.response_hash is None):
            raise ValueError("response audit metadata must be complete")
        return self


class SourceAttempt(_FrozenContract):
    source_type: SourceType
    source_name: StrictStr
    status: SourceAttemptStatus
    started_at: StrictStr
    completed_at: StrictStr
    error: StrictStr | None = None
    facts_attempted: tuple[StrictStr, ...]
    call_audits: tuple[McpCallAudit, ...] = ()

    @field_validator("source_name")
    @classmethod
    def _source_name_nonempty(cls, value: str) -> str:
        return _normalize_text(value, "source_name")

    @field_validator("started_at", "completed_at")
    @classmethod
    def _times_are_iso8601(cls, value: str, info: ValidationInfo) -> str:
        return _validate_iso8601(value, info.field_name)

    @field_validator("error")
    @classmethod
    def _error_is_sanitized(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\n" in value or "\r" in value:
            raise ValueError("error must be a single sanitized line")
        return _normalize_text(value, "error")

    @field_validator("facts_attempted")
    @classmethod
    def _normalize_facts(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(_normalize_text(item, "facts_attempted") for item in value)
        return _ensure_unique(normalized, "facts_attempted")

    @model_validator(mode="after")
    def _completion_not_before_start(self) -> SourceAttempt:
        if _parse_time(self.completed_at) < _parse_time(self.started_at):
            raise ValueError("completed_at must not precede started_at")
        return self


class InvestigationPlan(_FrozenContract):
    fact_keys: tuple[StrictStr, ...] = Field(min_length=1)
    source_scope: tuple[SourceType, ...] = Field(min_length=1)

    @field_validator("fact_keys")
    @classmethod
    def _normalize_fact_keys(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(_normalize_text(item, "fact_keys") for item in value)
        return _ensure_unique(normalized, "fact_keys")

    @field_validator("source_scope")
    @classmethod
    def _unique_sources(cls, value: tuple[SourceType, ...]) -> tuple[SourceType, ...]:
        return _ensure_unique(value, "source_scope")


class EvidenceConflict(_FrozenContract):
    fact_key: StrictStr
    evidence_ids: tuple[StrictStr, ...] = Field(min_length=2)
    summary: StrictStr

    @field_validator("fact_key", "summary")
    @classmethod
    def _required_text(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_text(value, info.field_name)

    @field_validator("evidence_ids")
    @classmethod
    def _unique_evidence_ids(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(_normalize_text(item, "evidence_ids") for item in value)
        return _ensure_unique(normalized, "evidence_ids")


class CacheMetadata(_FrozenContract):
    hit: StrictBool
    cache_key: StrictStr | None = None
    cached_at: StrictStr | None = None
    expires_at: StrictStr | None = None

    @field_validator("cache_key")
    @classmethod
    def _cache_key_nonempty(cls, value: str | None) -> str | None:
        return None if value is None else _normalize_text(value, "cache_key")

    @field_validator("cached_at", "expires_at")
    @classmethod
    def _optional_times_are_iso8601(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        return None if value is None else _validate_iso8601(value, info.field_name)


def _parse_time(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return datetime.fromisoformat(normalized)


class EvidencePack(_FrozenContract):
    pack_id: StrictStr
    investigation_id: StrictStr
    status: EvidencePackStatus
    request: DataGapRequest
    investigation_plan: InvestigationPlan
    evidence_by_fact: Mapping[StrictStr, tuple[EvidenceItem, ...]]
    historical_evidence_by_fact: Mapping[StrictStr, tuple[EvidenceItem, ...]]
    resolved_facts: tuple[StrictStr, ...]
    unresolved_facts: tuple[StrictStr, ...]
    conflicts: tuple[EvidenceConflict, ...]
    source_attempts: tuple[SourceAttempt, ...]
    investigation_started_at: StrictStr
    investigation_completed_at: StrictStr
    cache: CacheMetadata
    do_not_infer: tuple[StrictStr, ...]

    @field_validator("pack_id", "investigation_id")
    @classmethod
    def _required_text(cls, value: str, info: ValidationInfo) -> str:
        return _normalize_text(value, info.field_name)

    @field_validator("investigation_started_at", "investigation_completed_at")
    @classmethod
    def _times_are_iso8601(cls, value: str, info: ValidationInfo) -> str:
        return _validate_iso8601(value, info.field_name)

    @field_validator("resolved_facts", "unresolved_facts", "do_not_infer")
    @classmethod
    def _normalize_collections(
        cls, value: tuple[str, ...], info: ValidationInfo
    ) -> tuple[str, ...]:
        normalized = tuple(_normalize_text(item, info.field_name) for item in value)
        return _ensure_unique(normalized, info.field_name)

    @field_validator("evidence_by_fact", "historical_evidence_by_fact")
    @classmethod
    def _freeze_grouped_evidence(
        cls,
        value: Mapping[str, tuple[EvidenceItem, ...]],
        info: ValidationInfo,
    ) -> Mapping[str, tuple[EvidenceItem, ...]]:
        normalized = {
            _normalize_text(key, f"{info.field_name} key"): tuple(items)
            for key, items in value.items()
        }
        return MappingProxyType(normalized)

    @field_serializer(
        "evidence_by_fact", "historical_evidence_by_fact", when_used="json"
    )
    def _serialize_grouped_evidence(
        self, value: Mapping[str, tuple[EvidenceItem, ...]]
    ) -> dict[str, list[dict[str, Any]]]:
        return {
            key: [item.model_dump(mode="json") for item in items]
            for key, items in value.items()
        }

    @model_validator(mode="after")
    def _validate_pack_times(self) -> EvidencePack:
        if _parse_time(self.investigation_completed_at) < _parse_time(
            self.investigation_started_at
        ):
            raise ValueError(
                "investigation_completed_at must not precede investigation_started_at"
            )
        request_facts = {fact.key for fact in self.request.required_facts}
        request_sources = set(self.request.source_scope)
        plan_sources = set(self.investigation_plan.source_scope)
        resolved = set(self.resolved_facts)
        unresolved = set(self.unresolved_facts)
        if resolved & unresolved:
            raise ValueError("resolved_facts and unresolved_facts must be disjoint")
        if resolved | unresolved != request_facts:
            raise ValueError("resolved and unresolved facts must partition request facts")

        evidence_ids: set[str] = set()
        evidence_ids_by_fact: dict[str, set[str]] = {}
        for group_name, grouped_items in (
            ("evidence_by_fact", self.evidence_by_fact),
            ("historical_evidence_by_fact", self.historical_evidence_by_fact),
        ):
            for group_key, items in grouped_items.items():
                if group_key not in request_facts:
                    raise ValueError(f"{group_name} key must be a requested fact")
                for item in items:
                    if item.fact_key != group_key:
                        raise ValueError("evidence fact_key must match its group key")
                    if item.evidence_id in evidence_ids:
                        raise ValueError("evidence IDs must be unique within a pack")
                    if (
                        item.source_type not in request_sources
                        or item.source_type not in plan_sources
                    ):
                        raise ValueError(
                            "evidence source_type must be in request and plan source scope"
                        )
                    evidence_ids.add(item.evidence_id)
                    evidence_ids_by_fact.setdefault(group_key, set()).add(
                        item.evidence_id
                    )

        for conflict in self.conflicts:
            if conflict.fact_key not in request_facts:
                raise ValueError("conflict fact_key must be a requested fact")
            if not set(conflict.evidence_ids) <= evidence_ids:
                raise ValueError("conflicts must reference evidence in this pack")
            if not set(conflict.evidence_ids) <= evidence_ids_by_fact.get(
                conflict.fact_key, set()
            ):
                raise ValueError(
                    "conflict evidence IDs must belong to the conflict fact group"
                )

        if self.status is EvidencePackStatus.RESOLVED and (
            resolved != request_facts or unresolved or self.conflicts
        ):
            raise ValueError(
                "RESOLVED requires every request fact resolved and no conflicts"
            )

        plan_facts = set(self.investigation_plan.fact_keys)
        if plan_facts != request_facts:
            raise ValueError("investigation plan must cover exactly the request facts")
        if not plan_sources <= request_sources:
            raise ValueError("investigation plan sources must be in request source_scope")
        for attempt in self.source_attempts:
            if attempt.source_type not in plan_sources:
                raise ValueError("source attempt must be in investigation plan scope")
            if not set(attempt.facts_attempted) <= request_facts:
                raise ValueError("source attempt facts must be requested facts")
        return self
