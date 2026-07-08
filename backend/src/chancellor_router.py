"""丞相顶层选择器(2026-07-07 · 三层递归架构第2步·顶层)。

丞相 = 唯一对用户说话的编排者。decide() 是它的脑子:把密旨判成
  - direct:单域任务,直接选一个入口蜂群(select_entry_swarm);
  - junjichu:跨域任务,开军机处,选参加的尚书子集(六部),由各尚书在自己的 calls_swarms 里再选蜂群(第2步·中层)。

设计纪律(继承会审):
1. 纯函数组合已有 router(route_department_task 六部打分 + select_entry_swarm 单蜂群),不调 LLM——
   编排是受约束选择,不是自由 agent(Karpathy)。
2. 证券红线已在**入口**(securities_redline.route_with_redline_precheck,第0步b)短路,decide **不再**下放给
   窄化的部级候选集——这正是会审头号 CRITICAL"红线经三层分解旁路"的修法:全局硬门只在入口一次,不分解。
3. 开军机处保守默认(会审警告:关键词重叠会过度会审=成本×3):≥2 部真得分才 convene,不确定→direct(便宜可逆)。
   每次决定结构化返回,供上层 record_event 落账 → 将来攒 routing_truth 尺子校准这个阈值(第5步)。
4. selected_ministries 每个带 allowed_swarms(=该部 calls_swarms),是给中层尚书的契约:尚书只在这个有界集里选。

边界注(2026-07-08,防铁律3误收敛):本模块是**密旨直发路径**的丞相(确定性关键词,不调 LLM,
喂唯一 SwarmOrchestrator);chaotang_orchestrator.draft_decree 是**拟旨/圣旨路径**的丞相
(LLM 分诊+人确认后才会审)。两者服务不同通路、失败模式不同(本处 confident-wrong 靠弃权兜,
彼处幻觉靠 evidence 硬约束兜),不是同一意图两实现——收敛前先过铁律7三问。
"""

from __future__ import annotations

from typing import Any

from src.chaotang_department_router import route_department_task
from src.confidence_tag import classify
from src.decree_swarm_router import select_entry_swarm

# ≥2 部得分>0 = 跨域,开军机处。保守默认——会审警告过度会审=成本×3,宁可 direct。
JUNJICHU_MIN_MINISTRIES = 2


def _ministry_view(dept: dict[str, Any]) -> dict[str, Any]:
    """把 route_department_task 的候选部门压成给中层尚书的契约视图。"""
    return {
        "code": dept.get("code", ""),
        "name": dept.get("name", ""),
        "allowed_swarms": list(
            dept.get("callsSwarms", [])
        ),  # 尚书只在这个有界集里选(第2步中层)
        "score": dept.get("score", 0),
        "matched_keywords": list(dept.get("matchedKeywords", [])),
    }


def decide(
    command: str,
    available_swarms: Any,
    *,
    force_mode: str | None = None,
) -> dict[str, Any]:
    """丞相顶层裁决:direct 单蜂群 or junjichu 选尚书子集。

    force_mode:用户/上游可强制 'direct' 或 'junjichu'(人选优先,留痕)。默认按打分启发式,保守偏 direct。
    返回 {mode, selected_ministries[], direct_swarm?, reason, qintianjian_trigger}。
    注:调用前证券红线应已在入口处理(route_with_redline_precheck),decide 不再重跑红线。
    """
    route = route_department_task(command)
    scoring = route.get("candidateDepartments", [])  # 已 score>0 且按分排名
    ministries = [_ministry_view(d) for d in scoring]

    convene = force_mode == "junjichu" or (
        force_mode != "direct" and len(scoring) >= JUNJICHU_MIN_MINISTRIES
    )

    if convene and ministries:
        decision: dict[str, Any] = {
            "mode": "junjichu",
            "selected_ministries": ministries,
            "direct_swarm": None,
            "reason": f"跨 {len(ministries)} 部({'/'.join(m['name'] for m in ministries)}),开军机处会审",
        }
    else:
        routed = select_entry_swarm(command, available_swarms)
        primary = ministries[0] if ministries else None
        decision = {
            "mode": "direct",
            "selected_ministries": [primary] if primary else [],
            "direct_swarm": routed.get("swarm"),
            "reason": routed.get("reason", ""),
        }

    decision["qintianjian_trigger"] = route.get("qintianjianTrigger")
    return decision


