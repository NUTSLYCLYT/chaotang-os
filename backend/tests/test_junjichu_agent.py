"""Offline tests for layered Grand Council orchestration."""

from __future__ import annotations

import json

import pytest

from app.agents.bureaus import bureau_profiles_for
from app.agents.junjichu.agent import invoke_junjichu_council, run_junjichu_council
from app.agents.junjichu.prompts import JUNJICHU_IDENTITY, junjichu_system_prompt
from app.agents.ministries.agent import MinistryAgentInvocationError, MinistryOpinion
from app.agents.ministries.prompts import NO_IRREVERSIBLE_ACTION_CONSTRAINT
from app.agents.structured_output import StructuredOutputError
from app.shiguan.recall import RecallContext, RecallMatch


def _layered_opinion(
    department: str, bureau_opinion: str = "司级意见", ministry_opinion: str = "部级补充"
) -> MinistryOpinion:
    return {
        "department": department,
        "bureau_opinions": [
            {
                "bureau": bureau_profiles_for(department)[0].bureau,
                "opinion": bureau_opinion,
            }
        ],
        "opinion": ministry_opinion,
    }


def _ministry_turns(department: str, bureau_opinion: str, ministry_opinion: str) -> list[str]:
    bureau = bureau_profiles_for(department)[0].bureau
    return [
        json.dumps(
            {"rationale": "交由本司办理", "bureaus": [bureau]}, ensure_ascii=False
        ),
        json.dumps({"opinion": bureau_opinion}, ensure_ascii=False),
        json.dumps({"opinion": ministry_opinion}, ensure_ascii=False),
    ]


def _sequenced_chat_model(responses: list[str]):
    index = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        response = responses[index["value"]]
        index["value"] += 1
        return response

    return _chat_model


def test_junjichu_prompt_contains_identity_departments_layers_and_constraint():
    prompt = junjichu_system_prompt(["户部", "工部"])
    assert JUNJICHU_IDENTITY in prompt
    assert "户部" in prompt
    assert "工部" in prompt
    assert "司级意见" in prompt
    assert "部级补充意见" in prompt
    assert "只能包含 verdict" in prompt
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt


def test_invoke_junjichu_receives_every_layer_and_returns_stripped_verdict():
    captured_messages: list[dict[str, str]] = []

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return '{"verdict": "  军机处会审通过  "}'

    verdict = invoke_junjichu_council(
        "拨款修渠并调兵护渠",
        "此事涉及户部与兵部，需军机处会审",
        ["户部", "兵部"],
        [
            _layered_opinion("户部", "预算司核查", "户部同意拨款"),
            _layered_opinion("兵部", "客户司核查", "兵部提出作战建议"),
        ],
        _chat_model,
    )

    assert verdict == "军机处会审通过"
    assert captured_messages[0] == {
        "role": "system",
        "content": junjichu_system_prompt(["户部", "兵部"]),
    }
    evidence = captured_messages[1]["content"]
    assert "拨款修渠并调兵护渠" in evidence
    assert "此事涉及户部与兵部" in evidence
    assert "预算司核查" in evidence
    assert "户部同意拨款" in evidence
    assert "客户司核查" in evidence
    assert "兵部提出作战建议" in evidence
    assert evidence.index("预算司核查") < evidence.index("客户司核查")


