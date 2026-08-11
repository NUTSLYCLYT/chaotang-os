"""Tests for ``app.agents.ministries`` (roster, prompts, agent invocation).

Fully offline: every test injects a fake ``chat_model`` callable and never
touches environment variables, configuration files, or the network.
"""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError
from types import SimpleNamespace

import pytest

from app.agents.bureaus import BUREAU_PROFILES, bureau_profiles_for
from app.agents.bureaus.prompts import bureau_system_prompt
from app.agents.evidence_protocol import AgentEvidenceSession
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
    return json.dumps({"rationale": rationale, "bureaus": list(bureaus)}, ensure_ascii=False)


def test_required_bureau_is_corrected_once_before_any_bureau_call(monkeypatch):
    invoked: list[tuple[str, str]] = []
    captured: list[list[dict[str, str]]] = []

    def fake_bureau(department, bureau, *_args, **_kwargs):
        invoked.append((department, bureau))
        return f"{bureau}意见"

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent", fake_bureau)
    model = _sequenced_chat_model(
        [
            _route_response("审计司"),
            _route_response("会计司", rationale="纠正为必选司"),
            '{"opinion":"户部综合意见"}',
        ],
        captured,
    )

    result = invoke_ministry_agent(
        "户部",
        "生成财务报表",
        "交户部办理",
        model,
        required_bureaus=("会计司",),
    )

    assert invoked == [("户部", "会计司")]
    assert [item["bureau"] for item in result["bureau_opinions"]] == ["会计司"]
    correction = captured[1]
    assert "会计司" in correction[-1]["content"]
    assert "按职责分工办理" not in correction[-1]["content"]
    assert '"rationale"' in correction[-1]["content"]
    assert '"bureaus"' in correction[-1]["content"]


def test_accounting_report_extra_bureau_is_corrected_to_exact_required_route(
    monkeypatch,
):
    invoked: list[str] = []
    bureau_sessions: list[object | None] = []
    evidence_session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())

    def fake_bureau(_department, bureau, *_args, **kwargs):
        invoked.append(bureau)
        bureau_sessions.append(kwargs.get("evidence_session"))
        return f"{bureau}意见"

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent", fake_bureau)

    result = invoke_ministry_agent(
        "户部",
        "请根据现有财务数据生成2024年至2025年管理层综合财务报表，并交付Excel文件。",
        "交户部办理",
        _sequenced_chat_model(
            [
                _route_response("会计司", "审计司"),
                _route_response("会计司", rationale="纠正为精确承办司"),
                '{"opinion":"户部综合意见"}',
            ]
        ),
        required_bureaus=("会计司",),
        evidence_session=evidence_session,
        report_session=SimpleNamespace(),
    )

    assert invoked == ["会计司"]
    assert [item["bureau"] for item in result["bureau_opinions"]] == ["会计司"]
    assert bureau_sessions == [None]


def test_accounting_report_repeated_extra_bureau_fails_before_any_bureau_call(
    monkeypatch,
):
    bureau_calls: list[str] = []
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: bureau_calls.append("bureau"),
    )

    with pytest.raises(MinistryAgentInvocationError) as caught:
        invoke_ministry_agent(
            "户部",
            "请根据现有财务数据生成2024年至2025年管理层综合财务报表，并交付Excel文件。",
            "交户部办理",
            _sequenced_chat_model(
                    [
                        _route_response("会计司", "审计司"),
                        _route_response("会计司", "审计司"),
                        _route_response("会计司", "审计司"),
                    ]
            ),
            required_bureaus=("会计司",),
        )

    assert caught.value.failure_stage == "bureau"
    assert bureau_calls == []


def test_non_last_price_market_route_preserves_model_order_and_required_bureau(
    monkeypatch,
):
    invoked: list[str] = []
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda _department, bureau, *_args, **_kwargs: invoked.append(bureau) or f"{bureau}意见",
    )

    result = invoke_ministry_agent(
        "户部",
        "分析证券成交量并复核账务",
        "批准户部会计司办理",
        _sequenced_chat_model(
            [
                _route_response("审计司", "会计司"),
                '{"opinion":"户部综合意见"}',
            ]
        ),
        required_bureaus=("会计司",),
    )

    assert invoked == ["审计司", "会计司"]
    assert [item["bureau"] for item in result["bureau_opinions"]] == invoked


