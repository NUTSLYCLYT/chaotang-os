"""测试 step_type: spawn 动态并行辅助函数。"""
import pytest
from src.flow_engine import _extract_spawn_subtasks, _merge_spawn_outputs


class TestExtractSpawnSubtasks:
    def test_json_code_block_with_field(self):
        text = '```json\n{"subtasks": ["分析客户A", "分析客户B", "分析客户C"]}\n```'
        assert _extract_spawn_subtasks(text, "subtasks") == ["分析客户A", "分析客户B", "分析客户C"]

    def test_plain_json_object_with_field(self):
        text = '{"subtasks": ["任务1", "任务2"]}'
        assert _extract_spawn_subtasks(text, "subtasks") == ["任务1", "任务2"]

    def test_plain_json_array(self):
        text = '["任务A", "任务B"]'
        assert _extract_spawn_subtasks(text, "subtasks") == ["任务A", "任务B"]

    def test_json_embedded_in_text(self):
        text = '分析结论如下：\n```json\n{"subtasks": ["研究方向1", "研究方向2"]}\n```\n请开始执行。'
        assert _extract_spawn_subtasks(text, "subtasks") == ["研究方向1", "研究方向2"]

    def test_missing_field_returns_empty(self):
        text = '{"other_field": ["x", "y"]}'
        assert _extract_spawn_subtasks(text, "subtasks") == []

    def test_invalid_json_returns_empty(self):
        assert _extract_spawn_subtasks("这不是JSON内容", "subtasks") == []

    def test_empty_list_returns_empty(self):
        text = '{"subtasks": []}'
        assert _extract_spawn_subtasks(text, "subtasks") == []


class TestMergeSpawnOutputs:
    def test_numbered_strategy_includes_labels(self):
        results = {0: {"output": "分析A结果"}, 1: {"output": "分析B结果"}}
        merged = _merge_spawn_outputs(results, ["任务A", "任务B"], "numbered")
        assert "子任务 1：任务A" in merged
        assert "分析A结果" in merged
        assert "子任务 2：任务B" in merged
        assert "分析B结果" in merged

    def test_concat_strategy_no_labels(self):
        results = {0: {"output": "输出1"}, 1: {"output": "输出2"}}
        merged = _merge_spawn_outputs(results, ["t1", "t2"], "concat")
        assert "输出1" in merged
        assert "输出2" in merged
        assert "子任务" not in merged

    def test_missing_result_shows_placeholder(self):
        merged = _merge_spawn_outputs({}, ["任务A"], "numbered")
        assert "执行失败" in merged

    def test_results_ordered_by_subtask_index(self):
        results = {1: {"output": "第二个"}, 0: {"output": "第一个"}}
        merged = _merge_spawn_outputs(results, ["t0", "t1"], "numbered")
        assert merged.index("第一个") < merged.index("第二个")


from unittest.mock import MagicMock, patch


