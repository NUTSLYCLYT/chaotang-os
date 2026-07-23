"""Deterministic normalization of approved MCP JSON results."""

from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

from app.jinyiwei.mcp.client import McpToolResult
from app.jinyiwei.mcp.contracts import McpDelimitedSeriesMapping, McpToolApproval
from app.jinyiwei.models import RequiredFact, SourceType
from app.jinyiwei.sources.base import SourceDocument

_BIDI_CONTROL_CHARACTERS = frozenset(
    {
        "\u061c",
        "\u200e",
        "\u200f",
        "\u202a",
        "\u202b",
        "\u202c",
        "\u202d",
        "\u202e",
        "\u2066",
        "\u2067",
        "\u2068",
        "\u2069",
    }
)
_PROTOTYPE_LIKE_KEYS = frozenset({"__proto__", "constructor", "prototype"})


class McpMappingError(ValueError):
    """Stable fail-closed mapping error without remote response content."""


@dataclass(frozen=True, slots=True)
class ResolvedEntity:
    subject: str
    unit: str


class DeterministicMcpMapper:
    """Apply only the immutable literal paths on an administrator approval."""

    def arguments_for(
        self,
        tool: McpToolApproval,
        fact: RequiredFact,
        *,
        resolved_subject: str | None = None,
    ) -> dict[str, object]:
        mapping = tool.mapping
        if mapping is None:
            raise McpMappingError("mapping_not_approved")
        fact_payload = fact.model_dump(mode="json")
        arguments = {
            name: _extract(fact_payload, path)
            for name, path in mapping.argument_paths.items()
        }
        resolution = mapping.entity_resolution
        if resolution is not None:
            if resolved_subject is None:
                raise McpMappingError("entity_resolution_required")
            arguments[resolution.target_argument] = resolved_subject
        return arguments

    def resolution_arguments_for(
        self, tool: McpToolApproval, fact: RequiredFact
    ) -> dict[str, object]:
        mapping = tool.mapping
        if mapping is None or mapping.entity_resolution is None:
            raise McpMappingError("entity_resolution_not_approved")
        fact_payload = fact.model_dump(mode="json")
        return {
            name: _extract(fact_payload, path)
            for name, path in mapping.entity_resolution.argument_paths.items()
        }

    def resolve_subject(
        self,
        tool: McpToolApproval,
        fact: RequiredFact,
        result: McpToolResult,
    ) -> ResolvedEntity:
        mapping = tool.mapping
        resolution = None if mapping is None else mapping.entity_resolution
        if resolution is None:
            raise McpMappingError("entity_resolution_not_approved")
        if (
            result.server_id != tool.server_id
            or result.tool_name != resolution.tool_name
        ):
            raise McpMappingError("unexpected_tool_result")
        if (
            resolution.success_path is not None
            and _extract(result.payload, resolution.success_path) is not True
        ):
            raise McpMappingError("remote_result_unsuccessful")
        candidates = _extract(result.payload, resolution.candidates_path)
        if isinstance(candidates, str | bytes | bytearray) or not isinstance(
            candidates, Sequence
        ):
            raise McpMappingError("mapped_field_missing")
        expected_market = (
            None
            if fact.jurisdiction is None
            else resolution.markets_by_jurisdiction.get(fact.jurisdiction)
        )
        matches: list[ResolvedEntity] = []
        for candidate in candidates:
            try:
                name = _string(_extract(candidate, resolution.candidate_name_path))
                security_type = _string(
                    _extract(candidate, resolution.candidate_type_path)
                )
                subject = _string(
                    _extract(candidate, resolution.candidate_subject_path)
                )
            except McpMappingError:
                continue
            if resolution.candidate_jurisdiction_path is not None:
                assert resolution.candidate_market_path is not None
                try:
                    jurisdiction = _string(
                        _extract(
                            candidate,
                            resolution.candidate_jurisdiction_path,
                        )
                    ).upper()
                    market = _string(
                        _extract(candidate, resolution.candidate_market_path)
                    )
                except McpMappingError:
                    continue
            else:
                inferred = [
                    jurisdiction
                    for jurisdiction, pattern in (
                        resolution.jurisdiction_subject_patterns.items()
                    )
                    if re.fullmatch(pattern, subject) is not None
                ]
                if len(inferred) != 1:
                    continue
                jurisdiction = inferred[0]
                market = resolution.markets_by_jurisdiction[jurisdiction]
            if any(
                _contains_unsafe_raw_control(value)
                for value in (
                    name,
                    security_type,
                    jurisdiction,
                    market,
                    subject,
                )
            ):
                continue
            if (
                len(subject) > resolution.subject_max_length
                or any(_is_disallowed_character(character) for character in subject)
                or re.fullmatch(resolution.subject_pattern, subject) is None
            ):
                continue
            allowed_market = resolution.markets_by_jurisdiction.get(jurisdiction)
            approved_unit = (
                None
                if allowed_market is None
                else resolution.units_by_market.get(allowed_market)
            )
            allowed_types = (
                (resolution.required_type,)
                if resolution.required_type is not None
                else resolution.required_types_by_market.get(market, ())
            )
            if (
                _normalized_identity(name) == _normalized_identity(fact.subject)
                and any(
                    security_type.casefold() == item.casefold()
                    for item in allowed_types
                )
                and allowed_market == market
                and (
                    fact.jurisdiction is None
                    or (
                        jurisdiction == fact.jurisdiction
                        and expected_market == market
                    )
                )
            ):
                assert approved_unit is not None
                matches.append(ResolvedEntity(subject=subject, unit=approved_unit))
        if len(matches) > 1:
            raise McpMappingError("fact_conflicted")
        if not matches:
            raise McpMappingError("entity_not_resolved")
        return matches[0]

    def map(
        self,
        tool: McpToolApproval,
        fact: RequiredFact,
        result: McpToolResult,
        retrieved_at: datetime,
        *,
        resolved_subject: str | None = None,
        approved_unit: str | None = None,
    ) -> SourceDocument:
        if result.server_id != tool.server_id or result.tool_name != tool.tool_name:
            raise McpMappingError("unexpected_tool_result")
        mapping = tool.mapping
        if mapping is None:
            raise McpMappingError("mapping_not_approved")
        expected_subject = resolved_subject or fact.subject
        try:
            if (
                mapping.success_path is not None
                and _extract(result.payload, mapping.success_path) is not True
            ):
                raise McpMappingError("remote_result_unsuccessful")
            mapped_root: object = result.payload
            if mapping.record_by_subject_path is not None:
                records = _extract(result.payload, mapping.record_by_subject_path)
                if (
                    not isinstance(records, Mapping)
                    or expected_subject not in records
                    or not isinstance(records[expected_subject], Mapping)
                ):
                    raise McpMappingError("mapped_field_missing")
                mapped_root = records[expected_subject]
            series_metadata: dict[str, object] = {}
            if mapping.delimited_series is not None:
                value, as_of, series_metadata = _map_delimited_series(
                    mapped_root, mapping.delimited_series
                )
                raw_as_of = None
            else:
                assert mapping.value_path is not None
                assert mapping.as_of_path is not None
                value = _extract(mapped_root, mapping.value_path)
                raw_as_of = _extract(mapped_root, mapping.as_of_path)
                as_of = (
                    _date_at_local_start(
                        raw_as_of,
                        mapping.as_of_date_utc_offset,
                    )
                    if mapping.as_of_date_utc_offset is not None
                    else _timestamp(raw_as_of)
                )
            publisher = _clean_text(
                _string(
                    mapping.publisher_literal
                    if mapping.publisher_literal is not None
                    else _extract(mapped_root, mapping.publisher_path)
                )
            )
            source_url = _https_url(
                (
                    mapping.source_url_literal
                    if mapping.source_url_literal is not None
                    else _extract(mapped_root, mapping.source_url_path)
                ),
                origins=mapping.source_url_origins,
                path_pattern=mapping.source_url_path_pattern,
            )
            subject = (
                expected_subject
                if mapping.subject_from_record_key
                else _clean_json_string(
                    _string(_extract(mapped_root, mapping.subject_path))
                )
            )
            unit = (
                approved_unit
                if mapping.unit_from_resolved_market
                else (
                    None
                    if mapping.unit_path is None
                    else _clean_json_string(
                        _string(_extract(mapped_root, mapping.unit_path))
                    )
                )
            )
            published_at = (
                None
                if mapping.published_at_path is None
                else _timestamp(_extract(mapped_root, mapping.published_at_path))
            )
            metadata = {
                name: sanitize_mcp_json_value(_extract(mapped_root, path))
                for name, path in mapping.metadata_paths.items()
            }
            if mapping.as_of_date_utc_offset is not None:
                metadata.update(
                    {
                        "source_as_of_date": raw_as_of,
                        "as_of_precision": "date",
                    }
                )
            metadata.update(series_metadata)
        except McpMappingError:
            raise
        except (KeyError, IndexError, TypeError, ValueError):
            raise McpMappingError("mapped_field_missing") from None

        if subject != expected_subject:
            raise McpMappingError("mapped_subject_mismatch")
        if mapping.publisher_allowlist and publisher not in mapping.publisher_allowlist:
            raise McpMappingError("mapped_publisher_mismatch")
        if mapping.unit_allowlist and unit not in mapping.unit_allowlist:
            raise McpMappingError("mapped_unit_mismatch")
        if approved_unit is not None and unit != approved_unit:
            raise McpMappingError("mapped_unit_mismatch")
        if fact.expected_unit is not None and unit != fact.expected_unit:
            raise McpMappingError("mapped_unit_mismatch")
        _validate_expected_shape(value, fact.expected_shape)
        if (
            mapping.value_exclusive_min is not None
            and (
                type(value) not in {int, float}
                or not math.isfinite(value)
                or value <= mapping.value_exclusive_min
            )
        ):
            raise McpMappingError("mapped_value_out_of_range")
        if _parse_timestamp(as_of) > _aware_utc(retrieved_at):
            raise McpMappingError("mapped_timestamp_in_future")
        normalized_value = sanitize_mcp_json_value(value)
        retrieved = _format_time(retrieved_at)
        metadata.update(
            {
                "fact_key": fact.key,
                "value": normalized_value,
                "unit": unit,
                "subject": fact.subject,
                "resolved_subject": subject,
                "mcp_server_id": tool.server_id,
                "mcp_tool_name": tool.tool_name,
                "approval_version": tool.approval_version,
                "response_hash": _response_hash(result.payload),
            }
        )
        safe_value = json.dumps(
            normalized_value,
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return SourceDocument(
            source_type=SourceType.MCP,
            source_name=f"mcp:{tool.server_id}:{tool.tool_name}",
            source_url=source_url,
            publisher=publisher,
            title=_clean_text(fact.description),
            retrieved_at=retrieved,
            as_of=as_of,
            published_at=published_at,
            text=_clean_text(f"{fact.description}: {safe_value}"),
            quality_ceiling=mapping.quality_ceiling,
            metadata=metadata,
        )


def _extract(root: object, path: str) -> object:
    current = root
    for token in path.split("."):
        if token.isdecimal():
            if isinstance(current, str | bytes | bytearray) or not isinstance(
                current, Sequence
            ):
                raise McpMappingError("mapped_field_missing")
            index = int(token)
            if index >= len(current):
                raise McpMappingError("mapped_field_missing")
            current = current[index]
        else:
            if not isinstance(current, Mapping) or token not in current:
                raise McpMappingError("mapped_field_missing")
            current = current[token]
    return current


def _timestamp(value: object) -> str:
    if not isinstance(value, str):
        raise McpMappingError("invalid_mapped_timestamp")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError:
        raise McpMappingError("invalid_mapped_timestamp") from None
    if parsed.utcoffset() is None:
        raise McpMappingError("invalid_mapped_timestamp")
    return parsed.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _date_at_local_start(
    value: object,
    utc_offset: str,
) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is None:
        raise McpMappingError("invalid_mapped_date")
    try:
        source_date = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise McpMappingError("invalid_mapped_date") from None
    sign = 1 if utc_offset[0] == "+" else -1
    offset = timezone(
        sign
        * timedelta(
            hours=int(utc_offset[1:3]),
            minutes=int(utc_offset[4:6]),
        )
    )
    return _format_time(source_date.replace(tzinfo=offset))


def _map_delimited_series(
    mapped_root: object,
    config: McpDelimitedSeriesMapping,
) -> tuple[float, str, dict[str, object]]:
    rows = _extract(mapped_root, config.rows_path)
    if isinstance(rows, str | bytes | bytearray) or not isinstance(rows, Sequence):
        raise McpMappingError("mapped_field_missing")
    if not rows:
        raise McpMappingError("mapped_field_missing")
    source_date = _string(_extract(mapped_root, config.date_path))
    if re.fullmatch(r"[0-9]{8}", source_date) is None:
        raise McpMappingError("invalid_mapped_date")
    try:
        parsed_date = datetime.strptime(source_date, "%Y%m%d")
    except ValueError:
        raise McpMappingError("invalid_mapped_date") from None

    previous_minutes = -1
    latest_time = ""
    latest_value = 0.0
    decimal_pattern = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?")
    for row in rows:
        if (
            not isinstance(row, str)
            or _contains_unsafe_raw_control(row)
            or row != row.strip(" ")
            or "\t" in row
        ):
            raise McpMappingError("invalid_delimited_series")
        tokens = row.split(" ")
        if (
            len(tokens) != config.exact_token_count
            or any(not token for token in tokens)
        ):
            raise McpMappingError("invalid_delimited_series")
        raw_time = tokens[config.time_token_index]
        raw_value = tokens[config.value_token_index]
        if re.fullmatch(r"[0-9]{4}", raw_time) is None:
            raise McpMappingError("invalid_mapped_timestamp")
        try:
            parsed_time = datetime.strptime(raw_time, "%H%M")
        except ValueError:
            raise McpMappingError("invalid_mapped_timestamp") from None
        minutes = parsed_time.hour * 60 + parsed_time.minute
        if minutes <= previous_minutes:
            raise McpMappingError("invalid_delimited_series_order")
        previous_minutes = minutes
        if decimal_pattern.fullmatch(raw_value) is None:
            raise McpMappingError("invalid_mapped_value")
        try:
            numeric_value = float(raw_value)
        except ValueError:
            raise McpMappingError("invalid_mapped_value") from None
        if not math.isfinite(numeric_value):
            raise McpMappingError("invalid_mapped_value")
        latest_time = raw_time
        latest_value = numeric_value

    combined = parsed_date.replace(
        hour=previous_minutes // 60,
        minute=previous_minutes % 60,
        tzinfo=_fixed_offset(config.utc_offset),
    )
    return (
        latest_value,
        _format_time(combined),
        {
            "source_as_of_date": source_date,
            "source_as_of_time": latest_time,
            "as_of_precision": "minute",
        },
    )


def _fixed_offset(value: str) -> timezone:
    sign = 1 if value[0] == "+" else -1
    return timezone(
        sign
        * timedelta(
            hours=int(value[1:3]),
            minutes=int(value[4:6]),
        )
    )


def _format_time(value: datetime) -> str:
    if value.utcoffset() is None:
        raise McpMappingError("invalid_retrieval_timestamp")
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _string(value: object) -> str:
    if not isinstance(value, str) or not " ".join(value.split()):
        raise McpMappingError("invalid_mapped_text")
    return value


def _https_url(
    value: object,
    *,
    origins: tuple[str, ...] = (),
    path_pattern: str | None = None,
) -> str:
    text = _string(value)
    parsed = urlsplit(text)
    if (
        any(_is_disallowed_character(character) for character in text)
        or parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or any(character.isspace() for character in text)
    ):
        raise McpMappingError("invalid_mapped_source_url")
    origin = f"https://{parsed.netloc}"
    if origins and origin not in origins:
        raise McpMappingError("mapped_source_origin_mismatch")
    if path_pattern is not None and re.fullmatch(path_pattern, parsed.path) is None:
        raise McpMappingError("mapped_source_path_mismatch")
    return text


def _normalized_identity(value: str) -> str:
    return unicodedata.normalize("NFKC", _clean_text(value)).casefold()


def _contains_unsafe_raw_control(value: str) -> bool:
    return any(
        unicodedata.category(character) in {"Cc", "Cf"}
        or _is_disallowed_character(character)
        for character in value
    )


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)


