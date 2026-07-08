"""execution_mode 功能测试。

覆盖方向A（subprocess）和方向B（LiteLLM）的路由逻辑，
不涉及真实 LiteLLM 或 claude CLI 调用。
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ─── 构造一个最小化的 FlowEngine 实例 ─────────────────────────────────────────

def _make_engine(execution_modes=None, step_id="step_a"):
    """返回一个已初始化但跳过真实 config 加载的 FlowEngine 实例。"""
    from src.flow_engine import FlowEngine

    with patch("builtins.open", MagicMock()), \
         patch("yaml.safe_load", return_value={
             "flow_name": "test_flow",
             "default_model": "openai/test-model",
             "steps": [{"id": step_id, "name": "测试步骤", "prompt_key": "test_prompt"}],
             "output_fields": ["字段A"],
         }), \
         patch.object(FlowEngine, "_load_model_tiers", return_value={}), \
         patch("src.flow_engine.ModelAdapter", MagicMock()), \
         patch("src.flow_engine.ContextBudget", MagicMock()), \
         patch("src.flow_engine.GuardRails", MagicMock()), \
         patch("src.flow_engine.OutputLinter", MagicMock()), \
         patch("src.flow_engine.StepAssertions", MagicMock()), \
         patch("src.flow_engine.RunState", MagicMock()), \
         patch("src.prompt_composer.compose_prompt", return_value="system prompt"), \
         patch("src.flow_engine.Agent", MagicMock()):
        engine = FlowEngine.__new__(FlowEngine)
        engine._execution_modes = execution_modes or {}
        engine._budget = MagicMock()
        engine._guard = MagicMock()
        engine._linter = MagicMock()
        engine._assertions = MagicMock()
        engine.config = {
            "flow_name": "test_flow",
            "steps": [{"id": step_id, "name": "测试步骤", "prompt_key": "test_prompt"}],
        }
        engine.step_configs = [{"id": step_id, "name": "测试步骤", "prompt_key": "test_prompt"}]
        return engine


def _make_agent(step_id="step_a"):
    agent = MagicMock()
    agent.step_id = step_id
    agent.step_index = 0
    agent.name = "测试Agent"
    agent.model = "openai/test-model"
    agent.system_prompt = "你是测试Agent"
    return agent


# ─── 测试用例 ──────────────────────────────────────────────────────────────────


class TestModeBDefaultsToAgentRun:
    """1. 默认模式B，agent.run() 正常调用（现有行为不回归）"""

    def test_mode_b_calls_agent_run(self):
        engine = _make_engine(execution_modes={})
        agent = _make_agent("step_a")
        step_config = {"id": "step_a", "prompt_key": "test_prompt"}

        expected = {"status": "success", "output": "模式B输出"}
        agent.run.return_value = expected

        # 调用引擎内部分支逻辑
        mode = engine._execution_modes.get(agent.step_id, 'B')
        assert mode == 'B'

        if mode == 'A':
            result = engine._execute_subprocess_step(agent, step_config, "rendered", None)
        else:
            result = agent.run("rendered", on_token=None)

        agent.run.assert_called_once_with("rendered", on_token=None)
        assert result == expected

    def test_none_execution_modes_defaults_to_b(self):
        """5. execution_modes=None 时所有步骤走模式B"""
        engine = _make_engine(execution_modes=None)
        assert engine._execution_modes == {}

        agent = _make_agent("step_x")
        mode = engine._execution_modes.get(agent.step_id, 'B')
        assert mode == 'B'


class TestModeASubprocess:
    """2. 模式A：_execute_subprocess_step 被正确调用，解析 stream-json"""

    def _make_proc(self, lines):
        """构造一个假的 subprocess.Popen 对象，逐行输出 lines。"""
        proc = MagicMock()
        proc.returncode = 0
        proc.stdout = io.StringIO("\n".join(lines) + "\n")
        proc.stderr = io.StringIO("")
        proc.poll.return_value = 0
        proc.wait.return_value = 0
        return proc

    @patch("subprocess.run")
    @patch("subprocess.Popen")
    @patch("pathlib.Path.exists", return_value=True)
    @patch("pathlib.Path.read_text", return_value="# SKILL CONTENT")
    def test_mode_a_calls_subprocess(self, mock_read, mock_exists, mock_popen, mock_run):
        """2. 模式A，_execute_subprocess_step 被调用并返回正确结果"""
        # claude --version 返回成功
        mock_run.return_value = MagicMock(returncode=0)

        stream_lines = [
            json.dumps({"type": "text", "text": "hello "}),
            json.dumps({"type": "text", "text": "world"}),
            json.dumps({"type": "result", "result": "hello world", "usage": {"input_tokens": 10}}),
        ]
        proc = self._make_proc(stream_lines)
        mock_popen.return_value = proc

        engine = _make_engine(execution_modes={"step_a": "A"})
        agent = _make_agent("step_a")
        step_config = {"id": "step_a", "prompt_key": "test_prompt", "skill_name": "my-skill"}

        # 需要 select.select 返回可读
        with patch("select.select", return_value=([proc.stdout], [], [])):
            result = engine._execute_subprocess_step(agent, step_config, "task input", None)

        assert result["status"] == "success"
        assert "hello world" in result["output"] or result["output"] == "hello world"

    @patch("subprocess.run")
    @patch("pathlib.Path.exists", return_value=False)
    def test_mode_a_fallback_when_skill_missing(self, mock_exists, mock_run):
        """3. 模式A，skill文件不存在时 fallback 到模式B"""
        mock_run.return_value = MagicMock(returncode=0)

        engine = _make_engine(execution_modes={"step_a": "A"})
        agent = _make_agent("step_a")
        agent.run.return_value = {"status": "success", "output": "fallback output"}
        step_config = {"id": "step_a", "prompt_key": "test_prompt", "skill_name": "no-such-skill"}

        result = engine._execute_subprocess_step(agent, step_config, "task", None)

        agent.run.assert_called_once()
        assert result["status"] == "success"
        assert result["output"] == "fallback output"

    @patch("subprocess.run")
    def test_mode_a_fallback_when_claude_unavailable(self, mock_run):
        """claude CLI 不可用时 fallback 到方向B"""
        mock_run.side_effect = FileNotFoundError("claude not found")

        engine = _make_engine(execution_modes={"step_a": "A"})
        agent = _make_agent("step_a")
        agent.run.return_value = {"status": "success", "output": "fallback B"}
        step_config = {"id": "step_a", "prompt_key": "test_prompt", "skill_name": "my-skill"}

        result = engine._execute_subprocess_step(agent, step_config, "task", None)
        agent.run.assert_called_once()
        assert result["output"] == "fallback B"


class TestMixedModes:
    """4. 混合模式：部分 Agent 用A，部分用B"""

    def test_mixed_modes(self):
        execution_modes = {"step_a": "A", "step_b": "B"}

        engine = _make_engine(execution_modes=execution_modes)
        assert engine._execution_modes.get("step_a", "B") == "A"
        assert engine._execution_modes.get("step_b", "B") == "B"
        assert engine._execution_modes.get("step_c", "B") == "B"

        # step_a -> 走方向A
        agent_a = _make_agent("step_a")
        step_a_config = {"id": "step_a", "skill_name": "my-skill"}
        mock_subprocess_result = {"status": "success", "output": "subprocess output"}

        with patch.object(engine, "_execute_subprocess_step", return_value=mock_subprocess_result) as mock_sub:
            mode = engine._execution_modes.get(agent_a.step_id, "B")
            if mode == "A":
                result_a = engine._execute_subprocess_step(agent_a, step_a_config, "r", None)
            else:
                result_a = agent_a.run("r", on_token=None)
            mock_sub.assert_called_once()

        # step_b -> 走方向B
        agent_b = _make_agent("step_b")
        agent_b.run.return_value = {"status": "success", "output": "litellm output"}
        mode_b = engine._execution_modes.get(agent_b.step_id, "B")
        if mode_b == "A":
            result_b = engine._execute_subprocess_step(agent_b, {}, "r", None)
        else:
            result_b = agent_b.run("r", on_token=None)

        agent_b.run.assert_called_once_with("r", on_token=None)
        assert result_b["output"] == "litellm output"


class TestSubprocessErrors:
    """6/7. 子进程错误和超时处理"""

    def _make_proc_with_exit(self, returncode=1, stderr_text="error occurred"):
        proc = MagicMock()
        proc.returncode = returncode
        proc.stdout = io.StringIO("")
        proc.stderr = io.StringIO(stderr_text)
        proc.poll.return_value = returncode
        proc.wait.return_value = returncode
        return proc

    @patch("subprocess.run")
    @patch("subprocess.Popen")
    @patch("pathlib.Path.exists", return_value=True)
    @patch("pathlib.Path.read_text", return_value="# SKILL")
    def test_subprocess_nonzero_exit_returns_error(self, mock_read, mock_exists, mock_popen, mock_run):
        """6. 子进程返回非0退出码时返回 error status"""
        mock_run.return_value = MagicMock(returncode=0)

        proc = self._make_proc_with_exit(returncode=1, stderr_text="command failed")
        mock_popen.return_value = proc

        engine = _make_engine(execution_modes={"step_a": "A"})
        agent = _make_agent("step_a")
        step_config = {"id": "step_a", "skill_name": "my-skill"}

        with patch("select.select", return_value=([], [], [])):
            # 当 select 返回空时 proc.poll() 返回非0触发结束
            proc.poll.side_effect = [None, 1]
            result = engine._execute_subprocess_step(agent, step_config, "task", None)

        assert result["status"] == "error"

    @patch("subprocess.run")
    @patch("subprocess.Popen")
    @patch("pathlib.Path.exists", return_value=True)
    @patch("pathlib.Path.read_text", return_value="# SKILL")
    def test_subprocess_timeout_returns_error(self, mock_read, mock_exists, mock_popen, mock_run):
        """7. 子进程超时返回 error status"""
        mock_run.return_value = MagicMock(returncode=0)

        proc = MagicMock()
        proc.returncode = None
        proc.stdout = io.StringIO("")
        proc.stderr = io.StringIO("")
        proc.poll.return_value = None
        mock_popen.return_value = proc

        engine = _make_engine(execution_modes={"step_a": "A"})
        agent = _make_agent("step_a")
        step_config = {"id": "step_a", "skill_name": "my-skill"}

        import time as _time

        # 模拟时间快速流逝：第一次调用返回已过期的时间
        original_monotonic = _time.monotonic
        call_count = [0]

        def fast_monotonic():
            call_count[0] += 1
            # 第一次调用（deadline 计算）返回正常时间，之后返回已过期
            if call_count[0] <= 1:
                return original_monotonic()
            return original_monotonic() + 200  # 模拟200秒已过

        with patch("src.flow_engine.time.monotonic", side_effect=fast_monotonic):
            with patch("select.select", return_value=([], [], [])):
                result = engine._execute_subprocess_step(agent, step_config, "task", None)

        assert result["status"] == "error"
        assert "timeout" in result["output"].lower() or "error" in result["status"]


class TestOnTokenCallback:
    """on_token 回调在方向A中正确推送"""

    @patch("subprocess.run")
    @patch("subprocess.Popen")
    @patch("pathlib.Path.exists", return_value=True)
    @patch("pathlib.Path.read_text", return_value="# SKILL")
    def test_on_token_called_for_text_events(self, mock_read, mock_exists, mock_popen, mock_run):
        mock_run.return_value = MagicMock(returncode=0)

        tokens_received = []

        def on_token(step_idx, token):
            tokens_received.append(token)

        stream_lines = [
            json.dumps({"type": "text", "text": "chunk1"}),
            json.dumps({"type": "text", "text": "chunk2"}),
            json.dumps({"type": "result", "result": "chunk1chunk2", "usage": {}}),
        ]
        proc = MagicMock()
        proc.returncode = 0
        proc.stdout = io.StringIO("\n".join(stream_lines) + "\n")
        proc.stderr = io.StringIO("")
        proc.poll.return_value = 0
        proc.wait.return_value = 0
        mock_popen.return_value = proc

        engine = _make_engine(execution_modes={"step_a": "A"})
        agent = _make_agent("step_a")
        step_config = {"id": "step_a", "skill_name": "my-skill"}

        with patch("select.select", return_value=([proc.stdout], [], [])):
            result = engine._execute_subprocess_step(agent, step_config, "task", on_token)

        assert "chunk1" in tokens_received
        assert "chunk2" in tokens_received
        assert result["status"] == "success"
