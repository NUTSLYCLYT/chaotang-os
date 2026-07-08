"""ab_test.py 测试。

覆盖：
- run_ab_test() 并行执行两个变体，返回包含两个结果的 ABTestResult
- 两个变体使用不同配置（mock FlowEngine.run）
- compare_variants：ABTestResult.winner 能识别哪个变体质量更高
- 当其中一个变体失败时的处理（status=error, winner 判断降级）
- ABVariant 构造和字段
- ABTestResult.to_dict() 序列化
- _build_summary() 生成正确的胜者摘要
- _save_ab_result() / load_ab_result() 持久化往返
- list_ab_tests() 返回结果列表
"""

from __future__ import annotations

import json
import sys
import threading
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import src.ab_test as ab_module
from src.ab_test import (
    ABTestResult,
    ABVariant,
    _build_summary,
    _save_ab_result,
    list_ab_tests,
    load_ab_result,
    run_ab_test,
)
from src.quality import QUALITY_DIMENSIONS, QualityScore
from src.step_log import RunLog


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _make_run_log(run_id: str, score_val: int = 4) -> RunLog:
    """构造一个最小化的 RunLog，带质量评分。"""
    scores = {d.name: score_val for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores, overall_comment="测试")
    qs_dict = qs.to_dict()

    run = RunLog(
        run_id=run_id,
        task_input="测试任务",
        flow_name="test_flow",
    )
    run.quality_score = qs_dict
    run.qa_result = {"quality_score": qs_dict}
    return run


def _make_flow_engine_mock(run_log: RunLog):
    """构造 FlowEngine mock，使 run() 返回指定 run_log。"""
    engine_mock = MagicMock()
    engine_mock.run.return_value = run_log
    return engine_mock


# ---------------------------------------------------------------------------
# 1. ABVariant 构造和字段
# ---------------------------------------------------------------------------


def test_ab_variant_construction():
    """ABVariant 应正确存储所有字段。"""
    v = ABVariant(
        label="A",
        config_path="config/flow_opc.yaml",
        qa_version="v2",
    )
    assert v.label == "A"
    assert v.config_path == "config/flow_opc.yaml"
    assert v.qa_version == "v2"
    assert v.status == "pending"
    assert v.run_id is None
    assert v.total_score == 0.0


def test_ab_variant_defaults():
    """ABVariant 默认值应符合预期。"""
    v = ABVariant(label="B", config_path="config/flow.yaml")
    assert v.grade is None
    assert v.run_time == 0.0
    assert v.status == "pending"


# ---------------------------------------------------------------------------
# 2. ABTestResult 构造和 to_dict()
# ---------------------------------------------------------------------------


def test_ab_test_result_construction():
    """ABTestResult 应正确存储基本字段。"""
    va = ABVariant(label="A", config_path="config/a.yaml")
    vb = ABVariant(label="B", config_path="config/b.yaml")
    result = ABTestResult(
        test_id="ab_20250101_120000",
        task_input="任务描述",
        created_at=datetime.now().isoformat(),
        variant_a=va,
        variant_b=vb,
    )
    assert result.test_id == "ab_20250101_120000"
    assert result.winner is None
    assert result.summary == ""


def test_ab_test_result_to_dict():
    """to_dict() 应包含所有关键字段。"""
    va = ABVariant(label="A", config_path="config/a.yaml")
    vb = ABVariant(label="B", config_path="config/b.yaml")
    result = ABTestResult(
        test_id="ab_test_001",
        task_input="需求",
        created_at="2025-01-01T12:00:00",
        variant_a=va,
        variant_b=vb,
        winner="A",
        summary="A胜",
    )
    d = result.to_dict()
    assert d["test_id"] == "ab_test_001"
    assert d["winner"] == "A"
    assert d["summary"] == "A胜"
    assert "variant_a" in d
    assert "variant_b" in d


# ---------------------------------------------------------------------------
# 3. _build_summary() 生成摘要
# ---------------------------------------------------------------------------


def test_build_summary_a_wins():
    """A 获胜时，摘要应包含 'A胜'。"""
    va = ABVariant(label="A", config_path="config/flow_opc.yaml", grade="A", total_score=4.2)
    vb = ABVariant(label="B", config_path="config/flow_product.yaml", grade="B", total_score=3.1)
    result = ABTestResult(
        test_id="t1",
        task_input="test",
        created_at="",
        variant_a=va,
        variant_b=vb,
        winner="A",
        comparison={"total_diff": -1.1},
    )
    summary = _build_summary(result)
    assert "A胜" in summary
    assert "flow_opc" in summary


def test_build_summary_b_wins():
    """B 获胜时，摘要应包含 'B胜'。"""
    va = ABVariant(label="A", config_path="config/flow_a.yaml", grade="B", total_score=3.0)
    vb = ABVariant(label="B", config_path="config/flow_b.yaml", grade="A+", total_score=4.8)
    result = ABTestResult(
        test_id="t2",
        task_input="test",
        created_at="",
        variant_a=va,
        variant_b=vb,
        winner="B",
        comparison={"total_diff": 1.8},
    )
    summary = _build_summary(result)
    assert "B胜" in summary


