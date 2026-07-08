"""FlowEngine 核心路径集成测试。

覆盖：
- run() 基础路径（2步 flow，RunLog/StepLog/status/累积上下文）
- run() on_step_done 回调
- GuardRails 预检查阻断路径
- OutputLinter 自愈循环（第一次失败、第二次通过）
- rerun_from() 继承语义（3步 flow，从 step 2 重跑）
- FlowEngine.from_dict() 工厂方法
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest
import yaml

# 确保项目根目录在 sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.flow_engine import FlowEngine
from src.step_log import RunLog, StepLog


# ──────────────────────────────────────────────────────────────────────────────
# 共用 helpers
# ──────────────────────────────────────────────────────────────────────────────

def _write_tmp_flow(tmp_path: Path, steps: list, extra: dict | None = None) -> Path:
    """将 flow config 写成临时 YAML 文件。"""
    config = {
        "flow_name": "测试Flow",
        "default_model": "openai/test-model",
        "steps": steps,
        "output_fields": ["客户背景"],
    }
    if extra:
        config.update(extra)
    p = tmp_path / "flow_test.yaml"
    p.write_text(yaml.dump(config, allow_unicode=True), encoding="utf-8")
    return p


class _FakeResponse:
    """litellm.completion 的最小伪响应对象。

    需要实现 model_dump()，因为 ModelAdapter 在非流式模式下调用 response.model_dump()
    来序列化 raw_response。
    """

    def __init__(self, content: str = "测试输出"):
        self._content = content

    @property
    def choices(self):
        msg = MagicMock()
        msg.content = self._content
        choice = MagicMock()
        choice.message = msg
        return [choice]

    @property
    def usage(self):
        u = MagicMock()
        u.prompt_tokens = 10
        u.completion_tokens = 5
        u.total_tokens = 15
        return u

    @property
    def model(self):
        return "openai/test-model"

    def model_dump(self):
        """ModelAdapter 在 raw_response 序列化时调用此方法。"""
        return {
            "choices": [{"message": {"content": self._content}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            "model": "openai/test-model",
        }


def _make_fake_completion(content: str = "测试输出"):
    """返回一个固定输出的 fake litellm.completion 函数。"""
    def fake_completion(**kwargs):
        return _FakeResponse(content)
    return fake_completion


# ──────────────────────────────────────────────────────────────────────────────
# IO Mock 上下文管理器（统一处理文件写入 mock）
# ──────────────────────────────────────────────────────────────────────────────

def _io_patches():
    """返回用于 patch 文件 IO 的 contextmanager 列表。"""
    return [
        patch("src.flow_engine.save_step"),
        patch("src.flow_engine.save_final_output"),
        patch("src.flow_engine.save_run_meta"),
        # 知识库相关的可选 IO
        patch("src.flow_engine.FlowEngine._do_pre_retrieval", return_value=""),
        patch("src.flow_engine.FlowEngine._do_ima_pre_retrieval", return_value=""),
    ]


# ──────────────────────────────────────────────────────────────────────────────
# 1. run() 基础路径
# ──────────────────────────────────────────────────────────────────────────────

class TestRunBasicPath:
    """2步 flow 基础路径：RunLog、StepLog、status、累积上下文。"""

    @pytest.fixture
    def cfg_path(self, tmp_path):
        steps = [
            {"id": "step_a", "name": "步骤A", "prompt_inline": "你是步骤A，请分析需求。"},
            {"id": "step_b", "name": "步骤B", "prompt_inline": "你是步骤B，请综合输出。"},
        ]
        return _write_tmp_flow(tmp_path, steps)

    def test_run_returns_run_log_with_two_steps(self, cfg_path):
        """run() 应返回 RunLog，steps 有 2 条记录。"""
        with (
            patch("litellm.completion", side_effect=_make_fake_completion("step输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            run_log = engine.run("测试任务")

        assert isinstance(run_log, RunLog)
        assert len(run_log.steps) == 2

    def test_run_step_status_ok(self, cfg_path):
        """每个 StepLog 的 status 应为 'success'。"""
        with (
            patch("litellm.completion", side_effect=_make_fake_completion("step输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            run_log = engine.run("测试任务")

        for step in run_log.steps:
            assert step.status == "success", (
                f"step {step.step_id} status={step.status!r}，期望 'success'"
            )

    def test_run_step2_rendered_context_contains_step1_output(self, cfg_path):
        """step 2 的 rendered_context 应包含 step 1 的输出（累积上下文验证）。"""
        outputs = ["第一步的专属输出内容", "第二步的输出"]
        call_count = [0]

        def fake_completion_seq(**kwargs):
            idx = call_count[0]
            call_count[0] += 1
            return _FakeResponse(outputs[min(idx, len(outputs) - 1)])

        with (
            patch("litellm.completion", side_effect=fake_completion_seq),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            run_log = engine.run("测试任务")

        assert len(run_log.steps) == 2
        step2 = run_log.steps[1]
        # step 2 的 rendered_context 应包含 step 1 的输出
        assert "第一步的专属输出内容" in step2.rendered_context, (
            f"step 2 的 rendered_context 未包含 step 1 输出，实际内容前200字符：{step2.rendered_context[:200]}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 2. run() on_step_done 回调
# ──────────────────────────────────────────────────────────────────────────────

class TestRunCallback:
    """on_step_done 在每步完成后被调用，调用次数等于步骤数。"""

    def test_on_step_done_called_for_each_step(self, tmp_path):
        """2步 flow 应调用 on_step_done 2次。"""
        steps = [
            {"id": "step_a", "name": "A", "prompt_inline": "步骤A"},
            {"id": "step_b", "name": "B", "prompt_inline": "步骤B"},
        ]
        cfg_path = _write_tmp_flow(tmp_path, steps)
        callback = MagicMock()

        with (
            patch("litellm.completion", side_effect=_make_fake_completion()),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            engine.run("测试任务", on_step_done=callback)

        assert callback.call_count == 2, (
            f"on_step_done 期望调用 2 次，实际 {callback.call_count} 次"
        )

    def test_on_step_done_receives_correct_args(self, tmp_path):
        """on_step_done 的第一个参数应为步骤下标，第五个参数为 status。"""
        steps = [
            {"id": "step_a", "name": "A", "prompt_inline": "步骤A"},
        ]
        cfg_path = _write_tmp_flow(tmp_path, steps)
        callback = MagicMock()

        with (
            patch("litellm.completion", side_effect=_make_fake_completion("OK输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            engine.run("测试任务", on_step_done=callback)

        # on_step_done(idx, total, agent_name, elapsed, status, output)
        assert callback.call_count == 1
        args = callback.call_args[0]
        assert args[0] == 0           # idx
        assert args[1] == 1           # total steps
        assert args[4] == "success"   # status


# ──────────────────────────────────────────────────────────────────────────────
# 3. GuardRails 阻断路径
# ──────────────────────────────────────────────────────────────────────────────

class TestGuardRailsBlock:
    """GuardRails.pre_check 返回 passed=False 时，step status 为 'error'，output 含 [GUARD_BLOCK]。"""

    def test_guard_block_sets_error_status(self, tmp_path):
        steps = [
            {"id": "step_a", "name": "A", "prompt_inline": "步骤A"},
        ]
        cfg_path = _write_tmp_flow(tmp_path, steps)

        blocked_result = MagicMock()
        blocked_result.passed = False
        blocked_result.action = "block"
        blocked_result.issues = ["输入包含注入内容"]
        blocked_result.compressed_context = None

        with (
            patch("litellm.completion", side_effect=_make_fake_completion()),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            # 替换 GuardRails.pre_check 使其返回阻断结果
            engine._guard.pre_check = MagicMock(return_value=blocked_result)
            run_log = engine.run("包含恶意注入的任务")

        assert len(run_log.steps) == 1
        step = run_log.steps[0]
        assert step.status == "error", f"期望 status='error'，实际 {step.status!r}"
        assert "[GUARD_BLOCK]" in step.output, (
            f"期望 output 包含 '[GUARD_BLOCK]'，实际: {step.output!r}"
        )

    def test_guard_block_output_contains_issues(self, tmp_path):
        """GuardRails 阻断时，output 中应包含 issues 内容。"""
        steps = [
            {"id": "step_a", "name": "A", "prompt_inline": "步骤A"},
        ]
        cfg_path = _write_tmp_flow(tmp_path, steps)

        blocked_result = MagicMock()
        blocked_result.passed = False
        blocked_result.action = "block"
        blocked_result.issues = ["检测到提示词注入", "内容超长"]
        blocked_result.compressed_context = None

        with (
            patch("litellm.completion", side_effect=_make_fake_completion()),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            engine._guard.pre_check = MagicMock(return_value=blocked_result)
            run_log = engine.run("恶意任务")

        output = run_log.steps[0].output
        assert "检测到提示词注入" in output or "内容超长" in output, (
            f"output 中未找到 issues 内容，output={output!r}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 4. OutputLinter 自愈循环
# ──────────────────────────────────────────────────────────────────────────────

class TestOutputLinterHeal:
    """第一次 lint 失败，第二次通过，验证模型被调用 2 次。"""

    def test_linter_retry_calls_model_twice(self, tmp_path):
        steps = [
            {
                "id": "step_lint",
                "name": "LintStep",
                "prompt_inline": "步骤A",
                # output_rules 触发 linter
                "output_rules": [{"type": "contains", "value": "必须包含此文本"}],
                "lint_max_retries": 1,
            }
        ]
        cfg_path = _write_tmp_flow(tmp_path, steps)

        call_count = [0]
        outputs = ["不符合规则的输出", "必须包含此文本 合规输出"]

        def seq_completion(**kwargs):
            idx = call_count[0]
            call_count[0] += 1
            return _FakeResponse(outputs[min(idx, len(outputs) - 1)])

        # 第一次 lint 失败，第二次通过
        lint_fail = MagicMock()
        lint_fail.passed = False
        lint_fail.errors = [MagicMock(rule={"type": "contains", "value": "必须包含此文本"}, message="缺少必要文本")]

        lint_pass = MagicMock()
        lint_pass.passed = True
        lint_pass.errors = []

        lint_results = [lint_fail, lint_pass]
        lint_call_count = [0]

        def fake_lint(output, rules, rendered):
            idx = lint_call_count[0]
            lint_call_count[0] += 1
            return lint_results[min(idx, len(lint_results) - 1)]

        def fake_build_fix_prompt(output, lint_result):
            return "请修复输出，确保包含：必须包含此文本"

        with (
            patch("litellm.completion", side_effect=seq_completion),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            engine._linter.lint = MagicMock(side_effect=fake_lint)
            engine._linter.build_fix_prompt = MagicMock(side_effect=fake_build_fix_prompt)
            run_log = engine.run("测试任务")

        # 模型应被调用 2 次：第一次正常 + 第一次修复重试
        assert call_count[0] == 2, (
            f"期望模型被调用 2 次，实际 {call_count[0]} 次"
        )
        assert len(run_log.steps) == 1
        # 最终输出应为通过 lint 的版本
        assert "必须包含此文本" in run_log.steps[0].output


# ──────────────────────────────────────────────────────────────────────────────
# 5. rerun_from() 继承语义
# ──────────────────────────────────────────────────────────────────────────────

class TestRerunFrom:
    """3步 flow，从 step 2 重跑：新 run_id、step 0 输出被继承。"""

    @pytest.fixture
    def cfg_path(self, tmp_path):
        steps = [
            {"id": "step_a", "name": "A", "prompt_inline": "步骤A"},
            {"id": "step_b", "name": "B", "prompt_inline": "步骤B"},
            {"id": "step_c", "name": "C", "prompt_inline": "步骤C"},
        ]
        return _write_tmp_flow(tmp_path, steps)

    def _make_step_log(self, run_id: str, step_id: str, step_index: int, output: str) -> StepLog:
        """构建一个最小可用的 StepLog。"""
        return StepLog(
            run_id=run_id,
            step_index=step_index,
            step_id=step_id,
            agent_name=f"Agent_{step_id}",
            timestamp="2024-01-01T00:00:00+00:00",
            input="task",
            rendered_context="",
            system_prompt="",
            model="test-model",
            output=output,
            status="success",
            source="executed",
        )

    def _make_run_log(self, run_id: str) -> RunLog:
        """构建一个完整的 3步 RunLog。"""
        run_log = RunLog(
            run_id=run_id,
            task_input="原始测试任务",
            flow_name="测试Flow",
        )
        run_log.steps = [
            self._make_step_log(run_id, "step_a", 0, "步骤A的原始输出"),
            self._make_step_log(run_id, "step_b", 1, "步骤B的原始输出"),
            self._make_step_log(run_id, "step_c", 2, "步骤C的原始输出"),
        ]
        return run_log

    def test_rerun_from_creates_new_run_id(self, cfg_path):
        """rerun_from() 应生成新的 run_id，不修改原始 run。"""
        original_run = self._make_run_log("original_run_001")

        with (
            patch("src.flow_engine.load_run", return_value=original_run),
            patch("litellm.completion", side_effect=_make_fake_completion("重跑输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            new_run_log = engine.rerun_from("original_run_001", from_step=2)

        assert new_run_log.run_id != "original_run_001", (
            "rerun 应生成新的 run_id，不应等于原始 run_id"
        )

    def test_rerun_from_inherits_step0_output(self, cfg_path):
        """从 step 2 重跑时，step 0 的输出应被继承到新 run 中。"""
        original_run = self._make_run_log("original_run_002")

        with (
            patch("src.flow_engine.load_run", return_value=original_run),
            patch("litellm.completion", side_effect=_make_fake_completion("重跑输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            new_run_log = engine.rerun_from("original_run_002", from_step=2)

        # 新 run_log 至少有 3 步
        assert len(new_run_log.steps) >= 3, (
            f"新 run_log 应至少有 3 步，实际 {len(new_run_log.steps)} 步"
        )
        # step 0 应继承自原始 run
        inherited_step = new_run_log.steps[0]
        assert inherited_step.output == "步骤A的原始输出", (
            f"step 0 应继承原始输出，实际: {inherited_step.output!r}"
        )
        assert inherited_step.source == "inherited", (
            f"step 0 的 source 应为 'inherited'，实际: {inherited_step.source!r}"
        )

    def test_rerun_from_step1_inherited_too(self, cfg_path):
        """从 step 2 重跑时，step 1 也应被继承。"""
        original_run = self._make_run_log("original_run_003")

        with (
            patch("src.flow_engine.load_run", return_value=original_run),
            patch("litellm.completion", side_effect=_make_fake_completion("重跑输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            new_run_log = engine.rerun_from("original_run_003", from_step=2)

        inherited_step1 = new_run_log.steps[1]
        assert inherited_step1.output == "步骤B的原始输出", (
            f"step 1 应继承原始输出，实际: {inherited_step1.output!r}"
        )
        assert inherited_step1.source == "inherited"

    def test_rerun_from_step2_is_re_executed(self, cfg_path):
        """从 step 2 重跑时，step 2 应被重新执行（输出不同于原始）。"""
        original_run = self._make_run_log("original_run_004")

        with (
            patch("src.flow_engine.load_run", return_value=original_run),
            patch("litellm.completion", side_effect=_make_fake_completion("全新重跑输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine(str(cfg_path))
            new_run_log = engine.rerun_from("original_run_004", from_step=2)

        rerun_step = new_run_log.steps[2]
        assert rerun_step.output == "全新重跑输出", (
            f"step 2 应为重新执行的新输出，实际: {rerun_step.output!r}"
        )
        assert rerun_step.source == "executed"


# ──────────────────────────────────────────────────────────────────────────────
# 6. FlowEngine.from_dict() 工厂方法
# ──────────────────────────────────────────────────────────────────────────────

class TestFromDict:
    """from_dict() 工厂方法：用 dict 配置构建 engine，能正常 run。"""

    def test_from_dict_basic_run(self):
        """from_dict() 构建的 engine 可以正常执行 run()。"""
        config = {
            "flow_name": "字典Flow",
            "default_model": "openai/test-model",
            "output_fields": ["结果"],
            "steps": [
                {"id": "step_only", "name": "唯一步骤", "prompt_inline": "你是唯一步骤。"},
            ],
        }

        with (
            patch("litellm.completion", side_effect=_make_fake_completion("字典Flow输出")),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine.from_dict(config)
            run_log = engine.run("字典Flow测试任务")

        assert isinstance(run_log, RunLog)
        assert run_log.flow_name == "字典Flow"
        assert len(run_log.steps) == 1
        assert run_log.steps[0].output == "字典Flow输出"

    def test_from_dict_no_file_access(self):
        """from_dict() 不应访问文件系统（config_path 为 '<in-memory>'）。"""
        config = {
            "flow_name": "内存Flow",
            "default_model": "openai/test-model",
            "output_fields": ["x"],
            "steps": [
                {"id": "s1", "name": "S1", "prompt_inline": "step1"},
            ],
        }
        with (
            patch("litellm.completion", side_effect=_make_fake_completion()),
            patch("src.flow_engine.save_step"),
            patch("src.flow_engine.save_final_output"),
            patch("src.flow_engine.save_run_meta"),
        ):
            engine = FlowEngine.from_dict(config)

        assert engine.config_path == "<in-memory>"
