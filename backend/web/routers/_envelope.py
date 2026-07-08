"""统一信封 helper:ok()/fail()。

全局唯一定义,web/routers/ 各模块从此 import,不重复定义。
"""
from __future__ import annotations

import re
from typing import Any

# 控制字符(除 \t \n \r 外)在 JSON 中必须转义,否则会导致客户端解析失败。
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_str(s: str) -> str:
    """移除 JSON 不安全的控制字符,保留 \\t \\n \\r。"""
    if not isinstance(s, str):
        return s
    return _CTRL_RE.sub("", s)


def sanitize_data(obj: Any) -> Any:
    """递归清理 dict/list/str 中的 JSON 不安全控制字符。"""
    if isinstance(obj, dict):
        return {k: sanitize_data(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_data(v) for v in obj]
    if isinstance(obj, str):
        return sanitize_str(obj)
    return obj


def ok(data: Any) -> dict:
    return {"success": True, "data": sanitize_data(data), "error": None}


def fail(msg: str, extra: Any | None = None) -> dict:
    return {"success": False, "data": sanitize_data(extra), "error": sanitize_str(msg)}
