"""REQ-019：短时下载票据——发放不等于永久授权，兑换时重新校验。

对象替换防线：票据绑定的是发放时刻的 `digest_sha256`；兑换时重新计算磁盘上的摘要做比对，
对不上就拒绝——不能靠"发票据那一刻检查过一次"就永远信任后续读到的字节。
"""

from __future__ import annotations

import hashlib
import secrets

from src.secure_ingest.limits import DOWNLOAD_TICKET_TTL_SECONDS

__all__ = ["DOWNLOAD_TICKET_TTL_SECONDS", "hash_token", "issue_raw_token"]


def issue_raw_token() -> str:
    """生成一次性明文 token——调用方只在发放响应里回给客户端一次，绝不落库。"""
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    """只有这个哈希值持久化；明文永不落库，防数据库泄漏后票据被冒用。"""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