def _aware_utc(value: datetime) -> datetime:
    if value.utcoffset() is None:
        raise McpMappingError("invalid_retrieval_timestamp")
    return value.astimezone(UTC)


def _clean_text(value: str) -> str:
    cleaned = "".join(
        character
        for character in value
        if unicodedata.category(character) not in {"Cc", "Cf"}
    )
    normalized = " ".join(cleaned.split())
    if not normalized:
        raise McpMappingError("invalid_mapped_text")
    return normalized


def _is_disallowed_character(character: str) -> bool:
    codepoint = ord(character)
    return (
        codepoint <= 0x1F
        or 0x7F <= codepoint <= 0x9F
        or character in _BIDI_CONTROL_CHARACTERS
    )


def _clean_json_string(value: str) -> str:
    return "".join(
        character
        for character in value
        if not _is_disallowed_character(character)
    )


def _valid_json_key(key: object) -> bool:
    return (
        type(key) is str
        and not any(_is_disallowed_character(character) for character in key)
        and unicodedata.normalize("NFKC", key).casefold() not in _PROTOTYPE_LIKE_KEYS
    )


def sanitize_mcp_json_value(value: object) -> object:
    if value is None or type(value) is bool:
        return value
    if type(value) is str:
        return _clean_json_string(value)
    if type(value) is int:
        if not -(2**63) <= value <= 2**63 - 1:
            raise McpMappingError("invalid_mapped_value")
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise McpMappingError("invalid_mapped_value")
        return value
    if isinstance(value, Mapping):
        if any(not _valid_json_key(key) for key in value):
            raise McpMappingError("invalid_mapped_value")
        return {key: sanitize_mcp_json_value(item) for key, item in value.items()}
    if isinstance(value, tuple | list):
        return [sanitize_mcp_json_value(item) for item in value]
    raise McpMappingError("invalid_mapped_value")


