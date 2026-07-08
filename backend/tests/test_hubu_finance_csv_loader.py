from __future__ import annotations

from pathlib import Path

from src.hubu_finance_csv_loader import build_hubu_finance_fact_pack_from_csv
from src.hubu_finance_intake import build_hubu_finance_intake_preview
from src.hubu_financial_reporting import build_hubu_finance_reporting_preview

TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "hubu_finance_import"


def test_hubu_finance_csv_loader_builds_intake_fact_pack_from_templates():
    fact_pack = build_hubu_finance_fact_pack_from_csv(
        TEMPLATE_DIR,
        case_id="hubu-csv-demo-001",
        title="CSV 模板导入演示",
        period="2026-06",
    )

    assert fact_pack["caseId"] == "hubu-csv-demo-001"
    assert fact_pack["dataSources"]["bankStatements"][0]["source"] == {
        "sourceLabel": "internal_uploaded_file",
        "ref": "bank-export-2026-06.xlsx",
    }
    assert fact_pack["dataSources"]["paymentRequests"][0]["invoiceId"] == "invoice-001"
    assert fact_pack["dataSources"]["trialBalance"]["revenue"] == "800000"
    assert fact_pack["dataSources"]["cashFlow"]["cashReceipts"] == "650000"
    assert fact_pack["dataSources"]["trialBalanceSources"]["trialBalance.bank"] == {
        "sourceLabel": "internal_uploaded_file",
        "ref": "bank-export-2026-06.xlsx",
    }


def test_hubu_finance_csv_loader_output_runs_through_intake_and_reporting():
    fact_pack = build_hubu_finance_fact_pack_from_csv(
        TEMPLATE_DIR,
        case_id="hubu-csv-demo-002",
        title="CSV 到户部总闸",
        period="2026-06",
    )

    intake = build_hubu_finance_intake_preview(fact_pack)
    reporting = build_hubu_finance_reporting_preview(intake["reportingFactPack"])

    assert intake["previewOnly"] is True
    assert intake["executionAllowed"] is False
    assert intake["sourceInventory"]["coveragePct"] == "1.0000"
    assert intake["bossBrief"]["verdict"] == "ready_for_reporting_preview"
    assert reporting["statements"]["incomeStatement"]["netIncome"] == "100000.00"
    # 适配 fresh 契约:reporting verdict 词表为 healthy/blocked/watch(src/hubu_financial_reporting.py:318),
    # 非 origin 移植版的 "ready"。fresh 为最新基线,契约以 fresh 为准。
    assert reporting["bossBrief"]["verdict"] == "healthy"
