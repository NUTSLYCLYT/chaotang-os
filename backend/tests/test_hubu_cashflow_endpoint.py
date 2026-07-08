"""tests/test_hubu_cashflow_endpoint.py — 户部现金跑道预览端点(顶尖高手会审补的洞)。

之前 src.hubu_memorial_verdict.run_cashflow_court_doc 是真实确定性引擎,但零真实 API 路由调用它,
用户端摸不到。补 POST /api/chaotang/hubu/cashflow/preview,body(JSON)→ FinanceEvidencePack →
court_doc,和其余 4 个户部端点同款约束(只预览、不落库、不归档)。数字全是构造样例,非真实客户数据。
"""
from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

from src import hubu_memorial_verdict as hm

app = importlib.import_module("web.main").app
client = TestClient(app)


def test_pack_from_body_roundtrips_all_fields():
    body = {
        "task_id": "t1", "title": "测试样例",
        "cash": {"amount": 2_000_000.0, "source_label": "internal_uploaded_file"},
        "bank": {"amount": 500_000.0, "source_label": "manual_confirmed"},
        "monthly_flows": [{"period": "2026-05", "cash_receipts": 500000.0, "cash_payments": 400000.0}],
        "receivables": [{"id": "r1", "amount": 100000.0, "days_outstanding": 30, "counterparty": "客户A"}],
        "payables": [{"id": "p1", "amount": 50000.0, "days_outstanding": 90, "counterparty": "供应商B"}],
        "upcoming_inflows": [{"id": "in1", "amount": 30000.0, "due_in_days": 10}],
        "upcoming_outflows": [{"id": "out1", "amount": 20000.0, "due_in_days": 5}],
        "monthly_payroll": {"amount": 80000.0},
        "currency": "CNY",
    }
    pack = hm.pack_from_body(body)
    assert pack.task_id == "t1"
    assert pack.cash.amount == 2_000_000.0
    assert pack.monthly_flows[0].period == "2026-05"
    assert pack.receivables[0].counterparty == "客户A"
    assert pack.payables[0].days_outstanding == 90
    assert pack.upcoming_inflows[0].due_in_days == 10
    assert pack.monthly_payroll.amount == 80000.0


def test_pack_from_body_missing_fields_defaults_safely():
    pack = hm.pack_from_body({"task_id": "empty"})
    assert pack.cash.amount == 0.0
    assert pack.monthly_flows == []
    assert pack.inventory is None


def test_pack_from_body_bad_type_raises_not_silently_wrong():
    with pytest.raises((ValueError, TypeError, KeyError)):
        hm.pack_from_body({"cash": {"amount": "不是数字"}})


def test_preview_cashflow_court_doc_end_to_end():
    doc = hm.preview_cashflow_court_doc({
        "task_id": "smoke",
        "cash": {"amount": 3_000_000.0, "source_label": "internal_uploaded_file"},
        "monthly_flows": [
            {"period": "2026-05", "cash_receipts": 600000.0, "cash_payments": 500000.0},
            {"period": "2026-06", "cash_receipts": 600000.0, "cash_payments": 500000.0},
        ],
    })
    assert doc["dept"] == "hubu" and doc["doc_type"] == "memorial"
    assert doc["light"] in ("green", "yellow", "red", "black")
    assert doc["provenance"]["archive_id"] is None   # 预览不归档


def test_cashflow_preview_endpoint_ok():
    r = client.post("/api/chaotang/hubu/cashflow/preview", json={
        "task_id": "e1",
        "cash": {"amount": 1_000_000.0, "source_label": "internal_uploaded_file"},
        "monthly_flows": [{"period": "2026-06", "cash_receipts": 400000.0, "cash_payments": 380000.0}],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["dept"] == "hubu"


def test_cashflow_preview_endpoint_rejects_bad_shape():
    r = client.post("/api/chaotang/hubu/cashflow/preview", json={
        "cash": {"amount": "不是数字"},
    })
    assert r.status_code == 200   # 统一信封,不是 HTTP 层错误
    body = r.json()
    assert body["success"] is False
    assert "格式错误" in body["error"]


def test_cashflow_preview_empty_evidence_needs_evidence_not_fake_pass():
    """空证据不该假装"健康"(和这轮全仓扫出的其它'空结果冒充安全'同款原则)。"""
    r = client.post("/api/chaotang/hubu/cashflow/preview", json={"task_id": "empty"})
    body = r.json()["data"]
    assert body["provenance"]["gate"] == "pending"
    assert "需补现金证据" in body["headline"]