def test_required_bureau_second_omission_fails_before_bureau_synthesis_or_report(
    monkeypatch,
):
    bureau_calls: list[str] = []
    report_session = SimpleNamespace(maybe_generate=lambda *_args: pytest.fail("report"))
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: bureau_calls.append("bureau"),
    )
    model = _sequenced_chat_model(
        [
            _route_response("审计司"),
            _route_response("预算司"),
            _route_response("审计司"),
        ]
    )

    with pytest.raises(MinistryAgentInvocationError) as caught:
        invoke_ministry_agent(
            "户部",
            "生成财务报表",
            "交户部办理",
            model,
            required_bureaus=("会计司",),
            report_session=report_session,
        )

    assert caught.value.failure_stage == "bureau"
    assert bureau_calls == []


@pytest.mark.parametrize(
    "required_bureaus",
    [(), ("会计司", "会计司"), ("营缮司",)],
)
def test_required_bureaus_are_validated_at_entry_before_capability_or_model(
    required_bureaus,
    monkeypatch,
):
    monkeypatch.setattr(
        "app.agents.ministries.agent.capability_profiles_for",
        lambda *_args: pytest.fail("capability validation must not run"),
    )

    with pytest.raises(MinistryAgentInvocationError) as caught:
        invoke_ministry_agent(
            "户部",
            "生成财务报表",
            "交户部办理",
            lambda _messages: pytest.fail("model must not run"),
            required_bureaus=required_bureaus,
        )

    assert caught.value.failure_stage == "bureau"


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

    opinion = invoke_ministry_agent(
        "户部",
        "制定年度预算",
        "交户部办理",
        chat_model,
        required_bureaus=("预算司",),
    )

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


def test_ministry_route_corrects_two_invalid_structured_responses() -> None:
    department = "工部"
    selected_bureau = bureau_profiles_for(department)[0].bureau
    captured: list[list[dict[str, str]]] = []
    model = _sequenced_chat_model(
        [
            "not-json secret-route-one",
            '{"wrong":"secret-route-two"}',
            _route_response(selected_bureau, rationale="validated route"),
            '{"opinion":"bureau opinion"}',
            '{"opinion":"ministry opinion"}',
        ],
        captured,
    )

    result = invoke_ministry_agent(
        department,
        "offline decree",
        "approved rationale",
        model,
        required_bureaus=(selected_bureau,),
    )

    assert result["opinion"] == "ministry opinion"
    assert len(captured) == 5
    assert captured[1][-1]["role"] == "system"
    assert "secret-route-one" not in captured[1][-1]["content"]


def test_ministry_synthesis_corrects_two_invalid_structured_responses() -> None:
    department = "工部"
    selected_bureau = bureau_profiles_for(department)[0].bureau
    captured: list[list[dict[str, str]]] = []
    model = _sequenced_chat_model(
        [
            _route_response(selected_bureau, rationale="validated route"),
            '{"opinion":"bureau opinion"}',
            "not-json secret-synthesis-one",
            '{"wrong":"secret-synthesis-two"}',
            '{"opinion":"validated synthesis"}',
        ],
        captured,
    )

    result = invoke_ministry_agent(
        department,
        "offline decree",
        "approved rationale",
        model,
        required_bureaus=(selected_bureau,),
    )

    assert result["opinion"] == "validated synthesis"
    assert len(captured) == 5
    assert captured[3][-1]["role"] == "system"
    assert "secret-synthesis-one" not in captured[3][-1]["content"]


