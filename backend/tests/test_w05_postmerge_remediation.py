"""Post-merge REDs for the independently reviewed R0-W05 contract gaps."""

from __future__ import annotations

import hashlib
import importlib
import json
import threading
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.db.models import Base
from web.main import app

_SUPPORTED_SCOPE = {
    "schema_version": "ContractIntakeV1",
    "jurisdiction": "CN_MAINLAND",
    "language": "zh-CN",
    "contract_type": "procurement",
    "our_role": "buyer",
    "legal_question": "contract_risk_screening",
}


@dataclass
class _ProjectionEvent:
    status: str
    payload_json: str | None
    last_error: str | None = None
    id: str = "legacy-generation-2"
    generation: int | None = 2


def _formalize_task(session_local, task_id: str, storage_root) -> tuple[str, str]:
    from src.contract_mission_repository import save_mission_snapshot
    from src.db.models import CourtReview, DecisionTask
    from src.formal_memorial import formalize_memorial
    from tests.contract_task_support import (
        contract_mission,
        contract_review_pack,
        seed_delivery,
    )

    db = session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    task.status = "awaiting_decision"
    task.contract_scope_json = json.dumps(_SUPPORTED_SCOPE)
    review_id = f"review_{task_id}"
    pack = contract_review_pack(
        task_id,
        tenant_id=str(task.tenant_id),
        court_review_id=review_id,
    )
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=task.tenant_id,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="awaiting_decision",
            ministry_outputs_json='[{"department":"刑部","conclusion":"有条件通过"}]',
            conflict_summary_json="[]",
            memorial_json=json.dumps(
                {
                    "title": "合同会审正式奏折",
                    "summary": "证据充分，建议有条件通过。",
                    "recommendation": "adopt_with_conditions",
                    "contract_review": pack,
                },
                ensure_ascii=False,
            ),
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.flush()
    save_mission_snapshot(
        db,
        task=task,
        mission=contract_mission(task_id),
        state="confirmed",
    )
    formal = formalize_memorial(
        db,
        task_id=task_id,
        review_id=review_id,
        swarm_result={
            "swarm_run": {
                "id": f"run_{task_id}",
                "task_id": task_id,
                "review_id": review_id,
                "source_label": "LIVE_SWARM",
            },
            "quality_result": {
                "id": f"quality_{task_id}",
                "passed": True,
                "blocking_reasons": [],
                "warnings": [],
            },
        },
    )
    db.flush()
    seed_delivery(
        db,
        storage_root=storage_root,
        tenant_id=task.tenant_id,
        task_id=task_id,
        final=formal,
        pack=pack,
    )
    content_hash = formal.content_hash
    db.commit()
    db.close()
    return content_hash, review_id


def _draft_contract_task(client: TestClient) -> str:
    response = client.post(
        "/api/shangshufang/draft-edict",
        json={
            "raw_question": "请复核这份采购合同的付款、验收和责任风险。",
            "contract_scope": _SUPPORTED_SCOPE,
        },
    )
    assert response.status_code == 200, response.json()
    payload = response.json()
    assert payload["success"] is True, payload
    return payload["data"]["task_id"]


def _request_evidence(client: TestClient, task_id: str, content_hash: str) -> dict:
    response = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "request_evidence",
            "reason": "补充付款条件原文",
            "human_confirmed": True,
            "expected_final_memorial_content_hash": content_hash,
        },
    )
    assert response.status_code == 200, response.json()
    payload = response.json()
    assert payload["success"] is True, payload
    return payload


def test_draft_edict_freezes_contract_scope_on_canonical_task(
    isolated_session_local,
):
    client = TestClient(app)
    task_id = _draft_contract_task(client)

    from src.db.models import DecisionTask

    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    assert task.contract_scope_json is not None
    assert json.loads(task.contract_scope_json) == _SUPPORTED_SCOPE
    db.close()

    status = client.get(f"/api/shangshufang/tasks/{task_id}/status").json()
    assert status["success"] is True, status
    assert status["data"]["task"]["contract_scope"] == _SUPPORTED_SCOPE


def test_request_evidence_snapshots_frozen_scope_into_generation(
    isolated_session_local,
):
    client = TestClient(app)
    task_id = _draft_contract_task(client)

    from src.contract_mission_repository import (
        load_current_mission_snapshot,
        save_mission_snapshot,
    )
    from src.db.models import DecisionTask, OutboxEvent
    from src.execution.decree_dispatcher import (
        enqueue_evidence_rework_generation,
    )

    db = isolated_session_local()
    task = db.get(DecisionTask, task_id)
    from tests.contract_task_support import contract_mission

    save_mission_snapshot(
        db,
        task=task,
        mission=contract_mission(task_id),
        state="confirmed",
    )
    mission_snapshot = load_current_mission_snapshot(db, task=task)
    assert mission_snapshot is not None
    generation, created = enqueue_evidence_rework_generation(
        db,
        task_id=task_id,
        decision_id=f"decision_{task_id}",
        prior_final_memorial_content_hash="a" * 64,
        reason="补充付款条件原文",
        followup_question=None,
    )
    db.commit()

    assert created is True
    assert generation["contract_scope"] == _SUPPORTED_SCOPE
    assert generation["evidence_status"] == "NONE"
    assert generation["mission_revision"] == mission_snapshot.mission.revision
    assert (
        generation["mission_content_digest"]
        == mission_snapshot.mission.content_digest
    )
    stored = db.query(OutboxEvent).filter_by(id=generation["generation_id"]).one()
    stored_payload = json.loads(stored.payload_json)
    assert stored_payload["contract_scope"] == _SUPPORTED_SCOPE
    assert stored_payload["evidence_status"] == "NONE"
    assert stored_payload["mission_revision"] == mission_snapshot.mission.revision
    assert (
        stored_payload["mission_content_digest"]
        == mission_snapshot.mission.content_digest
    )
    db.close()


