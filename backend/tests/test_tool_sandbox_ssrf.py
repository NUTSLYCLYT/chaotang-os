"""回归门:ToolSandbox.validate_network() 的 restricted 模式必须真正拦截
内网/回环/链路本地/云元数据地址。

2026-07-03 对抗复审抓到:restricted 分支此前是字面量 `pass`,内网/元数据地址
完全不设防 —— 与前端 SSRF(libu/ingest)是同一类问题的第二个独立面,
后端 agent 工具调用(fetch_url)可借此打穿到 127.0.0.1:8081 或云元数据端点。
"""
from __future__ import annotations

from src.tool_sandbox import SandboxConfig, ToolSandbox


def _restricted_sandbox() -> ToolSandbox:
    return ToolSandbox(config=SandboxConfig(enabled=True, network_mode="restricted"))


def test_restricted_mode_blocks_loopback_ip_literal():
    sb = _restricted_sandbox()
    result = sb.validate_network("http://127.0.0.1:8081/api/admin")
    assert result.allowed is False


def test_restricted_mode_blocks_localhost_hostname():
    sb = _restricted_sandbox()
    result = sb.validate_network("http://localhost:8081/api/admin")
    assert result.allowed is False


def test_restricted_mode_blocks_cloud_metadata_ip():
    sb = _restricted_sandbox()
    result = sb.validate_network("http://169.254.169.254/latest/meta-data/")
    assert result.allowed is False


def test_restricted_mode_blocks_private_rfc1918_targets():
    sb = _restricted_sandbox()
    for target in ("http://10.0.0.5/", "http://172.16.0.5/", "http://192.168.1.5/"):
        result = sb.validate_network(target)
        assert result.allowed is False, target


def test_restricted_mode_allows_public_ip_literal():
    sb = _restricted_sandbox()
    result = sb.validate_network("http://8.8.8.8/")
    assert result.allowed is True


def test_open_mode_allows_internal_targets():
    sb = ToolSandbox(config=SandboxConfig(enabled=True, network_mode="open"))
    result = sb.validate_network("http://127.0.0.1:8081/")
    assert result.allowed is True


def test_disabled_sandbox_allows_everything():
    sb = ToolSandbox(config=SandboxConfig(enabled=False, network_mode="restricted"))
    result = sb.validate_network("http://127.0.0.1:8081/")
    assert result.allowed is True
