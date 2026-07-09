from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "yushi_global_gate"
RUNNER_PATH = HARNESS / "scripts" / "run_gate.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("yushi_global_gate_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_golden_cases_match_expected_decisions():
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_rules())

    assert report["passed"] is True
    assert report["summary"]["black"] >= 2
    assert report["summary"]["red"] >= 2
    assert report["summary"]["green"] >= 2


def test_dependency_security_black_when_max_severity_is_critical():
    runner = load_runner()
    card = runner.evaluate_payload(
        {
            "run_id": "dep",
            "department": "gongbu",
            "output_type": "dependency_security",
            "security_status": "poc_needs_review",
            "finding_summary": {"max_severity": 9.8},
            "evidence": [{"source": "osv", "status": "poc_needs_review"}],
            "benefit_score": 4,
            "automation_level_requested": "L2",
        }
    )

    assert card.risk_level == "black"
    assert card.decision == "block_and_escalate"
    assert card.red_team_required is True
    assert any(finding["rule_id"] == "dependency_security.max_severity_black" for finding in card.findings)


def test_customer_commitment_without_signoff_is_blocked():
    runner = load_runner()
    card = runner.evaluate_payload(
        {
            "run_id": "quote",
            "department": "hubu",
            "output_type": "customer_commitment",
            "summary": "报价 100 万，承诺 30 天交付。",
            "evidence": [{"source": "crm", "status": "draft"}],
            "human_signoff": False,
            "automation_level_requested": "L1",
        }
    )

    assert card.risk_level == "red"
    assert card.decision == "block"
    assert card.next_gate == "human_signoff"


def test_high_automation_without_qintianjian_is_black():
    runner = load_runner()
    card = runner.evaluate_payload(
        {
            "run_id": "auto",
            "department": "junji",
            "output_type": "automation",
            "summary": "自动执行生产删除任务。",
            "evidence": [{"source": "operator", "status": "requested"}],
            "automation_level_requested": "L5",
            "qintianjian_brief": False,
            "human_signoff": False,
        }
    )

    assert card.risk_level == "black"
    assert card.decision == "block_and_escalate"
    assert card.next_gate == "qintianjian_brief"


def test_ungrounded_numbers_are_yellow_or_red_by_stakes():
    runner = load_runner()
    low = runner.evaluate_payload(
        {
            "run_id": "number-low",
            "department": "shiguan",
            "summary": "本轮节省 20 分钟。",
            "evidence": [],
            "automation_level_requested": "L0",
        }
    )
    high = runner.evaluate_payload(
        {
            "run_id": "number-high",
            "department": "hubu",
            "summary": "客户报价 800 万。",
            "evidence": [],
            "automation_level_requested": "L0",
        }
    )

    assert low.risk_level == "yellow"
    assert high.risk_level == "red"


def test_experience_drift_is_blocked_from_backend_mainline():
    runner = load_runner()
    card = runner.evaluate_payload(
        {
            "run_id": "experience",
            "department": "gongbu",
            "summary": "新增体验实现的交互样式。",
            "changed_paths": ["backend/src/experience_surface.py"],
            "automation_level_requested": "L1",
        }
    )

    assert card.risk_level == "red"
    assert card.next_gate == "yushi_drift_monitor"


def test_writes_report_and_ledger(tmp_path):
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_rules())
    json_out = tmp_path / "latest.json"
    md_out = tmp_path / "latest.md"
    ledger = tmp_path / "ledger.jsonl"

    runner.write_report(report, json_out, md_out)
    runner.append_ledger(report, ledger)

    stored = json.loads(json_out.read_text(encoding="utf-8"))
    assert stored["harness"] == "yushi_global_gate"
    assert "御史总判报告" in md_out.read_text(encoding="utf-8")
    assert len(ledger.read_text(encoding="utf-8").splitlines()) == len(report["results"])
