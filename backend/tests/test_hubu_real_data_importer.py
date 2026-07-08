from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

import pytest

Workbook = pytest.importorskip(
    "openpyxl"
).Workbook  # 可选依赖:无 openpyxl 时整文件跳过,不崩收集

from src.hubu_finance_csv_loader import build_hubu_finance_fact_pack_from_csv
from src.hubu_finance_intake import build_hubu_finance_intake_preview
from src.hubu_real_data_importer import (
    build_hubu_real_data_import_workspace,
    build_trial_balance_from_account_export,
    extract_purchase_contract_rows,
)

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "hubu_real_data_import_preview.py"


def _write_balance_sheet(path: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "第一页"
    sheet.append(["", "发生额及余额表"])
    sheet.append(["", "期间:", "2025.01 - 2025.12"])
    sheet.append(
        [
            "",
            "科目类别",
            "科目编码",
            "科目名称",
            "期初余额",
            "",
            "本期发生",
            "",
            "期末余额",
            "",
        ]
    )
    sheet.append(["", "", "", "", "借方", "贷方", "借方", "贷方", "借方", "贷方"])
    rows = [
        ["", "资产", "1001", "库存现金", 100, None, 20, 10, 110, None],
        ["", "资产", "1002", "银行存款", 200, None, 500, 300, 400, None],
        ["", "资产", "1122", "应收账款", 0, None, 1000, 200, 800, None],
        ["", "资产", "1403", "原材料", 0, None, 700, 100, 600, None],
        ["", "资产", "1405", "库存商品", 0, None, 300, 50, 250, None],
        ["", "资产", "1601", "固定资产", 0, None, 1000, 0, 1000, None],
        ["", "资产", "1602", "累计折旧", None, 0, 0, 200, None, 200],
        ["", "负债", "2001", "短期借款", None, 0, 100, 900, None, 800],
        ["", "负债", "2202", "应付账款", None, 0, 60, 660, None, 600],
        ["", "权益", "3001", "实收资本", None, 0, 0, 1000, None, 1000],
        ["", "权益", "3002", "资本公积", None, 0, 0, 200, None, 200],
        ["", "权益", "3104", "利润分配", 50, None, 0, 0, 50, None],
        ["", "损益", "5001", "主营业务收入", None, None, 3000, 3000, None, None],
        ["", "损益", "5301", "营业外收入", None, None, 10, 10, None, None],
        ["", "损益", "5401", "主营业务成本", None, None, 1200, 1200, None, None],
        ["", "损益", "5403", "税金及附加", None, None, 30, 30, None, None],
        ["", "损益", "5601", "销售费用", None, None, 100, 100, None, None],
        ["", "损益", "5602", "管理费用", None, None, 200, 200, None, None],
        ["", "损益", "5603", "财务费用", None, None, 40, 40, None, None],
    ]
    for row in rows:
        sheet.append(row)
    workbook.save(path)


def _write_procurement_ledger(path: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "采购合同台账"
    sheet.append(["采购合同台账"])
    sheet.append(["", "合同编号", "供应商名称", "品名", "合同金额", "付款方式"])
    sheet.append([1, "MS-PU-001", "供应商A", "电芯", 1200, "预付"])
    sheet.append([2, "MS-PU-002", "供应商B", "保护板", 800, "月结"])
    sheet.append([3, "", "供应商C", "空合同", 999, ""])
    workbook.save(path)


def _read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_build_trial_balance_from_account_export_maps_expected_accounts(tmp_path: Path):
    balance = tmp_path / "balance.xlsx"
    _write_balance_sheet(balance)

    trial = build_trial_balance_from_account_export(balance)

    assert trial["revenue"] == 3010
    assert trial["costOfRevenue"] == 1200
    assert trial["cash"] == 110
    assert trial["bank"] == 400
    assert trial["inventory"] == 850
    assert trial["fixedAssets"] == 800
    assert trial["accountsPayable"] == 600
    assert trial["shortTermDebt"] == 800


def test_extract_purchase_contract_rows_reads_contract_ledger(tmp_path: Path):
    ledger = tmp_path / "procurement.xlsx"
    _write_procurement_ledger(ledger)

    rows = extract_purchase_contract_rows(ledger)

    assert [row["id"] for row in rows] == ["MS-PU-001", "MS-PU-002"]
    assert rows[0]["amount"] == "1200.00"
    assert rows[0]["sourceLabel"] == "internal_uploaded_file"


def test_build_hubu_real_data_import_workspace_generates_safe_csvs_and_preview(
    tmp_path: Path,
):
    balance = tmp_path / "balance.xlsx"
    ledger = tmp_path / "procurement.xlsx"
    output = tmp_path / "hubu_real_import"
    _write_balance_sheet(balance)
    _write_procurement_ledger(ledger)

    result = build_hubu_real_data_import_workspace(
        balance_sheet_path=balance,
        procurement_ledger_path=ledger,
        output_dir=output,
    )
    fact_pack = build_hubu_finance_fact_pack_from_csv(
        output,
        case_id="hubu-real-test",
        title="real test",
        period="2025",
    )
    preview = build_hubu_finance_intake_preview(fact_pack)

    assert result.contract_rows == 2
    assert _read_csv(output / "trial_balance.csv")[0]["revenue"] == "3010.00"
    assert (
        _read_csv(output / "receivables.csv")[0]["counterparty"]
        == "aggregate_accounts_receivable"
    )
    assert _read_csv(output / "contracts.csv")[0]["counterparty"] == "供应商A"
    assert preview["previewOnly"] is True
    assert preview["executionAllowed"] is False
    assert preview["sideEffects"] == "none"
    assert preview["bossBrief"]["verdict"] == "ready_for_reporting_preview"


def test_build_hubu_real_data_import_workspace_refuses_repo_output_outside_local_data(
    tmp_path: Path,
):
    balance = tmp_path / "balance.xlsx"
    _write_balance_sheet(balance)

    with pytest.raises(ValueError, match="local_data"):
        build_hubu_real_data_import_workspace(
            balance_sheet_path=balance,
            output_dir=ROOT / "templates" / "bad_real_data",
        )


def test_hubu_real_data_import_preview_cli_generates_csv_and_runs_preview(
    tmp_path: Path,
):
    balance = tmp_path / "balance.xlsx"
    ledger = tmp_path / "procurement.xlsx"
    output = tmp_path / "cli_output"
    _write_balance_sheet(balance)
    _write_procurement_ledger(ledger)

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--balance-sheet",
            str(balance),
            "--procurement-ledger",
            str(ledger),
            "--output-dir",
            str(output),
            "--case-id",
            "hubu-cli-real",
            "--period",
            "2025",
            "--preview",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0
    body = json.loads(result.stdout)
    assert body["success"] is True
    assert body["data"]["prepared"]["contractRows"] == 2
    assert body["data"]["preview"]["verdict"] == "ready_for_reporting_preview"
    assert body["data"]["preview"]["executionAllowed"] is False
