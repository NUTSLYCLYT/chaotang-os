from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.orm import Session

from src.contracts.contract_lineage_identity import ContractLineageIdentityV1
from src.contracts.mission_contract import (
    MissionContractV1,
    compute_mission_content_digest,
)
from src.db.models import CourtLoopRun, DecisionTask

MISSION_LOOP_ID = "contract-mission-v1"
MissionSnapshotState = Literal["draft", "confirmed"]


class MissionBindingConflict(ValueError):
    pass


@dataclass(frozen=True)
class PersistedMissionSnapshot:
    row_id: str
    mission: MissionContractV1
    state: MissionSnapshotState


def _snapshot_from_row(
    row: CourtLoopRun,
    *,
    task: DecisionTask,
) -> PersistedMissionSnapshot:
    try:
        mission = MissionContractV1.model_validate_json(row.output_json or "")
    except Exception as exc:  # noqa: BLE001
        raise MissionBindingConflict("invalid persisted mission snapshot") from exc
    try:
        _lineage_identity(task=task, mission=mission)
    except ValueError as exc:
        raise MissionBindingConflict("persisted mission/task binding mismatch") from exc
    if row.status not in {"draft", "confirmed"}:
        raise MissionBindingConflict("invalid persisted mission state")
    if compute_mission_content_digest(mission) != mission.content_digest:
        raise MissionBindingConflict("persisted mission content_digest mismatch")
    return PersistedMissionSnapshot(
        row_id=row.id,
        mission=mission,
        state=row.status,
    )


def _snapshots(db: Session, *, task: DecisionTask) -> list[PersistedMissionSnapshot]:
    rows = (
        db.query(CourtLoopRun)
        .filter_by(task_id=task.id, loop_id=MISSION_LOOP_ID)
        .order_by(CourtLoopRun.created_at.asc(), CourtLoopRun.id.asc())
        .all()
    )
    return [_snapshot_from_row(row, task=task) for row in rows]


def load_current_mission_snapshot(
    db: Session,
    *,
    task: DecisionTask,
) -> PersistedMissionSnapshot | None:
    snapshots = _snapshots(db, task=task)
    if not snapshots:
        return None
    current_revision = max(item.mission.revision for item in snapshots)
    current = [
        item for item in snapshots if item.mission.revision == current_revision
    ]
    current_digests = {item.mission.content_digest for item in current}
    if len(current_digests) != 1:
        raise MissionBindingConflict(
            "incompatible current mission snapshots"
        )
    confirmed = [item for item in current if item.state == "confirmed"]
    return (confirmed or current)[-1]


def save_mission_snapshot(
    db: Session,
    *,
    task: DecisionTask,
    mission: MissionContractV1,
    state: MissionSnapshotState,
) -> PersistedMissionSnapshot:
    try:
        _lineage_identity(task=task, mission=mission)
    except ValueError as exc:
        raise MissionBindingConflict(
            "mission task_id and mission_contract_id must equal DecisionTask.id for R0"
        ) from exc

    candidate = mission.model_copy(
        update={"content_digest": compute_mission_content_digest(mission)}
    )
    current = load_current_mission_snapshot(db, task=task)
    if current is not None:
        if candidate.revision < current.mission.revision:
            raise MissionBindingConflict("stale revision cannot replace current mission")
        if candidate.revision == current.mission.revision:
            if candidate.content_digest != current.mission.content_digest:
                raise MissionBindingConflict(
                    "mission revision has a conflicting content_digest"
                )
            if current.state == "confirmed" or current.state == state:
                return current

    now = datetime.now(timezone.utc).isoformat()
    identity = json.dumps(
        {
            "task_id": task.id,
            "revision": candidate.revision,
            "content_digest": candidate.content_digest,
            "state": state,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    row_id = f"mission-{hashlib.sha256(identity.encode('utf-8')).hexdigest()[:32]}"
    row = CourtLoopRun(
        id=row_id,
        task_id=task.id,
        loop_id=MISSION_LOOP_ID,
        status=state,
        input_json=json.dumps(
            {
                "schema_version": "MissionSnapshotCommandV1",
                "mission_contract_id": candidate.mission_contract_id,
                "revision": candidate.revision,
                "content_digest": candidate.content_digest,
            },
            sort_keys=True,
            separators=(",", ":"),
        ),
        output_json=candidate.model_dump_json(),
        trace_id=row_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return PersistedMissionSnapshot(row_id=row.id, mission=candidate, state=state)


def _lineage_identity(
    *,
    task: DecisionTask,
    mission: MissionContractV1,
) -> ContractLineageIdentityV1:
    if task.tenant_id is None or mission.task_id != task.id:
        raise ValueError("task lineage is incomplete")
    return ContractLineageIdentityV1(
        tenant_id=task.tenant_id,
        task_id=task.id,
        mission_contract_id=mission.mission_contract_id,
    )
