"""Tests for ``app.agents.ministries`` (roster, prompts, agent invocation).

Fully offline: every test injects a fake ``chat_model`` callable and never
touches environment variables, configuration files, or the network.
"""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError

import pytest

from app.agents.bureaus import BUREAU_PROFILES, bureau_profiles_for
from app.agents.ministries import (
    MINISTRY_POSITIONINGS as EXPORTED_MINISTRY_POSITIONINGS,
)
from app.agents.ministries import BureauOpinion, MinistryOpinion
from app.agents.ministries.agent import MinistryAgentInvocationError, invoke_ministry_agent
from app.agents.ministries.prompts import (
    MINISTRIES,
    MINISTRY_POSITIONINGS,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    MinistryPositioning,
    ministry_routing_guide,
    ministry_synthesis_system_prompt,
    ministry_system_prompt,
)
from app.shiguan.recall import RecallContext, RecallMatch

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
    assert "从下列已全部开放的本部司中选择一个或多个相关司" in prompt
    for profile in bureau_profiles_for(department):
        assert profile.bureau in prompt
        for responsibility in profile.responsibilities:
            assert responsibility in prompt


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
    assert '"rationale": "<本部司级路由判断，不能为空>"' in prompt
    assert '"bureaus": ["<本部司名>"]' in prompt


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


@pytest.mark.parametrize("department", MINISTRIES)
def test_ministry_synthesis_prompt_requires_independent_strict_opinion(department):
    prompt = ministry_synthesis_system_prompt(department)

    assert department in prompt
    assert "部级综合意见" in prompt
    assert "不得只是机械拼接、复述或遗漏司级意见" in prompt
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt
    assert '形如：{"opinion": "<本部补充与综合意见，不能为空>"}' in prompt


def test_ministry_synthesis_prompt_rejects_unknown_department():
    with pytest.raises(ValueError):
        ministry_synthesis_system_prompt("礼仪司")


def test_layered_opinion_types_are_exported():
    bureau_opinion: BureauOpinion = {"bureau": "预算司", "opinion": "预算意见"}
    ministry_opinion: MinistryOpinion = {
        "department": "户部",
        "bureau_opinions": [bureau_opinion],
        "opinion": "户部综合意见",
    }

    assert ministry_opinion["bureau_opinions"] == [bureau_opinion]


def _sequenced_chat_model(responses: list[str], captured=None):
    iterator = iter(responses)

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if captured is not None:
            captured.append(messages)
        return next(iterator)

    return _chat_model


def _route_response(*bureaus: str, rationale: str = "按职责分工办理") -> str:
    return json.dumps(
        {"rationale": rationale, "bureaus": list(bureaus)}, ensure_ascii=False
    )


def test_invoke_ministry_agent_routes_to_one_bureau_and_returns_named_opinion():
    captured_messages: list[list[dict[str, str]]] = []
    chat_model = _sequenced_chat_model(
        [
            _route_response("预算司", rationale="预算司先核定口径"),
            '{"opinion": "  建议追溯预算口径  "}',
            '{"opinion": "  户部建议建立预算复核门禁  "}',
        ],
        captured_messages,
    )

    opinion = invoke_ministry_agent("户部", "制定年度预算", "交户部办理", chat_model)

    assert opinion == {
        "department": "户部",
        "bureau_opinions": [{"bureau": "预算司", "opinion": "建议追溯预算口径"}],
        "opinion": "户部建议建立预算复核门禁",
    }
    assert captured_messages[0][0] == {
        "role": "system",
        "content": ministry_system_prompt("户部"),
    }
    assert "制定年度预算" in captured_messages[0][1]["content"]
    assert "预算司先核定口径" in captured_messages[1][1]["content"]
    synthesis_messages = captured_messages[2]
    assert synthesis_messages[0] == {
        "role": "system",
        "content": ministry_synthesis_system_prompt("户部"),
    }
    synthesis_content = synthesis_messages[1]["content"]
    assert "原始旨意：制定年度预算" in synthesis_content
    assert "丞相判断说明：交户部办理" in synthesis_content
    assert "本部司级路由说明：预算司先核定口径" in synthesis_content
    assert '"bureau": "预算司"' in synthesis_content
    assert '"opinion": "建议追溯预算口径"' in synthesis_content


