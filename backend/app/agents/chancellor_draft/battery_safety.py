"""Deterministic battery physical-safety classification and preservation gates."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from enum import StrEnum

from app.agents.chancellor_draft.models import ChancellorDraftResponse, DraftStatus
from app.agents.chancellor_draft.routing import (
    ApprovedRouteSnapshot,
    build_route_snapshot,
)

BATTERY_SAFETY_LIGHT = "BLACK"
BATTERY_SAFETY_RULE_VERSION = "battery-safety.corrective.v1"
BATTERY_SAFETY_DEPARTMENT = "工部"
BATTERY_SAFETY_BUREAU = "技术司"
BATTERY_SAFETY_SOURCE_LABEL = "sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE"

P0_IMMEDIATE_ACTION = (
    "立即行动：人员立即远离并通知现场应急/消防；仅在安全前提下切断电源。"
)
P1_IMMEDIATE_ACTION = (
    "立即行动：立即停止使用和充放电并隔离；由有资质人员现场检查。"
)


class BatterySafetyLevel(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    P1 = "P1"
    P0 = "P0"


@dataclass(frozen=True, slots=True)
class BatterySafetyDecision:
    level: BatterySafetyLevel
    light: str | None
    requires_human_confirmation: bool
    required_department: str | None
    required_bureau: str | None
    prohibited_actions: tuple[str, ...]
    rule_version: str = BATTERY_SAFETY_RULE_VERSION

    @property
    def applicable(self) -> bool:
        return self.level is not BatterySafetyLevel.NOT_APPLICABLE


class BatterySafetyInvariantError(ValueError):
    """Raised when trusted bytes would weaken a battery-safety decision."""


_MARKER = re.compile(
    r"^【电池物理安全门V1：(P0|P1)/BLACK；必须人工确认；工部·技术司】"
)
_BATTERY_TOKEN = r"(?<![a-z])b\s*a\s*t\s*t\s*e\s*r\s*y(?![a-z])"
_CELL_TOKEN = r"(?<![a-z])c\s*e\s*l\s*l(?![a-z])"
_PACK_TOKEN = r"(?<![a-z])p\s*a\s*c\s*k(?![a-z])"
_BMS_TOKEN = r"(?<![a-z])b\s*m\s*s(?![a-z])"
_EXPLOSION_TOKEN = (
    r"(?<![a-z])e\s*x\s*p\s*l\s*o\s*s\s*i\s*o\s*n(?:\s*s)?(?![a-z])"
)
_DOMAIN = re.compile(
    rf"(?:储\s*能|电\s*池(?:\s*包)?|电\s*芯|锂\s*电|{_PACK_TOKEN}|"
    rf"{_BMS_TOKEN}|{_BATTERY_TOKEN}|{_CELL_TOKEN})",
    re.IGNORECASE,
)
_P0_HAZARD = re.compile(
    r"(?:正在燃烧|已经失火|发烟|电解液泄漏|火苗|烧起来|在烧|起火|着火|"
    r"失火|自燃|明火|火情|火灾|火海|燃烧|烧穿|焚毁|冒烟|浓烟|烟雾|"
    r"爆炸|爆燃|热失控|漏液|泄漏|渗漏|鼓包|膨胀|破裂|穿刺|"
    r"温度[^。；\n]{0,12}(?:飙升|骤升|持续上升|超标)|"
    r"(?<![a-z])on\s*fire(?![a-z])|"
    r"(?<![a-z])burn(?:ing|t)?(?![a-z])|"
    r"(?<![a-z])smok(?:e|ing)(?![a-z])|"
    r"(?<![a-z])thermal\s*runaway(?![a-z])|"
    r"(?<![a-z])electrolyte\s*leak(?:age|ing)?(?![a-z])|"
    rf"{_EXPLOSION_TOKEN})",
    re.IGNORECASE,
)
_P1_PHYSICAL = re.compile(
    r"(?:高\s*温|超温|发热|发烫|短路|变形|跳闸|掉电|"
    r"(?<![a-z])over\s*heat(?:ing|ed)?(?![a-z])|"
    r"(?<![a-z])short\s*circuit(?![a-z])|deform(?:ed|ation)?|"
    r"(?<![a-z])power\s*loss(?![a-z]))",
    re.IGNORECASE,
)
_P1_GENERIC = re.compile(
    r"(?:事故|故障|异常|告警|报警|安全|风险|隐患|巡检|验收|incident|"
    r"fault|alarm|warning|risk|hazard)",
    re.IGNORECASE,
)
_NON_PHYSICAL_CONTEXT = re.compile(
    r"(?:软件|代码|应用|依赖|程序|固件|市场|合同|"
    r"(?<![a-z])app(?![a-z])|(?<![a-z])package(?![a-z])|"
    r"(?<![a-z])npm(?![a-z])|(?<![a-z])software(?![a-z])|"
    r"(?<![a-z])code(?![a-z])|(?<![a-z])application(?![a-z])|"
    r"(?<![a-z])bug(?![a-z])|(?<![a-z])firmware(?![a-z])|"
    r"(?<![a-z])market(?![a-z])|(?<![a-z])contract(?![a-z]))",
    re.IGNORECASE,
)
_FACT_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("储能", re.compile(r"储\s*能")),
    (
        "电池",
        re.compile(rf"电\s*池|锂\s*电|{_BATTERY_TOKEN}", re.IGNORECASE),
    ),
    ("电芯", re.compile(rf"电\s*芯|{_CELL_TOKEN}", re.IGNORECASE)),
    ("PACK", re.compile(_PACK_TOKEN, re.IGNORECASE)),
    ("BMS", re.compile(_BMS_TOKEN, re.IGNORECASE)),
    (
        "起火",
        re.compile(
            r"起火|着火|失火|火苗|燃烧|在烧|"
            r"(?<![a-z])on\s*fire(?![a-z])|"
            r"(?<![a-z])burn(?:ing|t)?(?![a-z])",
            re.IGNORECASE,
        ),
    ),
    (
        "冒烟",
        re.compile(
            r"发烟|冒烟|浓烟|烟雾|(?<![a-z])smok(?:e|ing)(?![a-z])",
            re.IGNORECASE,
        ),
    ),
    (
        "热失控",
        re.compile(
            r"热失控|(?<![a-z])thermal\s*runaway(?![a-z])",
            re.IGNORECASE,
        ),
    ),
    (
        "泄漏",
        re.compile(
            r"漏液|泄漏|渗漏|"
            r"(?<![a-z])electrolyte\s*leak(?:age|ing)?(?![a-z])",
            re.IGNORECASE,
        ),
    ),
    ("爆炸", re.compile(rf"爆炸|爆燃|{_EXPLOSION_TOKEN}", re.IGNORECASE)),
    ("异常", re.compile(r"异常|故障|告警|报警|fault|alarm|warning", re.IGNORECASE)),
)
_LEVEL_ORDER = {
    BatterySafetyLevel.NOT_APPLICABLE: 0,
    BatterySafetyLevel.P1: 1,
    BatterySafetyLevel.P0: 2,
}
_PROHIBITED_ACTIONS = (
    "remote_reset_or_reboot",
    "bypass_bms",
    "direct_repair_or_energize",
    "charge_or_discharge",
    "bypass_human_confirmation",
)
_EXPLICIT_SEPARATOR_SYMBOLS = frozenset({"\u2044", "\u2212", "\u2215"})


def _normalize(text: str) -> str:
    if not isinstance(text, str):
        raise TypeError("battery safety text must be a string")
    normalized = unicodedata.normalize("NFKC", text)
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Cf"
    )
    normalized = "".join(
        " "
        if unicodedata.category(character) == "Pd"
        or character in _EXPLICIT_SEPARATOR_SYMBOLS
        else character
        for character in normalized
    )
    normalized = re.sub(r"[·•・_/]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _not_applicable() -> BatterySafetyDecision:
    return BatterySafetyDecision(
        BatterySafetyLevel.NOT_APPLICABLE,
        None,
        False,
        None,
        None,
        (),
    )


def _decision(level: BatterySafetyLevel) -> BatterySafetyDecision:
    if level is BatterySafetyLevel.NOT_APPLICABLE:
        return _not_applicable()
    return BatterySafetyDecision(
        level,
        BATTERY_SAFETY_LIGHT,
        True,
        BATTERY_SAFETY_DEPARTMENT,
        BATTERY_SAFETY_BUREAU,
        _PROHIBITED_ACTIONS,
    )


def classify_battery_safety(text: str) -> BatterySafetyDecision:
    """Classify trusted user text without model, I/O, cache, or global state."""

    normalized = _normalize(text)
    if not normalized or _DOMAIN.search(normalized) is None:
        return _not_applicable()
    # Physical P0 facts dominate every software or business context exclusion.
    if _P0_HAZARD.search(normalized):
        return _decision(BatterySafetyLevel.P0)
    if _P1_PHYSICAL.search(normalized):
        return _decision(BatterySafetyLevel.P1)
    if _NON_PHYSICAL_CONTEXT.search(normalized):
        return _not_applicable()
    if _P1_GENERIC.search(normalized):
        return _decision(BatterySafetyLevel.P1)
    return _not_applicable()


def battery_safety_marker(level: BatterySafetyLevel) -> str:
    if level is BatterySafetyLevel.NOT_APPLICABLE:
        raise BatterySafetyInvariantError("battery safety marker is not applicable")
    return f"【电池物理安全门V1：{level.value}/BLACK；必须人工确认；工部·技术司】"


def _visible_safety_text(level: BatterySafetyLevel) -> str:
    immediate = P0_IMMEDIATE_ACTION if level is BatterySafetyLevel.P0 else P1_IMMEDIATE_ACTION
    prohibited = (
        "禁止动作：不得远程复位或重启、不得旁路 BMS、不得直接维修、送电、"
        "充电或放电。"
    )
    confirmation = "人工确认：任何现实处置均须由有资质人员现场核验并明确确认。"
    boundary = (
        f"{BATTERY_SAFETY_SOURCE_LABEL}；证据边界：仅依据用户文本和确定性规则，"
        "不代表设备、传感器、遥测或现场事实已核验。"
    )
    return f"{immediate}{prohibited}{confirmation}{boundary}风险等级：{level.value}/BLACK。"


def _fact_labels(text: str) -> tuple[str, ...]:
    normalized = _normalize(text)
    labels = tuple(
        label for label, pattern in _FACT_PATTERNS if pattern.search(normalized)
    )
    if not labels:
        raise BatterySafetyInvariantError("battery safety facts are missing")
    return labels


def _canonical_from_binding(
    level: BatterySafetyLevel,
    source_digest: str,
    facts: tuple[str, ...],
) -> str:
    return (
        f"{battery_safety_marker(level)}{_visible_safety_text(level)}"
        f"任务绑定：sha256:{source_digest}；已识别事实：{'、'.join(facts)}；"
        "请工部·技术司仅做安全分级、证据核验和人工确认前置审查。"
    )


def canonical_battery_safety_decree(
    source_text: str,
    *,
    level: str | BatterySafetyLevel | None = None,
) -> str:
    visible = classify_battery_safety(source_text)
    selected = visible.level if level is None else BatterySafetyLevel(level)
    if selected is BatterySafetyLevel.NOT_APPLICABLE or (
        _LEVEL_ORDER[selected] < _LEVEL_ORDER[visible.level]
    ):
        raise BatterySafetyInvariantError("battery safety level downgrade is forbidden")
    digest = hashlib.sha256(_normalize(source_text).encode("utf-8")).hexdigest()
    return _canonical_from_binding(selected, digest, _fact_labels(source_text))


def battery_safety_prompt_constraint(decision: BatterySafetyDecision) -> str:
    if not decision.applicable:
        return ""
    return (
        "\n\n系统已在模型调用前命中确定性电池物理安全门。"
        f"风险至少为 {decision.level.value}/BLACK，必须由工部·技术司主审；"
        "模型不得给出现实设备控制、远程复位、直接维修或绕过人工确认的动作。"
    )


def blocked_battery_response(source_text: str, version: int) -> ChancellorDraftResponse:
    decision = classify_battery_safety(source_text)
    if decision.level is not BatterySafetyLevel.P0:
        raise BatterySafetyInvariantError("only P0 is blocked before the model")
    visible = _visible_safety_text(decision.level)
    payload = {
        "status": "ISSUE_BLOCKED",
        "version": version,
        "fingerprint": hashlib.sha256(
            json.dumps(
                {"version": version, "source": _normalize(source_text), "response": visible},
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest(),
        "understanding": visible,
        "expert_example": visible,
        "recommendation_reason": "P0/BLACK 必须在任何模型或业务副作用前失败关闭。",
        "assumptions": ["现场状态尚未经独立实时证据核验"],
        "revision_prompt": "请先撤离并通知现场应急/消防，再由有资质人员核验。",
        "draft": None,
        "decree_text": None,
    }
    return ChancellorDraftResponse.model_validate(payload)


def _canonical_route_projection(department: str) -> dict[str, str]:
    if department == BATTERY_SAFETY_DEPARTMENT:
        return {
            "role": "安全主审",
            "reason": "命中确定性电池物理安全门",
            "responsibility": "仅做安全分级、证据核验与人工确认前置审查",
            "expected_output": "带来源边界的安全审查意见",
        }
    return {
        "role": "协同审查",
        "reason": "在电池物理安全门下提供专业意见",
        "responsibility": "仅提供分析，不执行现实设备动作",
        "expected_output": "带证据边界的协同意见",
    }


def enforce_battery_safety_response(
    source_text: str,
    response: ChancellorDraftResponse,
) -> ChancellorDraftResponse:
    decision = classify_battery_safety(source_text)
    if not decision.applicable:
        return response
    visible = _visible_safety_text(decision.level)
    if response.status is not DraftStatus.DRAFT_READY:
        payload = response.model_dump(mode="python")
        payload.update(
            understanding=visible,
            expert_example=visible,
            recommendation_reason=(
                "物理安全边界、人工确认和证据来源必须覆盖全部响应状态。"
            ),
            assumptions=["现场状态尚未经独立实时证据核验"],
            revision_prompt=(
                "请补充现场状态和测量证据，不要提供设备控制指令。"
            ),
            draft=None,
            decree_text=None,
        )
        return ChancellorDraftResponse.model_validate(payload)
    if response.draft is None:
        raise BatterySafetyInvariantError("ready battery draft is missing")
    payload = response.model_dump(mode="python")
    draft = payload["draft"]
    decree = canonical_battery_safety_decree(source_text, level=decision.level)
    payload.update(
        understanding=visible,
        expert_example=decree,
        recommendation_reason="物理安全边界、人工确认和证据来源必须先于执行。",
        assumptions=["现场状态尚未经独立实时证据核验"],
        revision_prompt="请补充现场状态和测量证据，不要提供设备控制指令。",
        decree_text=decree,
    )
    draft.update(
        objective="完成电池物理安全分级、证据核验与人工确认前置审查",
        scope=[visible],
        exclusions=["远程设备控制", "直接维修或送电", "绕过人工确认"],
        input_materials=["用户陈述文本"],
        material_gaps=[],
        key_questions=["现场是否存在火情、烟雾、泄漏或持续恶化"],
        execution_steps=["工部·技术司核验现场证据", "等待人工确认"],
        deliverables=["电池安全审查意见"],
        completion_criteria=["风险、证据边界、禁止动作和确认状态完整"],
        permissions_and_limits=[visible],
    )
    routes = draft["departments"]
    gongbu = next((item for item in routes if item["department"] == "工部"), None)
    if gongbu is None:
        routes.append(
            {
                "department": "工部",
                "bureaus": ["技术司"],
                **_canonical_route_projection("工部"),
            }
        )
    elif "技术司" not in gongbu["bureaus"]:
        gongbu["bureaus"] = ["技术司", *gongbu["bureaus"]]
    for route in routes:
        route.update(_canonical_route_projection(route["department"]))
    return ChancellorDraftResponse.model_validate(payload)


def expected_draft_fingerprint(response: ChancellorDraftResponse) -> str:
    normalized = response.model_dump(
        mode="json", exclude={"version", "fingerprint", "decree_text"}
    )
    route = (
        build_route_snapshot(response.draft).model_dump(mode="json")
        if response.draft is not None
        else None
    )
    canonical = json.dumps(
        {
            "version": response.version,
            **normalized,
            "decree_text": response.decree_text,
            "route_snapshot": route,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def assert_battery_safety_response(
    source_text: str,
    response: ChancellorDraftResponse,
) -> BatterySafetyDecision:
    decision = classify_battery_safety(source_text)
    if not decision.applicable:
        return decision
    if decision.level is BatterySafetyLevel.P0:
        expected = blocked_battery_response(source_text, response.version)
        if response != expected or response.fingerprint != expected.fingerprint:
            raise BatterySafetyInvariantError(
                "P0 battery response canonical projection or fingerprint mismatch"
            )
        return decision
    expected = enforce_battery_safety_response(source_text, response)
    if response != expected or response.fingerprint != expected_draft_fingerprint(response):
        raise BatterySafetyInvariantError("battery safety response projection mismatch")
    return decision


def _binding_from_decree(decree_text: str) -> tuple[str, tuple[str, ...]]:
    digest = re.search(r"任务绑定：sha256:([0-9a-f]{64})；", decree_text)
    facts = re.search(r"已识别事实：([^；]+)；", decree_text)
    if digest is None or facts is None:
        raise BatterySafetyInvariantError("battery safety task binding is missing")
    labels = tuple(item for item in facts.group(1).split("、") if item)
    if not labels:
        raise BatterySafetyInvariantError("battery safety facts are missing")
    return digest.group(1), labels


def assert_battery_safety_decree(decree_text: str) -> BatterySafetyDecision:
    """Validate canonical battery bytes before any mutable execution dependency."""

    marker = _MARKER.match(decree_text)
    visible = classify_battery_safety(_MARKER.sub("", decree_text, count=1))
    if marker is None:
        if visible.applicable:
            raise BatterySafetyInvariantError("battery safety marker is missing")
        return visible
    marker_level = BatterySafetyLevel(marker.group(1))
    if _LEVEL_ORDER[visible.level] > _LEVEL_ORDER[marker_level]:
        raise BatterySafetyInvariantError("P0 battery facts cannot be downgraded by marker")
    effective = max((marker_level, visible.level), key=_LEVEL_ORDER.__getitem__)
    digest, facts = _binding_from_decree(decree_text)
    if decree_text != _canonical_from_binding(effective, digest, facts):
        raise BatterySafetyInvariantError("battery safety decree is not canonical")
    return _decision(effective)


def assert_battery_safety_execution_route(
    decree_text: str,
    approved_route: ApprovedRouteSnapshot,
) -> BatterySafetyDecision:
    decision = assert_battery_safety_decree(decree_text)
    if not decision.applicable:
        return decision
    gongbu = next(
        (item for item in approved_route.departments if item.department == "工部"),
        None,
    )
    if gongbu is None or "技术司" not in gongbu.required_bureaus:
        raise BatterySafetyInvariantError("battery safety route is missing 工部·技术司")
    return decision


def guard_battery_safety_result(
    decree_text: str,
    result: dict[str, object] | None,
) -> dict[str, object] | None:
    """Replace every user-visible model-derived field for a battery decree."""

    marker = _MARKER.match(decree_text)
    if marker is None:
        return result
    level = BatterySafetyLevel(marker.group(1))
    safe = _visible_safety_text(level)
    guarded = dict(result or {})
    guarded.setdefault("decree_text", decree_text)
    guarded.setdefault("route_type", "single")
    guarded.setdefault("departments", ["工部"])
    guarded.setdefault("processing_path", ["上书房", "工部", "丞相（最终汇总）"])
    guarded["chancellor_rationale"] = safe
    opinions = guarded.get("ministry_opinions")
    if not isinstance(opinions, list) or not opinions:
        opinions = [
            {
                "department": "工部",
                "bureau_opinions": [{"bureau": "技术司", "opinion": safe}],
                "opinion": safe,
            }
        ]
    else:
        opinions = [
            {
                **opinion,
                "bureau_opinions": [
                    {**bureau, "opinion": safe}
                    for bureau in opinion.get("bureau_opinions", [])
                ],
                "opinion": safe,
            }
            for opinion in opinions
            if isinstance(opinion, dict)
        ]
    guarded["ministry_opinions"] = opinions
    guarded["council_verdict"] = (
        safe if guarded.get("route_type") == "multi" else None
    )
    guarded["final_verdict"] = safe
    guarded["recommendations"] = [
        f"{safe}建议一：保持隔离并记录可见状态。",
        f"{safe}建议二：由有资质人员核验。",
        f"{safe}建议三：人工确认前不执行现实动作。",
    ]
    return guarded
