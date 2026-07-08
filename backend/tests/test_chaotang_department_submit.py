from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from src.chaotang_department_payload import (
    build_security_poc_payload,
    build_text_payload,
    normalize_department,
)


ROOT = Path(__file__).resolve().parents[1]


def test_normalizes_chinese_department_names():
    assert normalize_department("钦天监") == "qintianjian"
    assert normalize_department("工部") == "gongbu"
    assert normalize_department("锦衣卫") == "jinyiwei"


def test_build_text_payload_infers_contract_fields():
    payload = build_text_payload(
        department="户部",
        summary="客户报价 800 万，需要人工复核。",
        evidence=[],
        run_id="submit-test",
    )

    assert payload["run_id"] == "submit-test"
    assert payload["department"] == "hubu"
    assert payload["output_type"] == "quotation"
    assert payload["automation_level_requested"] == "L1"
    assert payload["benefit_score"] > 0
    assert payload["next_action"]


def test_build_security_poc_payload_from_report(tmp_path):
    report = {
        "generated_at": "2026-06-07T00:00:00+00:00",
        "results": [
            {
                "name": "osv-scanner",
                "status": "poc_passed",
                "evidence": [
                    {
                        "phase": "poc",
                        "finding_summary": {"affected_packages": 0, "vulnerability_groups": 0, "max_severity": 0},
                    }
                ],
            }
        ],
    }
    path = tmp_path / "security_poc.json"
    path.write_text(json.dumps(report), encoding="utf-8")

    payload = build_security_poc_payload(path, run_id="security-submit")

    assert payload["run_id"] == "security-submit"
    assert payload["department"] == "gongbu"
    assert payload["output_type"] == "dependency_security"
    assert payload["security_status"] == "poc_passed"
    assert payload["finding_summary"]["max_severity"] == 0


def test_submit_cli_routes_text_payload(tmp_path):
    json_out = tmp_path / "submit.json"
    md_out = tmp_path / "submit.md"
    ledger = tmp_path / "ledger.jsonl"
    cmd = [
        sys.executable,
        "scripts/chaotang_department_submit.py",
        "--department",
        "工部",
        "--summary",
        "归档内部任务结果，证据完整。",
        "--evidence",
        "unit-test=ok",
        "--run-id",
        "cli-submit",
        "--json-out",
        str(json_out),
        "--md-out",
        str(md_out),
        "--ledger",
        str(ledger),
    ]

    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)

    assert proc.returncode == 0, proc.stderr
    stored = json.loads(json_out.read_text(encoding="utf-8"))
    assert stored["passed"] is True
    assert stored["results"][0]["next_department"] in {"shiguan", "yushi"}
    assert ledger.exists()
