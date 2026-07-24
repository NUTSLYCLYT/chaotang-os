"""REQ-006/007：非硬需求能力仍被激活 / 未激活能力仍获正文/token/tool 必须失败。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.contracts.contract_capability import (
    CapabilityGrantV1,
    activate_capabilities,
)
from src.contracts.mission_contract import MissionContractV1, MissionGoal, MissionOutcome

_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "contract_golden_slice_r0_w02.json").read_text("utf-8")
)


def _mission() -> MissionContractV1:
    return MissionContractV1(
        mission_contract_id=_FIXTURE["mission_contract_id"],
        task_id=_FIXTURE["task_id"],
        revision=1,
        jurisdiction=_FIXTURE["jurisdiction"],
        language=_FIXTURE["language"],
        contract_type=_FIXTURE["contract_type"],
        our_role=_FIXTURE["our_role"],
        legal_question=_FIXTURE["legal_question"],
        goal=MissionGoal(**_FIXTURE["goal"]),
        constraints=_FIXTURE["constraints"],
        prohibited_actions=_FIXTURE["prohibited_actions"],
        desired_outcome=MissionOutcome(**_FIXTURE["desired_outcome"]),
        assumptions=_FIXTURE["assumptions"],
        budget_limit_minor=_FIXTURE["budget_limit_minor"],
        deadline_at=_FIXTURE["deadline_at"],
        read_scope=_FIXTURE["read_scope"],
        plan_digest=_FIXTURE["plan_digest"],
        content_digest="0" * 64,
        created_at="2026-07-21T00:00:00+00:00",
    )


def test_hard_required_capability_gets_activated_with_access() -> None:
    grants = activate_capabilities(_mission(), ["docx_ingest"])
    assert len(grants) == 1
    assert grants[0].activation_status == "ACTIVATED"
    assert grants[0].body_access is True
    assert grants[0].token_scope == ["docx_ingest"]


def test_non_hard_required_candidate_stays_not_activated() -> None:
    grants = activate_capabilities(_mission(), ["some_other_capability"])
    assert len(grants) == 1
    assert grants[0].activation_status == "NOT_ACTIVATED"
    assert grants[0].required_by_mission is False
    assert grants[0].body_access is False
    assert grants[0].token_scope == []
    assert grants[0].tool_access == []


def test_direct_construction_of_activated_without_required_by_mission_rejected() -> None:
    with pytest.raises(ValidationError):
        CapabilityGrantV1(
            capability_id="x",
            required_by_mission=False,
            activation_status="ACTIVATED",
        )


def test_not_activated_grant_with_body_access_rejected() -> None:
    with pytest.raises(ValidationError):
        CapabilityGrantV1(
            capability_id="x",
            required_by_mission=False,
            activation_status="NOT_ACTIVATED",
            body_access=True,
        )


def test_not_activated_grant_with_token_scope_rejected() -> None:
    with pytest.raises(ValidationError):
        CapabilityGrantV1(
            capability_id="x",
            required_by_mission=False,
            activation_status="NOT_ACTIVATED",
            token_scope=["some_scope"],
        )


def test_not_activated_grant_with_tool_access_rejected() -> None:
    with pytest.raises(ValidationError):
        CapabilityGrantV1(
            capability_id="x",
            required_by_mission=False,
            activation_status="NOT_ACTIVATED",
            tool_access=["some_tool"],
        )
