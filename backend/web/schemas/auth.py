"""认证相关 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)


class UserBrief(BaseModel):
    id: int
    username: str
    display_name: str = ""
    role: str = "user"


class TenantBrief(BaseModel):
    id: int
    name: str
    slug: str


class LoginResponse(BaseModel):
    token: str
    user: UserBrief
    tenant: TenantBrief
    post_login_redirect: str = "/?start=1"
    landing_mode: str = "start_panel"


class CurrentUser(BaseModel):
    """从 JWT 解出的当前用户上下文（注入到下游路由）。"""
    user_id: int | None = None
    username: str | None = None
    role: str | None = None
    tenant_slug: str = "default"


class AuthMeResponse(BaseModel):
    authenticated: bool
    user: CurrentUser | None = None


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=32)
    email: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=6, max_length=256)


class RegisterResponse(BaseModel):
    message: str
    username: str
    user_id: int
