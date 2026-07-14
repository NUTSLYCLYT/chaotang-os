"""多租户 + 用户体系。

采用 SQLite 轻量方案：
- 用户表（id, username, password_hash, tenant_id, role, created_at）
- 租户表（id, name, slug, created_at）

数据隔离策略：
- 每个租户的运行数据存储在 data/{tenant_slug}/ 下
- runs/, repairs/, drafts/, events/, swarm_sessions/ 按租户隔离
- runtime_prompts/ 按租户隔离（首次从全局模板复制）
- config/ 共享（Flow YAML 是全局的）

认证：JWT Token，存在 HTTP Header 或 Cookie 中。
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# 路径配置
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "fengqun.db"
DB_PATH = Path(os.environ.get("FENGQUN_DB_PATH", str(DEFAULT_DB_PATH))).expanduser()
DATA_ROOT = PROJECT_ROOT / "data"

# 单租户模式下的默认租户（向后兼容）
DEFAULT_TENANT_SLUG = "default"

# JWT 密钥（生产环境应从环境变量读取）
JWT_SECRET = os.environ.get("FENGQUN_JWT_SECRET", "fengqun-dev-secret-change-me")
JWT_EXPIRE_HOURS = 24

# ---------------------------------------------------------------------------
# 当前请求的租户上下文（线程安全）
# ---------------------------------------------------------------------------

_thread_local = threading.local()


def get_current_tenant() -> str:
    """获取当前线程的租户 slug。"""
    return getattr(_thread_local, "tenant_slug", DEFAULT_TENANT_SLUG)


def set_current_tenant(slug: str):
    """设置当前线程的租户 slug。"""
    _thread_local.tenant_slug = slug


@contextmanager
def tenant_context(slug: str):
    """租户上下文管理器。"""
    old = get_current_tenant()
    set_current_tenant(slug)
    try:
        yield
    finally:
        set_current_tenant(old)


def with_tenant(target, tenant_slug: str | None = None):
    """把 callable 包成"在指定租户下运行"的版本,用于**跨线程携带租户上下文**。

    病根(2026-07-07 三层架构会审 CRITICAL):租户存在 threading.local(),**不被 spawn 的子线程继承**。
    SwarmOrchestrator 的 worker 线程(_run_single_swarm)一起就是全新 thread-local → get_current_tenant()
    静默回落 DEFAULT_TENANT_SLUG='default' → 租户 A 的密旨触发的蜂群在 default 读写(session/成交/RAG/召回),
    跨租户污染 + 每企业专项进化归零,且日志全绿看不出。

    用法:threading.Thread(target=with_tenant(fn), ...) —— 在**父线程**(此刻租户正确)捕获 slug,
    worker 线程启动时用 tenant_context 恢复。tenant_slug=None 时默认捕获当前父线程租户。
    """
    slug = tenant_slug if tenant_slug is not None else get_current_tenant()

    def _wrapped(*args, **kwargs):
        with tenant_context(slug):
            return target(*args, **kwargs)

    return _wrapped


def get_tenant_data_dir(subdir: str = "") -> Path:
    """获取当前租户的数据目录。

    例：get_tenant_data_dir("runs") → data/default/runs/
    """
    slug = get_current_tenant()
    base = DATA_ROOT / slug
    if subdir:
        base = base / subdir
    base.mkdir(parents=True, exist_ok=True)
    return base


# ---------------------------------------------------------------------------
# 数据库初始化
# ---------------------------------------------------------------------------

_db_lock = threading.Lock()


def _get_db() -> sqlite3.Connection:
    """获取数据库连接（自动建表）。"""
    if (
        os.environ.get("FENGQUN_TEST_DB_GUARD") == "1"
        and DB_PATH.resolve() == DEFAULT_DB_PATH.resolve()
    ):
        raise RuntimeError(
            "pytest tenant production DB tripwire: refusing to open "
            f"{DEFAULT_DB_PATH}"
        )
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT DEFAULT '',
            password_hash TEXT NOT NULL,
            tenant_id INTEGER NOT NULL REFERENCES tenants(id),
            role TEXT NOT NULL DEFAULT 'user',
            display_name TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            max_uses INTEGER NOT NULL DEFAULT 1,
            used_count INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()

    # 迁移：为已有数据库添加 email 列
    try:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass  # 列已存在

    # 确保默认租户存在
    row = conn.execute(
        "SELECT id FROM tenants WHERE slug=?", (DEFAULT_TENANT_SLUG,)
    ).fetchone()
    if not row:
        conn.execute(
            "INSERT INTO tenants (name, slug) VALUES (?, ?)",
            ("默认租户", DEFAULT_TENANT_SLUG),
        )
        conn.commit()

    return conn


def get_db():
    with _db_lock:
        return _get_db()


def resolve_current_tenant_id() -> int:
    """当前线程租户 slug(由 get_current_user() 在请求进入时从 JWT 设好)→ tenants.id；
    查不到回退默认租户 1。

    2026-07-12 Codex 停止前审查发现："tenant-scoped evidence uses the default
    tenant"——jinyiwei_evidence 一律走 src.chaotang_store._get_default_tenant_id()，
    那个函数硬查 slug='default'，完全不看当前请求实际是哪个租户在调用，
    等同于假装系统是单租户。真正的每请求租户解析(src/dept_admin_store.py
    的 _current_tenant_id，已经在给部门管理端点用)反而没被复用到其余
    5 张 flow 表(decrees/tasks/memorials/reviews/retrospectives)和现在的
    jinyiwei_evidence 上——这个函数是提炼出来的共享实现，两边都改成调用它。"""
    slug = get_current_tenant()
    row = get_db().execute(
        "SELECT id FROM tenants WHERE slug=?", (slug,)
    ).fetchone()
    return int(row["id"]) if row else 1


# ---------------------------------------------------------------------------
# 密码哈希
# ---------------------------------------------------------------------------


def _hash_password(password: str, salt: str = "") -> str:
    """PBKDF2-SHA256 密码哈希（比纯 SHA-256 安全，兼容已有 salt:hash 格式）。"""
    if not salt:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"{salt}:{dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    if ":" not in stored:
        return False
    salt = stored.split(":")[0]
    # 兼容旧格式（sha256，64位hex）和新格式（pbkdf2，64位hex）
    new_hash = _hash_password(password, salt)
    if secrets.compare_digest(new_hash, stored):
        return True
    # 旧格式兼容：sha256
    old_h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return secrets.compare_digest(f"{salt}:{old_h}", stored)


# ---------------------------------------------------------------------------
# JWT（简易实现，不依赖外部库）
# ---------------------------------------------------------------------------

import base64
import hmac


def _jwt_encode(payload: dict) -> str:
    """生成 JWT token（HS256）。"""
    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        .rstrip(b"=")
        .decode()
    )
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    sig_input = f"{header}.{body}"
    sig = hmac.new(JWT_SECRET.encode(), sig_input.encode(), "sha256").digest()
    signature = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{header}.{body}.{signature}"


def _jwt_decode(token: str) -> dict | None:
    """验证并解码 JWT token。"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, body, signature = parts
        # 验签
        sig_input = f"{header}.{body}"
        expected_sig = (
            base64.urlsafe_b64encode(
                hmac.new(JWT_SECRET.encode(), sig_input.encode(), "sha256").digest()
            )
            .rstrip(b"=")
            .decode()
        )
        if not hmac.compare_digest(signature, expected_sig):
            return None
        # 解码 payload
        padding = 4 - len(body) % 4
        if padding != 4:
            body += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(body))
        # 检查过期
        if "exp" in payload:
            from datetime import datetime as dt

            if dt.fromisoformat(payload["exp"]) < dt.now():
                return None
        return payload
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 用户/租户 CRUD
# ---------------------------------------------------------------------------


