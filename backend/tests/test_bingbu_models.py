from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.bingbu.models import Opportunity, OpportunityStage


def _row(**overrides):
    value = {
        "id": "opp-1",
        "account_name": "北辰科技",
        "owner_user_id": "user-1",
        "stage": OpportunityStage.DISCOVERY,
        "amount": 100000,
        "source_ref": "fixture:1",
        "next_action": "确认决策人",
        "next_action_owner": "user-1",
        "next_action_due_at": datetime.now(UTC),
    }
    value.update(overrides)
    return value


def test_active_opportunity_requires_one_complete_next_action():
    with pytest.raises(ValidationError):
        Opportunity(**_row(next_action=None))


def test_negative_amount_is_rejected():
    with pytest.raises(ValidationError):
        Opportunity(**_row(amount=-1))


def test_closed_opportunity_may_have_no_next_action():
    value = Opportunity(
        **_row(
            stage=OpportunityStage.WON,
            next_action=None,
            next_action_owner=None,
            next_action_due_at=None,
        )
    )
    assert value.stage is OpportunityStage.WON


def test_evidence_keeps_stance_as_structured_provenance():
    value = Opportunity(
        **_row(
            evidence=[
                {
                    "id": "evidence-1",
                    "claim": "客户确认采购窗口",
                    "source_type": "activity",
                    "source_ref": "fixture:activity-1",
                    "observed_at": datetime.now(UTC),
                    "freshness": "fresh",
                    "stance": "supporting",
                    "quality": "high",
                    "confidence": "medium",
                }
            ],
        )
    )
    assert value.evidence[0].stance == "supporting"