@pytest.mark.parametrize(
    ("durable_status", "payload_status", "expected_http", "expected_public_status"),
    [
        ("processing", "evidence_bound", 200, "pending"),
        ("completed", "candidate_ready", 200, "candidate_ready"),
        ("completed", "quality_blocked", 200, "quality_blocked"),
        ("superseded", "evidence_bound", 409, None),
    ],
)
def test_decision_replay_projects_durable_status_into_public_contract(
    isolated_session_local,
    monkeypatch,
    tmp_path,
    durable_status,
    payload_status,
    expected_http,
    expected_public_status,
):
    from src.db.models import DecisionTask, OutboxEvent

    db = isolated_session_local()
    task_id = f"task_replay_projection_{durable_status}_{payload_status}"
    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=1,
            user_id="1",
            raw_question="复核合同",
            status="awaiting_decision",
            source_label="LIVE",
        )
    )
    db.commit()
    db.close()
    monkeypatch.setenv("FENGQUN_RUNTIME_ROOT", str(tmp_path))
    content_hash, _ = _formalize_task(
        isolated_session_local,
        task_id,
        tmp_path / "artifacts",
    )

    client = TestClient(app)
    first = _request_evidence(client, task_id, content_hash)
    generation_id = first["data"]["rework_generation"]["generation_id"]
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    payload = json.loads(event.payload_json)
    payload["status"] = payload_status
    event.payload_json = json.dumps(payload)
    event.status = durable_status
    db.commit()
    db.close()

    replay = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "request_evidence",
            "reason": "补充付款条件原文",
            "human_confirmed": True,
            "expected_final_memorial_content_hash": content_hash,
        },
    )

    assert replay.status_code == expected_http
    replay_payload = replay.json()
    if expected_http == 200:
        assert replay_payload["success"] is True, replay_payload
        assert (
            replay_payload["data"]["rework_generation"]["status"]
            == expected_public_status
        )
    else:
        assert replay_payload["success"] is False, replay_payload
        assert durable_status in replay_payload["error"]


def _artifact_row(
    *,
    tmp_path,
    artifact_id: str,
    task_id: str,
    text: str,
    created_at: str,
):
    from src.db.models import SecureIngestArtifact
    from tests.fixtures.secure_ingest_fixtures import golden_docx_bytes

    raw_bytes = golden_docx_bytes(text)
    path = tmp_path / f"{artifact_id}.docx"
    path.write_bytes(raw_bytes)
    digest = hashlib.sha256(raw_bytes).hexdigest()
    return SecureIngestArtifact(
        id=artifact_id,
        tenant_id=1,
        user_id="1",
        mission_contract_id=task_id,
        original_filename="付款条件补证.docx",
        declared_content_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        detected_format="DOCX_OOXML",
        file_size_bytes=len(raw_bytes),
        page_count=1,
        digest_sha256=digest,
        status="ACCEPTED",
        ocr_status="NOT_APPLICABLE",
        macro_detected=False,
        zip_bomb_suspected=False,
        injection_flag_categories_json="[]",
        storage_path=str(path),
        created_at=created_at,
    )


def _generation_payload(
    *,
    generation_id: str,
    task_id: str,
    status: str,
    packet: dict | None = None,
    contract_scope: dict | None = _SUPPORTED_SCOPE,
    prior_final_memorial_content_hash: str = "a" * 64,
) -> dict:
    from tests.contract_task_support import contract_mission

    mission = contract_mission(task_id)
    payload = {
        "schema_version": "EvidenceReworkGenerationV1",
        "generation_id": generation_id,
        "generation": 2,
        "status": status,
        "prior_final_memorial_content_hash": prior_final_memorial_content_hash,
        "mission_revision": mission.revision,
        "mission_content_digest": mission.content_digest,
        "evidence_request": {
            "reason": "补充付款条件原文",
            "followup_question": None,
        },
        "affected_sections": ["contract_review"],
    }
    if contract_scope is not None:
        payload["contract_scope"] = contract_scope
    if packet is not None:
        payload["evidence_packets"] = [packet]
    return payload


@pytest.mark.parametrize(
    ("durable_status", "payload_status"),
    [
        ("processing", "candidate_ready"),
        ("completed", "evidence_bound"),
        ("unknown_worker_state", "pending"),
    ],
)
def test_generation_projection_rejects_illegal_durable_domain_pairs(
    durable_status,
    payload_status,
):
    from src.evidence_rework_projection import project_evidence_rework_generation

    event = _ProjectionEvent(
        status=durable_status,
        payload_json=json.dumps(
            _generation_payload(
                generation_id="generation_projection_invariant",
                task_id="task_projection_invariant",
                status=payload_status,
            )
        ),
    )

    with pytest.raises(RuntimeError, match="invariant"):
        project_evidence_rework_generation(event)


def test_generation_projection_treats_invalid_payload_as_server_invariant() -> None:
    from src.evidence_rework_projection import project_evidence_rework_generation

    with pytest.raises(RuntimeError, match="invalid payload"):
        project_evidence_rework_generation(
            _ProjectionEvent(status="pending", payload_json="{}")
        )


def test_projection_quarantines_parent_valid_payload_without_mission_identity():
    from src.evidence_rework_projection import (
        EvidenceReworkUnavailable,
        project_evidence_rework_generation,
    )

    with pytest.raises(EvidenceReworkUnavailable, match="mission identity"):
        project_evidence_rework_generation(
            _ProjectionEvent(
                status="pending",
                payload_json=json.dumps(
                    {
                        "schema_version": "EvidenceReworkGenerationV1",
                        "generation_id": "legacy-generation-2",
                        "generation": 2,
                        "status": "pending",
                        "prior_final_memorial_content_hash": "a" * 64,
                        "evidence_request": {
                            "reason": "父版本生成的合法补证请求",
                            "followup_question": None,
                        },
                        "affected_sections": ["contract_review"],
                    }
                ),
            )
        )


def test_generation_projection_reports_authoritative_terminal_state() -> None:
    from src.evidence_rework_projection import (
        EvidenceReworkUnavailable,
        project_evidence_rework_generation,
    )

    with pytest.raises(EvidenceReworkUnavailable, match="dead_letter"):
        project_evidence_rework_generation(
            _ProjectionEvent(
                status="dead_letter",
                payload_json="{}",
                last_error="document parser failed",
            )
        )


@pytest.mark.parametrize(
    ("dialect_name", "expected_statements"),
    [
        (
            "postgresql",
            ["LOCK TABLE secure_ingest_artifacts IN SHARE MODE"],
        ),
        ("sqlite", []),
    ],
)
def test_artifact_version_publication_lock_matches_supported_dialect(
    dialect_name,
    expected_statements,
):
    from types import SimpleNamespace

    from src.contract_rework import _lock_evidence_version_publication

    class _Database:
        def __init__(self):
            self.statements: list[str] = []

        def get_bind(self):
            return SimpleNamespace(
                dialect=SimpleNamespace(name=dialect_name)
            )

        def execute(self, statement):
            self.statements.append(str(statement))

    db = _Database()
    _lock_evidence_version_publication(db)
    assert db.statements == expected_statements


