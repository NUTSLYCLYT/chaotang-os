"""Tests for ``app.agents.chancellor.graph``.

Fully offline. The fake-``chat_model`` injection path never touches
environment variables, config files, or a real ``openai`` client. The
"missing key fails fast" test only asserts that ``build_chancellor_graph()``
itself raises (using the real default config file, real installed
LangGraph, and a real ``deepseek_config``/``deepseek_client`` path) before a
compiled graph is even returned, with no injected chat model and no network
access involved. No test in this module reads ``backend/.env.example``: the
autouse ``isolate_deepseek_dotenv_fallback`` fixture in ``conftest.py``
points the dotenv fallback's default path at a guaranteed-nonexistent file
for the duration of every test in this suite.

This module covers module 1's scope: the Chancellor's routing decision
(``decide_route``) and the single-department branch
(``handle_single_ministry``). Multi-department (军机处) end-to-end coverage
is module 2's responsibility, added to this same file without deleting the
tests below (see the ``Affected Modules`` entry for module 2 in
``docs/product/tasks/2026-07-17-decree-six-ministries-joint-review.md``).
"""

from __future__ import annotations

import json

import pytest
from langgraph.graph.state import CompiledStateGraph

from app.agents.chancellor.graph import (
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor.prompts import CHANCELLOR_SYSTEM_PROMPT
from app.agents.ministries.agent import MinistryAgentInvocationError
from app.agents.ministries.prompts import (
    MINISTRIES,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    ministry_system_prompt,
)
from app.agents.structured_output import StructuredOutputError
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError


def _single_route_response(department: str) -> str:
    return (
        '{"route_type": "single", "rationale": "此事只涉及一部，交其办理", '
        f'"departments": ["{department}"]}}'
    )


def _sequenced_chat_model(responses: list[str]):
    """Return a fake chat model that returns ``responses`` in call order."""

    call_index = {"value": 0}

    def _chat_model(messages: list[dict[str, str]]) -> str:
        index = call_index["value"]
        call_index["value"] += 1
        return responses[index]

    return _chat_model


def _multi_route_response(departments: list[str]) -> str:
    departments_json = json.dumps(departments, ensure_ascii=False)
    return (
        '{"route_type": "multi", "rationale": "此事涉及多部门，需军机处会审", '
        f'"departments": {departments_json}}}'
    )


def test_build_chancellor_graph_with_injected_fake_model_returns_compiled_graph():
    graph = build_chancellor_graph(chat_model=lambda _messages: _single_route_response("户部"))
    assert isinstance(graph, CompiledStateGraph)


def test_chancellor_system_prompt_lists_all_six_ministries_and_shared_constraint():
    for department in MINISTRIES:
        assert department in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_SYSTEM_PROMPT


def test_single_route_invokes_chosen_ministry_and_sets_processing_path_and_verdict():
    captured_messages: list[list[dict[str, str]]] = []

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        if len(captured_messages) == 1:
            return _single_route_response("户部")
        return '{"opinion": "臣部核准拨款"}'

    graph = build_chancellor_graph(chat_model=_chat_model)

    result = graph.invoke({"decree_text": "拨款修渠"})

    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert result["chancellor_rationale"] == "此事只涉及一部，交其办理"
    assert result["processing_path"] == ["上书房", "丞相", "户部"]
    assert result["ministry_opinions"] == [{"department": "户部", "opinion": "臣部核准拨款"}]
    assert result["final_verdict"] == "臣部核准拨款"
    assert "军机处" not in result["processing_path"]

    # First call is the Chancellor's own routing turn; second is 户部's.
    assert captured_messages[0][0] == {"role": "system", "content": CHANCELLOR_SYSTEM_PROMPT}
    assert captured_messages[0][1] == {"role": "user", "content": "拨款修渠"}
    assert captured_messages[1][1]["content"].startswith("旨意：拨款修渠")


def test_single_route_works_for_every_ministry():
    for department in MINISTRIES:
        chat_model = _sequenced_chat_model(
            [_single_route_response(department), '{"opinion": "本部已知悉，建议办理"}']
        )
        graph = build_chancellor_graph(chat_model=chat_model)

        result = graph.invoke({"decree_text": "旨意"})

        assert result["departments"] == [department]
        assert result["processing_path"] == ["上书房", "丞相", department]
        assert result["final_verdict"] == "本部已知悉，建议办理"


def test_route_node_exception_propagates_wrapped_with_cause_preserved():
    def _raising_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError("simulated fake-model failure")

    graph = build_chancellor_graph(chat_model=_raising_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert str(exc_info.value.__cause__) == "simulated fake-model failure"


@pytest.mark.parametrize("empty_response", ["", "   "])
def test_empty_route_model_response_is_rejected(empty_response):
    graph = build_chancellor_graph(chat_model=lambda _messages: empty_response)

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_invalid_json_route_response_raises_invocation_error():
    graph = build_chancellor_graph(chat_model=lambda _messages: "not json at all")

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_invalid_route_type_raises_invocation_error():
    graph = build_chancellor_graph(
        chat_model=lambda _messages: (
            '{"route_type": "unknown", "rationale": "说明", "departments": ["户部"]}'
        )
    )

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_unknown_department_raises_invocation_error():
    graph = build_chancellor_graph(
        chat_model=lambda _messages: (
            '{"route_type": "single", "rationale": "说明", "departments": ["礼仪司"]}'
        )
    )

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_duplicate_departments_raises_invocation_error():
    graph = build_chancellor_graph(
        chat_model=lambda _messages: (
            '{"route_type": "multi", "rationale": "说明", "departments": ["户部", "户部"]}'
        )
    )

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


@pytest.mark.parametrize("departments", [[], ["户部", "工部"]])
def test_single_route_with_department_count_not_equal_to_one_raises_invocation_error(departments):
    graph = build_chancellor_graph(
        chat_model=lambda _messages: json.dumps(
            {"route_type": "single", "rationale": "说明", "departments": departments}
        )
    )

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_multi_route_with_fewer_than_two_departments_raises_invocation_error():
    graph = build_chancellor_graph(
        chat_model=lambda _messages: (
            '{"route_type": "multi", "rationale": "说明", "departments": ["户部"]}'
        )
    )

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


@pytest.mark.parametrize("empty_rationale", ["", "   "])
def test_empty_rationale_raises_invocation_error(empty_rationale):
    graph = build_chancellor_graph(
        chat_model=lambda _messages: (
            f'{{"route_type": "single", "rationale": "{empty_rationale}", '
            '"departments": ["户部"]}'
        )
    )

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_multi_route_is_wired_to_junjichu_council():
    graph = build_chancellor_graph(
        chat_model=_sequenced_chat_model(
            [
                _multi_route_response(["户部", "工部"]),
                '{"opinion": "户部意见"}',
                '{"opinion": "工部意见"}',
                '{"verdict": "军机处会审结论"}',
            ]
        )
    )

    result = graph.invoke({"decree_text": "旨意"})

    assert result["processing_path"] == ["上书房", "丞相", "军机处", "户部", "工部"]
    assert result["ministry_opinions"] == [
        {"department": "户部", "opinion": "户部意见"},
        {"department": "工部", "opinion": "工部意见"},
    ]
    assert result["final_verdict"] == "军机处会审结论"


def test_ministry_call_failure_wrapped_into_chancellor_graph_invocation_error():
    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _single_route_response("兵部")
        raise RuntimeError("simulated ministry failure")

    graph = build_chancellor_graph(chat_model=_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)
    assert isinstance(exc_info.value.__cause__.__cause__, RuntimeError)


@pytest.mark.parametrize("empty_opinion", ["", "   "])
def test_empty_ministry_opinion_wrapped_into_chancellor_graph_invocation_error(empty_opinion):
    graph = build_chancellor_graph(
        chat_model=_sequenced_chat_model(
            [_single_route_response("户部"), f'{{"opinion": "{empty_opinion}"}}']
        )
    )

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)


def test_ministry_call_invalid_json_wrapped_into_chancellor_graph_invocation_error():
    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _single_route_response("兵部")
        return "not json at all"

    graph = build_chancellor_graph(chat_model=_chat_model)

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_missing_api_key_fails_fast_before_graph_is_returned(monkeypatch):
    """AC: a missing ``DEEPSEEK_API_KEY`` must fail before any outbound
    request could be attempted -- i.e. at ``build_chancellor_graph()`` time,
    not later at ``.invoke()`` time. No ``chat_model`` is injected here, so
    this exercises the real config-loading + key-resolution path (using the
    real ``backend/config/providers.yaml``) with no network access.
    """
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(DeepSeekApiKeyError):
        build_chancellor_graph()


def test_wrapped_route_invocation_error_does_not_leak_secret_from_original_exception():
    """Regression guard: even if the underlying model raises an exception
    whose message happens to contain a secret-looking string, the wrapper
    exception's own ``str()`` must never echo it verbatim.
    """
    leaking_marker = "sk-chancellor-adversarial-should-not-leak-13579"

    def _leaking_chat_model(messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")

    graph = build_chancellor_graph(chat_model=_leaking_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert leaking_marker in str(exc_info.value.__cause__)
    assert leaking_marker not in str(exc_info.value)


def test_wrapped_ministry_invocation_error_does_not_leak_secret_from_original_exception():
    leaking_marker = "sk-chancellor-ministry-adversarial-should-not-leak-24680"

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _single_route_response("刑部")
        raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")

    graph = build_chancellor_graph(chat_model=_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert leaking_marker in str(exc_info.value.__cause__.__cause__)
    assert leaking_marker not in str(exc_info.value)
    assert leaking_marker not in str(exc_info.value.__cause__)


# ---------------------------------------------------------------------------
# Module 2 (军机处会审编排): multi-department end-to-end graph coverage.
#
# The cases below add module 2's end-to-end coverage while the earlier cases
# retain module 1's routing and single-department regression coverage.
# ---------------------------------------------------------------------------


def test_multi_route_full_pipeline_produces_ordered_opinions_and_council_verdict():
    departments = ["户部", "工部", "兵部"]
    chat_model = _sequenced_chat_model(
        [
            _multi_route_response(departments),
            '{"opinion": "户部意见"}',
            '{"opinion": "工部意见"}',
            '{"opinion": "兵部意见"}',
            '{"verdict": "军机处综合结论"}',
        ]
    )

    graph = build_chancellor_graph(chat_model=chat_model)
    result = graph.invoke({"decree_text": "拨款修渠并调兵护渠"})

    assert result["route_type"] == "multi"
    assert result["departments"] == departments
    assert result["processing_path"] == ["上书房", "丞相", "军机处", "户部", "工部", "兵部"]
    assert result["ministry_opinions"] == [
        {"department": "户部", "opinion": "户部意见"},
        {"department": "工部", "opinion": "工部意见"},
        {"department": "兵部", "opinion": "兵部意见"},
    ]
    # The final verdict comes from 军机处's own council call, not from any
    # single department's opinion.
    assert result["final_verdict"] == "军机处综合结论"
    assert result["final_verdict"] not in {"户部意见", "工部意见", "兵部意见"}


def test_multi_route_with_all_six_ministries_selected_is_feasible():
    """Boundary case: the Chancellor may legitimately select all six fixed
    ministries for a single ``"multi"`` decree -- ``MINISTRIES`` membership
    and no-duplicates are the only constraints; there is no upper bound on
    how many (up to all six) departments a ``"multi"`` route may select.
    """
    departments = list(MINISTRIES)
    assert len(departments) == 6

    responses = [_multi_route_response(departments)]
    responses.extend(f'{{"opinion": "{department}意见"}}' for department in departments)
    responses.append('{"verdict": "军机处综合六部结论"}')
    chat_model = _sequenced_chat_model(responses)

    graph = build_chancellor_graph(chat_model=chat_model)
    result = graph.invoke({"decree_text": "旨意涉及六部"})

    assert result["route_type"] == "multi"
    assert result["departments"] == departments
    assert result["processing_path"] == ["上书房", "丞相", "军机处", *departments]
    assert result["ministry_opinions"] == [
        {"department": department, "opinion": f"{department}意见"} for department in departments
    ]
    assert result["final_verdict"] == "军机处综合六部结论"


def test_multi_route_calls_departments_serially_in_order_before_council():
    departments = ["礼部", "刑部"]
    captured_messages: list[list[dict[str, str]]] = []

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        call_index = len(captured_messages)
        if call_index == 1:
            return _multi_route_response(departments)
        if call_index == 2:
            return '{"opinion": "礼部意见"}'
        if call_index == 3:
            return '{"opinion": "刑部意见"}'
        return '{"verdict": "军机处结论"}'

    graph = build_chancellor_graph(chat_model=_chat_model)
    graph.invoke({"decree_text": "旨意"})

    # Exactly 4 calls: 1 routing + 2 departments + 1 council -- proves no
    # extra/duplicate/concurrent calls were made.
    assert len(captured_messages) == 4
    assert captured_messages[0][0] == {"role": "system", "content": CHANCELLOR_SYSTEM_PROMPT}
    # Departments are consulted strictly in the Chancellor-given order.
    assert captured_messages[1][0] == {
        "role": "system",
        "content": ministry_system_prompt("礼部"),
    }
    assert captured_messages[2][0] == {
        "role": "system",
        "content": ministry_system_prompt("刑部"),
    }
    # The council call happens only after every department has answered,
    # and its own message references both departments' opinions.
    council_user_content = captured_messages[3][1]["content"]
    assert "礼部意见" in council_user_content
    assert "刑部意见" in council_user_content


def test_multi_route_department_failure_stops_before_remaining_departments_and_council():
    departments = ["户部", "工部", "兵部"]
    call_count = {"value": 0}

    def _chat_model(messages: list[dict[str, str]]) -> str:
        call_count["value"] += 1
        if call_count["value"] == 1:
            return _multi_route_response(departments)
        if call_count["value"] == 2:
            return '{"opinion": "户部意见"}'
        raise RuntimeError("simulated second department failure")

    graph = build_chancellor_graph(chat_model=_chat_model)

    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})

    # Routing + 户部 + the failing 工部 call: 工部's failure stops the
    # sequence before 兵部 or 军机处's own call are ever reached.
    assert call_count["value"] == 3


def test_multi_route_ministry_call_failure_wrapped_into_chancellor_graph_invocation_error():
    departments = ["户部", "工部"]

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _multi_route_response(departments)
        raise RuntimeError("simulated department failure")

    graph = build_chancellor_graph(chat_model=_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)
    assert isinstance(exc_info.value.__cause__.__cause__, RuntimeError)


def test_multi_route_council_invalid_json_wrapped_into_chancellor_graph_invocation_error():
    departments = ["户部", "工部"]
    chat_model = _sequenced_chat_model(
        [
            _multi_route_response(departments),
            '{"opinion": "户部意见"}',
            '{"opinion": "工部意见"}',
            "not json at all",
        ]
    )

    graph = build_chancellor_graph(chat_model=chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert isinstance(exc_info.value.__cause__, StructuredOutputError)


@pytest.mark.parametrize("empty_verdict", ["", "   "])
def test_multi_route_council_empty_verdict_wrapped_into_chancellor_graph_invocation_error(
    empty_verdict,
):
    departments = ["户部", "工部"]
    chat_model = _sequenced_chat_model(
        [
            _multi_route_response(departments),
            '{"opinion": "户部意见"}',
            '{"opinion": "工部意见"}',
            f'{{"verdict": "{empty_verdict}"}}',
        ]
    )

    graph = build_chancellor_graph(chat_model=chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert isinstance(exc_info.value.__cause__, ValueError)


def test_wrapped_council_invocation_error_does_not_leak_secret_from_original_exception():
    departments = ["户部", "工部"]
    leaking_marker = "sk-chancellor-junjichu-adversarial-should-not-leak-97210"

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _multi_route_response(departments)
        if "各部门意见" in messages[1]["content"]:
            raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")
        return '{"opinion": "本部已知悉，建议办理"}'

    graph = build_chancellor_graph(chat_model=_chat_model)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})

    assert leaking_marker in str(exc_info.value.__cause__)
    assert leaking_marker not in str(exc_info.value)


def test_same_compiled_graph_does_not_leak_state_across_invocations():
    first_departments = ["户部", "工部"]
    second_departments = ["礼部", "刑部", "兵部"]

    chat_model = _sequenced_chat_model(
        [
            _multi_route_response(first_departments),
            '{"opinion": "户部意见一"}',
            '{"opinion": "工部意见一"}',
            '{"verdict": "结论一"}',
            _multi_route_response(second_departments),
            '{"opinion": "礼部意见二"}',
            '{"opinion": "刑部意见二"}',
            '{"opinion": "兵部意见二"}',
            '{"verdict": "结论二"}',
        ]
    )

    graph = build_chancellor_graph(chat_model=chat_model)

    result_one = graph.invoke({"decree_text": "旨意一"})
    result_two = graph.invoke({"decree_text": "旨意二"})

    assert result_one["departments"] == first_departments
    assert result_one["processing_path"] == ["上书房", "丞相", "军机处", "户部", "工部"]
    assert result_one["final_verdict"] == "结论一"

    assert result_two["departments"] == second_departments
    assert result_two["processing_path"] == [
        "上书房",
        "丞相",
        "军机处",
        "礼部",
        "刑部",
        "兵部",
    ]
    assert result_two["final_verdict"] == "结论二"

    # Neither result carries any trace of the other invocation's data.
    assert "礼部" not in result_one["processing_path"]
    assert "户部" not in result_two["processing_path"]
    assert result_one["ministry_opinions"] != result_two["ministry_opinions"]
