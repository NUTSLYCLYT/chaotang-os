from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "chaotang_merit_system"
RUNNER_PATH = HARNESS / "scripts" / "run_merit.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("chaotang_merit_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_rules_separate_honor_wallet_and_promotional_ledgers():
    runner = load_runner()
    rules = runner.load_rules()
    currencies = rules["economy"]["currencies"]

    assert currencies["gongye"]["ledger"] == "honor"
    assert currencies["gongye"]["purchasable"] is False
    assert currencies["chaobi"]["purchasable"] is True
    assert currencies["shangyin"]["cash_out"] is False
    assert "user_title" in rules["economy"]["forbidden_purchases"]
    assert "workflow_template" in rules["economy"]["allowed_purchases"]


def test_golden_cases_pass_and_include_policy_notes():
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_rules())

    assert report["passed"] is True
    assert report["summary"]["cases"] == 3
    assert report["summary"]["blocked_economy"] == 1
    assert report["summary"]["commercial_offers"] == 2
    assert "圣君" in report["summary"]["earned_titles"]
    assert any("Mobile app purchases" in note for note in report["policy_notes"])


def test_cannot_buy_titles_scores_or_yushi_approval():
    runner = load_runner()
    rules = runner.load_rules()
    for item_type in ["user_title", "task_score", "yushi_approval", "cash_withdrawal"]:
        decision = runner.evaluate_purchase(
            {"purchase_request": {"item_type": item_type, "currency": "chaobi", "amount": 100}},
            rules,
        )
        assert decision is not None
        assert decision.decision == "block"


def test_yushi_block_zeroes_score_and_merit_even_for_strong_user():
    runner = load_runner()
    case = next(item for item in runner.load_cases() if item["case_id"] == "yushi_blocks_score_purchase")
    result = runner.evaluate_case(case, runner.load_rules())

    assert result.final_score == 0
    assert result.grade == "御史驳回"
    assert result.merit_awarded == {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0}
    assert result.user_title == "中兴之主"
    assert result.commercial_offer is None


def test_paid_services_are_allowed_without_affecting_score():
    runner = load_runner()
    rules = runner.load_rules()
    payload = {
        "run_id": "manual",
        "department": "jinyiwei",
        "score_dimensions": {"result_value": 20, "evidence_quality": 15, "risk_control": 15},
        "yushi_decision": "allow",
        "evidence": [{"source": "watch", "status": "passed"}],
        "purchase_request": {"item_type": "jinyiwei_intel_pack", "currency": "chaobi", "amount": 120},
        "user_state": {"merit": {}, "department_points": {}},
    }

    result = runner.evaluate_case({"case_id": "manual", "payload": payload}, rules)

    assert result.raw_score == 50
    assert result.final_score == 50
    assert result.economy_decision is not None
    assert result.economy_decision["decision"] == "allow"
    assert result.commercial_offer is not None
    assert result.commercial_offer["capability"] == "jinyiwei_intel_pack"
    assert result.commercial_offer["value_metric"] == "opportunity_discovery"
    assert "不影响评分" in result.commercial_offer["principle"]
    assert result.grade == "御史驳回"


def test_merit_report_embeds_commercial_offer_from_business_model():
    runner = load_runner()
    case = next(item for item in runner.load_cases() if item["case_id"] == "hubu_roi_unlocks_paid_review")
    result = runner.evaluate_case(case, runner.load_rules())

    assert result.commercial_offer is not None
    assert result.commercial_offer["capability"] == "red_team_review"
    assert result.commercial_offer["configured_cost"] == 220
    assert result.commercial_offer["visible_feedback"] == "红蓝对抗完成，发现可修正弱点。"


def test_writes_report_and_ledger(tmp_path):
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_rules())
    json_out = tmp_path / "latest.json"
    md_out = tmp_path / "latest.md"
    ledger = tmp_path / "ledger.jsonl"

    runner.write_report(report, json_out, md_out)
    runner.append_ledger(report, ledger)

    assert json.loads(json_out.read_text(encoding="utf-8"))["harness"] == "chaotang_merit_system"
    assert "朝堂功业系统报告" in md_out.read_text(encoding="utf-8")
    assert len(ledger.read_text(encoding="utf-8").splitlines()) == len(report["results"])
