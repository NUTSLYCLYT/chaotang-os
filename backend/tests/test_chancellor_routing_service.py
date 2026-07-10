"""阶段1验收：ChancellorRoutingService 唯一事实源。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第14节阶段1验收标准：
- 简单任务只选择一个主责 Agent。
- 高风险任务覆盖强制部门。
- 同一幂等键不会重复立案。
- 模型不可用时仍能得到可解释的确定性路线(本服务全程确定性规则，天然满足)。
"""

from __future__ import annotations

from src.chancellor.routing_service import ChancellorRoutingService


def test_simple_task_selects_single_primary_agent(isolated_session_local):
    db = isolated_session_local()
    service = ChancellorRoutingService()
    decision = service.decide(
        db,
        task_id="task_simple",
        confirmed_edict_text="把上周和客户的沟通记录整理成一份摘要",
        idempotency_key="key_1",
    )
    db.commit()

    assert decision.mode == "direct"
    assert decision.strategy == "single_agent"
    assert len(decision.participants) == 1
    assert decision.participants[0].role == "primary"
    assert decision.human_confirmation_required is False
    db.close()


def test_high_risk_task_forces_council_and_human_confirmation(isolated_session_local):
    db = isolated_session_local()
    service = ChancellorRoutingService()
    decision = service.decide(
        db,
        task_id="task_risk",
        confirmed_edict_text="对方要求股权对赌，独家合作三年，是否同意",
        idempotency_key="key_1",
    )
    db.commit()

    assert decision.mode == "council"
    assert decision.human_confirmation_required is True
    assert "股权风险" in decision.risk_flags
    assert any(dept.department == "刑部" for dept in decision.participants)
    db.close()


def test_same_idempotency_key_does_not_duplicate_decision(isolated_session_local):
    from src.db.models import ChancellorRouteDecision

    db = isolated_session_local()
    service = ChancellorRoutingService()

    first = service.decide(
        db,
        task_id="task_dup",
        confirmed_edict_text="草拟一份内部通知",
        idempotency_key="same-key",
    )
    db.commit()

    second = service.decide(
        db,
        task_id="task_dup",
        confirmed_edict_text="草拟一份完全不同的正文，理论上不应该影响幂等结果",
        idempotency_key="same-key",
    )
    db.commit()

    assert first.decision_id == second.decision_id
    rows = (
        db.query(ChancellorRouteDecision)
        .filter_by(task_id="task_dup", idempotency_key="same-key")
        .all()
    )
    assert len(rows) == 1
    db.close()


def test_different_idempotency_key_creates_new_decision(isolated_session_local):
    db = isolated_session_local()
    service = ChancellorRoutingService()

    first = service.decide(
        db,
        task_id="task_reroute",
        confirmed_edict_text="草拟一份内部通知",
        idempotency_key="key_a",
    )
    db.commit()

    second = service.decide(
        db,
        task_id="task_reroute",
        confirmed_edict_text="草拟一份内部通知",
        idempotency_key="key_b",
        supersedes_decision_id=first.decision_id,
    )
    db.commit()

    assert first.decision_id != second.decision_id
    assert second.supersedes_decision_id == first.decision_id
    db.close()


def test_decision_reroutes_by_final_confirmed_text_not_raw_question(
    isolated_session_local,
):
    """收敛的核心目的：路由必须依据最终确认正文，不是原始问题——
    验证同一 task_id 换一个措辞完全不同的最终正文(不同idempotency_key)，
    路由结果会跟着变，而不是固定死在起草时的判断。"""
    db = isolated_session_local()
    service = ChancellorRoutingService()

    light_decision = service.decide(
        db,
        task_id="task_reword",
        confirmed_edict_text="简单总结一下上次会议纪要",
        idempotency_key="v1",
    )
    db.commit()

    heavy_decision = service.decide(
        db,
        task_id="task_reword",
        confirmed_edict_text="这份合同涉及股权对赌和独家承诺，是否可以签字",
        idempotency_key="v2",
        supersedes_decision_id=light_decision.decision_id,
    )
    db.commit()

    assert light_decision.mode == "direct"
    assert heavy_decision.mode == "council"
    db.close()
