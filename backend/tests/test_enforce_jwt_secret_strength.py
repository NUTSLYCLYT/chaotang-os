"""回归门:src.security.enforce_jwt_secret() 必须做真正的强度检查(长度+字符
多样性),且认证已启用时对弱密钥硬停(抛异常阻断启动),而非只 log。

2026-07-03 对抗复审抓到:旧实现只比对 {"fengqun-dev-secret-change-me", ""}
两个字面量,"secret"/"12345678"/任意词典词全部放行;触发时也只 logger.error
不阻断启动。
"""
from __future__ import annotations

import importlib

import pytest


def _security():
    return importlib.import_module("src.security")


@pytest.mark.parametrize(
    "weak_secret",
    [
        "",
        "fengqun-dev-secret-change-me",
        "secret",
        "12345678",
        "a" * 40,  # 长度够但只有 1 个不同字符
    ],
)
def test_weak_secret_detected(weak_secret):
    security = _security()
    assert security._jwt_secret_is_weak(weak_secret) is True


def test_strong_secret_passes():
    security = _security()
    strong = "kX9mQ2vL8pT4wR7yU1zA6bC3dE5fG0hJ"  # 32 chars, 高字符多样性
    assert security._jwt_secret_is_weak(strong) is False


def test_enforce_jwt_secret_hard_stops_when_auth_enabled(monkeypatch):
    security = _security()
    tenant = importlib.import_module("src.tenant")
    monkeypatch.setattr(tenant, "JWT_SECRET", "weak")
    monkeypatch.setenv("FENGQUN_AUTH", "true")

    with pytest.raises(RuntimeError):
        security.enforce_jwt_secret()


def test_enforce_jwt_secret_only_warns_when_auth_disabled(monkeypatch):
    security = _security()
    tenant = importlib.import_module("src.tenant")
    monkeypatch.setattr(tenant, "JWT_SECRET", "weak")
    monkeypatch.setenv("FENGQUN_AUTH", "false")

    security.enforce_jwt_secret()  # 不应抛异常


def test_enforce_jwt_secret_passes_with_strong_secret(monkeypatch):
    security = _security()
    tenant = importlib.import_module("src.tenant")
    monkeypatch.setattr(tenant, "JWT_SECRET", "kX9mQ2vL8pT4wR7yU1zA6bC3dE5fG0hJ")
    monkeypatch.setenv("FENGQUN_AUTH", "true")

    security.enforce_jwt_secret()  # 不应抛异常
