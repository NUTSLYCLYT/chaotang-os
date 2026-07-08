"""DAG 拓扑排序与祖先 context 功能测试。

覆盖：
- _dag_topo_sort 正常 DAG（钻石型、链式、并行层）
- 循环依赖检测
- 不存在 step_id 检测
- 无 depends_on 步骤（全根节点）
- _get_ancestor_ids 直接/间接祖先
- FlowEngine.rerun_from() DAG 模式（单元级，mock 文件 IO）
"""

from __future__ import annotations

import types
from unittest.mock import MagicMock, patch, call

import pytest

from src.flow_engine import _dag_topo_sort, _get_ancestor_ids


# ── _dag_topo_sort ─────────────────────────────────────────────────────────────

class TestDagTopoSort:
    def test_diamond_dag(self):
        """钻石型：1→2,3,4→5（用户示例）"""
        steps = [
            {'id': 'task1'},
            {'id': 'task2', 'depends_on': ['task1']},
            {'id': 'task3', 'depends_on': ['task1']},
            {'id': 'task4', 'depends_on': ['task1']},
            {'id': 'task5', 'depends_on': ['task2', 'task3', 'task4']},
        ]
        layers = _dag_topo_sort(steps)
        assert layers == [[0], [1, 2, 3], [4]]

    def test_linear_chain_with_deps(self):
        """有 depends_on 的纯链式 DAG: a→b→c"""
        steps = [
            {'id': 'a'},
            {'id': 'b', 'depends_on': ['a']},
            {'id': 'c', 'depends_on': ['b']},
        ]
        layers = _dag_topo_sort(steps)
        assert layers == [[0], [1], [2]]

    def test_two_roots(self):
        """两个根节点，各自有后继"""
        steps = [
            {'id': 'root1'},
            {'id': 'root2'},
            {'id': 'child', 'depends_on': ['root1', 'root2']},
        ]
        layers = _dag_topo_sort(steps)
        # root1 和 root2 在同一层
        assert set(layers[0]) == {0, 1}
        assert layers[1] == [2]

    def test_all_roots_no_depends(self):
        """无 depends_on 步骤，全部是根节点，并行执行"""
        steps = [{'id': 'a'}, {'id': 'b'}, {'id': 'c'}]
        layers = _dag_topo_sort(steps)
        assert layers == [[0, 1, 2]]

    def test_single_step(self):
        steps = [{'id': 'only'}]
        layers = _dag_topo_sort(steps)
        assert layers == [[0]]

    def test_cycle_detection_direct(self):
        """直接循环 a→b→a"""
        with pytest.raises(ValueError, match="循环依赖"):
            _dag_topo_sort([
                {'id': 'a', 'depends_on': ['b']},
                {'id': 'b', 'depends_on': ['a']},
            ])

    def test_cycle_detection_indirect(self):
        """间接循环 a→b→c→a"""
        with pytest.raises(ValueError, match="循环依赖"):
            _dag_topo_sort([
                {'id': 'a', 'depends_on': ['c']},
                {'id': 'b', 'depends_on': ['a']},
                {'id': 'c', 'depends_on': ['b']},
            ])

    def test_missing_dep_id(self):
        """depends_on 引用不存在的 step_id"""
        with pytest.raises(ValueError, match="nonexistent"):
            _dag_topo_sort([
                {'id': 'a', 'depends_on': ['nonexistent']},
            ])

    def test_empty_depends_on_list(self):
        """depends_on: [] 等价于无依赖（根节点）"""
        steps = [
            {'id': 'a', 'depends_on': []},
            {'id': 'b', 'depends_on': ['a']},
        ]
        layers = _dag_topo_sort(steps)
        assert layers == [[0], [1]]


# ── _get_ancestor_ids ──────────────────────────────────────────────────────────

