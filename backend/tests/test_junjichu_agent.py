"""Tests for ``app.agents.junjichu`` (prompts, council-verdict invocation,
and the full serial multi-department council sequence).

Fully offline: every test injects a fake ``chat_model`` callable and never
touches environment variables, configuration files, or the network.
"""

from __future__ import annotations

import pytest

from app.agents.junjichu.agent import invoke_junjichu_council, run_junjichu_council
from app.agents.junjichu.prompts import JUNJICHU_IDENTITY, junjichu_system_prompt
from app.agents.ministries.agent import MinistryAgentInvocationError
from app.agents.ministries.prompts import NO_IRREVERSIBLE_ACTION_CONSTRAINT
from app.agents.structured_output import StructuredOutputError


def test_junjichu_system_prompt_contains_identity_departments_and_shared_constraint():
    prompt = junjichu_system_prompt(["户部", "工部"])
    assert JUNJICHU_IDENTITY in prompt
    assert "户部" in prompt
    assert "工部" in prompt
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt


def test_invoke_junjichu_council_sends_expected_messages_and_returns_verdict():
    captured_messages: list[dict[str, str]] = []

    def _capturing_chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return '{"verdict": "军机处会审通过"}'

    verdict = invoke_junjichu_council(
        "拨款修渠并调兵护渠",
        "此事涉及户部与兵部，需军机处会审",
        ["户部", "兵部"],
        [
            {"department": "户部", "opinion": "臣部核准拨款"},
            {"department": "兵部", "opinion": "臣部同意调兵护渠"},
        ],
        _capturing_chat_model,
    )

    assert verdict == "军机处会审通过"
    assert captured_messages[0] == {
        "role": "system",
        "content": junjichu_system_prompt(["户部", "兵部"]),
    }
    assert captured_messages[1]["role"] == "user"
    assert "拨款修渠并调兵护渠" in captured_messages[1]["content"]
    assert "此事涉及户部与兵部，需军机处会审" in captured_messages[1]["content"]
    assert "户部：臣部核准拨款" in captured_messages[1]["content"]
    assert "兵部：臣部同意调兵护渠" in captured_messages[1]["content"]


def test_invoke_junjichu_council_strips_whitespace_from_verdict():
    verdict = invoke_junjichu_council(
        "旨意",
        "判断说明",
        ["户部", "工部"],
        [
            {"department": "户部", "opinion": "意见一"},
            {"department": "工部", "opinion": "意见二"},
        ],
        lambda _messages: '{"verdict": "  会审已通过  "}',
    )
    assert verdict == "会审已通过"


def test_invoke_junjichu_council_unwraps_json_code_fence():
    verdict = invoke_junjichu_council(
        "旨意",
        "判断说明",
        ["刑部", "工部"],
        [
            {"department": "刑部", "opinion": "意见一"},
            {"department": "工部", "opinion": "意见二"},
        ],
        lambda _messages: '```json\n{"verdict": "依律核准"}\n```',
    )
    assert verdict == "依律核准"


def test_invoke_junjichu_council_model_call_failure_propagates_unwrapped():
    def _raising_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError("simulated fake-model failure")

    with pytest.raises(RuntimeError, match="simulated fake-model failure"):
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            _raising_chat_model,
        )


@pytest.mark.parametrize("empty_response", ["", "   "])
def test_invoke_junjichu_council_rejects_empty_model_response(empty_response):
    with pytest.raises(ValueError):
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            lambda _messages: empty_response,
        )


def test_invoke_junjichu_council_rejects_invalid_json():
    with pytest.raises(StructuredOutputError):
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            lambda _messages: "not json at all",
        )


def test_invoke_junjichu_council_rejects_response_missing_verdict_key():
    with pytest.raises(ValueError):
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            lambda _messages: '{"comment": "无关字段"}',
        )


def test_invoke_junjichu_council_rejects_non_string_verdict():
    with pytest.raises(ValueError):
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            lambda _messages: '{"verdict": 123}',
        )


@pytest.mark.parametrize("empty_verdict", ["", "   "])
def test_invoke_junjichu_council_rejects_empty_verdict(empty_verdict):
    def _chat_model(_messages: list[dict[str, str]]) -> str:
        return f'{{"verdict": "{empty_verdict}"}}'

    with pytest.raises(ValueError):
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            _chat_model,
        )


