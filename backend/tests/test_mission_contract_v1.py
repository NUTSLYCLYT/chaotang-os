"""REQ-004：目标/约束/禁止动作/成果字段可缺必须失败——键必须在，值可以空，但键不能省。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.contracts.mission_contract import (
    MissionContractV1,
    MissionGoal,
    MissionOutcome,
    compute_mission_content_digest,
)

_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "contract_golden_slice_r0_w02.json").read_text("utf-8")
)


def _mission(**overrides: object) -> MissionContractV1:
    base = dict(
        mission_contract_id=_FIXTURE["mission_contract_id"],
        task_id=_FIXTURE["task_id"],
        revision=1,
        jurisdiction=_FIXTURE["jurisdiction"],
        language=_FIXTURE["language"],
        contract_type=_FIXTURE["contract_type"],
        our_role=_FIXTURE["our_role"],
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
    base.update(overrides)
    return MissionContractV1(**base)


def test_golden_slice_round_trips() -> None:
    mission = _mission()
    dumped = mission.model_dump()
    assert MissionContractV1(**dumped) == mission


def test_empty_constraints_list_is_valid_explicit_zero_constraints() -> None:
    mission = _mission(constraints=[], prohibited_actions=[])
    assert mission.constraints == []
    assert mission.prohibited_actions == []


@pytest.mark.parametrize("field", ["goal", "constraints", "prohibited_actions", "desired_outcome"])
def test_missing_key_rejected_not_silently_defaulted(field: str) -> None:
    base = dict(
        mission_contract_id=_FIXTURE["mission_contract_id"],
        task_id=_FIXTURE["task_id"],
        revision=1,
        jurisdiction=_FIXTURE["jurisdiction"],
        language=_FIXTURE["language"],
        contract_type=_FIXTURE["contract_type"],
        our_role=_FIXTURE["our_role"],
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
    del base[field]
    with pytest.raises(ValidationError):
        MissionContractV1(**base)


def test_compute_content_digest_is_stable_and_excludes_self_referential_fields() -> None:
    mission_a = _mission(mission_contract_id="mission-a", revision=1)
    mission_b = _mission(mission_contract_id="mission-b", revision=99)
    assert compute_mission_content_digest(mission_a) == compute_mission_content_digest(mission_b)


def test_compute_content_digest_changes_when_goal_changes() -> None:
    mission_a = _mission()
    mission_b = _mission(goal=MissionGoal(user_intent="换一个意图", biggest_concern="换一个担心"))
    assert compute_mission_content_digest(mission_a) != compute_mission_content_digest(mission_b)
