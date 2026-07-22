"""摘要计算——immutable input version 的基础。"""

from __future__ import annotations

import hashlib


def compute_sha256(raw_bytes: bytes) -> str:
    return hashlib.sha256(raw_bytes).hexdigest()
