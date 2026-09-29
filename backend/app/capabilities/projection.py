"""Build a deterministic read-only projection of existing Chaotang capabilities."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.agents.chancellor_runtime.skills import RUNTIME_SKILLS
from app.agents.runtime_skills.registry import (
    ALL_DOWNSTREAM_SKILLS,
    runtime_skill_definition_digest,
)

from .contracts import (
    AgentPersonaCard,
    CapabilityCard,
    CapabilityCatalogMetadata,
    CapabilityPromotionCase,
    CapabilityReadiness,
    CapabilityRegistryItem,
    CapabilityRegistryProjection,
    CapabilityRegistrySummary,
    ExternalCapabilityReview,
    InvocationPolicy,
    McpToolDetail,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SMALL_SAMPLE_AUTHORITY_THRESHOLD = 5

READONLY_SOURCES = [
    "backend/app/agents/runtime_skills/registry.py",
    "backend/app/agents/chancellor_runtime/skills.py",
    "backend/config/jinyiwei_mcp.yaml",
    "backend/harness/capability_candidates/authority-manifest.json",
    "backend/config/personal_capabilities.snapshot.json",
]

PERSONAL_SNAPSHOT_PATH = "backend/config/personal_capabilities.snapshot.json"
PERSONAL_SNAPSHOT_SHA256 = (
    "aa516d2a9d54ea53a046eda8767085872a2e946038b3714bd16ff8758468a818"
)
MAX_PERSONAL_SNAPSHOT_BYTES = 256 * 1024
MAX_PERSONAL_SKILLS = 256
MAX_PROVIDER_GROUPS = 64
MAX_MCP_TOOLS = 512

_PROVIDER_TOOL_GROUPS = {
    "Codex Document Control": "Document Control",
}
_PRIVATE_PATH_RE = re.compile(
    r"(?i)(?:[a-z]:[\\/]|\\\\[^\\/\s]+[\\/]|/(?:home|users|mnt|tmp|var|etc)/)"
)
_CREDENTIAL_RE = re.compile(
    r"(?i)(?:"
    r"(?:sk|ghp|glpat|xox[baprs])[_-][a-z0-9_-]{12,}|"
    r"bearer\s+[a-z0-9._~+/-]{12,}|"
    r"(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*\S+"
    r")"
)
_ACCOUNT_IDENTIFIER_RE = re.compile(
    r"(?i)(?:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-z0-9-]+(?:\.[a-z0-9-]+)+)"
)


class CapabilitySnapshotError(RuntimeError):
    """Fail-closed snapshot error that never carries raw input or local paths."""


class _SnapshotModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _SnapshotSecurity(_SnapshotModel):
    contains_absolute_private_paths: Literal[False]
    contains_account_identifiers: Literal[False]
    contains_credentials: Literal[False]
    contains_skill_source: Literal[False]
    grants_runtime_permission: Literal[False]


class _SnapshotCounts(_SnapshotModel):
    eligible_mcp_tools: int = Field(ge=0, le=MAX_MCP_TOOLS)
    hanlin_skills: int = Field(ge=0, le=MAX_PERSONAL_SKILLS)
    honglusi_provider_groups: int = Field(ge=0, le=MAX_PROVIDER_GROUPS)
    mcp_tools: int = Field(ge=0, le=MAX_MCP_TOOLS)


class _SnapshotSkill(_SnapshotModel):
    category: str = Field(min_length=1, max_length=128)
    connection_status: str = Field(min_length=1, max_length=128)
    eligible_for_product_projection: bool
    explicit_trigger: str | None = Field(default=None, max_length=256)
    external_data: str = Field(min_length=1, max_length=512)
    fee_status: str = Field(min_length=1, max_length=512)
    id: str = Field(min_length=3, max_length=256)
    installation_status: str = Field(min_length=1, max_length=128)
    invocation_policy: InvocationPolicy
    kind: Literal["skill"]
    name: str = Field(min_length=1, max_length=256)
    natural_language_trigger: str = Field(min_length=1, max_length=512)
    purpose: str = Field(min_length=1, max_length=1024)
    registry_home: Literal["hanlin"]
    runtime_binding_status: Literal["not_bound"]
    source_names: list[str] = Field(min_length=1, max_length=16)
    verification_status: str = Field(min_length=1, max_length=128)
    visibility_status: str = Field(min_length=1, max_length=128)


class _SnapshotProvider(_SnapshotModel):
    connection_status: str = Field(min_length=1, max_length=128)
    dependency_and_account: str = Field(min_length=1, max_length=512)
    eligible_for_product_projection: bool
    evidence_and_recommendation: str = Field(min_length=1, max_length=1024)
    explicit_trigger: str | None = Field(default=None, max_length=256)
    external_data: str = Field(min_length=1, max_length=512)
    fee_status: str = Field(min_length=1, max_length=512)
    id: str = Field(min_length=3, max_length=256)
    installation_status: str = Field(min_length=1, max_length=128)
    invocation_policy: InvocationPolicy
    kind: Literal["external_provider"]
    name: str = Field(min_length=1, max_length=256)
    natural_language_trigger: str = Field(min_length=1, max_length=512)
    permission_summary: str = Field(min_length=1, max_length=1024)
    purpose: str = Field(min_length=1, max_length=1024)
    registry_home: Literal["honglusi"]
    runtime_binding_status: Literal["not_bound"]
    verification_status: str = Field(min_length=1, max_length=128)
    visibility_status: str = Field(min_length=1, max_length=128)


class _SnapshotMcpTool(_SnapshotModel):
    connection_status: str = Field(min_length=1, max_length=128)
    eligible_for_product_projection: bool
    id: str = Field(min_length=3, max_length=256)
    invocation_policy: InvocationPolicy
    kind: Literal["mcp_tool"]
    name: str = Field(min_length=1, max_length=256)
    provider_group: str = Field(min_length=1, max_length=128)
    registry_home: Literal["honglusi"]
    runtime_binding_status: Literal["not_bound"]
    verification_status: str = Field(min_length=1, max_length=128)
    visibility_status: str = Field(min_length=1, max_length=128)


class _PersonalCapabilitySnapshot(_SnapshotModel):
    schema_version: Literal["chaotang-personal-capability-snapshot.v1"]
    generated_on: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    authority: Literal["metadata-only-non-authorizing"]
    security: _SnapshotSecurity
    counts: _SnapshotCounts
    hanlin_skills: list[_SnapshotSkill] = Field(max_length=MAX_PERSONAL_SKILLS)
    honglusi_provider_groups: list[_SnapshotProvider] = Field(
        max_length=MAX_PROVIDER_GROUPS
    )
    mcp_tools: list[_SnapshotMcpTool] = Field(max_length=MAX_MCP_TOOLS)

    @model_validator(mode="after")
    def validate_counts_and_ids(self) -> _PersonalCapabilitySnapshot:
        if self.counts.hanlin_skills != len(self.hanlin_skills):
            raise ValueError("hanlin count mismatch")
        if self.counts.honglusi_provider_groups != len(
            self.honglusi_provider_groups
        ):
            raise ValueError("provider count mismatch")
        if self.counts.mcp_tools != len(self.mcp_tools):
            raise ValueError("mcp tool count mismatch")
        eligible_tools = sum(
            tool.eligible_for_product_projection for tool in self.mcp_tools
        )
        if self.counts.eligible_mcp_tools != eligible_tools:
            raise ValueError("eligible mcp tool count mismatch")
        ids = [
            item.id
            for group in (
                self.hanlin_skills,
                self.honglusi_provider_groups,
                self.mcp_tools,
            )
            for item in group
        ]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate capability id")
        provider_groups = {
            _PROVIDER_TOOL_GROUPS.get(provider.name, provider.name)
            for provider in self.honglusi_provider_groups
            if provider.eligible_for_product_projection
        }
        if any(
            tool.eligible_for_product_projection
            and tool.provider_group not in provider_groups
            for tool in self.mcp_tools
        ):
            raise ValueError("eligible tool has no eligible provider")
        return self


def _walk_snapshot_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_snapshot_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_snapshot_strings(item)


def load_personal_capability_snapshot(
    path: Path | None = None,
    *,
    expected_digest: str | None = PERSONAL_SNAPSHOT_SHA256,
) -> _PersonalCapabilitySnapshot:
    """Load the approved metadata snapshot with strict privacy checks."""

    snapshot_path = path or (REPOSITORY_ROOT / PERSONAL_SNAPSHOT_PATH)
    try:
        if snapshot_path.stat().st_size > MAX_PERSONAL_SNAPSHOT_BYTES:
            raise CapabilitySnapshotError("snapshot_too_large")
        raw = snapshot_path.read_bytes()
        if expected_digest is not None:
            digest = hashlib.sha256(raw).hexdigest()
            if digest != expected_digest:
                raise CapabilitySnapshotError("snapshot_digest_mismatch")
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise CapabilitySnapshotError("snapshot_invalid")
        for candidate in _walk_snapshot_strings(value):
            if (
                len(candidate) > 2048
                or _PRIVATE_PATH_RE.search(candidate)
                or _CREDENTIAL_RE.search(candidate)
                or _ACCOUNT_IDENTIFIER_RE.search(candidate)
            ):
                raise CapabilitySnapshotError("snapshot_privacy_rejected")
        return _PersonalCapabilitySnapshot.model_validate(value)
    except CapabilitySnapshotError:
        raise
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
        raise CapabilitySnapshotError("snapshot_invalid") from exc


def _snapshot_readiness(record: Any) -> CapabilityReadiness:
    return CapabilityReadiness(
        visibility_status=record.visibility_status,
        installation_status=record.installation_status,
        connection_status=record.connection_status,
        verification_status=record.verification_status,
        runtime_binding_status=record.runtime_binding_status,
    )


def _snapshot_blocker(record: Any) -> str:
    if record.invocation_policy == "DISABLED":
        return "当前策略已停用；需要重新评估依赖、权限和适用范围。"
    if record.connection_status == "blocked":
        return "连接状态受阻；先修复连接并完成验证，仍不会自动获得运行权限。"
    if "not_individually_verified" in record.verification_status:
        return "尚未逐项验证；使用前需在真实任务中验证依赖和结果。"
    return "尚未绑定朝堂 Runtime；当前仅可用于选型和编写协作草案。"


def _display_trigger(value: str) -> str:
    cleaned = re.sub(r'[”"]?\s*/\s*\x60?\s*$', "", value).strip()
    return cleaned.rstrip('”"').strip() or value


def _catalog_cost_level(fee_status: str) -> str:
    lowered = fee_status.lower()
    if "charge" in lowered or "付费" in fee_status or "方案" in fee_status:
        return "medium"
    return "low"


def _catalog_risk_level(invocation_policy: str, external_data: str) -> str:
    if invocation_policy == "PREPARE_THEN_CONFIRM":
        return "high"
    if "send" in external_data.lower() or "是" in external_data:
        return "medium"
    return "low"

DEPARTMENT_HOME_BY_TEXT = {
    "军机处": "junjichu",
    "锦衣卫": "jinyiwei",
    "钦天监": "qintianjian",
    "翰林院": "hanlin",
    "鸿胪寺": "honglusi",
    "史馆": "shiguan",
    "工部": "gongbu",
    "户部": "hubu",
    "刑部": "xingbu",
    "吏部": "libu_hr",
    "礼部": "libu_rites",
    "兵部": "bingbu",
}

AGENT_PERSONAS = [
    AgentPersonaCard(
        agent_id="chancellor",
        display_name="丞相",
        role="总控路由、取舍与下一步裁决",
        voice="清楚、克制、像懂业务的 CEO 幕僚",
        humor_level=1,
        decision_style="先问发生什么，再问用户要决定什么，最后给唯一下一步",
        forbidden_behavior=["替用户执行现实交易", "绕过授权调用部门", "把人格当作权限主体"],
        default_opening="臣先给您收束成一个可执行决策。",
        evolution_goal="让每次任务沉淀为可复用的印版和更低成本的路径。",
        cost_efficiency_goal="优先复用已验证能力，少开蜂群，少耗算筹。",
    ),
    AgentPersonaCard(
        agent_id="jinyiwei",
        display_name="锦衣卫",
        role="信息发现、事实核验、证据管理与预警",
        voice="冷静、可追溯、不夸张",
        humor_level=0,
        decision_style="线索先登记，结论必须有证据；冲突和未知显式标记",
        forbidden_behavior=["单来源直接定性", "把搜索摘要声明为事实", "无限制抓取任意网址"],
        default_opening="臣先查证据，不先下判断。",
        evolution_goal="把可靠来源、冲突标记和预警条件沉淀为情报能力。",
        cost_efficiency_goal="优先使用批准来源和缓存证据，避免重复调查。",
    ),
    AgentPersonaCard(
        agent_id="hanlin",
        display_name="翰林院",
        role="Skill、Prompt、模板、知识包与印版的整理复用",
        voice="亲和、会教学、把复杂方法讲成人话",
        humor_level=2,
        decision_style="先让好方法可复用，再让复用结果可评测",
        forbidden_behavior=["未经验证即推荐公共能力", "把下载量当质量", "隐藏适用边界"],
        default_opening="这件事可以先做成一块好用的活字。",
        evolution_goal="让用户和朝堂共同沉淀高质量公共活字。",
        cost_efficiency_goal="用过、有效、可复用的能力优先入库。",
    ),
    AgentPersonaCard(
        agent_id="libu_hr",
        display_name="吏部",
        role="能力考绩、晋升、合并、裁撤与组织性价比",
        voice="严格、公平、少废话",
        humor_level=0,
        decision_style="看真实任务改善度、复用率、风险和成本，不看热闹",
        forbidden_behavior=["按声量晋升能力", "让低效能力常驻", "掩盖成本"],
        default_opening="臣先看它值不值得常驻。",
        evolution_goal="让朝堂组织越来越准、快、便宜。",
        cost_efficiency_goal="淘汰重复低效能力，推动同类能力合并。",
    ),
    AgentPersonaCard(
        agent_id="honglusi",
        display_name="鸿胪寺",
        role="外部 API、MCP、插件、模型与账号能力国门",
        voice="开放但谨慎，先验明身份再通商",
        humor_level=1,
        decision_style="外部能力默认候选，过许可、安全、权限和审计后试用",
        forbidden_behavior=["自动安装外部插件", "外发用户数据", "永久授权第三方"],
        default_opening="外臣可请入殿，但先过关牒。",
        evolution_goal="把外部先进能力安全接入朝堂能力市场。",
        cost_efficiency_goal="优先短授权、只读 PoC、可撤销连接。",
    ),
    AgentPersonaCard(
        agent_id="xingbu",
        display_name="刑部",
        role="安全、合规、权限、攻击面与争议审查",
        voice="严肃、保守、证据优先",
        humor_level=0,
        decision_style="先默认不信任，再最小授权验证",
        forbidden_behavior=["为体验牺牲权限边界", "忽略提示词注入", "泄露凭据"],
        default_opening="臣先看边界和风险。",
        evolution_goal="让能力越多，系统越安全、越可控。",
        cost_efficiency_goal="用制度和自动测试降低安全返工。",
    ),
    AgentPersonaCard(
        agent_id="gongbu",
        display_name="工部",
        role="工程实现、产品事实、技术适配与交付验证",
        voice="务实、结构化、能落地",
        humor_level=1,
        decision_style="先做最小可验证纵切，再扩大范围",
        forbidden_behavior=["无测试上线", "重写现有主链", "脱离证据写参数"],
        default_opening="臣先把它做成能跑、能验、能回退。",
        evolution_goal="把创意压成稳定可复用的工程能力。",
        cost_efficiency_goal="少造新轮子，复用现有主链和测试门禁。",
    ),
    AgentPersonaCard(
        agent_id="hubu",
        display_name="户部",
        role="成本、收益、报价、预算与商业风险",
        voice="数字清楚，谨慎但不扫兴",
        humor_level=1,
        decision_style="先看钱从哪里来、风险在哪里、底线是什么",
        forbidden_behavior=["编造价格", "替用户承诺报价", "跳过预算门"],
        default_opening="臣先把账算明白。",
        evolution_goal="让每个方案都有成本、收益和复盘数据。",
        cost_efficiency_goal="减少无效调用，把算筹花在影响结果的地方。",
    ),
    AgentPersonaCard(
        agent_id="qintianjian",
        display_name="钦天监",
        role="趋势推演、预警和天时地利人和分析",
        voice="有远见，但明确概率和不确定性",
        humor_level=1,
        decision_style="先区分事实、推断、场景和触发条件",
        forbidden_behavior=["把预测说成事实", "忽略反向情景", "代替丞相下最终命令"],
        default_opening="臣夜观天象，但先看证据与触发条件。",
        evolution_goal="把预测变成可复核、可迭代的战略判断。",
        cost_efficiency_goal="只对高影响事项做深度推演。",
    ),
    AgentPersonaCard(
        agent_id="shiguan",
        display_name="史馆",
        role="归档、复盘、结果回流和组织记忆",
        voice="安静、准确、记得住",
        humor_level=1,
        decision_style="事实归档，经验沉淀，错误也要留下可复盘记录",
        forbidden_behavior=["篡改历史", "丢失证据链", "把未验证结论写成定论"],
        default_opening="臣先把来龙去脉立档。",
        evolution_goal="让朝堂越用越懂用户，越复盘越强。",
        cost_efficiency_goal="复用历史相似案，减少从零开始。",
    ),
]


def _home_for_agent(agent_id: str) -> str:
    lower = agent_id.lower()
    for fragment, home in (
        ("junjichu", "junjichu"),
        ("jinyiwei", "jinyiwei"),
        ("qintianjian", "qintianjian"),
        ("hanlin", "hanlin"),
        ("honglusi", "honglusi"),
        ("shiguan", "shiguan"),
        ("gongbu", "gongbu"),
        ("hubu", "hubu"),
        ("xingbu", "xingbu"),
        ("bingbu", "bingbu"),
    ):
        if fragment in lower:
            return home
    if "libu" in lower:
        return "libu_hr"
    return "hanlin"


def _level_for_runtime_skill(skill: Any) -> str:
    services = {service.value for service in getattr(skill, "allowed_services", frozenset())}
    if any("external" in service.lower() or "mcp" in service.lower() for service in services):
        return "high"
    if len(services) >= 4:
        return "medium"
    return "low"


def _promotion_for(card: CapabilityCard) -> CapabilityPromotionCase:
    if card.source == "honglusi":
        action = "入鸿胪寺外部能力候选，刑部复核后限时试用"
        rationale = "外部能力默认 fail-closed，不因登记获得运行权限。"
        required = ["许可与来源证明", "权限最小化说明", "安全审查记录", "真实任务改善回执"]
    elif card.type in {"template", "imprint", "workflow"}:
        action = "入翰林院公共活字试用"
        rationale = "可复用方法应先进入翰林院，凭真实复用效果晋升。"
        required = ["至少一次真实复用", "用户纠错记录", "结果改善证明"]
    elif card.status == "retired":
        action = "驳回归档或等待重新评审"
        rationale = "未启用能力保持零权限，不进入常驻部门。"
        required = ["重新启用授权", "新验证证据"]
    else:
        action = "保持当前归属，纳入吏部能力考绩"
        rationale = "已在现有主链登记，V1 只做只读总账投影。"
        required = ["任务完成率", "复用率", "失败原因", "成本记录"]
    return CapabilityPromotionCase(
        capability_id=card.id,
        current_home=card.recommended_home,
        recommended_action=action,
        rationale=rationale,
        required_evidence=required,
        reviewer_department="吏部",
    )


def _runtime_skill_items() -> list[CapabilityRegistryItem]:
    items: list[CapabilityRegistryItem] = []
    for skill in ALL_DOWNSTREAM_SKILLS:
        card = CapabilityCard(
            id=f"runtime-skill.{skill.skill_id}",
            name=str(skill.skill_id).replace("-", " ").title(),
            type="skill",
            source="internal",
            best_use_case=skill.purpose,
            input_needed=list(skill.data_requirements),
            output_produced=list(skill.required_findings),
            risk_level=_level_for_runtime_skill(skill),
            cost_level="medium" if len(skill.analysis_procedure) >= 4 else "low",
            reuse_potential="high",
            recommended_home=_home_for_agent(skill.agent_id),
            status="approved",
            evidence_sources=[
                "backend/app/agents/runtime_skills/registry.py",
                runtime_skill_definition_digest(skill),
            ],
            active=True,
            sample_count=0,
            authority_score=None,
        )
        items.append(
            CapabilityRegistryItem(card=card, promotion_case=_promotion_for(card))
        )
    return items


def _chancellor_skill_items() -> list[CapabilityRegistryItem]:
    items: list[CapabilityRegistryItem] = []
    for skill in RUNTIME_SKILLS:
        active = bool(skill.enabled)
        card = CapabilityCard(
            id=f"chancellor-skill.{skill.skill_id}",
            name=str(skill.skill_id).replace("_", " ").replace("-", " ").title(),
            type="skill",
            source="internal",
            best_use_case=skill.description,
            input_needed=["用户问题", "当前授权状态", "现有朝堂上下文"],
            output_produced=["丞相裁决", "下一步建议", "授权边界说明"],
            risk_level="medium" if active else "low",
            cost_level="low",
            reuse_potential="high",
            recommended_home="junjichu",
            status="approved" if active else "retired",
            evidence_sources=["backend/app/agents/chancellor_runtime/skills.py"],
            active=active,
            sample_count=0,
            authority_score=None,
        )
        items.append(
            CapabilityRegistryItem(
                card=card,
                persona=AGENT_PERSONAS[0],
                promotion_case=_promotion_for(card),
            )
        )
    return items


def _load_json(path: str) -> dict[str, Any]:
    file_path = REPOSITORY_ROOT / path
    if not file_path.exists():
        return {}
    return json.loads(file_path.read_text(encoding="utf-8"))


def _load_yaml(path: str) -> dict[str, Any]:
    file_path = REPOSITORY_ROOT / path
    if not file_path.exists():
        return {}
    value = yaml.safe_load(file_path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def _harness_capability_items() -> list[CapabilityRegistryItem]:
    manifest = _load_json("backend/harness/capability_candidates/authority-manifest.json")
    projections = manifest.get("projections", {})
    if not isinstance(projections, dict):
        return []
    items: list[CapabilityRegistryItem] = []
    for key in sorted(projections):
        record = projections[key]
        if not isinstance(record, dict):
            continue
        grants = record.get("grants", {})
        may_write_external = (
            bool(grants.get("may_write_external"))
            if isinstance(grants, dict)
            else False
        )
        card = CapabilityCard(
            id=f"workflow.{key}",
            name=key.replace("-", " ").title(),
            type="workflow",
            source="internal",
            best_use_case="作为已登记的治理/质量门能力候选，在真实任务中约束结果质量。",
            input_needed=["任务上下文", "质量标准", "用户授权边界"],
            output_produced=["能力门裁决", "风险提示", "可追溯 digest"],
            risk_level="high" if may_write_external else "medium",
            cost_level="low",
            reuse_potential="high",
            recommended_home="hanlin",
            status="trial",
            evidence_sources=[
                "backend/harness/capability_candidates/authority-manifest.json",
                str(record.get("digest", "")),
            ],
            active=True,
            sample_count=0,
            authority_score=None,
        )
        items.append(
            CapabilityRegistryItem(card=card, promotion_case=_promotion_for(card))
        )
    return items


def _mcp_capability_items() -> list[CapabilityRegistryItem]:
    config = _load_yaml("backend/config/jinyiwei_mcp.yaml")
    servers = config.get("servers", [])
    tools = config.get("tools", [])
    items: list[CapabilityRegistryItem] = []
    if isinstance(servers, list):
        for server in servers:
            if not isinstance(server, dict):
                continue
            server_id = str(server.get("server_id", "")).strip()
            if not server_id:
                continue
            active = bool(server.get("enabled"))
            card = CapabilityCard(
                id=f"mcp.{server_id}",
                name=str(server.get("display_name") or server_id),
                type="mcp",
                source="honglusi",
                best_use_case="经鸿胪寺登记的外部只读数据服务入口。",
                input_needed=["已批准连接", "最小权限凭据", "调用目的"],
                output_produced=["外部数据候选", "来源和审批版本", "调用审计线索"],
                risk_level="high",
                cost_level="medium",
                reuse_potential="medium",
                recommended_home="honglusi",
                status="trial" if active else "draft",
                evidence_sources=[
                    "backend/config/jinyiwei_mcp.yaml",
                    str(server.get("approval_version", "")),
                ],
                active=active,
                sample_count=0,
                authority_score=None,
            )
            review = ExternalCapabilityReview(
                provider="mcp",
                permission_needed=[
                    "鸿胪寺连接登记",
                    "刑部安全审查",
                    "最小化服务凭据",
                ],
                data_exposure=[str(server.get("source_kind", "external service"))],
                allowed_actions=["READ_ONLY approved tools after runtime authorization"],
                forbidden_actions=[
                    "external write",
                    "credential export",
                    "unapproved endpoint access",
                    "cross-tenant data reuse",
                ],
                requires_xingbu_review=True,
                default_grant_duration="single approved investigation or 24h trial",
                audit_required=True,
            )
            items.append(
                CapabilityRegistryItem(
                    card=card,
                    external_review=review,
                    promotion_case=_promotion_for(card),
                )
            )
    if isinstance(tools, list):
        for tool in tools:
            if not isinstance(tool, dict):
                continue
            server_id = str(tool.get("server_id", "")).strip()
            tool_name = str(tool.get("tool_name", "")).strip()
            if not server_id or not tool_name:
                continue
            active = bool(tool.get("enabled"))
            effect = str(tool.get("effect", "UNKNOWN"))
            card = CapabilityCard(
                id=f"api.{server_id}.{tool_name}",
                name=f"{server_id}.{tool_name}",
                type="api",
                source="honglusi",
                best_use_case=str(
                    tool.get("approved_discovered_tool", {}).get(
                        "description", "外部受控 API 工具"
                    )
                ),
                input_needed=list(
                    tool.get("approved_discovered_tool", {})
                    .get("inputSchema", {})
                    .get("required", [])
                ),
                output_produced=list(tool.get("fact_categories", [])) or [
                    "external evidence candidate"
                ],
                risk_level="high",
                cost_level="medium",
                reuse_potential="medium",
                recommended_home="honglusi",
                status="trial" if active else "draft",
                evidence_sources=[
                    "backend/config/jinyiwei_mcp.yaml",
                    str(tool.get("approved_fingerprint", "")),
                ],
                active=active,
                sample_count=0,
                authority_score=None,
            )
            review = ExternalCapabilityReview(
                provider="mcp",
                permission_needed=[
                    "approved server",
                    "approved tool fingerprint",
                    "runtime task authority",
                ],
                data_exposure=list(tool.get("data_scopes", [])) or ["EXTERNAL_PUBLIC"],
                allowed_actions=[effect if effect == "READ_ONLY" else "NO_DEFAULT_ACTION"],
                forbidden_actions=[
                    "external write",
                    "trading",
                    "publishing",
                    "pricing commitment",
                    "use outside approved fact category",
                ],
                requires_xingbu_review=True,
                default_grant_duration="single request or configured TTL",
                audit_required=True,
            )
            items.append(
                CapabilityRegistryItem(
                    card=card,
                    external_review=review,
                    promotion_case=_promotion_for(card),
                )
            )
    return items


def _personal_catalog_items(
    snapshot: _PersonalCapabilitySnapshot,
) -> list[CapabilityRegistryItem]:
    items: list[CapabilityRegistryItem] = []
    snapshot_evidence = [PERSONAL_SNAPSHOT_PATH, f"sha256:{PERSONAL_SNAPSHOT_SHA256}"]

    for skill in sorted(snapshot.hanlin_skills, key=lambda item: item.id):
        if not skill.eligible_for_product_projection:
            continue
        card = CapabilityCard(
            id=skill.id,
            name=skill.name,
            type="skill",
            source="personal_catalog",
            best_use_case=skill.purpose,
            input_needed=["用户用自然语言描述想完成的结果"],
            output_produced=["匹配的方法、提示词或工作流建议"],
            risk_level=_catalog_risk_level(
                skill.invocation_policy, skill.external_data
            ),
            cost_level=_catalog_cost_level(skill.fee_status),
            reuse_potential="high",
            recommended_home="hanlin",
            status="draft" if skill.invocation_policy == "DISABLED" else "trial",
            evidence_sources=snapshot_evidence,
            active=False,
            sample_count=0,
            authority_score=None,
        )
        catalog = CapabilityCatalogMetadata(
            category=skill.category,
            natural_language_trigger=_display_trigger(skill.natural_language_trigger),
            explicit_trigger=skill.explicit_trigger,
            invocation_policy=skill.invocation_policy,
            fee_status=skill.fee_status,
            permission_summary=(
                "仅登记 Skill 元数据；实际使用继续服从 Codex 当前任务权限和用户确认。"
            ),
            external_data=skill.external_data,
            readiness=_snapshot_readiness(skill),
            blocker=_snapshot_blocker(skill),
        )
        items.append(
            CapabilityRegistryItem(
                card=card,
                promotion_case=_promotion_for(card),
                catalog=catalog,
            )
        )

    tools_by_group: dict[str, list[_SnapshotMcpTool]] = defaultdict(list)
    for tool in snapshot.mcp_tools:
        if tool.eligible_for_product_projection:
            tools_by_group[tool.provider_group].append(tool)

    for provider in sorted(
        snapshot.honglusi_provider_groups, key=lambda item: item.id
    ):
        if not provider.eligible_for_product_projection:
            continue
        tool_group = _PROVIDER_TOOL_GROUPS.get(provider.name, provider.name)
        tool_records = sorted(
            tools_by_group.get(tool_group, []), key=lambda item: item.id
        )
        tool_details = [
            McpToolDetail(
                id=tool.id,
                name=tool.name,
                provider_group=tool.provider_group,
                invocation_policy=tool.invocation_policy,
                connection_status=tool.connection_status,
                verification_status=tool.verification_status,
                runtime_binding_status=tool.runtime_binding_status,
            )
            for tool in tool_records
        ]
        card = CapabilityCard(
            id=provider.id,
            name=provider.name,
            type="provider",
            source="honglusi",
            best_use_case=provider.purpose,
            input_needed=["明确任务目的", "最小必要数据", "用户确认（如涉及外部动作）"],
            output_produced=["外部能力候选结果", "权限与费用提示", "可审计元数据"],
            risk_level=_catalog_risk_level(
                provider.invocation_policy, provider.external_data
            ),
            cost_level=_catalog_cost_level(provider.fee_status),
            reuse_potential="medium",
            recommended_home="honglusi",
            status=(
                "draft"
                if provider.invocation_policy == "DISABLED"
                else "trial"
            ),
            evidence_sources=snapshot_evidence,
            active=False,
            sample_count=0,
            authority_score=None,
        )
        review = ExternalCapabilityReview(
            provider=provider.name,
            permission_needed=[
                provider.dependency_and_account,
                provider.permission_summary,
            ],
            data_exposure=[provider.external_data],
            allowed_actions=["METADATA_ONLY"],
            forbidden_actions=[
                "direct external execution",
                "external write",
                "automatic connection or authorization",
                "publishing, sending, deleting, paying, or trading",
                "credential or private-file export",
            ],
            requires_xingbu_review=True,
            default_grant_duration="no runtime grant",
            audit_required=True,
        )
        catalog = CapabilityCatalogMetadata(
            natural_language_trigger=_display_trigger(
                provider.natural_language_trigger
            ),
            explicit_trigger=provider.explicit_trigger,
            invocation_policy=provider.invocation_policy,
            fee_status=provider.fee_status,
            permission_summary=provider.permission_summary,
            external_data=provider.external_data,
            readiness=_snapshot_readiness(provider),
            blocker=_snapshot_blocker(provider),
            provider_group=provider.name,
            tool_count=len(tool_details),
            tools=tool_details,
        )
        items.append(
            CapabilityRegistryItem(
                card=card,
                external_review=review,
                promotion_case=_promotion_for(card),
                catalog=catalog,
            )
        )
    return items


def _agent_items() -> list[CapabilityRegistryItem]:
    items: list[CapabilityRegistryItem] = []
    for persona in AGENT_PERSONAS:
        card = CapabilityCard(
            id=f"agent.{persona.agent_id}",
            name=persona.display_name,
            type="agent",
            source="internal",
            best_use_case=persona.role,
            input_needed=["用户任务", "授权边界", "证据上下文"],
            output_produced=["解释", "建议", "下一步"],
            risk_level=(
                "medium"
                if persona.agent_id in {"chancellor", "honglusi", "xingbu"}
                else "low"
            ),
            cost_level="low",
            reuse_potential="high",
            recommended_home=_home_for_agent(persona.agent_id),
            status="approved",
            evidence_sources=["backend/app/capabilities/projection.py"],
            active=True,
            sample_count=0,
            authority_score=None,
        )
        items.append(
            CapabilityRegistryItem(
                card=card,
                persona=persona,
                promotion_case=_promotion_for(card),
            )
        )
    return items


def _summary(
    items: list[CapabilityRegistryItem],
    snapshot: _PersonalCapabilitySnapshot | None = None,
) -> CapabilityRegistrySummary:
    by_type = Counter(item.card.type for item in items)
    by_home = Counter(item.card.recommended_home for item in items)
    by_status = Counter(item.card.status for item in items)
    catalog_items = [item for item in items if item.catalog is not None]
    catalog_hanlin = sum(
        item.card.recommended_home == "hanlin" for item in catalog_items
    )
    catalog_providers = sum(
        item.card.recommended_home == "honglusi" for item in catalog_items
    )
    catalog_tools = sum(
        item.catalog.tool_count for item in catalog_items if item.catalog
    )
    return CapabilityRegistrySummary(
        total=len(items),
        by_type=dict(sorted(by_type.items())),
        by_home=dict(sorted(by_home.items())),
        by_status=dict(sorted(by_status.items())),
        external_review_required=sum(
            1 for item in items if item.external_review and item.external_review.audit_required
        ),
        small_sample_without_authority_score=sum(
            1
            for item in items
            if item.card.sample_count < SMALL_SAMPLE_AUTHORITY_THRESHOLD
            and item.card.authority_score is None
        ),
        catalog_hanlin_skills=catalog_hanlin,
        catalog_provider_groups=catalog_providers,
        catalog_mcp_tools=catalog_tools,
        catalog_snapshot_provider_groups=(
            snapshot.counts.honglusi_provider_groups if snapshot else 0
        ),
        catalog_snapshot_mcp_tools=snapshot.counts.mcp_tools if snapshot else 0,
        catalog_excluded_support_tools=(
            snapshot.counts.mcp_tools - snapshot.counts.eligible_mcp_tools
            if snapshot
            else 0
        ),
    )


def build_capability_registry_projection() -> CapabilityRegistryProjection:
    snapshot = load_personal_capability_snapshot()
    items = (
        _agent_items()
        + _runtime_skill_items()
        + _chancellor_skill_items()
        + _harness_capability_items()
        + _mcp_capability_items()
        + _personal_catalog_items(snapshot)
    )
    unique: dict[str, CapabilityRegistryItem] = {}
    for item in items:
        unique.setdefault(item.card.id, item)
    ordered = [unique[key] for key in sorted(unique)]
    return CapabilityRegistryProjection(
        readonly_sources=READONLY_SOURCES,
        items=ordered,
        agent_personas=AGENT_PERSONAS,
        summary=_summary(ordered, snapshot),
    )


def get_capability_registry_item(capability_id: str) -> CapabilityRegistryItem | None:
    for item in build_capability_registry_projection().items:
        if item.card.id == capability_id:
            return item
    return None