def create_tenant(name: str, slug: str) -> int:
    """创建租户，返回 tenant_id。"""
    db = get_db()
    cursor = db.execute("INSERT INTO tenants (name, slug) VALUES (?, ?)", (name, slug))
    db.commit()
    # 初始化租户数据目录
    tenant_dir = DATA_ROOT / slug
    tenant_dir.mkdir(parents=True, exist_ok=True)
    return cursor.lastrowid


def create_user(
    username: str,
    password: str,
    tenant_id: int,
    role: str = "user",
    display_name: str = "",
) -> int:
    """创建用户，返回 user_id。"""
    db = get_db()
    pw_hash = _hash_password(password)
    cursor = db.execute(
        "INSERT INTO users (username, password_hash, tenant_id, role, display_name) "
        "VALUES (?, ?, ?, ?, ?)",
        (username, pw_hash, tenant_id, role, display_name),
    )
    db.commit()
    return cursor.lastrowid


def authenticate(username: str, password: str) -> dict | None:
    """验证用户名密码，成功返回 {token, user, tenant}。"""
    db = get_db()
    row = db.execute(
        "SELECT u.id, u.username, u.password_hash, u.role, u.display_name, "
        "t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug "
        "FROM users u JOIN tenants t ON u.tenant_id = t.id "
        "WHERE u.username = ?",
        (username,),
    ).fetchone()
    if not row:
        return None
    if not _verify_password(password, row["password_hash"]):
        return None

    exp = (datetime.now() + timedelta(hours=JWT_EXPIRE_HOURS)).isoformat()
    payload = {
        "user_id": row["id"],
        "username": row["username"],
        "tenant_slug": row["tenant_slug"],
        "role": row["role"],
        "exp": exp,
    }
    token = _jwt_encode(payload)
    return {
        "token": token,
        "user": {
            "id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
            "role": row["role"],
        },
        "tenant": {
            "id": row["tenant_id"],
            "name": row["tenant_name"],
            "slug": row["tenant_slug"],
        },
    }