def test_invoke_ministry_agent_injects_read_only_recall_context(monkeypatch):
    captured_messages: list[list[dict[str, str]]] = []

    monkeypatch.setattr(
        "app.agents.ministries.agent.safe_recall_context_for_department",
        lambda department: RecallContext(
            available=True,
            entries=[
                RecallMatch(
                    archive_id="archive-1",
                    match_reason="仅部门匹配",
                    historical_conclusion="历史结论",
                    evidence_labels=["LIVE"],
                    lessons_learned="历史经验",
                    pitfalls="踩坑教训",
                )
            ],
        ),
    )
    chat_model = _sequenced_chat_model(
        [
            _route_response("预算司"),
            '{"opinion": "预算意见"}',
            '{"opinion": "户部综合意见"}',
        ],
        captured_messages,
    )

    invoke_ministry_agent("户部", "制定年度预算", "交户部办理", chat_model)

    routing_content = captured_messages[0][1]["content"]
    synthesis_content = captured_messages[2][1]["content"]
    assert "史馆旧案召回" in routing_content
    assert "archive-1" in routing_content
    assert "LIVE" in routing_content
    assert "历史经验" in synthesis_content
    assert "踩坑教训" in synthesis_content


def test_invoke_ministry_agent_invokes_multiple_bureaus_serially_in_route_order():
    captured_messages: list[list[dict[str, str]]] = []
    chat_model = _sequenced_chat_model(
        [
            _route_response("技术司", "质量司", "进度司"),
            '{"opinion": "技术可行性意见"}',
            '{"opinion": "质量验收意见"}',
            '{"opinion": "交付排期意见"}',
            '{"opinion": "工部建议按技术、质量、进度三道门禁推进"}',
        ],
        captured_messages,
    )

    opinion = invoke_ministry_agent("工部", "产品交付", "交工部办理", chat_model)

    assert opinion == {
        "department": "工部",
        "bureau_opinions": [
            {"bureau": "技术司", "opinion": "技术可行性意见"},
            {"bureau": "质量司", "opinion": "质量验收意见"},
            {"bureau": "进度司", "opinion": "交付排期意见"},
        ],
        "opinion": "工部建议按技术、质量、进度三道门禁推进",
    }
    invoked_bureaus = [
        messages[0]["content"].split("下属的", 1)[1].split("。", 1)[0]
        for messages in captured_messages[1:-1]
    ]
    assert invoked_bureaus == [
        "技术司",
        "质量司",
        "进度司",
    ]


@pytest.mark.parametrize("profile", BUREAU_PROFILES)
def test_every_one_of_the_39_bureaus_can_be_selected(profile):
    opinion = invoke_ministry_agent(
        profile.department,
        "旨意",
        "丞相判断",
        _sequenced_chat_model(
            [
                _route_response(profile.bureau),
                '{"opinion": "专业意见"}',
                '{"opinion": "部级综合意见"}',
            ]
        ),
    )
    assert opinion == {
        "department": profile.department,
        "bureau_opinions": [{"bureau": profile.bureau, "opinion": "专业意见"}],
        "opinion": "部级综合意见",
    }


def test_all_six_libu_bureaus_use_the_same_route_and_aggregation_mechanism():
    bureaus = [profile.bureau for profile in bureau_profiles_for("礼部")]
    responses = [_route_response(*bureaus)]
    responses.extend(
        json.dumps({"opinion": f"{bureau}意见"}, ensure_ascii=False) for bureau in bureaus
    )
    responses.append('{"opinion": "礼部统筹全部六司形成对外建议"}')

    opinion = invoke_ministry_agent(
        "礼部", "对外沟通", "交礼部办理", _sequenced_chat_model(responses)
    )

    assert opinion == {
        "department": "礼部",
        "bureau_opinions": [
            {"bureau": bureau, "opinion": f"{bureau}意见"} for bureau in bureaus
        ],
        "opinion": "礼部统筹全部六司形成对外建议",
    }


def test_invoke_ministry_agent_unknown_department_raises_value_error():
    with pytest.raises(ValueError):
        invoke_ministry_agent("礼仪司", "旨意", "判断说明", lambda _messages: "unused")


def test_invoke_ministry_agent_model_call_failure_wrapped_with_cause_preserved():
    def _raising_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError("simulated fake-model failure")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent("吏部", "旨意", "判断说明", _raising_chat_model)

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert str(exc_info.value.__cause__) == "simulated fake-model failure"


@pytest.mark.parametrize(
    "invalid_response",
    [
        None,
        True,
        "",
        "   ",
        "not json at all",
        "[]",
        "null",
        '{"rationale": "说明"}',
        '{"rationale": "说明", "bureaus": ["增长司"], "extra": true}',
        '{"rationale": "", "bureaus": ["增长司"]}',
        '{"rationale": 1, "bureaus": ["增长司"]}',
        '{"rationale": [], "bureaus": ["增长司"]}',
        '{"rationale": "说明", "bureaus": []}',
        '{"rationale": "说明", "bureaus": "增长司"}',
        '{"rationale": "说明", "bureaus": [1]}',
        '{"rationale": "说明", "bureaus": [null]}',
        '{"rationale": "说明", "bureaus": ["未知司"]}',
        '{"rationale": "说明", "bureaus": ["预算司"]}',
        '{"rationale": "说明", "bureaus": ["增长司", "增长司"]}',
    ],
)
def test_invoke_ministry_agent_rejects_invalid_bureau_route(invalid_response):
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("兵部", "旨意", "判断说明", lambda _messages: invalid_response)