def test_artifact_version_publication_lock_fails_closed_for_unknown_dialect():
    from types import SimpleNamespace

    from src.contract_rework import _lock_evidence_version_publication

    class _Database:
        def get_bind(self):
            return SimpleNamespace(
                dialect=SimpleNamespace(name="unknown-db")
            )

    with pytest.raises(RuntimeError, match="unsupported"):
        _lock_evidence_version_publication(_Database())


def _seed_binding_generation(
    session_local,
    *,
    tmp_path,
    task_id: str,
    durable_status: str = "awaiting_evidence",
    payload_status: str = "awaiting_evidence",
    with_bound_packet: bool = False,
):
    from src.contract_mission_repository import save_mission_snapshot
    from src.db.models import (
        CourtReview,
        DecisionTask,
        FinalMemorial,
        OutboxEvent,
        SecureIngestArtifact,
        SecureIngestAuditEvent,
    )
    from tests.contract_task_support import (
        contract_mission,
        contract_review_pack,
    )

    db = session_local()
    artifact = _artifact_row(
        tmp_path=tmp_path,
        artifact_id=f"artifact_{task_id}",
        task_id=task_id,
        text="付款应在验收完成后七日内支付。",
        created_at="2026-07-24T00:01:00+00:00",
    )
    task = DecisionTask(
        id=task_id,
        tenant_id=1,
        user_id="1",
        raw_question="复核采购合同",
        status="awaiting_evidence",
        source_label="LIVE",
        contract_scope_json=json.dumps(
            {
                "schema_version": "ContractIntakeV1",
                "jurisdiction": "CN_MAINLAND",
                "language": "zh-CN",
                "contract_type": "procurement",
                "our_role": "buyer",
                "legal_question": "contract_risk_screening",
            }
        )
    )
    db.add(task)
    db.flush()
    review_id = f"review_{task_id}"
    mission = contract_mission(task_id)
    pack = contract_review_pack(
        task_id,
        tenant_id="1",
        court_review_id=review_id,
    )
    memorial_json = json.dumps(
        {"contract_review": pack},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    prior_final_hash = hashlib.sha256(memorial_json.encode("utf-8")).hexdigest()
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=1,
            task_id=task_id,
            routing_plan_json="{}",
            review_status="awaiting_evidence",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json=memorial_json,
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.add(
        FinalMemorial(
            id=f"final_{task_id}",
            tenant_id=1,
            task_id=task_id,
            review_id=review_id,
            swarm_run_id=f"swarm_{task_id}",
            quality_result_id=f"quality_{task_id}",
            status="awaiting_evidence",
            source_label="LIVE",
            memorial_json=memorial_json,
            content_hash=prior_final_hash,
            version=1,
            is_current=True,
        )
    )
    save_mission_snapshot(
        db,
        task=task,
        mission=mission,
        state="confirmed",
    )
    db.add(artifact)
    generation_id = f"generation_{task_id}"
    packet = None
    if with_bound_packet:
        receipt_id = f"audit_{task_id}"
        packet = {
            "schema_version": "EvidencePacketV1",
            "evidence_packet_id": f"evidence_{task_id}",
            "tenant_id": 1,
            "task_id": task_id,
            "input_version_id": artifact.id,
            "input_digest": artifact.digest_sha256,
            "prior_final_memorial_content_hash": prior_final_hash,
            "generation": 2,
            "evidence_status": "GROUNDED",
            "source_kind": "USER_UPLOAD",
            "source_ref": artifact.id,
            "content_hash": artifact.digest_sha256,
            "verification_receipt_id": receipt_id,
        }
        db.add(
            SecureIngestAuditEvent(
                id=receipt_id,
                tenant_id=1,
                user_id="1",
                event_type="evidence_bound",
                task_id=task_id,
                artifact_id=artifact.id,
                input_digest=artifact.digest_sha256,
                purpose="contract_review",
                created_at="2026-07-24T00:01:01+00:00",
            )
        )
    db.add(
        OutboxEvent(
            id=generation_id,
            tenant_id=1,
            task_id=task_id,
            decision_id=f"decision_{task_id}",
            event_type="evidence.rework",
            generation=2,
            idempotency_key=f"evidence-rework:{task_id}",
            status=durable_status,
            attempts=0,
            max_attempts=3,
            payload_json=json.dumps(
                _generation_payload(
                    generation_id=generation_id,
                    task_id=task_id,
                    status=payload_status,
                    packet=packet,
                    prior_final_memorial_content_hash=prior_final_hash,
                )
            ),
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:01:01+00:00",
        )
    )
    db.commit()
    artifact_id = artifact.id
    db.close()
    return generation_id, artifact_id


def test_first_evidence_bind_queues_durable_event_and_projects_evidence_status(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    from src.contract_task_projection import project_contract_task
    from src.db.models import (
        DecisionTask,
        OutboxEvent,
        SecureIngestAuditEvent,
    )

    task_id = "task_first_bind_pending"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 200, response.json()
    payload = response.json()
    assert payload["success"] is True, payload
    assert payload["data"]["evidence_packet"]["evidence_status"] == "GROUNDED"
    assert payload["data"]["rework_generation"]["status"] == "evidence_bound"
    assert payload["data"]["rework_generation"]["evidence_status"] == "GROUNDED"
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    assert event.status == "pending"
    assert db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count() == 1
    model = project_contract_task(
        db,
        storage_root=tmp_path,
        task=db.get(DecisionTask, task_id),
    )
    assert model.allowed_actions == ["REFRESH_REVIEW"]
    db.close()


def test_evidence_bind_requires_server_submit_evidence_before_any_write(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    from src.db.models import DecisionTask, OutboxEvent, SecureIngestAuditEvent

    task_id = "task_bind_without_server_action"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    db = isolated_session_local()
    db.get(DecisionTask, task_id).status = "task_cancelled"
    db.commit()
    before_event = tuple(
        getattr(db.get(OutboxEvent, generation_id), column.name)
        for column in OutboxEvent.__table__.columns
    )
    before_audits = (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count()
    )
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 409, response.json()
    assert "SUBMIT_EVIDENCE" in response.json()["error"]
    db = isolated_session_local()
    after_event = tuple(
        getattr(db.get(OutboxEvent, generation_id), column.name)
        for column in OutboxEvent.__table__.columns
    )
    assert after_event == before_event
    assert (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count()
        == before_audits
    )
    db.close()


def test_evidence_bind_locks_task_before_server_authority_projection(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    monkeypatch,
):
    from src import contract_task_projection
    from src.db.models import OutboxEvent, SecureIngestAuditEvent

    task_id = "task_bind_authority_lock"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    db = isolated_session_local()
    before_event = tuple(
        getattr(db.get(OutboxEvent, generation_id), column.name)
        for column in OutboxEvent.__table__.columns
    )
    before_audits = (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count()
    )
    db.close()

    locked_task_ids: list[str] = []

    def record_task_lock(_db, locked_task_id: str) -> None:
        locked_task_ids.append(locked_task_id)

    def authority_probe(*_args, **_kwargs):
        if locked_task_ids != [task_id]:
            raise RuntimeError("SUBMIT_EVIDENCE authority projected before task lock")
        raise RuntimeError("SUBMIT_EVIDENCE authority projected after task lock")

    monkeypatch.setattr(
        "src.decision_task_access.lock_decision_task",
        record_task_lock,
    )
    monkeypatch.setattr(
        contract_task_projection,
        "project_contract_task",
        authority_probe,
    )

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 500
    assert response.json()["error"] == (
        "SUBMIT_EVIDENCE authority projected after task lock"
    )
    assert locked_task_ids == [task_id]
    db = isolated_session_local()
    after_event = tuple(
        getattr(db.get(OutboxEvent, generation_id), column.name)
        for column in OutboxEvent.__table__.columns
    )
    assert after_event == before_event
    assert (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count()
        == before_audits
    )
    db.close()


def test_swarm_deepen_locks_task_before_refresh_authority_projection(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    monkeypatch,
):
    from src.db.models import DecisionTask
    from web.routers import shangshufang

    task_id = "task_refresh_authority_lock"
    _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
        durable_status="pending",
        payload_status="evidence_bound",
        with_bound_packet=True,
    )
    db = isolated_session_local()
    before = tuple(
        getattr(db.get(DecisionTask, task_id), column.name)
        for column in DecisionTask.__table__.columns
    )
    db.close()

    locked_task_ids: list[str] = []

    def record_task_lock(_db, locked_task_id: str) -> None:
        locked_task_ids.append(locked_task_id)

    def authority_probe(_db, *, task, required_action):
        assert required_action == "REFRESH_REVIEW"
        if locked_task_ids != [task.id]:
            raise RuntimeError("REFRESH_REVIEW authority projected before task lock")
        raise RuntimeError("REFRESH_REVIEW authority projected after task lock")

    monkeypatch.setattr(
        "src.decision_task_access.lock_decision_task",
        record_task_lock,
    )
    monkeypatch.setattr(
        shangshufang,
        "_contract_route_action_error",
        authority_probe,
    )

    response = TestClient(app).post(
        f"/api/shangshufang/tasks/{task_id}/swarm-deepen"
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["error"] == (
        "REFRESH_REVIEW authority projected after task lock"
    )
    assert locked_task_ids == [task_id]
    db = isolated_session_local()
    after = tuple(
        getattr(db.get(DecisionTask, task_id), column.name)
        for column in DecisionTask.__table__.columns
    )
    assert after == before
    db.close()


def test_swarm_deepen_uses_current_final_memorial_review_not_newest_review(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    monkeypatch,
):
    from src.db.models import CourtReview, DecisionTask
    from web.routers import shangshufang

    task_id = "task_refresh_exact_review"
    _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
        durable_status="pending",
        payload_status="evidence_bound",
        with_bound_packet=True,
    )
    authoritative_review_id = f"review_{task_id}"
    newer_review_id = f"review_newer_{task_id}"
    db = isolated_session_local()
    db.add(
        CourtReview(
            id=newer_review_id,
            tenant_id=2,
            task_id=task_id,
            routing_plan_json='{"route":{"mode":"cluster"}}',
            review_status="reviewing",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json="{}",
            created_at="2026-07-24T00:02:00+00:00",
            updated_at="2026-07-24T00:02:00+00:00",
        )
    )
    db.commit()
    before_task = tuple(
        getattr(db.get(DecisionTask, task_id), column.name)
        for column in DecisionTask.__table__.columns
    )
    db.close()

    selected_review_ids: list[str] = []

    def stop_after_review_selection(params):
        selected_review_ids.append(params["review_id"])
        raise RuntimeError("review selection probe")

    monkeypatch.setattr(
        shangshufang,
        "_run_swarm_execution_loop_sync",
        stop_after_review_selection,
    )

    response = TestClient(app).post(
        f"/api/shangshufang/tasks/{task_id}/swarm-deepen"
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["error"] == "review selection probe"
    assert selected_review_ids == [authoritative_review_id]
    db = isolated_session_local()
    after_task = tuple(
        getattr(db.get(DecisionTask, task_id), column.name)
        for column in DecisionTask.__table__.columns
    )
    assert after_task == before_task
    assert db.get(CourtReview, newer_review_id).tenant_id == 2
    db.close()


def test_evidence_bind_holds_real_task_lock_through_authority_and_publication(
    tmp_path,
    monkeypatch,
    w05_contract_user,
):
    from src import contract_task_projection
    from src.contract_mission_repository import save_mission_snapshot
    from tests.contract_task_support import contract_mission

    engine = create_engine(
        f"sqlite:///{tmp_path / 'evidence-bind-task-lock.db'}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    engine_module = importlib.import_module("src.db.engine")
    monkeypatch.setattr(engine_module, "SessionLocal", test_session)

    task_id = "task_bind_real_task_lock"
    generation_id, artifact_id = _seed_binding_generation(
        test_session,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    authority_reached = threading.Event()
    release_authority = threading.Event()
    writer_started = threading.Event()
    writer_finished = threading.Event()
    errors: list[BaseException] = []
    responses = []
    original_projection = contract_task_projection.project_contract_task

    def pause_authority(*args, **kwargs):
        authority_reached.set()
        assert release_authority.wait(timeout=5)
        return original_projection(*args, **kwargs)

    monkeypatch.setattr(
        contract_task_projection,
        "project_contract_task",
        pause_authority,
    )

    def bind_evidence() -> None:
        try:
            responses.append(
                TestClient(app).post(
                    (
                        f"/api/shangshufang/tasks/{task_id}/rework-generations/"
                        f"{generation_id}/evidence"
                    ),
                    json={"artifact_id": artifact_id},
                )
            )
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    def publish_new_mission() -> None:
        try:
            writer_started.set()
            db = test_session()
            task = db.get(
                importlib.import_module("src.db.models").DecisionTask,
                task_id,
            )
            mission = contract_mission(task_id).model_copy(update={"revision": 2})
            save_mission_snapshot(
                db,
                task=task,
                mission=mission,
                state="confirmed",
            )
            db.commit()
            db.close()
            writer_finished.set()
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    bind_thread = threading.Thread(target=bind_evidence)
    bind_thread.start()
    assert authority_reached.wait(timeout=5)
    writer_thread = threading.Thread(target=publish_new_mission)
    writer_thread.start()
    assert writer_started.wait(timeout=5)
    assert not writer_finished.wait(timeout=0.25)
    release_authority.set()
    bind_thread.join(timeout=10)
    writer_thread.join(timeout=10)

    assert not errors
    assert len(responses) == 1
    assert responses[0].status_code == 200, responses[0].text
    assert writer_finished.is_set()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_swarm_deepen_holds_real_task_lock_through_execution_and_publication(
    tmp_path,
    monkeypatch,
    w05_contract_user,
):
    from src.contract_mission_repository import save_mission_snapshot
    from src.db.models import DecisionTask
    from tests.contract_task_support import contract_mission
    from web.routers import shangshufang

    engine = create_engine(
        f"sqlite:///{tmp_path / 'swarm-deepen-task-lock.db'}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(engine)
    test_session = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    engine_module = importlib.import_module("src.db.engine")
    monkeypatch.setattr(engine_module, "SessionLocal", test_session)

    task_id = "task_swarm_real_task_lock"
    _seed_binding_generation(
        test_session,
        tmp_path=tmp_path,
        task_id=task_id,
        durable_status="pending",
        payload_status="evidence_bound",
        with_bound_packet=True,
    )
    swarm_reached = threading.Event()
    release_swarm = threading.Event()
    writer_started = threading.Event()
    writer_finished = threading.Event()
    errors: list[BaseException] = []
    responses = []

    def pause_swarm(params):
        swarm_reached.set()
        assert release_swarm.wait(timeout=5)
        return {
            "swarm_run": {
                "id": f"swarm_refresh_{task_id}",
                "task_id": task_id,
                "review_id": params["review_id"],
                "source_label": "LIVE_SWARM",
                "status": "completed",
                "trace_id": f"trace_{task_id}",
                "route_plan": {"selected_swarms": []},
            },
            "quality_result": {
                "id": f"quality_refresh_{task_id}",
                "passed": True,
                "blocking_reasons": [],
            },
        }

    monkeypatch.setattr(
        shangshufang,
        "_run_swarm_execution_loop_sync",
        pause_swarm,
    )
    monkeypatch.setattr(
        shangshufang,
        "persist_swarm_execution_result",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        shangshufang,
        "attach_swarm_result_to_review",
        lambda *_args, **_kwargs: None,
    )

    def refresh_review() -> None:
        try:
            responses.append(
                TestClient(app).post(
                    f"/api/shangshufang/tasks/{task_id}/swarm-deepen"
                )
            )
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    def publish_new_mission() -> None:
        try:
            writer_started.set()
            db = test_session()
            task = db.get(DecisionTask, task_id)
            mission = contract_mission(task_id).model_copy(update={"revision": 2})
            save_mission_snapshot(
                db,
                task=task,
                mission=mission,
                state="confirmed",
            )
            db.commit()
            db.close()
            writer_finished.set()
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    refresh_thread = threading.Thread(target=refresh_review)
    refresh_thread.start()
    assert swarm_reached.wait(timeout=5)
    writer_thread = threading.Thread(target=publish_new_mission)
    writer_thread.start()
    assert writer_started.wait(timeout=5)
    assert not writer_finished.wait(timeout=0.25)
    release_swarm.set()
    refresh_thread.join(timeout=10)
    writer_thread.join(timeout=10)

    assert not errors
    assert len(responses) == 1
    assert responses[0].status_code == 200, responses[0].text
    assert responses[0].json()["success"] is True, responses[0].json()
    assert writer_finished.is_set()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.mark.parametrize(
    "generation_scope",
    [
        None,
        {
            "schema_version": "ContractIntakeV1",
            "jurisdiction": "CN_MAINLAND",
            "language": "zh-CN",
            "contract_type": "sales",
            "our_role": "seller",
            "legal_question": "contract_risk_screening",
        },
    ],
    ids=["missing_snapshot", "different_snapshot"],
)
def test_bind_rejects_task_generation_scope_drift_without_rewriting_snapshot(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    generation_scope,
):
    from src.db.models import OutboxEvent, SecureIngestAuditEvent

    task_id = f"task_scope_drift_{generation_scope is None}"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    original_payload = json.loads(event.payload_json)
    if generation_scope is None:
        original_payload.pop("contract_scope", None)
    else:
        original_payload["contract_scope"] = generation_scope
    event.payload_json = json.dumps(original_payload)
    db.commit()
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 500, response.json()
    assert "scope snapshot" in response.json()["error"]
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    assert json.loads(event.payload_json) == original_payload
    assert (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count() == 0
    )
    db.close()


@pytest.mark.parametrize(
    ("durable_status", "payload_status", "expected_public_status"),
    [
        ("processing", "evidence_bound", "pending"),
        ("completed", "candidate_ready", "candidate_ready"),
        ("completed", "quality_blocked", "quality_blocked"),
    ],
)
def test_same_artifact_bind_retry_survives_worker_progress(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    durable_status,
    payload_status,
    expected_public_status,
):
    from src.db.models import SecureIngestAuditEvent

    task_id = f"task_bind_retry_{durable_status}_{payload_status}"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
        durable_status=durable_status,
        payload_status=payload_status,
        with_bound_packet=True,
    )

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True, payload
    assert payload["data"]["evidence_packet"]["input_version_id"] == artifact_id
    assert payload["data"]["rework_generation"]["status"] == expected_public_status
    db = isolated_session_local()
    assert db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count() == 1
    db.close()


@pytest.mark.parametrize(
    ("selected_version", "expected_status"),
    [
        ("older", "STALE"),
        ("newer", "CONFLICTED"),
    ],
)
def test_bind_classifies_conflicting_immutable_artifact_versions(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    selected_version,
    expected_status,
):
    from src.db.models import SecureIngestArtifact

    task_id = f"task_evidence_version_{selected_version}"
    generation_id, original_artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    db = isolated_session_local()
    original = (
        db.query(SecureIngestArtifact).filter_by(id=original_artifact_id).one()
    )
    original.created_at = "2026-07-24T00:01:00+00:00"
    newer = _artifact_row(
        tmp_path=tmp_path,
        artifact_id=f"artifact_newer_{task_id}",
        task_id=task_id,
        text="付款应在验收完成后三十日内支付。",
        created_at="2026-07-24T00:02:00+00:00",
    )
    db.add(newer)
    db.commit()
    selected_artifact_id = (
        original_artifact_id if selected_version == "older" else newer.id
    )
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": selected_artifact_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True, payload
    assert payload["data"]["evidence_packet"]["evidence_status"] == expected_status
    assert payload["data"]["rework_generation"]["evidence_status"] == expected_status


def test_worker_revalidates_tampered_artifact_and_quality_blocks(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    from src.db.models import (
        OutboxEvent,
        SecureIngestArtifact,
    )
    from src.execution.outbox_worker import process_event

    task_id = "task_worker_revalidates_tampered_artifact"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )

    client = TestClient(app)
    bound = client.post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )
    assert bound.status_code == 200, bound.json()
    assert (
        bound.json()["data"]["evidence_packet"]["evidence_status"] == "GROUNDED"
    )

    db = isolated_session_local()
    artifact = db.query(SecureIngestArtifact).filter_by(id=artifact_id).one()
    Path(artifact.storage_path).write_bytes(b"tampered after evidence binding")
    db.close()

    worker_db = isolated_session_local()
    result = process_event(worker_db, generation_id)
    worker_db.close()
    assert result["status"] == "completed", result
    assert result["result"]["quality_gate_status"] == "FAILED"
    assert "provenance_gate_failed" in result["result"]["gate_reasons"]

    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    generation = json.loads(event.payload_json)
    assert generation["status"] == "quality_blocked"
    assert generation["evidence_status"] == "STALE"
    assert generation["evidence_packets"][0]["evidence_status"] == "STALE"
    _assert_only_prior_final(db, task_id)
    db.close()


def _seed_rework_review(session_local, task_id: str) -> None:
    from src.db.models import CourtReview

    db = session_local()
    if db.get(CourtReview, f"review_{task_id}") is not None:
        db.close()
        return
    db.add(
        CourtReview(
            id=f"review_{task_id}",
            tenant_id=1,
            task_id=task_id,
            routing_plan_json="{}",
            review_status="awaiting_evidence",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json="{}",
            created_at="2026-07-24T00:00:00+00:00",
            updated_at="2026-07-24T00:00:00+00:00",
        )
    )
    db.commit()
    db.close()


def _assert_only_prior_final(db, task_id: str) -> None:
    from src.db.models import FinalMemorial

    finals = (
        db.query(FinalMemorial)
        .filter_by(task_id=task_id)
        .order_by(FinalMemorial.version.asc())
        .all()
    )
    assert [
        (row.version, row.status, row.is_current)
        for row in finals
    ] == [(1, "awaiting_evidence", True)]


@pytest.mark.parametrize("durable_status", ["failed", "dead_letter", "superseded"])
def test_terminal_generation_rejects_bind_retry_with_authoritative_state(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    durable_status,
):
    task_id = f"task_terminal_bind_{durable_status}"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
        durable_status=durable_status,
        payload_status="evidence_bound",
        with_bound_packet=True,
    )
    if durable_status in {"failed", "dead_letter"}:
        from src.db.models import OutboxEvent

        db = isolated_session_local()
        event = db.query(OutboxEvent).filter_by(id=generation_id).one()
        event.last_error = "document parser failed"
        db.commit()
        db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 409, response.json()
    assert durable_status in response.json()["error"]
    if durable_status in {"failed", "dead_letter"}:
        assert "document parser failed" in response.json()["error"]


def test_different_artifact_cannot_replace_binding_winner(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    from src.db.models import OutboxEvent, SecureIngestArtifact, SecureIngestAuditEvent

    task_id = "task_different_artifact_loses_binding"
    generation_id, winner_artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
        durable_status="pending",
        payload_status="evidence_bound",
        with_bound_packet=True,
    )
    loser = _artifact_row(
        tmp_path=tmp_path,
        artifact_id="artifact_different_binding_loser",
        task_id=task_id,
        text="付款应在验收完成后三十日内支付。",
        created_at="2026-07-24T00:02:00+00:00",
    )
    db = isolated_session_local()
    db.add(loser)
    db.commit()
    loser_artifact_id = loser.id
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": loser_artifact_id},
    )

    assert response.status_code == 409, response.json()
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    stored = json.loads(event.payload_json)
    assert stored["evidence_packets"][0]["input_version_id"] == winner_artifact_id
    assert (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count() == 1
    )
    assert db.query(SecureIngestArtifact).filter_by(id=loser_artifact_id).one()
    db.close()


def test_binding_cas_loser_reloads_winner_without_persisting_loser_audit(
    isolated_session_local,
    tmp_path,
    monkeypatch,
    w05_contract_user,
):
    from sqlalchemy import update

    import web.routers.shangshufang as shangshufang_router
    from src.db.models import OutboxEvent, SecureIngestAuditEvent

    task_id = "task_binding_cas_loser"
    generation_id, loser_artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    winner = _artifact_row(
        tmp_path=tmp_path,
        artifact_id="artifact_binding_cas_winner",
        task_id=task_id,
        text="先到达的合法 winner 证据。",
        created_at="2026-07-24T00:02:00+00:00",
    )
    winner.original_filename = "winner.docx"
    db = isolated_session_local()
    db.add(winner)
    db.commit()
    winner_artifact_id = winner.id
    winner_digest = winner.digest_sha256
    db.close()
    winner_receipt_id = "audit_binding_cas_winner"

    def _publish_winner_then_report_cas_loss(
        db,
        *,
        task_id,
        generation_id,
        payload_json,
        updated_at,
    ):
        del payload_json
        event = db.query(OutboxEvent).filter_by(id=generation_id).one()
        winner_packet = {
            "schema_version": "EvidencePacketV1",
            "evidence_packet_id": "evidence_binding_cas_winner",
            "tenant_id": 1,
            "task_id": task_id,
            "input_version_id": winner_artifact_id,
            "input_digest": winner_digest,
            "prior_final_memorial_content_hash": "a" * 64,
            "generation": 2,
            "evidence_status": "GROUNDED",
            "source_kind": "USER_UPLOAD",
            "source_ref": winner_artifact_id,
            "content_hash": winner_digest,
            "verification_receipt_id": winner_receipt_id,
        }
        winner_payload = json.loads(event.payload_json)
        winner_payload.update(
            {
                "status": "evidence_bound",
                "evidence_packets": [winner_packet],
                "evidence_status": "GROUNDED",
            }
        )
        db.execute(
            update(OutboxEvent)
            .where(OutboxEvent.id == generation_id)
            .values(
                status="pending",
                payload_json=json.dumps(winner_payload),
                updated_at=updated_at,
            )
        )
        db.add(
            SecureIngestAuditEvent(
                id=winner_receipt_id,
                tenant_id=1,
                user_id="1",
                event_type="evidence_bound",
                task_id=task_id,
                artifact_id=winner_artifact_id,
                input_digest=winner_digest,
                purpose="contract_review",
                created_at=updated_at,
            )
        )
        db.commit()
        return False

    monkeypatch.setattr(
        shangshufang_router,
        "_claim_evidence_binding",
        _publish_winner_then_report_cas_loss,
    )
    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": loser_artifact_id},
    )

    assert response.status_code == 409, response.json()
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    stored = json.loads(event.payload_json)
    assert stored["evidence_packets"][0]["input_version_id"] == winner_artifact_id
    audits = (
        db.query(SecureIngestAuditEvent)
        .filter_by(task_id=task_id)
        .order_by(SecureIngestAuditEvent.id)
        .all()
    )
    assert [(audit.id, audit.artifact_id) for audit in audits] == [
        (winner_receipt_id, winner_artifact_id)
    ]
    db.close()


def test_evidence_bind_adds_audit_only_after_winning_cas(
    isolated_session_local,
    tmp_path,
    monkeypatch,
    w05_contract_user,
):
    import web.routers.shangshufang as shangshufang_router
    from src.db.models import SecureIngestAuditEvent

    task_id = "task_audit_after_binding_cas"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    original_claim = shangshufang_router._claim_evidence_binding
    pending_audit_counts: list[int] = []
    persisted_audit_counts: list[int] = []

    def _record_pending_audits(db, **kwargs):
        pending_audit_counts.append(
            sum(
                isinstance(pending, SecureIngestAuditEvent)
                for pending in db.new
            )
        )
        db.flush()
        persisted_audit_counts.append(
            db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count()
        )
        return original_claim(db, **kwargs)

    monkeypatch.setattr(
        shangshufang_router,
        "_claim_evidence_binding",
        _record_pending_audits,
    )
    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 200, response.json()
    assert pending_audit_counts == [0]
    assert persisted_audit_counts == [0]
    db = isolated_session_local()
    assert (
        db.query(SecureIngestAuditEvent).filter_by(task_id=task_id).count() == 1
    )
    db.close()


def test_other_user_cannot_poison_evidence_version_classification(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    task_id = "task_cross_user_evidence_isolation"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    attacker_artifact = _artifact_row(
        tmp_path=tmp_path,
        artifact_id="artifact_cross_user_attacker",
        task_id=task_id,
        text="攻击者伪造的不同付款条件。",
        created_at="2026-07-24T00:02:00+00:00",
    )
    attacker_artifact.user_id = "2"
    db = isolated_session_local()
    db.add(attacker_artifact)
    db.commit()
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )

    assert response.status_code == 200, response.json()
    assert (
        response.json()["data"]["evidence_packet"]["evidence_status"]
        == "GROUNDED"
    )


def test_equivalent_partial_scope_is_normalized_before_bind_comparison(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    from src.db.models import DecisionTask, OutboxEvent

    task_id = "task_partial_scope_normalization"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    partial_scope = {
        "schema_version": "ContractIntakeV1",
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
    }
    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    task.contract_scope_json = json.dumps({**partial_scope, "legal_question": None})
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    payload = json.loads(event.payload_json)
    payload["contract_scope"] = partial_scope
    event.payload_json = json.dumps(payload)
    db.commit()
    db.close()

    response = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id, "contract_scope": partial_scope},
    )

    assert response.status_code == 200, response.json()


