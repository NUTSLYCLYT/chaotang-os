from __future__ import annotations

import time
from types import SimpleNamespace

from fastapi.testclient import TestClient

from scripts import score_swarm
from src.backend_preflight import build_preflight_report
from web.main import app


class _FakeHealth:
    def __init__(self, checks: dict[str, str]):
        self._checks = checks

    def model_dump(self) -> dict:
        return {"status": "degraded", "version": "1.0", "checks": self._checks, "details": {}}


def test_preflight_blocks_suspended_swarms(monkeypatch):
    monkeypatch.setattr("src.backend_preflight._load_registered_swarms", lambda: ["opc"])
    monkeypatch.setattr("src.governance.collect_scores", lambda swarm_id, window=30: ([1.0, 2.0, 2.5], 0))
    monkeypatch.setattr("src.local_ai_bridge.fusion_status", lambda: {"enabled": True, "courtos_brain_exists": True})
    monkeypatch.setattr(
        "web.routers.health._health_payload",
        lambda: _FakeHealth({"litellm": "up", "deepseek_key": "configured", "mcp_web_search": "up"}),
    )

    report = build_preflight_report()

    assert report["overallStatus"] == "fail"
    assert "suspended_swarms_present" in report["blockers"]
    assert report["swarmAdmission"]["counts"]["suspended"] == 1


def test_preflight_warns_when_litellm_down_but_deepseek_configured(monkeypatch):
    monkeypatch.setattr("src.backend_preflight._load_registered_swarms", lambda: ["opc"])
    monkeypatch.setattr("src.governance.collect_scores", lambda swarm_id, window=30: ([4.0, 4.0, 5.0], 0))
    monkeypatch.setattr("src.local_ai_bridge.fusion_status", lambda: {"enabled": True, "courtos_brain_exists": True})
    monkeypatch.setattr(
        "web.routers.health._health_payload",
        lambda: _FakeHealth({"litellm": "down", "deepseek_key": "configured", "mcp_web_search": "up"}),
    )

    report = build_preflight_report()

    assert report["overallStatus"] == "warn"
    assert report["blockers"] == []
    assert "litellm_down_using_deepseek_direct" in report["warnings"]


def test_preflight_endpoint_returns_report(monkeypatch):
    monkeypatch.setattr("src.backend_preflight._load_registered_swarms", lambda: [])
    monkeypatch.setattr("src.local_ai_bridge.fusion_status", lambda: {"enabled": True, "courtos_brain_exists": True})
    monkeypatch.setattr(
        "web.routers.health._health_payload",
        lambda: _FakeHealth({"litellm": "up", "deepseek_key": "configured", "mcp_web_search": "up"}),
    )

    with TestClient(app) as client:
        response = client.get("/api/preflight")

    assert response.status_code == 200
    assert response.json()["overallStatus"] == "pass"
    assert response.json()["localAI"]["enabled"] is True


def test_preflight_warns_when_local_ai_bridge_unavailable(monkeypatch):
    monkeypatch.setattr("src.backend_preflight._load_registered_swarms", lambda: [])
    monkeypatch.setattr("src.local_ai_bridge.fusion_status", lambda: {"enabled": False, "courtos_brain_exists": False})
    monkeypatch.setattr(
        "web.routers.health._health_payload",
        lambda: _FakeHealth({"litellm": "up", "deepseek_key": "configured", "mcp_web_search": "up"}),
    )

    report = build_preflight_report()

    assert report["overallStatus"] == "warn"
    assert "local_ai_bridge_unavailable" in report["warnings"]
    assert "courtos_brain_vault_unavailable" in report["warnings"]


def test_score_swarm_case_timeout(monkeypatch):
    def _slow_run(_config_path: str, _task: str) -> str:
        time.sleep(2)
        return "late"

    monkeypatch.setattr(score_swarm, "run_swarm", _slow_run)
    monkeypatch.setattr(score_swarm, "judge", lambda *_args: {"overall": 5})

    case = {"config_path": "config/flow_opc.yaml", "task": "timeout case"}
    try:
        score_swarm.run_case_with_timeout(case, timeout_seconds=1)
    except score_swarm.CaseTimeoutError as exc:
        assert "timed out" in str(exc)
    else:
        raise AssertionError("expected CaseTimeoutError")


def test_storage_aftercare_precheck_blocks_spec_free_liability_judgment():
    task = "客户反馈：户外电源在-20℃环境放电容量只有标称的60%，要求判断是产品缺陷还是使用问题"
    verdict = score_swarm.deterministic_precheck(
        "storage_aftercare",
        task,
        "结论：高概率为正常特性，可能不是缺陷。",
    )

    assert verdict is not None
    assert verdict["irreversible_risk_error"] is True
    assert "规格书" in verdict["reasons"]


def test_storage_aftercare_precheck_blocks_missing_p0_safety_actions():
    task = "深夜紧急工单：青海某100MWh储能电站，3号PACK单体压差告警200mV，温度52℃，客户在现场怀疑热失控趋势"
    verdict = score_swarm.deterministic_precheck(
        "storage_aftercare",
        task,
        "建议持续观察，安排售后明天到场。",
    )

    assert verdict is not None
    assert verdict["irreversible_risk_error"] is True
    assert "P0热风险" in verdict["reasons"]


def test_storage_aftercare_precheck_blocks_hallucinated_model_names():
    verdict = score_swarm.deterministic_precheck(
        "storage_aftercare",
        "客户要求售后诊断",
        "疑似 LFP-25C-280Ah 电芯与 BMS固件版本V1.2.3 不匹配。",
    )

    assert verdict is not None
    assert verdict["irreversible_risk_error"] is True
    assert "虚构" in verdict["reasons"]