class TestGetAncestorIds:
    def test_diamond_dag_leaf(self):
        """task5 的祖先应包含所有节点"""
        steps = [
            {'id': 'task1'},
            {'id': 'task2', 'depends_on': ['task1']},
            {'id': 'task3', 'depends_on': ['task1']},
            {'id': 'task4', 'depends_on': ['task1']},
            {'id': 'task5', 'depends_on': ['task2', 'task3', 'task4']},
        ]
        ancestors = _get_ancestor_ids('task5', steps)
        assert ancestors == {'task1', 'task2', 'task3', 'task4'}

    def test_direct_parent_only(self):
        steps = [{'id': 'a'}, {'id': 'b', 'depends_on': ['a']}]
        assert _get_ancestor_ids('b', steps) == {'a'}

    def test_root_has_no_ancestors(self):
        steps = [{'id': 'root'}, {'id': 'child', 'depends_on': ['root']}]
        assert _get_ancestor_ids('root', steps) == set()

    def test_transitive_ancestors(self):
        """a→b→c→d，d 的祖先是 a, b, c"""
        steps = [
            {'id': 'a'},
            {'id': 'b', 'depends_on': ['a']},
            {'id': 'c', 'depends_on': ['b']},
            {'id': 'd', 'depends_on': ['c']},
        ]
        assert _get_ancestor_ids('d', steps) == {'a', 'b', 'c'}


# ── TestDagRerun ───────────────────────────────────────────────────────────────

def _make_step_log(step_id: str, step_index: int, output: str = "output_" + "x") -> MagicMock:
    """构建一个最小可用的 StepLog mock。"""
    sl = MagicMock()
    sl.step_id = step_id
    sl.step_index = step_index
    sl.agent_name = f"Agent_{step_id}"
    sl.timestamp = "2024-01-01T00:00:00+00:00"
    sl.input = "task"
    sl.rendered_context = ""
    sl.system_prompt = ""
    sl.model = "test-model"
    sl.output = output
    sl.status = "success"
    sl.source = "executed"
    sl.raw_response = {}
    sl.prompt_version = "v1"
    sl.metadata = {}
    sl.quality_score = None
    return sl


def _make_run_log(run_id: str, step_ids: list[str]) -> MagicMock:
    """构建包含多步骤的 RunLog mock。"""
    rl = MagicMock()
    rl.run_id = run_id
    rl.task_input = "test task input"
    rl.flow_name = "test_flow"
    rl.steps = [
        _make_step_log(sid, i, output=f"output_{sid}")
        for i, sid in enumerate(step_ids)
    ]
    return rl