def test_household_market_decree_statically_routes_only_to_investment_bureau(
    monkeypatch,
):
    invoked_bureaus: list[str] = []
    captured_messages: list[list[dict[str, str]]] = []

    def fake_bureau(
        _department,
        bureau,
        _decree,
        _rationale,
        _model,
    ):
        invoked_bureaus.append(bureau)
        return f"{bureau}意见"

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent", fake_bureau)

    def model(messages):
        captured_messages.append(messages)
        if messages[0]["content"] == ministry_system_prompt("户部"):
            raise AssertionError("supported market route must bypass ministry routing")
        return '{"opinion": "户部综合意见"}'

    opinion = invoke_ministry_agent(
        "户部",
        "查询比亚迪股票价格",
        "交户部办理",
        model,
        required_bureaus=("投资司",),
        recall_context=RecallContext(available=True, entries=[]),
    )

    assert invoked_bureaus == ["投资司"]
    assert [item["bureau"] for item in opinion["bureau_opinions"]] == ["投资司"]
    assert len(captured_messages) == 1


class _AdoptedEvidenceSession:
    def __init__(self, adopted: tuple[str, ...], *, canonical: bool = True) -> None:
        self.adopted = adopted
        self.canonical = canonical
        self.degradations: list[str] = []

    def snapshot(self):
        return SimpleNamespace(adopted_evidence_ids=self.adopted)

    def record_degradation(self, node_id: str) -> None:
        self.degradations.append(node_id)

    def has_adopted_fact(self, **_kwargs) -> bool:
        return self.canonical


def test_household_market_ministry_schema_drift_reuses_adopted_bureau_opinion(
    monkeypatch,
) -> None:
    session = _AdoptedEvidenceSession(("quote-evidence",))
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: "比亚迪最新可得价格为 300 CNY。",
    )

    opinion = invoke_ministry_agent(
        "户部",
        "查询比亚迪股票价格",
        "交户部办理",
        lambda _messages: '{"opinion":"REJECTED-MINISTRY","extra":true}',
        required_bureaus=("投资司",),
        recall_context=RecallContext(available=True, entries=[]),
        evidence_session=session,
    )

    assert opinion == {
        "department": "户部",
        "bureau_opinions": [{"bureau": "投资司", "opinion": "比亚迪最新可得价格为 300 CNY。"}],
        "opinion": "比亚迪最新可得价格为 300 CNY。",
    }
    assert "REJECTED-MINISTRY" not in opinion["opinion"]
    assert session.degradations == ["ministry:户部"]


def test_household_market_ministry_rejects_valid_but_altered_time_and_source(
    monkeypatch,
) -> None:
    authoritative = (
        "比亚迪最新可得价格为 300 CNY"
        "（行情时间：2026-07-24T03:00:00Z；来源：批准来源）。\n"
        "该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，"
        "也不构成投资建议。"
    )
    session = _AdoptedEvidenceSession(("quote-evidence",))
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: authoritative,
    )

    opinion = invoke_ministry_agent(
        "户部",
        "查询比亚迪股票价格",
        "交户部办理",
        lambda _messages: (
            '{"opinion":"比亚迪最新可得价格为 300 CNY（行情时间：2099-01-01；来源：伪造来源）。"}'
        ),
        required_bureaus=("投资司",),
        recall_context=RecallContext(available=True, entries=[]),
        evidence_session=session,
    )

    assert opinion["opinion"] == authoritative
    assert session.degradations == ["ministry:户部"]


def test_household_market_ministry_synthesis_failure_without_adoption_fails_closed(
    monkeypatch,
) -> None:
    session = _AdoptedEvidenceSession(())
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: "数据不足，无法形成事实结论。",
    )

    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent(
            "户部",
            "查询比亚迪股票价格",
            "交户部办理",
            lambda _messages: (_ for _ in ()).throw(RuntimeError("synthesis failed")),
            required_bureaus=("投资司",),
            recall_context=RecallContext(available=True, entries=[]),
            evidence_session=session,
        )

    assert session.degradations == []


def test_household_market_ministry_rejects_unrelated_prefilled_adoption(
    monkeypatch,
) -> None:
    session = _AdoptedEvidenceSession(("unrelated-evidence",), canonical=False)
    model_calls = 0
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: "伪造价格 300 CNY",
    )

    def model(_messages):
        nonlocal model_calls
        model_calls += 1
        raise RuntimeError("must fail before synthesis")

    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent(
            "户部",
            "查询比亚迪股票价格",
            "交户部办理",
            model,
            required_bureaus=("投资司",),
            recall_context=RecallContext(available=True, entries=[]),
            evidence_session=session,
        )

    assert model_calls == 0
    assert session.degradations == []