def test_invalid_route_stops_before_any_bureau_is_called():
    calls = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        calls["value"] += 1
        return _route_response("预算司")

    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("兵部", "旨意", "判断说明", _chat_model)

    assert calls["value"] == 1


def test_bureau_failure_short_circuits_and_is_wrapped_with_sanitized_cause_chain():
    calls = {"value": 0}
    marker = "sk-bureau-secret-112233"

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        calls["value"] += 1
        if calls["value"] == 1:
            return _route_response("预算司", "出纳司", "会计司")
        if calls["value"] == 2:
            return '{"opinion": "预算意见"}'
        raise RuntimeError(f"provider leaked {marker}")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent("户部", "旨意", "判断", _chat_model)

    assert calls["value"] == 3
    assert marker not in str(exc_info.value)
    assert marker not in str(exc_info.value.__cause__)
    assert marker in str(exc_info.value.__cause__.__cause__)


@pytest.mark.parametrize(
    "invalid_response",
    [
        None,
        True,
        "",
        "   ",
        "not json",
        "[]",
        "null",
        "{}",
        '{"opinion": ""}',
        '{"opinion": "   "}',
        '{"opinion": 1}',
        '{"opinion": null}',
        '{"opinion": "综合", "extra": true}',
    ],
)
def test_invalid_ministry_synthesis_fails_closed_after_all_bureaus(invalid_response):
    calls = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]):
        calls["value"] += 1
        responses = [
            _route_response("预算司", "出纳司"),
            '{"opinion": "预算意见"}',
            '{"opinion": "资金意见"}',
            invalid_response,
        ]
        return responses[calls["value"] - 1]

    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent("户部", "旨意", "判断", _chat_model)

    assert calls["value"] == 4


def test_ministry_synthesis_failure_short_circuits_without_returning_partial_result():
    calls: list[list[dict[str, str]]] = []
    marker = "sk-synthesis-secret-778899"

    def _chat_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        if len(calls) == 1:
            return _route_response("预算司")
        if len(calls) == 2:
            return '{"opinion": "预算意见"}'
        raise RuntimeError(f"provider leaked {marker}")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent("户部", "旨意", "判断", _chat_model)

    assert len(calls) == 3
    assert marker not in str(exc_info.value)
    assert marker in str(exc_info.value.__cause__)


def test_reusing_same_callable_for_two_ministry_invocations_does_not_leak_state():
    chat_model = _sequenced_chat_model(
        [
            _route_response("品牌司"),
            '{"opinion": "品牌意见"}',
            '{"opinion": "礼部综合一"}',
            _route_response("体验司"),
            '{"opinion": "体验意见"}',
            '{"opinion": "礼部综合二"}',
        ]
    )

    first = invoke_ministry_agent("礼部", "旨意一", "判断一", chat_model)
    second = invoke_ministry_agent("礼部", "旨意二", "判断二", chat_model)

    assert first == {
        "department": "礼部",
        "bureau_opinions": [{"bureau": "品牌司", "opinion": "品牌意见"}],
        "opinion": "礼部综合一",
    }
    assert second == {
        "department": "礼部",
        "bureau_opinions": [{"bureau": "体验司", "opinion": "体验意见"}],
        "opinion": "礼部综合二",
    }


def test_invoke_ministry_agent_does_not_leak_secret_from_underlying_exception():
    leaking_marker = "sk-ministry-adversarial-should-not-leak-97531"

    def _leaking_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent("刑部", "旨意", "判断说明", _leaking_chat_model)

    assert leaking_marker in str(exc_info.value.__cause__)
    assert leaking_marker not in str(exc_info.value)


def test_ministry_only_passes_evidence_session_to_selected_bureau(monkeypatch):
    session = object()
    bureau_sessions: list[object] = []
    upper_messages: list[list[dict[str, str]]] = []

    def fake_bureau(
        _department,
        _bureau,
        _decree,
        _rationale,
        _model,
        *,
        evidence_session=None,
    ):
        bureau_sessions.append(evidence_session)
        return "bureau opinion"

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent", fake_bureau)
    profile = BUREAU_PROFILES[0]
    model = _sequenced_chat_model(
        [
            _route_response(profile.bureau),
            '{"opinion":"ministry synthesis"}',
        ],
        upper_messages,
    )

    result = invoke_ministry_agent(
        profile.department,
        "decree",
        "chancellor route",
        model,
        evidence_session=session,
    )

    assert result["bureau_opinions"] == [
        {"bureau": profile.bureau, "opinion": "bureau opinion"}
    ]
    assert bureau_sessions == [session]
    assert len(upper_messages) == 2
    assert all("NEEDS_DATA" not in message[0]["content"] for message in upper_messages)
