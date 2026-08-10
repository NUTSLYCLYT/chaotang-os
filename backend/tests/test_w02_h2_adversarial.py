"""R0-W02 H2 adversarial regressions; these must fail before the remediation."""

from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from src.contracts.contract_capability import activate_capabilities
from src.contracts.contract_decision import ContractDecisionV1
from src.contracts.mission_contract import (
    MissionContractV1,
    MissionGoal,
    MissionOutcome,
    compute_mission_content_digest,
)
from src.db.models import DecisionTask


def _mission(*, task_id: str = "task-a", required_artifacts: list[str] | None = None, **overrides) -> MissionContractV1:
    values = dict(
        mission_contract_id=task_id,
        task_id=task_id,
        revision=1,
        jurisdiction="CN_MAINLAND",
        language="zh-CN",
        contract_type="procurement",
        our_role="buyer",
        legal_question="contract_risk_screening",
        goal=MissionGoal(user_intent="buy", biggest_concern="risk"),
        constraints=[],
        prohibited_actions=[],
        desired_outcome=MissionOutcome(required_artifacts=required_artifacts or ["DOCX"]),
        assumptions=["input is complete"],
        budget_limit_minor=100000,
        deadline_at="2026-12-31T00:00:00+00:00",
        read_scope=["contract:source:v1"],
        plan_digest="a" * 64,
        content_digest="0" * 64,
        created_at="2026-07-21T00:00:00+00:00",
    )
    values.update(overrides)
    return MissionContractV1(**values)


def _seed_task(
    isolated_session_local,
    *,
    task_id: str = "task-a",
    tenant_id: int = 1,
    user_id: str = "tenant-a",
) -> None:
    with isolated_session_local() as db:
        db.add(
            DecisionTask(
                id=task_id,
                tenant_id=tenant_id,
                user_id=user_id,
                raw_question="test contract",
                status="awaiting_emperor_confirm",
                source_label="LIVE",
            )
        )
        db.commit()


def test_mission_digest_binds_task_identity() -> None:
    assert compute_mission_content_digest(_mission(task_id="task-a")) != compute_mission_content_digest(
        _mission(task_id="task-b")
    )


def test_unsupported_mission_cannot_be_drafted_as_supported(
    isolated_session_local,
) -> None:
    from web.routers import contracts
    from web.schemas.auth import CurrentUser
    from web.schemas.contracts import MissionConfirmRequest

    _seed_task(isolated_session_local)
    unsupported = _mission(jurisdiction="UNSUPPORTED_OR_UNKNOWN")
    drafted = contracts.draft_mission_contract(
        unsupported,
        CurrentUser(tenant_slug="tenant-a", tenant_id=1),
    )
    lineage = contracts.confirm_mission_contract(
        "task-a",
        MissionConfirmRequest(
            revision=drafted.revision,
            content_digest=drafted.content_digest,
        ),
        CurrentUser(tenant_slug="tenant-a", tenant_id=1),
    )
    assert lineage.support_status == "DECLINED"


def test_tenant_cannot_confirm_another_tenants_mission(
    isolated_session_local,
) -> None:
    from fastapi import HTTPException

    from web.routers import contracts
    from web.schemas.auth import CurrentUser
    from web.schemas.contracts import MissionConfirmRequest

    _seed_task(isolated_session_local)
    mission = _mission()
    contracts.draft_mission_contract(mission, CurrentUser(tenant_slug="tenant-a", tenant_id=1))
    with pytest.raises(HTTPException) as exc:
        contracts.confirm_mission_contract(
            "task-a",
            MissionConfirmRequest(revision=1, content_digest=compute_mission_content_digest(mission)),
            CurrentUser(tenant_slug="tenant-b", tenant_id=2),
        )
    assert exc.value.status_code == 404


def test_capabilities_are_derived_from_required_artifacts() -> None:
    grants = activate_capabilities(_mission(required_artifacts=["PDF"]), ["docx_ingest"])
    assert all(grant.activation_status != "ACTIVATED" for grant in grants)


@pytest.mark.parametrize(
    "narrative",
    ["APPROVED TO SIGN", "Approved To Sign", "approved to sign"],
)
def test_decision_rejects_case_variants_of_signoff_language(narrative: str) -> None:
    with pytest.raises(ValidationError):
        ContractDecisionV1(
            mission_contract_id="mission-1",
            final_memorial_id="memorial-1",
            content_hash="a" * 64,
            verdict="PROCEED_TO_HUMAN_APPROVAL",
            verdict_narrative=narrative,
            decided_at="2026-07-21T00:00:00+00:00",
        )


def test_decision_rejects_non_sha256_hash_and_invalid_timestamp() -> None:
    with pytest.raises(ValidationError):
        ContractDecisionV1(
            mission_contract_id="mission-1",
            final_memorial_id="memorial-1",
            content_hash="g" * 64,
            verdict="BLOCKED",
            verdict_narrative="需要补充证据",
            decided_at="not-a-date",
        )
