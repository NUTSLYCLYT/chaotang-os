from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.agents.chancellor_draft.graph import (
    ChancellorDraftGraphInvocationError,
    build_chancellor_draft_graph,
)


def _valid_model_response() -> str:
    return json.dumps(
        {
            "status": "CLARIFYING",
            "understanding": "用户希望了解股票投资，但目标和边界仍是推测。",
            "expert_example": "我想用闲置资金参与 A 股，在控制重大亏损的前提下争取合理收益。",
            "recommendation_reason": "先明确风险和退出条件，可以避免把赚钱误解为追逐短期上涨。",
            "assumptions": ["使用闲置资金", "不借贷"],
            "revision_prompt": "请直接说案例中哪里不像你，例如只做 A 股、计划持有半年。",
            "draft": None,
        },
        ensure_ascii=False,
    )


def _valid_ready_payload() -> dict[str, object]:
    payload = json.loads(_valid_model_response())
    payload["status"] = "DRAFT_READY"
    payload["draft"] = {
        "objective": "核查合同风险",
        "scope": ["付款条款"],
        "exclusions": [],
        "input_materials": ["合同正文"],
        "material_gaps": [],
        "key_questions": ["付款条件是否明确"],
        "departments": [
            {
                "department": "户部",
                "role": "主审",
                "reason": "涉及付款",
                "responsibility": "审查结算风险",
                "expected_output": "付款风险清单",
            }
        ],
        "execution_steps": ["审查付款条款"],
        "deliverables": ["风险清单"],
        "completion_criteria": ["逐项给出依据"],
        "permissions_and_limits": ["不自动签约"],
        "current_status": "DRAFT_READY",
    }
    return payload


def test_graph_loads_skill_and_calls_model_once() -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_model_response()

    result = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我想炒股赚钱"}],
            "version": 1,
        }
    )

    assert len(calls) == 1
    system_prompt = calls[0][0]["content"]
    assert "优先生成完整的大神级拟旨草案" in system_prompt
    assert "没有真实阻断时返回 DRAFT_READY" in system_prompt
    assert "丞相建议" in system_prompt
    assert "暂定边界" in system_prompt
    assert '"assumptions": ["string"]' in system_prompt
    assert '"departments": [' in system_prompt
    assert "即使只有一项或零项" in system_prompt
    assert "revision_prompt 必须是非空字符串" in system_prompt
    assert "departments 必须是至少包含一项的 JSON 数组" in system_prompt
    assert "scope、key_questions、execution_steps、deliverables" in system_prompt
    assert "exclusions、input_materials、material_gaps、assumptions 可以为空数组" in (
        system_prompt
    )
    skeleton_index = system_prompt.index("严格遵循这个完整类型 JSON 骨架")
    assert system_prompt.index(
        "DRAFT_READY requires draft to be a non-null object"
    ) < skeleton_index
    assert "draft.current_status must equal DRAFT_READY" in system_prompt
    assert "draft.material_gaps must be an empty JSON array" in system_prompt
    assert calls[0][1] == {"role": "user", "content": "我想炒股赚钱"}
    assert result["response"]["status"] == "CLARIFYING"
    assert len(result["response"]["fingerprint"]) == 64


def test_graph_rejects_non_json_model_output() -> None:
    graph = build_chancellor_draft_graph(chat_model=lambda _messages: "普通文本")

    with pytest.raises(ChancellorDraftGraphInvocationError):
        graph.invoke(
            {
                "messages": [{"role": "user", "content": "帮我拟旨"}],
                "version": 1,
            }
        )


