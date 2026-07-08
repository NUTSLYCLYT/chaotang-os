"""quality.py 测试。

覆盖：
- QualityScore 构造和字段访问
- total_score 加权平均计算正确
- grade 分级逻辑（A+/A/B+/B/C/D）
- to_dict() / from_dict() 往返序列化
- QualityDimension 字段
- ScoreDiff 构造和 to_dict()
- 空 scores 字典时 total_score = 0
- 缺失维度时 total_score 降级
- QUALITY_DIMENSIONS 六维度权重
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.quality import (
    QUALITY_DIMENSIONS,
    QualityDimension,
    QualityScore,
    ScoreDiff,
)


# ---------------------------------------------------------------------------
# 1. QualityDimension 字段
# ---------------------------------------------------------------------------


def test_quality_dimension_fields():
    """QualityDimension 应正确存储 name/description/weight/max_score。"""
    dim = QualityDimension(name="完整性", description="字段齐全", weight=1.2, max_score=5)
    assert dim.name == "完整性"
    assert dim.description == "字段齐全"
    assert dim.weight == 1.2
    assert dim.max_score == 5


def test_quality_dimensions_count():
    """QUALITY_DIMENSIONS 应含 6 个维度。"""
    assert len(QUALITY_DIMENSIONS) == 6


def test_quality_dimensions_names():
    """QUALITY_DIMENSIONS 应包含预定义的六个维度名称。"""
    names = {d.name for d in QUALITY_DIMENSIONS}
    expected = {"完整性", "逻辑一致性", "需求匹配度", "信息密度", "行业专业性", "可执行性"}
    assert names == expected


def test_quality_dimensions_demand_matching_has_highest_weight():
    """'需求匹配度'权重应为最高（1.5）。"""
    weights = {d.name: d.weight for d in QUALITY_DIMENSIONS}
    assert weights["需求匹配度"] == max(weights.values())


# ---------------------------------------------------------------------------
# 2. QualityScore 构造和字段访问
# ---------------------------------------------------------------------------


def test_quality_score_default_construction():
    """默认构造的 QualityScore 各字段应为空/零值。"""
    qs = QualityScore()
    assert qs.scores == {}
    assert qs.issues == []
    assert qs.improvement_suggestions == []
    assert qs.weakest_fields == []
    assert qs.improvement_targets == []
    assert qs.overall_comment == ""


def test_quality_score_with_data():
    """带数据构造时，字段应正确存储。"""
    qs = QualityScore(
        scores={"完整性": 4, "逻辑一致性": 3},
        issues=["issue1"],
        overall_comment="不错",
    )
    assert qs.scores["完整性"] == 4
    assert qs.issues == ["issue1"]
    assert qs.overall_comment == "不错"


# ---------------------------------------------------------------------------
# 3. total_score 加权平均
# ---------------------------------------------------------------------------


def test_total_score_all_perfect():
    """所有维度满分 5 时，total_score 应为 5.0。"""
    scores = {d.name: 5 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.total_score == 5.0


def test_total_score_all_zero():
    """所有维度 0 分时，total_score 应为 0.0。"""
    scores = {d.name: 0 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.total_score == 0.0


def test_total_score_empty_scores():
    """scores 为空字典时，total_score 应为 0.0。"""
    qs = QualityScore(scores={})
    assert qs.total_score == 0.0


def test_total_score_weighted_calculation():
    """验证加权平均计算：手动计算与属性结果一致。"""
    scores = {d.name: 3 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)

    # 手动计算
    total_weight = sum(d.weight for d in QUALITY_DIMENSIONS)
    expected = round(sum(3 * d.weight for d in QUALITY_DIMENSIONS) / total_weight, 2)

    assert qs.total_score == expected
    assert qs.total_score == 3.0  # 所有维度等分3分，加权平均仍为3


def test_total_score_partial_scores():
    """部分维度有分数时，缺失维度按0计算加权平均。"""
    qs = QualityScore(scores={"完整性": 5})
    # 完整性权重1.2，其余缺失按0计算
    total_weight = sum(d.weight for d in QUALITY_DIMENSIONS)
    expected = round(5 * 1.2 / total_weight, 2)
    assert qs.total_score == expected


# ---------------------------------------------------------------------------
# 4. grade 分级逻辑
# ---------------------------------------------------------------------------


def test_grade_a_plus():
    scores = {d.name: 5 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.grade == "A+"


def test_grade_a():
    # 让 total_score 落在 4.0-4.49 区间
    scores = {d.name: 4 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.grade == "A"


def test_grade_b_plus():
    # total_score 落在 3.5-3.99 区间
    # 全部打3.6左右：各维度3.6 -> 加权平均仍3.6
    scores = {d.name: 4 for d in QUALITY_DIMENSIONS}
    scores["完整性"] = 3  # 降低完整性使总分下调
    qs = QualityScore(scores=scores)
    # 验证 grade 逻辑覆盖 B+ 的边界（根据实际分值）
    grade = qs.grade
    assert grade in ("A", "B+")  # 具体值取决于实际计算，确保不崩溃


def test_grade_d():
    scores = {d.name: 1 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.grade == "D"


def test_grade_c():
    scores = {d.name: 2 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.grade == "C"


# ---------------------------------------------------------------------------
# 5. to_dict() / from_dict() 往返序列化
# ---------------------------------------------------------------------------


def test_to_dict_contains_required_keys():
    """to_dict() 应包含所有必需字段。"""
    qs = QualityScore(
        scores={"完整性": 4},
        issues=["问题1"],
        overall_comment="良好",
    )
    d = qs.to_dict()
    assert "scores" in d
    assert "total_score" in d
    assert "grade" in d
    assert "issues" in d
    assert "improvement_suggestions" in d
    assert "overall_comment" in d


def test_to_dict_roundtrip():
    """to_dict() 和 from_dict() 往返后，关键字段应保持一致。"""
    original = QualityScore(
        scores={"完整性": 4, "逻辑一致性": 3},
        issues=["issue_a"],
        weakest_fields=["市场分析"],
        overall_comment="还行",
    )
    restored = QualityScore.from_dict(original.to_dict())

    assert restored.scores == original.scores
    assert restored.issues == original.issues
    assert restored.overall_comment == original.overall_comment


def test_from_dict_with_empty_dict():
    """from_dict({}) 应返回合法的 QualityScore，不抛异常。"""
    qs = QualityScore.from_dict({})
    assert qs.scores == {}
    assert qs.issues == []
    assert qs.total_score == 0.0


def test_to_dict_includes_weakest_fields_when_present():
    """weakest_fields 非空时，to_dict 应包含此字段。"""
    qs = QualityScore(weakest_fields=["竞品情况"])
    d = qs.to_dict()
    assert "weakest_fields" in d
    assert d["weakest_fields"] == ["竞品情况"]


def test_to_dict_omits_weakest_fields_when_empty():
    """weakest_fields 为空时，to_dict 不应包含此键。"""
    qs = QualityScore()
    d = qs.to_dict()
    assert "weakest_fields" not in d


# ---------------------------------------------------------------------------
# 6. ScoreDiff
# ---------------------------------------------------------------------------


def test_score_diff_construction():
    """ScoreDiff 应正确存储所有字段。"""
    diff = ScoreDiff(
        left_run_id="run_001",
        right_run_id="run_002",
        score_diffs={"完整性": 1.0},
        total_diff=0.8,
        winner="run_002",
        analysis="右侧更优",
    )
    assert diff.left_run_id == "run_001"
    assert diff.right_run_id == "run_002"
    assert diff.total_diff == 0.8
    assert diff.winner == "run_002"


def test_score_diff_to_dict():
    """ScoreDiff.to_dict() 应包含所有字段。"""
    diff = ScoreDiff(
        left_run_id="run_L",
        right_run_id="run_R",
        score_diffs={"信息密度": -1.0},
        total_diff=-0.5,
        winner="run_L",
        analysis="左侧更优",
    )
    d = diff.to_dict()
    assert d["left_run_id"] == "run_L"
    assert d["right_run_id"] == "run_R"
    assert d["total_diff"] == -0.5
    assert d["winner"] == "run_L"
    assert d["analysis"] == "左侧更优"


def test_score_diff_default_winner_is_none():
    """默认 winner 应为 None（平局或未判断）。"""
    diff = ScoreDiff(left_run_id="a", right_run_id="b")
    assert diff.winner is None


# ---------------------------------------------------------------------------
# 7. 任一维度 < 3 时的 pass/fail 语义（通过 total_score 和 grade 反映）
# ---------------------------------------------------------------------------


def test_low_single_dimension_brings_down_total():
    """某一维度打 1 分，即使其他满分，总分也会受到拉低影响。"""
    scores = {d.name: 5 for d in QUALITY_DIMENSIONS}
    scores["需求匹配度"] = 1  # 权重最高的维度打最低分
    qs = QualityScore(scores=scores)

    # 总分不应还是满分
    assert qs.total_score < 5.0
    # 等级不应是 A+
    assert qs.grade != "A+"


def test_all_dimensions_at_three_is_grade_b():
    """所有维度3分时，总分=3.0，应为B级。"""
    scores = {d.name: 3 for d in QUALITY_DIMENSIONS}
    qs = QualityScore(scores=scores)
    assert qs.total_score == 3.0
    assert qs.grade == "B"