@pytest.mark.parametrize("legal_question", [None, "UNSUPPORTED_OR_UNKNOWN"])
def test_worker_fences_scope_that_no_longer_matches_confirmed_mission(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    legal_question,
):
    from src.db.models import CourtReview, DecisionTask, FinalMemorial, OutboxEvent
    from src.execution.outbox_worker import process_event

    task_id = f"task_legal_review_{legal_question or 'missing'}"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    scope = {
        **_SUPPORTED_SCOPE,
        "legal_question": legal_question,
    }
    if legal_question is None:
        scope.pop("legal_question")
    db = isolated_session_local()
    task = db.query(DecisionTask).filter_by(id=task_id).one()
    task.contract_scope_json = json.dumps(scope)
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    payload = json.loads(event.payload_json)
    payload["contract_scope"] = scope
    event.payload_json = json.dumps(payload)
    review_before = db.get(CourtReview, f"review_{task_id}").memorial_json
    db.commit()
    db.close()
    _seed_rework_review(isolated_session_local, task_id)

    bound = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )
    assert bound.status_code == 200, bound.json()

    worker_db = isolated_session_local()
    result = process_event(worker_db, generation_id)
    worker_db.close()

    assert result["status"] == "superseded", result
    assert result["result"]["fenced"] is True
    assert result["result"]["reason"] == "mission_scope_changed"
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    assert event.status == "superseded"
    review = db.query(CourtReview).filter_by(task_id=task_id).one()
    assert review.memorial_json == review_before
    _assert_only_prior_final(db, task_id)
    db.close()


