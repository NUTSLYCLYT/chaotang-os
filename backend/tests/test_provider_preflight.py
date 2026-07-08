"""provider 预检验收：开跑前秒级探活，离线快报不进蜂群（防今天踩的"挂5分钟才知道"坑）。

决策逻辑用注入 probe 确定性测试，不依赖真实网络。
"""

from __future__ import annotations

from src.provider_preflight import format_result, preflight


def test_preflight_ok_when_probe_succeeds():
    r = preflight("deepseek", probe=lambda pid, t: None)
    assert r["ok"] is True
    assert r["error"] is None
    assert "latency_s" in r


def test_preflight_fails_structured_when_probe_raises():
    def _dead(pid, t):
        raise RuntimeError("connection timed out")

    r = preflight("deepseek", probe=_dead)
    assert r["ok"] is False
    assert "timed out" in r["error"]
    assert "latency_s" in r  # 失败也带耗时(可观测)


def test_preflight_error_truncated():
    def _verbose(pid, t):
        raise RuntimeError("x" * 500)

    r = preflight("p", probe=_verbose)
    assert r["ok"] is False
    assert len(r["error"]) <= 200  # 不刷屏


def test_format_result_offline_is_actionable():
    msg = format_result("deepseek", {"ok": False, "latency_s": 8.0, "error": "timeout"})
    assert "离线" in msg and "终止" in msg  # 明确报离线+终止,不静默
    assert "deepseek" in msg


def test_format_result_online_one_line():
    msg = format_result("deepseek", {"ok": True, "latency_s": 1.2, "error": None})
    assert "在线" in msg and "deepseek" in msg
    assert "\n" not in msg  # 在线就一行,不噪声
