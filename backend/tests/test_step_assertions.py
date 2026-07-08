"""Unit tests for StepAssertions (Harness L3/L6)."""
import pytest
from src.step_assertions import StepAssertions, AssertionReport


@pytest.fixture
def sa():
    return StepAssertions()


# ── check_post ────────────────────────────────────────────

class TestOutputNotEmpty:
    def test_pass(self, sa):
        r = sa.check_post("s1", "有内容的输出", [{"type": "output_not_empty"}])
        assert r.all_passed

    def test_fail_empty(self, sa):
        r = sa.check_post("s1", "   ", [{"type": "output_not_empty"}])
        assert not r.all_passed
        assert r.results[0].severity == "hard_fail"

    def test_fail_error_marker(self, sa):
        r = sa.check_post("s1", "[ERROR] model failed", [{"type": "output_not_empty"}])
        assert not r.all_passed


class TestContainsAll:
    def test_pass(self, sa):
        output = "客户画像：工厂。核心需求：电池。"
        r = sa.check_post("s1", output, [
            {"type": "contains_all", "values": ["客户画像", "核心需求"]}
        ])
        assert r.all_passed

    def test_fail_missing_one(self, sa):
        r = sa.check_post("s1", "客户画像：工厂。", [
            {"type": "contains_all", "values": ["客户画像", "核心需求"]}
        ])
        assert not r.all_passed
        assert "核心需求" in r.results[0].message

    def test_fail_uses_on_fail(self, sa):
        r = sa.check_post("s1", "nothing", [
            {"type": "contains_all", "values": ["客户画像"], "on_fail": "retry"}
        ])
        assert not r.all_passed
        assert r.results[0].severity == "retry"
        assert r.retryable


class TestContainsAny:
    def test_pass_first_match(self, sa):
        r = sa.check_post("s1", "这是报价单", [
            {"type": "contains_any", "values": ["报价单", "方案书"]}
        ])
        assert r.all_passed

    def test_fail_no_match(self, sa):
        r = sa.check_post("s1", "随便内容", [
            {"type": "contains_any", "values": ["报价单", "方案书"]}
        ])
        assert not r.all_passed


class TestMinWordCount:
    def test_pass(self, sa):
        r = sa.check_post("s1", "a" * 100, [{"type": "min_word_count", "count": 50}])
        assert r.all_passed

    def test_fail(self, sa):
        r = sa.check_post("s1", "短", [{"type": "min_word_count", "count": 100}])
        assert not r.all_passed
        assert "字数不足" in r.results[0].message

    def test_boundary_exact(self, sa):
        r = sa.check_post("s1", "x" * 50, [{"type": "min_word_count", "count": 50}])
        assert r.all_passed


class TestJsonExtractable:
    def test_pass(self, sa):
        output = "客户等级：A\n预算：500万元"
        r = sa.check_post("s1", output, [
            {"type": "json_extractable", "fields": ["客户等级", "预算"]}
        ])
        assert r.all_passed

    def test_fail_field_missing(self, sa):
        r = sa.check_post("s1", "没有等级字段", [
            {"type": "json_extractable", "fields": ["客户等级"]}
        ])
        assert not r.all_passed

    def test_colon_variants(self, sa):
        # 支持中文冒号
        r = sa.check_post("s1", "客户等级：A", [
            {"type": "json_extractable", "fields": ["客户等级"]}
        ])
        assert r.all_passed


class TestNoErrorMarker:
    def test_pass_normal(self, sa):
        r = sa.check_post("s1", "正常输出", [{"type": "no_error_marker"}])
        assert r.all_passed

    def test_fail_error_prefix(self, sa):
        r = sa.check_post("s1", "[ERROR] something went wrong", [{"type": "no_error_marker"}])
        assert not r.all_passed


class TestLanguageMatch:
    def test_pass_chinese(self, sa):
        output = "这是一段中文内容，包含大量汉字，用于测试语言检测功能是否正常工作。"
        r = sa.check_post("s1", output, [{"type": "language_match", "language": "zh"}])
        assert r.all_passed

    def test_fail_english_output(self, sa):
        output = "This is a long English output without any Chinese characters at all." * 3
        r = sa.check_post("s1", output, [{"type": "language_match", "language": "zh"}])
        assert not r.all_passed

    def test_short_output_skipped(self, sa):
        # 短输出不足以判断语言
        r = sa.check_post("s1", "OK", [{"type": "language_match", "language": "zh"}])
        # 短输出（2字符），中文占比=0，但长度太短不应强制判断
        # language_match 在 StepAssertions 中检查 < 0.1 即失败，所以这里确认行为
        # 2字 "OK" 全英文，中文占比 0.0 < 0.1 → fail
        assert not r.all_passed


class TestUnknownType:
    def test_skips_unknown(self, sa):
        r = sa.check_post("s1", "output", [{"type": "nonexistent_type"}])
        # 未知断言被跳过，results 为空 → all_passed=True
        assert r.all_passed
        assert len(r.results) == 0


class TestNoAssertions:
    def test_empty_list(self, sa):
        r = sa.check_post("s1", "output", [])
        assert r.all_passed

    def test_none_passed(self, sa):
        r = sa.check_post("s1", "output", None)  # type: ignore
        assert r.all_passed


# ── check_propagation ─────────────────────────────────────

class TestPropagation:
    def test_pass_field_present(self, sa):
        output = "客户等级：A，预算：500万元"
        r = sa.check_propagation("s1", output, [
            {"type": "context_field_required", "field": "客户等级", "downstream": ["market_intel"]}
        ])
        assert r.all_passed

    def test_fail_field_absent(self, sa):
        r = sa.check_propagation("s1", "随便输出", [
            {"type": "context_field_required", "field": "客户等级", "downstream": ["market_intel"]}
        ])
        assert not r.all_passed
        assert "market_intel" in r.results[0].message

    def test_fail_defaults_to_warn(self, sa):
        r = sa.check_propagation("s1", "无等级", [
            {"type": "context_field_required", "field": "客户等级"}
        ])
        assert not r.all_passed
        assert r.results[0].severity == "warn"
        assert len(r.warnings) == 1

    def test_empty_propagation(self, sa):
        r = sa.check_propagation("s1", "output", [])
        assert r.all_passed


# ── AssertionReport helpers ───────────────────────────────

class TestAssertionReport:
    def test_hard_failures_filter(self, sa):
        r = sa.check_post("s1", "", [
            {"type": "output_not_empty", "on_fail": "hard_fail"}
        ])
        assert len(r.hard_failures) == 1
        assert r.retryable is False

    def test_retryable_filter(self, sa):
        r = sa.check_post("s1", "", [
            {"type": "output_not_empty", "on_fail": "retry"}
        ])
        assert r.retryable is True
        assert len(r.hard_failures) == 0

    def test_warnings_filter(self, sa):
        r = sa.check_post("s1", "", [
            {"type": "output_not_empty", "on_fail": "warn"}
        ])
        assert len(r.warnings) == 1