def test_household_non_market_bureau_order_remains_unchanged(monkeypatch):
    invoked_bureaus: list[str] = []

    def fake_bureau(
        _department,
        bureau,
        _decree,
        _rationale,
        _model,
    ):
        invoked_bureaus.append(bureau)
        return f"{bureau}意见"

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent", fake_bureau)
    opinion = invoke_ministry_agent(
        "户部",
        "制定年度预算",
        "交户部办理",
        _sequenced_chat_model(
            [
                _route_response("预算司"),
                '{"opinion": "户部综合意见"}',
            ]
        ),
        required_bureaus=("预算司",),
        recall_context=RecallContext(available=True, entries=[]),
    )

    assert invoked_bureaus == ["预算司"]
    assert [item["bureau"] for item in opinion["bureau_opinions"]] == ["预算司"]


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

    invoke_ministry_agent(
        "户部",
        "制定年度预算",
        "交户部办理",
        chat_model,
        required_bureaus=("预算司",),
    )

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

    opinion = invoke_ministry_agent(
        "工部",
        "产品交付",
        "交工部办理",
        chat_model,
        required_bureaus=("技术司",),
    )

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


def test_selected_bureau_capability_boundary_preserves_model_call_order_and_scope(
    monkeypatch,
) -> None:
    calls: list[str] = []
    capability_lookups: list[tuple[str, str]] = []

    def fake_capability_profiles_for(department: str, bureau: str):
        capability_lookups.append((department, bureau))
        return ()

    def fake_model(messages: list[dict[str, str]]) -> str:
        system_content = messages[0]["content"]
        if system_content == ministry_system_prompt("兵部"):
            calls.append("route")
            return _route_response("报价司")
        if system_content == bureau_system_prompt("兵部", "报价司"):
            calls.append("bureau:报价司")
            return '{"opinion": "报价意见"}'
        if system_content == ministry_synthesis_system_prompt("兵部"):
            calls.append("synthesis")
            return '{"opinion": "兵部综合意见"}'
        pytest.fail("unexpected model invocation")

    monkeypatch.setattr(
        "app.agents.ministries.agent.capability_profiles_for",
        fake_capability_profiles_for,
    )

    opinion = invoke_ministry_agent(
        "兵部",
        "推进报价",
        "交兵部办理",
        fake_model,
        required_bureaus=("报价司",),
    )

    assert calls == ["route", "bureau:报价司", "synthesis"]
    assert capability_lookups == [("兵部", "报价司")]
    assert [item["bureau"] for item in opinion["bureau_opinions"]] == ["报价司"]


def test_selected_bureau_capability_boundary_keeps_multiple_bureaus_in_model_order(
    monkeypatch,
) -> None:
    calls: list[str] = []
    capability_lookups: list[tuple[str, str]] = []
    bureaus = ("技术司", "质量司")

    def fake_capability_profiles_for(department: str, bureau: str):
        capability_lookups.append((department, bureau))
        return ()

    def fake_model(messages: list[dict[str, str]]) -> str:
        system_content = messages[0]["content"]
        if system_content == ministry_system_prompt("工部"):
            calls.append("route")
            return _route_response(*bureaus)
        for bureau in bureaus:
            if system_content == bureau_system_prompt("工部", bureau):
                calls.append(f"bureau:{bureau}")
                return json.dumps({"opinion": f"{bureau}意见"}, ensure_ascii=False)
        if system_content == ministry_synthesis_system_prompt("工部"):
            calls.append("synthesis")
            return '{"opinion": "工部综合意见"}'
        pytest.fail("unexpected model invocation")

    monkeypatch.setattr(
        "app.agents.ministries.agent.capability_profiles_for",
        fake_capability_profiles_for,
    )

    opinion = invoke_ministry_agent(
        "工部",
        "产品交付",
        "交工部办理",
        fake_model,
        required_bureaus=("技术司",),
    )

    assert calls == ["route", "bureau:技术司", "bureau:质量司", "synthesis"]
    assert capability_lookups == [("工部", "技术司"), ("工部", "质量司")]
    assert [item["bureau"] for item in opinion["bureau_opinions"]] == list(bureaus)