@pytest.mark.parametrize(
    ("add_later_version", "expected_status"),
    [(False, "CONFLICTED"), (True, "STALE")],
)
def test_worker_never_promotes_conflicted_packet_and_allows_monotonic_degradation(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
    add_later_version,
    expected_status,
):
    from src.db.models import FinalMemorial, OutboxEvent
    from src.execution.outbox_worker import process_event

    task_id = f"task_conflicted_worker_{add_later_version}"
    generation_id, older_artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    selected = _artifact_row(
        tmp_path=tmp_path,
        artifact_id=f"artifact_selected_{task_id}",
        task_id=task_id,
        text="付款应在验收完成后三十日内支付。",
        created_at="2026-07-24T00:02:00+00:00",
    )
    db = isolated_session_local()
    db.add(selected)
    db.commit()
    selected_artifact_id = selected.id
    db.close()
    _seed_rework_review(isolated_session_local, task_id)

    bound = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": selected_artifact_id},
    )
    assert bound.status_code == 200, bound.json()
    assert (
        bound.json()["data"]["evidence_packet"]["evidence_status"]
        == "CONFLICTED"
    )

    if add_later_version:
        later = _artifact_row(
            tmp_path=tmp_path,
            artifact_id=f"artifact_later_{task_id}",
            task_id=task_id,
            text="付款应在验收完成后四十五日内支付。",
            created_at="2026-07-24T00:03:00+00:00",
        )
        db = isolated_session_local()
        db.add(later)
        db.commit()
        db.close()

    worker_db = isolated_session_local()
    result = process_event(worker_db, generation_id)
    worker_db.close()
    assert result["status"] == "completed", result
    assert result["result"]["quality_gate_status"] == "FAILED"

    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    generation = json.loads(event.payload_json)
    assert generation["evidence_status"] == expected_status
    assert generation["evidence_packets"][0]["evidence_status"] == expected_status
    _assert_only_prior_final(db, task_id)
    assert older_artifact_id != selected_artifact_id
    db.close()