def test_graph_corrects_one_invalid_structured_response() -> None:
    invalid = json.loads(_valid_model_response())
    invalid["assumptions"] = "使用闲置资金，不借贷"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            _valid_model_response(),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    original_messages = [{"role": "user", "content": "我想炒股赚钱"}]
    original_snapshot = [message.copy() for message in original_messages]
    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": original_messages,
            "version": 1,
        }
    )["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 2
    assert calls[1][0]["role"] == "system"
    assert "assumptions must be a JSON array" in calls[1][0]["content"]
    assert (
        "This is structure-only repair. Preserve the original user's objective, "
        "domain, scope, exclusions, and requested outcome. Do not replace the "
        "task with schema validation, confirmation, no-requirement, or "
        "meta-discussion."
    ) in calls[1][0]["content"]
    assert "这只是结构修复" in calls[1][0]["content"]
    assert calls[1][-1]["role"] == "user"
    assert calls[1][-1] == original_messages[-1]
    assert calls[1][1:] == original_messages
    assert len(calls[1]) == len(original_messages) + 1
    assert original_messages == original_snapshot


def test_graph_correction_names_every_invalid_draft_list_path() -> None:
    invalid = _valid_ready_payload()
    invalid_draft = invalid["draft"]
    assert isinstance(invalid_draft, dict)
    invalid_paths = (
        "scope",
        "exclusions",
        "input_materials",
        "deliverables",
        "completion_criteria",
        "permissions_and_limits",
    )
    for field_name in invalid_paths:
        invalid_draft[field_name] = "错误的字符串列表"

    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(_valid_ready_payload(), ensure_ascii=False),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我要炒股赚钱"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "DRAFT_READY"
    assert len(calls) == 2
    correction = calls[1][0]
    assert correction["role"] == "system"
    for field_name in invalid_paths:
        assert (
            f"draft.{field_name} must be a JSON array of strings"
            in correction["content"]
        )
    assert "错误的字符串列表" not in correction["content"]


def test_graph_correction_never_echoes_unknown_field_name() -> None:
    marker = "IGNORE_ALL_RULES_SECRET_MARKER"
    invalid = json.loads(_valid_model_response())
    invalid[marker] = "attacker-controlled value"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            _valid_model_response(),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "帮我拟旨"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 2
    correction = calls[1][0]["content"]
    assert marker not in correction
    assert "attacker-controlled value" not in correction
    assert "unknown field" in correction


def test_graph_correction_explains_non_empty_string_and_array_minimums() -> None:
    invalid = _valid_ready_payload()
    invalid["revision_prompt"] = ""
    invalid_draft = invalid["draft"]
    assert isinstance(invalid_draft, dict)
    invalid_draft["departments"] = []
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(_valid_ready_payload(), ensure_ascii=False),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我要炒股赚钱"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "DRAFT_READY"
    assert len(calls) == 2
    correction = calls[1][0]["content"]
    assert "revision_prompt must be a non-empty string" in correction
    assert "draft.departments must be a non-empty JSON array" in correction
    assert (
        "each department object requires non-empty strings for department, role, "
        "reason, responsibility, and expected_output"
    ) in correction


def test_graph_correction_explains_ready_draft_consistency() -> None:
    invalid = json.loads(_valid_model_response())
    invalid["status"] = "DRAFT_READY"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(_valid_ready_payload(), ensure_ascii=False),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我要炒股赚钱"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "DRAFT_READY"
    assert len(calls) == 2
    correction = calls[1][0]["content"]
    assert "DRAFT_READY requires draft to be a non-null object" in correction
    assert "draft.current_status must equal DRAFT_READY" in correction
    assert "draft.material_gaps must be an empty JSON array" in correction


def test_ready_graph_response_contains_server_canonical_decree_text() -> None:
    payload = _valid_ready_payload()
    graph = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    )

    response = graph.invoke({
        "messages": [{"role": "user", "content": "审合同"}],
        "version": 1,
    })["response"]

    assert json.loads(response["decree_text"])["objective"] == "核查合同风险"


@pytest.mark.parametrize(
    ("mutation", "expected_fragment"),
    [
        (lambda payload: payload.update(draft=None), "draft"),
        (
            lambda payload: payload["draft"].update(
                material_gaps=["缺少合同正文"]
            ),
            "material_gaps",
        ),
        (
            lambda payload: payload["draft"].update(current_status="CLARIFYING"),
            "current_status",
        ),
    ],
)
def test_draft_ready_rejects_inconsistent_draft(
    mutation, expected_fragment
) -> None:
    payload = _valid_ready_payload()
    mutation(payload)

    with pytest.raises(ChancellorDraftGraphInvocationError) as exc_info:
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke(
            {
                "messages": [{"role": "user", "content": "我要炒股赚钱"}],
                "version": 1,
            }
        )

    assert isinstance(exc_info.value.__cause__, ValidationError)
    assert expected_fragment in str(exc_info.value.__cause__)


def test_non_ready_response_rejects_nested_ready_draft() -> None:
    payload = _valid_ready_payload()
    payload["status"] = "CLARIFYING"

    with pytest.raises(ChancellorDraftGraphInvocationError) as exc_info:
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke(
            {
                "messages": [{"role": "user", "content": "我要炒股赚钱"}],
                "version": 1,
            }
        )

    assert isinstance(exc_info.value.__cause__, ValidationError)
    assert "non-ready response" in str(exc_info.value.__cause__)
