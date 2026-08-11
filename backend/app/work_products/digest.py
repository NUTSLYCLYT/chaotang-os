"""Deterministic semantic digests for work-product payloads."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from decimal import MAX_EMAX, MIN_ETINY, Decimal
from enum import Enum
from pathlib import PurePosixPath, PureWindowsPath

_NON_SEMANTIC_KEYS = frozenset(
    {
        "work_product_id",
        "run_id",
        "reply_id",
        "created_at",
        "updated_at",
        "checked_at",
        "file_path",
    }
)
_CONFIRMATION_RECEIPT_KEY = "confirmation_receipt"
_DECIMAL_WIRE_KEY = "$work_product_decimal"


def _is_absolute_path(value: str) -> bool:
    return PurePosixPath(value).is_absolute() or PureWindowsPath(value).is_absolute()


def _decimal_parts(value: Decimal) -> tuple[int, str, int]:
    decimal_tuple = value.as_tuple()
    digits = list(decimal_tuple.digits)
    exponent = int(decimal_tuple.exponent)
    if not digits or all(digit == 0 for digit in digits):
        return (0, "0", 0)
    while digits[-1] == 0:
        digits.pop()
        exponent += 1
    return (decimal_tuple.sign, "".join(str(digit) for digit in digits), exponent)


def _decimal_to_wire(value: Decimal) -> dict[str, object]:
    sign, digits, exponent = _decimal_parts(value)
    return {_DECIMAL_WIRE_KEY: [sign, digits, exponent]}


def _decimal_from_wire(value: Mapping[str, object]) -> Decimal | None:
    if _DECIMAL_WIRE_KEY not in value:
        return None
    if set(value) != {_DECIMAL_WIRE_KEY}:
        raise ValueError("Decimal wire mapping cannot contain mixed keys")
    parts = value[_DECIMAL_WIRE_KEY]
    if not isinstance(parts, list) or len(parts) != 3:
        raise ValueError("Decimal wire value must be a three-item list")
    sign, digits, exponent = parts
    if type(sign) is not int or sign not in (0, 1):
        raise ValueError("Decimal wire sign must be 0 or 1")
    if not isinstance(digits, str) or not digits or not digits.isascii() or not digits.isdigit():
        raise ValueError("Decimal wire digits must be a non-empty ASCII digit string")
    if type(exponent) is not int:
        raise ValueError("Decimal wire exponent must be an integer")
    if exponent < MIN_ETINY or exponent > MAX_EMAX:
        raise ValueError("Decimal wire exponent is outside the supported runtime range")
    decoded = Decimal((sign, tuple(int(digit) for digit in digits), exponent))
    if _decimal_to_wire(decoded) != dict(value):
        raise ValueError("Decimal wire value must use canonical form")
    return decoded


def _decode_semantic_wire(value: object) -> object:
    if isinstance(value, Mapping):
        decimal_value = _decimal_from_wire(value)
        if decimal_value is not None:
            return decimal_value
        return {key: _decode_semantic_wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return tuple(_decode_semantic_wire(item) for item in value)
    return value


def _encode_semantic_wire(value: object) -> object:
    if isinstance(value, Enum):
        return _encode_semantic_wire(value.value)
    if isinstance(value, Decimal):
        return _decimal_to_wire(value)
    if isinstance(value, Mapping):
        return {key: _encode_semantic_wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return tuple(_encode_semantic_wire(item) for item in value)
    return value


def _validate_semantic_value(value: object) -> None:
    if isinstance(value, Enum):
        if not (
            value.value is None
            or isinstance(value.value, (bool, int, str, Decimal))
        ):
            raise TypeError("unsupported semantic value type: non-scalar Enum value")
        _validate_semantic_value(value.value)
        return
    if value is None or isinstance(value, (bool, int, str)):
        return
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("semantic value Decimal must be finite")
        return
    if isinstance(value, Mapping):
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("semantic value mapping keys must be strings")
            _validate_semantic_value(item)
        return
    if isinstance(value, (list, tuple)):
        for item in value:
            _validate_semantic_value(item)
        return
    raise TypeError(f"unsupported semantic value type: {type(value).__name__}")


def _canonicalize(value: object, *, path: tuple[str, ...] = ()) -> object:
    if isinstance(value, Enum):
        return _canonicalize(value.value)
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, Decimal):
        _validate_semantic_value(value)
        sign, digits, exponent = _decimal_parts(value)
        return {"$decimal": [sign, digits, exponent]}
    if isinstance(value, Mapping):
        decimal_value = _decimal_from_wire(value)
        if decimal_value is not None:
            return _canonicalize(decimal_value)
        for key in value:
            if not isinstance(key, str):
                raise TypeError("semantic digest mapping keys must be strings")
        canonical: list[list[object]] = []
        for key in sorted(value):
            item = value[key]
            if key == "file_path":
                if not isinstance(item, str):
                    raise TypeError("file_path must be a string")
                if _is_absolute_path(item):
                    raise ValueError("semantic digest rejects absolute file_path values")
            if (
                key in _NON_SEMANTIC_KEYS
                or key == _CONFIRMATION_RECEIPT_KEY
                or (not path and key == "content_digest")
                or (path == ("artifact_manifest",) and key == "ref")
            ):
                continue
            canonical.append([key, _canonicalize(item, path=(*path, key))])
        return {"$mapping": canonical}
    if isinstance(value, (list, tuple)):
        return [_canonicalize(item, path=path) for item in value]
    raise TypeError(f"unsupported semantic value type: {type(value).__name__}")


def semantic_digest(payload: Mapping[str, object]) -> str:
    """Return the SHA-256 digest of the payload's canonical semantic content."""

    canonical = _canonicalize(payload)
    encoded = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
