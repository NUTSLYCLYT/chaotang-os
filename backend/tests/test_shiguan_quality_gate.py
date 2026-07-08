"""史馆入史质量闸单测 — 会审第②刀:低分脏档不得回写 shiguan_annals 污染下游 grounding。

把关人钉死的红线:
  - '综合分恒为0'坑:run_log.quality_score 常只有 scores(6维0-5)无 total_score,
    _qa_overall 必须双路兜底,否则把 case1(好档)连脏档一起判 0 拒死。
  - case1 级分必须被放行(资产保护);case2 级低分必须被拦(防污染)。
全程离线纯函数,不调 LLM。
"""

from __future__ import annotations

from scripts.archive_manager import (
    SHIGUAN_INDEX_MIN_SCORE,
    _passes_quality_gate,
    _qa_overall,
)

# 6 维 QA scores(0-5)
_CASE1_GOOD = {
    "scores": {
        "完整性": 4,
        "逻辑一致性": 4,
        "需求匹配度": 3,
        "信息密度": 3,
        "行业专业性": 4,
        "可执行性": 3,
    }
}
_CASE2_DIRTY = {
    "scores": {
        "完整性": 2,
        "逻辑一致性": 1,
        "需求匹配度": 1,
        "信息密度": 2,
        "行业专业性": 2,
        "可执行性": 1,
    }
}


def test_qa_overall_averages_dims_when_no_total_score():
    """核心防坑:只有 scores 无 total_score 时,综合分必须是均值而非 0。"""
    assert _qa_overall(_CASE1_GOOD) == 3.5  # (4+4+3+3+4+3)/6
    assert _qa_overall(_CASE2_DIRTY) < 2.0


def test_qa_overall_prefers_total_score_when_present():
    assert _qa_overall({"total_score": 4.2, "scores": {"完整性": 1}}) == 4.2


def test_qa_overall_defensive_on_empty_or_garbage():
    assert _qa_overall({}) == 0.0
    assert _qa_overall(None) == 0.0
    assert _qa_overall("garbage") == 0.0
    assert _qa_overall({"scores": {}}) == 0.0


def test_gate_passes_case1_good_archive():
    """资产保护:case1 级好档(综合3.5)必须被放行,不能误杀。"""
    assert _passes_quality_gate(_qa_overall(_CASE1_GOOD)) is True


def test_gate_blocks_case2_dirty_archive():
    """防污染:case2 级低分必须被拦在 grounding 外。"""
    assert _passes_quality_gate(_qa_overall(_CASE2_DIRTY)) is False


def test_gate_threshold_boundary():
    assert _passes_quality_gate(SHIGUAN_INDEX_MIN_SCORE) is True
    assert _passes_quality_gate(SHIGUAN_INDEX_MIN_SCORE - 0.01) is False


def test_default_threshold_is_sane():
    # 默认阈值应落在 0-5 区间且不至于把所有档都拒(case1=3.5 要能过)
    assert 0 < SHIGUAN_INDEX_MIN_SCORE <= 3.5
