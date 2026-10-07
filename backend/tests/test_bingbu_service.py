from datetime import UTC, datetime, timedelta

import pytest

from app.bingbu.models import ActionDraftRequest, ImportRequest, OpportunityStage
from app.bingbu.service import BingbuInputError, BingbuService
from app.bingbu.storage import BingbuStore


def _csv(next_action="确认决策人"):
    due = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    return (
        "id,account_name,stage,amount,next_action,next_action_owner,next_action_due_at,source_ref\n"
        f"opp-1,北辰科技,discovery,100000,{next_action},user-1,{due},fixture:1\n"
    )


def test_preview_reports_row_level_errors():
    service = BingbuService(store=BingbuStore())
    result = service.preview_import(
        "user-1", ImportRequest(filename="sales.csv", content=_csv(next_action=""))
    )
    assert result.row_count == 1
    assert result.rejected_count == 1
    assert result.errors[0].row == 2


def test_commit_is_owner_scoped_and_idempotent():
    service = BingbuService(store=BingbuStore())
    request = ImportRequest(filename="sales.csv", content=_csv())
    first = service.commit_import("user-1", request)
    second = service.commit_import("user-1", request)
    assert first.id == second.id
    assert service.overview("user-1").priority_opportunities[0].owner_user_id == "user-1"
    assert service.overview("user-2").priority_opportunities == []


def test_war_room_degrades_without_evidence_and_action_draft_cannot_execute():
    service = BingbuService(store=BingbuStore())
    service.commit_import("user-1", ImportRequest(filename="sales.csv", content=_csv()))
    packet, draft = service.create_war_room("user-1", "opp-1")
    assert packet.status == "degraded"
    assert packet.evidence_gaps
    assert draft.execution_state == "NOT_EXECUTED"
    assert draft.request_id == packet.request_id
    assert draft.trace_id == packet.trace_id
    approved = service.approve_action_draft("user-1", draft.id)
    assert approved.approval_state.value == "APPROVED_PENDING_EXECUTION"
    assert approved.execution_state == "NOT_EXECUTED"


def test_malformed_json_fails_closed_and_action_drafts_are_idempotent():
    service = BingbuService(store=BingbuStore())
    with pytest.raises(BingbuInputError):
        service.preview_import(
            "user-1",
            ImportRequest(
                filename="sales.json", source_type="json", content="{"
            ),
        )
    service.commit_import("user-1", ImportRequest(filename="sales.csv", content=_csv()))
    packet, _ = service.create_war_room("user-1", "opp-1")
    request = ActionDraftRequest(
        decision_packet_id=packet.id,
        action_type="customer_follow_up",
        payload={"opportunity_id": "opp-1"},
        idempotency_key="stable-follow-up-1",
    )
    first = service.create_action_draft("user-1", request)
    second = service.create_action_draft("user-1", request)
    assert first.id == second.id
    assert service.reject_action_draft("user-1", first.id).approval_state.value == "REJECTED"
    assert service.approve_action_draft("user-1", first.id).approval_state.value == "REJECTED"


def test_opportunity_list_filters_owner_scoped_facts():
    service = BingbuService(store=BingbuStore())
    service.commit_import("user-1", ImportRequest(filename="sales.csv", content=_csv()))
    assert [
        item.stage
        for item in service.list_opportunities(
            "user-1", stage=OpportunityStage.DISCOVERY
        )
    ] == [OpportunityStage.DISCOVERY]
    assert service.list_opportunities("user-1", stage=OpportunityStage.NEGOTIATION) == []
