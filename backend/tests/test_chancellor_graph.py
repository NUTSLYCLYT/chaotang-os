"""Offline tests for the layered Chancellor memorial graph."""

from __future__ import annotations

import json

import pytest
from langgraph.graph.state import CompiledStateGraph

from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor.graph import (
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor.prompts import (
    CHANCELLOR_FINALIZATION_SYSTEM_PROMPT,
    CHANCELLOR_SYSTEM_PROMPT,
)
from app.agents.ministries.agent import MinistryAgentInvocationError
from app.agents.ministries.prompts import (
    MINISTRIES,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    ministry_routing_guide,
    ministry_system_prompt,
)
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError


def _single_route_response(department: str) -> str:
    return json.dumps(
        {
            "route_type": "single",
            "rationale": "此事只涉及一部，交其办理",
            "departments": [department],
        },
        ensure_ascii=False,
    )


def _multi_route_response(departments: list[str]) -> str:
    return json.dumps(
        {
            "route_type": "multi",
            "rationale": "此事涉及多部门，需军机处会审",
            "departments": departments,
        },
        ensure_ascii=False,
    )


def _bureau_route_response(department: str) -> str:
    bureau = bureau_profiles_for(department)[0].bureau
    return json.dumps(
        {"rationale": "交由本司办理", "bureaus": [bureau]}, ensure_ascii=False
    )


def _ministry_turns(department: str, bureau_opinion: str, ministry_opinion: str) -> list[str]:
    return [
        _bureau_route_response(department),
        json.dumps({"opinion": bureau_opinion}, ensure_ascii=False),
        json.dumps({"opinion": ministry_opinion}, ensure_ascii=False),
    ]


def _final_response(summary: str = "丞相总结") -> str:
    return json.dumps(
        {"summary": summary, "recommendations": ["建议一", "建议二", "建议三"]},
        ensure_ascii=False,
    )


def _sequenced_chat_model(responses: list[str]):
    call_index = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        index = call_index["value"]
        call_index["value"] += 1
        return responses[index]

    return _chat_model


def _expected_ministry(department: str, bureau_opinion: str, opinion: str) -> dict:
    return {
        "department": department,
        "bureau_opinions": [
            {
                "bureau": bureau_profiles_for(department)[0].bureau,
                "opinion": bureau_opinion,
            }
        ],
        "opinion": opinion,
    }


def test_build_chancellor_graph_with_injected_model_returns_compiled_graph():
    graph = build_chancellor_graph(chat_model=lambda _messages: _single_route_response("户部"))
    assert isinstance(graph, CompiledStateGraph)


def test_chancellor_prompts_cover_routing_finalization_and_shared_constraint():
    for department in MINISTRIES:
        assert department in CHANCELLOR_SYSTEM_PROMPT
    assert ministry_routing_guide() in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "恰好三项" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "summary" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "recommendations" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT


def test_single_route_runs_ministry_then_common_finalizer_without_junjichu():
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _single_route_response("户部"),
            *_ministry_turns("户部", "预算司意见", "户部补充意见"),
            _final_response("丞相最终总结"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke(
        {"decree_text": "评估年度预算与融资安排"}
    )

    bureau = bureau_profiles_for("户部")[0].bureau
    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert result["ministry_opinions"] == [
        _expected_ministry("户部", "预算司意见", "户部补充意见")
    ]
    assert result["council_verdict"] is None
    assert result["final_verdict"] == "丞相最终总结"
    assert result["recommendations"] == ["建议一", "建议二", "建议三"]
    assert result["processing_path"] == [
        "上书房",
        "丞相（首次分流）",
        "户部",
        f"户部·{bureau}",
        "户部（部级补充）",
        "丞相（最终汇总）",
    ]
    assert len(captured_messages) == 5
    assert captured_messages[0][0]["content"] == CHANCELLOR_SYSTEM_PROMPT
    assert captured_messages[1][0]["content"] == ministry_system_prompt("户部")
    assert captured_messages[4][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    final_evidence = captured_messages[4][1]["content"]
    assert "评估年度预算与融资安排" in final_evidence
    assert "此事只涉及一部，交其办理" in final_evidence
    assert "预算司意见" in final_evidence
    assert "户部补充意见" in final_evidence
    assert '"council_verdict": null' in final_evidence
    assert not any(
        message[0]["content"].startswith("你是军机处") for message in captured_messages
    )


def test_single_route_works_for_every_ministry():
    for department in MINISTRIES:
        responses = [
            _single_route_response(department),
            *_ministry_turns(department, "司级意见", "部级补充"),
            _final_response(f"{department}最终总结"),
        ]
        result = build_chancellor_graph(
            chat_model=_sequenced_chat_model(responses)
        ).invoke({"decree_text": "旨意"})
        assert result["departments"] == [department]
        assert result["final_verdict"] == f"{department}最终总结"
        assert result["processing_path"][-1] == "丞相（最终汇总）"


@pytest.mark.parametrize(
    "response",
    [
        "",
        "not json",
        '{"route_type":"unknown","rationale":"说明","departments":["户部"]}',
        '{"route_type":"single","rationale":"说明","departments":["未知部"]}',
        '{"route_type":"multi","rationale":"说明","departments":["户部","户部"]}',
        '{"route_type":"single","rationale":"说明","departments":["户部","工部"]}',
        '{"route_type":"multi","rationale":"说明","departments":["户部"]}',
        '{"route_type":"single","rationale":" ","departments":["户部"]}',
    ],
)
def test_invalid_route_responses_fail_closed(response):
    graph = build_chancellor_graph(chat_model=lambda _messages: response)
    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_multi_route_runs_all_layered_ministries_then_council_then_finalizer():
    departments = ["礼部", "刑部"]
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _multi_route_response(departments),
            *_ministry_turns("礼部", "品牌司意见", "礼部补充意见"),
            *_ministry_turns("刑部", "合同司意见", "刑部补充意见"),
            '{"verdict":"军机处会审结论"}',
            _final_response("丞相会审后总结"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "联合旨意"})

    assert len(captured_messages) == 9
    assert captured_messages[1][0]["content"] == ministry_system_prompt("礼部")
    assert captured_messages[4][0]["content"] == ministry_system_prompt("刑部")
    council_evidence = captured_messages[7][1]["content"]
    assert "品牌司意见" in council_evidence
    assert "礼部补充意见" in council_evidence
    assert "合同司意见" in council_evidence
    assert "刑部补充意见" in council_evidence
    assert captured_messages[8][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "军机处会审结论" in captured_messages[8][1]["content"]
    assert result["council_verdict"] == "军机处会审结论"
    assert result["final_verdict"] == "丞相会审后总结"
    assert result["recommendations"] == ["建议一", "建议二", "建议三"]
    expected_path = ["上书房", "丞相（首次分流）", "军机处（召集）"]
    for department in departments:
        bureau = bureau_profiles_for(department)[0].bureau
        expected_path.extend(
            [department, f"{department}·{bureau}", f"{department}（部级补充）"]
        )
    expected_path.extend(["军机处（会审）", "丞相（最终汇总）"])
    assert result["processing_path"] == expected_path


def test_multi_route_all_six_ministries_remains_serial_and_feasible():
    departments = list(MINISTRIES)
    responses = [_multi_route_response(departments)]
    for department in departments:
        responses.extend(_ministry_turns(department, f"{department}司见", f"{department}部见"))
    responses.extend(['{"verdict":"六部会审"}', _final_response("六部最终总结")])
    result = build_chancellor_graph(chat_model=_sequenced_chat_model(responses)).invoke(
        {"decree_text": "六部旨意"}
    )
    assert result["departments"] == departments
    assert [item["department"] for item in result["ministry_opinions"]] == departments
    assert result["council_verdict"] == "六部会审"
    assert result["final_verdict"] == "六部最终总结"


@pytest.mark.parametrize(
    "final_response",
    [
        None,
        True,
        "",
        "   ",
        "not json",
        "[]",
        "null",
        "{}",
        '{"summary":"总结"}',
        '{"recommendations":["一","二","三"]}',
        '{"summary":"总结","recommendations":["一","二","三"],"extra":1}',
        '{"summary":1,"recommendations":["一","二","三"]}',
        '{"summary":null,"recommendations":["一","二","三"]}',
        '{"summary":[],"recommendations":["一","二","三"]}',
        '{"summary":" ","recommendations":["一","二","三"]}',
        '{"summary":"总结","recommendations":null}',
        '{"summary":"总结","recommendations":["一","二"]}',
        '{"summary":"总结","recommendations":["一","二","三","四"]}',
        '{"summary":"总结","recommendations":["一"," ","三"]}',
        '{"summary":"总结","recommendations":["一",2,"三"]}',
        '{"summary":"总结","recommendations":["一",null,"三"]}',
        '{"summary":"总结","recommendations":["一"," 二 ","二"]}',
        '{"summary":"总结","recommendations":"一二三"}',
    ],
)
def test_invalid_chancellor_final_response_fails_closed(final_response):
    graph = build_chancellor_graph(
        chat_model=_sequenced_chat_model(
            [
                _single_route_response("户部"),
                *_ministry_turns("户部", "司见", "部见"),
                final_response,
            ]
        )
    )
    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})
    assert "司见" not in str(exc_info.value)
    assert exc_info.value.__cause__ is not None


def test_multi_council_invalid_schema_stops_before_chancellor_finalizer():
    calls = {"value": 0}
    responses = iter(
        [
            _multi_route_response(["户部", "工部"]),
            *_ministry_turns("户部", "户司", "户部"),
            *_ministry_turns("工部", "工司", "工部"),
            '{"verdict":"会审","extra":true}',
        ]
    )

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        calls["value"] += 1
        return next(responses)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "旨意"})
    assert isinstance(exc_info.value.__cause__, ValueError)
    assert calls["value"] == 8


