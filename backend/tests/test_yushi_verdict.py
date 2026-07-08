"""tests/test_yushi_verdict.py — 御史封驳/放行书(诸司能力核查挖出的洞)。

harness/yushi_global_gate/scripts/run_gate.py 是真实、测过的四维确定性门禁,但从来没有
任何 build_court_doc(dept="yushi") 的生产调用方。这里薄包装接上,court 全套已验证的
架构套路(System A),不碰 run_gate 原生消费方(harness/chaotang_department_protocol,System B)。
"""
from __future__ import annotations

import importlib
import json
from pathlib import Path

from fastapi.testclient import TestClient

from src.yushi_verdict import build_yushi_review

app = importlib.import_module("web.main").app
client = TestClient(app)

_GOLDEN_CASES = Path(__file__).resolve().parent.parent / "harness" / "yushi_global_gate" / "golden_cases" / "global_gate_cases.json"


def test_all_golden_cases_light_matches_gate_risk_level():
    """run_gate.py 自带的 6 个 golden case,逐条验证桥接后 light 跟原始 risk_level 一致。
    这条测试就是踩过真坑写的:第一版实现里 red/black 被 compute_light 误判降级成 yellow
    (因为无脑把 condition 塞进 fix,court_doc_builder"红且有解→黄"的口径把硬拦截看成了软建议)。
    """
    cases = json.loads(_GOLDEN_CASES.read_text(encoding="utf-8"))
    assert len(cases) >= 6   # 别让这条测试因为 golden case 文件被清空而悄悄失去意义
    for case in cases:
        doc = build_yushi_review(case["payload"], archive=False)
        assert doc["light"] == case["expect"]["risk_level"], (
            f"{case['case_id']}: 期望 {case['expect']['risk_level']},实得 {doc['light']}"
        )


def test_black_risk_forces_escalate_black_flag():
    payload = {"run_id": "t1", "department": "gongbu", "output_type": "dependency_security",
               "summary": "高危漏洞", "security_status": "poc_needs_review",
               "finding_summary": {"affected_packages": 7, "vulnerability_groups": 33, "max_severity": 9.8},
               "evidence": [{"source": "osv-scanner", "status": "poc_needs_review"}],
               "benefit_score": 4.8, "automation_level_requested": "L2"}
    doc = build_yushi_review(payload, archive=False)
    assert doc["light"] == "black"
    assert "高危拦截" in doc["headline"]


def test_red_findings_do_not_carry_a_downgrade_fix():
    """red/black 级别的 finding 不该塞 fix(那会被 compute_light 读成"有解降黄")。"""
    payload = {"run_id": "t2", "department": "hubu", "output_type": "customer_commitment",
               "summary": "客户报价 800 万,承诺 30 天交付。", "evidence": [],
               "benefit_score": 3.8, "automation_level_requested": "L1", "human_signoff": False}
    doc = build_yushi_review(payload, archive=False)
    red_items = [it for it in doc["items"] if it["level"] == "red"]
    assert red_items and all(not it["fix"] for it in red_items)
    assert doc["light"] == "red"   # 没被误降级成 yellow


def test_clean_payload_is_green_and_grounded():
    doc = build_yushi_review({
        "run_id": "t3", "department": "gongbu", "output_type": "dependency_security",
        "summary": "扫描通过", "security_status": "poc_passed",
        "finding_summary": {"affected_packages": 0, "vulnerability_groups": 0, "max_severity": 0},
        "evidence": [{"source": "osv-scanner", "status": "ok"}],
        "benefit_score": 4.4, "automation_level_requested": "L2",
    }, archive=False)
    assert doc["light"] == "green"
    assert doc["provenance"]["gate"] == "passed"
    assert doc["provenance"]["deterministic_gated"] is True
    assert doc["seal"]["stamp"] == "獬豸印" and doc["seal"]["color"] == "黑金"


def test_advisors_match_dept_design_doc():
    """docs/dept_design/yushi.md §三:判官(posner/schneier/andy-grove-perspective)+
    顾问(deming/charity-majors/wang-yangming),不进 light,只进 provenance。
    """
    doc = build_yushi_review({"run_id": "t4", "department": "gongbu",
                              "output_type": "dependency_security", "summary": "x"}, archive=False)
    assert doc["provenance"]["advisors"] == [
        "richard-posner", "bruce-schneier", "andy-grove-perspective",
        "deming", "charity-majors", "wang-yangming",
    ]


def test_review_endpoint_end_to_end():
    r = client.post("/api/yushi/review", json={
        "run_id": "e2e-1", "department": "gongbu", "output_type": "dependency_security",
        "summary": "扫描通过", "security_status": "poc_passed",
        "finding_summary": {"affected_packages": 0, "vulnerability_groups": 0, "max_severity": 0},
        "evidence": [{"source": "osv-scanner", "status": "ok"}],
        "benefit_score": 4.4, "automation_level_requested": "L2",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["dept"] == "yushi" and body["data"]["light"] == "green"


def test_review_endpoint_rejects_missing_department():
    r = client.post("/api/yushi/review", json={"summary": "x"})
    body = r.json()
    assert body["success"] is False
    assert "department" in body["error"]
