from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "hubu_finance_import_preview.py"
TEMPLATE_DIR = ROOT / "templates" / "hubu_finance_import"


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_hubu_finance_import_preview_cli_help_is_safe():
    result = _run("--help")

    assert result.returncode == 0
    assert "预览户部 CSV 导入总闸结果" in result.stdout
    assert result.stderr == ""


def test_hubu_finance_import_preview_cli_outputs_summary_json():
    result = _run(
        str(TEMPLATE_DIR),
        "--case-id",
        "hubu-cli-001",
        "--title",
        "CLI 导入预览",
        "--period",
        "2026-06",
    )

    assert result.returncode == 0
    body = json.loads(result.stdout)
    data = body["data"]
    assert body["success"] is True
    assert data["caseId"] == "hubu-cli-001"
    assert data["previewOnly"] is True
    assert data["executionAllowed"] is False
    assert data["sideEffects"] == "none"
    assert data["verdict"] == "ready_for_reporting_preview"
    assert data["sourceCoveragePct"] == "1.0000"
    assert data["auditFindingCount"] == 0
    assert data["archiveEligible"] is True
    # fresh 契约:reporting factpack caseId 复用原 caseId,不加 origin 的 "-reporting" 后缀。
    assert data["reportingFactPackCaseId"] == "hubu-cli-001"


def test_hubu_finance_import_preview_cli_full_outputs_reporting_fact_pack():
    result = _run(str(TEMPLATE_DIR), "--case-id", "hubu-cli-002", "--full")

    assert result.returncode == 0
    body = json.loads(result.stdout)
    data = body["data"]
    assert body["success"] is True
    # fresh 契约:同上,reporting factpack caseId 不加 "-reporting" 后缀。
    assert data["reportingFactPack"]["caseId"] == "hubu-cli-002"
    # fresh 契约:货币值统一 2 位小数字符串(与 netIncome "100000.00" 一致),非 origin 的整数串。
    assert data["reportingFactPack"]["trialBalance"]["revenue"] == "800000.00"


def test_hubu_finance_import_preview_cli_returns_2_for_bad_input(tmp_path: Path):
    result = _run(str(tmp_path / "missing"), "--case-id", "bad")

    assert result.returncode == 2
    body = json.loads(result.stderr)
    assert body["success"] is False
    assert body["error"]
