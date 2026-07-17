"""丞相顶层选择器(2026-07-07 · 三层递归架构第2步·顶层)。

丞相 = 唯一对用户说话的编排者。decide() 把密旨判成
  - direct:单域任务,直接选一个入口蜂群(select_entry_swarm);
  - junjichu:跨域任务,开军机处,选参加的尚书子集(六部),由各尚书在自己的 calls_swarms 里再选蜂群(第2步·中层)。

收敛注(2026-07-14,超级丞相方案阶段1):mode 与部门集**唯一事实源是
shangshufang_loop.chancellor_decide_route**(黄金案例钦定口径,见 tests/fixtures/chancellor_golden_cases.py)。
本模块降级为蜂群适配层:部名 → six_ministries code → allowed_swarms → 入口蜂群。
2026-07-08 的"两套路由不同意图保持独立"边界注就此作废——两套规则引擎并存造成 mode 级分歧
(见 chancellor_golden_cases_divergence.json 历史记录),收敛是方案文档
docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第14节阶段1的既定交付。

设计纪律(继承会审,仍然有效):
1. 确定性规则,不调 LLM——编排是受约束选择,不是自由 agent(Karpathy)。
2. 证券红线已在**入口**(securities_redline.route_with_redline_precheck,第0步b)短路,decide **不再**下放给
   窄化的部级候选集——全局硬门只在入口一次,不分解。
3. selected_ministries 每个带 allowed_swarms(=该部 calls_swarms),是给中层尚书的契约:尚书只在这个有界集里选。
"""

from __future__ import annotations

from typing import Any

from src.chaotang_department_router import load_department_config, score_ministry
from src.chaotang_department_payload import build_qintianjian_trigger
from src.confidence_tag import classify
from src.chancellor_llm_recommendation import merge_decision_level, recommend_route
from src.decree_swarm_router import select_entry_swarm
from src.shangshufang_loop import chancellor_decide_route, draft_edict

# 已收敛(2026-07-14):mode 由 chancellor_decide_route 判,此阈值仅作历史下界/测试兼容,勿再用于分支。
JUNJICHU_MIN_MINISTRIES = 2


def _ministry_view_from_name(
    name: str, command: str, by_name: dict[str, tuple[str, dict[str, Any]]]
) -> dict[str, Any]:
    """部名(loop 口径,中文)→ 给中层尚书的契约视图。

    未映射名(锦衣卫/丞相等 six_ministries 之外的角色)→ allowed_swarms=[],
    走 select_dept_swarm 既有的诚实弃权机制,不硬选。
    """
    code, spec = by_name.get(name, ("", {}))
    score, hits = score_ministry(code, command) if code else (0, [])
    return {
        "code": code,
        "name": name,
        "allowed_swarms": list(spec.get("calls_swarms", [])),
        "score": score,
        "matched_keywords": hits,
    }


def decide(
    command: str,
    available_swarms: Any,
    *,
    force_mode: str | None = None,
) -> dict[str, Any]:
    """丞相顶层裁决:direct 单蜂群 or junjichu 选尚书子集。

    mode+部门集委托唯一规则引擎 chancellor_decide_route(收敛注见模块头);
    本函数只做部名→蜂群适配。force_mode:用户/上游可强制 'direct' 或 'junjichu'(人选优先,留痕)。
    返回 {mode, selected_ministries[], direct_swarm?, reason, qintianjian_trigger}。
    注:调用前证券红线应已在入口处理(route_with_redline_precheck),decide 不再重跑红线。
    """
    by_name = {
        spec.get("name", ""): (code, spec)
        for code, spec in load_department_config().get("six_ministries", {}).items()
    }
    if (command or "").strip():
        route = chancellor_decide_route(draft_edict(command))
    else:
        # draft_edict 对空密旨 raise;空命令退单蜂群直发,保持旧 decide("") 不炸的契约
        route = {"mode": "direct", "departments": [], "reason": "空密旨,退单蜂群直发"}

    recommendation = recommend_route(command)
    hard_level = "D2" if route.get("riskFlags") else ("D1" if route.get("mode") == "cluster" else "D0")
    decision_level = merge_decision_level(hard_level, recommendation.get("d_level"), None)

    ministries = [
        _ministry_view_from_name(n, command, by_name)
        for n in (route.get("departments") or [])
    ]

    convene = force_mode == "junjichu" or (
        force_mode != "direct" and route.get("mode") == "cluster"
    )

    if convene and ministries:
        decision: dict[str, Any] = {
            "mode": "junjichu",
            "selected_ministries": ministries,
            "direct_swarm": None,
            "reason": route.get("reason", ""),
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

    decision["qintianjian_trigger"] = build_qintianjian_trigger(command)
    decision["route_recommendation"] = recommendation
    decision["decision_level"] = decision_level
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