def test_invoke_junjichu_receives_read_only_recall_context(monkeypatch):
    captured_messages: list[dict[str, str]] = []

    monkeypatch.setattr(
        "app.agents.junjichu.agent.safe_recall_context_for_department",
        lambda department: RecallContext(
            available=True,
            entries=[
                RecallMatch(
                    archive_id=f"{department}-archive",
                    match_reason="仅部门匹配",
                    historical_conclusion=f"{department}历史结论",
                    evidence_labels=["MIXED"],
                    lessons_learned=f"{department}经验",
                    pitfalls=f"{department}教训",
                )
            ],
        ),
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return '{"verdict": "军机处会审通过"}'

    invoke_junjichu_council(
        "拨款修渠",
        "需户部与工部会审",
        ["户部", "工部"],
        [_layered_opinion("户部"), _layered_opinion("工部")],
        _chat_model,
    )

    evidence = captured_messages[1]["content"]
    assert "史馆旧案上下文" in evidence
    assert "户部-archive" in evidence
    assert "工部-archive" in evidence
    assert "MIXED" in evidence


def test_invoke_junjichu_accepts_strict_json_inside_supported_code_fence():
    verdict = invoke_junjichu_council(
        "旨意",
        "判断",
        ["刑部", "工部"],
        [_layered_opinion("刑部"), _layered_opinion("工部")],
        lambda _messages: '```json\n{"verdict":"依律核准"}\n```',
    )
    assert verdict == "依律核准"


@pytest.mark.parametrize(
    ("response", "error_type"),
    [
        ("", ValueError),
        ("   ", ValueError),
        ("not json", StructuredOutputError),
        ('{"comment":"无关字段"}', ValueError),
        ('{"verdict":123}', ValueError),
        ('{"verdict":" "}', ValueError),
        ('{"verdict":"结论","extra":true}', ValueError),
    ],
)
def test_invoke_junjichu_rejects_invalid_or_non_exact_response(response, error_type):
    with pytest.raises(error_type):
        invoke_junjichu_council(
            "旨意",
            "判断",
            ["户部", "工部"],
            [_layered_opinion("户部"), _layered_opinion("工部")],
            lambda _messages: response,
        )


def test_invoke_junjichu_model_failure_propagates_to_graph_boundary():
    marker = "sk-junjichu-raw-cause-86420"

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure key={marker}")

    with pytest.raises(RuntimeError) as exc_info:
        invoke_junjichu_council(
            "旨意",
            "判断",
            ["户部", "工部"],
            [_layered_opinion("户部"), _layered_opinion("工部")],
            _chat_model,
        )
    assert marker in str(exc_info.value)


def test_run_junjichu_calls_layered_ministries_serially_then_council():
    departments = ["户部", "工部", "兵部"]
    captured_messages: list[list[dict[str, str]]] = []
    responses: list[str] = []
    for department in departments:
        responses.extend(_ministry_turns(department, f"{department}司见", f"{department}补充"))
    responses.append('{"verdict":"军机处综合结论"}')
    inner = _sequenced_chat_model(responses)

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return inner(messages)

    opinions, verdict = run_junjichu_council(
        "旨意", "判断说明", departments, _chat_model
    )

    assert opinions == [
        _layered_opinion(department, f"{department}司见", f"{department}补充")
        for department in departments
    ]
    assert verdict == "军机处综合结论"
    assert len(captured_messages) == 10
    assert departments == [
        next(item for item in departments if item in captured_messages[index * 3][0]["content"])
        for index in range(3)
    ]
    council_evidence = captured_messages[-1][1]["content"]
    for department in departments:
        assert f"{department}司见" in council_evidence
        assert f"{department}补充" in council_evidence


def test_run_junjichu_failure_short_circuits_remaining_ministries_and_council():
    calls = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        calls["value"] += 1
        if calls["value"] == 1:
            return _ministry_turns("户部", "户司", "户部")[0]
        if calls["value"] == 2:
            return '{"opinion":"户司"}'
        if calls["value"] == 3:
            return '{"opinion":"户部"}'
        raise RuntimeError("simulated second ministry failure")

    with pytest.raises(MinistryAgentInvocationError):
        run_junjichu_council("旨意", "判断", ["户部", "工部", "兵部"], _chat_model)
    assert calls["value"] == 4


def test_run_junjichu_has_no_state_leak_across_invocations():
    first = _sequenced_chat_model(
        [
            *_ministry_turns("户部", "户司一", "户部一"),
            *_ministry_turns("工部", "工司一", "工部一"),
            '{"verdict":"结论一"}',
        ]
    )
    second = _sequenced_chat_model(
        [
            *_ministry_turns("刑部", "刑司二", "刑部二"),
            *_ministry_turns("兵部", "兵司二", "兵部二"),
            '{"verdict":"结论二"}',
        ]
    )
    opinions_one, verdict_one = run_junjichu_council(
        "旨意一", "判断一", ["户部", "工部"], first
    )
    opinions_two, verdict_two = run_junjichu_council(
        "旨意二", "判断二", ["刑部", "兵部"], second
    )
    assert verdict_one == "结论一"
    assert verdict_two == "结论二"
    assert [item["department"] for item in opinions_one] == ["户部", "工部"]
    assert [item["department"] for item in opinions_two] == ["刑部", "兵部"]
    assert opinions_one != opinions_two
