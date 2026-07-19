from __future__ import annotations

import json
from pathlib import Path

from src.chaotang_department_router import department_system_payload, route_department_task


ROOT = Path(__file__).resolve().parents[1]
ROUTE_CASES = ROOT / "harness" / "chaotang_department_protocol" / "golden_cases" / "department_routes.json"


def test_department_system_payload_is_frontend_ready():
    payload = department_system_payload()

    assert payload["summary"]["sixMinistryCount"] == 6
    assert payload["summary"]["geniusReadyCount"] == 6
    assert payload["dashboardSummary"]["routeEndpoint"] == "/api/chaotang/department-system/route"
    assert payload["dashboardSummary"]["readiness"]["sixMinistriesReady"] == 6
    assert payload["dashboardSummary"]["readiness"]["routeGate"] == "department_routes"
    assert len(payload["routingPlaybook"]) == 6
    ministries = {item["code"]: item for item in payload["sixMinistries"]}
    playbook = {item["code"]: item for item in payload["routingPlaybook"]}
    assert "bingbu" in ministries
    assert "storage_aftercare" in ministries["bingbu"]["callsSwarms"]
    assert playbook["bingbu"]["firstSwarm"] == "haolong"
    assert "storage_aftercare" in playbook["bingbu"]["callsSwarms"]
    assert all(item["advisorLenses"] for item in payload["routingPlaybook"])
    assert all(item["harnessGate"] for item in payload["routingPlaybook"])
    assert ministries["gongbu"]["advisorLenses"]
    assert payload["topAdvisorDesign"]["rules"]


def test_department_system_payload_spreads_practical_doctrine_to_all_ministries():
    payload = department_system_payload()

    doctrine = payload["practicalOperatingDoctrine"]
    assert doctrine["name"] == "实用闭环铁律"
    assert "老板可选动作" in doctrine["bossFacingShape"]
    assert any("needs_evidence" in rule for rule in doctrine["rules"])
    assert any("不直接自动付款" in rule for rule in doctrine["rules"])
    assert payload["dashboardSummary"]["operatingDoctrine"] == doctrine

    for item in payload["routingPlaybook"]:
        assert item["operatingDoctrine"] == doctrine
        assert any("next_action" in rule for rule in item["operatingDoctrine"]["rules"])


def test_department_system_payload_has_persona_and_execution_visualization():
    payload = department_system_payload()

    prototypes = {item["code"]: item for item in payload["personaPrototypes"]}
    assert len(prototypes) == 6
    assert prototypes["bingbu"]["historicalPrototype"]
    assert prototypes["bingbu"]["modernPrototype"]
    assert prototypes["bingbu"]["skillPath"].endswith("/SKILL.md")
    assert prototypes["bingbu"]["soulPath"].endswith("/soul.md")
    assert prototypes["bingbu"]["userPath"].endswith("/user.md")
    assert prototypes["xingbu"]["safetyBoundary"]
    assert len(payload["executionVisualization"]["stages"]) >= 6
    assert payload["executionVisualization"]["pulseMetric"] == "visible_agent_work"

    for persona in prototypes.values():
        for key in ("skillPath", "soulPath", "userPath"):
            path = ROOT / persona[key]
            assert path.exists(), f"{persona['code']} missing {key}"
            text = path.read_text(encoding="utf-8")
            assert "边界" in text
            assert "输出" in text or "交付" in text


def test_department_system_payload_has_ordered_genius_experience_modules():
    payload = department_system_payload()

    modules = payload["geniusExperienceModules"]
    assert [item["module"] for item in modules] == [
        "live_war_report",
        "advisor_review_panel",
        "memory_replay",
        "forecast_sandbox",
    ]
    assert [item["order"] for item in modules] == [1, 2, 3, 4]
    for module in modules:
        assert module["title"]
        assert module["status"] in {"ready", "running"}
        assert module["principle"]
        assert module["next_action"]
        assert module["harness_gate"].startswith("chaotang_department_personas.")

    live_report = modules[0]
    assert len(live_report["events"]) >= 6
    assert live_report["events"][0]["actor"] == "qintianjian"
    advisor = modules[1]
    assert {item["stance"] for item in advisor["advisors"]} >= {"赞成", "反对", "漏洞", "天才建议"}
    memory = modules[2]
    assert {item["type"] for item in memory["memory_cards"]} >= {"success_pattern", "failure_signal"}
    forecast = modules[3]
    assert len(forecast["scenarios"]) == 3
    assert all(item["trigger"] for item in forecast["scenarios"])


def test_department_route_golden_cases():
    cases = json.loads(ROUTE_CASES.read_text(encoding="utf-8"))
    assert len(cases) >= 4

    for case in cases:
        result = route_department_task(case["task"])
        expected = case["expect"]
        candidate_codes = {item["code"] for item in result["candidateDepartments"]}
        primary_swarms = set(result["primaryDepartment"]["callsSwarms"])

        assert result["primaryDepartment"]["code"] == expected["primary_department"], case["case_id"]
        assert set(expected["candidate_departments"]).issubset(candidate_codes), case["case_id"]
        assert set(expected["required_swarms"]).issubset(primary_swarms), case["case_id"]
        assert result["primeMinisterNextStep"]["owner"] == expected["primary_department"]
        assert result["qintianjianTrigger"]["signal"]
        assert result["yushiGateHint"]


def test_component_safety_terms_keep_gongbu_in_mixed_department_route():
    result = route_department_task("合同要求电芯析锂后仍继续运行")
    candidate_codes = {item["code"] for item in result["candidateDepartments"]}

    assert "xingbu" in candidate_codes
    assert "gongbu" in candidate_codes
