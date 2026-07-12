"""tests/test_tenant_resolve_current_tenant_id.py — 每请求真实租户解析。

见 2026-07-12 Codex 停止前审查:"tenant-scoped evidence uses the default
tenant"——jinyiwei_evidence 此前一律走 chaotang_store._get_default_tenant_id()，
那个函数硬查 slug='default'，完全不看当前请求实际是哪个租户在调用。
resolve_current_tenant_id() 改成读 get_current_tenant() 的线程本地 slug 再
查表，这里验证它确实会对不同 slug 解析出不同 tenant_id，而不是恒定同一个值。
用内存 sqlite 假表，不碰真实 data/fengqun.db(本仓库目前没有创建第二租户的
既有测试先例，避免真的往生产数据文件里插入一个永久残留的测试租户)。
"""
from __future__ import annotations

import sqlite3

import pytest

import src.tenant as tenant_module


@pytest.fixture()
def fake_tenants_db(monkeypatch):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE)"
    )
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('默认租户', 'default')")
    conn.execute("INSERT INTO tenants (name, slug) VALUES ('租户甲', 'tenant-a')")
    conn.commit()
    monkeypatch.setattr(tenant_module, "get_db", lambda: conn)
    yield conn
    conn.close()


def test_resolve_current_tenant_id_follows_current_request_tenant(fake_tenants_db):
    with tenant_module.tenant_context("default"):
        default_id = tenant_module.resolve_current_tenant_id()
    with tenant_module.tenant_context("tenant-a"):
        tenant_a_id = tenant_module.resolve_current_tenant_id()

    assert default_id != tenant_a_id


def test_resolve_current_tenant_id_falls_back_to_1_for_unknown_slug(fake_tenants_db):
    with tenant_module.tenant_context("no-such-tenant-slug"):
        assert tenant_module.resolve_current_tenant_id() == 1
