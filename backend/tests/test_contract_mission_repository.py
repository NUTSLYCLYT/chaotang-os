from __future__ import annotations

import json

import pytest

from src.contract_mission_repository import (
    MISSION_LOOP_ID,
    MissionBindingConflict,
    load_current_mission_snapshot,
    save_mission_snapshot,
)
from src.contracts.mission_contract import (
    MissionContractV1,
    MissionGoal,
    MissionOutcome,
    compute_mission_content_digest,
)
from src.db.models import CourtLoopRun, DecisionTask


def _task(task_id: str = "task-mission-1") -> DecisionTask:
    return DecisionTask(
        id=task_id,
        tenant_id=1,
        user_id="1",
        raw_question="审查采购合同",
        status="awaiting_emperor_confirm",
        source_label="LIVE",
    )


def _mission(
    task_id: str = "task-mission-1",
    *,
    mission_contract_id: str | None = None,
    revision: int = 1,
    concern: str = "违约责任",
) -> MissionContractV1:
    candidate = MissionContractV1(
        mission_contract_id=mission_contract_id or task_id,
        task_id=task_id,
        revision=revision,
        jurisdiction="CN_MAINLAND",
        language="zh-CN",
        contract_type="procurement",
        our_role="buyer",
        legal_question="contract_risk_screening",
        goal=MissionGoal(user_intent="完成采购合同审查", biggest_concern=concern),
        constraints=["不改变商业价格"],
        prohibited_actions=["不得伪造证据"],
        desired_outcome=MissionOutcome(required_artifacts=["PDF", "DOCX", "JSON"]),
        assumptions=["合同文本完整"],
        budget_limit_minor=0,
        deadline_at="2026-08-01T00:00:00+00:00",
        read_scope=["contract:source:v1"],
        plan_digest="a" * 64,
        content_digest="0" * 64,
        created_at="2026-07-27T00:00:00+00:00",
    )
    return candidate.model_copy(
        update={"content_digest": compute_mission_content_digest(candidate)}
    )


def test_snapshot_survives_a_new_database_session(isolated_session_local) -> None:
    with isolated_session_local() as db:
        task = _task()
        db.add(task)
        db.flush()
        saved = save_mission_snapshot(db, task=task, mission=_mission(), state="draft")
        db.commit()
        assert saved.state == "draft"

    with isolated_session_local() as db:
        task = db.get(DecisionTask, "task-mission-1")
        loaded = load_current_mission_snapshot(db, task=task)

    assert loaded.mission.mission_contract_id == "task-mission-1"
    assert loaded.mission.revision == 1
    assert loaded.state == "draft"


def test_binding_rejects_a_mission_id_that_differs_from_the_task(
    isolated_session_local,
) -> None:
    with isolated_session_local() as db:
        task = _task()
        db.add(task)
        db.flush()

        with pytest.raises(MissionBindingConflict, match="mission_contract_id"):
            save_mission_snapshot(
                db,
                task=task,
                mission=_mission(mission_contract_id="mission-other"),
                state="draft",
            )


def test_identical_revision_and_digest_replay_is_idempotent(
    isolated_session_local,
) -> None:
    with isolated_session_local() as db:
        task = _task()
        mission = _mission()
        db.add(task)
        db.flush()

        first = save_mission_snapshot(db, task=task, mission=mission, state="draft")
        second = save_mission_snapshot(db, task=task, mission=mission, state="draft")
        db.commit()

        row_count = (
            db.query(CourtLoopRun)
            .filter_by(task_id=task.id, loop_id=MISSION_LOOP_ID)
            .count()
        )

    assert first.row_id == second.row_id
    assert row_count == 1


def test_save_mission_snapshot_locks_task_before_reading_current_revision(
    isolated_session_local,
    monkeypatch,
) -> None:
    import src.contract_mission_repository as repository
    import src.decision_task_access as task_access

    events: list[str] = []
    original_load = repository.load_current_mission_snapshot

    monkeypatch.setattr(
        task_access,
        "lock_decision_task",
        lambda _db, _task_id: events.append("lock"),
        raising=False,
    )

    def _observed_load(db, *, task):
        events.append("load")
        return original_load(db, task=task)

    monkeypatch.setattr(repository, "load_current_mission_snapshot", _observed_load)

    with isolated_session_local() as db:
        task = _task("task-mission-lock-order")
        db.add(task)
        db.flush()
        save_mission_snapshot(
            db,
            task=task,
            mission=_mission("task-mission-lock-order"),
            state="draft",
        )

    assert events[:2] == ["lock", "load"]


def test_stale_revision_cannot_replace_the_current_snapshot(
    isolated_session_local,
) -> None:
    with isolated_session_local() as db:
        task = _task()
        current = _mission(revision=2, concern="责任上限")
        stale = _mission(revision=1, concern="旧版责任")
        db.add(task)
        db.flush()
        save_mission_snapshot(db, task=task, mission=current, state="draft")

        with pytest.raises(MissionBindingConflict, match="stale revision"):
            save_mission_snapshot(db, task=task, mission=stale, state="draft")

        loaded = load_current_mission_snapshot(db, task=task)

    assert loaded.mission.revision == 2
    assert loaded.mission.goal.biggest_concern == "责任上限"


def test_incompatible_rows_at_the_current_revision_fail_closed(
    isolated_session_local,
) -> None:
    mission_a = _mission(concern="付款")
    mission_b = _mission(concern="知识产权")
    with isolated_session_local() as db:
        task = _task()
        db.add(task)
        db.flush()
        for index, mission in enumerate((mission_a, mission_b), start=1):
            db.add(
                CourtLoopRun(
                    id=f"mission-row-{index}",
                    task_id=task.id,
                    loop_id=MISSION_LOOP_ID,
                    status="draft",
                    input_json="{}",
                    output_json=json.dumps(mission.model_dump(mode="json")),
                    trace_id=f"mission-row-{index}",
                )
            )
        db.commit()

        with pytest.raises(MissionBindingConflict, match="incompatible current"):
            load_current_mission_snapshot(db, task=task)
