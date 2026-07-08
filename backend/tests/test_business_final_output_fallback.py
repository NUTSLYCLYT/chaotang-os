from src.flow_engine import (
    _build_business_step_final_output_with_report,
    _looks_like_qa_polluted_final_output,
)
from src.step_log import StepLog


def _step(step_id: str, output: str, status: str = "success") -> StepLog:
    return StepLog(
        run_id="run_test",
        step_index=0,
        step_id=step_id,
        agent_name=step_id,
        timestamp="2026-06-22T00:00:00",
        input="",
        rendered_context="",
        system_prompt="",
        model="test",
        output=output,
        status=status,
    )


def test_clean_final_output_is_not_replaced():
    fields = ["财务画像", "现金流预测"]
    final_output = {
        "财务画像": "现金120万，应收80万。",
        "现金流预测": "期末现金20万。",
    }

    output, report = _build_business_step_final_output_with_report(
        [_step("finance_analyst", "业务步骤输出")],
        fields,
        final_output,
    )

    assert output == final_output
    assert report["applicable"] is False


def test_qa_polluted_final_output_falls_back_to_business_steps():
    fields = ["财务画像", "现金流预测"]
    polluted = {
        "财务画像": '"quality_score": {"scores": {"完整性": 2}}, "issues": []',
        "现金流预测": '"qa_result": "fail", "source_agent": "finance_analyst"',
    }

    output, report = _build_business_step_final_output_with_report(
        [
            _step("finance_analyst", "现金余额120万，应收账款80万。"),
            _step("qa_tech_support", '{"qa_result":"fail"}'),
        ],
        fields,
        polluted,
    )

    assert _looks_like_qa_polluted_final_output(polluted, fields) is True
    assert report["applicable"] is True
    assert report["reason"] == "qa_final_output_missing_or_polluted"
    assert report["source_steps"] == ["finance_analyst"]
    assert output is not None
    assert "现金余额120万" in output["财务画像"]
    assert '"quality_score"' not in output["财务画像"]
