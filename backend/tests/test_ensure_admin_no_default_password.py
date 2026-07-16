"""回归门:src.tenant.ensure_admin() 不得硬编码 admin/admin123。

2026-07-03 对抗复审抓到 ensure_admin() 无条件用 admin123 创建管理员,每次冷启动/
数据库重建都会重现该默认凭据。本测隔离到 tmp_path 下的独立 sqlite 文件,断言:
1) 设置 ADMIN_INITIAL_PASSWORD 时,新建 admin 密码 = 该值,admin123 失效。
2) 未设置该环境变量时,不会用可猜测的 admin123 建号。
3) 已存在 admin 时重复调用不会用新环境变量覆盖旧密码(幂等)。
"""
from __future__ import annotations

import importlib

from tests.tenant_test_schema import initialize_tenant_test_schema


def _isolated_tenant(monkeypatch, tmp_path):
    tenant = importlib.import_module("src.tenant")
    db_path = tmp_path / "fengqun_test.db"
    initialize_tenant_test_schema(db_path)
    monkeypatch.setattr(tenant, "DB_PATH", db_path)
    return tenant


def test_ensure_admin_uses_env_password(monkeypatch, tmp_path):
    tenant = _isolated_tenant(monkeypatch, tmp_path)
    monkeypatch.setenv("ADMIN_INITIAL_PASSWORD", "a-strong-random-passphrase-01")

    tenant.ensure_admin()

    assert tenant.authenticate("admin", "a-strong-random-passphrase-01") is not None
    assert tenant.authenticate("admin", "admin123") is None


def test_ensure_admin_without_env_var_does_not_use_admin123(monkeypatch, tmp_path):
    tenant = _isolated_tenant(monkeypatch, tmp_path)
    monkeypatch.delenv("ADMIN_INITIAL_PASSWORD", raising=False)

    tenant.ensure_admin()

    # 核心断言:admin/admin123 必须不可登录
    assert tenant.authenticate("admin", "admin123") is None


def test_ensure_admin_is_idempotent(monkeypatch, tmp_path):
    tenant = _isolated_tenant(monkeypatch, tmp_path)
    monkeypatch.setenv("ADMIN_INITIAL_PASSWORD", "first-call-password-xyz")
    tenant.ensure_admin()

    # 模拟重启时环境变量变化,已存在的 admin 不应被静默改密
    monkeypatch.setenv("ADMIN_INITIAL_PASSWORD", "second-call-password-different")
    tenant.ensure_admin()

    assert tenant.authenticate("admin", "first-call-password-xyz") is not None
    assert tenant.authenticate("admin", "second-call-password-different") is None