def test_build_summary_tie():
    """平局时，摘要应包含 '平局'。"""
    va = ABVariant(label="A", config_path="config/flow_a.yaml", grade="B", total_score=3.5)
    vb = ABVariant(label="B", config_path="config/flow_b.yaml", grade="B", total_score=3.5)
    result = ABTestResult(
        test_id="t3",
        task_input="test",
        created_at="",
        variant_a=va,
        variant_b=vb,
        winner="tie",
        comparison={"total_diff": 0.0},
    )
    summary = _build_summary(result)
    assert "平局" in summary


# ---------------------------------------------------------------------------
# 4. run_ab_test() 并行执行，返回正确的 ABTestResult
# ---------------------------------------------------------------------------


def test_run_ab_test_both_succeed(tmp_path: Path):
    """两个变体都成功时，ABTestResult 应有 winner 和 comparison。"""
    run_log_a = _make_run_log("run_A_001", score_val=4)  # score 4 -> A 级
    run_log_b = _make_run_log("run_B_001", score_val=3)  # score 3 -> B 级

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        with patch("src.ab_test.FlowEngine") as MockEngine:
            # 根据 config_path 返回不同 engine
            def engine_factory(config_path, qa_version=None):
                if "config_a" in config_path:
                    m = MagicMock()
                    m.run.return_value = run_log_a
                    return m
                else:
                    m = MagicMock()
                    m.run.return_value = run_log_b
                    return m

            MockEngine.side_effect = engine_factory

            result = run_ab_test(
                task_input="测试任务",
                config_a="config_a.yaml",
                config_b="config_b.yaml",
            )

    assert isinstance(result, ABTestResult)
    assert result.variant_a.status == "success"
    assert result.variant_b.status == "success"
    assert result.winner is not None
    assert result.winner in ("A", "B", "tie")
    assert result.comparison is not None


def test_run_ab_test_uses_different_configs(tmp_path: Path):
    """两个变体应使用不同的 config_path 构建 FlowEngine。"""
    run_log_a = _make_run_log("run_A_002")
    run_log_b = _make_run_log("run_B_002")

    config_paths_used = []

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        with patch("src.ab_test.FlowEngine") as MockEngine:
            def engine_factory(config_path, qa_version=None):
                config_paths_used.append(config_path)
                m = MagicMock()
                m.run.return_value = run_log_a if "config_a" in config_path else run_log_b
                return m

            MockEngine.side_effect = engine_factory

            run_ab_test(
                task_input="任务",
                config_a="path/config_a.yaml",
                config_b="path/config_b.yaml",
            )

    # 确认两次 FlowEngine 调用使用了不同的配置
    assert len(config_paths_used) == 2
    assert config_paths_used[0] != config_paths_used[1]


def test_run_ab_test_a_wins_when_a_higher_score(tmp_path: Path):
    """A 分数更高时，winner 应为 'A'。"""
    run_log_a = _make_run_log("run_A_high", score_val=5)  # 高分
    run_log_b = _make_run_log("run_B_low", score_val=1)   # 低分

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        with patch("src.ab_test.FlowEngine") as MockEngine:
            call_count = [0]

            def engine_factory(config_path, qa_version=None):
                call_count[0] += 1
                m = MagicMock()
                # 第一次调用是 A，第二次是 B（线程顺序不固定，通过 config_path 区分）
                if "config_a" in config_path:
                    m.run.return_value = run_log_a
                else:
                    m.run.return_value = run_log_b
                return m

            MockEngine.side_effect = engine_factory

            result = run_ab_test(
                task_input="任务",
                config_a="config_a.yaml",
                config_b="config_b.yaml",
            )

    # A 分数 5.0 vs B 分数 1.0，差值远超 0.5，winner 应为 A
    assert result.winner == "A"


# ---------------------------------------------------------------------------
# 5. 一个变体失败时的处理
# ---------------------------------------------------------------------------


def test_run_ab_test_one_variant_fails(tmp_path: Path):
    """B 抛异常时，B.status=error，summary 应提示对比失败。"""
    run_log_a = _make_run_log("run_A_ok")

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        with patch("src.ab_test.FlowEngine") as MockEngine:
            def engine_factory(config_path, qa_version=None):
                m = MagicMock()
                if "config_a" in config_path:
                    m.run.return_value = run_log_a
                else:
                    m.run.side_effect = RuntimeError("模型调用失败")
                return m

            MockEngine.side_effect = engine_factory

            result = run_ab_test(
                task_input="任务",
                config_a="config_a.yaml",
                config_b="config_b.yaml",
            )

    assert result.variant_a.status == "success"
    assert result.variant_b.status == "error"
    # 无法对比时，summary 应有提示信息
    assert "对比失败" in result.summary or result.winner is None


