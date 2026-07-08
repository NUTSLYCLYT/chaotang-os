"""回归门:
1) /api/auth/login 必须有限流(2026-07-03 对抗复审抓到零防护,可无限撞库)。
2) 登录 cookie 必须带 Secure 属性(旧实现只设了 HttpOnly+SameSite)。

login rate limiter 是模块级单例,conftest.py 的 autouse `_reset_login_rate_limiter`
在每个测试前后清空状态,避免跨测试互相影响配额。
"""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from web.main import app


def _client() -> TestClient:
    return TestClient(app)


def test_login_cookie_has_secure_flag():
    fake_result = {
        "token": "test.jwt.token",
        "user": {"id": 1, "username": "admin", "display_name": "管理员", "role": "admin"},
        "tenant": {"id": 1, "name": "默认租户", "slug": "default"},
    }
    with patch("web.routers.auth.authenticate", return_value=fake_result):
        with _client() as client:
            r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})

    assert r.status_code == 200
    set_cookie = r.headers.get("set-cookie", "")
    assert "Secure" in set_cookie
    assert "HttpOnly" in set_cookie


def test_login_ip_rate_limit_blocks_after_threshold():
    with patch("web.routers.auth.authenticate", return_value=None):
        with _client() as client:
            responses = [
                client.post(
                    "/api/auth/login",
                    json={"username": f"rl_probe_user_{i}", "password": "wrong"},
                )
                for i in range(7)
            ]

    # 前 5 次(同 IP,不同用户名)应各自走到"用户名或密码错误"(401),
    # 第 6 次起该 IP 的 login_ip 配额耗尽,应被限流拒绝(429)。
    assert [r.status_code for r in responses[:5]] == [401] * 5
    assert responses[5].status_code == 429
    assert responses[6].status_code == 429


def test_login_user_rate_limit_blocks_same_username_regardless_of_attempts():
    with patch("web.routers.auth.authenticate", return_value=None):
        with _client() as client:
            responses = [
                client.post(
                    "/api/auth/login",
                    json={"username": "rl_probe_fixed_user", "password": f"guess_{i}"},
                )
                for i in range(7)
            ]

    assert [r.status_code for r in responses[:5]] == [401] * 5
    assert responses[5].status_code == 429
