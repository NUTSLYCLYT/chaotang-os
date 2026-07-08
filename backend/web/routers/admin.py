"""管理员端点 — 租户/用户 CRUD + 可编辑部门管理。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from src import dept_admin_store
from src.tenant import (
    create_tenant,
    create_user,
    list_tenants,
    list_users,
)

from web.deps import require_admin
from web.schemas.admin import (
    DeptFlowsRequest,
    DeptInfo,
    DeptNameRequest,
    DeptRef,
    TenantCreateRequest,
    TenantCreatedResponse,
    TenantInfo,
    UserCreatedResponse,
    UserCreateRequest,
    UserDeptsRequest,
    UserInfo,
)
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/tenants", response_model=list[TenantInfo])
def api_list_tenants(_: CurrentUser = Depends(require_admin)) -> list[TenantInfo]:
    return [TenantInfo(**t) for t in list_tenants()]


@router.post(
    "/tenants",
    response_model=TenantCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def api_create_tenant(
    body: TenantCreateRequest,
    _: CurrentUser = Depends(require_admin),
) -> TenantCreatedResponse:
    try:
        tid = create_tenant(body.name.strip(), body.slug.strip())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    return TenantCreatedResponse(tenant_id=tid)


@router.get("/users", response_model=list[UserInfo])
def api_list_users(_: CurrentUser = Depends(require_admin)) -> list[UserInfo]:
    return [UserInfo(**u) for u in list_users()]


@router.post(
    "/users",
    response_model=UserCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def api_create_user(
    body: UserCreateRequest,
    _: CurrentUser = Depends(require_admin),
) -> UserCreatedResponse:
    try:
        uid = create_user(
            body.username.strip(),
            body.password,
            body.tenant_id,
            body.role,
            body.display_name,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    return UserCreatedResponse(user_id=uid)


# ── 可编辑部门管理（前端 admin/jiqun-depts，经 /api/jiqun 代理）────────────────

@router.get("/depts", response_model=list[DeptInfo])
def api_list_depts(_: CurrentUser = Depends(require_admin)) -> list[DeptInfo]:
    return [DeptInfo(**d) for d in dept_admin_store.list_departments()]


@router.post("/depts", response_model=DeptInfo, status_code=status.HTTP_201_CREATED)
def api_create_dept(
    body: DeptNameRequest,
    _: CurrentUser = Depends(require_admin),
) -> DeptInfo:
    try:
        return DeptInfo(**dept_admin_store.create_department(body.name))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.put("/depts/{dept_id}", response_model=DeptInfo)
def api_rename_dept(
    dept_id: int,
    body: DeptNameRequest,
    _: CurrentUser = Depends(require_admin),
) -> DeptInfo:
    try:
        updated = dept_admin_store.rename_department(dept_id, body.name)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"部门不存在: {dept_id}")
    return DeptInfo(**updated)


@router.delete("/depts/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_dept(
    dept_id: int,
    _: CurrentUser = Depends(require_admin),
) -> Response:
    if not dept_admin_store.delete_department(dept_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"部门不存在: {dept_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/depts/{dept_id}/flows", response_model=list[str])
def api_get_dept_flows(
    dept_id: int,
    _: CurrentUser = Depends(require_admin),
) -> list[str]:
    return dept_admin_store.get_department_flows(dept_id)


@router.put("/depts/{dept_id}/flows", response_model=list[str])
def api_set_dept_flows(
    dept_id: int,
    body: DeptFlowsRequest,
    _: CurrentUser = Depends(require_admin),
) -> list[str]:
    try:
        return dept_admin_store.set_department_flows(dept_id, body.flow_ids)
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.get("/flows", response_model=list[str])
def api_list_available_flows(_: CurrentUser = Depends(require_admin)) -> list[str]:
    return dept_admin_store.list_available_flows()


@router.get("/users/{user_id}/depts", response_model=list[DeptRef])
def api_get_user_depts(
    user_id: int,
    _: CurrentUser = Depends(require_admin),
) -> list[DeptRef]:
    return [DeptRef(**d) for d in dept_admin_store.get_user_departments(user_id)]


@router.put("/users/{user_id}/depts", response_model=list[DeptRef])
def api_set_user_depts(
    user_id: int,
    body: UserDeptsRequest,
    _: CurrentUser = Depends(require_admin),
) -> list[DeptRef]:
    return [
        DeptRef(**d)
        for d in dept_admin_store.set_user_departments(user_id, body.dept_ids)
    ]
