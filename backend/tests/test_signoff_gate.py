"""tests/test_signoff_gate.py — "必须人签"门:automation_tier × signoff_learning 连接。

验:不可逆红需人签、可逆红不需、签字必带signer、reject沉淀教训、简报带历史被驳教训。
"""

from __future__ import annotations

import src.automation_tier as at
import src.signoff_gate as sg
import src.signoff_learning as sl

_IRREVERSIBLE_DOC = {
    "dept": "xingbu",
    "light": "red",
    "case_id": "XB-1",
    "headline": "建议驳回 —— 触合同红线",
    "items": [{"level": "red", "title": "违约金50%超红线"}],
}
_REVERSIBLE_DOC = {
    "dept": "bingbu",
    "light": "red",
    "items": [{"level": "red", "title": "评分算错"}],
}


def test_irreversible_red_needs_signoff():
    assert sg.needs_signoff(_IRREVERSIBLE_DOC) is True


def test_reversible_red_does_not_need_signoff():
    assert sg.needs_signoff(_REVERSIBLE_DOC) is False


def test_brief_surfaces_dept_and_red_items():
    b = sg.signoff_brief(_IRREVERSIBLE_DOC)
    assert b["required"] and b["dept"] == "刑部"
    assert b["auto_action"] == at.REQUIRE_HUMAN_SIGN
    assert "违约金50%超红线" in b["red_items"]


def test_resolve_requires_signer():
    try:
        sg.resolve_signoff(case_id="x", dept="xingbu", decision="approve", signer="")
    except ValueError:
        return
    raise AssertionError("空 signer 应被拒绝")


def test_resolve_records_signer_and_lessons(tmp_path, monkeypatch):
    # 用临时账本,不写真实 data/
    ledger = tmp_path / "signoff.jsonl"
    monkeypatch.setattr(sl, "_DEFAULT", sl.SignoffLearning(path=ledger))

    entry = sg.resolve_signoff(
        case_id="XB-1",
        dept="xingbu",
        decision="reject",
        signer="张法务",
        reason="无限责任条款不可接受",
    )
    assert entry["signer"] == "张法务" and entry["decision"] == "reject"
    # reject 沉淀成刑部教训,简报里能取回(自愈环)
    b = sg.signoff_brief(_IRREVERSIBLE_DOC)
    assert any("无限责任" in lesson for lesson in b["past_rejections"]), b[
        "past_rejections"
    ]
