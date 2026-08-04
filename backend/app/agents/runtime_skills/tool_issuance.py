from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from collections.abc import Mapping
from enum import Enum
from typing import Any

from pydantic import BaseModel

from app.agents.runtime_skills.tool_models import (
    ApprovedToolCall,
    BureauToolPolicy,
    ToolDescriptor,
)

_AUDIT_ISSUANCE_SEAL = object()
_AUDIT_ISSUANCE_KEY = secrets.token_bytes(32)


def _canonical_json_value(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return _canonical_json_value(value.model_dump(mode="python"))
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Mapping):
        return {
            str(_canonical_json_value(key)): _canonical_json_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (set, frozenset)):
        normalized = (_canonical_json_value(item) for item in value)
        return sorted(
            normalized,
            key=lambda item: json.dumps(
                item, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            ),
        )
    if isinstance(value, (list, tuple)):
        return [_canonical_json_value(item) for item in value]
    return value


def _canonical_model_fingerprint(model: BaseModel) -> str:
    payload = json.dumps(
        _canonical_json_value(model),
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _tool_descriptor_fingerprint(descriptor: ToolDescriptor) -> str:
    return _canonical_model_fingerprint(descriptor)


def _bureau_tool_policy_fingerprint(policy: BureauToolPolicy) -> str:
    return _canonical_model_fingerprint(policy)


def _approved_call_signature(call: ApprovedToolCall) -> str:
    payload = json.dumps(
        call.model_dump(mode="json"),
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    message = f"{id(call)}\x1f{payload}".encode()
    return hmac.new(_AUDIT_ISSUANCE_KEY, message, hashlib.sha256).hexdigest()


def _issue_approved_tool_call(call: ApprovedToolCall) -> ApprovedToolCall:
    if type(call) is not ApprovedToolCall:
        raise TypeError("approved_tool_call_type_invalid")
    object.__setattr__(
        call,
        "_audit_issuance",
        (_AUDIT_ISSUANCE_SEAL, _approved_call_signature(call)),
    )
    return call


def _approved_call_is_issued(call: object) -> bool:
    if type(call) is not ApprovedToolCall:
        return False
    issuance = getattr(call, "_audit_issuance", None)
    return bool(
        isinstance(issuance, tuple)
        and len(issuance) == 2
        and issuance[0] is _AUDIT_ISSUANCE_SEAL
        and isinstance(issuance[1], str)
        and hmac.compare_digest(issuance[1], _approved_call_signature(call))
    )
