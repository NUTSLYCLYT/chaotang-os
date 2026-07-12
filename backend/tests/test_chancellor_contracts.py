"""阶段0：RouteDecisionV2/DecreeExecutionStatusV1/ChancellorAdviceV1 契约冻结验收。"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.chancellor.contracts import (
    ChancellorAdviceOption,
    ChancellorAdviceV1,
    DecreeExecutionStatusV1,
    DepartmentAssignment,
    RouteDecisionV2,
    RouteParticipant,
    TimelineEvent,
)


def _route_decision(**overrides: object) -> RouteDecisionV2:
    base = dict(
        decision_id="decision_1",
        task_id="task_1",
        mode="direct",
        strategy="single_agent",
        primary_department="户部",
        primary_agent="hubu_finance_agent",
        participants=[],
        reason_summary="单一部门可直接承办",
        complexity_score=0.2,
        complexity_reasons=[],
        risk_flags=[],
        evidence_gaps=[],
        assumptions=[],
        confidence=0.9,
        policy_hits=[],
        human_confirmation_required=False,
        capability_snapshot_version="v1",
        prompt_version=None,
        source_label="LIVE",
        created_at="2026-07-10T00:00:00+00:00",
        supersedes_decision_id=None,
    )
    base.update(overrides)
    return RouteDecisionV2(**base)


def test_route_decision_v2_direct_mode_round_trips():
    decision = _route_decision()
    assert decision.schema_version == "RouteDecisionV2"
    restored = RouteDecisionV2.model_validate_json(decision.model_dump_json())
    assert restored == decision


def test_route_decision_v2_council_mode_with_participants():
    decision = _route_decision(
        mode="council",
        strategy="parallel_review",
        primary_agent=None,
        participants=[
            RouteParticipant(
                department="刑部",
                agent_id="xingbu_legal_risk_agent",
                role="reviewer",
                reason="涉及合同责任",
                required=True,
                status="planned",
            )
        ],
        human_confirmation_required=True,
    )
    assert decision.mode == "council"
    assert decision.participants[0].role == "reviewer"


def test_route_decision_v2_confidence_out_of_range_rejected():
    with pytest.raises(ValidationError):
        _route_decision(confidence=1.5)


def test_decree_execution_status_v1_embeds_route_decision():
    decision = _route_decision()
    status = DecreeExecutionStatusV1(
        task_id="task_1",
        current_stage="chancellor_routing",
        current_owner="丞相",
        latest_message="正在生成路由",
        next_stage="dispatched",
        blocked_reason=None,
        route_decision=decision,
        departments=[
            DepartmentAssignment(
                department="户部",
                agent_id="hubu_finance_agent",
                status="planned",
                latest_message="待派单",
                started_at=None,
                completed_at=None,
            )
        ],
        timeline=[
            TimelineEvent(
                event_id="evt_1",
                stage="chancellor_routing",
                actor="chancellor",
                message="路由已生成",
                occurred_at="2026-07-10T00:00:01+00:00",
                sequence=1,
            )
        ],
    )
    assert status.route_decision.decision_id == "decision_1"
    assert status.departments[0].status == "planned"


def test_chancellor_advice_v1_requires_3_to_5_options():
    option = ChancellorAdviceOption(
        id="conditional_pilot",
        title="有条件试点",
        benefits=["保留市场窗口"],
        risks=["合同仍需修改"],
        conditions=["首付款不超过预算上限"],
        next_actions=["户部确认预算"],
        evidence_refs=["evidence_hubu_01"],
    )
    with pytest.raises(ValidationError):
        ChancellorAdviceV1(
            task_id="task_1",
            analysis="项目具备试点条件",
            options=[option, option],  # 只有2个,不满足3-5约束
            recommended_option_id="conditional_pilot",
            recommendation_reason="覆盖主要风险",
            dissent=[],
            confidence=0.8,
            human_confirmation_required=True,
            source_label="LIVE",
        )

    advice = ChancellorAdviceV1(
        task_id="task_1",
        analysis="项目具备试点条件",
        options=[option, option, option],
        recommended_option_id="conditional_pilot",
        recommendation_reason="覆盖主要风险",
        dissent=["兵部认为市场窗口可能早于合同完成"],
        confidence=0.84,
        human_confirmation_required=True,
        source_label="LIVE",
    )
    assert advice.recommended_option_id in {o.id for o in advice.options}
