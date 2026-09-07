"""Build a deterministic read-only projection of existing Chaotang capabilities."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

from app.agents.chancellor_runtime.skills import RUNTIME_SKILLS
from app.agents.runtime_skills.registry import (
    ALL_DOWNSTREAM_SKILLS,
    runtime_skill_definition_digest,
)

from .contracts import (
    AgentPersonaCard,
    CapabilityCard,
    CapabilityPromotionCase,
    CapabilityRegistryItem,
    CapabilityRegistryProjection,
    CapabilityRegistrySummary,
    ExternalCapabilityReview,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SMALL_SAMPLE_AUTHORITY_THRESHOLD = 5

READONLY_SOURCES = [
    "backend/app/agents/runtime_skills/registry.py",
    "backend/app/agents/chancellor_runtime/skills.py",
    "backend/config/jinyiwei_mcp.yaml",
    "backend/harness/capability_candidates/authority-manifest.json",
]

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


def _summary(items: list[CapabilityRegistryItem]) -> CapabilityRegistrySummary:
    by_type = Counter(item.card.type for item in items)
    by_home = Counter(item.card.recommended_home for item in items)
    by_status = Counter(item.card.status for item in items)
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
    )


def build_capability_registry_projection() -> CapabilityRegistryProjection:
    items = (
        _agent_items()
        + _runtime_skill_items()
        + _chancellor_skill_items()
        + _harness_capability_items()
        + _mcp_capability_items()
    )
    unique: dict[str, CapabilityRegistryItem] = {}
    for item in items:
        unique.setdefault(item.card.id, item)
    ordered = [unique[key] for key in sorted(unique)]
    return CapabilityRegistryProjection(
        readonly_sources=READONLY_SOURCES,
        items=ordered,
        agent_personas=AGENT_PERSONAS,
        summary=_summary(ordered),
    )


def get_capability_registry_item(capability_id: str) -> CapabilityRegistryItem | None:
    for item in build_capability_registry_projection().items:
        if item.card.id == capability_id:
            return item
    return None
