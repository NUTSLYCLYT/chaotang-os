"""V2-01 井出水验收：lint 自愈"择优"不许把空输出选成最优(干井根因)。

golden-loop 实测：opc lint 失败自愈,但空输出 trivially 过多数规则→错误更少→被选为"最优"
→ 回奏 {} 空。H1-B 修法：非空保底——有料输出永远优于空输出,不让"空错误少"赢。
"""

from __future__ import annotations

from src.flow_engine import MIN_SUBSTANTIVE_LEN, lint_candidate_better


def test_nonempty_beats_empty_even_with_more_errors():
    """有料输出(更多 lint 错误) 必须胜过 空输出(零错误)——这是干井根治。"""
    body = "市场：100MWh冷库储能需求集中在华东；报价：建议毛利≥18%；风险：电芯交期。" * 2
    assert lint_candidate_better(body, 3, "", 0) is True


def test_empty_never_beats_nonempty():
    assert lint_candidate_better("", 0, "有含金量的真分析内容文本超过阈值长度的占位", 5) is False
    assert lint_candidate_better("   \n  ", 0, "有含金量的真分析内容文本超过阈值长度的占位", 5) is False


def test_both_substantive_fewer_errors_wins():
    a = "充分的市场报价风险分析内容一二三四五六七八九十"
    b = "另一份充分的市场报价风险分析内容一二三四五六七八九十"
    assert lint_candidate_better(a, 1, b, 3) is True  # a 错误更少
    assert lint_candidate_better(a, 3, b, 1) is False  # b 错误更少


def test_both_substantive_equal_errors_longer_wins():
    short = "市场报价风险分析内容超过最小阈值长度啦啦啦"
    long = short + "更详尽的下一步建议与证据补充说明文本"
    assert lint_candidate_better(long, 2, short, 2) is True
    assert lint_candidate_better(short, 2, long, 2) is False


def test_min_substantive_threshold_sane():
    assert 8 <= MIN_SUBSTANTIVE_LEN <= 40  # 业务分析步骤的"实质性"下限,别太松也别太严