def test_worker_does_not_promote_conflict_after_sibling_disappears_without_human_resolution(
    isolated_session_local,
    tmp_path,
    w05_contract_user,
):
    from src.db.models import FinalMemorial, OutboxEvent, SecureIngestArtifact
    from src.execution.outbox_worker import process_event

    task_id = "task_conflict_cannot_auto_promote"
    generation_id, older_artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    selected = _artifact_row(
        tmp_path=tmp_path,
        artifact_id="artifact_conflict_cannot_auto_promote_selected",
        task_id=task_id,
        text="付款应在验收完成后三十日内支付。",
        created_at="2026-07-24T00:02:00+00:00",
    )
    db = isolated_session_local()
    db.add(selected)
    db.commit()
    selected_artifact_id = selected.id
    db.close()
    _seed_rework_review(isolated_session_local, task_id)
    bound = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": selected_artifact_id},
    )
    assert bound.status_code == 200, bound.json()
    assert (
        bound.json()["data"]["evidence_packet"]["evidence_status"]
        == "CONFLICTED"
    )

    db = isolated_session_local()
    older = (
        db.query(SecureIngestArtifact).filter_by(id=older_artifact_id).one()
    )
    older.status = "REJECTED"
    db.commit()
    db.close()

    worker_db = isolated_session_local()
    result = process_event(worker_db, generation_id)
    worker_db.close()
    assert result["status"] == "completed", result
    assert result["result"]["quality_gate_status"] == "FAILED"
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    generation = json.loads(event.payload_json)
    assert generation["evidence_status"] == "CONFLICTED"
    assert generation["evidence_packets"][0]["evidence_status"] == "CONFLICTED"
    _assert_only_prior_final(db, task_id)
    db.close()


