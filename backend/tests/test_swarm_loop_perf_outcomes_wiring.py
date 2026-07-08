"""铁律4 回归断言:run_swarm_execution_loop 的 quality_result 必须带 Performance-Outcomes 元数据。

钉死 P2a 接入(enrich_quality_result 已接进主循环),防日后有人改回裸 **gate 而无人察觉。
确定性、离线可跑(无 DB、无 LLM)。
"""

from __future__ import annotations

from src.swarm_execution_loop import run_swarm_execution_loop

_PARAMS = {
    "task_id": "t1",
    "review_id": "r1",
    "confirmed_edict": {"source_label": "LIVE_SWARM", "title": "测试", "summary": "x"},
    "review_plan": {},
    "mode": "standard",
    "trace_id": "trace-1",
}


def test_quality_result_carries_perf_outcomes_fields():
    q = run_swarm_execution_loop(_PARAMS)["quality_result"]
    # P2a 四个新字段必须出现(被改回 **gate 即红)
    for field in (
        "should_run_llm_judge",
        "judge_pending",
        "grader_model_planned",
        "needs_human",
    ):
        assert field in q, f"quality_result 缺 Performance-Outcomes 字段 {field}"
    # 原确定性 gate 字段仍在(向后兼容)
    for field in ("passed", "blocking_reasons", "warnings", "revised_output"):
        assert field in q, f"quality_result 丢了原 gate 字段 {field}"


def test_grader_planned_is_heterogeneous_to_swarm():
    from src.perf_outcomes_guard import bias_risk

    q = run_swarm_execution_loop(_PARAMS)["quality_result"]
    # 预设异构裁判与蜂群 doer(deepseek 系)不可同家族(坑1 自评偏袒)
    assert bias_risk("swarm-deepseek-pro", q["grader_model_planned"]) is False
