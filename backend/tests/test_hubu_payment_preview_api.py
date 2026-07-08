from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient


FIXTURE = Path(__file__).parent / "fixtures" / "hubu_payment_fact_pack.json"


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _case(overrides=None) -> dict:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if overrides:
        for key, value in overrides.items():
            if isinstance(value, dict) and isinstance(data.get(key), dict):
                data[key].update(value)
            else:
                data[key] = value
    return data


def test_hubu_payment_preview_api_returns_side_effect_free_memorial(monkeypatch):
    client = _client(monkeypatch)

    response = client.post("/api/chaotang/hubu/payment/preview", json=_case())

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["previewOnly"] is True
    assert data["executionAllowed"] is False
    assert data["sideEffects"] == "none"
    assert data["officeChain"] == ["accounting", "treasury", "budget", "memorial"]
    assert data["decision"]["recommendation"] == "approve"
    assert data["decisionActions"]["primaryAction"] == "approve"
    assert data["decisionActions"]["requiresSecondConfirmation"] is False
    assert data["decisionActions"]["buttonLabels"]["approve"] == "批准"
    assert data["archiveDraft"]["archiveMode"] == "draft_only"
    assert data["archiveDraft"]["archiveEligible"] is True
    assert data["archiveDraft"]["sourceDepartment"] == "hubu"
    assert data["archiveDraft"]["agentCode"] == "hu_bu"
    assert data["archiveDraft"]["decisionStatus"] == "pending_boss_decision"
    assert data["archiveDraft"]["decisionResult"] == "approve"
    assert data["archiveDraft"]["evidenceChain"]
    assert data["archiveDraft"]["auditTrail"][0]["office"] == "accounting"
    assert data["memorial"]["recommendation"] == "approve"
    assert data["memorial"]["metrics"]["treasury.available_cash"] == "520000"


def test_hubu_payment_preview_api_needs_evidence_without_invoice(monkeypatch):
    client = _client(monkeypatch)
    case = _case()
    case["paymentRequest"]["evidence"].pop("invoice")

    response = client.post("/api/chaotang/hubu/payment/preview", json=case)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["decision"]["recommendation"] == "needs_evidence"
    assert data["executionAllowed"] is False
    assert data["decisionActions"]["primaryAction"] == "return_for_evidence"
    assert "approve" in data["decisionActions"]["blockedActions"]
    assert data["archiveDraft"]["archiveEligible"] is False
    assert any("invoice" in gap for gap in data["archiveDraft"]["archiveBlockedReasons"])
    assert any("invoice" in gap for gap in data["decision"]["missingEvidence"])


def test_hubu_payment_preview_api_requires_second_confirmation_for_large_payment(monkeypatch):
    client = _client(monkeypatch)
    case = _case()
    case["paymentRequest"]["amount"] = 120000

    response = client.post("/api/chaotang/hubu/payment/preview", json=case)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["decision"]["recommendation"] == "needs_confirmation"
    assert data["decisionActions"]["primaryAction"] == "confirm_with_risk_gate"
    assert data["decisionActions"]["requiresSecondConfirmation"] is True
    assert data["archiveDraft"]["archiveEligible"] is True
    assert data["archiveDraft"]["riskGates"] == ["large_payment"]
    assert data["decisionActions"]["buttonLabels"]["confirm_with_risk_gate"] == "确认风险后批准"


def test_hubu_payment_preview_api_blocks_approval_when_cash_is_insufficient(monkeypatch):
    client = _client(monkeypatch)
    case = _case({"treasury": {"bank_balance": 10000}})

    response = client.post("/api/chaotang/hubu/payment/preview", json=case)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["decision"]["recommendation"] == "blocked"
    assert data["decisionActions"]["primaryAction"] == "block"
    assert data["decisionActions"]["archiveEligible"] is False
    assert "approve" in data["decisionActions"]["blockedActions"]


def test_hubu_payment_preview_api_rejects_missing_fact_pack_section(monkeypatch):
    client = _client(monkeypatch)
    case = _case()
    case.pop("treasury")

    response = client.post("/api/chaotang/hubu/payment/preview", json=case)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "treasury" in body["error"]


def test_hubu_payment_decision_preview_accepts_allowed_approval(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/api/chaotang/hubu/payment/decision/preview",
        json={
            "factPack": _case(),
            "decisionInput": {
                "action": "approve",
                "decidedBy": "boss",
                "reason": "证据完整且预算内",
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
    assert data["decisionReceipt"]["accepted"] is True
    assert data["decisionReceipt"]["action"] == "approve"
    assert data["decisionReceipt"]["nextState"] == "approved_pending_archive"
    assert data["archiveDraft"]["archiveMode"] == "draft_only"


def test_hubu_payment_decision_preview_requires_risk_gate_confirmation(monkeypatch):
    client = _client(monkeypatch)
    case = _case()
    case["paymentRequest"]["amount"] = 120000

    response = client.post(
        "/api/chaotang/hubu/payment/decision/preview",
        json={
            "factPack": case,
            "decisionInput": {"action": "confirm_with_risk_gate", "decidedBy": "boss"},
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "large_payment" in response.json()["error"]

    ok_response = client.post(
        "/api/chaotang/hubu/payment/decision/preview",
        json={
            "factPack": case,
            "decisionInput": {
                "action": "confirm_with_risk_gate",
                "decidedBy": "boss",
                "confirmedRiskGates": ["large_payment"],
            },
        },
    )
    data = ok_response.json()["data"]
    assert data["decisionReceipt"]["requiresSecondConfirmation"] is True
    assert data["decisionReceipt"]["nextState"] == "approved_with_risk_confirmation"


def test_hubu_payment_decision_preview_rejects_disallowed_action(monkeypatch):
    client = _client(monkeypatch)
    case = _case()
    case["paymentRequest"]["evidence"].pop("invoice")

    response = client.post(
        "/api/chaotang/hubu/payment/decision/preview",
        json={
            "factPack": case,
            "decisionInput": {"action": "approve", "decidedBy": "boss"},
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "不允许" in response.json()["error"]