def test_worker_locks_artifact_versions_before_final_publication_revalidation(
    isolated_session_local,
    tmp_path,
    monkeypatch,
    w05_contract_user,
):
    import src.contract_rework as contract_rework
    from src.execution.outbox_worker import process_event

    task_id = "task_worker_artifact_publication_fence"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    _seed_rework_review(isolated_session_local, task_id)
    bound = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )
    assert bound.status_code == 200, bound.json()

    events: list[str] = []
    original_classifier = contract_rework.classify_evidence_artifact

    def _record_classification(db, artifact):
        events.append("classify")
        return original_classifier(db, artifact)

    monkeypatch.setattr(
        contract_rework,
        "classify_evidence_artifact",
        _record_classification,
    )
    monkeypatch.setattr(
        contract_rework,
        "_lock_evidence_version_publication",
        lambda db: events.append("lock"),
        raising=False,
    )
    worker_db = isolated_session_local()
    result = process_event(worker_db, generation_id)
    worker_db.close()

    assert result["status"] == "completed", result
    assert events == ["classify", "lock", "classify"]


def test_worker_digest_drift_between_classification_and_read_quality_blocks(
    isolated_session_local,
    tmp_path,
    monkeypatch,
    w05_contract_user,
):
    import src.contract_rework as contract_rework
    from src.db.models import FinalMemorial, OutboxEvent
    from src.execution.outbox_worker import process_event

    task_id = "task_worker_digest_drift_during_processing"
    generation_id, artifact_id = _seed_binding_generation(
        isolated_session_local,
        tmp_path=tmp_path,
        task_id=task_id,
    )
    _seed_rework_review(isolated_session_local, task_id)
    bound = TestClient(app).post(
        (
            f"/api/shangshufang/tasks/{task_id}/rework-generations/"
            f"{generation_id}/evidence"
        ),
        json={"artifact_id": artifact_id},
    )
    assert bound.status_code == 200, bound.json()

    original_classifier = contract_rework.classify_evidence_artifact
    drifted = False

    def _classify_then_drift(db, artifact):
        nonlocal drifted
        status = original_classifier(db, artifact)
        if not drifted:
            Path(artifact.storage_path).write_bytes(
                b"changed after classification but before parse"
            )
            drifted = True
        return status

    monkeypatch.setattr(
        contract_rework,
        "classify_evidence_artifact",
        _classify_then_drift,
    )
    worker_db = isolated_session_local()
    result = process_event(worker_db, generation_id)
    worker_db.close()

    assert result["status"] == "completed", result
    assert result["result"]["quality_gate_status"] == "FAILED"
    assert "provenance_gate_failed" in result["result"]["gate_reasons"]
    db = isolated_session_local()
    event = db.query(OutboxEvent).filter_by(id=generation_id).one()
    generation = json.loads(event.payload_json)
    assert generation["evidence_status"] == "STALE"
    assert generation["evidence_packets"][0]["evidence_status"] == "STALE"
    assert generation["status"] == "quality_blocked"
    _assert_only_prior_final(db, task_id)
    db.close()
