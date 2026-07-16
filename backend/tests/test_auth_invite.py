"""邀请码闭环:/api/auth/verify-invite 与 /api/auth/register 的 invite_code 校验。

2026-07-09 remaining-pages 方案 P0:此前 /register 收到 inviteCode 字段但后端
schema 没有对应字段,pydantic 直接静默丢弃、从不校验;/invite 页面调用的
POST /api/auth/verify-invite 在后端查无实据。本测试文件覆盖补齐后的真实闭环。
"""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from web.main import app
from tests.tenant_test_schema import initialize_tenant_test_schema


def _isolated_tenant_db(monkeypatch, tmp_path):
    tenant = importlib.import_module("src.tenant")
    db_path = tmp_path / "fengqun_test.db"
    initialize_tenant_test_schema(db_path)
    monkeypatch.setattr(tenant, "DB_PATH", db_path)
    return tenant


def test_verify_invite_rejects_unknown_code(monkeypatch, tmp_path):
    _isolated_tenant_db(monkeypatch, tmp_path)
    with TestClient(app) as client:
        res = client.post("/api/auth/verify-invite", json={"code": "NOPE"})
    assert res.status_code == 403
    assert res.json()["detail"]["valid"] is False


def test_verify_invite_rejects_empty_code(monkeypatch, tmp_path):
    _isolated_tenant_db(monkeypatch, tmp_path)
    with TestClient(app) as client:
        res = client.post("/api/auth/verify-invite", json={"code": ""})
    assert res.status_code == 400


def test_verify_invite_accepts_valid_unconsumed_code(monkeypatch, tmp_path):
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    tenant.create_invite("VALID2026", max_uses=2)
    with TestClient(app) as client:
        res = client.post("/api/auth/verify-invite", json={"code": "VALID2026"})
    assert res.status_code == 200
    assert res.json()["valid"] is True


def test_verify_invite_does_not_consume(monkeypatch, tmp_path):
    """verify-invite 是只读预览,反复调用不应该扣减 used_count。"""
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    tenant.create_invite("PREVIEW2026", max_uses=1)
    with TestClient(app) as client:
        for _ in range(3):
            res = client.post("/api/auth/verify-invite", json={"code": "PREVIEW2026"})
            assert res.status_code == 200
    db = tenant.get_db()
    row = db.execute(
        "SELECT used_count FROM invites WHERE code = ?", ("PREVIEW2026",)
    ).fetchone()
    assert row["used_count"] == 0


def test_register_without_invite_code_rejected(monkeypatch, tmp_path):
    _isolated_tenant_db(monkeypatch, tmp_path)
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/register",
            json={
                "username": "no_invite_probe",
                "email": "no_invite_probe@example.com",
                "password": "abc12345",
            },
        )
    assert res.status_code == 422  # pydantic 缺必填字段


def test_register_with_invalid_invite_code_rejected(monkeypatch, tmp_path):
    _isolated_tenant_db(monkeypatch, tmp_path)
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/register",
            json={
                "username": "bad_invite_probe",
                "email": "bad_invite_probe@example.com",
                "password": "abc12345",
                "invite_code": "GARBAGE",
            },
        )
    assert res.status_code == 403


def test_register_with_valid_invite_code_succeeds_and_consumes(monkeypatch, tmp_path):
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    tenant.create_invite("REG2026", max_uses=1)
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/register",
            json={
                "username": "good_invite_probe",
                "email": "good_invite_probe@example.com",
                "password": "abc12345",
                "invite_code": "REG2026",
            },
        )
    assert res.status_code == 201

    db = tenant.get_db()
    row = db.execute(
        "SELECT used_count, max_uses FROM invites WHERE code = ?", ("REG2026",)
    ).fetchone()
    assert row["used_count"] == 1


def test_register_with_exhausted_invite_code_rejected(monkeypatch, tmp_path):
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    tenant.create_invite("ONEUSE2026", max_uses=1)
    with TestClient(app) as client:
        r1 = client.post(
            "/api/auth/register",
            json={
                "username": "first_user_probe",
                "email": "first_user_probe@example.com",
                "password": "abc12345",
                "invite_code": "ONEUSE2026",
            },
        )
        assert r1.status_code == 201

        r2 = client.post(
            "/api/auth/register",
            json={
                "username": "second_user_probe",
                "email": "second_user_probe@example.com",
                "password": "abc12345",
                "invite_code": "ONEUSE2026",
            },
        )
    assert r2.status_code == 403


def test_register_with_expired_invite_code_rejected(monkeypatch, tmp_path):
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    tenant.create_invite("EXPIRED2026", max_uses=5, expires_at="2000-01-01T00:00:00")
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/register",
            json={
                "username": "expired_invite_probe",
                "email": "expired_invite_probe@example.com",
                "password": "abc12345",
                "invite_code": "EXPIRED2026",
            },
        )
    assert res.status_code == 403


def test_verify_invite_rejects_unknown_and_exhausted_with_same_generic_message(
    monkeypatch, tmp_path
):
    """2026-07-10 安全复审:不同失败原因(不存在/已过期/已用完)必须回同一条泛化文案,
    否则构成邀请码枚举 oracle——和 api_register 的用户名/邮箱冲突防枚举是同一条纪律。
    """
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    tenant.create_invite("EXHAUSTED_PROBE", max_uses=1)
    tenant.consume_invite("EXHAUSTED_PROBE")

    with TestClient(app) as client:
        r_unknown = client.post(
            "/api/auth/verify-invite", json={"code": "TOTALLY_UNKNOWN"}
        )
        r_exhausted = client.post(
            "/api/auth/verify-invite", json={"code": "EXHAUSTED_PROBE"}
        )

    assert r_unknown.status_code == 403
    assert r_exhausted.status_code == 403
    assert (
        r_unknown.json()["detail"]["message"] == r_exhausted.json()["detail"]["message"]
    )


def test_client_ip_prefers_x_real_ip_over_client_host_for_rate_limiting():
    """2026-07-10 安全复审:生产经 nginx 反代,request.client.host 永远是 nginx 自己的
    回环地址;X-Real-IP 是 nginx 用 proxy_set_header 无条件覆盖写入的可信头,必须优先。
    """
    auth_router = importlib.import_module("web.routers.auth")

    class _FakeClient:
        host = "127.0.0.1"  # 反代场景下,这永远是 nginx 自己的地址

    class _FakeRequest:
        def __init__(self, headers: dict[str, str]):
            self.headers = headers
            self.client = _FakeClient()

    real_ip_req = _FakeRequest({"x-real-ip": "203.0.113.7"})
    assert auth_router._client_ip(real_ip_req) == "203.0.113.7"

    forwarded_req = _FakeRequest({"x-forwarded-for": "203.0.113.9, 10.0.0.1"})
    assert auth_router._client_ip(forwarded_req) == "203.0.113.9"

    direct_req = _FakeRequest({})
    assert auth_router._client_ip(direct_req) == "127.0.0.1"
