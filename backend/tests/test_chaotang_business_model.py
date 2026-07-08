from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "chaotang_business_model"
RUNNER_PATH = HARNESS / "scripts" / "run_business_model.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("chaotang_business_model_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_pricing_ladder_has_consumer_team_and_enterprise_cash_flow():
    runner = load_runner()
    model = runner.load_model()

    assert model["segments"]["pro"]["monthly_cny"] == 128
    assert model["segments"]["max"]["monthly_cny"] > model["segments"]["pro"]["monthly_cny"]
    assert model["segments"]["team"]["seats_min"] >= 5
    assert model["segments"]["enterprise"]["annual_cny"] >= 198000
    assert model["cash_flow_targets"]["month_12"]["target_mrr_cny"] >= 500000


def test_forbidden_monetization_blocks_trust_pollution():
    runner = load_runner()
    model = runner.load_model()

    for capability in ["user_title", "task_score", "yushi_approval", "verified_roi", "cash_withdrawal"]:
        decision, reasons = runner.evaluate_purchase(
            {"purchase": {"capability": capability, "currency": "chaobi", "amount": 1000}},
            model,
        )
        assert decision == "block"
        assert "forbidden_monetization_preserves_trust" in reasons


def test_paid_capabilities_require_visible_feedback_and_value_metric():
    runner = load_runner()
    model = runner.load_model()
    payload = {
        "purchase": {"capability": "red_team_review", "currency": "chaobi", "amount": 220},
        "battle_report": {
            "visible_feedback": "红蓝对抗完成，发现可修正弱点。",
            "next_action": "fix_weaknesses",
            "value_metric": "blocked_failure_modes",
            "trigger": "risk_found",
        },
    }

    assert runner.evaluate_purchase(payload, model)[0] == "allow"
    assert runner.evaluate_delight(payload, model)[0] == "pass"


def test_dark_pattern_trigger_fails_delight_even_if_purchase_blocked():
    runner = load_runner()
    case = next(item for item in runner.load_cases() if item["case_id"] == "blocked_pay_to_buy_title")
    result = runner.evaluate_case(case, runner.load_model())

    assert result.purchase_decision == "block"
    assert result.delight_decision == "fail"
    assert result.passed is True


def test_golden_cases_pass_and_investor_story_is_ready():
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_model())

    assert report["passed"] is True
    assert report["summary"]["blocked_purchases"] == 1
    assert report["summary"]["investor_ready"] is True
    assert "AI 朝堂 OS" in report["investor_headline"]
    assert len(report["latest_references"]) >= 4


def test_writes_report_and_ledger(tmp_path):
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_model())
    json_out = tmp_path / "latest.json"
    md_out = tmp_path / "latest.md"
    ledger = tmp_path / "ledger.jsonl"

    runner.write_report(report, json_out, md_out)
    runner.append_ledger(report, ledger)

    assert json.loads(json_out.read_text(encoding="utf-8"))["harness"] == "chaotang_business_model"
    assert "朝堂商业模式圆桌报告" in md_out.read_text(encoding="utf-8")
    assert len(ledger.read_text(encoding="utf-8").splitlines()) == len(report["results"])
