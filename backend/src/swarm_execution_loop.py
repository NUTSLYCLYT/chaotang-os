"""军机处后台蜂群产线。

第一版是确定性、schema-first 的后台执行器：
- 不面向用户聊天
- 不让用户选择蜂群
- 不把 DEMO/FALLBACK 伪装成 LIVE_SWARM
- 每个关键结论必须有 evidence_used 或 missing_evidence

真实 AgentHarness 接入后，只替换各 swarm 的 executor，输出契约保持不变。
"""

from __future__ import annotations

import contextlib
import contextvars
import hashlib
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from src.perf_outcomes_guard import enrich_quality_result
from src.real_department_engines import get_real_engine_fn_for_swarm

# 页面同步路径覆盖开关。2026-07-14 Codex 复审发现:原实现用 os.environ[...] = ...
# 在 shangshufang.py 里 set/finally-restore,但 FastAPI 同步 route 跑在线程池,
# os.environ 是进程级共享状态——并发请求(两个用户同时点/同一用户双击)会互相踩踏
# 对方的开关,退化回 hang 或提前把开关踩灭。ContextVar 按线程/task 隔离,且本文件
# 下方 _run_departments_cross_referenced 已经用 contextvars.copy_context() 把
# 调用方 context 带进 ThreadPoolExecutor worker,这两个开关天然复用同一条链路。
_PAGE_SYNC_LIVE_OVERRIDE: contextvars.ContextVar[bool | None] = contextvars.ContextVar(
    "_PAGE_SYNC_LIVE_OVERRIDE", default=None
)
_PAGE_SYNC_SKIP_REAL_OVERRIDE: contextvars.ContextVar[bool | None] = contextvars.ContextVar(
    "_PAGE_SYNC_SKIP_REAL_OVERRIDE", default=None
)


@contextlib.contextmanager
def page_sync_scope():
    """页面同步路径专用作用域:关通用角色扮演 LLM(FENGQUN_LIVE_SWARM 语义)+
    跳过真实部门引擎 LLM 外呼(FENGQUN_PAGE_SYNC_SKIP_REAL_ENGINES 语义)。
    用 contextvars.Token 精确 reset,不做"读旧值再写回"快照,天然支持并发/嵌套调用。
    """
    live_token = _PAGE_SYNC_LIVE_OVERRIDE.set(False)
    skip_token = _PAGE_SYNC_SKIP_REAL_OVERRIDE.set(True)
    try:
        yield
    finally:
        _PAGE_SYNC_LIVE_OVERRIDE.reset(live_token)
        _PAGE_SYNC_SKIP_REAL_OVERRIDE.reset(skip_token)


SWARM_DOER_MODEL = (
    "swarm-deepseek-pro"  # 蜂群 doer 路由(bias 判定用;真 executor 接入后即此族)
)


def _perf_outcomes_judge_call():
    """P2b 真裁判调用器。仅当 PERF_OUTCOMES_JUDGE 开 且 LITELLM_KEY 在 才返回 callable;
    否则 None → enrich 走 P2a 形态(不烧 LLM)。把 LLM 调用隔离在 live 边界,核心保持纯函数。"""
    import os

    if os.environ.get("PERF_OUTCOMES_JUDGE", "").lower() not in (
        "1",
        "true",
        "yes",
        "on",
    ):
        return None
    key = os.environ.get("LITELLM_KEY")
    if not key:
        return None
    from src.model_adapter import ModelAdapter

    adapter = ModelAdapter(api_base="http://127.0.0.1:4444/v1", api_key=key)

    def _call(*, system_prompt, user_prompt, model):
        return adapter.call(
            system_prompt=system_prompt, user_prompt=user_prompt, model=model
        )

    return _call