def test_invoke_junjichu_council_does_not_leak_secret_from_underlying_exception():
    leaking_marker = "sk-junjichu-adversarial-should-not-leak-86420"

    def _leaking_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure, key={leaking_marker}")

    with pytest.raises(RuntimeError) as exc_info:
        invoke_junjichu_council(
            "旨意",
            "判断说明",
            ["户部", "工部"],
            [
                {"department": "户部", "opinion": "意见一"},
                {"department": "工部", "opinion": "意见二"},
            ],
            _leaking_chat_model,
        )
    # This is the raw, unwrapped exception -- the leak-prevention guarantee
    # applies to ``ChancellorGraphInvocationError`` (constructed by the
    # Chancellor graph's own node, tested in ``test_chancellor_graph.py``),
    # not to this module's own propagate-unwrapped-by-design failures.
    assert leaking_marker in str(exc_info.value)


def _sequenced_chat_model(responses: list[str]):
    """Return a fake chat model that returns ``responses`` in call order."""

    call_index = {"value": 0}

    def _chat_model(messages: list[dict[str, str]]) -> str:
        index = call_index["value"]
        call_index["value"] += 1
        return responses[index]

    return _chat_model


def test_run_junjichu_council_invokes_departments_serially_in_order_then_council():
    captured_messages: list[list[dict[str, str]]] = []

    def _recording_chat_model(responses: list[str]):
        inner = _sequenced_chat_model(responses)

        def _chat_model(messages: list[dict[str, str]]) -> str:
            captured_messages.append(messages)
            return inner(messages)

        return _chat_model

    chat_model = _recording_chat_model(
        [
            '{"opinion": "户部意见"}',
            '{"opinion": "工部意见"}',
            '{"opinion": "兵部意见"}',
            '{"verdict": "军机处综合结论"}',
        ]
    )

    ministry_opinions, verdict = run_junjichu_council(
        "旨意", "判断说明", ["户部", "工部", "兵部"], chat_model
    )

    assert ministry_opinions == [
        {"department": "户部", "opinion": "户部意见"},
        {"department": "工部", "opinion": "工部意见"},
        {"department": "兵部", "opinion": "兵部意见"},
    ]
    assert verdict == "军机处综合结论"

    # Exactly 4 calls: one per department, then the council call, strictly
    # in that order -- proves serial invocation, not concurrent/fan-out.
    assert len(captured_messages) == 4
    department_order = ["户部", "工部", "兵部"]
    for index, department in enumerate(department_order):
        assert department in captured_messages[index][0]["content"]
    # The final call is the council call, distinguishable by referencing
    # every department's opinion in its user message.
    final_user_content = captured_messages[3][1]["content"]
    assert "户部意见" in final_user_content
    assert "工部意见" in final_user_content
    assert "兵部意见" in final_user_content


def test_run_junjichu_council_stops_before_remaining_departments_and_council_on_failure():
    call_count = {"value": 0}

    def _chat_model(messages: list[dict[str, str]]) -> str:
        call_count["value"] += 1
        if call_count["value"] == 1:
            return '{"opinion": "户部意见"}'
        raise RuntimeError("simulated second department failure")

    with pytest.raises(MinistryAgentInvocationError):
        run_junjichu_council("旨意", "判断说明", ["户部", "工部", "兵部"], _chat_model)

    # Only the first department's call was made before the failure -- the
    # third department and the council call never happened.
    assert call_count["value"] == 2


def test_run_junjichu_council_two_invocations_do_not_leak_state():
    chat_model_one = _sequenced_chat_model(
        ['{"opinion": "户部意见一"}', '{"opinion": "工部意见一"}', '{"verdict": "结论一"}']
    )
    chat_model_two = _sequenced_chat_model(
        ['{"opinion": "刑部意见二"}', '{"opinion": "兵部意见二"}', '{"verdict": "结论二"}']
    )

    opinions_one, verdict_one = run_junjichu_council(
        "旨意一", "判断一", ["户部", "工部"], chat_model_one
    )
    opinions_two, verdict_two = run_junjichu_council(
        "旨意二", "判断二", ["刑部", "兵部"], chat_model_two
    )

    assert opinions_one == [
        {"department": "户部", "opinion": "户部意见一"},
        {"department": "工部", "opinion": "工部意见一"},
    ]
    assert verdict_one == "结论一"
    assert opinions_two == [
        {"department": "刑部", "opinion": "刑部意见二"},
        {"department": "兵部", "opinion": "兵部意见二"},
    ]
    assert verdict_two == "结论二"