def test_selected_bureau_capability_lookup_failure_stops_before_bureau_or_synthesis(
    monkeypatch,
) -> None:
    model_calls: list[str] = []
    failure = RuntimeError("capability lookup unavailable")

    def failing_capability_profiles_for(_department: str, _bureau: str):
        raise failure

    def fake_model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages[0]["content"])
        return _route_response("预算司")

    monkeypatch.setattr(
        "app.agents.ministries.agent.capability_profiles_for",
        failing_capability_profiles_for,
    )

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent(
            "户部",
            "制定年度预算",
            "交户部办理",
            fake_model,
            required_bureaus=("预算司",),
        )

    assert exc_info.value.__cause__ is failure
    assert model_calls == [ministry_system_prompt("户部")]


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
        required_bureaus=(profile.bureau,),
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
        "礼部",
        "对外沟通",
        "交礼部办理",
        _sequenced_chat_model(responses),
        required_bureaus=(bureaus[0],),
    )

    assert opinion == {
        "department": "礼部",
        "bureau_opinions": [{"bureau": bureau, "opinion": f"{bureau}意见"} for bureau in bureaus],
        "opinion": "礼部统筹全部六司形成对外建议",
    }


def test_invoke_ministry_agent_unknown_department_raises_value_error():
    with pytest.raises(ValueError):
        invoke_ministry_agent(
            "礼仪司",
            "旨意",
            "判断说明",
            lambda _messages: "unused",
            required_bureaus=("未知司",),
        )


def test_invoke_ministry_agent_model_call_failure_wrapped_with_cause_preserved():
    def _raising_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError("simulated fake-model failure")

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent(
            "吏部",
            "旨意",
            "判断说明",
            _raising_chat_model,
            required_bureaus=("任免司",),
        )

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
    department = "兵部"
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent(
            department,
            "旨意",
            "判断说明",
            _sequenced_chat_model([invalid_response]),
            required_bureaus=("增长司",),
        )


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
        invoke_ministry_agent(
            "户部",
            "旨意",
            "判断",
            _chat_model,
            required_bureaus=("预算司",),
        )

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
def test_invalid_ministry_synthesis_uses_safe_fallback_after_all_bureaus(
    invalid_response,
):
    calls = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]):
        calls["value"] += 1
        responses = [
            _route_response("预算司", "出纳司"),
            '{"opinion": "预算意见"}',
            '{"opinion": "资金意见"}',
            invalid_response,
            invalid_response,
            invalid_response,
        ]
        return responses[calls["value"] - 1]

    result = invoke_ministry_agent(
        "户部",
        "旨意",
        "判断",
        _chat_model,
        required_bureaus=("预算司",),
    )

    assert calls["value"] == 6
    assert result["opinion"]
    assert "未经证据支持的事实结论" in result["opinion"]


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
        invoke_ministry_agent(
            "户部",
            "旨意",
            "判断",
            _chat_model,
            required_bureaus=("预算司",),
        )

    assert len(calls) == 3
    assert marker not in str(exc_info.value)
    assert marker in str(exc_info.value.__cause__)


