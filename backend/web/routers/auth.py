"""认证端点 — register / login / me / logout。"""

from __future__ import annotations

import os
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from src.direct_rate_limit import rate_limiter
from src.tenant import authenticate, check_invite, consume_invite, create_user, get_db

from web.deps import try_get_current_user
from web.schemas.auth import (
    AuthMeResponse,
    CurrentUser,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    VerifyInviteRequest,
    VerifyInviteResponse,
)
from web.schemas.common import StatusResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Secure cookie 默认开启(fail-safe);仅本机 http 开发场景可显式关闭。
_COOKIE_SECURE = os.environ.get("FENGQUN_COOKIE_SECURE", "true").lower() in (
    "true",
    "1",
    "yes",
)


def _client_ip(request: Request) -> str:
    """按来源 IP 限流时用的客户端地址。

    生产部署经 nginx 反代（见 frontend/deploy/nginx-app.conf.template），nginx 用
    `proxy_set_header X-Real-IP $remote_addr` 无条件覆盖该头(不是追加),客户端自带的
    伪造 X-Real-IP 会被 nginx 盖掉,可信。直接用 request.client.host 在反代后永远是
    nginx 自己的回环地址,会让"按 IP 限流"退化成全站共享一个配额(2026-07-10 安全复审
    抓到:之前 login_ip/invite_verify_ip 都是这个洞)。没有反代头时(本地直连)落回
    request.client.host。
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/verify-invite", response_model=VerifyInviteResponse)
def api_verify_invite(
    body: VerifyInviteRequest, request: Request
) -> VerifyInviteResponse:
    """校验邀请码是否可用 — 只读预览，不消耗次数（真正消耗发生在 /register）。"""
    client_ip = _client_ip(request)
    ok, err = rate_limiter.check(
        f"invite_verify_ip:{client_ip}", mode="invite_verify_ip"
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=err)

    code = body.code.strip()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=VerifyInviteResponse(
                valid=False, message="邀请码不能为空"
            ).model_dump(),
        )

    # 校验失败一律回同一条泛化文案,不区分"不存在/已过期/已用完"——2026-07-10 安全复审:
    # 分开的具体原因会构成邀请码枚举 oracle,和 api_register 里用户名/邮箱冲突防枚举是
    # 同一条纪律。check_invite() 内部仍保留细分原因供 CLI/内部工具使用。
    valid, _reason = check_invite(code)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=VerifyInviteResponse(
                valid=False, message="邀请码无效或已过期"
            ).model_dump(),
        )
    return VerifyInviteResponse(valid=True)


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

    # 邀请码必须有效才能注册 —— 消耗放在唯一性检查之后、建号之前，减少
    # "邀请码被扣、账号却没建成"的浪费；仍有极小概率的竞态窗口（建号失败但邀请码
    # 已消耗），内部小容量系统可接受，不为此引入跨表事务。
    try:
        invite_ok = consume_invite(body.invite_code.strip())
    except sqlite3.OperationalError:
        # 高并发下 SQLite 写锁等待超过 connect() 默认 5s busy_timeout——fail closed,
        # 不建号，前端按普通失败提示重试(而不是让用户看到一条裸 500)。
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="系统繁忙，请稍后重试",
        )
    if not invite_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="邀请码无效、已过期或已被使用",
        )

    # 获取默认租户
    tenant = db.execute("SELECT id FROM tenants WHERE slug = 'default'").fetchone()
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
def api_login(
    body: LoginRequest, request: Request, response: Response
) -> LoginResponse:
    """用户登录 — 返回 JWT + 用户/租户元信息，并设置 token cookie。

    限流(2026-07-03 对抗复审补):按来源 IP 和按用户名各自 5 次/分钟,任一超限即拒。
    注:生产多 worker 部署下本限流器是进程内存态,每 worker 各自计数
    (见 gunicorn.conf.py workers=cpu*2+1),有效上限是 5×worker数,而非全局 5;
    要做到跨进程精确限流需换 Redis/DB 共享存储,这里先把"零防护"堵上。
    """
    client_ip = _client_ip(request)
    username = body.username.strip()

    ip_ok, ip_err = rate_limiter.check(f"login_ip:{client_ip}", mode="login_ip")
    if not ip_ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=ip_err
        )
    user_ok, user_err = rate_limiter.check(f"login_user:{username}", mode="login_user")
    if not user_ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=user_err
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
