"""阶段0：30个黄金案例跑现有两套路由器，断言 chancellor_decide_route 的口径，
并记录 chancellor_router.decide 的对照输出（不断言一致，只记录分歧，见方案第14节）。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src import chancellor_router
from src.shangshufang_loop import chancellor_decide_route, draft_edict
from tests.fixtures.chancellor_golden_cases import GOLDEN_CASES

# chancellor_router.decide 需要一份可用蜂群清单；SWARM_DEPARTMENT_MAP 的 key
# 是 shangshufang_loop 里登记的全部蜂群，作为对照用的近似"全量可用"集合。
from src.shangshufang_loop import SWARM_DEPARTMENT_MAP

_AVAILABLE_SWARMS = list(SWARM_DEPARTMENT_MAP.keys())

_DIVERGENCE_LOG_PATH = (
    Path(__file__).parent / "fixtures" / "chancellor_golden_cases_divergence.json"
)


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[c["id"] for c in GOLDEN_CASES])
def test_golden_case_matches_expected_mode(case):
    edict = draft_edict(case["question"])
    route = chancellor_decide_route(edict)

    actual_mode = "direct" if route["mode"] == "direct" else "cluster"
    assert actual_mode == case["expected_mode"], (
        f"{case['id']}: 期望 {case['expected_mode']}，实际 {actual_mode}。"
        f"reason={route.get('reason')}"
    )

    for dept in case.get("expected_departments", []):
        assert (
            dept in route["departments"]
        ), f"{case['id']}: 期望覆盖 {dept}，实际 departments={route['departments']}"

    for dept in case.get("forbidden_departments", []):
        assert (
            dept not in route["departments"]
        ), f"{case['id']}: 不应包含 {dept}，实际 departments={route['departments']}"


def test_golden_cases_record_divergence_between_two_routers():
    """收敛 tripwire（阶段1完成后翻转）：chancellor_router.decide 已委托
    chancellor_decide_route 判 mode，两套路由器 mode 级分歧必须为零。
    任何人再把规则分叉，这里立即红。分歧 JSON 保留落盘作证据（应为 []）。"""
    divergences = []
    for case in GOLDEN_CASES:
        edict = draft_edict(case["question"])
        loop_route = chancellor_decide_route(edict)
        loop_mode = "direct" if loop_route["mode"] == "direct" else "cluster"

        router_decision = chancellor_router.decide(case["question"], _AVAILABLE_SWARMS)
        router_mode = "direct" if router_decision["mode"] == "direct" else "cluster"

        if loop_mode != router_mode:
            divergences.append(
                {
                    "id": case["id"],
                    "question": case["question"],
                    "shangshufang_loop_mode": loop_mode,
                    "shangshufang_loop_departments": loop_route["departments"],
                    "chancellor_router_mode": router_mode,
                    "chancellor_router_ministries": [
                        m["name"]
                        for m in router_decision.get("selected_ministries", [])
                    ],
                }
            )

    _DIVERGENCE_LOG_PATH.write_text(
        json.dumps(divergences, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    assert divergences == [], (
        "两套路由器 mode 级分歧必须为零(阶段1已收敛,decide 委托 chancellor_decide_route)。"
        f"分歧详情见 {_DIVERGENCE_LOG_PATH}"
    )
