"""Deterministic ShangShuFang intake loop.

第一版不依赖 LLM。它先把 PRD 的硬规则焊进系统：
- 原问必须保留
- 拟旨必须可执行
- 高风险必须显式提示人工确认
- 证据不足不能伪装确定结论
- 所有输出必须带 source_label
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from hashlib import sha1
import re

SOURCE_LABELS = {"LIVE", "MIXED", "FALLBACK", "DEMO"}
EXPECTED_MEMORIAL_FORMAT = ["圣裁", "分奏", "证据", "风险", "后令", "质门", "来源"]

DEPARTMENT_RULES: dict[str, dict[str, object]] = {
    "户部": {
        "keywords": ["投入", "roi", "现金流", "报价", "成本", "回款", "预算", "收益", "财务", "资金", "付款", "价格"],
        "focus": "投入、ROI、现金流、报价、成本、回款和预算",
    },
    "刑部": {
        "keywords": ["合同", "股权", "合规", "法律", "责任", "承诺", "签字", "独家", "分红", "对赌", "退出"],
        "focus": "合同、股权、合规、法律责任和对外承诺",
    },
    "礼部": {
        "keywords": ["客户", "招商", "话术", "品牌", "公关", "材料", "表达", "发布", "触达"],
        "focus": "客户表达、招商话术、品牌、公关和对外材料",
    },
    "工部": {
        "keywords": ["交付", "技术", "方案", "bom", "施工", "周期", "供应链", "实施", "储能", "电池", "pack", "bms", "冷库"],
        "focus": "交付、技术方案、BOM、施工周期、供应链和实施可行性",
    },
    "兵部": {
        "keywords": ["竞争", "市场", "渠道", "谈判", "攻防", "份额", "压价", "清库存"],
        "focus": "竞争、市场攻防、渠道和谈判策略",
    },
    "吏部": {
        "keywords": ["组织", "人员", "职责", "绩效", "执行责任", "团队", "招聘", "岗位"],
        "focus": "组织、人员、职责、绩效和执行责任",
    },
    "锦衣卫": {
        "keywords": ["情报", "核实", "可信度", "信源", "谣言", "线报", "传闻", "查证"],
        "focus": "情报真实性核查、信源可信度分级",
    },
}

RISK_RULES: dict[str, list[str]] = {
    "股权风险": ["股权", "分红", "合伙", "独家", "对赌", "退出机制"],
    "合同风险": ["合同", "签约", "签字", "协议", "法律责任"],
    "付款风险": ["付款", "回款", "账期", "垫资", "现金流"],
    "对外承诺风险": ["正式报价", "承诺", "客户说", "必须给", "招商话术", "对外"],
    "交付风险": ["交付", "工期", "施工周期", "供应链", "BOM", "设备报价"],
}

GAP_RULES: dict[str, list[str]] = {
    "储能": ["客户负荷曲线", "电价政策", "设备报价", "BOM", "施工周期", "并网条件", "客户正式承诺"],
    "冷库": ["客户负荷曲线", "设备报价", "BOM", "施工周期", "冷库运行工况", "客户正式承诺"],
    "报价": ["报价依据", "BOM", "有效期", "交付条件", "付款条款"],
    "合同": ["合同草案", "责任边界", "签字主体", "违约条款", "退出机制"],
    "股权": ["股权条款", "退出机制", "分红安排", "投入边界", "控制权约定"],
    "合作": ["合作目标", "投入边界", "责任分工", "合同草案", "90天执行路径"],
}

DECISION_TYPE_RULES: list[tuple[str, list[str]]] = [
    ("合作评估", ["合作", "合伙", "股权", "分红", "厦门"]),
    ("项目推进", ["项目", "推进", "储能", "冷库", "交付", "方案阶段"]),
    ("报价复盘", ["报价", "价格", "成本", "回款"]),
    ("投资判断", ["投资", "投入", "ROI", "收益"]),
    ("合同风险", ["合同", "签约", "签字", "协议"]),
    ("组织管理", ["组织", "人员", "绩效", "职责"]),
]

SWARM_DEPARTMENT_MAP: dict[str, str] = {
    "hubu_finance_swarm": "户部",
    "xingbu_legal_risk_swarm": "刑部",
    "gongbu_delivery_swarm": "工部",
    "libu_communication_swarm": "礼部",
    "bingbu_strategy_swarm": "兵部",
    "libu_org_execution_swarm": "吏部",
    "jinyiwei_intel_swarm": "锦衣卫",
}

POSITION_STATUS_MAP = {
    "准奏": "ready_for_decision",
    "补证": "needs_evidence",
    "复核": "needs_review",
    "驳回": "rejected",
}

DIRECT_AGENT_MAP = {
    "户部": "hubu_finance_agent",
    "刑部": "xingbu_legal_risk_agent",
    "礼部": "libu_communication_agent",
    "工部": "gongbu_delivery_agent",
    "兵部": "bingbu_strategy_agent",
    "吏部": "libu_org_agent",
    "锦衣卫": "jinyiwei_intel_agent",
    "丞相": "chancellor_agent",
}

EXPLICIT_CLUSTER_WORDS = ["会审", "军机处", "六部", "各部门", "群臣", "集群", "蜂群", "多部门"]
DIRECT_ACTION_WORDS = [
    "整理",
    "总结",
    "摘要",
    "改写",
    "润色",
    "草拟",
    "生成",
    "通知",
    "纪要",
    "翻译",
    "看一下",
    "初判",
    "初步",
    "简单",
]
HIGH_RISK_FLAGS = {"股权风险", "合同风险", "付款风险", "对外承诺风险", "需人工确认"}


@dataclass(frozen=True)
class DraftEdict:
    original_question: str
    refined_edict: str
    decision_type: str
    known_facts: list[str]
    unknown_gaps: list[str]
    recommended_departments: list[str]
    risk_flags: list[str]
    expected_memorial_format: list[str]
    emperor_confirmation_question: str
    source_label: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def make_id(prefix: str, *parts: object) -> str:
    seed = "|".join(str(p) for p in parts) or now_iso()
    return f"{prefix}_{sha1(seed.encode('utf-8')).hexdigest()[:12]}"


def _contains_any(text: str, keywords: list[str]) -> bool:
    lower = text.lower()
    return any(k.lower() in lower for k in keywords)


def infer_decision_type(question: str) -> str:
    for decision_type, keywords in DECISION_TYPE_RULES:
        if _contains_any(question, keywords):
            return decision_type
    return "其他"


def infer_departments(question: str) -> list[str]:
    departments = [
        dept
        for dept, rule in DEPARTMENT_RULES.items()
        if _contains_any(question, list(rule["keywords"]))
    ]
    if _contains_any(question, ["储能", "冷库", "项目", "推进", "是否"]):
        departments.insert(0, "户部")
    if _contains_any(question, ["判断", "是否", "要不要", "能不能", "推进", "客户承诺", "正式"]):
        departments.append("刑部")
    if not departments:
        departments = ["户部", "工部"]
    if len(departments) == 1 and departments[0] != "刑部" and _contains_any(question, ["风险", "能不能", "是否", "判断"]):
        departments.append("刑部")
    return _dedupe(departments)[:4]


def infer_risks(question: str, gaps: list[str]) -> list[str]:
    risks = [risk for risk, keywords in RISK_RULES.items() if _contains_any(question, keywords)]
    if gaps:
        risks.append("证据不足")
    if any(r in risks for r in ["股权风险", "合同风险", "付款风险", "对外承诺风险"]):
        risks.append("需人工确认")
    return _dedupe(risks)


def infer_unknown_gaps(question: str) -> list[str]:
    gaps: list[str] = []
    for trigger, required in GAP_RULES.items():
        if trigger.lower() in question.lower():
            gaps.extend(required)
    if re.search(r"\b\d+\s*(mwh|kwh|wh|ah|v)\b", question.lower()):
        gaps.extend(["技术规格边界", "成本测算", "交付周期", "客户正式承诺"])
    if _contains_any(question, ["判断", "是否", "要不要", "能不能", "推进"]):
        gaps.extend(["判断依据", "当前证据来源", "反方意见"])
    return _dedupe(gaps)[:8]


def infer_known_facts(question: str) -> list[str]:
    facts: list[str] = []
    for match in re.finditer(r"(\d+(?:\.\d+)?\s*(?:MWh|KWh|kWh|Wh|Ah|V|天|个月|年))", question, flags=re.I):
        facts.append(f"原问包含规模/时间/规格线索：{match.group(1)}")
    if "冷库" in question:
        facts.append("应用场景涉及冷库储能")
    if "储能" in question:
        facts.append("议题涉及储能项目")
    if "厦门" in question:
        facts.append("议题涉及厦门合作方")
    if "AI" in question or "ai" in question.lower():
        facts.append("议题涉及 AI 公司或 AI 能力")
    if not facts:
        facts.append("已记录皇上原始问题，尚需补充事实证据")
    return _dedupe(facts)[:6]


def infer_evidence_facts(evidence_summary: dict | None = None) -> list[str]:
    evidence_summary = evidence_summary or {}
    names = evidence_summary.get("attachment_names") or []
    count = evidence_summary.get("attachment_count") or len(names)
    facts: list[str] = []
    if evidence_summary.get("user_evidence") and count:
        facts.append(f"用户已上传补证附件 {count} 份")
        if names:
            facts.append(f"补证文件：{'、'.join(str(name) for name in names[:4])}")
    return facts


def infer_source_label(evidence_summary: dict | None = None, archive_matches: list | None = None) -> str:
    evidence_summary = evidence_summary or {}
    archive_matches = archive_matches or []
    if evidence_summary.get("live") and archive_matches:
        return "MIXED"
    if evidence_summary.get("live"):
        return "LIVE"
    if evidence_summary.get("user_evidence"):
        return "MIXED"
    if archive_matches:
        return "MIXED"
    return "FALLBACK"


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        clean = value.strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        out.append(clean)
    return out


def _risk_title(risk: object) -> str:
    if isinstance(risk, dict):
        return str(risk.get("risk") or risk.get("title") or risk.get("desc") or risk)
    return str(risk)


def _risk_requires_human(risk: object) -> bool:
    return isinstance(risk, dict) and bool(risk.get("requires_human_confirmation"))


def _swarm_department(swarm_output: dict) -> str:
    swarm_id = str(swarm_output.get("swarm_id", ""))
    fallback = str(swarm_output.get("swarm_role") or "未知部门")
    return SWARM_DEPARTMENT_MAP.get(swarm_id, fallback)


def ministry_outputs_from_swarm(result: dict) -> list[dict]:
    """Convert real swarm department outputs into the memorial-facing format.

    This is intentionally deterministic. It does not invent facts; it exposes
    each department's ability area, evidence, gaps, risk and next action.
    """
    outputs = []
    for item in result.get("brief", {}).get("department_sections") or []:
        department = _swarm_department(item)
        focus = DEPARTMENT_RULES.get(department, {}).get("focus", item.get("swarm_role", "专业意见"))
        position = str(item.get("position") or "补证")
        missing = [str(x) for x in (item.get("missing_evidence") or [])]
        risks = item.get("risks") or []
        key_findings = [str(x) for x in (item.get("key_findings") or [])]
        evidence_used = item.get("evidence_used") or []
        next_action = str(item.get("recommended_next_action") or "回到本部门补齐证据后再呈报。")
        opinion = str(item.get("summary") or "本部门已完成能力范围内审查。")
        if missing:
            opinion = f"{opinion} 当前不得按确定事实外发，需先补证。"
        if any(_risk_requires_human(risk) for risk in risks):
            opinion = f"{opinion} 命中需人工确认项，不得静默准奏。"
        outputs.append(
            {
                "department": department,
                "focus": focus,
                "ability_basis": focus,
                "swarm_id": item.get("swarm_id"),
                "swarm_role": item.get("swarm_role"),
                "position": position,
                "opinion": opinion,
                "key_findings": key_findings,
                "evidence_used": evidence_used,
                "missing_evidence": missing,
                "risks": risks,
                "recommended_next_action": next_action,
                "confidence": item.get("confidence"),
                "status": POSITION_STATUS_MAP.get(position, "needs_evidence"),
                "source_label": (
                    item.get("source_label")
                    or result.get("brief", {}).get("source_label")
                    or "FALLBACK"
                ),
            }
        )
    return outputs


def _format_list(values: list[str], empty: str = "无") -> str:
    values = [v for v in values if v]
    if not values:
        return empty
    return "；".join(values)


def format_memorial_sections(memorial: dict) -> dict:
    """Render the memorial in the fixed ShangShuFang writing order."""
    ministry_outputs = memorial.get("ministry_outputs") or []
    evidence_chain = memorial.get("evidence_chain") or []
    risk_register = memorial.get("risk_register") or []
    quality_gate = memorial.get("quality_gate") or {}

    sections = {
        "圣裁": (
            f"{memorial.get('verdict', '需复核')}。{memorial.get('summary', '')}"
        ).strip(),
        "分奏": "\n".join(
            f"{item.get('department')}奏：本部职能为{item.get('ability_basis') or item.get('focus')}。"
            f"{item.get('opinion')} 后令：{item.get('recommended_next_action')}"
            for item in ministry_outputs
        ) or "暂无各部分奏。",
        "证据": "\n".join(
            f"- {e.get('title') or e.get('source') or e.get('claim_supported')}: "
            f"{e.get('claim_supported') or e.get('status') or e.get('confidence') or '已记录'}"
            for e in evidence_chain
            if isinstance(e, dict)
        ) or "暂无可核验证据；不得包装成已核实事实。",
        "风险": "\n".join(
            f"- {_risk_title(risk)}"
            + ("（需人工确认）" if _risk_requires_human(risk) else "")
            for risk in risk_register
        ) or "未见新增风险，但仍以来源标签和质门为准。",
        "后令": memorial.get("recommended_next_action") or memorial.get("next_best_action") or "等待皇上裁决。",
        "质门": (
            f"状态：{quality_gate.get('status', 'unknown')}；"
            f"原因：{_format_list([str(x) for x in quality_gate.get('reasons', [])], '无阻断项')}；"
            f"人工签字：{'需要' if quality_gate.get('human_signoff_required') else '暂不需要'}。"
        ),
        "来源": (
            f"source_label={memorial.get('source_label', 'FALLBACK')}；"
            f"swarm_run_id={memorial.get('swarm_run_id', '未运行')}；"
            "FALLBACK/MIXED 内容只作审查预览，不作已验证事实。"
        ),
    }
    return {
        "section_order": EXPECTED_MEMORIAL_FORMAT.copy(),
        "sections": sections,
        "text": "\n\n".join(f"【{name}】\n{sections.get(name, '')}" for name in EXPECTED_MEMORIAL_FORMAT),
    }


def memorial_from_swarm_result(base_memorial: dict, result: dict) -> dict:
    """Replace template ministry text with evidence-backed swarm outputs."""
    brief = result.get("brief") or {}
    quality = result.get("quality_result") or {}
    ministry_outputs = ministry_outputs_from_swarm(result)
    missing = [str(x) for x in (brief.get("missing_evidence") or [])]
    risks = brief.get("risk_register") or []
    conflicts = brief.get("conflict_summary") or []
    human_signoff = any(_risk_requires_human(risk) for risk in risks)

    if human_signoff:
        verdict = "需人工复核"
        next_best_action = "request_evidence" if missing else "archive"
    elif missing or not quality.get("passed", True):
        verdict = "需补证"
        next_best_action = "request_evidence"
    else:
        verdict = "可裁决"
        next_best_action = "archive"

    source_label = (
        brief.get("source_label")
        or result.get("swarm_run", {}).get("source_label")
        or base_memorial.get("source_label", "FALLBACK")
    )
    summary = (
        f"已按各部能力完成真实蜂群分奏，共 {len(ministry_outputs)} 部参审。"
        f"当前来源为 {source_label}；"
        + ("存在证据缺口，建议先补证。" if missing else "可进入皇上裁决。")
    )
    if human_signoff:
        summary += " 命中客户承诺、合同、付款或签字类风险，必须保留人工确认门。"

    memorial = {
        **base_memorial,
        "title": base_memorial.get("title") or "军机处会审回奏",
        "verdict": verdict,
        "summary": summary,
        "ministry_outputs": ministry_outputs,
        "conflict_summary": conflicts,
        "evidence_chain": brief.get("evidence_chain") or [],
        "evidence_gaps": missing,
        "risk_register": risks,
        "risk_flags": _dedupe([*base_memorial.get("risk_flags", []), *[_risk_title(risk) for risk in risks]]),
        "recommended_next_action": brief.get("recommended_next_action") or base_memorial.get("recommended_next_action"),
        "next_best_action": next_best_action,
        "source_label": source_label,
        "swarm_run_id": result.get("swarm_run", {}).get("id"),
        "swarm_brief_for_junjichu": brief,
        "swarm_quality_result": quality,
        "quality_gate": {
            "status": "blocked" if missing or not quality.get("passed", True) else "passed",
            "reasons": missing or quality.get("blocking_reasons") or ["swarm_memorial_ready"],
            "human_signoff_required": human_signoff,
        },
    }
    memorial["formatted_memorial"] = format_memorial_sections(memorial)
    return memorial


def draft_edict(
    raw_question: str,
    *,
    evidence_summary: dict | None = None,
    archive_matches: list | None = None,
    source_label: str | None = None,
) -> DraftEdict:
    question = raw_question.strip()
    if not question:
        raise ValueError("raw_question 不能为空")

    decision_type = infer_decision_type(question)
    departments = infer_departments(question)
    gaps = infer_unknown_gaps(question)
    facts = _dedupe(infer_known_facts(question) + infer_evidence_facts(evidence_summary))[:6]
    risks = infer_risks(question, gaps)
    label = source_label or infer_source_label(evidence_summary, archive_matches)
    if label not in SOURCE_LABELS:
        label = "FALLBACK"

    dept_focus = "；".join(
        f"{dept}核查{DEPARTMENT_RULES[dept]['focus']}" for dept in departments if dept in DEPARTMENT_RULES
    )
    gap_focus = "、".join(gaps[:6]) if gaps else "事实证据、执行路径和风险边界"
    refined = (
        f"请军机处组织{ '、'.join(departments) }参审，围绕“{question}”形成可裁决奏折。"
        f"重点核查：{gap_focus}。{dept_focus}。"
    )

    return DraftEdict(
        original_question=question,
        refined_edict=refined,
        decision_type=decision_type,
        known_facts=facts,
        unknown_gaps=gaps,
        recommended_departments=departments,
        risk_flags=risks,
        expected_memorial_format=EXPECTED_MEMORIAL_FORMAT.copy(),
        emperor_confirmation_question="是否确认发起军机处会审？",
        source_label=label,
    )


def evaluate_draft(edict: DraftEdict) -> dict:
    failed: list[str] = []
    if not edict.original_question:
        failed.append("must_preserve_original_question")
    if len(edict.refined_edict) < 20 or "军机处" not in edict.refined_edict:
        failed.append("must_generate_actionable_task")
    if not edict.recommended_departments or len(edict.recommended_departments) > 4:
        failed.append("must_route_departments")
    if edict.source_label not in SOURCE_LABELS:
        failed.append("source_label_required")
    if any(r in edict.risk_flags for r in ["股权风险", "合同风险", "付款风险", "对外承诺风险"]) and "需人工确认" not in edict.risk_flags:
        failed.append("high_risk_human_signoff")
    if "证据不足" in edict.risk_flags and not edict.unknown_gaps:
        failed.append("must_expose_gaps")

    total = 5
    score = max(0.0, (total - len(failed)) / total)
    return {
        "suite": "shangshufang_draft_edict_v1",
        "passed": not failed,
        "score": score,
        "failed": failed,
    }


def draft_to_dict(edict: DraftEdict) -> dict:
    return asdict(edict)


def chancellor_decide_route(edict: DraftEdict) -> dict:
    """丞相判定下旨走简单任务单还是复杂集群任务。

    这是业务角色语义，不是前端按钮规则。实现保持确定性，便于审计和测试。
    """
    question = edict.original_question
    explicit_cluster = _contains_any(question, EXPLICIT_CLUSTER_WORDS)
    direct_action = _contains_any(question, DIRECT_ACTION_WORDS)
    high_risks = [risk for risk in edict.risk_flags if risk in HIGH_RISK_FLAGS]
    business_departments = [dept for dept in edict.recommended_departments if dept != "刑部" or "刑部" in question]
    legal_only_from_question = "刑部" in edict.recommended_departments and not _contains_any(
        question,
        list(DEPARTMENT_RULES["刑部"]["keywords"]),
    )
    candidate_departments = [dept for dept in edict.recommended_departments if not (dept == "刑部" and legal_only_from_question)]
    target_department = candidate_departments[0] if candidate_departments else (edict.recommended_departments[0] if edict.recommended_departments else "丞相")

    cluster_reasons: list[str] = []
    if explicit_cluster:
        cluster_reasons.append("皇上原问明确要求会审/军机处/六部/集群")
    if high_risks:
        cluster_reasons.append(f"命中高风险：{'、'.join(high_risks)}")
    if len(business_departments) >= 2 and not direct_action:
        cluster_reasons.append(f"涉及多部门：{'、'.join(_dedupe(business_departments))}")
    if edict.unknown_gaps and not direct_action:
        cluster_reasons.append(f"存在关键证据缺口：{'、'.join(edict.unknown_gaps[:3])}")

    if cluster_reasons:
        return {
            "mode": "cluster",
            "decidedBy": "chancellor",
            "reason": "；".join(cluster_reasons),
            "reviewDepth": "deep",
            "targetAgent": None,
            "targetDepartment": "军机处",
            "departments": edict.recommended_departments,
            "swarmRequired": True,
            "humanSignoffRequired": "需人工确认" in edict.risk_flags,
            "riskFlags": edict.risk_flags,
            "evidenceGaps": edict.unknown_gaps,
        }

    reason_parts = [f"丞相判定可由{target_department}直接承办"]
    if direct_action:
        reason_parts.append("原问属于整理/草拟/初判类轻量任务")
    if edict.unknown_gaps:
        reason_parts.append("存在缺口但不阻断初步任务单，结果需标注限制")
    if not edict.risk_flags or edict.risk_flags == ["证据不足"]:
        reason_parts.append("未命中付款/合同/股权/对外承诺等高风险")

    return {
        "mode": "direct",
        "decidedBy": "chancellor",
        "reason": "；".join(reason_parts),
        "reviewDepth": "shallow",
        "targetAgent": DIRECT_AGENT_MAP.get(target_department, "chancellor_agent"),
        "targetDepartment": target_department,
        "departments": [target_department],
        "swarmRequired": False,
        "humanSignoffRequired": False,
        "riskFlags": edict.risk_flags,
        "evidenceGaps": edict.unknown_gaps,
    }


def routing_plan_for(edict: DraftEdict, route: dict | None = None) -> dict:
    route = route or chancellor_decide_route(edict)
    if route.get("mode") == "direct":
        department = route.get("targetDepartment") or (edict.recommended_departments[0] if edict.recommended_departments else "丞相")
        return {
            "routing_id": make_id("route", edict.original_question, "direct", department),
            "route": route,
            "ministry_candidates": [department],
            "swarm_plan": [
                {
                    "department": department,
                    "focus": DEPARTMENT_RULES.get(department, {}).get("focus", "丞相直接任务单"),
                    "status": "direct",
                }
            ],
            "route_reason": route.get("reason", "丞相判定可直接承办"),
            "review_depth": "shallow",
            "swarm_required": False,
            "source_label": edict.source_label,
        }
    return {
        "routing_id": make_id("route", edict.original_question, ",".join(edict.recommended_departments)),
        "route": route,
        "ministry_candidates": edict.recommended_departments,
        "swarm_plan": [
            {
                "department": dept,
                "focus": DEPARTMENT_RULES.get(dept, {}).get("focus", "专业意见"),
                "status": "pending",
            }
            for dept in edict.recommended_departments
        ],
        "route_reason": route.get("reason") or "根据原问关键词、风险标记和证据缺口自动推荐；用户无需选择蜂群。",
        "review_depth": "deep",
        "swarm_required": True,
        "source_label": edict.source_label,
    }


def direct_receipt_for(edict: DraftEdict, routing_plan: dict) -> dict:
    """生成简单任务单回执，不启动军机处集群。"""
    route = routing_plan.get("route") or chancellor_decide_route(edict)
    department = str(route.get("targetDepartment") or "丞相")
    agent = str(route.get("targetAgent") or DIRECT_AGENT_MAP.get(department, "chancellor_agent"))
    limits = []
    if edict.unknown_gaps:
        limits.append(f"缺证限制：{'、'.join(edict.unknown_gaps[:5])}")
    if edict.risk_flags:
        limits.append(f"风险提示：{'、'.join(edict.risk_flags)}")
    if not limits:
        limits.append("未命中高风险；仍按来源标签保留审计边界")

    ministry_output = {
        "department": department,
        "focus": DEPARTMENT_RULES.get(department, {}).get("focus", "丞相直接任务单"),
        "opinion": f"丞相已判定本旨可由{department}直接承办；承办 Agent：{agent}。当前回执为任务单，不代表对外承诺或最终经营裁决。",
        "status": "direct_ready",
        "source_label": edict.source_label,
    }
    memorial = {
        "title": "上书房简单任务单回执",
        "verdict": "可直接承办",
        "summary": f"丞相判定为简单任务单，由{department}直接承办，不开军机处集群。",
        "draft_edict": draft_to_dict(edict) | {"route": route},
        "route": route,
        "target_agent": agent,
        "ministry_outputs": [ministry_output],
        "conflict_summary": [],
        "evidence_gaps": edict.unknown_gaps,
        "risk_flags": edict.risk_flags,
        "risk_register": [],
        "evidence_chain": [{"title": "皇上原问", "claim_supported": edict.original_question, "status": "recorded"}],
        "recommended_next_action": f"交由{department}按任务单办理；如后续命中风险或多部门冲突，再转军机处会审。",
        "decision_options": [
            {
                "action": "archive",
                "label": "准奏归档",
                "reason": "归档当前简单任务单回执。",
                "enabled": True,
            },
            {
                "action": "request_evidence",
                "label": "要求补证",
                "reason": "如需形成确定性结论，先补齐缺口。",
                "enabled": bool(edict.unknown_gaps),
            },
            {
                "action": "escalate_cluster",
                "label": "转军机处",
                "reason": "如皇上认为需多部门会审，可升级为复杂集群任务。",
                "enabled": True,
            },
        ],
        "next_best_action": "archive" if not edict.unknown_gaps else "request_evidence",
        "source_label": edict.source_label,
        "quality_gate": {
            "status": "passed" if not edict.unknown_gaps else "needs_review",
            "reasons": limits,
            "human_signoff_required": False,
        },
    }
    memorial["formatted_memorial"] = format_memorial_sections(memorial)
    return memorial


def review_memorial_for(edict: DraftEdict, routing_plan: dict) -> dict:
    """生成第一版军机处会审奏折。

    这不是替六部伪造真实执行结果，而是把丞相拟旨、部门职责、证据缺口和风险门
    合成一个可裁决对象。所有不具备实时证据的结论继续挂 source_label。
    """
    ministry_outputs: list[dict] = []
    for dept in routing_plan.get("ministry_candidates", edict.recommended_departments):
        focus = DEPARTMENT_RULES.get(dept, {}).get("focus", "专业意见")
        if dept == "户部":
            opinion = "当前不能直接作投入/收益定论；需先补齐报价、收益测算、现金流与回款边界。"
        elif dept == "工部":
            opinion = "当前只能进入方案核查；需补齐技术规格、BOM、施工周期、供应链和实施条件。"
        elif dept == "刑部":
            opinion = "涉及合同、签字或对外承诺时必须人工确认；缺证状态下不得输出自动准奏。"
        elif dept == "礼部":
            opinion = "对外表达应先限定事实、条件和有效期，避免把样板判断包装成正式承诺。"
        elif dept == "兵部":
            opinion = "市场与竞争动作需要单列攻防假设，不能以抢进度替代风险核查。"
        elif dept == "吏部":
            opinion = "需要明确责任人、时间点和复盘标准，否则后令不可执行。"
        else:
            opinion = "需按本部门职责补充分奏。"
        ministry_outputs.append(
            {
                "department": dept,
                "focus": focus,
                "opinion": opinion,
                "status": "needs_evidence" if edict.unknown_gaps else "ready_for_decision",
                "source_label": edict.source_label,
            }
        )

    conflict_summary: list[dict] = []
    if edict.unknown_gaps:
        conflict_summary.append(
            {
                "type": "evidence_gap",
                "summary": "存在证据缺口，不能把拟旨升级为确定性经营结论。",
                "departments": edict.recommended_departments,
                "source_label": edict.source_label,
            }
        )
    if any(r in edict.risk_flags for r in ["股权风险", "合同风险", "付款风险", "对外承诺风险", "需人工确认"]):
        conflict_summary.append(
            {
                "type": "human_signoff",
                "summary": "命中高风险或对外承诺场景，必须保留人工签字/确认门。",
                "departments": [d for d in edict.recommended_departments if d in {"刑部", "户部", "礼部"}],
                "source_label": edict.source_label,
            }
        )

    verdict = "需补证" if edict.unknown_gaps else "可裁决"
    if "需人工确认" in edict.risk_flags:
        verdict = "需人工复核"
    next_best_action = "request_evidence" if edict.unknown_gaps else "archive"
    decision_options = [
        {
            "action": "request_evidence",
            "label": "要求补证",
            "reason": "证据缺口未补齐时，先补证再复核。",
            "enabled": bool(edict.unknown_gaps),
        },
        {
            "action": "archive",
            "label": "准奏归档",
            "reason": "归档当前拟旨、分奏、风险与裁决；不代表自动对外执行。",
            "enabled": True,
        },
        {
            "action": "reject",
            "label": "驳回重拟",
            "reason": "拟旨方向不对或部门路由错误时打回。",
            "enabled": True,
        },
    ]

    memorial = {
        "title": "军机处会审回奏",
        "verdict": verdict,
        "summary": (
            f"已按{ '、'.join(edict.recommended_departments) }形成第一版会审。"
            f"当前来源为 {edict.source_label}；"
            + ("存在证据缺口，建议先补证。" if edict.unknown_gaps else "可进入皇上裁决。")
        ),
        "draft_edict": draft_to_dict(edict),
        "ministry_outputs": ministry_outputs,
        "conflict_summary": conflict_summary,
        "evidence_gaps": edict.unknown_gaps,
        "risk_flags": edict.risk_flags,
        "risk_register": [],
        "evidence_chain": [],
        "recommended_next_action": "先补证再复核。" if edict.unknown_gaps else "归档当前会审结果。",
        "decision_options": decision_options,
        "next_best_action": next_best_action,
        "source_label": edict.source_label,
        "quality_gate": {
            "status": "blocked" if edict.unknown_gaps else "passed",
            "reasons": edict.unknown_gaps or ["edict_contract_ready"],
            "human_signoff_required": "需人工确认" in edict.risk_flags,
        },
    }
    memorial["formatted_memorial"] = format_memorial_sections(memorial)
    return memorial


def home_payload() -> dict:
    return {
        "source_label": "FALLBACK",
        "today_issue": {
            "title": "暂无真实一号问题",
            "why_now": "当前未接入实时经营信号；可先用一句话下旨创建真实决策任务。",
            "urgency": "中",
            "recommended_action": "暂不建议处理",
            "evidence_basis": ["本地任务库可用", "上书房拟旨规则可用"],
            "missing_evidence": ["实时经营数据", "待裁决任务", "史馆相似旧案"],
        },
        "pending_decisions": [],
        "pending_evidence_tasks": [],
        "archive_hints": [],
    }