def test_run_ab_test_both_variants_fail(tmp_path: Path):
    """两个变体都失败时，result.winner 应为 None，summary 含 error 信息。"""
    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        with patch("src.ab_test.FlowEngine") as MockEngine:
            def engine_factory(config_path, qa_version=None):
                m = MagicMock()
                m.run.side_effect = RuntimeError("崩溃了")
                return m

            MockEngine.side_effect = engine_factory

            result = run_ab_test(
                task_input="任务",
                config_a="config_a.yaml",
                config_b="config_b.yaml",
            )

    assert result.variant_a.status == "error"
    assert result.variant_b.status == "error"
    assert result.winner is None
    assert "error" in result.summary.lower() or "失败" in result.summary


# ---------------------------------------------------------------------------
# 6. _save_ab_result / load_ab_result 持久化往返
# ---------------------------------------------------------------------------


def test_save_and_load_ab_result(tmp_path: Path):
    """save 后 load 应返回相同内容。"""
    va = ABVariant(label="A", config_path="c/a.yaml", grade="A", total_score=4.0, status="success")
    vb = ABVariant(label="B", config_path="c/b.yaml", grade="B", total_score=3.2, status="success")
    original = ABTestResult(
        test_id="ab_save_test",
        task_input="持久化测试任务",
        created_at="2025-01-01T00:00:00",
        variant_a=va,
        variant_b=vb,
        winner="A",
        summary="A胜(c/a) A(4.0) vs B(c/b) B(3.2)，总分差+0.80",
        comparison={"score_diffs": {}, "total_diff": 0.8, "analysis": "A更优"},
    )

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        _save_ab_result(original)
        restored = load_ab_result("ab_save_test")

    assert restored is not None
    assert restored.test_id == original.test_id
    assert restored.winner == original.winner
    assert restored.summary == original.summary
    assert restored.variant_a.grade == "A"
    assert restored.variant_b.grade == "B"


def test_load_ab_result_missing_returns_none(tmp_path: Path):
    """文件不存在时 load_ab_result 应返回 None。"""
    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        result = load_ab_result("nonexistent_test_id")
    assert result is None


# ---------------------------------------------------------------------------
# 7. list_ab_tests()
# ---------------------------------------------------------------------------


def test_list_ab_tests_empty_dir(tmp_path: Path):
    """目录不存在时应返回空列表。"""
    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path / "nonexistent"):
        result = list_ab_tests()
    assert result == []


def test_list_ab_tests_returns_summaries(tmp_path: Path):
    """有测试记录时应返回摘要列表。"""
    va = ABVariant(label="A", config_path="c/a.yaml", status="success")
    vb = ABVariant(label="B", config_path="c/b.yaml", status="success")
    r1 = ABTestResult(
        test_id="ab_20250101_100000",
        task_input="任务一" * 30,  # 超过60字符
        created_at="2025-01-01T10:00:00",
        variant_a=va,
        variant_b=vb,
        winner="A",
        summary="A胜",
    )
    r2 = ABTestResult(
        test_id="ab_20250101_110000",
        task_input="任务二",
        created_at="2025-01-01T11:00:00",
        variant_a=va,
        variant_b=vb,
        winner="tie",
        summary="平局",
    )

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        _save_ab_result(r1)
        _save_ab_result(r2)
        results = list_ab_tests()

    assert len(results) == 2
    test_ids = [r["test_id"] for r in results]
    assert "ab_20250101_100000" in test_ids
    assert "ab_20250101_110000" in test_ids

    # task_input 超长时应被截断到 60 字符
    for r in results:
        assert len(r["task_input"]) <= 60


# ---------------------------------------------------------------------------
# 8. on_progress 回调被调用
# ---------------------------------------------------------------------------


def test_run_ab_test_progress_callback(tmp_path: Path):
    """on_progress 回调应被调用，且携带 variant_label。"""
    run_log_a = _make_run_log("run_A_cb")
    run_log_b = _make_run_log("run_B_cb")

    progress_calls = []

    def on_progress(label, si, total, name, elapsed, status):
        progress_calls.append(label)

    with patch.object(ab_module, "AB_TESTS_DIR", tmp_path):
        with patch("src.ab_test.FlowEngine") as MockEngine:
            def engine_factory(config_path, qa_version=None):
                m = MagicMock()

                def fake_run(task_input, on_step_done=None):
                    if on_step_done:
                        on_step_done(0, 1, "step", 0.1, "success")
                    if "config_a" in config_path:
                        return run_log_a
                    return run_log_b

                m.run.side_effect = fake_run
                return m

            MockEngine.side_effect = engine_factory

            run_ab_test(
                task_input="任务",
                config_a="config_a.yaml",
                config_b="config_b.yaml",
                on_progress=on_progress,
            )

    # 两个变体各触发了回调，标签应包含 "A" 和 "B"
    assert "A" in progress_calls
    assert "B" in progress_calls
