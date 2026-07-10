"""回归门:注册接口用户名冲突 vs 邮箱冲突必须返回同一条泛化错误信息,不能通过
detail 文案分辨具体是哪个字段冲突。

2026-07-03 对抗复审抓到:分开的"该用户名已被注册"/"该邮箱已被注册"文案构成
用户枚举 oracle。隔离到 tmp_path 独立 sqlite 文件,不碰真实 data/fengqun.db。
"""

from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from web.main import app


def _isolated_tenant_db(monkeypatch, tmp_path):
    tenant = importlib.import_module("src.tenant")
    monkeypatch.setattr(tenant, "DB_PATH", tmp_path / "fengqun_test.db")
    return tenant


def test_duplicate_username_and_duplicate_email_share_same_message(
    monkeypatch, tmp_path
):
    tenant = _isolated_tenant_db(monkeypatch, tmp_path)
    # 2026-07-09 起 /register 要求 invite_code;给足配额覆盖本用例的三次注册尝试。
    tenant.create_invite("DUP_PROBE_INVITE", max_uses=3)

    with TestClient(app) as client:
        r1 = client.post(
            "/api/auth/register",
            json={
                "username": "dup_user_probe",
                "email": "dup_user_probe@example.com",
                "password": "abc12345",
                "invite_code": "DUP_PROBE_INVITE",
            },
        )
        assert r1.status_code == 201

        # 用户名冲突,邮箱不同
        r2 = client.post(
            "/api/auth/register",
            json={
                "username": "dup_user_probe",
                "email": "different_email@example.com",
                "password": "abc12345",
                "invite_code": "DUP_PROBE_INVITE",
            },
        )
        # 邮箱冲突,用户名不同
        r3 = client.post(
            "/api/auth/register",
            json={
                "username": "totally_different_user_probe",
                "email": "dup_user_probe@example.com",
                "password": "abc12345",
                "invite_code": "DUP_PROBE_INVITE",
            },
        )

    assert r2.status_code == 409
    assert r3.status_code == 409
    assert r2.json()["detail"] == r3.json()["detail"]
