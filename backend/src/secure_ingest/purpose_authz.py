"""REQ-019：purpose 授权链——tenant/user/purpose 任一缺失或不匹配一律拒绝。

绿地新建：仓库里没有既有的 purpose-based 授权概念可复用。纯函数、只吃标量参数（不吃
`CurrentUser` 对象），保持跟 web 层解耦、独立可测。

内部运营/平台人员默认不可读合同正文（W03 packet card 硬性要求）：仓库目前只有 `admin` 一个
提升角色，本模块把它当作"内部运营/平台人员"的具体落地——`role == "admin"` 默认拒绝，R0
阶段零破玻璃例外（已获 Product Owner 批准，见 owner_approval 记录）。
"""

from __future__ import annotations

from typing import Literal, NamedTuple

ALLOWED_PURPOSES = frozenset({"contract_review", "mission_execution"})

AuthzDenyReason = Literal[
    "MISSING_PURPOSE",
    "UNKNOWN_PURPOSE",
    "CROSS_TENANT",
    "ANONYMOUS_USER",
    "INTERNAL_OPS_DEFAULT_DENY",
]


class AuthzResult(NamedTuple):
    allowed: bool
    deny_reason: AuthzDenyReason | None


def authorize_body_access(
    *,
    user_id: int | None,
    role: str | None,
    requester_tenant_id: int | None,
    artifact_tenant_id: int,
    purpose: str | None,
) -> AuthzResult:
    """fail-closed 授权链，顺序即优先级：purpose → 身份 → 租户 → 角色。"""
    if not purpose:
        return AuthzResult(False, "MISSING_PURPOSE")
    if purpose not in ALLOWED_PURPOSES:
        return AuthzResult(False, "UNKNOWN_PURPOSE")
    if user_id is None:
        return AuthzResult(False, "ANONYMOUS_USER")
    if requester_tenant_id is None or requester_tenant_id != artifact_tenant_id:
        return AuthzResult(False, "CROSS_TENANT")
    if role == "admin":
        return AuthzResult(False, "INTERNAL_OPS_DEFAULT_DENY")
    return AuthzResult(True, None)
