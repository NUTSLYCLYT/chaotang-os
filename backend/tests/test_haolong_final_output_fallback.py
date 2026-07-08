from src.flow_engine import _build_haolong_final_output


def test_haolong_fallback_blocks_impossible_low_budget_promise():
    output = _build_haolong_final_output(
        "微信收到一条消息：我们是内蒙古某牧场，冬天-40℃，需要100套户外电源，3周内交货，预算不超过2000元/套"
    )

    assert set(output) == {"线索评分", "客户档案", "触达策略", "沟通话术", "营销内容", "分发计划"}
    assert "B-" in output["线索评分"]
    assert "预算不超过2000元/套与-40℃户外电源严重不匹配" in output["线索评分"]
    assert "禁止承诺3周交货" in output["线索评分"]
    assert "不发送报价单" in output["营销内容"]


def test_haolong_fallback_treats_comment_lead_as_unverified():
    output = _build_haolong_final_output("在36kr某文章评论区看到『有-30℃大批量低温电池需求，深圳客户』")

    assert "综合评级C" in output["线索评分"]
    assert "原文URL或标题" in output["客户档案"]
    assert "应用场景、月需求量" in output["沟通话术"]
