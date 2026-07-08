"""tests/test_xingbu_contract_vet.py — 刑部合同红线门三档:
placeholder≤yellow / expert_default上膛red带标注 / confirmed作准red。
"""

from __future__ import annotations

import src.xingbu_contract_vet as cv

CONTRACT = "本合同违约金为合同金额的50%,账期120天,含无限责任条款。"

_PLACEHOLDER_CFG = {
    "status": "placeholder",
    "version": 1,
    "thresholds": {"违约金比例上限_pct": 30, "账期上限_天": 90},
    "one_vote_red_clauses": ["无限责任"],
    "extract_anchors": {"违约金": ["违约金"], "账期": ["账期"]},
}


def test_expert_default_arms_red_with_tag():
    # 默认 config status=expert_default → 门上膛,超阈值/一票条款亮 red,但带"专家默认·法务可调"
    items = cv.vet_contract(CONTRACT)
    assert any(it["level"] == "red" for it in items), items
    assert any("专家默认" in it["title"] for it in items), items


def test_placeholder_never_produces_authoritative_red(monkeypatch):
    monkeypatch.setattr(cv, "_CFG_CACHE", _PLACEHOLDER_CFG)
    items = cv.vet_contract(CONTRACT)
    assert all(it["level"] != "red" for it in items), items
    assert any("阈值占位" in it["title"] for it in items), items


def test_flags_breaches_regardless_of_status():
    items = cv.vet_contract(CONTRACT)
    titles = " ".join(it["title"] for it in items)
    assert "违约金" in titles and "50%" in titles
    assert "一票红线" in titles  # 无限责任命中


def test_confirmed_status_produces_red(monkeypatch):
    monkeypatch.setattr(
        cv,
        "_CFG_CACHE",
        {
            "status": "confirmed",
            "version": 1,
            "thresholds": {"违约金比例上限_pct": 30, "账期上限_天": 90},
            "one_vote_red_clauses": ["无限责任"],
            "extract_anchors": {"违约金": ["违约金"], "账期": ["账期"]},
        },
    )
    items = cv.vet_contract(CONTRACT)
    assert any(it["level"] == "red" for it in items), items


def test_within_threshold_is_green():
    items = cv.vet_contract("违约金为合同金额的10%,账期30天。")
    assert any(
        it["level"] == "green" and "违约金" in it["title"] for it in items
    ), items


def test_court_doc_shape_and_stamp():
    doc = cv.build_contract_verdict(CONTRACT, archive=False)
    assert doc["dept"] == "xingbu"
    assert doc["seal"]["stamp"] == "天平印"
    assert doc["items"]


def test_adapter_routes_contract_to_deterministic_gate():
    from src import real_department_engines as rde

    out = rde.adapt_xingbu("帮我看看这份合同:违约金50%,账期120天,无限责任")
    assert out is not None and out["dept"] == "xingbu"
    # 走了确定性门(pending_note 带"合同红线复核"),非 LLM findings
    assert "合同红线" in out.get("provenance", {}).get("gate", "") or any(
        "红线" in it["title"] or "违约金" in it["title"] for it in out["items"]
    )
