"""Immutable contracts for administrator-approved MCP capabilities."""

from __future__ import annotations

import ipaddress
import json
import math
import re
import unicodedata
from collections.abc import Mapping
from enum import StrEnum
from typing import Any
from urllib.parse import urlsplit

from jsonschema.exceptions import SchemaError
from jsonschema.validators import validator_for
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    ValidationInfo,
    field_serializer,
    field_validator,
    model_validator,
)

from app.jinyiwei.instruments import AShareExchange
from app.jinyiwei.models import (
    DataScope,
    EvidenceQuality,
    FactCategory,
    MarketMetric,
    RequiredFact,
)

_IDENTIFIER = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
_TOOL_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_.:/-]{0,127}$")
_APPROVAL_VERSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_CREDENTIAL_REF = re.compile(r"^env://[A-Z][A-Z0-9_]{0,127}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_FIELD_PATH_TOKEN = re.compile(r"^(?:[A-Za-z][A-Za-z0-9_-]*|0|[1-9][0-9]*)$")
_FORBIDDEN_FIELD_KEYS = frozenset(
    {
        "__class__",
        "__dict__",
        "__globals__",
        "__mro__",
        "__proto__",
        "constructor",
        "prototype",
    }
)
_MAX_FIXED_LIST_INDEX = 10_000_000


def _nonblank(value: str, field_name: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError(f"{field_name}_must_not_be_blank")
    return normalized


class FrozenJsonObject(Mapping[str, Any]):
    """An immutable JSON object backed only by immutable tuples."""

    __slots__ = ("__items",)

    def __init__(self, values: Mapping[str, Any] | None = None) -> None:
        source = {} if values is None else values
        if any(not isinstance(key, str) for key in source):
            raise ValueError("json_object_keys_must_be_strings")
        object.__setattr__(
            self,
            "_FrozenJsonObject__items",
            tuple((key, _freeze_json(value)) for key, value in sorted(source.items())),
        )

    def __getitem__(self, key: str) -> Any:
        for item_key, value in self.__items:
            if item_key == key:
                return value
        raise KeyError(key)

    def __iter__(self) -> Any:
        return (key for key, _value in self.__items)

    def __len__(self) -> int:
        return len(self.__items)

    def __setattr__(self, name: str, value: Any) -> None:
        raise TypeError("frozen_json_object_is_immutable")

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Mapping) and dict(self.items()) == dict(other.items())

    def __reduce__(self) -> tuple[Any, tuple[dict[str, Any]]]:
        return (FrozenJsonObject, (_thaw_json(self),))


def _freeze_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return FrozenJsonObject(value)
    if isinstance(value, list | tuple):
        return tuple(_freeze_json(item) for item in value)
    if value is None or isinstance(value, str | int | float | bool):
        return value
    raise ValueError("discovered_tool_must_be_json")


def _thaw_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw_json(item) for item in value]
    if isinstance(value, list):
        return [_thaw_json(item) for item in value]
    return value


class _FrozenModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class McpTransport(StrEnum):
    STREAMABLE_HTTP = "STREAMABLE_HTTP"


class ToolEffect(StrEnum):
    READ_ONLY = "READ_ONLY"


class McpSourceKind(StrEnum):
    INTERNAL_SYSTEM = "INTERNAL_SYSTEM"
    PROFESSIONAL_DATA = "PROFESSIONAL_DATA"
    PUBLIC_INFORMATION = "PUBLIC_INFORMATION"


class McpAccessPolicy(StrEnum):
    ANONYMOUS_PUBLIC = "ANONYMOUS_PUBLIC"
    SERVICE_AUTHENTICATED_FREE = "SERVICE_AUTHENTICATED_FREE"
    INTERNAL_SERVICE_AUTHENTICATED = "INTERNAL_SERVICE_AUTHENTICATED"


class DelimitedSeriesSelection(StrEnum):
    LAST = "LAST"


class DelimitedSeriesTimeOrder(StrEnum):
    STRICT_ASCENDING = "STRICT_ASCENDING"


class DelimitedSeriesDelimiter(StrEnum):
    ASCII_SPACE = "ASCII_SPACE"


class DelimitedSeriesDateFormat(StrEnum):
    BASIC_ISO_DATE = "BASIC_ISO_DATE"


class DelimitedSeriesTimeFormat(StrEnum):
    HHMM_24H = "HHMM_24H"


class DelimitedSeriesValueFormat(StrEnum):
    FINITE_DECIMAL = "FINITE_DECIMAL"


