from __future__ import annotations

import copy
import json
from pathlib import Path

from fastapi.testclient import TestClient

from src.hubu_finance_intake import build_hubu_finance_intake_preview
from src.hubu_financial_reporting import build_hubu_finance_reporting_preview


FIXTURE = Path(__file__).parent / "fixtures" / "hubu_finance_intake_fact_pack.json"


def _case() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def test_finance_intake_preview_generates_reporting_fact_pack():
    preview = build_hubu_finance_intake_preview(_case())

    assert preview["previewOnly"] is True
    assert preview["executionAllowed"] is False
    assert preview["sideEffects"] == "none"
    assert preview["sourceInventory"]["coveragePct"] == "1.0000"
    assert preview["matching"]["matchedCount"] == 1
    assert preview["bankReconciliation"]["cashReceipts"] == "800000.00"
    assert preview["bankReconciliation"]["cashPayments"] == "90000.00"
    assert preview["bossBrief"]["verdict"] == "ready_for_reporting_preview"
    assert preview["archiveDraft"]["archiveEligible"] is True

    reporting = build_hubu_finance_reporting_preview(preview["reportingFactPack"])
    assert reporting["previewOnly"] is True
    assert reporting["executionAllowed"] is False
    assert reporting["statements"]["incomeStatement"]["netIncome"] == "100000.00"
    assert reporting["statements"]["balanceSheet"]["balanceCheckDelta"] == "0.00"


def test_finance_intake_flags_unknown_sources_and_unmatched_payment():
    case = _case()
    case["dataSources"]["bankStatements"][0]["source"] = {"sourceLabel": "unknown", "ref": "chat"}
    case["dataSources"]["invoices"][0]["source"] = {"sourceLabel": "unknown", "ref": "chat"}
    case["dataSources"]["paymentRequests"][0]["invoiceId"] = "missing-invoice"

    preview = build_hubu_finance_intake_preview(case)
    finding_ids = {item["id"] for item in preview["auditFindings"]}

    assert "source_coverage_low" in finding_ids
    assert "payment_request_unmatched" in finding_ids
    assert preview["bossBrief"]["verdict"] == "needs_evidence"
    assert preview["archiveDraft"]["archiveEligible"] is False


def test_finance_intake_flags_bank_reconciliation_gap_and_overdue_ar():
    case = _case()
    case["dataSources"]["bankStatements"].append(
        {
            "id": "bank-003",
            "date": "2026-06-18",
            "direction": "out",
            "amount": 120000,
            "counterparty": "未知供应商",
            "balanceAfter": 1020000,
            "source": {"sourceLabel": "internal_uploaded_file", "ref": "bank-export-2026-06.xlsx"},
        }
    )
    case["dataSources"]["receivables"][0]["daysOutstanding"] = 120

    preview = build_hubu_finance_intake_preview(case)
    finding_ids = {item["id"] for item in preview["auditFindings"]}

    assert "bank_reconciliation_gap" in finding_ids
    assert "ar_aging_over_90" in finding_ids


def test_finance_intake_preview_endpoint_returns_contract(monkeypatch):
    client = _client(monkeypatch)

    response = client.post("/api/chaotang/hubu/finance/intake/preview", json=_case())

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["previewOnly"] is True
    assert data["executionAllowed"] is False
    assert data["sideEffects"] == "none"
    assert data["reportingFactPack"]["caseId"] == "hubu-intake-demo-001"


def test_finance_intake_preview_endpoint_rejects_missing_data_sources(monkeypatch):
    client = _client(monkeypatch)
    case = copy.deepcopy(_case())
    case.pop("dataSources")

    response = client.post("/api/chaotang/hubu/finance/intake/preview", json=case)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "dataSources" in body["error"]
