"""REQ-017：一个状态字段承载多个正交语义必须失败——四轴独立，无 status 字段。"""

from __future__ import annotations

import itertools

import pytest
from pydantic import ValidationError

from src.contracts.contract_lineage import ContractLineageStatusV1


def _lineage(**overrides: object) -> ContractLineageStatusV1:
    base = dict(
        lineage_id="lineage-1",
        mission_contract_id="mission-1",
        revision=1,
        supersedes_revision=None,
        content_digest="a" * 64,
        mission_status="DRAFT",
        support_status="SUPPORTED",
        capability_activation_status="NOT_ACTIVATED",
        decision_status="NOT_DECIDED",
    )
    base.update(overrides)
    return ContractLineageStatusV1(**base)


def test_no_status_field_exists_structurally() -> None:
    assert "status" not in ContractLineageStatusV1.model_fields


def test_four_axes_are_independently_settable() -> None:
    mission_statuses = ["DRAFT", "AWAITING_CONFIRMATION", "CONFIRMED", "SUPERSEDED", "EXPIRED"]
    support_statuses = ["SUPPORTED", "DECLINED"]
    capability_statuses = ["NOT_ACTIVATED", "ACTIVATED"]
    decision_statuses = ["NOT_DECIDED", "DECIDED"]

    combos = 0
    for mission_status, support_status, capability_status, decision_status in itertools.product(
        mission_statuses, support_statuses, capability_statuses, decision_statuses
    ):
        if decision_status == "DECIDED" and mission_status != "CONFIRMED":
            continue  # cross-axis rule forbids this combination, tested separately below
        _lineage(
            mission_status=mission_status,
            support_status=support_status,
            capability_activation_status=capability_status,
            decision_status=decision_status,
        )
        combos += 1
    assert combos > 0


def test_decided_without_confirmed_mission_rejected() -> None:
    with pytest.raises(ValidationError):
        _lineage(mission_status="DRAFT", decision_status="DECIDED")


def test_decided_with_confirmed_mission_accepted() -> None:
    lineage = _lineage(mission_status="CONFIRMED", decision_status="DECIDED")
    assert lineage.decision_status == "DECIDED"


def test_supersedes_revision_must_be_less_than_revision() -> None:
    with pytest.raises(ValidationError):
        _lineage(revision=2, supersedes_revision=2)


def test_supersedes_revision_less_than_revision_accepted() -> None:
    lineage = _lineage(revision=2, supersedes_revision=1)
    assert lineage.supersedes_revision == 1
