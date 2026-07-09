from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "chaotang_uiux_system"
RUNNER_PATH = HARNESS / "scripts" / "run_uiux.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("chaotang_uiux_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_rules_define_core_surfaces_actions_and_visual_system():
    runner = load_runner()
    rules = runner.load_rules()

    for surface in ["throne_home", "task_execution", "battle_report", "yushi_review", "shiguan_archive"]:
        assert surface in rules["core_surfaces"]
        assert rules["core_surfaces"][surface]["required_elements"]
        assert rules["core_surfaces"][surface]["primary_action"]

    assert rules["action_taxonomy"]["primary"]["max_per_surface"] == 1
    assert rules["action_taxonomy"]["commercial"]["must_be_optional"] is True
    assert "cheap_ancient_texture" in rules["visual_direction"]["prohibited"]
    assert rules["teaching"]["name"] == "钦天监伴读"


def test_golden_cases_pass_expected_levels_and_bad_case_fails():
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_rules())

    assert report["passed"] is True
    assert report["summary"]["cases"] == 5
    assert report["summary"]["valid"] == 4
    assert report["summary"]["invalid"] == 1
    bad = next(item for item in report["results"] if item["case_id"] == "bad_dashboard_data_dump")
    assert bad["valid"] is False
    assert bad["level"] == "L0"


def test_battle_report_requires_optional_commercial_offer_boundaries():
    runner = load_runner()
    rules = runner.load_rules()
    case = next(item for item in runner.load_cases() if item["case_id"] == "battle_report_sacred_edict")
    result = runner.evaluate_case(case, rules)

    assert result.valid is True
    assert result.level == "L5"
    assert result.trust_score == 10
    assert "commercial_trust_pollution" not in result.findings


def test_pay_to_title_offer_is_rejected_as_trust_pollution():
    runner = load_runner()
    rules = runner.load_rules()
    bad = next(item for item in runner.load_cases() if item["case_id"] == "bad_dashboard_data_dump")
    result = runner.evaluate_case(bad, rules)

    assert result.valid is False
    assert "commercial_trust_pollution" in result.findings
    assert "prohibited_teaching_trigger" in result.findings
    assert "too_many_visible_departments" in result.findings


def test_home_surface_keeps_beginner_surface_simple():
    runner = load_runner()
    rules = runner.load_rules()
    case = next(item for item in runner.load_cases() if item["case_id"] == "throne_home_beginner")
    result = runner.evaluate_case(case, rules)

    assert result.valid is True
    assert result.first_view_score == 20
    assert result.action_score == 15
    assert "too_many_visible_departments" not in result.findings


def test_writes_report_and_ledger(tmp_path):
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_rules())
    json_out = tmp_path / "latest.json"
    md_out = tmp_path / "latest.md"
    ledger = tmp_path / "ledger.jsonl"

    runner.write_report(report, json_out, md_out)
    runner.append_ledger(report, ledger)

    assert json.loads(json_out.read_text(encoding="utf-8"))["harness"] == "chaotang_uiux_system"
    assert "朝堂体验契约系统报告" in md_out.read_text(encoding="utf-8")
    assert len(ledger.read_text(encoding="utf-8").splitlines()) == len(report["results"])
