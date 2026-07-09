"""tests/test_xingbu_verdict.py — 刑部判决引擎(灯/接地门/court_doc 合规/端点)。"""

from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src import xingbu_verdict as xv

_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA = json.loads((_ROOT / "schemas" / "court_doc.json").read_text(encoding="utf-8"))


def _case(**kw):
    base = {
        "case_id": "XB-20260701-007",
        "question": "这份储能尾款合同能签吗?",
        "items": [
            {
                "level": "red",
                "title": "验收标准模糊",
                "odds": "高",
                "impact": "¥80万",
                "fix": "加'验收以X报告为准,7日不反馈视同通过'",
                "evidence_ref": "truth://x",
            },
            {
                "level": "yellow",
                "title": "违约金无上限",
                "odds": "中",
                "impact": "¥20万",
                "fix": "违约金封顶合同额30%",
            },
        ],
        "shielded": "为你挡了:80万尾款拖欠口子",
    }
    base.update(kw)
    return base


# ── 灯计算(确定性)──────────────────────────────────────────────────────────


def test_light_green_when_all_green():
    assert xv.compute_light([{"level": "green"}]) == "green"


def test_light_yellow_when_red_has_fix():
    items = [{"level": "red", "fix": "改X"}]
    assert xv.compute_light(items) == "yellow"  # 红但有解 → 可签须改


def test_light_red_when_red_no_fix():
    items = [{"level": "red", "fix": ""}]
    assert xv.compute_light(items) == "red"  # 红且无解 → 挡住


def test_light_black_on_escalate():
    assert xv.compute_light([{"level": "green"}], escalate_black=True) == "black"


# ── 接地铁律(gate_conclusion 焊进判决)──────────────────────────────────────


def test_verdict_downgraded_when_not_rag_grounded():
    # posner/schneier 是观点席;rag_hit=False → 不能下结论 → 降级需人工
    v = xv.build_verdict(_case(), rag_hit=False, archive=False)
    assert v["provenance"]["rag_grounded"] is False
    assert v["provenance"]["gate"] == "pending"
    assert "需人工律师复核" in v["headline"]
    assert v["signed"] is False


def test_verdict_authoritative_when_rag_grounded():
    v = xv.build_verdict(_case(), rag_hit=True, archive=False)
    assert v["provenance"]["rag_grounded"] is True
    assert v["provenance"]["gate"] == "passed"
    assert "需人工" not in v["headline"]
    assert v["light"] == "yellow"  # 一红有解 + 一黄 → 黄灯


# ── court_doc 合规 ───────────────────────────────────────────────────────────


def test_verdict_satisfies_court_doc_schema():
    v = xv.build_verdict(_case(), rag_hit=True, archive=False)
    for field in _SCHEMA["required"]:
        assert field in v, f"判决缺 court_doc 必填字段 {field}"
    assert v["doc_type"] == "verdict" and v["dept"] == "xingbu"
    assert v["seal"]["stamp"] == "天平印" and v["seal"]["color"] == "朱砂红"
    try:
        import jsonschema

        jsonschema.validate(v, _SCHEMA)
    except ImportError:
        pass


def test_shielded_and_actions_present():
    v = xv.build_verdict(_case(), rag_hit=True, archive=False)
    assert "挡了" in v["shielded"]
    assert "escalate_court" in v["actions"] and "archive_amulet" in v["actions"]


def test_extract_findings_parses_llm_json():
    # 注入 mock LLM 输出(含 ```json 包裹)→ 解析成 findings
    mock = (
        lambda s, u: '```json\n[{"level":"red","title":"验收模糊","fix":"加条款","impact":"¥80万"}]\n```'
    )  # noqa: E731
    items = xv.extract_findings_via_llm("某合同全文", call_fn=mock)
    assert (
        len(items) == 1
        and items[0]["level"] == "red"
        and items[0]["title"] == "验收模糊"
    )


def test_run_verdict_from_text_end_to_end_with_mock():
    mock = (
        lambda s, u: '[{"level":"red","title":"违约金无上限","fix":"封顶30%"}]'
    )  # noqa: E731
    doc = xv.run_verdict_from_text(
        "合同全文…", rag_hit=True, archive=False, call_fn=mock
    )
    assert doc["dept"] == "xingbu" and doc["doc_type"] == "verdict"
    assert doc["light"] == "yellow"  # 一红有解 → 黄
    assert "违约金无上限" in doc["items"][0]["title"]


def test_run_verdict_from_text_marks_live_swarm():
    """run_verdict_from_text 真调了 LLM 抽 findings，该标 LIVE_SWARM；此前不传
    source_label，恒落回 build_verdict 的默认 MIXED，真判决也显示"未验真"(2026-07-09 复审修复)。"""
    mock = lambda s, u: '[{"level":"green","title":"无风险"}]'  # noqa: E731
    doc = xv.run_verdict_from_text(
        "合同全文…", rag_hit=True, archive=False, call_fn=mock
    )
    assert doc["source_label"] == "LIVE_SWARM"


def test_extract_tolerates_garbage():
    assert xv.extract_findings_via_llm("x", call_fn=lambda s, u: "不是JSON的废话") == []


# ── 端点 ─────────────────────────────────────────────────────────────────────


@pytest.fixture()
def client():
    return TestClient(importlib.import_module("web.main").app)


def test_api_verdict_ok(client):
    r = client.post("/api/legal/verdict", json={**_case(), "rag_hit": True})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["doc_type"] == "verdict" and body["data"]["light"] == "yellow"


def test_api_verdict_rejects_bad_items(client):
    r = client.post("/api/legal/verdict", json={"question": "x", "items": "notalist"})
    assert r.status_code == 200 and r.json()["success"] is False
