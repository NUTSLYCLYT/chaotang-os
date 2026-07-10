"""ChancellorRoutingService — 唯一权威路由事实源（阶段1）。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.6/14节。

收敛策略（务实、渐进，不是重写）：
- 继续复用 shangshufang_loop.chancellor_decide_route()——这是唯一已被 web 层
  真实调用、有完整测试覆盖(34个黄金案例)的确定性规则集，收敛的意义是"包一层
  统一契约+持久化+幂等"，不是重新发明部门打分逻辑。
- 引入 chaotang_department_router.route_department_task() 的打分结果计算
  complexity_score，让两套路由器至少在"复杂度量化"这一点上共用同一个信号，
  而不是各自独立、互不可比。
- chancellor_router.decide()(密旨直发路径)保持独立不动——两者服务不同产品
  路径，方案第2节已说明这不是"同一意图两实现"，收敛前先过铁律7三问（见
  chancellor_router.py 模块注释）。本服务只统一"上书房正式下旨"这一条主链。
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha1
from typing import TYPE_CHECKING

from src.chancellor.contracts import RouteDecisionV2, RouteParticipant
from src.chaotang_department_router import route_department_task
from src.shangshufang_loop import (
    DIRECT_AGENT_MAP,
    chancellor_decide_route,
    draft_edict,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

CAPABILITY_SNAPSHOT_VERSION = "v1-static-department-rules"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_decision_id(task_id: str, idempotency_key: str) -> str:
    seed = f"{task_id}|{idempotency_key}|{_now_iso()}"
    return f"routedec_{sha1(seed.encode('utf-8')).hexdigest()[:16]}"


def _complexity_score(departments: list[str], scoring: list[dict]) -> float:
    """确定性复杂度估计：命中部门数(封顶4)+参与部门实际得分强度的加权平均。

    不是方案6.4节的完整 route_score(那是候选路线打分,阶段3做)，这里只回答
    "这次下旨大致有多复杂"，供 RouteDecisionV2.complexity_score 落库、供
    后续阶段3引入真实评分模型时对照。
    """
    dept_count_factor = min(len(departments), 4) / 4
    if scoring:
        score_values = [float(item.get("score", 0)) for item in scoring]
        max_score = max(score_values) or 1.0
        avg_strength = sum(score_values) / len(score_values) / max_score
    else:
        avg_strength = 0.0
    return round(0.6 * dept_count_factor + 0.4 * avg_strength, 4)


def _strategy_for(mode: str, reason: str) -> str:
    if mode == "direct":
        return "single_agent"
    if "证据缺口" in reason and "会审" not in reason and "高风险" not in reason:
        return "evidence_first"
    return "parallel_review"


def _participants_for(route: dict) -> list[RouteParticipant]:
    departments: list[str] = route.get("departments") or []
    if route["mode"] == "direct":
        primary = route.get("targetDepartment") or (
            departments[0] if departments else "丞相"
        )
        return [
            RouteParticipant(
                department=primary,
                agent_id=route.get("targetAgent") or DIRECT_AGENT_MAP.get(primary),
                role="primary",
                reason=route.get("reason", ""),
                required=True,
                status="planned",
            )
        ]
    participants: list[RouteParticipant] = []
    for index, dept in enumerate(departments):
        participants.append(
            RouteParticipant(
                department=dept,
                agent_id=None,  # cluster 模式下具体 agent 由阶段2 department_assignments 派单时选
                role="primary" if index == 0 else "reviewer",
                reason=route.get("reason", ""),
                required=True,
                status="planned",
            )
        )
    return participants


class ChancellorRoutingService:
    """上书房正式下旨的唯一路由入口。confirm-edict 必须经此，不得信任客户端回传 route。"""

    def decide(
        self,
        db: "Session",
        *,
        task_id: str,
        confirmed_edict_text: str,
        idempotency_key: str,
        source_label: str = "LIVE",
        supersedes_decision_id: str | None = None,
    ) -> RouteDecisionV2:
        from src.db.models import ChancellorRouteDecision

        existing = (
            db.query(ChancellorRouteDecision)
            .filter_by(task_id=task_id, idempotency_key=idempotency_key)
            .first()
        )
        if existing is not None:
            return RouteDecisionV2.model_validate_json(existing.decision_json)

        edict = draft_edict(confirmed_edict_text, source_label=source_label)
        route = chancellor_decide_route(edict)
        scoring_result = route_department_task(confirmed_edict_text)
        scoring = scoring_result.get("candidateDepartments", [])

        mode = "direct" if route["mode"] == "direct" else "council"
        decision = RouteDecisionV2(
            decision_id=_make_decision_id(task_id, idempotency_key),
            task_id=task_id,
            mode=mode,
            strategy=_strategy_for(route["mode"], route.get("reason", "")),
            primary_department=route.get("targetDepartment")
            or (route.get("departments") or ["丞相"])[0],
            primary_agent=route.get("targetAgent"),
            participants=_participants_for(route),
            reason_summary=route.get("reason", ""),
            complexity_score=_complexity_score(route.get("departments") or [], scoring),
            complexity_reasons=[route.get("reason", "")] if route.get("reason") else [],
            risk_flags=route.get("riskFlags") or [],
            evidence_gaps=route.get("evidenceGaps") or [],
            assumptions=[],
            confidence=0.9 if route["mode"] == "direct" else 0.75,
            policy_hits=[
                flag
                for flag in (route.get("riskFlags") or [])
                if flag
                in {"股权风险", "合同风险", "付款风险", "对外承诺风险", "需人工确认"}
            ],
            human_confirmation_required=bool(route.get("humanSignoffRequired")),
            capability_snapshot_version=CAPABILITY_SNAPSHOT_VERSION,
            prompt_version=None,
            source_label=(
                source_label
                if source_label in {"LIVE", "MIXED", "FALLBACK", "DEMO"}
                else "FALLBACK"
            ),
            created_at=_now_iso(),
            supersedes_decision_id=supersedes_decision_id,
        )

        db.add(
            ChancellorRouteDecision(
                decision_id=decision.decision_id,
                task_id=task_id,
                idempotency_key=idempotency_key,
                mode=decision.mode,
                primary_department=decision.primary_department,
                source_label=decision.source_label,
                supersedes_decision_id=supersedes_decision_id,
                decision_json=json.dumps(decision.model_dump(), ensure_ascii=False),
                created_at=decision.created_at,
            )
        )
        return decision


def legacy_route_dict(decision: RouteDecisionV2) -> dict:
    """把 RouteDecisionV2 转回 chancellor_decide_route() 的旧 dict 形状。

    routing_plan_for()/direct_receipt_for()/review_memorial_for() 这些既有
    下游函数吃的是旧 route 形状，兼容期内不改它们的签名，只在边界处适配。
    """
    mode = "direct" if decision.mode == "direct" else "cluster"
    return {
        "mode": mode,
        "decidedBy": "chancellor",
        "reason": decision.reason_summary,
        "reviewDepth": "shallow" if mode == "direct" else "deep",
        "targetAgent": decision.primary_agent,
        "targetDepartment": decision.primary_department,
        "departments": [p.department for p in decision.participants],
        "swarmRequired": mode != "direct",
        "humanSignoffRequired": decision.human_confirmation_required,
        "riskFlags": decision.risk_flags,
        "evidenceGaps": decision.evidence_gaps,
    }


chancellor_routing_service = ChancellorRoutingService()
