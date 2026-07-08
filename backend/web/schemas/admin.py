"""管理员接口 schema。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TenantCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="租户显示名")
    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_\-]+$",
                      description="租户 slug，仅小写字母数字下划线连字符")


class TenantInfo(BaseModel):
    id: int
    name: str
    slug: str
    created_at: str


class TenantCreatedResponse(BaseModel):
    status: str = "created"
    tenant_id: int


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=6, max_length=256)
    tenant_id: int
    role: str = "user"
    display_name: str = ""


class UserInfo(BaseModel):
    id: int
    username: str
    display_name: str = ""
    role: str
    tenant_name: str


class UserCreatedResponse(BaseModel):
    status: str = "created"
    user_id: int


# ── 部门管理（前端 admin/jiqun-depts）────────────────────────────────────────

class DeptInfo(BaseModel):
    id: int
    name: str
    created_at: str | None = None


class DeptRef(BaseModel):
    """用户↔部门列表里的部门精简引用。"""
    id: int
    name: str


class DeptNameRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="部门名")


class DeptFlowsRequest(BaseModel):
    flow_ids: list[str] = Field(default_factory=list, description="挂载的 flow stem 列表")


class UserDeptsRequest(BaseModel):
    dept_ids: list[int] = Field(default_factory=list, description="授权的部门 id 列表")
