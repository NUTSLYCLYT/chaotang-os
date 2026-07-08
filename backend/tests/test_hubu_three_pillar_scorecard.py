from __future__ import annotations

from src.hubu_three_pillar_scorecard import build_hubu_three_pillar_scorecard


def _clean_supply_chain() -> dict:
    return {
        "status": "ready",
        "sourceLabel": "internal_uploaded_file",
        "boss_brief": {
            "supplierCount": 8,
            "purchaseOrderAmount": "1200000.00",
            "payablesDue7d": "0.00",
            "inventoryValue": "550000.00",
        },
        "riskIssues": [],
        "warnings": [],
        "errors": [],
        "forbiddenActions": [
            "no_auto_payment",
            "no_auto_purchase_order",
            "no_vendor_commitment",
            "no_delete_source_evidence",
        ],
    }


def _clean_finance() -> dict:
    return {
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "bossBrief": {
            "verdict": "healthy",
            "riskLevel": "low",
            "oneSentence": "财务报表平衡，现金流可覆盖短期支出。",
        },
        "auditFindings": [],
        "archiveDraft": {
            "archiveEligible": True,
            "archiveMode": "draft_only",
        },
    }


def _clean_investment() -> dict:
    return {
        "status": "ready",
        "sourceLabel": "MIXED",
        "summary": {
            "total_market_value": "800000.00",
            "total_cost": "760000.00",
            "unrealized_pnl": "40000.00",
            "top_concentration_percent": "18.5",
        },
        "risk_issues": [],
        "warnings": [],
        "forbidden_actions": [
            "no_auto_trade",
            "no_buy_sell_recommendation",
        ],
    }


def test_three_pillar_scorecard_marks_clean_hubu_ready_for_boss_review():
    scorecard = build_hubu_three_pillar_scorecard(
        supply_chain=_clean_supply_chain(),
        finance=_clean_finance(),
        investment=_clean_investment(),
    )

    assert scorecard["previewOnly"] is True
    assert scorecard["executionAllowed"] is False
    assert scorecard["sideEffects"] == "none"
    assert scorecard["overallScore"] == 100
    assert scorecard["grade"] == "A+"
    assert scorecard["status"] == "ready"
    assert scorecard["p0Blockers"] == []
    assert scorecard["missingFor100"] == []
    assert "no_auto_payment" in scorecard["forbiddenActions"]
    assert "no_auto_trade" in scorecard["forbiddenActions"]
    assert scorecard["decisionOptions"][0]["action"] == "archive_preview"
    assert scorecard["decisionOptions"][0]["allowed"] is True


def test_three_pillar_scorecard_blocks_missing_evidence_and_execution_risk():
    supply_chain = _clean_supply_chain()
    supply_chain["status"] = "needs_evidence"
    supply_chain["errors"] = ["missing supplier csv"]
    supply_chain["forbiddenActions"] = ["no_auto_payment"]

    finance = _clean_finance()
    finance["executionAllowed"] = True
    finance["bossBrief"]["riskLevel"] = "blocked"
    finance["auditFindings"] = [
        {"severity": "critical", "title": "资产负债表不平"},
        {"severity": "high", "title": "核心数字来源不足"},
    ]
    finance["archiveDraft"]["archiveEligible"] = False

    investment = _clean_investment()
    investment["status"] = "needs_review"
    investment["summary"]["top_concentration_percent"] = "63"
    investment["forbidden_actions"] = ["no_auto_trade"]

    scorecard = build_hubu_three_pillar_scorecard(
        supply_chain=supply_chain,
        finance=finance,
        investment=investment,
    )

    assert scorecard["status"] == "blocked"
    assert scorecard["overallScore"] < 80
    assert scorecard["decisionOptions"][0]["allowed"] is False
    assert scorecard["decisionOptions"][1]["allowed"] is True
    titles = {item["title"] for item in scorecard["p0Blockers"]}
    assert "供应链证据不足" in titles
    assert "财务模块出现自动执行权限" in titles
    assert "资产负债表不平" in titles
    assert "投资集中度过高" in titles
    assert "投资交易红线不完整" in titles
