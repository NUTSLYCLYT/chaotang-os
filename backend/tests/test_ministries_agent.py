"""Tests for ``app.agents.ministries`` (roster, prompts, agent invocation).

Fully offline: every test injects a fake ``chat_model`` callable and never
touches environment variables, configuration files, or the network.
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from app.agents.ministries import MINISTRY_POSITIONINGS as EXPORTED_MINISTRY_POSITIONINGS
from app.agents.ministries.agent import MinistryAgentInvocationError, invoke_ministry_agent
from app.agents.ministries.prompts import (
    MINISTRIES,
    MINISTRY_POSITIONINGS,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    MinistryPositioning,
    ministry_routing_guide,
    ministry_system_prompt,
)

EXPECTED_POSITIONINGS = (
    ("吏部", "组织招聘干部台", ("责任人", "组织能力", "绩效偏差", "干部风险"), "人事奏折"),
    (
        "户部",
        "财务决策中台",
        ("现金流", "预算", "报价", "融资", "审计", "投资研究"),
        "可追溯的财务奏折",
    ),
    ("礼部", "品牌与对外沟通中台", ("品牌", "客户沟通", "公关", "内容", "体验"), "稳妥的对外奏折"),
    ("兵部", "销售竞争作战台", ("客户", "商机", "渠道", "竞争", "增长漏斗"), "可执行的攻防奏折"),
    ("刑部", "法务风控案件台", ("合同", "合规", "授权", "安全", "争议"), "有红线的风控奏折"),
    (
        "工部",
        "研发交付流水线",
        ("产品", "技术", "交付", "供应链", "产能", "质量"),
        "可验收的交付奏折",
    ),
)


def test_ministries_roster_is_the_fixed_six_departments():
    assert MINISTRIES == ("吏部", "户部", "礼部", "兵部", "刑部", "工部")


def test_ministry_positionings_are_the_immutable_single_source_of_truth():
    assert (
        tuple(
            (item.department, item.positioning, item.inputs, item.memorial_goal)
            for item in MINISTRY_POSITIONINGS
        )
        == EXPECTED_POSITIONINGS
    )
    assert all(isinstance(item, MinistryPositioning) for item in MINISTRY_POSITIONINGS)
    assert MINISTRIES == tuple(item.department for item in MINISTRY_POSITIONINGS)
    assert len(MINISTRIES) == len(set(MINISTRIES)) == 6
    assert EXPORTED_MINISTRY_POSITIONINGS is MINISTRY_POSITIONINGS

    with pytest.raises(FrozenInstanceError):
        MINISTRY_POSITIONINGS[0].positioning = "不可变更"


@pytest.mark.parametrize(
    ("department", "positioning", "inputs", "memorial_goal"), EXPECTED_POSITIONINGS
)
def test_ministry_prompt_contains_full_enterprise_positioning(
    department, positioning, inputs, memorial_goal
):
    prompt = ministry_system_prompt(department)

    assert f"部定位：{positioning}" in prompt
    for input_term in inputs:
        assert input_term in prompt
    input_scope = f"{'、'.join(inputs[:-1])}和{inputs[-1]}"
    assert f"把{input_scope}转成{memorial_goal}" in prompt
    assert "基于旨意与丞相的判断说明形成专业建议" in prompt
    assert f"整理为{memorial_goal}" in prompt


@pytest.mark.parametrize(
    ("department", "positioning", "inputs", "memorial_goal"), EXPECTED_POSITIONINGS
)
def test_routing_guide_contains_each_complete_positioning(
    department, positioning, inputs, memorial_goal
):
    guide = ministry_routing_guide()

    assert f"{department}：部定位为{positioning}" in guide
    input_scope = f"{'、'.join(inputs[:-1])}和{inputs[-1]}"
    assert f"把{input_scope}转成{memorial_goal}" in guide


def test_routing_guide_has_exactly_one_ordered_line_per_positioning():
    expected_lines = [
        f"- {department}：部定位为{positioning}；"
        f"把{'、'.join(inputs[:-1])}和{inputs[-1]}转成{memorial_goal}。"
        for department, positioning, inputs, memorial_goal in EXPECTED_POSITIONINGS
    ]

    assert ministry_routing_guide().splitlines() == expected_lines


@pytest.mark.parametrize("department", MINISTRIES)
def test_ministry_system_prompt_contains_identity_and_shared_constraint(department):
    prompt = ministry_system_prompt(department)
    assert department in prompt
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt
    assert "只输出一个严格的 JSON 对象" in prompt
    assert '{"opinion": "<你部的办理意见，不能为空>"}' in prompt


@pytest.mark.parametrize(
    "legacy_responsibility",
    (
        "官员选拔",
        "户籍",
        "田赋",
        "典礼",
        "科举",
        "军队调度",
        "边防军务",
        "刑狱",
        "工程营造",
        "水利",
        "屯田",
        "器械制造",
    ),
)
def test_ministry_prompts_do_not_retain_historical_office_responsibilities(
    legacy_responsibility,
):
    all_prompts = "\n".join(ministry_system_prompt(department) for department in MINISTRIES)

    assert legacy_responsibility not in all_prompts


@pytest.mark.parametrize(
    "forbidden_action",
    ("工具", "付款", "任免", "对外发布", "签约", "销售承诺", "生产部署"),
)
def test_shared_constraint_forbids_irreversible_enterprise_actions(forbidden_action):
    assert forbidden_action in NO_IRREVERSIBLE_ACTION_CONSTRAINT
    assert "只能提出专业建议" in NO_IRREVERSIBLE_ACTION_CONSTRAINT


def test_ministry_system_prompt_rejects_unknown_department():
    with pytest.raises(ValueError):
        ministry_system_prompt("礼仪司")


def test_invoke_ministry_agent_sends_expected_messages_and_returns_opinion():
    captured_messages: list[dict[str, str]] = []

    def _capturing_chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return '{"opinion": "建议核对预算与融资条件后再决策"}'

    opinion = invoke_ministry_agent(
        "户部",
        "制定年度预算与融资方案",
        "此事涉及预算与融资，交户部提出建议",
        _capturing_chat_model,
    )

    assert opinion == "建议核对预算与融资条件后再决策"
    assert captured_messages[0] == {
        "role": "system",
        "content": ministry_system_prompt("户部"),
    }
    assert captured_messages[1]["role"] == "user"
    assert "制定年度预算与融资方案" in captured_messages[1]["content"]
    assert "此事涉及预算与融资，交户部提出建议" in captured_messages[1]["content"]


def test_invoke_ministry_agent_strips_whitespace_from_opinion():
    opinion = invoke_ministry_agent(
        "工部",
        "产品交付质量验收",
        "交工部提出建议",
        lambda _messages: '{"opinion": "  可行  "}',
    )
    assert opinion == "可行"


def test_invoke_ministry_agent_unwraps_json_code_fence():
    opinion = invoke_ministry_agent(
        "刑部",
        "评估合同争议与合规风险",
        "交刑部提出风险建议",
        lambda _messages: '```json\n{"opinion": "建议先明确授权边界与合规红线"}\n```',
    )
    assert opinion == "建议先明确授权边界与合规红线"


def test_invoke_ministry_agent_unknown_department_raises_value_error():
    with pytest.raises(ValueError):
        invoke_ministry_agent("礼仪司", "旨意", "判断说明", lambda _messages: '{"opinion": "x"}')


def test_invoke_ministry_agent_model_call_failure_wrapped_with_cause_preserved():
    def _raising_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError("simulated fake-model failure")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent("吏部", "旨意", "判断说明", _raising_chat_model)

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert str(exc_info.value.__cause__) == "simulated fake-model failure"


@pytest.mark.parametrize("empty_response", ["", "   "])
def test_invoke_ministry_agent_rejects_empty_model_response(empty_response):
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("礼部", "旨意", "判断说明", lambda _messages: empty_response)


def test_invoke_ministry_agent_rejects_invalid_json():
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("兵部", "旨意", "判断说明", lambda _messages: "not json at all")


def test_invoke_ministry_agent_rejects_response_missing_opinion_key():
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent(
            "兵部", "旨意", "判断说明", lambda _messages: '{"comment": "无关字段"}'
        )


def test_invoke_ministry_agent_rejects_non_string_opinion():
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("兵部", "旨意", "判断说明", lambda _messages: '{"opinion": 123}')


@pytest.mark.parametrize("empty_opinion", ["", "   "])
def test_invoke_ministry_agent_rejects_empty_opinion(empty_opinion):
    def _chat_model(_messages: list[dict[str, str]]) -> str:
        return f'{{"opinion": "{empty_opinion}"}}'

    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("兵部", "旨意", "判断说明", _chat_model)


def test_invoke_ministry_agent_does_not_leak_secret_from_underlying_exception():
    leaking_marker = "sk-ministry-adversarial-should-not-leak-97531"

    def _leaking_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent("刑部", "旨意", "判断说明", _leaking_chat_model)

    assert leaking_marker in str(exc_info.value.__cause__)
    assert leaking_marker not in str(exc_info.value)
