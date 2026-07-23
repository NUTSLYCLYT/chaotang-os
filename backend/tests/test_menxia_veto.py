import pytest

from src.menxia_veto import review_route
from src.shangshufang_loop import chancellor_decide_route, draft_edict
from tests.fixtures.chancellor_golden_cases import GOLDEN_CASES

# 已知：以下黄金案例本身就是"确定性规则的已知缺陷"或真正的证据缺口，
# menxia 门下省封驳它们是正确行为，不是误封驳——只锁住不该封驳的那些。
# 见 tests/fixtures/chancellor_golden_cases.py 各案例 notes 字段。
_EXPECTED_VETO_IDS = {
    "gap_03_vague_cooperation",
    "sec_01_stock_advice",
    "capability_01_no_keyword_match",
    "capability_02_ambiguous_general",
    "ambiguity_01_explicit_cluster_word",
    "ambiguity_04_negation",
}


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=lambda c: c["id"])
def test_menxia_veto_does_not_false_positive_golden_cases(case):
    """门下省封驳不能错杀丞相已经用确定性规则批准的黄金案例。

    2026-07-18 实测：_route_has_scope_evidence 曾对 9/33 黄金案例误封驳，
    其中 3 条（simple_02/simple_03/ambiguity_03）是真正的假阳性——丞相已经
    用"整理/草拟/初判类轻量任务"或"显式部门点名"确定性规则批准，门下省却
    因为专业关键词表没覆盖而二次否决。此测试锁住这 3 条不再被错杀，同时
    不改变另外 6 条已知缺陷案例本该被拦的行为。
    """
    edict = draft_edict(case["question"])
    route = chancellor_decide_route(edict)
    if not route.get("departments"):
        pytest.skip("no candidate departments, out of menxia scope")
    result = review_route(route, case["question"])
    if case["id"] in _EXPECTED_VETO_IDS:
        assert result["verdict"] == "封驳", f"{case['id']} 预期仍被封驳(已知缺陷/证据缺口)"
    else:
        assert result["verdict"] == "准奏", (
            f"{case['id']} 被误封驳：{result['veto_reasons']}"
        )


def test_world_cup_route_is_rejected_before_department_dispatch():
    result = review_route(
        {"departments": ["户部", "工部"], "mode": "cluster"},
        "我要去美国看世界杯决赛",
    )
    assert result["verdict"] == "封驳"
    assert "不属于任何部门真实职责范围" in result["veto_reasons"][0]
    assert result["dimensions"]["风险"]["passed"] is False


def test_explicit_department_override_is_not_scope_evidence():
    """客户端指定参审部门只能约束派给谁，不能证明任务属于六部职责。

    P16 review-v1 HIGH:旧实现把 override 写入的 reason marker 直接当作范围
    证据，导致世界杯请求只要附带 ministers=['hu_bu'] 就从封驳变成准奏。
    """
    result = review_route(
        {
            "departments": ["hu_bu"],
            "mode": "direct",
            "reason": "兼容入口明确指定参审部门：hu_bu。",
        },
        "我要去美国看世界杯决赛",
    )

    assert result["verdict"] == "封驳"
    assert "不属于任何部门真实职责范围" in result["veto_reasons"][0]


def test_contract_route_is_approved():
    result = review_route(
        {"departments": ["刑部"], "mode": "direct"},
        "请复核这份合同的违约责任和合规风险",
    )
    assert result["verdict"] == "准奏"
    assert result["reroute_suggestion"] is None


def test_repeated_review_never_auto_approves_while_veto_reasons_remain():
    """R0-REQ-013：门下仍有否决理由时持续阻断，不因达到最大轮次自动准奏。

    2026-07-23 修复前：round_number 达到 3 时无条件转"准奏"，即使 veto_reasons
    仍非空——这是死代码路径(唯一调用方从不传 round_number)但方向是错的，且被
    这条测试锁成了预期行为。现在不存在"轮次"概念，重复审议同一个有效路由，
    结论必须每次都是封驳。"""
    route = {"departments": ["户部", "工部"], "mode": "cluster"}
    task_text = "我要去美国看世界杯决赛"
    for _ in range(5):
        result = review_route(route, task_text)
        assert result["verdict"] == "封驳"
        assert result["veto_reasons"]


def test_menxia_veto_source_has_no_round_based_fail_open() -> None:
    """源码回归哨兵：防止未来有人悄悄重新引入"轮次到了就放行"的逃逸口子。"""
    import inspect

    import src.menxia_veto as menxia_veto_module

    src = inspect.getsource(menxia_veto_module)
    assert "MAX_REVIEW_ROUNDS" not in src
    assert "round_number" not in src