class TestDagRerun:
    """FlowEngine._rerun_from_dag() 单元测试（mock 掉文件 IO 和模型调用）。"""

    # ── 辅助方法 ──────────────────────────────────────────────────

    def _build_engine(self, step_configs: list[dict]) -> "FlowEngine":
        """用最小配置构建一个 FlowEngine，跳过文件加载和 Agent 初始化。"""
        from src.flow_engine import FlowEngine

        engine = object.__new__(FlowEngine)
        engine.step_configs = step_configs
        engine.flow_name = "test_flow"
        engine.config_path = "config/test.yaml"
        engine.config = {
            "flow_name": "test_flow",
            "steps": step_configs,
            "output_fields": ["result"],
        }
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
        engine.output_fields = ["result"]

        # mock Harness 组件
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
        engine._assertions.check_post.return_value = MagicMock(
            all_passed=True, hard_failures=[]
        )
        engine._assertions.check_propagation.return_value = MagicMock(warnings=[])
        engine._guard = MagicMock()
        engine._guard.pre_check.return_value = MagicMock(
            passed=True, action="pass", issues=[], compressed_context=None
        )
        engine._guard.post_check.return_value = MagicMock(
            passed=True, action="pass", issues=[]
        )
        engine._hooks = {"before_step": [], "after_step": [], "on_step_error": []}

        # 为每个 step 创建一个 Agent mock
        engine.agents = []
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
                "output": f"new_output_{sc['id']}",
                "model": "test-model",
                "prompt": f"prompt_{sc['id']}",
                "raw_response": {},
            }
            engine.agents.append(a)

        engine.default_adapter = MagicMock()
        return engine

    # ── 测试用例 ──────────────────────────────────────────────────

    def test_dag_rerun_identifies_ancestors_correctly(self):
        """重跑 task3 时，task1 和 task2 应被识别为祖先（继承），task3 重新执行。

        DAG 结构: task1 → task2 → task3
        """
        step_configs = [
            {"id": "task1", "name": "T1"},
            {"id": "task2", "name": "T2", "depends_on": ["task1"]},
            {"id": "task3", "name": "T3", "depends_on": ["task2"]},
        ]
        engine = self._build_engine(step_configs)

        old_run = _make_run_log("old_run_001", ["task1", "task2", "task3"])

        inherited_ids: list[str] = []
        executed_ids: list[str] = []

        real_save_step = None

        def fake_execute_step(agent, i, run_id, context, task_input, **kwargs):
            executed_ids.append(agent.step_id)
            from src.step_log import StepLog
            sl = MagicMock(spec=StepLog)
            sl.step_id = agent.step_id
            sl.step_index = i
            sl.agent_name = agent.name
            sl.timestamp = "2024-01-01T00:00:00+00:00"
            sl.output = f"new_output_{agent.step_id}"
            sl.status = "success"
            sl.prompt_version = "v1"
            sl.quality_score = None
            sl.metadata = {}
            return sl, 0.1

        with (
            patch("src.flow_engine.load_run", return_value=old_run),
            patch("src.flow_engine.save_step") as mock_save,
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
            patch.object(engine, "_execute_step", side_effect=fake_execute_step),
            patch("src.flow_engine._parse_qa_output", return_value=({"result": "ok"}, None)),
        ):
            result = engine.rerun_from(run_id="old_run_001", step_id="task3")

        # task1, task2 被继承（source='inherited'），task3 重新执行
        assert "task3" in executed_ids, "task3 应被重新执行"
        assert "task1" not in executed_ids, "task1 是祖先，不应被重新执行"
        assert "task2" not in executed_ids, "task2 是祖先，不应被重新执行"

        # save_step 应被调用 2 次（2 个继承步骤；执行步骤内部的 save_step 被 _execute_step mock 拦截）
        assert mock_save.call_count >= 2

        # 检查继承步骤的 source 字段
        inherited_calls = [
            c for c in mock_save.call_args_list
            if hasattr(c.args[0], "source") and c.args[0].source == "inherited"
        ]
        assert len(inherited_calls) == 2, (
            f"应有 2 个 inherited step，实际 save_step 调用: {mock_save.call_args_list}"
        )

    def test_dag_rerun_executes_descendants_after_target(self):
        """重跑 task2 时，task2 和 task3（后继）都应重新执行。

        DAG: task1 → task2 → task3
        """
        step_configs = [
            {"id": "task1", "name": "T1"},
            {"id": "task2", "name": "T2", "depends_on": ["task1"]},
            {"id": "task3", "name": "T3", "depends_on": ["task2"]},
        ]
        engine = self._build_engine(step_configs)
        old_run = _make_run_log("old_run_002", ["task1", "task2", "task3"])

        executed_ids: list[str] = []

        def fake_execute_step(agent, i, run_id, context, task_input, **kwargs):
            executed_ids.append(agent.step_id)
            from src.step_log import StepLog
            sl = MagicMock(spec=StepLog)
            sl.step_id = agent.step_id
            sl.step_index = i
            sl.agent_name = agent.name
            sl.timestamp = "2024-01-01T00:00:00+00:00"
            sl.output = f"new_output_{agent.step_id}"
            sl.status = "success"
            sl.prompt_version = "v1"
            sl.quality_score = None
            sl.metadata = {}
            return sl, 0.1

        with (
            patch("src.flow_engine.load_run", return_value=old_run),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
            patch.object(engine, "_execute_step", side_effect=fake_execute_step),
            patch("src.flow_engine._parse_qa_output", return_value=({"result": "ok"}, None)),
        ):
            engine.rerun_from(run_id="old_run_002", step_id="task2")

        # task1 继承，task2 和 task3 重新执行（task3 是 task2 的后继）
        assert "task1" not in executed_ids, "task1 是祖先，不应被执行"
        assert "task2" in executed_ids, "task2（目标步骤）应被执行"
        assert "task3" in executed_ids, "task3（后继步骤）应被执行"

        # 拓扑顺序：task2 在 task3 之前
        assert executed_ids.index("task2") < executed_ids.index("task3")

    def test_dag_rerun_invalid_step_id_raises(self):
        """传入不存在的 step_id 时应抛 ValueError。"""
        step_configs = [
            {"id": "task1", "name": "T1"},
            {"id": "task2", "name": "T2", "depends_on": ["task1"]},
        ]
        engine = self._build_engine(step_configs)
        old_run = _make_run_log("old_run_003", ["task1", "task2"])

        with (
            patch("src.flow_engine.load_run", return_value=old_run),
            pytest.raises(ValueError, match="nonexistent"),
        ):
            engine.rerun_from(run_id="old_run_003", step_id="nonexistent")

    def test_dag_rerun_none_step_id_reruns_all(self):
        """step_id=None 时应全部重跑（等价于从所有根节点开始）。"""
        step_configs = [
            {"id": "task1", "name": "T1"},
            {"id": "task2", "name": "T2", "depends_on": ["task1"]},
        ]
        engine = self._build_engine(step_configs)
        old_run = _make_run_log("old_run_004", ["task1", "task2"])

        executed_ids: list[str] = []

        def fake_execute_step(agent, i, run_id, context, task_input, **kwargs):
            executed_ids.append(agent.step_id)
            from src.step_log import StepLog
            sl = MagicMock(spec=StepLog)
            sl.step_id = agent.step_id
            sl.step_index = i
            sl.agent_name = agent.name
            sl.timestamp = "2024-01-01T00:00:00+00:00"
            sl.output = f"new_output_{agent.step_id}"
            sl.status = "success"
            sl.prompt_version = "v1"
            sl.quality_score = None
            sl.metadata = {}
            return sl, 0.1

        with (
            patch("src.flow_engine.load_run", return_value=old_run),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
            patch.object(engine, "_execute_step", side_effect=fake_execute_step),
            patch("src.flow_engine._parse_qa_output", return_value=({"result": "ok"}, None)),
        ):
            engine.rerun_from(run_id="old_run_004", step_id=None)

        # 两个步骤都应被重新执行（无祖先可继承）
        assert "task1" in executed_ids
        assert "task2" in executed_ids

    def test_linear_flow_rerun_unaffected(self):
        """线性 flow（无 depends_on）的 rerun_from() 行为不变。

        验证：from_step=1 时，step 0 继承，step 1 重新执行。
        """
        step_configs = [
            {"id": "step_a", "name": "A"},
            {"id": "step_b", "name": "B"},  # 无 depends_on → 线性模式
        ]
        engine = self._build_engine(step_configs)

        # 构造旧 run log（step_log 数量要和 step_configs 匹配）
        old_run = _make_run_log("old_run_linear", ["step_a", "step_b"])

        executed_ids: list[str] = []

        def fake_execute_step(agent, i, run_id, context, task_input, **kwargs):
            executed_ids.append(agent.step_id)
            from src.step_log import StepLog
            sl = MagicMock(spec=StepLog)
            sl.step_id = agent.step_id
            sl.step_index = i
            sl.agent_name = agent.name
            sl.timestamp = "2024-01-01T00:00:00+00:00"
            sl.output = f"new_output_{agent.step_id}"
            sl.status = "success"
            sl.prompt_version = "v1"
            sl.quality_score = None
            sl.metadata = {}
            return sl, 0.1

        with (
            patch("src.flow_engine.load_run", return_value=old_run),
            patch("src.flow_engine.save_step") as mock_save,
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
            patch.object(engine, "_execute_step", side_effect=fake_execute_step),
            patch("src.flow_engine._parse_qa_output", return_value=({"result": "ok"}, None)),
        ):
            engine.rerun_from(run_id="old_run_linear", from_step=1)

        # 线性模式：step_a 继承，step_b 执行
        assert "step_a" not in executed_ids, "step_a 应被继承，不应被执行"
        assert "step_b" in executed_ids, "step_b 应被重新执行"

        # 继承步骤以 source='inherited' 写盘
        inherited_saves = [
            c for c in mock_save.call_args_list
            if hasattr(c.args[0], "source") and c.args[0].source == "inherited"
        ]
        assert len(inherited_saves) == 1
