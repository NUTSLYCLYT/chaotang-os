"""SwarmOrchestrator 蜂群编排器测试。

使用 mock 替代真实模型调用，验证编排逻辑。
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.event_bus import EventBus, Event
from src.swarm_orchestrator import (
    SwarmOrchestrator,
    SwarmDef,
    EventBinding,
    _transform_output_to_input,
)
from src.step_log import RunLog, StepLog


# ── fixtures ────────────────────────────────────────────────────────


def _make_run_log(run_id="test_run", task_input="测试任务", final_output=None, quality_score=None):
    """创建一个模拟的 RunLog。"""
    rl = RunLog(run_id=run_id, task_input=task_input, flow_name="test_flow")
    rl.final_output = final_output or {
        "客户背景": "测试客户背景",
        "核心需求": "测试核心需求",
        "市场分析": "测试市场分析",
    }
    rl.quality_score = quality_score or {
        "scores": {"完整性": 4.0, "逻辑一致性": 3.5},
        "total_score": 3.75,
        "grade": "B+",
    }
    rl.steps = [
        StepLog(
            run_id=run_id, step_index=0, step_id="step0",
            agent_name="测试Agent", timestamp="2026-01-01T00:00:00",
            input=task_input, rendered_context=task_input,
            system_prompt="test prompt", model="test_model",
            output="测试输出", status="success",
        )
    ]
    return rl


# ── 数据转换测试 ─────────────────────────────────────────────────────


def test_transform_auto():
    """auto 模式将 final_output 渲染为结构化文本。"""
    run_log = _make_run_log()
    source = SwarmDef(swarm_id="src", name="源蜂群", config_path="x.yaml")
    target = SwarmDef(swarm_id="tgt", name="目标蜂群", config_path="y.yaml")

    result = _transform_output_to_input(run_log, source, target, "auto")

    assert "源蜂群" in result
    assert "测试客户背景" in result
    assert "测试核心需求" in result


def test_transform_passthrough():
    """passthrough 模式直接返回原始 task_input。"""
    run_log = _make_run_log(task_input="原始输入")
    source = SwarmDef(swarm_id="src", name="源", config_path="x.yaml")
    target = SwarmDef(swarm_id="tgt", name="目标", config_path="y.yaml")

    result = _transform_output_to_input(run_log, source, target, "passthrough")
    assert result == "原始输入"


def test_transform_specific_key():
    """指定 key 提取 final_output 中的特定字段。"""
    run_log = _make_run_log()
    source = SwarmDef(swarm_id="src", name="源", config_path="x.yaml")
    target = SwarmDef(swarm_id="tgt", name="目标", config_path="y.yaml")

    result = _transform_output_to_input(run_log, source, target, "核心需求")
    assert "测试核心需求" in result


def test_transform_no_final_output():
    """无 final_output 时使用最后一步的原始输出。"""
    run_log = _make_run_log()
    run_log.final_output = None
    source = SwarmDef(swarm_id="src", name="源", config_path="x.yaml")
    target = SwarmDef(swarm_id="tgt", name="目标", config_path="y.yaml")

    result = _transform_output_to_input(run_log, source, target, "auto")
    assert result == "测试输出"


# ── EventBinding 事件触发测试 ────────────────────────────────────────


def test_event_binding_triggers_swarm():
    """事件触发下游蜂群执行。"""
    orch = SwarmOrchestrator()

    # 注册蜂群
    orch.register_swarm(SwarmDef("a", "蜂群A", "config/flow_opc.yaml"))
    orch.register_swarm(SwarmDef("b", "蜂群B", "config/flow_opc.yaml"))

    # 添加绑定: a_completed → 触发 b
    orch.add_binding(EventBinding(
        topic="a_completed",
        target_swarm="b",
        transform="auto",
    ))

    # mock FlowEngine.run 避免真实模型调用
    mock_run_log = _make_run_log(run_id="mock_b_run")

    with patch("src.swarm_orchestrator.FlowEngine") as MockEngine:
        mock_instance = MagicMock()
        mock_instance.run.return_value = mock_run_log
        MockEngine.return_value = mock_instance

        session = orch.run(task_input="测试", entry_swarm="a")

    # 验证: a 和 b 都应该被执行
    swarm_ids = [r.swarm_id for r in session.swarm_runs]
    assert "a" in swarm_ids
    assert "b" in swarm_ids


def test_quality_gate_blocks():
    """质量门控阻止不达标的下游触发。"""
    orch = SwarmOrchestrator()
    orch.register_swarm(SwarmDef("a", "蜂群A", "config/flow_opc.yaml"))
    orch.register_swarm(SwarmDef("b", "蜂群B", "config/flow_opc.yaml"))

    # 设置高门控: 要求 4.0 分以上
    orch.add_binding(EventBinding(
        topic="a_completed",
        target_swarm="b",
        min_quality_score=4.0,
    ))

    # a 的质量分只有 3.5
    mock_run_log = _make_run_log()
    mock_run_log.quality_score = {
        "total_score": 3.5,
        "grade": "B+",
    }

    with patch("src.swarm_orchestrator.FlowEngine") as MockEngine:
        mock_instance = MagicMock()
        mock_instance.run.return_value = mock_run_log
        MockEngine.return_value = mock_instance

        session = orch.run(task_input="测试", entry_swarm="a")

    # b 应该被 skip
    b_runs = [r for r in session.swarm_runs if r.swarm_id == "b"]
    assert len(b_runs) == 1
    assert b_runs[0].status == "skipped"
    assert "质量门控" in b_runs[0].error


def test_disabled_binding_not_triggered():
    """disabled 的绑定不触发。"""
    orch = SwarmOrchestrator()
    orch.register_swarm(SwarmDef("a", "蜂群A", "config/flow_opc.yaml"))
    orch.register_swarm(SwarmDef("b", "蜂群B", "config/flow_opc.yaml"))

    orch.add_binding(EventBinding(
        topic="a_completed",
        target_swarm="b",
        enabled=False,
    ))

    mock_run_log = _make_run_log()

    with patch("src.swarm_orchestrator.FlowEngine") as MockEngine:
        mock_instance = MagicMock()
        mock_instance.run.return_value = mock_run_log
        MockEngine.return_value = mock_instance

        session = orch.run(task_input="测试", entry_swarm="a")

    # b 不应该被执行
    b_runs = [r for r in session.swarm_runs if r.swarm_id == "b"]
    assert len(b_runs) == 0


def test_single_swarm_run():
    """run_single 独立运行单个蜂群，不触发事件链。"""
    orch = SwarmOrchestrator()
    orch.register_swarm(SwarmDef("a", "蜂群A", "config/flow_opc.yaml"))
    orch.register_swarm(SwarmDef("b", "蜂群B", "config/flow_opc.yaml"))

    orch.add_binding(EventBinding(
        topic="a_completed",
        target_swarm="b",
    ))

    mock_run_log = _make_run_log()

    with patch("src.swarm_orchestrator.FlowEngine") as MockEngine:
        mock_instance = MagicMock()
        mock_instance.run.return_value = mock_run_log
        MockEngine.return_value = mock_instance

        result = orch.run_single("a", "测试")

    assert result is not None
    # run_single 不应该触发 b（因为没有设置绑定）
    # 验证只有 a 的运行记录
    assert len(orch._session.swarm_runs) == 1
    assert orch._session.swarm_runs[0].swarm_id == "a"


# ── 配置加载测试 ─────────────────────────────────────────────────────


def test_load_config():
    """从 YAML 加载编排器配置。"""
    config_path = Path(__file__).resolve().parent.parent / "config" / "swarm_orchestrator.yaml"
    if not config_path.exists():
        pytest.skip("编排器配置文件不存在")

    orch = SwarmOrchestrator(str(config_path))

    assert "haolong" in orch.swarms
    assert "opc" in orch.swarms
    assert "product" in orch.swarms
    assert len(orch.bindings) >= 2


def test_chain_three_swarms():
    """三蜂群链式执行: A → B → C。"""
    orch = SwarmOrchestrator()
    orch.register_swarm(SwarmDef("a", "A蜂群", "config/flow_opc.yaml"))
    orch.register_swarm(SwarmDef("b", "B蜂群", "config/flow_opc.yaml"))
    orch.register_swarm(SwarmDef("c", "C蜂群", "config/flow_opc.yaml"))

    orch.add_binding(EventBinding(topic="a_completed", target_swarm="b"))
    orch.add_binding(EventBinding(topic="b_completed", target_swarm="c"))

    mock_run_log = _make_run_log()

    with patch("src.swarm_orchestrator.FlowEngine") as MockEngine:
        mock_instance = MagicMock()
        mock_instance.run.return_value = mock_run_log
        MockEngine.return_value = mock_instance

        session = orch.run(task_input="测试", entry_swarm="a")

    # 三个蜂群都应该执行
    swarm_ids = [r.swarm_id for r in session.swarm_runs]
    assert swarm_ids == ["a", "b", "c"]
    assert session.status == "completed"


import threading as _threading


def test_session_file_contains_running_swarm_before_engine_finishes(tmp_path, monkeypatch):
    """A queued API run must be visible before the long FlowEngine call returns."""
    import src.swarm_orchestrator as swarm_orchestrator

    started = _threading.Event()
    release = _threading.Event()
    errors: list[BaseException] = []

    class BlockingEngine:
        def __init__(self, *args, **kwargs):
            pass

        def run(self, task_input, on_step_done=None, run_id=None):
            started.set()
            if not release.wait(timeout=5):
                raise TimeoutError("test did not release BlockingEngine")
            return _make_run_log(run_id=run_id or "pack-rd-done", task_input=task_input)

    monkeypatch.setattr(swarm_orchestrator, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(swarm_orchestrator, "FlowEngine", BlockingEngine)

    orch = swarm_orchestrator.SwarmOrchestrator()
    orch.register_swarm(swarm_orchestrator.SwarmDef("pack_rd", "PACK RD", "config/flow_pack_rd.yaml"))

    def run_orchestrator():
        try:
            orch.run("PACK R&D flow", entry_swarm="pack_rd", session_id="session-running")
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    thread = _threading.Thread(target=run_orchestrator)
    thread.start()

    assert started.wait(timeout=5)
    session_path = tmp_path / "session-running.json"
    assert session_path.exists()

    running = json.loads(session_path.read_text(encoding="utf-8"))
    assert running["status"] == "running"
    assert running["swarm_runs"][0]["swarm_id"] == "pack_rd"
    assert running["swarm_runs"][0]["status"] == "running"
    running_run_id = running["swarm_runs"][0]["run_id"]
    assert running_run_id

    release.set()
    thread.join(timeout=5)
    assert not thread.is_alive()
    assert errors == []

    completed = json.loads(session_path.read_text(encoding="utf-8"))
    assert completed["status"] == "completed"
    assert completed["swarm_runs"][0]["run_id"] == running_run_id
    assert completed["swarm_runs"][0]["status"] == "completed"


class TestParallelEntry:
    """测试多入口蜂群并行启动（C 层）。"""

    def _build_orch_with_two_swarms(self):
        from src.swarm_orchestrator import SwarmOrchestrator, SwarmDef
        orch = SwarmOrchestrator()
        orch.swarms = {
            "swarm_a": SwarmDef("swarm_a", "蜂群A", "config/a.yaml"),
            "swarm_b": SwarmDef("swarm_b", "蜂群B", "config/b.yaml"),
        }
        orch._parallel_workers = 3
        orch._parallel_entry = ["swarm_a", "swarm_b"]
        orch._threads = []
        orch._threads_lock = _threading.Lock()
        return orch

    def test_parallel_entry_runs_both_swarms(self):
        """parallel_entry 时，两个入口蜂群都应被执行。"""
        orch = self._build_orch_with_two_swarms()
        executed = []
        lock = _threading.Lock()

        def fake_run(swarm_id, task_input, triggered_by="manual"):
            with lock:
                executed.append(swarm_id)

        with patch.object(orch, "_run_single_swarm", side_effect=fake_run):
            orch._run_parallel_entry("测试任务")

        assert set(executed) == {"swarm_a", "swarm_b"}

    def test_parallel_entry_empty_list_raises(self):
        """空 parallel_entry 列表应抛 ValueError。"""
        from src.swarm_orchestrator import SwarmOrchestrator
        orch = SwarmOrchestrator()
        orch.swarms = {}
        orch._parallel_entry = []
        with pytest.raises(ValueError, match="parallel_entry"):
            orch._run_parallel_entry("任务")

    def test_parallel_entry_unknown_swarm_raises(self):
        """parallel_entry 引用不存在的 swarm_id 应抛 ValueError。"""
        orch = self._build_orch_with_two_swarms()
        orch._parallel_entry = ["swarm_a", "nonexistent"]
        with pytest.raises(ValueError, match="nonexistent"):
            orch._run_parallel_entry("任务")

    def test_parallel_entry_loaded_from_yaml_config(self, tmp_path):
        """_load_config 应正确解析 execution.parallel_entry 字段。"""
        from src.swarm_orchestrator import SwarmOrchestrator
        cfg = tmp_path / "orch.yaml"
        cfg.write_text("""
swarms:
  - id: "sa"
    name: "蜂群A"
    config: "config/a.yaml"
  - id: "sb"
    name: "蜂群B"
    config: "config/b.yaml"
bindings: []
execution:
  parallel_workers: 2
  parallel_entry:
    - sa
    - sb
""", encoding="utf-8")
        orch = SwarmOrchestrator(config_path=str(cfg))
        assert orch._parallel_workers == 2
        assert orch._parallel_entry == ["sa", "sb"]
