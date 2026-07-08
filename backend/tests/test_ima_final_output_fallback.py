from src.flow_engine import _build_ima_final_output


def test_ima_fallback_marks_realtime_unavailable_for_2025_2026_product_query():
    output = _build_ima_final_output("整理宁德时代2025-2026年储能产品发布情况，重点关注低温性能参数")

    assert set(output) == {"检索策略", "检索结果汇总", "知识空白识别", "核心技术洞察", "竞争态势分析", "待归档内容清单"}
    assert "[REAL_TIME_DATA_UNAVAILABLE]" in output["检索策略"]
    assert "禁止虚构" in output["知识空白识别"]
    assert "CATL官网" in output["待归档内容清单"]


def test_ima_fallback_refuses_to_invent_2026_market_numbers():
    output = _build_ima_final_output("整理2026年中国低温储能行业核心技术趋势、主要玩家、市场容量预测")

    assert "2026年市场容量预测需CNESA" in output["知识空白识别"]
    assert "不能捏造2026市场份额" in output["竞争态势分析"]
