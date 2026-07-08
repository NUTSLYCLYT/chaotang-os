"""ContextBudget 单元测试 — Harness L1/L5 上下文预算追踪。"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.context_budget import ContextBudget, BudgetReport


@pytest.fixture
def budget():
    return ContextBudget()


# ─── token 估算 ─��────────────────────────────────────────

class TestEstimateTokens:
    def test_empty_string(self):
        assert ContextBudget.estimate_tokens("") == 0

    def test_chinese_text(self):
        text = "这是一段中文测试文本"  # 9个中文字
        tokens = ContextBudget.estimate_tokens(text)
        assert 4 <= tokens <= 8  # ~6 tokens (9 / 1.5)

    def test_english_text(self):
        text = "This is a test sentence with some words"  # 40 chars
        tokens = ContextBudget.estimate_tokens(text)
        assert 8 <= tokens <= 12  # ~10 tokens (40 / 4)

    def test_mixed_text(self):
        text = "客户需求: Low temperature battery -30°C"
        tokens = ContextBudget.estimate_tokens(text)
        assert tokens > 0

    def test_large_text(self):
        text = "测试内容" * 10000  # 40000 字
        tokens = ContextBudget.estimate_tokens(text)
        assert tokens > 20000  # ~26667 tokens


# ─── model limit 查询 ────────────────────────────────────

class TestModelLimit:
    def test_known_model(self):
        assert ContextBudget.get_model_limit("openai/GLM-5.1") == 128_000

    def test_unknown_model_default(self):
        assert ContextBudget.get_model_limit("unknown/model-xyz") == 128_000

    def test_gpt4o(self):
        assert ContextBudget.get_model_limit("gpt-4o") == 128_000


# ─── pre_check zone 判定 ────────────────────────────────��

class TestPreCheck:
    def test_smart_zone(self, budget):
        # 少量内容，远低于 40%
        report = budget.pre_check("简短的系统提示", "简短的上下文", "openai/GLM-5.1")
        assert report.zone == "smart"
        assert not report.compression_needed
        assert report.utilization_ratio < 0.40

    def test_warning_zone(self, budget):
        # 制造大约 40-60% 利用率
        # GLM-5.1 = 128k tokens, 40% = 51200 tokens ≈ 76800 中文字
        system = "系统提示" * 10000  # ~26667 tokens
        context = "上下文内容" * 15000  # ~40000 tokens (total ~66667 = 52%)
        report = budget.pre_check(system, context, "openai/GLM-5.1")
        assert report.zone in ("warning", "danger")
        assert report.compression_needed

    def test_danger_zone(self, budget):
        # 制造 >60% 利用率
        system = "系统提示" * 20000
        context = "上下文内容" * 40000
        report = budget.pre_check(system, context, "openai/GLM-5.1")
        assert report.zone == "danger"
        assert report.compression_needed
        assert "危险线" in report.compression_suggestion

    def test_report_fields(self, budget):
        report = budget.pre_check("提示", "上下文", "openai/GLM-5.1")
        assert report.system_prompt_tokens > 0
        assert report.context_tokens > 0
        assert report.model_max_tokens == 128_000
        assert report.model == "openai/GLM-5.1"


# ─── post_record ─────────────────────────────────────────

class TestPostRecord:
    def test_record_usage(self, budget):
        report = budget.pre_check("提示", "上下文", "openai/GLM-5.1")
        raw_response = {
            "usage": {
                "prompt_tokens": 500,
                "completion_tokens": 200,
            }
        }
        updated = budget.post_record(report, raw_response)
        assert updated.actual_prompt_tokens == 500
        assert updated.actual_completion_tokens == 200
        assert updated.cost_usd > 0

    def test_empty_response(self, budget):
        report = budget.pre_check("提示", "上下文", "openai/GLM-5.1")
        updated = budget.post_record(report, {})
        assert updated.actual_prompt_tokens == 0
        assert updated.actual_completion_tokens == 0

    def test_cumulative_tracking(self, budget):
        # 模拟两个步骤
        for _ in range(2):
            report = budget.pre_check("提示", "上下文", "openai/GLM-5.1")
            budget.post_record(report, {"usage": {"prompt_tokens": 100, "completion_tokens": 50}})

        assert budget.total_input_tokens == 200
        assert budget.total_output_tokens == 100
        assert len(budget.step_reports) == 2


# ─── run_summary ─────────────────────────────────────────

class TestRunSummary:
    def test_summary_empty(self, budget):
        summary = budget.get_run_summary()
        assert summary["total_steps"] == 0
        assert summary["total_tokens"] == 0

    def test_summary_with_data(self, budget):
        for _ in range(3):
            report = budget.pre_check("提示", "上下文", "openai/GLM-5.1")
            budget.post_record(report, {"usage": {"prompt_tokens": 100, "completion_tokens": 50}})

        summary = budget.get_run_summary()
        assert summary["total_steps"] == 3
        assert summary["total_input_tokens"] == 300
        assert summary["total_output_tokens"] == 150
        assert summary["total_tokens"] == 450
        assert summary["total_cost_usd"] > 0


# ─── to_dict 序列化 ──────────────────────────────────────

class TestSerialization:
    def test_to_dict(self, budget):
        report = budget.pre_check("提示", "上下文", "openai/GLM-5.1")
        d = report.to_dict()
        assert isinstance(d, dict)
        assert "zone" in d
        assert "utilization_ratio" in d
        assert "model" in d
        assert d["model"] == "openai/GLM-5.1"


# ─── 自定义阈值 ──────────────────────────────────────────

class TestCustomThresholds:
    def test_custom_warning_ratio(self):
        budget = ContextBudget(warning_ratio=0.30, danger_ratio=0.50)
        assert budget.warning_ratio == 0.30
        assert budget.danger_ratio == 0.50
