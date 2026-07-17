"""Tests for ``app.agents.ministries`` (roster, prompts, agent invocation).

Fully offline: every test injects a fake ``chat_model`` callable and never
touches environment variables, configuration files, or the network.
"""

from __future__ import annotations

import pytest

from app.agents.ministries.agent import MinistryAgentInvocationError, invoke_ministry_agent
from app.agents.ministries.prompts import (
    MINISTRIES,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    ministry_system_prompt,
)


def test_ministries_roster_is_the_fixed_six_departments():
    assert MINISTRIES == ("吏部", "户部", "礼部", "兵部", "刑部", "工部")


@pytest.mark.parametrize("department", MINISTRIES)
def test_ministry_system_prompt_contains_identity_and_shared_constraint(department):
    prompt = ministry_system_prompt(department)
    assert department in prompt
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt


def test_ministry_system_prompt_rejects_unknown_department():
    with pytest.raises(ValueError):
        ministry_system_prompt("礼仪司")


def test_invoke_ministry_agent_sends_expected_messages_and_returns_opinion():
    captured_messages: list[dict[str, str]] = []

    def _capturing_chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return '{"opinion": "臣部建议核准"}'

    opinion = invoke_ministry_agent(
        "户部", "拨款修渠", "此事关乎钱粮，交户部办理", _capturing_chat_model
    )

    assert opinion == "臣部建议核准"
    assert captured_messages[0] == {
        "role": "system",
        "content": ministry_system_prompt("户部"),
    }
    assert captured_messages[1]["role"] == "user"
    assert "拨款修渠" in captured_messages[1]["content"]
    assert "此事关乎钱粮，交户部办理" in captured_messages[1]["content"]


def test_invoke_ministry_agent_strips_whitespace_from_opinion():
    opinion = invoke_ministry_agent(
        "工部", "修渠", "交工部办理", lambda _messages: '{"opinion": "  可行  "}'
    )
    assert opinion == "可行"


def test_invoke_ministry_agent_unwraps_json_code_fence():
    opinion = invoke_ministry_agent(
        "刑部",
        "审案",
        "交刑部办理",
        lambda _messages: '```json\n{"opinion": "依律审理"}\n```',
    )
    assert opinion == "依律审理"


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