def _validate_expected_shape(value: object, expected: str | None) -> None:
    if expected is None:
        return
    checks = {
        "number": lambda item: type(item) in {int, float} and not isinstance(item, bool),
        "string": lambda item: isinstance(item, str),
        "boolean": lambda item: type(item) is bool,
        "object": lambda item: isinstance(item, Mapping),
        "array": lambda item: isinstance(item, tuple | list),
    }
    check = checks.get(expected.casefold())
    if check is None or not check(value):
        raise McpMappingError("mapped_value_shape_mismatch")


def _response_hash(payload: Mapping[str, Any]) -> str:
    normalized = _raw_json_value(payload)
    encoded = json.dumps(
        normalized,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _raw_json_value(value: object) -> object:
    if value is None or type(value) in {bool, str}:
        return value
    if type(value) is int:
        if not -(2**63) <= value <= 2**63 - 1:
            raise McpMappingError("invalid_mapped_value")
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise McpMappingError("invalid_mapped_value")
        return value
    if isinstance(value, Mapping):
        if any(not _valid_json_key(key) for key in value):
            raise McpMappingError("invalid_mapped_value")
        return {key: _raw_json_value(item) for key, item in value.items()}
    if isinstance(value, tuple | list):
        return [_raw_json_value(item) for item in value]
    raise McpMappingError("invalid_mapped_value")


__all__ = [
    "DeterministicMcpMapper",
    "McpMappingError",
    "sanitize_mcp_json_value",
]
