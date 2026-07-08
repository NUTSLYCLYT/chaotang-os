"""FastAPI 依赖注入 — 认证、租户上下文、run_id 校验。

替代 src/auth_middleware.py 的 Flask before_request 钩子。

核心理念:
- 框架无关：token 解析 + 租户上下文设置由 Depends 完成，不依赖 flask.g
- 与现有 src/tenant.py 复用：verify_token / set_current_tenant 不动
- 白名单与 FENGQUN_AUTH 开关行为完全兼容旧逻辑
"""
from __future__ import annotations

import os
import re

from fastapi import Cookie, Depends, Header, HTTPException, Request, status

from src.tenant import DEFAULT_TENANT_SLUG, set_current_tenant, verify_token

from web.schemas.auth import CurrentUser

# ── 配置 ────────────────────────────────────────────────

AUTH_ENABLED = os.environ.get("FENGQUN_AUTH", "true").lower() in (
    "true", "1", "yes",
)

# 与旧 auth_middleware.AUTH_WHITELIST 完全一致
_AUTH_WHITELIST_PREFIXES = (
    "/api/auth/",
    "/api/health",
)
_STATIC_SUFFIXES = (".html", ".css", ".js", ".ico")


def _is_whitelisted(path: str) -> bool:
    if path == "/" or path.endswith(_STATIC_SUFFIXES):
        return True
    return any(path.startswith(p) for p in _AUTH_WHITELIST_PREFIXES)


# ── 依赖：当前用户 ────────────────────────────────────────

def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    token_cookie: str | None = Cookie(default=None, alias="token"),
) -> CurrentUser:
    """提取 Bearer 或 Cookie token，校验 JWT，注入租户上下文。

    白名单路径 / FENGQUN_AUTH=false 时返回默认租户的匿名用户。
    """
    path = request.url.path

    # 白名单 / 静态资源直接放行
    if _is_whitelisted(path):
        set_current_tenant(DEFAULT_TENANT_SLUG)
        return CurrentUser(tenant_slug=DEFAULT_TENANT_SLUG)

    if not AUTH_ENABLED:
        set_current_tenant(DEFAULT_TENANT_SLUG)
        return CurrentUser(tenant_slug=DEFAULT_TENANT_SLUG)

    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        token = token_cookie

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录，请先认证",
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
        )

    tenant_slug = payload.get("tenant_slug", DEFAULT_TENANT_SLUG)
    set_current_tenant(tenant_slug)

    user = CurrentUser(
        user_id=payload.get("user_id"),
        username=payload.get("username"),
        role=payload.get("role"),
        tenant_slug=tenant_slug,
    )
    # 同时挂到 request.state，方便流式端点等读取
    request.state.user = user
    return user


def try_get_current_user(
    authorization: str | None = Header(default=None),
    token_cookie: str | None = Cookie(default=None, alias="token"),
) -> CurrentUser | None:
    """尝试解析 token；缺失或无效都返回 None，永远不抛异常。

    用于 /api/auth/me 这类"查询当前登录态"端点 —— 老 Flask 实现因白名单
    导致永远返回 false，这里规范化为：有效 token 就识别用户。
    """
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        token = token_cookie
    if not token:
        return None

    payload = verify_token(token)
    if not payload:
        return None

    tenant_slug = payload.get("tenant_slug", DEFAULT_TENANT_SLUG)
    set_current_tenant(tenant_slug)
    return CurrentUser(
        user_id=payload.get("user_id"),
        username=payload.get("username"),
        role=payload.get("role"),
        tenant_slug=tenant_slug,
    )


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """需要 admin 角色才能通过。"""
    if AUTH_ENABLED and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return user


# ── 依赖：run_id 校验 ─────────────────────────────────────

_RUN_ID_RE = re.compile(r"^[A-Za-z0-9_]{1,80}$")


def validate_run_id(run_id: str) -> str:
    """路径参数 run_id 校验：防路径穿越 + 限制字符集。

    与旧 web/app.py:_validate_run_id 行为完全一致。
    """
    if (
        not run_id
        or "/" in run_id
        or "\\" in run_id
        or ".." in run_id
        or not _RUN_ID_RE.match(run_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"非法 run_id: {run_id!r}",
        )
    return run_id
