"""御史总判测试: 三态判决 + 未过闸禁入 done 断言。"""

import pytest

from src.memorial_drafter import draft_memorial_card
from src.yushi_gate import apply_verdict, judge_memorial

FINAL_OUTPUT = {
    "核心需求": "三十九所需要 60 台低温储能机柜。",
    "风险与建议": "建议按合同价 39500 元/所成交。",
}

SLOTS_QA = {
    "qa_result": "pass",
    "verdict_slots": {
        "做了什么": "核定报价方案",
        "对象": "三十九所项目",
        "关键数字": ["39500元/所"],
        "建议动作": "approve_archive",
    },
}


def _card(qa, snapshot=None):
    return draft_memorial_card(
        task_id="run-001",
        task_input="查三十九所报价",
        final_output=FINAL_OUTPUT,
        qa_result=qa,
        department="户部",
        snapshot_sha256=snapshot,
    )


class TestVerdicts:
    def test_full_signals_verified(self):
        card, meta = _card(SLOTS_QA, snapshot="b" * 64)
        v = judge_memorial(card, qa_result=SLOTS_QA, total_score=4.4, draft_meta=meta)
        assert v["seal"] == "verified"
        assert v["human_signoff_required"] is False

    def test_slots_missing_reserved(self):
        qa = {"qa_result": "pass"}
        card, meta = _card(qa, snapshot="b" * 64)
        v = judge_memorial(card, qa_result=qa, total_score=4.0, draft_meta=meta)
        assert v["seal"] == "reserved"

    def test_no_snapshot_reserved(self):
        card, meta = _card(SLOTS_QA)  # 凭据指针落在 final_output.* 而非快照
        v = judge_memorial(card, qa_result=SLOTS_QA, total_score=4.4, draft_meta=meta)
        assert v["seal"] == "reserved"
        assert any("快照" in r for r in v["reasons"])

    def test_qa_fail_blocked(self):
        qa = {"qa_result": "fail"}
        card, meta = _card(qa)
        v = judge_memorial(card, qa_result=qa, total_score=4.0, draft_meta=meta)
        assert v["seal"] == "blocked"
        assert "qa_fail" in v["reason_codes"]

    def test_hard_check_fail_blocked(self):
        qa = {**SLOTS_QA, "hard_checks": {"C1数字勾稽": "FAIL", "C2需求硬约束命中": "PASS"}}
        card, meta = _card(qa, snapshot="b" * 64)
        v = judge_memorial(card, qa_result=qa, total_score=4.5, draft_meta=meta)
        assert v["seal"] == "blocked"
        assert "hard_check_fail" in v["reason_codes"]

    def test_low_score_blocked(self):
        card, meta = _card(SLOTS_QA, snapshot="b" * 64)
        v = judge_memorial(card, qa_result=SLOTS_QA, total_score=2.5, draft_meta=meta)
        assert v["seal"] == "blocked"
        assert "low_score" in v["reason_codes"]


class TestApplyVerdict:
    def test_verified_becomes_done(self):
        card, meta = _card(SLOTS_QA, snapshot="b" * 64)
        v = judge_memorial(card, qa_result=SLOTS_QA, total_score=4.4, draft_meta=meta)
        final = apply_verdict(card, v)
        assert final.status == "done"
        assert final.quality_seal == "verified"

    def test_blocked_card_has_human_reason(self):
        qa = {"qa_result": "fail"}
        card, meta = _card(qa)
        v = judge_memorial(card, qa_result=qa, total_score=None, draft_meta=meta)
        final = apply_verdict(card, v)
        assert final.status == "blocked"
        assert final.blocked_reason_human  # 人话原因非空
        assert "{" not in final.blocked_reason_human  # 不吐 JSON 内脏

    def test_done_requires_completeness(self):
        card, meta = _card(SLOTS_QA, snapshot="b" * 64)
        v = judge_memorial(card, qa_result=SLOTS_QA, total_score=4.4, draft_meta=meta)
        # 人为掏空判词 → done 必须 fail-fast (未过闸禁入 done / 禁 skeleton 冒 done)
        crippled = card.model_copy(update={"verdict_summary": ""})
        with pytest.raises(Exception):
            apply_verdict(crippled, v)