def select_dept_swarm(subtask: str, ministry: dict[str, Any]) -> dict[str, Any]:
    """中层尚书:在本部 allowed_swarms 有界集里选蜂群(第2步·中层,与 decide 同一受约束选择器的递归)。

    两条会审 HIGH 的修法焊在这里:
    1. **窄集不跑证券红线**:apply_securities_redline=False。红线只在入口一次(第0步b),这里再跑=在缩小的
       候选集上找不到合规落点、跌进业务蜂群的旁路(会审头号 CRITICAL)。信任入口,本层不重跑。
    2. **matched=False → 弃权,不硬选**:窄集里没有关键词自信命中时,不落字母序第一个"错兄弟蜂群"(会审 HIGH),
       而是返回 abstain=True 让尚书上报/追问(诚实弃权,不冒充"选对了")。
    """
    available = list(ministry.get("allowed_swarms", []))
    if not available:
        return {
            "swarm": None,
            "abstain": True,
            "reason": "该部无 allowed_swarms,无从选起",
            "ministry": ministry.get("code", ""),
        }

    routed = select_entry_swarm(subtask, available, apply_securities_redline=False)
    if not routed.get("matched"):
        # 窄集无自信命中:弃权,不硬选字母序默认(那是"貌似选对"的 confident-wrong)
        return {
            "swarm": None,
            "abstain": True,
            "reason": f"{ministry.get('name', '')}在本部蜂群里无自信命中,弃权待上报/追问(不硬选)",
            "ministry": ministry.get("code", ""),
        }
    return {
        "swarm": routed["swarm"],
        "abstain": False,
        "reason": routed.get("reason", ""),
        "ministry": ministry.get("code", ""),
    }


def _case_display_name(source: str, content: str) -> str:
    """旧案人话标题(会审·张小龙:文件名怼脸=工程师语言)。
    case_archive:20260622_220537_..._A+.json + 内容首行任务输入 → 「6月22日·评估一份储能PACK代工合同…」"""
    import re as _re

    m = _re.search(r"(20\d{2})(\d{2})(\d{2})", source)
    date = f"{int(m.group(2))}月{int(m.group(3))}日" if m else ""
    t = _re.search(r"任务输入\**[:：]\**\s*(.+)", content or "")
    head = (t.group(1).strip() if t else "").split("\n")[0][:24]
    if date and head:
        return f"{date}·{head}"
    return head or date or source


def genius_next_step(
    command: str,
    selected_ministries: list[dict[str, Any]] | None = None,
    *,
    top_k: int = 3,
    task_ref: str = "",
) -> list[dict[str, Any]]:
    """丞相天才下一步:基于**史馆真旧案召回**给建议,带引用+置信档;无召回→弃权,绝不编造。

    诚实纪律(会审):
    1. 召回走 KnowledgeRAG.search(默认 tenant_isolation=True,第0步a后半)——只学**这家企业**的旧案,
       绝不跨租户;命中的案例即天才建议的接地依据,带 source 引用可核。
    2. 无召回(新租户/无历史)→ 返回 grounded=False + confidence='needs_evidence' 的弃权项,
       诚实标"暂无旧案可依据",**不**用 LLM 生成一段像模像样的假建议(那会在下一步层重新引入幻觉)。
    3. 每条建议经 confidence_tag.classify 标一手/二手/待核档,让丞相对普通人说"这条多有把握"。
    """
    try:
        from src.knowledge_rag import get_rag

        hits = get_rag().search(command, top_k=top_k, scope=["case_archive"])
    except Exception:
        hits = []

    # 第5步收尾·史馆飞轮:召回按 outcome prior 加权(证实上浮/打脸深降权不删),
    # 并留引用痕迹供 30 天成果回执催收。回执层故障不丢召回(fail-open 到未加权)。
    try:
        from src.shiguan_outcome import log_citation, weight_hits

        hits = weight_hits(hits)
        log_citation([h.get("source", "?") for h in hits], task_ref=task_ref)
    except Exception:
        pass

    if not hits:
        return [
            {
                "suggestion": "暂无同类旧案可依据,建议先补充关键证据(合同/成交/规格)再决策",
                "grounded": False,
                "confidence": "needs_evidence",
                "citations": [],
            }
        ]

    dept_hint = "、".join(
        m.get("name", "") for m in (selected_ministries or []) if m.get("name")
    )
    steps: list[dict[str, Any]] = []
    for h in hits:
        source = h.get("source", "?")
        outcome = h.get("outcome")  # weight_hits 附带的回执结论(可能为 None)
        tier = classify(
            h.get("content", ""), [source]
        )  # TierResult 是 TypedDict(普通 dict)
        display = _case_display_name(source, h.get("content", ""))
        if outcome == "refuted":
            # 反面教材诚实亮出:被打脸的旧案不冒充可参照,更不静默消失
            suggestion = f"警惕:旧案「{display}」类似做法事后被证伪(有回执),别照抄,先看当时怎么翻车"
            confidence = "needs_evidence"
        else:
            suggestion = f"参照旧案「{display}」的做法推进" + (
                f",主责{dept_hint}" if dept_hint else ""
            )
            confidence = tier["tier"]
        steps.append(
            {
                "suggestion": suggestion,
                "grounded": True,
                "confidence": confidence,
                "outcome": outcome,
                "citations": [source],
                "evidence_snippet": (h.get("content", "") or "")[:120],
            }
        )
    return steps
