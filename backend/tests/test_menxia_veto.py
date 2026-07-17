from src.menxia_veto import review_route


def test_world_cup_route_is_rejected_before_department_dispatch():
    result = review_route(
        {"departments": ["户部", "工部"], "mode": "cluster"},
        "我要去美国看世界杯决赛",
    )
    assert result["verdict"] == "封驳"
    assert "不属于任何部门真实职责范围" in result["veto_reasons"][0]
    assert result["dimensions"]["风险"]["passed"] is False


def test_contract_route_is_approved():
    result = review_route(
        {"departments": ["刑部"], "mode": "direct"},
        "请复核这份合同的违约责任和合规风险",
    )
    assert result["verdict"] == "准奏"
    assert result["reroute_suggestion"] is None


def test_third_round_is_bounded_and_allows_progress():
    result = review_route(
        {"departments": ["户部", "工部"], "mode": "cluster"},
        "我要去美国看世界杯决赛",
        round_number=3,
    )
    assert result["verdict"] == "准奏"
    assert result["veto_reasons"]
