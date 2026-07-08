"""OutputLinter 单元��试 — Harness L6 输出结构校验器。"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.output_linter import OutputLinter, LintResult


@pytest.fixture
def linter():
    return OutputLinter()


# ─── required_sections ────────────────────────────────────

class TestRequiredSections:
    def test_pass_markdown_headers(self, linter):
        output = "## 客户画像\n内容\n## 核心需求\n内容"
        rules = [{"type": "required_sections", "sections": ["客户画像", "核心需求"]}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_pass_bold_headers(self, linter):
        output = "**客户画像**\n内容\n**核心需求**\n内容"
        rules = [{"type": "required_sections", "sections": ["客户画像", "核心需求"]}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_pass_numbered_headers(self, linter):
        output = "1. 客户画像\n内容\n2. 核心需求\n内容"
        rules = [{"type": "required_sections", "sections": ["客户画像", "核心需求"]}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_fail_missing_section(self, linter):
        output = "## 客户画像\n内容"
        rules = [{"type": "required_sections", "sections": ["客户画像", "核心需求", "客户等级"]}]
        result = linter.lint(output, rules)
        assert not result.passed
        assert len(result.errors) == 2  # 缺少核心需求和客户等级

    def test_empty_sections_passes(self, linter):
        rules = [{"type": "required_sections", "sections": []}]
        result = linter.lint("任意内容", rules)
        assert result.passed


# ─── min_length / max_length ──────────────────────────────

class TestLength:
    def test_min_length_pass(self, linter):
        output = "这是一段足够长的内容" * 50  # 450 字
        rules = [{"type": "min_length", "chars": 300}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_min_length_fail(self, linter):
        output = "太短了"
        rules = [{"type": "min_length", "chars": 300}]
        result = linter.lint(output, rules)
        assert not result.passed
        assert "过短" in result.errors[0].message

    def test_max_length_pass(self, linter):
        output = "短内容"
        rules = [{"type": "max_length", "chars": 1000}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_max_length_fail(self, linter):
        output = "很长的内容" * 500
        rules = [{"type": "max_length", "chars": 100}]
        result = linter.lint(output, rules)
        assert not result.passed
        assert "过长" in result.errors[0].message


# ─── required_fields ──────────────────────────────────────

class TestRequiredFields:
    def test_pass(self, linter):
        output = "客户等级: S\n预算金额: 500万元"
        rules = [{"type": "required_fields", "fields": ["客户等级", "预算金额"]}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_fail(self, linter):
        output = "客户等级: S"
        rules = [{"type": "required_fields", "fields": ["客户等级", "预算金额"]}]
        result = linter.lint(output, rules)
        assert not result.passed
        assert any("预算金额" in e.message for e in result.errors)


# ─── forbidden_patterns ───────────────────────────────────

class TestForbiddenPatterns:
    def test_pass_no_forbidden(self, linter):
        output = "正常的分析输出"
        rules = [{"type": "forbidden_patterns", "patterns": ["作为AI", "我不确定"]}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_fail_with_forbidden(self, linter):
        output = "作为AI助手，我���为..."
        rules = [{"type": "forbidden_patterns", "patterns": ["作为AI"]}]
        result = linter.lint(output, rules)
        assert not result.passed


# ─── format_regex ─────────────────────────────────────────

class TestFormatRegex:
    def test_must_match_pass(self, linter):
        output = "| 维度 | 分析 |\n|---|---|"
        rules = [{"type": "format_regex", "pattern": r"\|.*\|", "must_match": True}]
        result = linter.lint(output, rules)
        assert result.passed

    def test_must_match_fail(self, linter):
        output = "没有表格的纯文本"
        rules = [{"type": "format_regex", "pattern": r"\|.*\|", "must_match": True,
                  "description": "必须包含Markdown表格"}]
        result = linter.lint(output, rules)
        assert not result.passed


# ─── not_empty / no_refusal ───────────────────────────────

class TestBasicChecks:
    def test_not_empty_pass(self, linter):
        result = linter.lint("有内容", [{"type": "not_empty"}])
        assert result.passed

    def test_not_empty_fail(self, linter):
        result = linter.lint("", [{"type": "not_empty"}])
        assert not result.passed

    def test_not_empty_error_output(self, linter):
        result = linter.lint("[ERROR] model=xxx, error=timeout", [{"type": "not_empty"}])
        assert not result.passed

    def test_no_refusal_pass(self, linter):
        result = linter.lint("## 客户分析\n���常内容", [{"type": "no_refusal"}])
        assert result.passed

    def test_no_refusal_fail(self, linter):
        result = linter.lint("作为AI，我无法完成这个任务", [{"type": "no_refusal"}])
        assert not result.passed


# ─── number_consistency ───────────────────────────────────

class TestNumberConsistency:
    def test_pass_with_matching_numbers(self, linter):
        context = "数据锚点\n- 价格 2.5 元/Wh\n- 预算 500 万元"
        output = "根据数据，价格为 2.5 元/Wh，总预算 500 万元"
        rules = [{"type": "number_consistency"}]
        result = linter.lint(output, rules, context)
        assert result.passed

    def test_warn_no_numbers_referenced(self, linter):
        context = "数据锚点\n- 价格 2.5 元/Wh"
        output = "这是一段没有引用任何数字的文本"
        rules = [{"type": "number_consistency"}]
        result = linter.lint(output, rules, context)
        # number_consistency 默认 severity 是 warning
        assert result.passed  # warnings 不阻止通过
        assert len(result.warnings) > 0

    def test_skip_without_anchors(self, linter):
        context = "没有数据锚点的上下文"
        output = "任意输出"
        rules = [{"type": "number_consistency"}]
        result = linter.lint(output, rules, context)
        assert result.passed


# ─── severity override ────────────────────────────────────

class TestSeverity:
    def test_warning_severity_does_not_fail(self, linter):
        output = "短内容"
        rules = [{"type": "min_length", "chars": 1000, "severity": "warning"}]
        result = linter.lint(output, rules)
        assert result.passed  # warning 不导致失败
        assert len(result.warnings) == 1

    def test_error_severity_fails(self, linter):
        output = "短内容"
        rules = [{"type": "min_length", "chars": 1000, "severity": "error"}]
        result = linter.lint(output, rules)
        assert not result.passed


# ─── build_fix_prompt ─────────────────────────────────────

class TestBuildFixPrompt:
    def test_fix_prompt_not_empty(self, linter):
        output = "太短"
        rules = [{"type": "min_length", "chars": 300}]
        result = linter.lint(output, rules)
        fix = linter.build_fix_prompt(output, result)
        assert "格式校验" in fix
        assert "过短" in fix

    def test_fix_prompt_empty_when_passed(self, linter):
        result = LintResult(passed=True)
        fix = linter.build_fix_prompt("正常", result)
        assert fix == ""


# ─── 多规则组合 ───────────────────────────────────────────

class TestMultipleRules:
    def test_all_pass(self, linter):
        output = "## 客户画像\n" + "详细分析" * 100 + "\n## 核心需求\n内容"
        rules = [
            {"type": "required_sections", "sections": ["客户画像", "核心需求"]},
            {"type": "min_length", "chars": 50},
            {"type": "not_empty"},
        ]
        result = linter.lint(output, rules)
        assert result.passed

    def test_partial_fail(self, linter):
        output = "## 客户画像\n短"
        rules = [
            {"type": "required_sections", "sections": ["客户画像", "核心需求"]},
            {"type": "min_length", "chars": 300},
        ]
        result = linter.lint(output, rules)
        assert not result.passed
        assert len(result.errors) == 2  # 缺少核心需求 + 太短

    def test_no_rules_passes(self, linter):
        result = linter.lint("任意内容", [])
        assert result.passed


# ─── 未知规则类型 ��────────────────────────────────────────

class TestUnknownRule:
    def test_unknown_rule_ignored(self, linter):
        rules = [{"type": "nonexistent_rule_xyz"}]
        result = linter.lint("任意内容", rules)
        assert result.passed  # 未知规则被跳过