def test_ministry_failure_is_wrapped_and_short_circuits():
    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _single_route_response("兵部")
        raise RuntimeError("simulated ministry failure")

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "旨意"})
    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)
    assert isinstance(exc_info.value.__cause__.__cause__, RuntimeError)


def test_finalizer_failure_is_sanitized_and_preserves_cause():
    marker = "sk-finalizer-must-not-leak-24680"
    responses = iter(
        [
            _single_route_response("户部"),
            *_ministry_turns("户部", "司见", "部见"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            raise RuntimeError(f"SDK failure key={marker}")
        return next(responses)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "旨意"})
    assert marker in str(exc_info.value.__cause__)
    assert marker not in str(exc_info.value)


def test_same_graph_has_no_state_leak_across_invocations():
    responses = [
        _single_route_response("户部"),
        *_ministry_turns("户部", "司见一", "部见一"),
        _final_response("总结一"),
        _single_route_response("礼部"),
        *_ministry_turns("礼部", "司见二", "部见二"),
        _final_response("总结二"),
    ]
    graph = build_chancellor_graph(chat_model=_sequenced_chat_model(responses))
    first = graph.invoke({"decree_text": "旨意一"})
    second = graph.invoke({"decree_text": "旨意二"})
    assert first["departments"] == ["户部"]
    assert first["final_verdict"] == "总结一"
    assert second["departments"] == ["礼部"]
    assert second["final_verdict"] == "总结二"
    assert first["ministry_opinions"] != second["ministry_opinions"]


def test_missing_api_key_fails_fast_before_graph_is_returned(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(DeepSeekApiKeyError):
        build_chancellor_graph()
