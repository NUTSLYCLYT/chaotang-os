from __future__ import annotations

import copy
import json
from pathlib import Path

from fastapi.testclient import TestClient

from src.hubu_financial_reporting import (
    build_hubu_finance_reporting_decision_preview,
    build_hubu_finance_reporting_preview,
)


FIXTURE = Path(__file__).parent / "fixtures" / "hubu_finance_reporting_fact_pack.json"


def _case() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def test_finance_reporting_preview_generates_side_effect_free_statements():
    preview = build_hubu_finance_reporting_preview(_case())

    assert preview["previewOnly"] is True
    assert preview["executionAllowed"] is False
    assert preview["sideEffects"] == "none"
    assert preview["officeChain"] == ["accounting", "audit", "reporting", "financing_materials", "archive_draft"]
    assert preview["reportingPeriod"] == "2026-06"
    assert preview["statements"]["incomeStatement"]["netIncome"] == "100000.00"
    assert preview["statements"]["balanceSheet"]["balanceCheckDelta"] == "0.00"
    assert preview["statements"]["cashFlowStatement"]["endingCash"] == "500000.00"
    assert preview["bossBrief"]["verdict"] == "healthy"
    assert preview["decisionActions"]["primaryAction"] == "archive_preview"
    assert "prepare_financing_materials" in preview["decisionActions"]["allowedActions"]
    assert preview["archiveDraft"]["archiveMode"] == "draft_only"
    assert preview["archiveDraft"]["archiveEligible"] is True
    assert preview["loanApplicationDraft"]["manualReviewRequired"] is True
    assert preview["formattedMemorial"]["section_order"] == [
        "圣裁",
        "分奏",
        "财务报表",
        "证据",
        "风险",
        "后令",
        "质门",
        "来源",
    ]
    assert "【财务报表】" in preview["formattedMemorial"]["text"]
    assert "利润表" in preview["formattedMemorial"]["sections"]["财务报表"]
    assert "资产负债表" in preview["formattedMemorial"]["sections"]["财务报表"]
    assert "现金流量表" in preview["formattedMemorial"]["sections"]["财务报表"]


def test_finance_reporting_preview_blocks_unbalanced_statement():
    case = _case()
    case["trialBalance"]["retainedEarningsOpening"] = 1

    preview = build_hubu_finance_reporting_preview(case)

    assert preview["bossBrief"]["verdict"] == "blocked"
    assert preview["decisionActions"]["primaryAction"] == "return_for_audit_review"
    assert "archive_preview" in preview["decisionActions"]["blockedActions"]
    assert preview["archiveDraft"]["archiveEligible"] is False
    assert any(item["id"] == "balance_sheet_not_balanced" for item in preview["auditFindings"])


def test_finance_reporting_preview_detects_source_label_gap_and_payment_risks():
    case = _case()
    case["sources"]["trialBalance.bank"] = {"sourceLabel": "unknown", "ref": "manual-chat"}
    case["auditInputs"]["payments"].append(
        {"id": "pay-002", "amount": 90000, "contractId": "contract-001", "invoiceId": "inv-001"}
    )
    case["auditInputs"]["payments"].append({"id": "pay-003", "amount": 30000, "contractId": "", "invoiceId": ""})

    preview = build_hubu_finance_reporting_preview(case)
    finding_ids = {item["id"] for item in preview["auditFindings"]}

    assert "source_label_gap" in finding_ids
    assert "duplicate_payment_risk" in finding_ids
    assert "payment_missing_invoice_or_contract" in finding_ids
    assert "budget_overrun_risk" in finding_ids
    assert preview["archiveDraft"]["archiveEligible"] is False


def test_finance_reporting_decision_preview_accepts_clean_archive_action():
    receipt = build_hubu_finance_reporting_decision_preview(
        _case(),
        {"action": "archive_preview", "decidedBy": "boss", "reason": "报表预览可入史馆草稿"},
    )

    assert receipt["previewOnly"] is True
    assert receipt["executionAllowed"] is False
    assert receipt["sideEffects"] == "none"
    assert receipt["decisionReceipt"]["accepted"] is True
    assert receipt["decisionReceipt"]["action"] == "archive_preview"
    assert receipt["decisionReceipt"]["nextState"] == "archive_draft_ready"


def test_finance_reporting_decision_preview_rejects_archive_when_audit_blocks():
    case = _case()
    case["trialBalance"]["retainedEarningsOpening"] = 1

    try:
        build_hubu_finance_reporting_decision_preview(
            case,
            {"action": "archive_preview", "decidedBy": "boss"},
        )
    except ValueError as exc:
        assert "不允许" in str(exc)
    else:
        raise AssertionError("blocked reporting preview must reject archive_preview")


def test_finance_reporting_preview_endpoint_returns_contract(monkeypatch):
    client = _client(monkeypatch)

    response = client.post("/api/chaotang/hubu/finance/reporting/preview", json=_case())

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["previewOnly"] is True
    assert data["executionAllowed"] is False
    assert data["sideEffects"] == "none"
    assert data["statements"]["incomeStatement"]["grossProfit"] == "280000.00"
    assert data["decisionActions"]["buttonLabels"]["archive_preview"] == "存入史馆草稿"
    assert data["financingMaterials"]["fundingNeed"] == "0.00"
    assert "【质门】" in data["formattedMemorial"]["text"]


def test_shangshufang_finance_reporting_loop_requests_jinyiwei_evidence_without_fact_pack(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/api/shangshufang/finance-reporting-loop",
        json={"command": "密旨：请户部查看本月财务报表", "mode": "secret"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["mode"] == "secret"
    assert data["stage"] == "awaiting_jinyiwei_evidence"
    assert data["done"] is False
    assert data["collectionChecklist"]
    assert "锦衣卫" in data["formattedMemorial"]["sections"]["分奏"]
    assert "【财务报表】" in data["formattedMemorial"]["text"]


def test_shangshufang_finance_reporting_loop_returns_statements_with_fact_pack(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/api/shangshufang/finance-reporting-loop",
        json={"command": "下旨：请户部查看本月财务报表", "mode": "order", "fact_pack": _case()},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["mode"] == "order"
    assert data["stage"] == "report_ready"
    assert data["done"] is True
    assert data["preview"]["statements"]["incomeStatement"]["netIncome"] == "100000.00"
    assert "利润表" in data["formattedMemorial"]["sections"]["财务报表"]


def test_finance_reporting_decision_preview_endpoint_returns_receipt(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/api/chaotang/hubu/finance/reporting/decision/preview",
        json={
            "factPack": _case(),
            "decisionInput": {
                "action": "prepare_financing_materials",
                "decidedBy": "boss",
                "reason": "进入融资材料人工复核",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["previewOnly"] is True
    assert data["executionAllowed"] is False
    assert data["sideEffects"] == "none"
    assert data["decisionReceipt"]["action"] == "prepare_financing_materials"
    assert data["decisionReceipt"]["nextState"] == "financing_materials_ready_for_manual_review"


def test_finance_reporting_preview_endpoint_rejects_missing_required_section(monkeypatch):
    client = _client(monkeypatch)
    case = copy.deepcopy(_case())
    case.pop("trialBalance")

    response = client.post("/api/chaotang/hubu/finance/reporting/preview", json=case)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "trialBalance" in body["error"]