def _build_spawn_engine():
    """构建含 spawn step 的最小 FlowEngine（复用 test_dag_engine 的 _build_engine 模式）。"""
    from src.flow_engine import FlowEngine

    step_configs = [
        {"id": "dispatcher", "name": "任务分解"},
        {
            "id": "spawner",
            "name": "并行分析",
            "step_type": "spawn",
            "spawn_from_field": "subtasks",
            "spawn_agent_id": "dispatcher",
            "spawn_max_workers": 2,
            "spawn_merge": "numbered",
        },
    ]
    engine = object.__new__(FlowEngine)
    engine.step_configs = step_configs
    engine.flow_name = "test_spawn"
    engine.config_path = "config/test.yaml"
    engine.config = {"flow_name": "test_spawn", "steps": step_configs, "output_fields": []}
    engine.default_model = "test-model"
    engine.default_api_base = None
    engine.default_api_key = None
    engine.default_temperature = None
    engine.default_max_tokens = None
    engine.max_context_chars = 0
    engine._knowledge_text = None
    engine._pre_retrieval_cfg = {}
    engine._ima_pre_retrieval_cfg = {}
    engine._execution_modes = {}
    engine._model_tiers = {}
    engine._tool_router = None
    engine._merge_system_to_user = False
    engine.qa_version = "v2"
    engine.output_fields = []
    engine._budget = MagicMock()
    engine._budget.pre_check.return_value = MagicMock(
        to_dict=lambda: {}, actual_prompt_tokens=0, actual_completion_tokens=0
    )
    engine._budget.post_record.return_value = MagicMock(
        to_dict=lambda: {}, actual_prompt_tokens=0, actual_completion_tokens=0
    )
    engine._budget.get_run_summary.return_value = {}
    engine._linter = MagicMock()
    engine._linter.lint.return_value = MagicMock(passed=True, errors=[])
    engine._assertions = MagicMock()
    engine._assertions.check_post.return_value = MagicMock(all_passed=True, hard_failures=[])
    engine._assertions.check_propagation.return_value = MagicMock(warnings=[])
    engine._guard = MagicMock()
    engine._guard.pre_check.return_value = MagicMock(
        passed=True, action="pass", issues=[], compressed_context=None
    )
    engine._guard.post_check.return_value = MagicMock(
        passed=True, action="pass", issues=[]
    )
    engine._hooks = {"before_step": [], "after_step": [], "on_step_error": []}

    agents = []
    for sc in step_configs:
        a = MagicMock()
        a.step_id = sc["id"]
        a.name = f"Agent_{sc['id']}"
        a.model = "test-model"
        a.api_base = None
        a.api_key = None
        a.system_prompt = f"prompt_{sc['id']}"
        a.run.return_value = {
            "status": "success",
            "output": "子任务分析结果",
            "model": "test-model",
            "prompt": "test",
            "raw_response": {},
        }
        agents.append(a)
    engine.agents = agents
    engine.default_adapter = MagicMock()
    return engine


class TestExecuteSpawnStep:
    def test_spawn_runs_subtasks_in_parallel(self):
        """spawn step 应并发执行子任务，并将结果 numbered 合并。"""
        engine = _build_spawn_engine()
        dispatcher_output = '{"subtasks": ["分析客户A", "分析客户B"]}'
        context = {
            "task_input": "测试任务",
            "steps": [
                {"step": "dispatcher", "agent_name": "任务分解", "output": dispatcher_output}
            ],
        }

        with patch("src.flow_engine.save_step"):
            step_log, elapsed = engine._execute_spawn_step(
                engine.step_configs[1], 1, "run_spawn_001", context, "测试任务"
            )

        assert step_log.status == "success"
        assert "子任务 1：分析客户A" in step_log.output
        assert "子任务 2：分析客户B" in step_log.output
        assert step_log.metadata["spawn_count"] == 2
        assert step_log.metadata["spawn_agent"] == "dispatcher"
        # template_agent (dispatcher) 应被调用 2 次（每个子任务一次）
        assert engine.agents[0].run.call_count == 2

    def test_spawn_no_subtasks_falls_back_to_normal_step(self):
        """上游输出无 JSON 子任务列表时，降级为普通步骤执行。"""
        engine = _build_spawn_engine()
        context = {
            "task_input": "测试任务",
            "steps": [
                {"step": "dispatcher", "agent_name": "任务分解", "output": "普通文本输出"}
            ],
        }

        fallback_log = MagicMock()
        fallback_log.status = "success"
        fallback_log.output = "fallback"

        with (
            patch("src.flow_engine.save_step"),
            patch.object(engine, "_execute_step", return_value=(fallback_log, 0.1)) as mock_exec,
        ):
            step_log, _ = engine._execute_spawn_step(
                engine.step_configs[1], 1, "run_spawn_002", context, "测试任务"
            )

        mock_exec.assert_called_once()
        assert step_log.output == "fallback"

    def test_spawn_result_injected_into_context(self):
        """spawn 完成后，其 output 应出现在 context['steps'] 中，供下游 agent 使用。"""
        engine = _build_spawn_engine()
        dispatcher_output = '{"subtasks": ["任务X"]}'
        context = {
            "task_input": "测试任务",
            "steps": [
                {"step": "dispatcher", "agent_name": "任务分解", "output": dispatcher_output}
            ],
        }

        with patch("src.flow_engine.save_step"):
            step_log, _ = engine._execute_spawn_step(
                engine.step_configs[1], 1, "run_spawn_003", context, "测试任务"
            )

        assert "任务X" in step_log.output
