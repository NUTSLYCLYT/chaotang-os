"""Single-call, pre-execution graph for case-driven draft preparation."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from pydantic import ValidationError

from app.accounting_reports import (
    AccountingPeriodResolution,
    PeriodResolutionStatus,
    ReportIntentKind,
    ReportPeriod,
    detect_accounting_report_intent,
    preflight_accounting_sources,
)
from app.accounting_reports.period_policy import LedgerLoader
from app.agents.bureaus.profiles import BUREAU_PROFILES
from app.agents.chancellor_draft.battery_safety import (
    BatterySafetyLevel,
    battery_safety_prompt_constraint,
    blocked_battery_response,
    classify_battery_safety,
    enforce_battery_safety_response,
    expected_draft_fingerprint,
)
from app.agents.chancellor_draft.instructions_loader import (
    load_chancellor_draft_instructions,
)
from app.agents.chancellor_draft.models import ChancellorDraftResponse
from app.agents.chancellor_draft.routing import build_route_snapshot
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config
from app.langgraph_runtime.provider_budget import get_provider_attempt_budget


class ChancellorDraftGraphState(TypedDict, total=False):
    messages: list[dict[str, str]]
    version: int
    response: dict
    accounting_context: dict
    preserve_authority: bool


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

_BUREAU_ROUTE_CATALOG = "; ".join(
    f"{department}=[{','.join(profile.bureau for profile in BUREAU_PROFILES if profile.department == department)}]"  # noqa: E501
    for department in ("吏部", "户部", "礼部", "兵部", "刑部", "工部")
)

_MINISTRIES = tuple(
    dict.fromkeys(profile.department for profile in BUREAU_PROFILES)
)
_BUREAUS_BY_DEPARTMENT = {
    department: frozenset(
        profile.bureau
        for profile in BUREAU_PROFILES
        if profile.department == department
    )
    for department in _MINISTRIES
}
_EXPLICIT_BUREAU_FOLLOWING_MARKERS = (
    "制定",
    "编制",
    "生成",
    "制作",
    "形成",
    "负责",
    "处理",
    "办理",
    "开展",
    "提供",
    "审查",
    "核查",
    "评估",
    "检查",
    "统筹",
    "更新",
    "协调",
    "确认",
    "提交",
    "输出",
    "交付",
    "调查",
    "分析",
    "优化",
    "管理",
    "执行",
    "落实",
    "推进",
)
_EXPLICIT_BUREAU_PATTERN = re.compile(
    rf"(?P<department>{'|'.join(map(re.escape, _MINISTRIES))})"
    r"[\s的:：/、-]*"
    r"(?P<bureau>[\u4e00-\u9fff]+?司)"
    rf"(?=$|[\s,，。；;：:/、（）()]+|"
    rf"{'|'.join(map(re.escape, _EXPLICIT_BUREAU_FOLLOWING_MARKERS))})"
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
        f"Use only this department-to-bureau catalog: {_BUREAU_ROUTE_CATALOG}. "
        "If the request does not support a defensible legal bureau, return "
        "NEEDS_INPUT with draft null; never select the first bureau as a fallback. "
        "For accounting or financial-report work use department 户部 and "
        'bureaus ["会计司"], never department 户部会计司. '
        f"Use this complete typed JSON skeleton:\n{_TYPED_JSON_SKELETON}"
    )


def _system_prompt(instructions: str) -> str:
    return (
        "你正在运行朝堂 OS 独立的拟旨阶段。以下后端运行指令是必须遵守的完整行为契约：\n\n"
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
        f"司级路由只能从以下对应表选择：{_BUREAU_ROUTE_CATALOG}。"
        "无法依据用户要求与冻结职责确定合法司时，返回 NEEDS_INPUT 且 draft 为 null；"
        "不得以本部首司作为固定回退，也不得创造或映射司名。"
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


def _default_period_assumption(reference_date: date, period: ReportPeriod) -> str:
    return (
        "按上一完整年度规则，基于"
        f" {reference_date.isoformat()}，报表期间固定为 {period.start_year} 年。"
    )


def _resolved_period_constraint(period: ReportPeriod) -> str:
    period_label = (
        f"{period.start_year} 年"
        if period.start_year == period.end_year
        else f"{period.start_year}-{period.end_year} 年"
    )
    return (
        "\n\n系统已确定本次财务报表期间。"
        "expert_example 必须包含且只能包含一个受支持的 EXPLICIT_PERIOD，"
        f"该期间必须精确等于 {period_label}；不得省略、改写、扩展或替换年份。"
        "draft.departments 必须且只能是 department 户部、bureaus [\"会计司\"]。"
    )


def _deterministic_needs_input_response(
    *,
    version: int,
    resolution: AccountingPeriodResolution,
) -> ChancellorDraftResponse:
    if resolution.reason == "subject_identity_unresolved":
        guidance = (
            "当前财务数据未提供唯一且可信的主体身份，无法安全确定报表归属。"
            "请由管理员在受控数据源中明确唯一主体身份后重试；"
            "不得根据文件名、目录名或用户提示推断主体。"
        )
        assumptions = []
        recommendation_reason = (
            "主体身份缺失、空白、未规范化或存在冲突，不能形成可执行拟旨。"
        )
    elif resolution.reason == "previous_complete_year_unavailable":
        if resolution.period is None:
            raise ValueError("defaulted unavailable period must be retained")
        year = resolution.period.start_year
        guidance = (
            f"上一完整年度（{year}年）的财务数据当前不可用。"
            f"请提供{year}年财务数据，或明确一个可用的报表年份。"
        )
        assumptions = [f"上一完整年度固定为{year}年。"]
        recommendation_reason = (
            "缺少可用的上一完整年度数据，不能形成可执行拟旨。"
        )
    elif resolution.reason == "requested_period_unavailable":
        if resolution.period is None:
            raise ValueError("requested unavailable period must be retained")
        period_label = (
            str(resolution.period.start_year)
            if resolution.period.start_year == resolution.period.end_year
            else f"{resolution.period.start_year}-{resolution.period.end_year}"
        )
        guidance = (
            f"请求的{period_label}年财务数据当前无法安全解析。"
            "请提供结构明确且可校验的对应期间数据。"
        )
        assumptions = []
        recommendation_reason = "请求期间的数据不可安全解析，不能形成可执行拟旨。"
    else:
        guidance = (
            "报表期间无效或存在歧义。请明确一个可用的四位数报表年份。"
        )
        assumptions = []
        recommendation_reason = "期间未能确定，不能形成可执行拟旨。"

    normalized_payload = {
        "status": "NEEDS_INPUT",
        "understanding": guidance,
        "expert_example": guidance,
        "recommendation_reason": recommendation_reason,
        "assumptions": assumptions,
        "revision_prompt": guidance,
        "draft": None,
    }
    canonical = json.dumps(
        _canonical_payload(
            version=version,
            normalized_payload=normalized_payload,
            decree_text=None,
            route_snapshot=None,
        ),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return ChancellorDraftResponse.model_validate(
        {
            **normalized_payload,
            "version": version,
            "fingerprint": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            "decree_text": None,
        }
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


def _latest_user_text(messages: list[dict[str, str]]) -> str:
    for message in reversed(messages):
        content = message.get("content")
        if message.get("role") == "user" and isinstance(content, str):
            return content
    return ""


def _invalid_explicit_bureau_departments(
    messages: list[dict[str, str]],
) -> tuple[str, ...]:
    invalid_departments: list[str] = []
    for match in _EXPLICIT_BUREAU_PATTERN.finditer(_latest_user_text(messages)):
        department = match.group("department")
        bureau = match.group("bureau")
        if bureau.endswith("公司"):
            continue
        if bureau not in _BUREAUS_BY_DEPARTMENT[department]:
            invalid_departments.append(department)
    return tuple(dict.fromkeys(invalid_departments))


def _explicit_bureau_needs_input_response(
    *,
    messages: list[dict[str, str]],
    version: int,
) -> ChancellorDraftResponse | None:
    departments = _invalid_explicit_bureau_departments(messages)
    if not departments:
        return None

    allowed = "；".join(
        f"{department}："
        + "、".join(
            profile.bureau
            for profile in BUREAU_PROFILES
            if profile.department == department
        )
        for department in departments
    )
    normalized_payload = {
        "status": "NEEDS_INPUT",
        "understanding": "你指定了已登记部门，但承办司不在该部门的冻结名录内。",
        "expert_example": "请从该部门已登记的承办司中选择，或仅指定部门并允许按冻结职责选择。",
        "recommendation_reason": "未知司和跨部司不能形成可下旨的授权路由，也不得静默映射为其他司。",
        "assumptions": [],
        "revision_prompt": f"请改用以下冻结名录中的承办司，或删除司名：{allowed}",
        "draft": None,
    }
    canonical = json.dumps(
        _canonical_payload(
            version=version,
            normalized_payload=normalized_payload,
            decree_text=None,
            route_snapshot=None,
        ),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return ChancellorDraftResponse.model_validate(
        {
            **normalized_payload,
            "version": version,
            "fingerprint": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            "decree_text": None,
        }
    )


def _validate_resolved_period_semantics(
    response: ChancellorDraftResponse,
    resolution: AccountingPeriodResolution,
) -> None:
    if (
        resolution.status is not PeriodResolutionStatus.RESOLVED
        or response.status.value != "DRAFT_READY"
    ):
        return
    if resolution.period is None:
        raise ValueError("resolved accounting period must be retained")
    canonical_intent = detect_accounting_report_intent(response.expert_example)
    if (
        canonical_intent.kind is not ReportIntentKind.EXPLICIT_PERIOD
        or canonical_intent.period != resolution.period
    ):
        raise ValueError(
            "accounting report decree must use the exact resolved period"
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
    *,
    today_provider: Callable[[], date] = date.today,
    accounting_source_dir: Path | None = None,
    accounting_source_dir_resolver: Callable[[], Path] | None = None,
    accounting_source_loader: LedgerLoader = preflight_accounting_sources,
) -> CompiledStateGraph:
    """Build the isolated draft graph without importing the decree workflow."""

    instructions = load_chancellor_draft_instructions()
    resolved_chat_model = chat_model

    def _get_chat_model() -> DeepSeekChatModel:
        nonlocal resolved_chat_model
        if resolved_chat_model is None:
            config = load_deepseek_provider_config()
            resolved_chat_model = build_deepseek_chat_model(
                config,
                dotenv_path,
                json_output=True,
                attempt_budget=get_provider_attempt_budget(),
            )
        return resolved_chat_model

    def _draft(state: ChancellorDraftGraphState) -> dict:
        user_text = "\n".join(
            message["content"]
            for message in state["messages"]
            if message.get("role") == "user"
            and isinstance(message.get("content"), str)
        )
        safety_decision = classify_battery_safety(user_text)
        if safety_decision.level is BatterySafetyLevel.P0:
            response = blocked_battery_response(user_text, state["version"])
            return {
                "response": response.model_dump(mode="json"),
                "preserve_authority": True,
            }

        def project_deterministic_response(
            response: ChancellorDraftResponse,
        ) -> ChancellorDraftResponse:
            projected = enforce_battery_safety_response(user_text, response)
            if projected == response:
                return response
            return projected.model_copy(
                update={"fingerprint": expected_draft_fingerprint(projected)}
            )

        deterministic_response = _explicit_bureau_needs_input_response(
            messages=state["messages"],
            version=state["version"],
        )
        if deterministic_response is not None:
            deterministic_response = project_deterministic_response(
                deterministic_response
            )
            return {"response": deterministic_response.model_dump(mode="json")}

        reference_date = today_provider()
        accounting_intent = detect_accounting_report_intent(user_text)
        if accounting_intent.kind is ReportIntentKind.INVALID_PERIOD:
            resolution = AccountingPeriodResolution(
                PeriodResolutionStatus.NEEDS_INPUT, None, False, "invalid_period"
            )
        elif accounting_intent.kind is ReportIntentKind.MISSING_PERIOD:
            resolution = AccountingPeriodResolution(
                PeriodResolutionStatus.RESOLVED,
                ReportPeriod(reference_date.year - 1, reference_date.year - 1),
                True,
            )
        elif accounting_intent.kind is ReportIntentKind.EXPLICIT_PERIOD:
            resolution = AccountingPeriodResolution(
                PeriodResolutionStatus.RESOLVED,
                accounting_intent.period,
                False,
            )
        else:
            resolution = AccountingPeriodResolution(
                PeriodResolutionStatus.NOT_REQUESTED, None, False
            )
        if resolution.status is PeriodResolutionStatus.NEEDS_INPUT:
            response = _deterministic_needs_input_response(
                version=state["version"],
                resolution=resolution,
            )
            response = project_deterministic_response(response)
            return {
                "response": response.model_dump(mode="json"),
                "preserve_authority": accounting_intent.requested,
            }

        system_prompt = _system_prompt(instructions.instructions)
        system_prompt += battery_safety_prompt_constraint(safety_decision)
        if resolution.status is PeriodResolutionStatus.RESOLVED:
            if resolution.period is None:
                raise ValueError("resolved accounting period must be retained")
            system_prompt += _resolved_period_constraint(resolution.period)
        messages = [
            {
                "role": "system",
                "content": system_prompt,
            },
            *state["messages"],
        ]
        response = None
        validation_error: Exception | None = None
        for attempt in range(3):
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
                raw = _get_chat_model()(attempt_messages)
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
                if resolution.used_default and isinstance(
                    normalized_payload.get("assumptions"), list
                ):
                    assumption = _default_period_assumption(
                        reference_date,
                        resolution.period,
                    )
                    if assumption not in normalized_payload["assumptions"]:
                        normalized_payload["assumptions"] = [
                            *normalized_payload["assumptions"],
                            assumption,
                        ]
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
                validated = enforce_battery_safety_response(user_text, validated)
                normalized_payload = validated.model_dump(
                    mode="python",
                    exclude={"version", "fingerprint", "decree_text"},
                )
                decree_text = validated.decree_text
                _validate_ready_route_semantics(state["messages"], validated)
                _validate_resolved_period_semantics(validated, resolution)
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
        result = {"response": response.model_dump(mode="json")}
        if (
            response.status.value == "DRAFT_READY"
            and accounting_intent.requested
            and resolution.period is not None
        ):
            result["accounting_context"] = {
                "request_kind": accounting_intent.request_kind.value,
                "period_start": resolution.period.start_year,
                "period_end": resolution.period.end_year,
                "source_fingerprint": None,
            }
        return result

    builder = StateGraph(ChancellorDraftGraphState)
    builder.add_node("draft", _draft)
    builder.add_edge(START, "draft")
    builder.add_edge("draft", END)
    return builder.compile()
