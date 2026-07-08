# tests/test_chaotang_smoke_real.py
"""真实 LLM 端到端冒烟。需 DASHSCOPE_API_KEY。
运行:RUN_REAL_LLM=1 .venv/bin/python3 -m pytest tests/test_chaotang_smoke_real.py -v -s
"""
import os
import pytest

pytestmark = pytest.mark.skipif(os.getenv("RUN_REAL_LLM") != "1",
                                reason="需 RUN_REAL_LLM=1 + 真实 DASHSCOPE_API_KEY")


def test_full_loop_real_llm():
    import queue
    from src import chaotang_orchestrator as orch
    from web.task_registry import register_task, get_task

    draft = orch.draft_decree("帮我评估低温电池储能项目值不值得投,关注成本和合规风险")
    assert draft["recommendedCategories"]
    cat = draft["recommendedCategories"][0]
    plan = {"rawCommand": "评估低温电池储能项目", "intent": draft["intent"],
            "taskType": cat["taskType"], "ministers": cat["ministers"],
            "groups": cat["groups"] or ["finlaw"]}
    flow_path = orch.assemble_flow(plan, task_id="smoke")
    q = register_task("smoke", monitor=True)
    orch.run_chaotang_task("smoke", q, flow_path=flow_path,
                           task_input="评估低温电池储能项目", budget_max_calls=40)
    seen = []
    while not q.empty():
        seen.append(q.get()["type"])
    assert "memorial.drafted" in seen or "done" in seen
    assert get_task("smoke")["run_id"]
