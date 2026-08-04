from __future__ import annotations

import hashlib
import hmac
import secrets
from threading import RLock

_AUDIT_REF_SECRET = secrets.token_bytes(32)
_AUDIT_REF_LOCK = RLock()
_AUDIT_REF_COUNTER = 0
_AUDIT_REF_COUNTER_MAX = (1 << 128) - 1


def _mint_tool_audit_ref(context: bytes = b"") -> str:
    """Mint an opaque process-unique reference using constant auxiliary memory."""

    global _AUDIT_REF_COUNTER
    with _AUDIT_REF_LOCK:
        if _AUDIT_REF_COUNTER >= _AUDIT_REF_COUNTER_MAX:
            raise OverflowError("audit_ref_counter_exhausted")
        _AUDIT_REF_COUNTER += 1
        counter = _AUDIT_REF_COUNTER
    message = counter.to_bytes(16, "big") + hashlib.sha256(context).digest()
    token = hmac.new(_AUDIT_REF_SECRET, message, hashlib.sha256).hexdigest()[:32]
    return f"tool-audit:{token}"
