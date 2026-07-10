"""认证端点 — register / login / me / logout。"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from src.direct_rate_limit import rate_limiter
from src.tenant import authenticate, create_user, get_db

from web.deps import try_get_current_user
from web.schemas.auth import (
    AuthMeResponse,
    CurrentUser,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
)
from web.schemas.common import StatusResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

_SEED_INVITE_CODES = {
    "COURT2026",
    "COURT2025",
    "CHAOTANG2026",
    "CHAOTANG2025",
    "COURTOS2026",
    "COURTOS2025",
    "EMPEROR2026",
    "MINGSHUO2026",
    "INVITE2026",
    "WELCOME2026",
    "JIQUN2026",
}


class VerifyInviteRequest(BaseModel):
    code: str


class VerifyInviteResponse(BaseModel):
    valid: bool
    message: str

# Secure cookie 默认开启(fail-safe);仅本机 http 开发场景可显式关闭。
_COOKIE_SECURE = os.environ.get("FENGQUN_COOKIE_SECURE", "true").lower() in (
    "true",
    "1",
    "yes",
)


def _allowed_invite_codes() -> set[str]:
    configured = {
        item.strip().upper()
        for item in os.environ.get("CHAOTANG_INVITE_CODES", "").split(",")
        if item.strip()
    }
    return _SEED_INVITE_CODES | configured


@router.post("/verify-invite", response_model=VerifyInviteResponse)
def api_verify_invite(body: VerifyInviteRequest) -> VerifyInviteResponse:
    code = body.code.strip().upper()
    if not code:
        return VerifyInviteResponse(valid=False, message="邀请码不能为空")
    if code in _allowed_invite_codes():
        return VerifyInviteResponse(valid=True, message="邀请码有效")
    return VerifyInviteResponse(valid=False, message="邀请码无效或已过期")


@router.post("/register", response_model=RegisterResponse, status_code=201)
def api_register(body: RegisterRequest) -> RegisterResponse:
    """用户注册 — 创建新用户账号，关联默认租户。"""
    db = get_db()

    # 用户名/邮箱唯一性检查 —— 二者共用同一条泛化错误信息,不区分具体是哪个
    # 冲突,防止用户枚举(2026-07-03 对抗复审:分开的 409 文案会泄露账号是否存在)。
    existing = db.execute(
        "SELECT id FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    existing_email = None
    try:
        existing_email = db.execute(
            "SELECT id FROM users WHERE email = ?", (body.email,)
        ).fetchone()
    except Exception:
        # email 列可能尚不存在，跳过邮箱查重
        pass

    if existing or existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该用户名或邮箱已被注册",
        )

    # 获取默认租户
    tenant = db.execute(
        "SELECT id FROM tenants WHERE slug = 'default'"
    ).fetchone()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系统未初始化，默认租户不存在",
        )

    # 创建用户
    try:
        user_id = create_user(
            username=body.username,
            password=body.password,
            tenant_id=tenant["id"],
            role="user",
            display_name=body.username,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建用户失败: {e}",
        )

    # 保存邮箱（如果 email 列存在）
    try:
        db.execute(
            "UPDATE users SET email = ? WHERE id = ?",
            (body.email, user_id),
        )
        db.commit()
    except Exception:
        # email 列不存在，不影响
        pass

    return RegisterResponse(
        message="注册成功",
        username=body.username,
        user_id=user_id,
    )


@router.post("/login", response_model=LoginResponse)
def api_login(body: LoginRequest, request: Request, response: Response) -> LoginResponse:
    """用户登录 — 返回 JWT + 用户/租户元信息，并设置 token cookie。

    限流(2026-07-03 对抗复审补):按来源 IP 和按用户名各自 5 次/分钟,任一超限即拒。
    注:生产多 worker 部署下本限流器是进程内存态,每 worker 各自计数
    (见 gunicorn.conf.py workers=cpu*2+1),有效上限是 5×worker数,而非全局 5;
    要做到跨进程精确限流需换 Redis/DB 共享存储,这里先把"零防护"堵上。
    """
    client_ip = request.client.host if request.client else "unknown"
    username = body.username.strip()

    ip_ok, ip_err = rate_limiter.check(f"login_ip:{client_ip}", mode="login_ip")
    if not ip_ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=ip_err,
            headers={"Retry-After": str((ip_err or {}).get("retry_after", 60))},
        )
    user_ok, user_err = rate_limiter.check(f"login_user:{username}", mode="login_user")
    if not user_ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=user_err,
            headers={"Retry-After": str((user_err or {}).get("retry_after", 60))},
        )

    result = authenticate(username, body.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    response.set_cookie(
        key="token",
        value=result["token"],
        httponly=True,
        max_age=86400,
        samesite="lax",
        secure=_COOKIE_SECURE,
    )
    return LoginResponse(**result)


@router.get("/me", response_model=AuthMeResponse)
def api_auth_me(
    user: CurrentUser | None = Depends(try_get_current_user),
) -> AuthMeResponse:
    """返回当前登录用户。

    与旧 Flask 实现的差异（规范化修复）:
      - 旧版因白名单导致永远返回 authenticated=false
      - 现版只要 cookie/header 里有有效 JWT 就识别用户
    """
    if not user or not user.user_id:
        return AuthMeResponse(authenticated=False)
    return AuthMeResponse(authenticated=True, user=user)


@router.post("/logout", response_model=StatusResponse)
def api_logout(response: Response) -> StatusResponse:
    response.delete_cookie("token")
    return StatusResponse(status="ok")
