"""Single-call, pre-execution graph for case-driven draft preparation."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from pydantic import ValidationError

from app.accounting_reports.intent import detect_accounting_report_intent
from app.agents.chancellor_draft.models import ChancellorDraftResponse
from app.agents.chancellor_draft.routing import build_route_snapshot
from app.agents.chancellor_draft.skill_loader import load_chancellor_draft_skill
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config


class ChancellorDraftGraphState(TypedDict, total=False):
    messages: list[dict[str, str]]
    version: int
    response: dict


class ChancellorDraftGraphInvocationError(Exception):
    """Raised for sanitized model or structured-output failures."""


_TYPED_JSON_SKELETON = json.dumps(
    {
        "status": "DRAFT_READY",
        "understanding": "string",
        "expert_example": "string",
        "recommendation_reason": "string",
        "assumptions": ["string"],
        "revision_prompt": "non-empty string",
        "draft": {
            "objective": "string",
            "scope": ["string"],
            "exclusions": [],
            "input_materials": ["string"],
            "material_gaps": [],
            "key_questions": ["string"],
            "departments": [
                {
                    "department": "户部",
                    "bureaus": ["会计司"],
                    "role": "non-empty string",
                    "reason": "non-empty string",
                    "responsibility": "non-empty string",
                    "expected_output": "non-empty string",
                }
            ],
            "execution_steps": ["string"],
            "deliverables": ["string"],
            "completion_criteria": ["string"],
            "permissions_and_limits": ["string"],
            "current_status": "DRAFT_READY",
        },
    },
    ensure_ascii=False,
)

_ARRAY_OF_STRINGS_PATHS = {
    "assumptions",
    "draft.scope",
    "draft.exclusions",
    "draft.input_materials",
    "draft.material_gaps",
    "draft.key_questions",
    "draft.execution_steps",
    "draft.deliverables",
    "draft.completion_criteria",
    "draft.permissions_and_limits",
}

_NON_EMPTY_ARRAY_PATHS = {
    "draft.scope",
    "draft.key_questions",
    "draft.departments",
    "draft.execution_steps",
    "draft.deliverables",
    "draft.completion_criteria",
    "draft.permissions_and_limits",
}

_READY_CONSISTENCY_RULES = (
    "DRAFT_READY requires draft to be a non-null object. "
    "draft.current_status must equal DRAFT_READY. "
    "draft.material_gaps must be an empty JSON array."
)

_STRUCTURE_ONLY_REPAIR_RULE = (
    "This is structure-only repair. Preserve the original user's objective, "
    "domain, scope, exclusions, and requested outcome. Do not replace the task "
    "with schema validation, confirmation, no-requirement, or meta-discussion. "
    "这只是结构修复。必须保留原用户的目标、领域、范围、排除项和期望结果。"
    "不得把任务替换为模式校验、确认、无需求或元讨论。"
)

_KNOWN_EXACT_PATHS = {
    ("status",): "status",
    ("understanding",): "understanding",
    ("expert_example",): "expert_example",
    ("recommendation_reason",): "recommendation_reason",
    ("assumptions",): "assumptions",
    ("revision_prompt",): "revision_prompt",
    ("draft",): "draft",
    ("draft", "objective"): "draft.objective",
    ("draft", "scope"): "draft.scope",
    ("draft", "exclusions"): "draft.exclusions",
    ("draft", "input_materials"): "draft.input_materials",
    ("draft", "material_gaps"): "draft.material_gaps",
    ("draft", "key_questions"): "draft.key_questions",
    ("draft", "departments"): "draft.departments",
    ("draft", "execution_steps"): "draft.execution_steps",
    ("draft", "deliverables"): "draft.deliverables",
    ("draft", "completion_criteria"): "draft.completion_criteria",
    ("draft", "permissions_and_limits"): "draft.permissions_and_limits",
    ("draft", "current_status"): "draft.current_status",
}

_DEPARTMENT_FIELDS = {
    "department",
    "bureaus",
    "role",
    "reason",
    "responsibility",
    "expected_output",
}


def _safe_validation_path(location: tuple[object, ...]) -> str:
    exact = _KNOWN_EXACT_PATHS.get(location)
    if exact is not None:
        return exact
    if (
        len(location) == 2
        and isinstance(location[1], int)
        and location[0] == "assumptions"
    ):
        return "assumptions[]"
    if (
        len(location) == 3
        and isinstance(location[2], int)
        and _KNOWN_EXACT_PATHS.get(location[:2]) in _ARRAY_OF_STRINGS_PATHS
    ):
        return f"{_KNOWN_EXACT_PATHS[location[:2]]}[]"
    if (
        len(location) == 3
        and location[:2] == ("draft", "departments")
        and isinstance(location[2], int)
    ):
        return "draft.departments[]"
    if (
        len(location) == 4
        and location[:2] == ("draft", "departments")
        and isinstance(location[2], int)
        and location[3] in _DEPARTMENT_FIELDS
    ):
        return f"draft.departments[].{location[3]}"
    if (
        len(location) == 5
        and location[:2] == ("draft", "departments")
        and isinstance(location[2], int)
        and location[3] == "bureaus"
        and isinstance(location[4], int)
    ):
        return "draft.departments[].bureaus[]"
    return "unknown field"


def _structure_correction(error: Exception | None) -> str:
    invalid_paths: list[str] = []
    if isinstance(error, ValidationError):
        invalid_paths = sorted(
            {
                _safe_validation_path(tuple(item["loc"]))
                for item in error.errors(include_url=False)
                if item["loc"]
            }
        )

    path_rules = []
    for path in invalid_paths:
        if path == "revision_prompt":
            path_rules.append("revision_prompt must be a non-empty string.")
        elif path == "draft.departments":
            path_rules.append(
                "draft.departments must be a non-empty JSON array; each "
                "department object requires non-empty strings for department, "
                "role, reason, responsibility, and expected_output, plus a "
                "non-empty bureaus array."
            )
        elif path in _ARRAY_OF_STRINGS_PATHS:
            path_rules.append(f"{path} must be a JSON array of strings.")
            if path in _NON_EMPTY_ARRAY_PATHS:
                path_rules.append(f"{path} must contain at least one item.")
        elif path.removesuffix("[]") in _ARRAY_OF_STRINGS_PATHS:
            path_rules.append(f"{path} must be a string.")
        else:
            path_rules.append(f"{path} must match the typed JSON skeleton.")
    invalid_fields = (
        " Invalid field paths: " + " ".join(path_rules) if path_rules else ""
    )
    return (
        "Your previous response did not match the required JSON schema."
        f"{invalid_fields} {_READY_CONSISTENCY_RULES} {_STRUCTURE_ONLY_REPAIR_RULE} "
        "Return one corrected JSON object only. Do not copy the invalid field values "
        "into this correction instruction. Every list field must remain a JSON "
        "array even with one or zero items. draft must be null unless the complete "
        "draft schema is available. Do not add version, fingerprint, or decree_text. "
        "expert_example must be the natural-language decree text the user can confirm "
        "and execute directly, never structured JSON, and must contain 1 to 2000 "
        "characters after trimming surrounding whitespace. "
        "department must be one of the fixed six ministries: "
        "吏部、户部、礼部、兵部、刑部、工部. bureaus must list one or more "
        "real bureaus belonging to that department, without duplicates. "
        "For accounting or financial-report work use department 户部 and "
        'bureaus ["会计司"], never department 户部会计司. '
        f"Use this complete typed JSON skeleton:\n{_TYPED_JSON_SKELETON}"
    )


def _system_prompt(instructions: str) -> str:
    return (
        "你正在运行朝堂 OS 独立的拟旨阶段。以下仓库 Skill 是必须遵守的完整行为契约：\n\n"
        f"{instructions}\n\n"
        "只输出一个 JSON 对象，不要输出 Markdown 或额外说明。对象必须包含："
        "status、understanding、expert_example、recommendation_reason、"
        "assumptions、revision_prompt、draft。"
        "status 只能是 CLARIFYING、DRAFT_READY、NEEDS_INPUT、PARTIAL、"
        "ISSUE_BLOCKED、ISSUED、EXECUTING、RETURNED。"
        "拟旨阶段不得输出 ISSUED、EXECUTING 或 RETURNED。"
        "优先生成完整的大神级拟旨草案，而不是只给案例后等待确认。"
        "可以用保守、可撤销、最小范围默认值补齐的内容，应标为丞相建议或暂定边界。"
        "没有真实阻断时返回 DRAFT_READY；真实阻断仅包括材料、权限、冲突或安全阻断。"
        "不得为了多问一句而返回 CLARIFYING，也不得隐藏真实阻断来强行启用下旨。"
        "draft 在尚未形成完整草案时为 null；形成草案时严格使用以下字段："
        "objective, scope, exclusions, input_materials, material_gaps, "
        "key_questions, departments, execution_steps, deliverables, "
        "completion_criteria, permissions_and_limits, current_status。"
        "departments 的每项包含 department、bureaus、role、reason、responsibility、"
        "expected_output。所有列表字段必须保持 JSON 数组，即使只有一项或零项。"
        "六部固定为吏部、户部、礼部、兵部、刑部、工部；department 只能是六部名称。"
        "bureaus 必须是非空、无重复且仅包含本部真实司的数组。"
        "财务报表任务必须使用 department: \"户部\" 与 bureaus: [\"会计司\"]，"
        "不得把户部会计司写成 department。"
        "revision_prompt 必须是非空字符串。"
        "departments 必须是至少包含一项的 JSON 数组，且每个对象的 department、role、"
        "reason、responsibility、expected_output 都必须是非空字符串。"
        "scope、key_questions、execution_steps、deliverables、completion_criteria、"
        "permissions_and_limits 必须是至少包含一项的 JSON 数组。"
        "exclusions、input_materials、material_gaps、assumptions 可以为空数组。"
        "expert_example 是用户确认并直接执行的自然语言旨意正文，不得放结构化 JSON，"
        "去除首尾空白后必须为 1–2000 字。"
        "不要输出 version、fingerprint 或 decree_text，它们由系统生成。"
        f"{_READY_CONSISTENCY_RULES}"
        f"严格遵循这个完整类型 JSON 骨架：\n{_TYPED_JSON_SKELETON}"
    )


def _validate_ready_route_semantics(
    messages: list[dict[str, str]],
    response: ChancellorDraftResponse,
) -> None:
    user_text = "\n".join(
        message["content"]
        for message in messages
        if message.get("role") == "user"
        and isinstance(message.get("content"), str)
    )
    if not detect_accounting_report_intent(user_text).requested:
        return
    if response.draft is None:
        return
    routes = response.draft.departments
    if (
        len(routes) != 1
        or routes[0].department != "户部"
        or routes[0].bureaus != ["会计司"]
    ):
        raise ValueError(
            "accounting report drafts require only 户部 and 会计司"
        )


def _canonical_payload(
    *,
    version: int,
    normalized_payload: dict,
    decree_text: str | None,
    route_snapshot: dict | None,
) -> dict:
    return {
        "version": version,
        **normalized_payload,
        "decree_text": decree_text,
        "route_snapshot": route_snapshot,
    }


def build_chancellor_draft_graph(
    chat_model: DeepSeekChatModel | None = None,
    dotenv_path: Path | None = None,
) -> CompiledStateGraph:
    """Build the isolated draft graph without importing the decree workflow."""

    skill = load_chancellor_draft_skill()
    if chat_model is None:
        config = load_deepseek_provider_config()
        resolved_chat_model = build_deepseek_chat_model(
            config,
            dotenv_path,
            json_output=True,
        )
    else:
        resolved_chat_model = chat_model

    def _draft(state: ChancellorDraftGraphState) -> dict:
        messages = [
            {"role": "system", "content": _system_prompt(skill.instructions)},
            *state["messages"],
        ]
        response = None
        validation_error: Exception | None = None
        for attempt in range(2):
            attempt_messages = (
                messages
                if attempt == 0
                else [
                    {
                        "role": "system",
                        "content": (
                            f"{messages[0]['content']}\n\n"
                            f"{_structure_correction(validation_error)}"
                        ),
                    },
                    *messages[1:],
                ]
            )
            try:
                raw = resolved_chat_model(attempt_messages)
            except Exception as exc:  # noqa: BLE001
                raise ChancellorDraftGraphInvocationError(
                    "Chancellor draft graph failed to obtain a model response."
                ) from exc

            try:
                if not isinstance(raw, str):
                    raise TypeError
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise TypeError
                version = state["version"]
                expert_example = payload["expert_example"]
                if not isinstance(expert_example, str):
                    raise TypeError
                normalized_payload = {
                    **payload,
                    "expert_example": expert_example.strip(),
                }
                decree_text = (
                    normalized_payload["expert_example"]
                    if normalized_payload.get("status") == "DRAFT_READY"
                    else None
                )
                validated = ChancellorDraftResponse.model_validate(
                    {
                        **normalized_payload,
                        "version": version,
                        "fingerprint": "0" * 64,
                        "decree_text": decree_text,
                    }
                )
                _validate_ready_route_semantics(state["messages"], validated)
                route_snapshot = (
                    build_route_snapshot(validated.draft).model_dump(mode="json")
                    if validated.draft is not None
                    else None
                )
                canonical = json.dumps(
                    _canonical_payload(
                        version=version,
                        normalized_payload=normalized_payload,
                        decree_text=decree_text,
                        route_snapshot=route_snapshot,
                    ),
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                response = ChancellorDraftResponse.model_validate(
                    {
                        **normalized_payload,
                        "version": version,
                        "fingerprint": hashlib.sha256(
                            canonical.encode("utf-8")
                        ).hexdigest(),
                        "decree_text": decree_text,
                    }
                )
                break
            except (
                json.JSONDecodeError,
                TypeError,
                KeyError,
                ValueError,
                ValidationError,
            ) as exc:
                validation_error = exc

        if response is None:
            raise ChancellorDraftGraphInvocationError(
                "Chancellor draft graph returned invalid structured output."
            ) from validation_error

        if response.status.value in {"ISSUED", "EXECUTING", "RETURNED"}:
            raise ChancellorDraftGraphInvocationError(
                "Chancellor draft graph attempted an execution-only state."
            )
        return {"response": response.model_dump(mode="json")}

    builder = StateGraph(ChancellorDraftGraphState)
    builder.add_node("draft", _draft)
    builder.add_edge(START, "draft")
    builder.add_edge("draft", END)
    return builder.compile()
