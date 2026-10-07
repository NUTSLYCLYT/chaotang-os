from __future__ import annotations

import hashlib
from pathlib import Path

from app.jinyiwei import storage
from app.jinyiwei.models import DataGapRequest, EvidencePack, FreshnessRequirement, RequiredFact
from app.jinyiwei.replay import ReplayEngine

# ruff: noqa: E501


def _pack() -> EvidencePack:
    request = DataGapRequest(
        request_id="replay-request",
        requesting_agent="hubu",
        question="replayable facts",
        required_facts=(
            RequiredFact(
                key="amount",
                description="amount",
                category="ENTITY_REFERENCE",
                data_scope="EXTERNAL_PUBLIC",
                subject="budget",
            ),
        ),
        decision_context="audit",
        freshness=FreshnessRequirement(max_age_seconds=3600),
        timeout_seconds=30,
        source_scope=("PUBLIC_API",),
    )
    return EvidencePack.model_validate(
        {
            "pack_id": "replay-pack",
            "investigation_id": "replay-investigation",
            "status": "RESOLVED",
            "request": request.model_dump(mode="json"),
            "investigation_plan": {"fact_keys": ["amount"], "source_scope": ["PUBLIC_API"]},
            "evidence_by_fact": {
                "amount": [
                    {
                        "evidence_id": "amount-1",
                        "fact_key": "amount",
                        "value": 42,
                        "as_of": "2026-07-20T07:45:00Z",
                        "retrieved_at": "2026-07-20T07:50:00Z",
                        "source_url": "https://example.test/data",
                        "publisher": "Agency",
                        "source_type": "PUBLIC_API",
                        "quality": "PRIMARY",
                        "stance": "SUPPORTS",
                        "excerpt": "42",
                        "content_hash": hashlib.sha256(b"amount-1").hexdigest(),
                        "confidence": 0.9,
                    }
                ]
            },
            "historical_evidence_by_fact": {"amount": []},
            "resolved_facts": ["amount"],
            "unresolved_facts": [],
            "conflicts": [],
            "source_attempts": [
                {
                    "source_type": "PUBLIC_API",
                    "source_name": "api",
                    "status": "SUCCEEDED",
                    "started_at": "2026-07-20T07:40:00Z",
                    "completed_at": "2026-07-20T07:50:00Z",
                    "facts_attempted": ["amount"],
                }
            ],
            "investigation_started_at": "2026-07-20T07:40:00Z",
            "investigation_completed_at": "2026-07-20T07:50:00Z",
            "cache": {"hit": False},
            "do_not_infer": [],
        }
    )


def test_replay_is_deterministic_and_diff_is_explainable() -> None:
    pack = _pack()
    engine = ReplayEngine()
    first = engine.replay(pack)
    second = engine.replay(pack)
    assert first.status == second.status == "RESOLVED"
    assert first.result_hash == second.result_hash
    assert first.evidence_snapshot_hash == second.evidence_snapshot_hash
    changed = pack.model_copy(
        update={
            "status": "PARTIAL",
            "evidence_by_fact": {"amount": ()},
            "resolved_facts": (),
            "unresolved_facts": ("amount",),
        }
    )
    diff = engine.diff(first, engine.replay(changed))
    assert "status" in diff.changed_fields or "resolved_facts" in diff.changed_fields


def test_event_log_is_append_only_hash_chained_and_idempotent(tmp_path: Path) -> None:
    first = storage.append_investigation_event(
        "replay-investigation",
        "REQUEST_ACCEPTED",
        occurred_at="2026-07-20T07:40:00Z",
        request_fingerprint="a" * 64,
        idempotency_key="request-accepted",
        payload={"actor": "hubu"},
        db_path=tmp_path / "events.sqlite3",
    )
    second = storage.append_investigation_event(
        "replay-investigation",
        "STATUS_CHANGED",
        occurred_at="2026-07-20T07:50:00Z",
        request_fingerprint="a" * 64,
        status_before="PARTIAL",
        status_after="RESOLVED",
        idempotency_key="status-resolved",
        payload={"reason": "verified"},
        db_path=tmp_path / "events.sqlite3",
    )
    duplicate = storage.append_investigation_event(
        "replay-investigation",
        "STATUS_CHANGED",
        occurred_at="2026-07-20T07:50:00Z",
        request_fingerprint="a" * 64,
        status_before="PARTIAL",
        status_after="RESOLVED",
        idempotency_key="status-resolved",
        payload={"reason": "verified"},
        db_path=tmp_path / "events.sqlite3",
    )
    assert first.sequence == 1
    assert second.sequence == 2
    assert second.previous_event_hash == first.event_hash
    assert duplicate == second
    assert (
        len(
            storage.list_investigation_events(
                "replay-investigation", db_path=tmp_path / "events.sqlite3"
            )
        )
        == 2
    )


def test_replay_artifact_is_owner_scoped_and_read_only(tmp_path: Path) -> None:
    path = tmp_path / "replay.sqlite3"
    pack = _pack()
    storage.store_evidence_pack(pack, owner_user_id="owner-a", db_path=path)
    artifact = storage.create_replay_artifact(
        pack.investigation_id, owner_user_id="owner-a", db_path=path
    )
    assert artifact.replay_status == "RESOLVED"
    assert (
        storage.get_replay_artifact(artifact.replay_id, owner_user_id="owner-a", db_path=path)
        == artifact
    )
    try:
        storage.get_replay_artifact(artifact.replay_id, owner_user_id="owner-b", db_path=path)
    except storage.InvestigationNotFoundError:
        pass
    else:
        raise AssertionError("replay artifact leaked across owners")