class McpServerConfig(_FrozenModel):
    server_id: StrictStr
    display_name: StrictStr
    endpoint_url: StrictStr
    transport: McpTransport
    source_kind: McpSourceKind
    access_policy: McpAccessPolicy
    credential_ref: StrictStr | None = None
    enabled: StrictBool = False
    approval_version: StrictStr
    timeout_seconds: StrictInt = Field(ge=1, le=120)
    max_response_bytes: StrictInt = Field(ge=1, le=10_000_000)
    rate_limit_per_minute: StrictInt = Field(ge=1, le=10_000)
    allow_redirects: StrictBool = False
    cache_ttl_seconds: StrictInt = Field(ge=0, le=86_400)
    private_network_approved: StrictBool = False
    private_network_cidrs: tuple[StrictStr, ...] = ()
    oauth_allowed_origins: tuple[StrictStr, ...] = ()

    @field_validator("server_id")
    @classmethod
    def _valid_server_id(cls, value: str) -> str:
        if not _IDENTIFIER.fullmatch(value):
            raise ValueError("invalid_server_id")
        return value

    @field_validator("display_name")
    @classmethod
    def _valid_display_name(cls, value: str) -> str:
        return _nonblank(value, "display_name")

    @field_validator("approval_version")
    @classmethod
    def _valid_approval_version(cls, value: str) -> str:
        if not _APPROVAL_VERSION.fullmatch(value):
            raise ValueError("invalid_approval_version")
        return value

    @field_validator("credential_ref")
    @classmethod
    def _valid_credential_ref(cls, value: str | None) -> str | None:
        if value is not None and not _CREDENTIAL_REF.fullmatch(value):
            raise ValueError("invalid_credential_ref")
        return value

    @field_validator("endpoint_url")
    @classmethod
    def _fixed_https_endpoint(cls, value: str) -> str:
        if any(character.isspace() for character in value):
            raise ValueError("invalid_endpoint_url")
        parsed = urlsplit(value)
        if parsed.scheme != "https":
            raise ValueError("endpoint_must_use_https")
        if (
            not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("invalid_endpoint_url")
        return value

    @field_validator("private_network_cidrs")
    @classmethod
    def _valid_private_network_cidrs(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        if len(values) != len(set(values)):
            raise ValueError("duplicate_private_network_cidr")
        approved_spaces = (
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"),
            ipaddress.ip_network("fc00::/7"),
        )
        for value in values:
            try:
                network = ipaddress.ip_network(value, strict=True)
            except ValueError:
                raise ValueError("invalid_private_network_cidr") from None
            if not any(
                network.version == parent.version and network.subnet_of(parent)
                for parent in approved_spaces
            ):
                raise ValueError("invalid_private_network_cidr")
        return values

    @field_validator("oauth_allowed_origins")
    @classmethod
    def _valid_oauth_origins(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        if len(values) != len(set(values)):
            raise ValueError("duplicate_oauth_origin")
        for value in values:
            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
                or _is_ip_literal(parsed.hostname)
            ):
                raise ValueError("invalid_oauth_origin")
        return values

    @model_validator(mode="after")
    def _validate_security_boundary(self) -> McpServerConfig:
        if self.access_policy is McpAccessPolicy.ANONYMOUS_PUBLIC:
            if self.credential_ref is not None:
                raise ValueError("anonymous_source_must_not_have_credential_ref")
        elif self.credential_ref is None:
            raise ValueError("authenticated_source_requires_credential_ref")

        if (
            self.access_policy is McpAccessPolicy.INTERNAL_SERVICE_AUTHENTICATED
            and self.source_kind is not McpSourceKind.INTERNAL_SYSTEM
        ):
            raise ValueError("internal_access_requires_internal_source")
        if self.private_network_approved and (
            self.source_kind is not McpSourceKind.INTERNAL_SYSTEM
            or self.access_policy is not McpAccessPolicy.INTERNAL_SERVICE_AUTHENTICATED
        ):
            raise ValueError("private_target_not_approved")
        if bool(self.private_network_cidrs) != self.private_network_approved:
            raise ValueError("private_network_cidrs_must_match_approval")

        hostname = urlsplit(self.endpoint_url).hostname
        assert hostname is not None
        target_is_non_public = hostname.lower() == "localhost" or hostname.lower().endswith(
            ".local"
        )
        try:
            target_is_non_public = (
                target_is_non_public or not ipaddress.ip_address(hostname).is_global
            )
        except ValueError:
            pass
        if target_is_non_public and not self.private_network_approved:
            raise ValueError("private_target_not_approved")
        return self

    def fingerprint_payload(self) -> dict[str, Any]:
        """Return approval-bound fields, excluding the operator enable switch."""

        payload = self.model_dump(mode="json")
        payload.pop("enabled", None)
        if not payload["private_network_cidrs"]:
            payload.pop("private_network_cidrs")
        return payload


def _is_ip_literal(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True


class DiscoveredTool(_FrozenModel):
    model_config = ConfigDict(
        extra="forbid", frozen=True, populate_by_name=True, serialize_by_alias=True
    )

    name: StrictStr
    description: StrictStr | None = None
    input_schema: Mapping[str, Any] = Field(alias="inputSchema")
    extensions: Mapping[str, Any] = Field(
        default_factory=FrozenJsonObject,
        exclude=True,
        repr=False,
    )

    @model_validator(mode="before")
    @classmethod
    def _separate_protocol_extensions(cls, value: Any) -> Any:
        if isinstance(value, cls) or not isinstance(value, Mapping):
            return value
        raw = dict(value)
        if "inputSchema" in raw and "input_schema" in raw:
            raise ValueError("duplicate_input_schema")
        normalized: dict[str, Any] = {}
        for field_name in ("name", "description"):
            if field_name in raw:
                normalized[field_name] = raw.pop(field_name)
        if "inputSchema" in raw:
            normalized["inputSchema"] = raw.pop("inputSchema")
        elif "input_schema" in raw:
            normalized["inputSchema"] = raw.pop("input_schema")
        normalized["extensions"] = raw
        return normalized

    @field_validator("name")
    @classmethod
    def _valid_name(cls, value: str) -> str:
        if not _TOOL_NAME.fullmatch(value):
            raise ValueError("invalid_tool_name")
        return value

    @field_validator("description")
    @classmethod
    def _valid_description(cls, value: str | None) -> str | None:
        return None if value is None else _nonblank(value, "description")

    @field_validator("input_schema")
    @classmethod
    def _immutable_schema(cls, value: Mapping[str, Any]) -> Mapping[str, Any]:
        schema = _thaw_json(value)
        try:
            validator_for(schema).check_schema(schema)
        except SchemaError as exc:
            raise ValueError("invalid_input_schema") from exc
        frozen = _freeze_json(schema)
        if not isinstance(frozen, Mapping):
            raise ValueError("input_schema_must_be_object")
        return frozen

    @field_validator("extensions")
    @classmethod
    def _immutable_extensions(cls, value: Mapping[str, Any]) -> Mapping[str, Any]:
        frozen = _freeze_json(value)
        if not isinstance(frozen, Mapping):
            raise ValueError("extensions_must_be_object")
        return frozen

    @field_serializer("input_schema")
    def _serialize_schema(self, value: Mapping[str, Any]) -> dict[str, Any]:
        return _thaw_json(value)

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """Serialize protocol extensions back to ordinary, stable JSON values."""

        if args:
            raise TypeError("model_dump accepts keyword arguments only")
        extras = self.extensions
        caller_include = kwargs.get("include")
        caller_exclude = kwargs.get("exclude")
        use_alias = kwargs.get("by_alias") is not False
        exclude_none = bool(kwargs.get("exclude_none"))
        exclude_unset = bool(kwargs.get("exclude_unset"))

        values: tuple[tuple[str, str, Any], ...] = (
            ("name", "name", self.name),
            ("description", "description", self.description),
            (
                "input_schema",
                "inputSchema" if use_alias else "input_schema",
                self.input_schema,
            ),
            *((key, key, value) for key, value in extras.items()),
        )
        payload: dict[str, Any] = {}
        for field_name, output_name, value in values:
            included = caller_include is None or field_name in caller_include
            excluded = caller_exclude is not None and field_name in caller_exclude
            if exclude_unset and field_name not in self.model_fields_set:
                included = False
            if exclude_none and value is None:
                included = False
            if included and not excluded:
                payload[output_name] = _thaw_json(value)
        return payload

    def model_dump_json(self, *args: Any, **kwargs: Any) -> str:
        """Serialize the original MCP protocol shape, including extensions."""

        if args:
            raise TypeError("model_dump_json accepts keyword arguments only")
        options = dict(kwargs)
        indent = options.pop("indent", None)
        ensure_ascii = bool(options.pop("ensure_ascii", False))
        payload = self.model_dump(**options)
        separators = None if indent is not None else (",", ":")
        return json.dumps(
            payload,
            allow_nan=False,
            ensure_ascii=ensure_ascii,
            indent=indent,
            separators=separators,
        )

    def model_copy(
        self,
        *,
        update: Mapping[str, Any] | None = None,
        deep: bool = False,
    ) -> DiscoveredTool:
        """Return an immutable validated replacement; a no-op copy shares safely."""

        del deep
        if not update:
            return self
        payload = self.model_dump(mode="json", by_alias=True)
        normalized_update = dict(update)
        if "extensions" in normalized_update:
            replacement_extensions = normalized_update.pop("extensions")
            if not isinstance(replacement_extensions, Mapping):
                raise ValueError("extensions_must_be_object")
            if {"name", "description", "inputSchema", "input_schema"} & set(replacement_extensions):
                raise ValueError("extension_name_is_reserved")
            for extension_name in self.extensions:
                payload.pop(extension_name, None)
            payload.update(replacement_extensions)
        if "input_schema" in normalized_update:
            if "inputSchema" in normalized_update:
                raise ValueError("duplicate_input_schema")
            normalized_update["inputSchema"] = normalized_update.pop("input_schema")
        payload.update(normalized_update)
        return type(self).model_validate(payload)

    def __copy__(self) -> DiscoveredTool:
        return self

    def __deepcopy__(self, memo: dict[int, Any] | None = None) -> DiscoveredTool:
        del memo
        return self

    def __setattr__(self, name: str, value: Any) -> None:
        if name == "__pydantic_extra__":
            raise TypeError("discovered_tool_extra_is_internal")
        super().__setattr__(name, value)

    def __reduce__(self) -> tuple[Any, tuple[dict[str, Any]]]:
        return (
            _restore_discovered_tool,
            (self.model_dump(mode="json", by_alias=True),),
        )

    def __reduce_ex__(self, protocol: int) -> tuple[Any, tuple[dict[str, Any]]]:
        del protocol
        return self.__reduce__()


def _restore_discovered_tool(payload: dict[str, Any]) -> DiscoveredTool:
    return DiscoveredTool.model_validate(payload)


class McpEntityResolver(_FrozenModel):
    """Configuration-only entity lookup used before a data tool call."""

    tool_name: StrictStr
    argument_paths: Mapping[StrictStr, StrictStr]
    success_path: StrictStr | None = None
    candidates_path: StrictStr
    candidate_subject_path: StrictStr
    candidate_name_path: StrictStr
    candidate_type_path: StrictStr
    candidate_jurisdiction_path: StrictStr | None = None
    candidate_market_path: StrictStr | None = None
    required_type: StrictStr | None = None
    required_types_by_market: Mapping[StrictStr, tuple[StrictStr, ...]] = Field(
        default_factory=dict
    )
    target_argument: StrictStr
    markets_by_jurisdiction: Mapping[StrictStr, StrictStr]
    units_by_market: Mapping[StrictStr, StrictStr]
    jurisdiction_subject_patterns: Mapping[StrictStr, StrictStr] = Field(
        default_factory=dict
    )
    exchange_subject_patterns: Mapping[AShareExchange, StrictStr]
    subject_pattern: StrictStr
    subject_max_length: StrictInt = Field(ge=1, le=256)

    @field_validator("tool_name")
    @classmethod
    def _valid_tool_name(cls, value: str) -> str:
        if not _TOOL_NAME.fullmatch(value):
            raise ValueError("invalid_tool_name")
        return value

    @field_validator(
        "candidates_path",
        "success_path",
        "candidate_subject_path",
        "candidate_name_path",
        "candidate_type_path",
        "candidate_jurisdiction_path",
        "candidate_market_path",
    )
    @classmethod
    def _valid_result_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_field_path(value)

    @field_validator("required_type", "target_argument")
    @classmethod
    def _nonblank_literal(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        if value is None:
            return None
        normalized = _nonblank(value, info.field_name)
        if info.field_name == "target_argument" and not _IDENTIFIER.fullmatch(normalized):
            raise ValueError("invalid_target_argument")
        return normalized

    @field_validator("subject_pattern")
    @classmethod
    def _valid_subject_pattern(cls, value: str) -> str:
        if not value or len(value) > 256:
            raise ValueError("invalid_subject_pattern")
        try:
            re.compile(value)
        except re.error:
            raise ValueError("invalid_subject_pattern") from None
        return value

    @field_validator("argument_paths")
    @classmethod
    def _valid_argument_paths(cls, value: Mapping[str, str]) -> Mapping[str, str]:
        normalized: dict[str, str] = {}
        for key, path in value.items():
            if not isinstance(key, str) or not _IDENTIFIER.fullmatch(key):
                raise ValueError("invalid_argument_paths_key")
            normalized[key] = _validate_field_path(path)
        return FrozenJsonObject(normalized)

    @field_validator("markets_by_jurisdiction")
    @classmethod
    def _valid_market_map(cls, value: Mapping[str, str]) -> Mapping[str, str]:
        normalized: dict[str, str] = {}
        for jurisdiction, market in value.items():
            code = jurisdiction.upper()
            if not re.fullmatch(r"[A-Z]{2}", code):
                raise ValueError("invalid_resolution_jurisdiction")
            if code in normalized:
                raise ValueError("duplicate_resolution_jurisdiction")
            normalized[code] = _nonblank(market, "market")
        if not normalized:
            raise ValueError("markets_by_jurisdiction_must_not_be_empty")
        return FrozenJsonObject(normalized)

    @field_validator("units_by_market")
    @classmethod
    def _valid_unit_map(cls, value: Mapping[str, str]) -> Mapping[str, str]:
        normalized: dict[str, str] = {}
        for market, unit in value.items():
            market_name = _nonblank(market, "market")
            if market_name in normalized:
                raise ValueError("duplicate_resolution_market")
            normalized[market_name] = _nonblank(unit, "unit")
        if not normalized:
            raise ValueError("units_by_market_must_not_be_empty")
        return FrozenJsonObject(normalized)

    @field_validator("jurisdiction_subject_patterns")
    @classmethod
    def _valid_jurisdiction_subject_patterns(
        cls, value: Mapping[str, str]
    ) -> Mapping[str, str]:
        normalized: dict[str, str] = {}
        for jurisdiction, pattern in value.items():
            code = jurisdiction.upper()
            if not re.fullmatch(r"[A-Z]{2}", code) or not pattern or len(pattern) > 256:
                raise ValueError("invalid_resolution_jurisdiction_pattern")
            try:
                re.compile(pattern)
            except re.error:
                raise ValueError("invalid_resolution_jurisdiction_pattern") from None
            if code in normalized:
                raise ValueError("duplicate_resolution_jurisdiction_pattern")
            normalized[code] = pattern
        return FrozenJsonObject(normalized)

    @field_validator("exchange_subject_patterns", mode="before")
    @classmethod
    def _valid_exchange_subject_patterns(
        cls, value: Any
    ) -> Mapping[AShareExchange, str]:
        if not isinstance(value, Mapping):
            raise ValueError("invalid_exchange_subject_patterns")
        normalized: dict[AShareExchange, str] = {}
        for exchange, pattern in value.items():
            try:
                exchange_id = AShareExchange(str(exchange).upper())
            except ValueError:
                raise ValueError("invalid_exchange_subject_patterns") from None
            if exchange_id in normalized:
                raise ValueError("duplicate_exchange_subject_pattern")
            if not isinstance(pattern, str) or not pattern or len(pattern) > 256:
                raise ValueError("invalid_exchange_subject_patterns")
            try:
                re.compile(pattern)
            except re.error:
                raise ValueError("invalid_exchange_subject_patterns") from None
            normalized[exchange_id] = pattern
        if not normalized:
            raise ValueError("exchange_subject_patterns_must_not_be_empty")
        return normalized

    @field_validator("exchange_subject_patterns")
    @classmethod
    def _freeze_exchange_subject_patterns(
        cls, value: Mapping[AShareExchange, str]
    ) -> Mapping[AShareExchange, str]:
        return FrozenJsonObject(value)

    @field_validator("required_types_by_market")
    @classmethod
    def _valid_required_types(
        cls, value: Mapping[str, tuple[str, ...]]
    ) -> Mapping[str, tuple[str, ...]]:
        normalized: dict[str, tuple[str, ...]] = {}
        for market, values in value.items():
            market_name = _nonblank(market, "market")
            types = tuple(_nonblank(item, "required_type") for item in values)
            if not types or len(types) != len(set(types)):
                raise ValueError("invalid_required_types_by_market")
            normalized[market_name] = types
        return FrozenJsonObject(normalized)

    @model_validator(mode="after")
    def _every_market_has_exactly_one_unit(self) -> McpEntityResolver:
        if set(self.units_by_market) != set(self.markets_by_jurisdiction.values()):
            raise ValueError("resolution_market_unit_mismatch")
        explicit_market_fields = (
            self.candidate_jurisdiction_path is not None
            and self.candidate_market_path is not None
        )
        if (self.candidate_jurisdiction_path is None) != (
            self.candidate_market_path is None
        ):
            raise ValueError("resolution_market_paths_must_match")
        derived_market = bool(self.jurisdiction_subject_patterns)
        if explicit_market_fields == derived_market:
            raise ValueError("resolution_market_source_must_be_unique")
        markets = set(self.units_by_market)
        if derived_market and set(self.jurisdiction_subject_patterns) != set(
            self.markets_by_jurisdiction
        ):
            raise ValueError("resolution_jurisdiction_pattern_mismatch")
        configured_types = bool(self.required_types_by_market)
        if (self.required_type is not None) == configured_types:
            raise ValueError("resolution_required_type_source_must_be_unique")
        if configured_types and set(self.required_types_by_market) != markets:
            raise ValueError("resolution_required_type_market_mismatch")
        return self

    @field_serializer(
        "argument_paths",
        "markets_by_jurisdiction",
        "units_by_market",
        "jurisdiction_subject_patterns",
        "exchange_subject_patterns",
        "required_types_by_market",
    )
    def _serialize_mappings(self, value: Mapping[str, Any]) -> dict[str, Any]:
        return {
            key.value if isinstance(key, StrEnum) else key: (
                list(item) if isinstance(item, tuple) else item
            )
            for key, item in value.items()
        }


class McpDelimitedSeriesMapping(_FrozenModel):
    """Fixed parsing contract for an ordered series of delimited text rows."""

    rows_path: StrictStr
    selection: DelimitedSeriesSelection
    time_order: DelimitedSeriesTimeOrder
    delimiter: DelimitedSeriesDelimiter
    exact_token_count: StrictInt = Field(ge=2, le=64)
    time_token_index: StrictInt = Field(ge=0, le=63)
    time_format: DelimitedSeriesTimeFormat
    date_path: StrictStr
    date_format: DelimitedSeriesDateFormat
    utc_offset: StrictStr
    value_token_index: StrictInt = Field(ge=0, le=63)
    value_format: DelimitedSeriesValueFormat

    @field_validator("rows_path", "date_path")
    @classmethod
    def _valid_paths(cls, value: str) -> str:
        return _validate_field_path(value)

    @field_validator("utc_offset")
    @classmethod
    def _valid_utc_offset(cls, value: str) -> str:
        return _validate_utc_offset(value)

    @model_validator(mode="after")
    def _valid_indices(self) -> McpDelimitedSeriesMapping:
        if (
            self.time_token_index >= self.exact_token_count
            or self.value_token_index >= self.exact_token_count
            or self.time_token_index == self.value_token_index
        ):
            raise ValueError("invalid_delimited_series_indices")
        return self


class McpToolMapping(_FrozenModel):
    """Administrator-owned literal paths for one approved tool.

    Paths are deliberately much smaller than JSONPath: each dot-separated token is
    either an object key or a fixed non-negative list index.  There are no filters,
    wildcards, expressions, recursive descent, or executable hooks.
    """

    argument_paths: Mapping[StrictStr, StrictStr]
    success_path: StrictStr | None = None
    value_path: StrictStr | None = None
    as_of_path: StrictStr | None = None
    publisher_path: StrictStr | None = None
    publisher_literal: StrictStr | None = None
    source_url_path: StrictStr | None = None
    source_url_literal: StrictStr | None = None
    quality_ceiling: EvidenceQuality
    unit_path: StrictStr | None = None
    unit_from_resolved_market: StrictBool = False
    published_at_path: StrictStr | None = None
    subject_path: StrictStr | None = None
    subject_from_record_key: StrictBool = False
    metadata_paths: Mapping[StrictStr, StrictStr] = Field(default_factory=dict)
    entity_resolution: McpEntityResolver | None = None
    record_by_subject_path: StrictStr | None = None
    as_of_date_utc_offset: StrictStr | None = None
    delimited_series: McpDelimitedSeriesMapping | None = None
    value_exclusive_min: StrictFloat | StrictInt | None = None
    publisher_allowlist: tuple[StrictStr, ...] = ()
    unit_allowlist: tuple[StrictStr, ...] = ()
    source_url_origins: tuple[StrictStr, ...] = ()
    source_url_path_pattern: StrictStr | None = None

    @field_validator(
        "value_path",
        "success_path",
        "as_of_path",
        "publisher_path",
        "source_url_path",
        "unit_path",
        "published_at_path",
        "subject_path",
        "record_by_subject_path",
    )
    @classmethod
    def _valid_field_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_field_path(value)

    @field_validator("argument_paths", "metadata_paths")
    @classmethod
    def _valid_path_mapping(
        cls, value: Mapping[str, str], info: ValidationInfo
    ) -> Mapping[str, str]:
        normalized: dict[str, str] = {}
        for key, path in value.items():
            if not isinstance(key, str) or not _IDENTIFIER.fullmatch(key):
                raise ValueError(f"invalid_{info.field_name}_key")
            normalized[key] = _validate_field_path(path)
        return FrozenJsonObject(normalized)

    @field_serializer("argument_paths", "metadata_paths")
    def _serialize_paths(self, value: Mapping[str, str]) -> dict[str, str]:
        return dict(value)

    @field_validator("value_exclusive_min")
    @classmethod
    def _finite_minimum(cls, value: float | int | None) -> float | int | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("invalid_value_exclusive_min")
        return value

    @field_validator("publisher_literal")
    @classmethod
    def _valid_publisher_literal(cls, value: str | None) -> str | None:
        return None if value is None else _nonblank(value, "publisher_literal")

    @field_validator("source_url_literal")
    @classmethod
    def _valid_source_url_literal(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or any(character.isspace() for character in value)
        ):
            raise ValueError("invalid_source_url_literal")
        return value

    @field_validator("as_of_date_utc_offset")
    @classmethod
    def _valid_as_of_date_utc_offset(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_utc_offset(value)

    @field_validator("publisher_allowlist", "unit_allowlist")
    @classmethod
    def _valid_literal_allowlist(
        cls, value: tuple[str, ...], info: ValidationInfo
    ) -> tuple[str, ...]:
        normalized = tuple(_nonblank(item, info.field_name) for item in value)
        if len(normalized) != len(set(normalized)):
            raise ValueError(f"duplicate_{info.field_name}")
        return normalized

    @field_validator("source_url_origins")
    @classmethod
    def _valid_source_origins(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized: list[str] = []
        for origin in value:
            parsed = urlsplit(origin)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("invalid_source_url_origin")
            canonical = f"https://{parsed.netloc}"
            if canonical in normalized:
                raise ValueError("duplicate_source_url_origin")
            normalized.append(canonical)
        return tuple(normalized)

    @field_validator("source_url_path_pattern")
    @classmethod
    def _valid_source_path_pattern(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value or len(value) > 256:
            raise ValueError("invalid_source_url_path_pattern")
        try:
            re.compile(value)
        except re.error:
            raise ValueError("invalid_source_url_path_pattern") from None
        return value

    @model_validator(mode="after")
    def _validate_mapping_sources(self) -> McpToolMapping:
        if (self.publisher_path is None) == (self.publisher_literal is None):
            raise ValueError("publisher_source_must_be_unique")
        if (self.source_url_path is None) == (self.source_url_literal is None):
            raise ValueError("source_url_source_must_be_unique")
        if self.unit_path is not None and self.unit_from_resolved_market:
            raise ValueError("unit_source_must_be_unique")
        path_mapping = self.value_path is not None and self.as_of_path is not None
        partial_path_mapping = (self.value_path is None) != (self.as_of_path is None)
        if partial_path_mapping or path_mapping == (self.delimited_series is not None):
            raise ValueError("mapping_value_source_must_be_unique")
        if self.as_of_date_utc_offset is not None and not path_mapping:
            raise ValueError("as_of_date_utc_offset_requires_path")
        if (self.subject_path is not None) == self.subject_from_record_key:
            raise ValueError("subject_source_must_be_unique")
        if self.subject_from_record_key and self.record_by_subject_path is None:
            raise ValueError("subject_record_key_requires_record_mapping")
        return self


def _validate_field_path(value: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError("invalid_mapping_path")
    tokens = value.split(".")
    if any(
        not _FIELD_PATH_TOKEN.fullmatch(token)
        or unicodedata.normalize("NFKC", token).casefold() in _FORBIDDEN_FIELD_KEYS
        or (token.isdigit() and not _fixed_index_in_range(token))
        for token in tokens
    ):
        raise ValueError("invalid_mapping_path")
    return value


def _validate_utc_offset(value: str) -> str:
    match = re.fullmatch(r"([+-])([0-9]{2}):([0-9]{2})", value)
    if match is None:
        raise ValueError("invalid_utc_offset")
    hours, minutes = int(match.group(2)), int(match.group(3))
    if hours > 14 or minutes > 59 or (hours == 14 and minutes != 0):
        raise ValueError("invalid_utc_offset")
    return value


def _fixed_index_in_range(token: str) -> bool:
    maximum = str(_MAX_FIXED_LIST_INDEX)
    return len(token) < len(maximum) or (
        len(token) == len(maximum) and token <= maximum
    )


class McpToolApproval(_FrozenModel):
    server_id: StrictStr
    tool_name: StrictStr
    enabled: StrictBool = False
    effect: ToolEffect
    fact_categories: tuple[FactCategory, ...] = Field(min_length=1)
    market_metrics: tuple[MarketMetric, ...] = ()
    data_scopes: tuple[DataScope, ...] = Field(min_length=1)
    jurisdictions: tuple[StrictStr, ...] = Field(min_length=1)
    approval_version: StrictStr
    approved_discovered_tool: Mapping[str, Any]
    approved_fingerprint: StrictStr
    mapping: McpToolMapping | None = None
    resolver_only: StrictBool = False
    priority: StrictInt = Field(default=100, ge=0, le=10_000)

    @field_validator("effect", mode="before")
    @classmethod
    def _read_only_effect(cls, value: Any) -> Any:
        if value != ToolEffect.READ_ONLY and value != ToolEffect.READ_ONLY.value:
            raise ValueError("tool_effect_not_read_only")
        return value

    @field_validator("server_id")
    @classmethod
    def _valid_server_id(cls, value: str) -> str:
        if not _IDENTIFIER.fullmatch(value):
            raise ValueError("invalid_server_id")
        return value

    @field_validator("tool_name")
    @classmethod
    def _valid_tool_name(cls, value: str) -> str:
        if not _TOOL_NAME.fullmatch(value):
            raise ValueError("invalid_tool_name")
        return value

    @field_validator("approval_version")
    @classmethod
    def _valid_approval_version(cls, value: str) -> str:
        if not _APPROVAL_VERSION.fullmatch(value):
            raise ValueError("invalid_approval_version")
        return value

    @field_validator("fact_categories", "market_metrics", "data_scopes")
    @classmethod
    def _unique_capabilities(cls, value: tuple[Any, ...], info: ValidationInfo) -> tuple[Any, ...]:
        if len(value) != len(set(value)):
            raise ValueError(f"duplicate_{info.field_name}")
        return value

    @field_validator("jurisdictions")
    @classmethod
    def _valid_jurisdictions(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(item.upper() for item in value)
        if any(not re.fullmatch(r"(?:\*|[A-Z]{2})", item) for item in normalized):
            raise ValueError("invalid_jurisdiction_capability")
        if len(normalized) != len(set(normalized)):
            raise ValueError("duplicate_jurisdictions")
        return normalized

    @field_validator("approved_discovered_tool")
    @classmethod
    def _immutable_discovered_tool(cls, value: Mapping[str, Any]) -> Mapping[str, Any]:
        discovered = DiscoveredTool.model_validate(value)
        frozen = _freeze_json(discovered.model_dump(mode="json", by_alias=True))
        assert isinstance(frozen, Mapping)
        return frozen

    @field_serializer("approved_discovered_tool")
    def _serialize_discovered_tool(self, value: Mapping[str, Any]) -> dict[str, Any]:
        return _thaw_json(value)

    @field_validator("approved_fingerprint")
    @classmethod
    def _valid_fingerprint(cls, value: str) -> str:
        if not _SHA256.fullmatch(value):
            raise ValueError("invalid_approved_fingerprint")
        return value

    @model_validator(mode="after")
    def _tool_identity_matches_discovery(self) -> McpToolApproval:
        if self.approved_discovered_tool.get("name") != self.tool_name:
            raise ValueError("approved_tool_name_mismatch")
        if FactCategory.MARKET_QUOTE in self.fact_categories:
            if not self.market_metrics:
                raise ValueError("market_quote_requires_market_metrics")
        elif self.market_metrics:
            raise ValueError("market_metrics_require_market_quote")
        return self

    def matches_fact(self, fact: RequiredFact) -> bool:
        jurisdiction_matches = "*" in self.jurisdictions or (
            fact.jurisdiction is not None and fact.jurisdiction in self.jurisdictions
        )
        if (
            not jurisdiction_matches
            and fact.jurisdiction is None
            and self.mapping is not None
            and self.mapping.entity_resolution is not None
        ):
            jurisdiction_matches = bool(
                set(self.jurisdictions)
                & set(self.mapping.entity_resolution.markets_by_jurisdiction)
            )
        return (
            not self.resolver_only
            and fact.category in self.fact_categories
            and (
                fact.category is not FactCategory.MARKET_QUOTE
                or fact.market_metric in self.market_metrics
            )
            and fact.data_scope in self.data_scopes
            and jurisdiction_matches
        )

    def accepts_discovered_tool(self, discovered_tool: DiscoveredTool | Mapping[str, Any]) -> bool:
        try:
            discovered = (
                discovered_tool
                if isinstance(discovered_tool, DiscoveredTool)
                else DiscoveredTool.model_validate(discovered_tool)
            )
        except ValueError:
            return False
        return discovered.model_dump(mode="json", by_alias=True) == _thaw_json(
            self.approved_discovered_tool
        )