@pytest.mark.parametrize(
    "model_failure",
    [
        ValueError("provider value failure"),
        LookupError("provider unknown failure"),
    ],
)
def test_ministry_synthesis_model_exception_fails_closed(model_failure) -> None:
    department = "\u5de5\u90e8"
    selected_bureau = bureau_profiles_for(department)[0].bureau

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == ministry_synthesis_system_prompt(department):
            raise model_failure
        if messages[0]["content"] == bureau_system_prompt(department, selected_bureau):
            return '{"opinion":"READY-BUREAU"}'
        return _route_response(selected_bureau)

    with pytest.raises(MinistryAgentInvocationError) as exc_info:
        invoke_ministry_agent(
            department,
            "\u4ea4\u4ed8\u4ea7\u54c1",
            "\u4ea4\u5de5\u90e8\u529e\u7406",
            _chat_model,
            required_bureaus=(selected_bureau,),
        )

    assert exc_info.value.__cause__ is model_failure


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

    first = invoke_ministry_agent(
        "礼部",
        "旨意一",
        "判断一",
        chat_model,
        required_bureaus=("品牌司",),
    )
    second = invoke_ministry_agent(
        "礼部",
        "旨意二",
        "判断二",
        chat_model,
        required_bureaus=("体验司",),
    )

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
        invoke_ministry_agent(
            "刑部",
            "旨意",
            "判断说明",
            _leaking_chat_model,
            required_bureaus=("合同司",),
        )

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
        required_bureaus=(profile.bureau,),
        evidence_session=session,
    )

    assert result["bureau_opinions"] == [{"bureau": profile.bureau, "opinion": "bureau opinion"}]
    assert bureau_sessions == [session]
    assert len(upper_messages) == 2
    assert all("NEEDS_DATA" not in message[0]["content"] for message in upper_messages)


@pytest.mark.parametrize("selector_response", ["plain text", "{}", '{"bureaus":[]}'])
def test_selector_content_drift_fails_closed_without_deterministic_fallback(
    selector_response: str,
) -> None:
    department = "\u540f\u90e8"
    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent(
            department,
            "\u62db\u8058\u4e24\u540d\u5458\u5de5",
            "\u4ea4\u540f\u90e8\u529e\u7406",
            _sequenced_chat_model([selector_response]),
            required_bureaus=(bureau_profiles_for(department)[0].bureau,),
        )


def test_selector_invalid_response_does_not_record_degradation(
    monkeypatch,
) -> None:
    department = "\u540f\u90e8"
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())
    monkeypatch.setattr(
        "app.agents.ministries.agent.invoke_bureau_agent",
        lambda *_args, **_kwargs: "READY-BUREAU",
    )

    with pytest.raises(MinistryAgentInvocationError):
        invoke_ministry_agent(
            department,
            "\u62db\u8058\u4e24\u540d\u5458\u5de5",
            "\u4ea4\u540f\u90e8\u529e\u7406",
            _sequenced_chat_model(["plain text"]),
            required_bureaus=(bureau_profiles_for(department)[0].bureau,),
            evidence_session=session,
        )

    assert session.snapshot().degradation_reasons == ()


def test_ministry_synthesis_content_drift_discards_rejected_body() -> None:
    department = "\u5de5\u90e8"
    selected_bureau = bureau_profiles_for(department)[0].bureau
    result = invoke_ministry_agent(
        department,
        "\u4ea4\u4ed8\u4ea7\u54c1",
        "\u4ea4\u5de5\u90e8\u529e\u7406",
        _sequenced_chat_model(
            [
                _route_response(selected_bureau),
                '{"opinion":"READY-BUREAU"}',
                '{"opinion":"SECRET-REJECTED","extra":true}',
                '{"opinion":"SECRET-REJECTED","extra":true}',
                '{"opinion":"SECRET-REJECTED","extra":true}',
            ]
        ),
        required_bureaus=(selected_bureau,),
    )

    assert result["opinion"]
    assert "SECRET-REJECTED" not in result["opinion"]


def test_ministry_forwards_same_report_session_to_every_selected_bureau(monkeypatch):
    session = object()
    seen = []

    def fake_bureau(*_args, **kwargs):
        seen.append(kwargs.get("report_session"))
        return "司议"

    monkeypatch.setattr("app.agents.ministries.agent.invoke_bureau_agent", fake_bureau)
    responses = iter(
        [
            '{"rationale":"办理","bureaus":["技术司","质量司"]}',
            '{"opinion":"部议"}',
        ]
    )
    invoke_ministry_agent(
        "工部",
        "产品交付",
        "判断",
        lambda _messages: next(responses),
        required_bureaus=("技术司",),
        report_session=session,
    )
    assert seen == [session, session]
