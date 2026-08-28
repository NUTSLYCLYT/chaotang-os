"""Pure deterministic Claim-Evidence truth gate for P10-A."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field, fields
from datetime import datetime
from decimal import Decimal, InvalidOperation
from inspect import signature
from types import MappingProxyType
from typing import Any

_DOMAIN = "courtos.p10a.claim-evidence"
_RAW_BYTES = 262_144
_MAX_DEPTH = 16
_MAX_NODES = 4_096
_MAX_STRING_SCALARS = 2_048
_MAX_STRING_BYTES = 8_192
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
_CLAIM_ID = re.compile(r"clm_[0-9a-f]{64}\Z")
_SAFE_REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
_PRODUCER_ID = re.compile(r"[A-Za-z][A-Za-z0-9_.:-]{0,99}\Z")
_ORDINAL = re.compile(r"(?:0|[1-9][0-9]?)\Z")
_CANONICAL_TIME = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z\Z")
_CANONICAL_DECIMAL = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?\Z")

_REASON_ORDER = (
    "NONFACTUAL_CLASSIFIED",
    "USER_ATTESTED_BOUND",
    "ARCHIVED_REFERENCE_BOUND",
    "SOURCE_REFERENCE_BOUND",
    "EXACT_VALUE_MATCH",
    "CLAIM_MISSING_BINDING",
    "EVIDENCE_REF_UNKNOWN",
    "EXTRACTOR_NOT_REGISTERED",
    "ADAPTER_NOT_REGISTERED",
    "COMPARATOR_NOT_REGISTERED",
    "DERIVATION_NOT_REGISTERED",
    "IDENTITY_MISMATCH",
    "DIGEST_MISMATCH",
    "EVIDENCE_CONFLICT",
    "FRESHNESS_INVALID",
    "PROJECTION_NOT_CANONICAL",
    "PUBLIC_PROJECTION_MISMATCH",
    "NUMERIC_VALUE_NOT_EXACTLY_BOUND",
    "BUDGET_EXCEEDED",
    "DUPLICATE_ID",
    "CYCLE_DETECTED",
    "AGGREGATE_MISMATCH",
)
_REASONS = frozenset(_REASON_ORDER)

_EXTRACTOR_ORDER = MappingProxyType(
    {
        "bureau-opinion-clause.v1": 0,
        "jinyiwei-entity-reference-renderer.v1": 1,
        "jinyiwei-mainland-last-price-renderer.v1": 2,
    }
)
_REGISTRY = MappingProxyType(
    {
        (
            "agent-evidence-protocol.v1",
            "1.0.0",
            "reference-only.v1",
            "1.0.0",
            "USER_INPUT",
            "USER_ATTESTED",
            "GENERAL",
            "archive-reference.v1",
        ): ("USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED", "USER_ATTESTED_BOUND"),
        (
            "shiguan-adopted-reference.v1",
            "1.0.0",
            "reference-only.v1",
            "1.0.0",
            "ARCHIVE_REFERENCE",
            "ARCHIVED_REFERENCE",
            "ARCHIVE_RECORD",
            "archive-reference.v1",
        ): ("ARCHIVED_REFERENCE_NOT_REVERIFIED", "ARCHIVED_REFERENCE_BOUND"),
        (
            "deterministic-entity-reference.v1",
            "1.0.0",
            "exact-text.v1",
            "1.0.0",
            "DETERMINISTIC_RENDERER",
            "EXACT_TEXT",
            "ENTITY_REFERENCE",
            "entity-reference-86400s.v1",
        ): ("EXACT_VALUE_BOUND", "EXACT_VALUE_MATCH"),
        (
            "deterministic-mainland-last-price.v1",
            "1.0.0",
            "exact-decimal-unit.v1",
            "1.0.0",
            "DETERMINISTIC_RENDERER",
            "EXACT_DECIMAL_UNIT",
            "MARKET_QUOTE",
            "current-observation-300s.v1",
        ): ("EXACT_VALUE_BOUND", "EXACT_VALUE_MATCH"),
    }
)
_REGISTERED_ADAPTERS = frozenset((item[0], item[1]) for item in _REGISTRY)
_REGISTERED_COMPARATORS = frozenset((item[2], item[3]) for item in _REGISTRY)
_REGISTERED_PROJECTIONS = frozenset(item[:7] for item in _REGISTRY)
_TRUSTED_CONTEXT_INPUT_FIELDS = frozenset(
    {
        "tenant_scope",
        "scope_mode",
        "tenant_id",
        "owner_user_id",
        "job_id",
        "run_id",
        "decree_id",
        "draft_fingerprint",
        "route_digest",
        "evaluated_at",
        "approved_processing_order",
        "evidence_authorities",
        "approved_locator_authorities",
    }
)


class ClaimEvidenceGateError(Exception):
    """Sanitized fail-closed error exposing one closed reason code."""

    def __init__(self, code: str) -> None:
        safe_code = code if code in _REASONS else "PROJECTION_NOT_CANONICAL"
        self.code = safe_code
        super().__init__(safe_code)


def _fail(code: str) -> None:
    raise ClaimEvidenceGateError(code) from None


class _Record(Mapping[str, Any]):
    __slots__ = ("_items", "_map")

    def __init__(self, items: Mapping[str, Any]) -> None:
        frozen = tuple((key, _freeze(value)) for key, value in items.items())
        object.__setattr__(self, "_items", frozen)
        object.__setattr__(self, "_map", MappingProxyType(dict(frozen)))

    def __getitem__(self, key: str) -> Any:
        return self._map[key]

    def __iter__(self) -> Iterator[str]:
        return (key for key, _ in self._items)

    def __len__(self) -> int:
        return len(self._items)

    def __getattr__(self, name: str) -> Any:
        try:
            return self._map[name]
        except KeyError:
            raise AttributeError(name) from None

    def __setattr__(self, name: str, value: Any) -> None:
        raise AttributeError("frozen")


def _freeze(value: Any) -> Any:
    if isinstance(value, _Record):
        return value
    if type(value) is dict:
        return _Record(value)
    if type(value) is list or type(value) is tuple:
        return tuple(_freeze(item) for item in value)
    if value is None or type(value) in {str, bool}:
        return value
    _fail("PROJECTION_NOT_CANONICAL")


def _plain(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    if hasattr(value, "__dataclass_fields__"):
        return {field.name: _plain(getattr(value, field.name)) for field in fields(value)}
    return value


def _canonical(value: Any) -> bytes:
    invalid = False
    try:
        encoded = json.dumps(
            _plain(value),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError):
        invalid = True
    if invalid:
        _fail("PROJECTION_NOT_CANONICAL")
    return encoded


def _digest(kind: str, schema: str, payload: Any) -> str:
    preimage = {
        "digest_algorithm": "sha256",
        "digest_domain": _DOMAIN,
        "object_kind": kind,
        "schema_version": schema,
        "payload": _plain(payload),
    }
    return "sha256:" + hashlib.sha256(_canonical(preimage)).hexdigest()


def _verify_digest(value: Mapping[str, Any], field: str, kind: str) -> None:
    observed = value.get(field)
    if type(observed) is not str or not _DIGEST.fullmatch(observed):
        _fail("DIGEST_MISMATCH")
    payload = {key: item for key, item in value.items() if key != field}
    if observed != _digest(kind, value["schema_version"], payload):
        _fail("DIGEST_MISMATCH")


def _check_record_bytes(value: Any) -> None:
    if len(_canonical(value)) > 4_096:
        _fail("BUDGET_EXCEEDED")


def _expect_fields(value: Any, expected: tuple[str, ...]) -> dict[str, Any]:
    if type(value) is not dict or set(value) != set(expected):
        _fail("PROJECTION_NOT_CANONICAL")
    return value


def _string(value: Any, *, safe: bool = False, producer: bool = False) -> str:
    if type(value) is not str or not value:
        _fail("PROJECTION_NOT_CANONICAL")
    invalid = False
    try:
        byte_length = len(value.encode("utf-8"))
    except UnicodeError:
        invalid = True
        byte_length = 0
    if invalid:
        _fail("PROJECTION_NOT_CANONICAL")
    if len(value) > _MAX_STRING_SCALARS or byte_length > _MAX_STRING_BYTES:
        _fail("BUDGET_EXCEEDED")
    pattern = _PRODUCER_ID if producer else _SAFE_REF
    if (safe or producer) and not pattern.fullmatch(value):
        _fail("PROJECTION_NOT_CANONICAL")
    return value


def _timestamp(value: Any) -> datetime:
    if type(value) is not str or not _CANONICAL_TIME.fullmatch(value):
        _fail("FRESHNESS_INVALID")
    invalid = False
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        invalid = True
    if invalid:
        _fail("FRESHNESS_INVALID")
    return parsed


def _ordinal(value: Any) -> str:
    if type(value) is not str or not _ORDINAL.fullmatch(value) or int(value) > 63:
        _fail("PUBLIC_PROJECTION_MISMATCH")
    return value


def _scan_json(text: str) -> None:
    depth = 0
    nodes = 0
    in_string = False
    escaped = False
    string_start = 0
    index = 0
    while index < len(text):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                token = text[string_start : index + 1]
                invalid = False
                try:
                    decoded = json.loads(token)
                    encoded = decoded.encode("utf-8")
                except (ValueError, UnicodeError):
                    invalid = True
                    decoded = ""
                    encoded = b""
                if invalid:
                    _fail("PROJECTION_NOT_CANONICAL")
                if len(decoded) > _MAX_STRING_SCALARS or len(encoded) > _MAX_STRING_BYTES:
                    _fail("BUDGET_EXCEEDED")
                lookahead = index + 1
                while lookahead < len(text) and text[lookahead] in " \t\r\n":
                    lookahead += 1
                if lookahead >= len(text) or text[lookahead] != ":":
                    nodes += 1
                    if nodes > _MAX_NODES:
                        _fail("BUDGET_EXCEEDED")
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            string_start = index
        elif char in "[{":
            depth += 1
            nodes += 1
            if depth > _MAX_DEPTH or nodes > _MAX_NODES:
                _fail("BUDGET_EXCEEDED")
        elif char in "]}":
            depth -= 1
            if depth < 0:
                _fail("PROJECTION_NOT_CANONICAL")
        elif char in "tfn":
            nodes += 1
            if nodes > _MAX_NODES:
                _fail("BUDGET_EXCEEDED")
        elif (
            char in "-0123456789"
            or text.startswith("NaN", index)
            or text.startswith("Infinity", index)
        ):
            end = index + 1
            while end < len(text) and text[end] not in " \t\r\n,]}":
                end += 1
            if end - index > 128:
                _fail("BUDGET_EXCEEDED")
            _fail("PROJECTION_NOT_CANONICAL")
        index += 1
    if in_string or depth != 0:
        _fail("PROJECTION_NOT_CANONICAL")


def _raw_text(raw: str | bytes) -> str:
    if type(raw) is bytes:
        if len(raw) > _RAW_BYTES:
            _fail("BUDGET_EXCEEDED")
        invalid = False
        try:
            text = raw.decode("utf-8")
        except UnicodeError:
            invalid = True
            text = ""
        if invalid:
            _fail("PROJECTION_NOT_CANONICAL")
    elif type(raw) is str:
        if len(raw) > _RAW_BYTES:
            _fail("BUDGET_EXCEEDED")
        total = 0
        invalid = False
        try:
            for start in range(0, len(raw), 4096):
                chunk = raw[start : start + 4096].encode("utf-8")
                total += len(chunk)
                if total > _RAW_BYTES:
                    _fail("BUDGET_EXCEEDED")
            text = raw
        except UnicodeError:
            invalid = True
            text = ""
        if invalid:
            _fail("PROJECTION_NOT_CANONICAL")
    else:
        _fail("PROJECTION_NOT_CANONICAL")
    if text.startswith("\ufeff"):
        _fail("PROJECTION_NOT_CANONICAL")
    return text


def _parse_json(raw: str | bytes) -> dict[str, Any]:
    text = _raw_text(raw)
    _scan_json(text)

    def pairs_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                _fail("DUPLICATE_ID")
            result[key] = value
        return result

    caught: ClaimEvidenceGateError | None = None
    invalid = False
    try:
        value = json.loads(
            text,
            object_pairs_hook=pairs_hook,
            parse_int=lambda _: _fail("PROJECTION_NOT_CANONICAL"),
            parse_float=lambda _: _fail("PROJECTION_NOT_CANONICAL"),
            parse_constant=lambda _: _fail("PROJECTION_NOT_CANONICAL"),
        )
    except ClaimEvidenceGateError as error:
        caught = error
    except (ValueError, TypeError, RecursionError):
        invalid = True
    if caught is not None:
        caught.__traceback__ = None
        raise caught from None
    if invalid:
        _fail("PROJECTION_NOT_CANONICAL")
    if type(value) is not dict:
        _fail("PROJECTION_NOT_CANONICAL")
    return value


def _walk_trusted_budget(root: Any, *, max_nodes: int = _MAX_NODES) -> None:
    stack = [(root, 1)]
    nodes = 0
    while stack:
        value, depth = stack.pop()
        nodes += 1
        if nodes > max_nodes:
            _fail("BUDGET_EXCEEDED")
        value_type = type(value)
        if value_type is dict:
            if depth > _MAX_DEPTH:
                _fail("BUDGET_EXCEEDED")
            for key, item in value.items():
                _string(key)
                child_depth = depth + 1 if type(item) in {dict, list, tuple} else depth
                stack.append((item, child_depth))
        elif value_type in {list, tuple}:
            if depth > _MAX_DEPTH:
                _fail("BUDGET_EXCEEDED")
            for item in value:
                child_depth = depth + 1 if type(item) in {dict, list, tuple} else depth
                stack.append((item, child_depth))
        elif value_type is str:
            _string(value)
        elif value is not None and value_type is not bool:
            _fail("PROJECTION_NOT_CANONICAL")


@dataclass(frozen=True, slots=True, kw_only=True)
class TrustedEvidenceContextV1:
    tenant_scope: str
    scope_mode: str
    tenant_id: None
    owner_user_id: str
    job_id: str
    run_id: str
    decree_id: str
    draft_fingerprint: str
    route_digest: str
    evaluated_at: str
    approved_processing_order: tuple[str, ...]
    evidence_authorities: tuple[dict[str, object], ...]
    approved_locator_authorities: tuple[dict[str, object], ...]
    schema_version: str = field(default="claim-evidence-trusted-context.v1", init=False)

    def __new__(cls, *args: Any, **kwargs: Any) -> TrustedEvidenceContextV1:
        if args or set(kwargs) != _TRUSTED_CONTEXT_INPUT_FIELDS:
            _fail("PROJECTION_NOT_CANONICAL")
        return object.__new__(cls)

    def __post_init__(self) -> None:
        _walk_trusted_budget(
            {
                "schema_version": self.schema_version,
                "tenant_scope": self.tenant_scope,
                "scope_mode": self.scope_mode,
                "tenant_id": self.tenant_id,
                "owner_user_id": self.owner_user_id,
                "job_id": self.job_id,
                "run_id": self.run_id,
                "decree_id": self.decree_id,
                "draft_fingerprint": self.draft_fingerprint,
                "route_digest": self.route_digest,
                "evaluated_at": self.evaluated_at,
                "approved_processing_order": self.approved_processing_order,
                "evidence_authorities": self.evidence_authorities,
                "approved_locator_authorities": self.approved_locator_authorities,
            }
        )
        if type(self.approved_processing_order) is not tuple:
            _fail("PROJECTION_NOT_CANONICAL")
        if (
            type(self.evidence_authorities) is not tuple
            or type(self.approved_locator_authorities) is not tuple
        ):
            _fail("PROJECTION_NOT_CANONICAL")
        if not 1 <= len(self.approved_processing_order) <= 64:
            _fail("BUDGET_EXCEEDED")
        if len(self.evidence_authorities) > 64 or len(self.approved_locator_authorities) > 64:
            _fail("BUDGET_EXCEEDED")
        order = tuple(_string(item, producer=True) for item in self.approved_processing_order)
        if len(set(order)) != len(order):
            _fail("AGGREGATE_MISMATCH")
        for item in self.evidence_authorities:
            _walk_trusted_budget(item, max_nodes=512)
        for item in self.approved_locator_authorities:
            _walk_trusted_budget(item, max_nodes=512)
        authorities = tuple(_freeze_authority(item) for item in self.evidence_authorities)
        locators = tuple(
            _freeze_locator_authority(item) for item in self.approved_locator_authorities
        )
        authority_refs = tuple(item.evidence_ref for item in authorities)
        if len(set(authority_refs)) != len(authority_refs):
            _fail("DUPLICATE_ID")
        if authority_refs != tuple(sorted(authority_refs)):
            _fail("FRESHNESS_INVALID")
        locator_keys = tuple(
            (item.producer_node_id, item.department_ordinal, item.bureau_ordinal)
            for item in locators
        )
        if len(set(locator_keys)) != len(locator_keys):
            _fail("DUPLICATE_ID")
        if locator_keys != tuple(sorted(locator_keys)):
            _fail("FRESHNESS_INVALID")
        _string(self.tenant_scope, safe=True)
        _string(self.scope_mode, safe=True)
        for value in (self.owner_user_id, self.job_id, self.run_id, self.decree_id):
            _string(value, safe=True)
        if (
            self.tenant_scope != "courtos-single-tenant.v1"
            or self.scope_mode != "OWNER_ONLY"
            or self.tenant_id is not None
        ):
            _fail("IDENTITY_MISMATCH")
        if type(self.draft_fingerprint) is not str or type(self.route_digest) is not str:
            _fail("PROJECTION_NOT_CANONICAL")
        if not _DIGEST.fullmatch(self.draft_fingerprint) or not _DIGEST.fullmatch(
            self.route_digest
        ):
            _fail("IDENTITY_MISMATCH")
        _timestamp(self.evaluated_at)
        object.__setattr__(self, "approved_processing_order", order)
        object.__setattr__(self, "evidence_authorities", authorities)
        object.__setattr__(self, "approved_locator_authorities", locators)


_context_signature = signature(TrustedEvidenceContextV1.__init__)
TrustedEvidenceContextV1.__signature__ = _context_signature.replace(
    parameters=tuple(_context_signature.parameters.values())[1:]
)


@dataclass(frozen=True, slots=True)
class ClaimEvidenceEvaluationV1:
    schema_version: str
    internal_envelope: _Record
    public_envelope: _Record
    evaluation_digest: str


def _freeze_authority(value: Any) -> _Record:
    expected = (
        "schema_version",
        "evidence_ref",
        "adapter_id",
        "adapter_version",
        "comparator_id",
        "comparator_version",
        "freshness_policy_id",
        "source_kind",
        "source_assertion_class",
        "source_digest",
        "fact_key",
        "subject_key",
        "category",
        "fact_value_digest",
        "as_of",
        "retrieved_at",
        "evaluated_at",
        "scope_identity",
        "admission_status",
        "conflict_digests",
    )
    data = _expect_fields(value, expected)
    if data["schema_version"] != "claim-evidence-authority.v1":
        _fail("PROJECTION_NOT_CANONICAL")
    for name in (
        "evidence_ref",
        "adapter_id",
        "adapter_version",
        "comparator_id",
        "comparator_version",
        "freshness_policy_id",
        "source_kind",
        "source_assertion_class",
        "fact_key",
        "subject_key",
        "category",
    ):
        _string(data[name], safe=True)
    if (data["adapter_id"], data["adapter_version"]) not in _REGISTERED_ADAPTERS:
        _fail("ADAPTER_NOT_REGISTERED")
    if (data["comparator_id"], data["comparator_version"]) not in _REGISTERED_COMPARATORS:
        _fail("COMPARATOR_NOT_REGISTERED")
    if _registry_key(data, data["freshness_policy_id"]) not in _REGISTRY:
        _fail("COMPARATOR_NOT_REGISTERED")
    for field_name in ("source_digest", "fact_value_digest"):
        if type(data[field_name]) is not str or not _DIGEST.fullmatch(data[field_name]):
            _fail("DIGEST_MISMATCH")
    if type(data["admission_status"]) is not str or data["admission_status"] not in {
        "ADMITTED",
        "BLOCKED",
    }:
        _fail("PROJECTION_NOT_CANONICAL")
    if type(data["conflict_digests"]) is not list or len(data["conflict_digests"]) > 32:
        _fail("BUDGET_EXCEEDED")
    for digest in data["conflict_digests"]:
        if type(digest) is not str or not _DIGEST.fullmatch(digest):
            _fail("DIGEST_MISMATCH")
    _validate_scope(data["scope_identity"])
    for field_name in ("as_of", "retrieved_at", "evaluated_at"):
        _timestamp(data[field_name])
    _check_record_bytes(data)
    return _Record(deepcopy_plain(data))


def _freeze_locator_authority(value: Any) -> _Record:
    data = _expect_fields(
        value,
        (
            "schema_version",
            "producer_node_id",
            "department_ordinal",
            "bureau_ordinal",
            "claim_ordinals",
            "response_digest",
        ),
    )
    if data["schema_version"] != "claim-evidence-locator-authority.v1":
        _fail("PROJECTION_NOT_CANONICAL")
    _string(data["producer_node_id"], producer=True)
    department = _ordinal(data["department_ordinal"])
    bureau = _ordinal(data["bureau_ordinal"])
    if type(data["claim_ordinals"]) is not list:
        _fail("PROJECTION_NOT_CANONICAL")
    claims = tuple(_ordinal(item) for item in data["claim_ordinals"])
    if claims != tuple(sorted(claims, key=int)) or len(set(claims)) != len(claims):
        _fail("FRESHNESS_INVALID")
    payload = {
        "producer_node_id": data["producer_node_id"],
        "department_ordinal": department,
        "bureau_ordinal": bureau,
        "claim_ordinals": list(claims),
    }
    if data["response_digest"] != _digest(
        "response-shape", "claim-evidence-response-shape.v1", payload
    ):
        _fail("DIGEST_MISMATCH")
    _check_record_bytes(data)
    return _Record(deepcopy_plain(data))


def deepcopy_plain(value: Any) -> Any:
    if type(value) is dict:
        return {key: deepcopy_plain(item) for key, item in value.items()}
    if type(value) is list:
        return [deepcopy_plain(item) for item in value]
    if value is None or type(value) in {str, bool}:
        return value
    _fail("PROJECTION_NOT_CANONICAL")


def _validate_scope(value: Any) -> dict[str, Any]:
    data = _expect_fields(
        value,
        (
            "schema_version",
            "tenant_scope",
            "scope_mode",
            "tenant_id",
            "owner_user_id",
            "run_id",
            "decree_id",
        ),
    )
    if (
        data["schema_version"] != "claim-evidence-scope.v1"
        or data["tenant_scope"] != "courtos-single-tenant.v1"
        or data["scope_mode"] != "OWNER_ONLY"
        or data["tenant_id"] is not None
    ):
        _fail("IDENTITY_MISMATCH")
    for field_name in ("owner_user_id", "run_id", "decree_id"):
        _string(data[field_name], safe=True)
    return data


def _validate_locator(value: Any) -> dict[str, Any]:
    if (
        type(value) is not dict
        or type(value.get("kind")) is not str
        or value["kind"] not in {"BUREAU_CLAUSE", "BUREAU_OPINION"}
    ):
        _fail("PUBLIC_PROJECTION_MISMATCH")
    expected = (
        ("kind", "department_ordinal", "bureau_ordinal", "claim_ordinal")
        if value["kind"] == "BUREAU_CLAUSE"
        else ("kind", "department_ordinal", "bureau_ordinal")
    )
    _expect_fields(value, expected)
    _ordinal(value["department_ordinal"])
    _ordinal(value["bureau_ordinal"])
    if value["kind"] == "BUREAU_CLAUSE":
        _ordinal(value["claim_ordinal"])
    return value


def _validate_public_value(value: Any, extractor: str) -> None:
    if extractor == "bureau-opinion-clause.v1":
        if value is not None:
            _fail("PUBLIC_PROJECTION_MISMATCH")
        return
    data = _expect_fields(
        value,
        (
            "schema_version",
            "template_id",
            "value_type",
            "canonical_value",
            "rendered_value_text",
            "unit",
            "as_of",
            "rendered_as_of_text",
            "source_display",
        ),
    )
    if data["schema_version"] != "claim-public-value.v1":
        _fail("PUBLIC_PROJECTION_MISMATCH")
    if extractor == "jinyiwei-entity-reference-renderer.v1":
        expected = (
            "jinyiwei-entity-reference.v1",
            "TEXT",
            data["canonical_value"],
            None,
            None,
            None,
            "锦衣卫实体引用",
        )
        observed = (
            data["template_id"],
            data["value_type"],
            data["rendered_value_text"],
            data["unit"],
            data["as_of"],
            data["rendered_as_of_text"],
            data["source_display"],
        )
        if (
            type(data["canonical_value"]) is not str
            or not data["canonical_value"].strip()
            or observed != expected
        ):
            _fail("PUBLIC_PROJECTION_MISMATCH")
        return
    if extractor != "jinyiwei-mainland-last-price-renderer.v1":
        _fail("EXTRACTOR_NOT_REGISTERED")
    if (
        data["template_id"] != "jinyiwei-mainland-last-price.v1"
        or data["value_type"] != "DECIMAL"
        or data["unit"] != "CNY"
        or data["rendered_value_text"] != f"{data['canonical_value']} CNY"
        or data["rendered_as_of_text"] != data["as_of"]
        or data["source_display"] != "锦衣卫大陆市场最后价"
    ):
        _fail("PUBLIC_PROJECTION_MISMATCH")
    _decimal(data["canonical_value"], positive=True)
    _timestamp(data["as_of"])


def _decimal(value: Any, *, positive: bool = False) -> Decimal:
    if type(value) is not str or not _CANONICAL_DECIMAL.fullmatch(value) or value == "-0":
        _fail("NUMERIC_VALUE_NOT_EXACTLY_BOUND")
    invalid = False
    try:
        number = Decimal(value)
    except InvalidOperation:
        invalid = True
        number = Decimal(0)
    if invalid:
        _fail("NUMERIC_VALUE_NOT_EXACTLY_BOUND")
    digits = len(number.as_tuple().digits)
    scale = max(0, -number.as_tuple().exponent)
    adjusted = number.adjusted() if number else 0
    if digits > 38 or scale > 12 or adjusted < -12 or adjusted > 37 or (positive and number <= 0):
        _fail("NUMERIC_VALUE_NOT_EXACTLY_BOUND")
    return number


def _validate_claim(value: Any) -> dict[str, Any]:
    data = _expect_fields(
        value,
        (
            "schema_version",
            "claim_id",
            "producer_node_id",
            "extractor_id",
            "extractor_version",
            "public_projection_ref",
            "kind",
            "claim_key",
            "public_value_projection",
            "claim_digest",
            "evidence_refs",
            "derivation_ref",
        ),
    )
    if data["schema_version"] != "claim-projection.v1":
        _fail("PROJECTION_NOT_CANONICAL")
    if type(data["claim_id"]) is not str or not _CLAIM_ID.fullmatch(data["claim_id"]):
        _fail("PROJECTION_NOT_CANONICAL")
    _string(data["producer_node_id"], producer=True)
    extractor = data["extractor_id"]
    if type(extractor) is not str or type(data["extractor_version"]) is not str:
        _fail("PROJECTION_NOT_CANONICAL")
    if extractor not in _EXTRACTOR_ORDER or data["extractor_version"] != "1.0.0":
        _fail("EXTRACTOR_NOT_REGISTERED")
    if type(data["kind"]) is not str:
        _fail("PROJECTION_NOT_CANONICAL")
    _string(data["claim_key"], safe=True)
    if extractor != "bureau-opinion-clause.v1" and data["kind"] != "FACT":
        _fail("PUBLIC_PROJECTION_MISMATCH")
    locator = _validate_locator(data["public_projection_ref"])
    if extractor == "bureau-opinion-clause.v1":
        expected_locator = (
            "BUREAU_CLAUSE" if data["kind"] in {"FACT", "INFERENCE"} else "BUREAU_OPINION"
        )
    else:
        expected_locator = "BUREAU_OPINION"
    if locator["kind"] != expected_locator:
        _fail("PUBLIC_PROJECTION_MISMATCH")
    if data["kind"] not in {"FACT", "INFERENCE", "OPINION", "RECOMMENDATION"}:
        _fail("PROJECTION_NOT_CANONICAL")
    _validate_public_value(data["public_value_projection"], extractor)
    if type(data["evidence_refs"]) is not list or len(data["evidence_refs"]) > 16:
        _fail("BUDGET_EXCEEDED")
    refs = tuple(_string(item, safe=True) for item in data["evidence_refs"])
    if len(set(refs)) != len(refs):
        _fail("DUPLICATE_ID")
    if data["kind"] in {"OPINION", "RECOMMENDATION"} and (
        refs or data["derivation_ref"] is not None
    ):
        _fail("PROJECTION_NOT_CANONICAL")
    if data["kind"] == "INFERENCE" and type(data["derivation_ref"]) is not str:
        _fail("PROJECTION_NOT_CANONICAL")
    if data["kind"] == "FACT" and data["derivation_ref"] is not None:
        _fail("PROJECTION_NOT_CANONICAL")
    _check_record_bytes(data)
    _verify_digest(data, "claim_digest", "claim-projection")
    return data


def _registry_key(data: Mapping[str, Any], freshness: str) -> tuple[str, ...]:
    return (
        data["adapter_id"],
        data["adapter_version"],
        data["comparator_id"],
        data["comparator_version"],
        data["source_kind"],
        data["source_assertion_class"],
        data["category"],
        freshness,
    )


def _validate_evidence(value: Any) -> dict[str, Any]:
    data = _expect_fields(
        value,
        (
            "schema_version",
            "evidence_ref",
            "adapter_id",
            "adapter_version",
            "comparator_id",
            "comparator_version",
            "source_kind",
            "source_assertion_class",
            "source_digest",
            "fact_key",
            "subject_key",
            "category",
            "fact_value_digest",
            "as_of",
            "retrieved_at",
            "evaluated_at",
            "tenant_scope",
            "scope_mode",
            "tenant_id",
            "owner_user_id",
            "run_id",
            "decree_id",
            "projection_digest",
        ),
    )
    if data["schema_version"] != "evidence-projection.v1":
        _fail("PROJECTION_NOT_CANONICAL")
    for name in (
        "evidence_ref",
        "adapter_id",
        "adapter_version",
        "comparator_id",
        "comparator_version",
        "source_kind",
        "source_assertion_class",
        "fact_key",
        "subject_key",
        "category",
        "owner_user_id",
        "run_id",
        "decree_id",
    ):
        _string(data[name], safe=True)
    if (data["adapter_id"], data["adapter_version"]) not in _REGISTERED_ADAPTERS:
        _fail("ADAPTER_NOT_REGISTERED")
    if (data["comparator_id"], data["comparator_version"]) not in _REGISTERED_COMPARATORS:
        _fail("COMPARATOR_NOT_REGISTERED")
    projection_key = (
        data["adapter_id"],
        data["adapter_version"],
        data["comparator_id"],
        data["comparator_version"],
        data["source_kind"],
        data["source_assertion_class"],
        data["category"],
    )
    if projection_key not in _REGISTERED_PROJECTIONS:
        _fail("COMPARATOR_NOT_REGISTERED")
    if (
        data["tenant_scope"] != "courtos-single-tenant.v1"
        or data["scope_mode"] != "OWNER_ONLY"
        or data["tenant_id"] is not None
    ):
        _fail("IDENTITY_MISMATCH")
    for field_name in ("source_digest", "fact_value_digest"):
        if type(data[field_name]) is not str or not _DIGEST.fullmatch(data[field_name]):
            _fail("DIGEST_MISMATCH")
    for field_name in ("as_of", "retrieved_at", "evaluated_at"):
        _timestamp(data[field_name])
    _check_record_bytes(data)
    _verify_digest(data, "projection_digest", "evidence-projection")
    return data


def _validate_binding(value: Any) -> dict[str, Any]:
    data = _expect_fields(
        value,
        (
            "schema_version",
            "claim_id",
            "claim_digest",
            "evidence_ref",
            "evidence_projection_digest",
            "relation",
            "binding_digest",
        ),
    )
    if data["schema_version"] != "claim-evidence-binding.v1" or data["relation"] != "SUPPORTS":
        _fail("PROJECTION_NOT_CANONICAL")
    if type(data["claim_id"]) is not str or not _CLAIM_ID.fullmatch(data["claim_id"]):
        _fail("PROJECTION_NOT_CANONICAL")
    _string(data["evidence_ref"], safe=True)
    for field_name in ("claim_digest", "evidence_projection_digest"):
        if type(data[field_name]) is not str or not _DIGEST.fullmatch(data[field_name]):
            _fail("DIGEST_MISMATCH")
    _check_record_bytes(data)
    _verify_digest(data, "binding_digest", "claim-evidence-binding")
    return data


def _validate_packet(value: Any) -> dict[str, Any]:
    data = _expect_fields(
        value,
        (
            "schema_version",
            "producer_node_id",
            "claims",
            "evidence_projections",
            "bindings",
            "packet_digest",
        ),
    )
    if data["schema_version"] != "producer-claim-packet.v1":
        _fail("PROJECTION_NOT_CANONICAL")
    producer = _string(data["producer_node_id"], producer=True)
    if type(data["claims"]) is not list or not 1 <= len(data["claims"]) <= 64:
        _fail("BUDGET_EXCEEDED")
    if type(data["evidence_projections"]) is not list or len(data["evidence_projections"]) > 64:
        _fail("BUDGET_EXCEEDED")
    if type(data["bindings"]) is not list or len(data["bindings"]) > 128:
        _fail("BUDGET_EXCEEDED")
    claims = [_validate_claim(item) for item in data["claims"]]
    evidence = [_validate_evidence(item) for item in data["evidence_projections"]]
    bindings = [_validate_binding(item) for item in data["bindings"]]
    if any(item["producer_node_id"] != producer for item in claims):
        _fail("IDENTITY_MISMATCH")
    claims_by_id = {item["claim_id"]: item for item in claims}
    local_evidence_refs = {item["evidence_ref"] for item in evidence}
    declared_evidence_refs = {
        evidence_ref for claim in claims for evidence_ref in claim["evidence_refs"]
    }
    if not local_evidence_refs.issubset(declared_evidence_refs):
        _fail("IDENTITY_MISMATCH")
    for binding in bindings:
        claim = claims_by_id.get(binding["claim_id"])
        if claim is None:
            _fail("IDENTITY_MISMATCH")
        if (
            binding["evidence_ref"] not in claim["evidence_refs"]
            or binding["evidence_ref"] not in local_evidence_refs
        ):
            _fail("IDENTITY_MISMATCH")
    for collection, key in (
        (claims, "claim_id"),
        (evidence, "evidence_ref"),
        (bindings, "binding_digest"),
    ):
        values = [item[key] for item in collection]
        if len(values) != len(set(values)):
            _fail("DUPLICATE_ID")
    claims.sort(key=lambda item: (_EXTRACTOR_ORDER[item["extractor_id"]], item["claim_id"]))
    evidence.sort(key=lambda item: item["evidence_ref"])
    bindings.sort(key=lambda item: (item["claim_id"], item["evidence_ref"]))
    normalized = {
        "schema_version": data["schema_version"],
        "producer_node_id": producer,
        "claims": claims,
        "evidence_projections": evidence,
        "bindings": bindings,
        "packet_digest": data["packet_digest"],
    }
    _verify_digest(normalized, "packet_digest", "producer-claim-packet")
    return normalized


def parse_claim_evidence_candidate_v1(raw: str | bytes, /) -> _Record:
    root = _expect_fields(_parse_json(raw), ("schema_version", "producer_packets"))
    if (
        root["schema_version"] != "claim-evidence-candidate.v1"
        or type(root["producer_packets"]) is not list
    ):
        _fail("PROJECTION_NOT_CANONICAL")
    if not 1 <= len(root["producer_packets"]) <= 64:
        _fail("BUDGET_EXCEEDED")
    packets = [_validate_packet(item) for item in root["producer_packets"]]
    total_claims = sum(len(item["claims"]) for item in packets)
    total_evidence = sum(len(item["evidence_projections"]) for item in packets)
    total_bindings = sum(len(item["bindings"]) for item in packets)
    if total_claims > 64 or total_evidence > 64 or total_bindings > 128:
        _fail("BUDGET_EXCEEDED")
    if total_claims * total_evidence > 4_096:
        _fail("BUDGET_EXCEEDED")
    if sum(len(_canonical(claim)) for packet in packets for claim in packet["claims"]) > 65_536:
        _fail("BUDGET_EXCEEDED")
    if (
        sum(len(_canonical(item)) for packet in packets for item in packet["evidence_projections"])
        > 131_072
    ):
        _fail("BUDGET_EXCEEDED")
    producers = [item["producer_node_id"] for item in packets]
    if len(set(producers)) != len(producers):
        _fail("DUPLICATE_ID")
    claim_ids = [claim["claim_id"] for packet in packets for claim in packet["claims"]]
    binding_ids = [
        binding["binding_digest"] for packet in packets for binding in packet["bindings"]
    ]
    if len(claim_ids) != len(set(claim_ids)) or len(binding_ids) != len(set(binding_ids)):
        _fail("DUPLICATE_ID")
    evidence_by_ref: dict[str, dict[str, Any]] = {}
    for packet in packets:
        for projection in packet["evidence_projections"]:
            prior = evidence_by_ref.get(projection["evidence_ref"])
            if prior is not None and _canonical(prior) != _canonical(projection):
                _fail("EVIDENCE_CONFLICT")
            evidence_by_ref[projection["evidence_ref"]] = projection
    packets.sort(key=lambda item: item["producer_node_id"])
    return _Record({"schema_version": root["schema_version"], "producer_packets": packets})


def _context_projection(context: TrustedEvidenceContextV1) -> dict[str, Any]:
    return {
        "schema_version": context.schema_version,
        "tenant_scope": context.tenant_scope,
        "scope_mode": context.scope_mode,
        "tenant_id": context.tenant_id,
        "owner_user_id": context.owner_user_id,
        "job_id": context.job_id,
        "run_id": context.run_id,
        "decree_id": context.decree_id,
        "draft_fingerprint": context.draft_fingerprint,
        "route_digest": context.route_digest,
        "evaluated_at": context.evaluated_at,
        "approved_processing_order": list(context.approved_processing_order),
        "evidence_authorities": [_plain(item) for item in context.evidence_authorities],
        "approved_locator_authorities": [
            _plain(item) for item in context.approved_locator_authorities
        ],
    }


def _validate_freshness(authority: _Record, evaluated_at: str) -> None:
    reference = _timestamp(evaluated_at)
    times = [_timestamp(authority[field]) for field in ("as_of", "retrieved_at", "evaluated_at")]
    if any(item > reference for item in times):
        _fail("FRESHNESS_INVALID")
    maximum = {"current-observation-300s.v1": 300, "entity-reference-86400s.v1": 86_400}.get(
        authority.freshness_policy_id
    )
    if maximum is not None and (reference - times[0]).total_seconds() > maximum:
        _fail("FRESHNESS_INVALID")


def _locator_allowed(claim: Mapping[str, Any], context: TrustedEvidenceContextV1) -> bool:
    locator = claim["public_projection_ref"]
    for authority in context.approved_locator_authorities:
        if (
            authority.producer_node_id == claim["producer_node_id"]
            and authority.department_ordinal == locator["department_ordinal"]
            and authority.bureau_ordinal == locator["bureau_ordinal"]
        ):
            return (
                locator["kind"] == "BUREAU_OPINION"
                or locator["claim_ordinal"] in authority.claim_ordinals
            )
    return False


def _fact_value_digest(claim: Mapping[str, Any], evidence: Mapping[str, Any]) -> str | None:
    value = claim["public_value_projection"]
    if value is None:
        return None
    if value["value_type"] == "DECIMAL":
        _decimal(value["canonical_value"], positive=True)
    payload = {
        "fact_key": evidence["fact_key"],
        "subject_key": evidence["subject_key"],
        "value_type": value["value_type"],
        "canonical_value": value["canonical_value"],
        "unit": value["unit"],
    }
    return _digest("fact-value", "claim-evidence-fact-value.v1", payload)


def _record_with_digest(value: dict[str, Any], field: str, kind: str) -> _Record:
    payload = {key: item for key, item in value.items() if key != field}
    value[field] = _digest(kind, value["schema_version"], payload)
    return _Record(value)


def evaluate_claim_evidence_v1(
    raw: str | bytes,
    /,
    *,
    trusted_context: TrustedEvidenceContextV1,
) -> ClaimEvidenceEvaluationV1:
    if type(trusted_context) is not TrustedEvidenceContextV1:
        _fail("PROJECTION_NOT_CANONICAL")
    candidate = parse_claim_evidence_candidate_v1(raw)
    packets = tuple(candidate.producer_packets)
    producer_ids = tuple(packet.producer_node_id for packet in packets)
    if set(producer_ids) != set(trusted_context.approved_processing_order):
        _fail("AGGREGATE_MISMATCH")
    claims: list[_Record] = []
    evidence: list[_Record] = []
    bindings: list[_Record] = []
    indexes: dict[str, _Record] = {}
    global_claim_ids: set[str] = set()
    global_evidence: dict[str, _Record] = {}
    global_binding_ids: set[str] = set()
    for packet in packets:
        for claim in packet.claims:
            if claim.claim_id in global_claim_ids:
                _fail("DUPLICATE_ID")
            global_claim_ids.add(claim.claim_id)
            claims.append(claim)
        for projection in packet.evidence_projections:
            if (
                projection.tenant_scope != trusted_context.tenant_scope
                or projection.scope_mode != trusted_context.scope_mode
                or projection.tenant_id != trusted_context.tenant_id
                or projection.owner_user_id != trusted_context.owner_user_id
                or projection.run_id != trusted_context.run_id
                or projection.decree_id != trusted_context.decree_id
            ):
                _fail("IDENTITY_MISMATCH")
            prior = global_evidence.get(projection.evidence_ref)
            if prior is not None and _canonical(prior) != _canonical(projection):
                _fail("EVIDENCE_CONFLICT")
            if prior is None:
                global_evidence[projection.evidence_ref] = projection
                evidence.append(projection)
        for binding in packet.bindings:
            if binding.binding_digest in global_binding_ids:
                _fail("DUPLICATE_ID")
            global_binding_ids.add(binding.binding_digest)
            bindings.append(binding)
        index = {
            "schema_version": "producer-packet-index.v1",
            "producer_node_id": packet.producer_node_id,
            "packet_digest": packet.packet_digest,
            "claim_ids": [item.claim_id for item in packet.claims],
            "evidence_refs": [item.evidence_ref for item in packet.evidence_projections],
            "binding_digests": [item.binding_digest for item in packet.bindings],
            "index_digest": "",
        }
        indexes[packet.producer_node_id] = _record_with_digest(
            index, "index_digest", "producer-packet-index"
        )
    claims.sort(key=lambda item: (_EXTRACTOR_ORDER[item.extractor_id], item.claim_id))
    evidence.sort(key=lambda item: item.evidence_ref)
    bindings.sort(key=lambda item: (item.claim_id, item.evidence_ref))
    ordered_indexes = tuple(indexes[item] for item in trusted_context.approved_processing_order)
    candidate_digest = _digest("claim-evidence-candidate", candidate.schema_version, candidate)
    aggregate_digest = _digest(
        "producer-packet-aggregate",
        "producer-packet-aggregate.v1",
        {"producer_packet_index": [_plain(item) for item in ordered_indexes]},
    )
    snapshot_digest = _digest(
        "trusted-evidence-context",
        trusted_context.schema_version,
        _context_projection(trusted_context),
    )
    authority_by_ref = {item.evidence_ref: item for item in trusted_context.evidence_authorities}
    evidence_by_ref = {item.evidence_ref: item for item in evidence}
    bindings_by_claim: dict[str, list[_Record]] = {}
    for binding in bindings:
        bindings_by_claim.setdefault(binding.claim_id, []).append(binding)
    claim_results: list[_Record] = []
    uncovered: list[str] = []
    decision_reasons: list[str] = []
    for claim in claims:
        if not _locator_allowed(claim, trusted_context):
            _fail("PUBLIC_PROJECTION_MISMATCH")
        status = "PASS"
        truth: str | None = None
        reasons: list[str] = []
        claim_bindings = bindings_by_claim.get(claim.claim_id, [])
        binding_refs = {item.evidence_ref for item in claim_bindings}
        declared_refs = set(claim.evidence_refs)
        if claim.kind in {"OPINION", "RECOMMENDATION"}:
            truth = "NONFACTUAL"
            reasons = ["NONFACTUAL_CLASSIFIED"]
        elif claim.kind == "INFERENCE":
            status = "BLOCK"
            reasons = ["DERIVATION_NOT_REGISTERED"]
            uncovered.append("INFERENCE_DERIVATION_UNAVAILABLE")
        elif not claim_bindings or binding_refs != declared_refs:
            status = "BLOCK"
            reasons = ["CLAIM_MISSING_BINDING"]
            uncovered.append("FACT_WITHOUT_ADMITTED_BINDING")
        else:
            ceilings: list[str] = []
            for binding in claim_bindings:
                if binding.claim_digest != claim.claim_digest:
                    _fail("DIGEST_MISMATCH")
                projection = evidence_by_ref.get(binding.evidence_ref)
                authority = authority_by_ref.get(binding.evidence_ref)
                if projection is None or authority is None:
                    status = "BLOCK"
                    reasons.append("EVIDENCE_REF_UNKNOWN")
                    continue
                if binding.evidence_projection_digest != projection.projection_digest:
                    _fail("DIGEST_MISMATCH")
                if claim.claim_key != projection.fact_key:
                    _fail("IDENTITY_MISMATCH")
                registered_adapters = {(item[0], item[1]) for item in _REGISTRY}
                registered_comparators = {(item[2], item[3]) for item in _REGISTRY}
                if (projection.adapter_id, projection.adapter_version) not in registered_adapters:
                    _fail("ADAPTER_NOT_REGISTERED")
                if (
                    projection.comparator_id,
                    projection.comparator_version,
                ) not in registered_comparators:
                    _fail("COMPARATOR_NOT_REGISTERED")
                common = (
                    "adapter_id",
                    "adapter_version",
                    "comparator_id",
                    "comparator_version",
                    "source_kind",
                    "source_assertion_class",
                    "source_digest",
                    "fact_key",
                    "subject_key",
                    "category",
                    "fact_value_digest",
                    "as_of",
                    "retrieved_at",
                    "evaluated_at",
                )
                if any(projection[field] != authority[field] for field in common):
                    _fail("IDENTITY_MISMATCH")
                if (
                    projection.tenant_scope != trusted_context.tenant_scope
                    or projection.scope_mode != trusted_context.scope_mode
                    or projection.tenant_id != trusted_context.tenant_id
                    or projection.owner_user_id != trusted_context.owner_user_id
                    or projection.run_id != trusted_context.run_id
                    or projection.decree_id != trusted_context.decree_id
                    or authority.scope_identity.owner_user_id != trusted_context.owner_user_id
                    or authority.scope_identity.run_id != trusted_context.run_id
                    or authority.scope_identity.decree_id != trusted_context.decree_id
                ):
                    _fail("IDENTITY_MISMATCH")
                _validate_freshness(authority, trusted_context.evaluated_at)
                registry_key = _registry_key(projection, authority.freshness_policy_id)
                registry_value = _REGISTRY.get(registry_key)
                if registry_value is None:
                    _fail("COMPARATOR_NOT_REGISTERED")
                if authority.admission_status != "ADMITTED" or authority.conflict_digests:
                    status = "BLOCK"
                    reasons.append("EVIDENCE_CONFLICT")
                    continue
                if projection.comparator_id in {"exact-text.v1", "exact-decimal-unit.v1"}:
                    expected = _fact_value_digest(claim, projection)
                    if expected != projection.fact_value_digest:
                        _fail(
                            "NUMERIC_VALUE_NOT_EXACTLY_BOUND"
                            if projection.comparator_id == "exact-decimal-unit.v1"
                            else "PUBLIC_PROJECTION_MISMATCH"
                        )
                ceilings.append(registry_value[0])
                reasons.append(registry_value[1])
            if status == "PASS" and ceilings:
                ranking = {
                    "USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED": 0,
                    "ARCHIVED_REFERENCE_NOT_REVERIFIED": 1,
                    "SOURCE_REFERENCE_BOUND_NOT_SEMANTICALLY_VERIFIED": 2,
                    "EXACT_VALUE_BOUND": 3,
                }
                truth = min(ceilings, key=ranking.__getitem__)
            elif status == "PASS":
                status = "BLOCK"
                reasons = reasons or ["CLAIM_MISSING_BINDING"]
                uncovered.append("FACT_WITHOUT_ADMITTED_BINDING")
        reasons = [reason for reason in _REASON_ORDER if reason in reasons]
        if status == "BLOCK" and claim.kind == "FACT":
            uncovered.append("FACT_WITHOUT_ADMITTED_BINDING")
        for reason in reasons:
            if reason not in decision_reasons:
                decision_reasons.append(reason)
        claim_results.append(
            _Record(
                {
                    "schema_version": "claim-evidence-claim-result.v1",
                    "claim_id": claim.claim_id,
                    "kind": claim.kind,
                    "claim_digest": claim.claim_digest,
                    "status": status,
                    "binding_digests": [item.binding_digest for item in claim_bindings],
                    "truth_label": truth if status == "PASS" else None,
                    "reason_codes": reasons,
                }
            )
        )
    decision_status = "BLOCK" if any(item.status == "BLOCK" for item in claim_results) else "PASS"
    uncovered_order = ("FACT_WITHOUT_ADMITTED_BINDING", "INFERENCE_DERIVATION_UNAVAILABLE")
    uncovered_tuple = tuple(item for item in uncovered_order if item in uncovered)
    decision = _record_with_digest(
        {
            "schema_version": "claim-evidence-decision.v1",
            "validator_id": "p10a-claim-evidence-gate.v1",
            "validator_version": "1.0.0",
            "aggregate_digest": aggregate_digest,
            "candidate_digest": candidate_digest,
            "evidence_snapshot_digest": snapshot_digest,
            "claim_results": claim_results,
            "coverage_scope": "DECLARED_CLAIMS_ONLY",
            "uncovered_fields": uncovered_tuple,
            "status": decision_status,
            "reason_codes": decision_reasons,
            "external_effect_authorized": False,
            "decision_digest": "",
        },
        "decision_digest",
        "claim-evidence-decision",
    )
    control = _record_with_digest(
        {
            "schema_version": "claim-evidence-control.v1",
            "tenant_scope": trusted_context.tenant_scope,
            "scope_mode": trusted_context.scope_mode,
            "tenant_id": trusted_context.tenant_id,
            "owner_user_id": trusted_context.owner_user_id,
            "job_id": trusted_context.job_id,
            "run_id": trusted_context.run_id,
            "decree_id": trusted_context.decree_id,
            "draft_fingerprint": trusted_context.draft_fingerprint,
            "route_digest": trusted_context.route_digest,
            "execution_started_at": trusted_context.evaluated_at,
            "gate_completed_at": trusted_context.evaluated_at,
            "aggregate_digest": aggregate_digest,
            "candidate_digest": candidate_digest,
            "decision_digest": decision.decision_digest,
            "evidence_snapshot_digest": snapshot_digest,
            "control_ref": "",
            "external_effect_authorized": False,
        },
        "control_ref",
        "claim-evidence-control",
    )
    internal = _record_with_digest(
        {
            "schema_version": "claim-evidence-envelope.v1",
            "producer_packet_index": ordered_indexes,
            "claims": tuple(claims),
            "evidence_projections": tuple(evidence),
            "bindings": tuple(bindings),
            "decision": decision,
            "control": control,
            "envelope_digest": "",
        },
        "envelope_digest",
        "claim-evidence-envelope",
    )
    public_results = tuple(
        _Record(
            {
                "schema_version": "claim-evidence-public-claim-result.v1",
                "public_claim_ref": _digest(
                    "public-claim-ref",
                    "claim-evidence-public-claim-ref.v1",
                    {"claim_digest": item.claim_digest},
                ),
                "kind": item.kind,
                "status": item.status,
                "truth_label": item.truth_label,
                "reason_codes": item.reason_codes,
            }
        )
        for item in claim_results
    )
    public = _record_with_digest(
        {
            "schema_version": "claim-evidence-public-envelope.v1",
            "coverage_scope": "DECLARED_CLAIMS_ONLY",
            "status": decision_status,
            "claim_results": public_results,
            "uncovered_fields": uncovered_tuple,
            "decision_digest": decision.decision_digest,
            "external_effect_authorized": False,
            "public_envelope_digest": "",
        },
        "public_envelope_digest",
        "claim-evidence-public-envelope",
    )
    if len(_canonical(internal)) > 32_768 or len(_canonical(public)) > 32_768:
        _fail("BUDGET_EXCEEDED")
    evaluation_payload = {
        "schema_version": "claim-evidence-evaluation.v1",
        "internal_envelope": internal,
        "public_envelope": public,
    }
    return ClaimEvidenceEvaluationV1(
        schema_version="claim-evidence-evaluation.v1",
        internal_envelope=internal,
        public_envelope=public,
        evaluation_digest=_digest(
            "claim-evidence-evaluation",
            "claim-evidence-evaluation.v1",
            evaluation_payload,
        ),
    )


__all__ = [
    "ClaimEvidenceGateError",
    "TrustedEvidenceContextV1",
    "ClaimEvidenceEvaluationV1",
    "parse_claim_evidence_candidate_v1",
    "evaluate_claim_evidence_v1",
]