# 审查簇五件套 + SOURCE_LABELS + _dedupe 已拆到 swarm_review(2026-07-14,行为零变更)。
# 此处 re-export 保住外部调用方与 mock patch target 的导入路径,勿删。
from src.swarm_review import (  # noqa: F401
    SOURCE_LABELS,
    _dedupe,
    critic_report,
    detect_conflicts,
    evidence_audit,
    quality_gate,
    synthesize_brief,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def now_iso_precise() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def make_id(prefix: str, *parts: object) -> str:
    raw = "|".join(str(part) for part in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _has(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


# 刑部硬停关键词:不可逆法律责任(股权/独家/付款/签字等)不得静默准奏,不管立场是规则模板
# 还是真实引擎给的——xingbu_verdict 的真实引擎只产出 red|yellow|green,从不产出 black,
# 而 _court_doc_to_ministry_contract 只在 level==black 时置 requires_human_confirmation,
# 真实引擎接入后如果不额外兜底,这条硬停信号会静默消失(2026-07-04 测试抓到的真回归)。
_XINGBU_HARD_STOP_KEYWORDS = [
    "合同",
    "股权",
    "独家",
    "付款",
    "承诺",
    "正式报价",
    "保证收益",
    "签字",
]


def _enforce_xingbu_hard_stop(
    swarm_id: str, text: str, out: dict[str, Any]
) -> dict[str, Any]:
    if swarm_id != "xingbu_legal_risk_swarm" or not _has(
        text, _XINGBU_HARD_STOP_KEYWORDS
    ):
        return out
    risks = out.get("risks") or []
    if any(r.get("requires_human_confirmation") for r in risks):
        return out
    out = {
        **out,
        "risks": [
            *risks,
            {
                "risk": "合同/股权/对外承诺风险",
                "severity": "高",
                "reason": "涉及不可逆法律责任关键词,不得静默准奏",
                "requires_human_confirmation": True,
            },
        ],
    }
    return out



SWARM_DEFS: dict[str, dict[str, Any]] = {
    "hubu_finance_swarm": {
        "role": "户部财务蜂群",
        "keywords": [
            "投入",
            "ROI",
            "报价",
            "成本",
            "预算",
            "现金流",
            "回款",
            "毛利",
            "资金",
            "付款",
        ],
    },
    "xingbu_legal_risk_swarm": {
        "role": "刑部法务风险蜂群",
        "keywords": [
            "合同",
            "股权",
            "签字",
            "法律责任",
            "付款",
            "独家",
            "对外承诺",
            "客户承诺",
            "正式报价",
        ],
    },
    "gongbu_delivery_swarm": {
        "role": "工部交付技术蜂群",
        "keywords": [
            "BOM",
            "交期",
            "施工",
            "供应链",
            "设备",
            "技术方案",
            "并网",
            "交付",
            "储能",
        ],
    },
    "libu_communication_swarm": {
        "role": "礼部对外表达蜂群",
        "keywords": [
            "招商话术",
            "客户表达",
            "销售材料",
            "品牌",
            "对外宣传",
            "报价话术",
            "客户",
            "保证收益",
        ],
    },
    "bingbu_strategy_swarm": {
        "role": "兵部竞争战略蜂群",
        "keywords": [
            "竞争",
            "渠道",
            "谈判",
            "竞品",
            "市场攻防",
            "价格战",
            "合作",
            "试点",
        ],
    },
    "libu_org_execution_swarm": {
        "role": "吏部组织执行蜂群",
        "keywords": [
            "负责人",
            "组织",
            "职责",
            "绩效",
            "执行",
            "协同",
            "DRI",
            "90天",
            "90 天",
        ],
    },
    "jinyiwei_intel_swarm": {
        "role": "锦衣卫情报蜂群",
        "keywords": ["情报", "核实", "可信度", "信源", "谣言", "线报", "传闻", "查证"],
    },
}

META_SWARMS = [
    "evidence_audit_swarm",
    "critic_swarm",
    "conflict_detector_swarm",
    "synthesis_swarm",
    "quality_gate_swarm",
]

# 部门名/别名 → swarm_id。供非军机处串行闭环按部门名点名调度(锦衣卫/户部…),
# 而不必让调用方知道内部 swarm_id。
DEPT_NAME_TO_SWARM: dict[str, str] = {
    "锦衣卫": "jinyiwei_intel_swarm",
    "户部": "hubu_finance_swarm",
    "刑部": "xingbu_legal_risk_swarm",
    "工部": "gongbu_delivery_swarm",
    "礼部": "libu_communication_swarm",
    "兵部": "bingbu_strategy_swarm",
    "吏部": "libu_org_execution_swarm",
    "jin_yi_wei": "jinyiwei_intel_swarm",
    "hu_bu": "hubu_finance_swarm",
    "xing_bu": "xingbu_legal_risk_swarm",
    "gong_bu": "gongbu_delivery_swarm",
    "li_bu_comms": "libu_communication_swarm",
    "bing_bu": "bingbu_strategy_swarm",
    "li_bu_org": "libu_org_execution_swarm",
}


def normalize_source_label(label: str | None, *, has_real_trace: bool = False) -> str:
    if label not in SOURCE_LABELS:
        return "FALLBACK"
    if label == "LIVE_SWARM" and not has_real_trace:
        return "MIXED"
    return label


def route_swarms(
    confirmed_edict: dict[str, Any],
    review_plan: dict[str, Any] | None = None,
    *,
    mode: str = "standard",
) -> dict[str, Any]:
    text = "\n".join(
        str(x)
        for x in [
            confirmed_edict.get("original_question"),
            confirmed_edict.get("refined_edict"),
            confirmed_edict.get("decision_type"),
            " ".join(confirmed_edict.get("risk_flags") or []),
            " ".join(confirmed_edict.get("unknown_gaps") or []),
            str(review_plan or {}),
        ]
        if x
    )
    selected: list[dict[str, str]] = []
    for swarm_id, spec in SWARM_DEFS.items():
        hit = next((kw for kw in spec["keywords"] if kw in text), None)
        if hit:
            selected.append({"swarm_id": swarm_id, "reason": f"命中关键词：{hit}"})

    if not selected:
        selected = [
            {"swarm_id": "hubu_finance_swarm", "reason": "默认审查财务边界"},
            {"swarm_id": "xingbu_legal_risk_swarm", "reason": "默认审查风险红线"},
            {"swarm_id": "gongbu_delivery_swarm", "reason": "默认审查交付可行性"},
        ]

    risk_flags = confirmed_edict.get("risk_flags") or []
    high_risk = (
        _has(text, ["合同", "股权", "付款", "承诺", "正式报价", "保证收益", "预付款"])
        or "需人工确认" in risk_flags
    )
    selected_ids = {item["swarm_id"] for item in selected}
    for required in ["evidence_audit_swarm", "synthesis_swarm", "quality_gate_swarm"]:
        if required not in selected_ids:
            selected.append(
                {"swarm_id": required, "reason": "standard/deep 必跑元蜂群"}
            )
            selected_ids.add(required)
    if high_risk:
        for required in ["critic_swarm", "conflict_detector_swarm"]:
            if required not in selected_ids:
                selected.append(
                    {"swarm_id": required, "reason": "高风险必须反方质疑与分歧识别"}
                )
                selected_ids.add(required)

    return {
        "swarm_mode": mode,
        "selected_swarms": selected,
        "swarm_tasks": [
            {
                "swarm_id": item["swarm_id"],
                "question": "请按本蜂群职责输出结构化分奏、证据、缺口、风险和下一步。",
            }
            for item in selected
        ],
        "expected_outputs": [
            "department_sections",
            "evidence_chain",
            "risk_register",
            "conflict_summary",
            "recommended_next_action",
        ],
        "source_label": normalize_source_label(
            confirmed_edict.get("source_label"), has_real_trace=False
        ),
    }


def _evidence(
    title: str, source_type: str, claim: str, confidence: str = "中"
) -> dict[str, str]:
    return {
        "title": title,
        "source_type": source_type,
        "claim_supported": claim,
        "quote_or_location": title,
        "confidence": confidence,
    }


def _live_department_position(
    swarm_id: str, common: dict, text: str, call_fn=None
) -> dict | None:
    """军机处通电:真 LLM 生成部门立场(从 mock 到真多智能体)。失败返回 None(调用方兜底规则)。

    call_fn(system,user)->str 可注入(测试);默认走 active provider(model_adapter)。
    只输出结构化 JSON,解析失败/调用失败 → None,绝不崩、绝不假 PASS。
    """
    role = common.get("swarm_role", swarm_id)
    sys_p = (
        f"你是朝堂「{role}」蜂群。审议下面议题,给出本部门立场。"
        '只输出 JSON:{"position":"准奏|补证|复核|驳回","summary":"一句话立场",'
        '"key_findings":["要点"],"missing_evidence":["缺什么"],'
        '"risks":[{"risk":"风险","severity":"高|中|低","reason":"原因"}],'
        '"recommended_next_action":"下一步","confidence":"高|中|低"}。不要解释、不要markdown。'
    )
    try:
        if call_fn is None:
            import os
            from src.model_adapter import ModelAdapter
            from src.provider import get_active_provider
            from src.provider import active_fallback_models

            p = get_active_provider() or {}
            call = ModelAdapter(
                model=p.get("default_model", "openai/deepseek-chat"),
                api_base=p.get("api_base", ""),
                api_key=os.environ.get(p.get("api_key_env", "DEEPSEEK_API_KEY"), ""),
                temperature=0.2,
            )
            # 主力无 key 时不静默退回规则 mock,先落 active 声明的兜底(如 deepseek)
            res = call.call(
                sys_p,
                text[:6000],
                skip_budget=True,
                fallback_models=active_fallback_models(),
            )
            if res.get("status") != "success":
                return None
            raw = res["output"]
        else:
            raw = call_fn(sys_p, text[:6000])
        import json
        import re

        s = re.sub(
            r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.MULTILINE
        ).strip()
        m = re.search(r"\{.*\}", s, re.DOTALL)
        d = json.loads(m.group(0) if m else s)
        if not isinstance(d, dict) or "position" not in d:
            return None
        return {
            **common,
            "position": str(d.get("position", "补证")),
            "summary": str(d.get("summary", ""))[:200],
            "key_findings": [str(x) for x in (d.get("key_findings") or [])][:6],
            "missing_evidence": _dedupe(
                [str(x) for x in (d.get("missing_evidence") or [])]
            ),
            "risks": [r for r in (d.get("risks") or []) if isinstance(r, dict)][:5],
            "recommended_next_action": str(d.get("recommended_next_action", "")),
            "confidence": str(d.get("confidence", "中")),
            "source_label": "LIVE_SWARM",  # 真 LLM 出的立场,升级来源标签
        }
    except Exception:
        return None


def run_department_swarm(
    swarm_id: str,
    confirmed_edict: dict[str, Any],
    source_label: str,
    *,
    live: bool | None = None,
    call_fn=None,
    real_engine_fn=None,
) -> dict[str, Any]:
    """部门蜂群立场。real_engine_fn 命中优先(真实部门专用引擎,如兵部/锦衣卫);
    否则 live=True 走真 LLM(军机处通电),失败兜底规则;默认按 env FENGQUN_LIVE_SWARM。

    默认关(deterministic 规则),不破既有行为;real_engine_fn/live 任一命中则出真立场。
    """
    import os

    text = f"{confirmed_edict.get('original_question', '')}\n{confirmed_edict.get('refined_edict', '')}\n{confirmed_edict.get('raw_command', '')}"
    if real_engine_fn is not None:
        try:
            real_out = real_engine_fn(text)
        except Exception:
            real_out = None
        if real_out is not None:
            return _enforce_xingbu_hard_stop(swarm_id, text, real_out)
    if live is None:
        override = _PAGE_SYNC_LIVE_OVERRIDE.get()
        live = (
            override
            if override is not None
            else os.environ.get("FENGQUN_LIVE_SWARM", "").lower() in ("1", "true", "yes")
        )
    rule = _rule_department_swarm(swarm_id, confirmed_edict, source_label)
    if not live and call_fn is None:
        return rule
    live_out = _live_department_position(
        swarm_id,
        {
            "swarm_id": rule["swarm_id"],
            "swarm_role": rule["swarm_role"],
            "evidence_used": rule.get("evidence_used", []),
        },
        text,
        call_fn=call_fn,
    )
    return live_out or rule  # 真 LLM 出立场,失败兜底规则(禁假 PASS)


def _rule_department_swarm(
    swarm_id: str, confirmed_edict: dict[str, Any], source_label: str
) -> dict[str, Any]:
    text = f"{confirmed_edict.get('original_question', '')}\n{confirmed_edict.get('refined_edict', '')}"
    known = confirmed_edict.get("known_facts") or []
    gaps = confirmed_edict.get("unknown_gaps") or []
    evidence_used = [_evidence(item, "USER_INPUT", item) for item in known[:4]]
    common = {
        "swarm_id": swarm_id,
        "swarm_role": SWARM_DEFS.get(swarm_id, {}).get("role", swarm_id),
        "evidence_used": evidence_used,
        "source_label": source_label,
    }

    if swarm_id == "hubu_finance_swarm":
        missing = (
            _dedupe([*gaps, "ROI 假设", "成本拆解", "付款节点"])
            if not _has(text, ["ROI", "回本", "现金流"])
            else gaps
        )
        return {
            **common,
            "position": "补证" if missing else "准奏",
            "summary": "户部认为必须先核清投入、ROI、报价和现金流边界。",
            "key_findings": ["财务结论取决于报价、成本、回款周期和付款节点。"],
            "missing_evidence": missing,
            "risks": [
                {
                    "risk": "ROI 不成立或现金流承压",
                    "severity": "中",
                    "reason": "财务证据不足",
                    "requires_human_confirmation": False,
                }
            ],
            "recommended_next_action": "补齐 ROI、成本拆解和付款节点。",
            "confidence": "中",
        }
    if swarm_id == "xingbu_legal_risk_swarm":
        high = _has(text, _XINGBU_HARD_STOP_KEYWORDS)
        return {
            **common,
            "position": "复核" if high else "补证",
            "summary": "刑部审查合同、股权、付款、签字和对外承诺红线。",
            "key_findings": ["涉及不可逆法律责任时不得静默准奏。"],
            "missing_evidence": _dedupe(
                [*gaps, "合同条款", "授权签字记录"] if high else gaps
            ),
            "risks": [
                {
                    "risk": "合同/股权/对外承诺风险",
                    "severity": "高" if high else "中",
                    "reason": "可能形成不可逆责任",
                    "requires_human_confirmation": high,
                }
            ],
            "recommended_next_action": "法务复核并人工确认红线条款。",
            "confidence": "中",
        }
    if swarm_id == "gongbu_delivery_swarm":
        missing = (
            _dedupe([*gaps, "BOM", "交期", "验收标准"])
            if _has(text, ["储能", "设备", "交付", "施工"])
            else gaps
        )
        return {
            **common,
            "position": "补证" if missing else "准奏",
            "summary": "工部核查技术方案、BOM、交期、供应链和验收条件。",
            "key_findings": ["缺 BOM/交期/验收标准时不能承诺固定交付。"],
            "missing_evidence": missing,
            "risks": [
                {
                    "risk": "交付不可行或供应链缺口",
                    "severity": "中",
                    "reason": "交付证据不足",
                    "requires_human_confirmation": False,
                }
            ],
            "recommended_next_action": "补 BOM、交期和验收标准后再承诺交付。",
            "confidence": "中",
        }
    if swarm_id == "libu_communication_swarm":
        overpromise = _has(text, ["保证收益", "稳赚", "零风险", "正式报价"])
        return {
            **common,
            "position": "复核" if overpromise else "补证",
            "summary": "礼部审查客户表达、招商话术和对外材料是否越界。",
            "key_findings": ["对外表达必须避免形成收益或交付承诺。"],
            "missing_evidence": _dedupe([*gaps, "对外材料版本", "客户沟通纪要"]),
            "risks": [
                {
                    "risk": "对外表达越界",
                    "severity": "高" if overpromise else "中",
                    "reason": "可能被客户理解为正式承诺",
                    "requires_human_confirmation": overpromise,
                }
            ],
            "recommended_next_action": "改成条件式口径，并交刑部复核。",
            "confidence": "中",
        }
    if swarm_id == "bingbu_strategy_swarm":
        return {
            **common,
            "position": "补证",
            "summary": "兵部评估客户路径、竞争态势和市场攻防节奏。",
            "key_findings": ["机会成色取决于客户决策链、预算和试点路径。"],
            "missing_evidence": _dedupe([*gaps, "客户决策链", "试点路径", "竞品信息"]),
            "risks": [
                {
                    "risk": "伪机会或竞争劣势",
                    "severity": "中",
                    "reason": "市场证据不足",
                    "requires_human_confirmation": False,
                }
            ],
            "recommended_next_action": "补客户决策链和试点路径。",
            "confidence": "中",
        }
    if swarm_id == "jinyiwei_intel_swarm":
        return {
            **common,
            "position": "补证",
            "summary": "锦衣卫尚未核实到可信情报，不得据传闻下结论。",
            "key_findings": ["未过可信度分级门的信息不算数。"],
            "missing_evidence": _dedupe([*gaps, "一手信源", "多源印证"]),
            "risks": [
                {
                    "risk": "据未核实情报决策",
                    "severity": "中",
                    "reason": "情报未过可信度门",
                    "requires_human_confirmation": False,
                }
            ],
            "recommended_next_action": "补一手来源或多源印证后再据情报下结论。",
            "confidence": "低",
        }
    return {
        **common,
        "position": "补证",
        "summary": "吏部核查 DRI、协同部门和 7/30/90 天执行节奏。",
        "key_findings": ["无人负责或无执行节奏时不能进入执行。"],
        "missing_evidence": _dedupe([*gaps, "第一责任人(DRI)", "协同部门", "时间节点"]),
        "risks": [
            {
                "risk": "执行落空",
                "severity": "中",
                "reason": "责任与节奏不清",
                "requires_human_confirmation": False,
            }
        ],
        "recommended_next_action": "指定 DRI 并生成 7/30/90 天计划。",
        "confidence": "中",
    }



# 锦衣卫是唯一的"情报收集"部门,其余部门是"拿证据做判断"——让锦衣卫先跑,
# 把它的真实核实结果喂给后面的部门当上下文,是部门间互动最小可行的一步:
# 户部判断报价/刑部审风险时,能看到锦衣卫刚核实过的情报,而不是各部门互相绝缘。
_INTEL_GATHERING_SWARM = "jinyiwei_intel_swarm"


def _run_one_department(
    sid: str, edict: dict[str, Any], source_label: str
) -> dict[str, Any]:
    """跑单个部门蜂群(真实引擎优先,失败退兜底)。抽出来供串行/并行两条路径复用。

    页面同步路径(FENGQUN_PAGE_SYNC_SKIP_REAL_ENGINES=1)跳过真实引擎:真实引擎
    (兵部/刑部/户部…)每部一次真 LLM 外呼,配了 provider key 时串起来 >2min,
    卡死上书房页面点击(hang 根因,2026-07-14 定位)。页面路径改走确定性规则兜底
    ——各部仍有分奏(不空),快;昂贵的真 LLM 分析留给 async 深议 session。
    """
    override = _PAGE_SYNC_SKIP_REAL_OVERRIDE.get()
    skip_real = (
        override
        if override is not None
        else os.environ.get("FENGQUN_PAGE_SYNC_SKIP_REAL_ENGINES") == "1"
    )
    real_fn = (
        None
        if skip_real
        else get_real_engine_fn_for_swarm(sid, swarm_role=SWARM_DEFS[sid]["role"])
    )
    return run_department_swarm(sid, edict, source_label, real_engine_fn=real_fn)


def _run_departments_cross_referenced(
    department_ids: list[str], confirmed_edict: dict[str, Any], source_label: str
) -> list[dict[str, Any]]:
    """锦衣卫(如被选中)先跑;若真实引擎给出可信情报,后续部门收到的
    confirmed_edict 会多一段"锦衣卫已核实情报"——只影响文本上下文,不改变
    other departments 自己的真实引擎/规则模板逻辑,调用失败/未选中锦衣卫时
    行为跟改动前完全一样。

    ① 部门并行化(2026-07-06):锦衣卫必须先串行跑(其产出要喂后续部门),其余部门
    彼此独立(各自真实引擎/LLM 是独立网络往返),改用 ThreadPool 并发,省 wall-clock。
    用 copy_context 保 budget/token_monitor 等 ContextVar 在 worker 里可见。并发上限
    SWARM_DEPT_MAX_WORKERS(默认6),设 1 退回串行。输出仍按原 department_ids 顺序返回,
    下游(evidence_audit/critic_report/synthesize_brief)看到的部门排列不变。
    """
    outputs_by_id: dict[str, dict[str, Any]] = {}
    edict_for_others = confirmed_edict

    # 锦衣卫先串行跑,可信情报喂给后续部门
    if _INTEL_GATHERING_SWARM in department_ids:
        intel_out = _run_one_department(
            _INTEL_GATHERING_SWARM, confirmed_edict, source_label
        )
        outputs_by_id[_INTEL_GATHERING_SWARM] = intel_out
        if intel_out.get("source_label") == "LIVE_ENGINE" and intel_out.get(
            "key_findings"
        ):
            intel_text = "；".join(str(f) for f in intel_out["key_findings"][:5])
            edict_for_others = {
                **confirmed_edict,
                "refined_edict": (
                    f"{confirmed_edict.get('refined_edict', '')}\n"
                    f"【锦衣卫已核实情报】{intel_text}"
                ),
            }

    # 其余部门并发跑(彼此独立)
    others = [d for d in department_ids if d != _INTEL_GATHERING_SWARM]
    if others:
        max_workers = min(
            len(others), int(os.environ.get("SWARM_DEPT_MAX_WORKERS", "6"))
        )
        if max_workers <= 1:
            for sid in others:
                outputs_by_id[sid] = _run_one_department(
                    sid, edict_for_others, source_label
                )
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                fut_to_sid = {}
                for sid in others:
                    ctx = contextvars.copy_context()
                    fut = pool.submit(
                        ctx.run,
                        _run_one_department,
                        sid,
                        edict_for_others,
                        source_label,
                    )
                    fut_to_sid[fut] = sid
                for fut, sid in fut_to_sid.items():
                    try:
                        outputs_by_id[sid] = fut.result()
                    except Exception:
                        # 单部门异常不拖垮整轮:串行再跑一次兜底(run_department_swarm
                        # 自身已兜底规则模板,通常不抛;此处双保险)。
                        outputs_by_id[sid] = _run_one_department(
                            sid, edict_for_others, source_label
                        )

    # 保持原有 department_ids 顺序输出,只是执行顺序并发——不改变下游看到的部门排列。
    return [outputs_by_id[sid] for sid in department_ids]


def normalize_departments(names: list[str]) -> list[str]:
    """部门名/别名/swarm_id → 有效 swarm_id 列表(去重保序)。

    锦衣卫恒置首:它先采证,产出喂后续部门(见 _run_departments_cross_referenced)。
    非军机处串行闭环按部门名点名调度时用。
    """
    out: list[str] = []
    for name in names or []:
        raw = str(name).strip()
        sid = raw if raw in SWARM_DEFS else DEPT_NAME_TO_SWARM.get(raw)
        if sid and sid in SWARM_DEFS and sid not in out:
            out.append(sid)
    if _INTEL_GATHERING_SWARM in out:
        out = [_INTEL_GATHERING_SWARM] + [s for s in out if s != _INTEL_GATHERING_SWARM]
    return out


def run_swarm_execution_loop(params: dict[str, Any]) -> dict[str, Any]:
    task_id = params["task_id"]
    review_id = params["review_id"]
    confirmed_edict = params["confirmed_edict"]
    review_plan = params.get("review_plan") or {}
    mode = params.get("mode") or "standard"
    trace_id = params.get("trace_id")
    # council=False:非军机处串行闭环(锦衣卫→户部→丞相回奏直呈上书房,跳过冲突合奏)。
    council = params.get("council", True)
    department_override = params.get("department_ids")
    source_label = normalize_source_label(
        confirmed_edict.get("source_label"), has_real_trace=bool(trace_id)
    )
    started = now_iso_precise()
    run_id = make_id("swarmrun", task_id, review_id, started)
    route_plan = route_swarms(
        {**confirmed_edict, "source_label": source_label}, review_plan, mode=mode
    )
    if department_override:
        department_ids = normalize_departments(department_override)
        if not department_ids:
            raise ValueError("department_ids 无有效部门(部门名/别名/swarm_id 均未命中)")
        # 覆盖生效时不能整体重写 selected_swarms：route_swarms() 已经按文本算出的
        # 元蜂群(证据审计/质量闸/高风险时的红蓝对抗等)仍然会在下面无条件执行
        # (evidence_audit/critic_report/synthesize_brief/quality_gate)，如果这里把
        # 它们从审计记录里去掉，就会变成"记录的参与者 ≠ 实际执行者"的另一个变体。
        meta_entries = [
            item for item in route_plan["selected_swarms"] if item["swarm_id"] in META_SWARMS
        ]
        overridden_selected = [
            {"swarm_id": sid, "role": SWARM_DEFS[sid]["role"]}
            for sid in department_ids
        ] + meta_entries
        # swarm_tasks 是 selected_swarms 的姊妹字段(route_swarms() 里两者从同一个
        # selected 列表算出，任务问题文案本就与部门无关，是同一句固定话术)，覆盖后
        # 不重建的话会停留在关键词路由算出的旧部门，跟刚修好的 selected_swarms 自己
        # 打架，同样是"记录 ≠ 实际执行"。
        route_plan = {
            **route_plan,
            "selected_swarms": overridden_selected,
            "swarm_tasks": [
                {
                    "swarm_id": item["swarm_id"],
                    "question": "请按本蜂群职责输出结构化分奏、证据、缺口、风险和下一步。",
                }
                for item in overridden_selected
            ],
            "override_reason": "non_council_serial" if not council else "explicit_departments",
        }
    else:
        department_ids = [
            item["swarm_id"]
            for item in route_plan["selected_swarms"]
            if item["swarm_id"] in SWARM_DEFS
        ]
    department_outputs = _run_departments_cross_referenced(
        department_ids, confirmed_edict, source_label
    )
    audit = evidence_audit(department_outputs, source_label)
    critique = critic_report(department_outputs, audit, source_label)
    # 非军机处不做多部门冲突合奏:直接空冲突,回奏直呈上书房。
    conflicts = (
        detect_conflicts(department_outputs, source_label)
        if council
        else {"conflicts": [], "source_label": source_label}
    )
    brief = synthesize_brief(
        department_outputs, audit, critique, conflicts, source_label, council=council
    )
    gate = quality_gate(brief)
    # 深焊(方案A'):蜂群输出 → court_doc 装配末段(纯增量,失败不阻断既有循环)
    court_doc = None
    try:
        from src.court_doc_builder import DEPT_REGISTRY
        from src.swarm_to_court_doc import assemble_from_swarm

        dept = confirmed_edict.get("department") or "prime_minister"
        if dept not in DEPT_REGISTRY:
            dept = "prime_minister"
        court_doc = assemble_from_swarm(
            dept,
            department_outputs,
            question=str(confirmed_edict.get("raw_command", "")),
            archive=False,
        )
    except Exception:
        court_doc = None
    finished = now_iso_precise()
    return {
        "court_doc": court_doc,
        "swarm_run": {
            "id": run_id,
            "task_id": task_id,
            "review_id": review_id,
            "mode": mode,
            "status": "completed" if gate["passed"] else "quality_blocked",
            "source_label": source_label,
            "route_plan": route_plan,
            "trace_id": trace_id,
            "started_at": started,
            "finished_at": finished,
            "error": None,
        },
        "task_runs": [
            {
                "id": make_id("swarmtask", run_id, output["swarm_id"]),
                "swarm_id": output["swarm_id"],
                "role": output["swarm_role"],
                "status": "completed",
                "input": {
                    "confirmed_edict": confirmed_edict,
                    "review_plan": review_plan,
                },
                "output": output,
                "source_label": output["source_label"],
                "confidence": output["confidence"],
                "started_at": started,
                "finished_at": finished,
                "error": None,
            }
            for output in department_outputs
        ],
        "evidence_links": [
            {
                "id": make_id(
                    "evidence",
                    run_id,
                    output["swarm_id"],
                    item.get("claim_supported"),
                    idx,
                ),
                "swarm_task_run_id": make_id("swarmtask", run_id, output["swarm_id"]),
                "claim": item.get("claim_supported") or output["summary"],
                "evidence_source_type": item.get("source_type") or "MODEL_INFERENCE",
                "evidence_ref": item.get("quote_or_location"),
                "confidence": item.get("confidence") or "中",
            }
            for output in department_outputs
            for idx, item in enumerate(output.get("evidence_used") or [])
        ],
        "evidence_audit": audit,
        "critique_report": critique,
        "conflict_summary": conflicts,
        "brief": brief,
        "quality_result": {
            # 稳定键放 spread 之后,enrich 永远盖不掉(会审 MEDIUM2)
            **enrich_quality_result(
                gate,
                judge_call=_perf_outcomes_judge_call(),
                doer_model=SWARM_DOER_MODEL,
            ),
            "id": make_id("swarmquality", task_id, review_id, started),
            "swarm_run_id": run_id,
            "created_at": finished,
        },
    }
