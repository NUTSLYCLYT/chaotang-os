"""拟奏节点测试: 槽位拼装 / 兜底 / 凭据指针 / 动作枚举。"""

from src.memorial_drafter import draft_memorial_card

FINAL_OUTPUT = {
    "核心需求": "三十九所需要 60 台低温储能机柜，预算 39500 元/所。",
    "解决方案": "采用 -40℃ 低温电芯方案，分两批交付。",
    "风险与建议": "建议按合同价 39500 元/所成交，关注交付周期风险。",
}

QA_WITH_SLOTS = {
    "qa_result": "pass",
    "verdict_slots": {
        "做了什么": "核定报价方案",
        "对象": "三十九所项目",
        "关键数字": ["39500元/所 成交价", "60台 机柜"],
        "建议动作": "approve_archive",
    },
}


def _draft(qa, fo=FINAL_OUTPUT, snapshot=None):
    return draft_memorial_card(
        task_id="run-001",
        task_input="查三十九所报价能否按合同价成交",
        final_output=fo,
        qa_result=qa,
        department="户部",
        swarm_id="flow_quotation.yaml",
        run_id="run-001",
        snapshot_sha256=snapshot,
    )


class TestSlotAssembly:
    def test_slots_produce_template_verdict(self):
        card, meta = _draft(QA_WITH_SLOTS)
        assert meta["slots_used"] is True
        assert card.verdict_summary.startswith("已核定报价方案三十九所项目")
        assert "39500" in card.verdict_summary
        assert len(card.verdict_summary) <= 48

    def test_action_enum_from_slots(self):
        card, _ = _draft(QA_WITH_SLOTS)
        assert card.next_action == "approve_archive"

    def test_chinese_action_alias(self):
        qa = {**QA_WITH_SLOTS, "verdict_slots": {**QA_WITH_SLOTS["verdict_slots"], "建议动作": "打回重办"}}
        card, _ = _draft(qa)
        assert card.next_action == "return_rework"

    def test_origin_echo_present(self):
        card, _ = _draft(QA_WITH_SLOTS)
        assert card.origin_echo.startswith("查三十九所报价")


class TestFallback:
    def test_no_slots_falls_back_deterministic(self):
        card, meta = _draft({"qa_result": "pass"})
        assert meta["slots_used"] is False
        assert "slots_missing" in meta["fallback_notes"]
        # 兜底取结论性字段首句, 非 LLM
        assert card.verdict_summary.startswith("建议按合同价")

    def test_qa_fail_no_slots_action_rework(self):
        card, _ = _draft({"qa_result": "fail"})
        assert card.next_action == "return_rework"

    def test_unknown_qa_escalates(self):
        card, _ = _draft(None)
        assert card.next_action == "escalate_junjichu"


class TestFindings:
    def test_findings_capped_at_three_with_evidence(self):
        card, _ = _draft(QA_WITH_SLOTS)
        assert 1 <= len(card.key_findings) <= 3
        for f in card.key_findings:
            assert f.evidence.startswith("final_output.")

    def test_snapshot_pointer_preferred(self):
        sha = "a" * 64
        card, _ = _draft(QA_WITH_SLOTS, snapshot=sha)
        assert all(f.evidence.startswith(f"snapshot:{sha[:12]}#") for f in card.key_findings)

    def test_empty_output_noted(self):
        _, meta = _draft(QA_WITH_SLOTS, fo=None)
        assert "findings_empty" in meta["fallback_notes"]


class TestDiscipline:
    def test_drafter_never_sets_done(self):
        card, _ = _draft(QA_WITH_SLOTS)
        assert card.status == "running"  # 终态只能由御史闸 apply_verdict 改写
        assert card.quality_seal is None