def verify_token(token: str) -> dict | None:
    """验证 JWT token，返回 payload。"""
    payload = _jwt_decode(token)
    if not payload:
        return None
    # CI sidecar credentials are exchange-only and must never authenticate to
    # the production API, even if someone signs them with the production key.
    if (
        payload.get("iss") == "chaotang-ci-sidecar"
        or payload.get("env") in {"ci", "local-test"}
        or payload.get("aud") == "chaotang-e2e"
        or payload.get("scope") == "e2e:nonprivileged"
        or payload.get("typ") == "chaotang-ci-exchange"
    ):
        return None
    return payload


# ---------------------------------------------------------------------------
# 邀请码
# ---------------------------------------------------------------------------


def create_invite(code: str, max_uses: int = 1, expires_at: str | None = None) -> int:
    """创建邀请码，返回 invite_id。"""
    db = get_db()
    cursor = db.execute(
        "INSERT INTO invites (code, max_uses, expires_at) VALUES (?, ?, ?)",
        (code, max_uses, expires_at),
    )
    db.commit()
    return cursor.lastrowid


def check_invite(code: str) -> tuple[bool, str]:
    """只读校验邀请码是否可用，不消耗次数（用于 /invite 落地页预览）。"""
    db = get_db()
    row = db.execute(
        "SELECT max_uses, used_count, expires_at FROM invites WHERE code = ?", (code,)
    ).fetchone()
    if not row:
        return False, "邀请码不存在"
    if row["expires_at"] and row["expires_at"] < datetime.now().isoformat():
        return False, "邀请码已过期"
    if row["used_count"] >= row["max_uses"]:
        return False, "邀请码已被使用"
    return True, ""


def consume_invite(code: str) -> bool:
    """原子消耗一次邀请码用量，返回是否成功。

    用 UPDATE ... WHERE 条件在一条语句里完成"仍有效才消耗"，靠 SQLite 单文件
    写锁保证并发下不会超发，不需要额外加锁。
    """
    db = get_db()
    now_iso = datetime.now().isoformat()
    cursor = db.execute(
        "UPDATE invites SET used_count = used_count + 1 "
        "WHERE code = ? AND used_count < max_uses AND (expires_at IS NULL OR expires_at >= ?)",
        (code, now_iso),
    )
    db.commit()
    return cursor.rowcount > 0


def list_tenants() -> list[dict]:
    db = get_db()
    rows = db.execute(
        "SELECT id, name, slug, created_at FROM tenants ORDER BY id"
    ).fetchall()
    return [dict(r) for r in rows]


def list_users(tenant_id: int | None = None) -> list[dict]:
    db = get_db()
    if tenant_id:
        rows = db.execute(
            "SELECT u.id, u.username, u.display_name, u.role, t.name as tenant_name "
            "FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = ?",
            (tenant_id,),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT u.id, u.username, u.display_name, u.role, t.name as tenant_name "
            "FROM users u JOIN tenants t ON u.tenant_id = t.id",
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# 初始化脚本：创建默认管理员
# ---------------------------------------------------------------------------


def ensure_admin():
    """确保默认管理员账户存在。

    密码来源:优先 ADMIN_INITIAL_PASSWORD 环境变量;未设置则生成随机密码并
    以 WARNING 级别打到日志(仅本次启动可见一次),严禁硬编码可猜测默认值
    ——2026-07-03 对抗复审抓到 admin/admin123 每次启动无条件重建的洞。
    """
    db = get_db()
    admin = db.execute("SELECT id FROM users WHERE username='admin'").fetchone()
    if admin:
        return
    tenant = db.execute(
        "SELECT id FROM tenants WHERE slug=?", (DEFAULT_TENANT_SLUG,)
    ).fetchone()
    if not tenant:
        return
    password = os.environ.get("ADMIN_INITIAL_PASSWORD", "").strip()
    generated = False
    if not password:
        password = secrets.token_urlsafe(16)
        generated = True
    create_user("admin", password, tenant["id"], role="admin", display_name="管理员")
    if generated:
        import logging

        logging.getLogger(__name__).warning(
            "ADMIN_INITIAL_PASSWORD 未设置,已生成随机初始密码(仅此次启动打印,请立即登录后修改): %s",
            password,
        )


def ensure_bootstrap_invite():
    """按需确保一个引导邀请码存在。

    默认不做任何事(安全默认:没配置就没有可用邀请码,注册闭环保持关闭)。
    只有显式设置 FENGQUN_BOOTSTRAP_INVITE_CODE 环境变量(本地开发/CI/e2e 场景)
    才会幂等创建/续期该邀请码,不会覆盖已手动调整过用量的同名邀请码。
    """
    code = os.environ.get("FENGQUN_BOOTSTRAP_INVITE_CODE", "").strip()
    if not code:
        return
    db = get_db()
    existing = db.execute("SELECT id FROM invites WHERE code = ?", (code,)).fetchone()
    if existing:
        return
    create_invite(code, max_uses=100_000)
    import logging

    logging.getLogger(__name__).warning(
        "FENGQUN_BOOTSTRAP_INVITE_CODE 已生效,创建了一个开放注册邀请码(2026-07-10 安全复审:"
        "此项只应在本地开发/CI/e2e 场景启用,生产环境出现此告警需要立即核查):code=%r max_uses=100000",
        code,
    )
