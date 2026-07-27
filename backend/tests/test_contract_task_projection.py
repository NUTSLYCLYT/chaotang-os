from __future__ import annotations

from src.artifacts.delivery import render_one_artifact
from src.contract_task_projection import project_contract_task
from src.db.models import ArtifactDeliveryItem
from tests.contract_task_support import (
    contract_review_pack,
    seed_contract_task,
    seed_delivery,
    seed_exact_archive,
    seed_final_memorial,
)


def test_exact_ready_lineage_projects_verified_downloads(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db)
        task_id = task.id
        final, pack = seed_final_memorial(db, task_id=task.id)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

    with isolated_session_local() as db:
        from src.db.models import DecisionTask

        task = db.get(DecisionTask, task_id)
        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.review_pack.mission_contract_id == task_id
    assert model.source_class == "ADJUDICABLE"
    assert model.delivery.overall_status == "READY"
    assert {item.kind for item in model.delivery.artifacts} == {
        "PDF",
        "DOCX",
        "JSON",
    }
    assert all(item.download_url for item in model.delivery.artifacts)
    assert model.allowed_actions == ["DOWNLOAD_ARTIFACT", "DECIDE"]
    serialized = model.model_dump(mode="json")
    assert "resume_token_hash" not in str(serialized)
    assert "idempotency_key_hash" not in str(serialized)
    assert "storage_path" not in str(serialized)


def test_missing_persisted_review_blocks_decide_projection(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-missing-persisted-review")
        final, pack = seed_final_memorial(
            db,
            task_id=task.id,
            seed_review=False,
        )
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.allowed_actions == []
    assert "LINEAGE_CONFLICT" in {item.code for item in model.blockers}


def test_revise_verdict_cannot_be_promoted_to_decide(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-review-revision-required")
        pack = contract_review_pack(
            task.id,
            verdict="REVISE_BEFORE_PROCEED",
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.allowed_actions == ["DOWNLOAD_ARTIFACT", "REFRESH_REVIEW"]
    assert "DECIDE" not in model.allowed_actions
    assert [item.code for item in model.blockers] == [
        "REVIEW_REVISION_REQUIRED"
    ]


def test_partial_after_refresh_is_honest_and_not_resumable(
    isolated_session_local,
    tmp_path,
) -> None:
    def fail_pdf(**kwargs):
        if kwargs["kind"] == "PDF":
            raise RuntimeError("expected renderer failure")
        return render_one_artifact(**kwargs)

    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-partial")
        task_id = task.id
        final, pack = seed_final_memorial(db, task_id=task.id)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
            renderer=fail_pdf,
        )
        db.commit()

    with isolated_session_local() as db:
        from src.db.models import DecisionTask

        task = db.get(DecisionTask, task_id)
        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.delivery.overall_status == "PARTIAL"
    assert model.allowed_actions == ["DOWNLOAD_ARTIFACT"]
    assert "RESUME_DELIVERY" not in model.allowed_actions
    assert [item.code for item in model.blockers] == [
        "PARTIAL_RECOVERY_REQUIRES_HARDENING"
    ]


def test_pack_mission_or_review_drift_fails_closed(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-pack-drift")
        pack = contract_review_pack(
            task.id,
            mission_contract_id="mission-other",
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.review_pack is None
    assert model.delivery is None
    assert model.allowed_actions == []
    assert "LINEAGE_CONFLICT" in {item.code for item in model.blockers}


def test_pending_quality_pack_is_not_adjudicable(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-pack-pending")
        pack = contract_review_pack(
            task.id,
            quality_gate_status="PENDING",
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.allowed_actions == []
    assert "STATE_INCONSISTENT" in {item.code for item in model.blockers}


def test_fallback_pack_engine_is_not_adjudicable(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-pack-fallback")
        pack = contract_review_pack(
            task.id,
            engine_tiers=["fallback"],
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.allowed_actions == []
    assert model.source_class == "FALLBACK"
    assert "NON_ADJUDICABLE_SOURCE" in {
        item.code for item in model.blockers
    }


def test_fallback_pack_source_label_is_not_adjudicable(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-pack-fallback-source")
        pack = contract_review_pack(
            task.id,
            source_labels=["FALLBACK"],
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.allowed_actions == []
    assert model.source_class == "FALLBACK"
    assert "NON_ADJUDICABLE_SOURCE" in {
        item.code for item in model.blockers
    }


def test_fallback_risk_item_cannot_hide_behind_adjudicable_pack_aggregate(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-risk-fallback")
        pack = contract_review_pack(
            task.id,
            risk_items=[
                {
                    "schema_version": "ContractRiskItemV1",
                    "risk_item_id": "risk-fallback",
                    "evidence_packet_id": "evidence-1",
                    "risk_level": "medium",
                    "explanation": "回退引擎生成的风险项不得用于裁决。",
                    "missing_evidence": ["原文锚点"],
                    "recommended_revision": "补齐原文后重新审查。",
                    "source_label": "FALLBACK",
                    "engine_tier": "fallback",
                }
            ],
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.source_class == "FALLBACK"
    assert model.allowed_actions == []
    assert "NON_ADJUDICABLE_SOURCE" in {
        item.code for item in model.blockers
    }


def test_risk_item_source_and_engine_must_be_declared_by_pack(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-risk-aggregate-drift")
        pack = contract_review_pack(
            task.id,
            risk_items=[
                {
                    "schema_version": "ContractRiskItemV1",
                    "risk_item_id": "risk-aggregate-drift",
                    "evidence_packet_id": "evidence-1",
                    "risk_level": "medium",
                    "explanation": "风险项来源与 pack 汇总声明不一致。",
                    "missing_evidence": ["原文锚点"],
                    "recommended_revision": "修正来源汇总后重新审查。",
                    "source_label": "VALIDATED_MODEL",
                    "engine_tier": "validated_model",
                }
            ],
            source_labels=["TASK_EVIDENCE"],
            engine_tiers=["deterministic"],
        )
        final, pack = seed_final_memorial(db, task_id=task.id, pack=pack)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.source_class == "UNKNOWN"
    assert model.allowed_actions == []
    assert "STATE_INCONSISTENT" in {
        item.code for item in model.blockers
    }


def test_ready_manifest_with_missing_stored_file_cannot_be_decided(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-delivery-missing-file")
        task_id = task.id
        final, pack = seed_final_memorial(db, task_id=task.id)
        packet = seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        item = (
            db.query(ArtifactDeliveryItem)
            .filter_by(
                manifest_id=packet.manifest.manifest_id,
                kind="PDF",
            )
            .one()
        )
        storage_path = item.storage_path
        db.commit()

    assert storage_path is not None
    from pathlib import Path

    Path(storage_path).unlink()

    with isolated_session_local() as db:
        from src.db.models import DecisionTask

        task = db.get(DecisionTask, task_id)
        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.delivery.overall_status == "UNDER_REVIEW"
    assert model.allowed_actions == []
    assert "DELIVERY_INTEGRITY_FAILED" in {
        item.code for item in model.blockers
    }


def test_multiple_delivery_formula_versions_are_not_ranked(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-formula-conflict")
        final, pack = seed_final_memorial(db, task_id=task.id)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
            delivery_formula_version="w06-v1",
            idempotency_key="formula-1",
        )
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
            delivery_formula_version="w06-v2",
            idempotency_key="formula-2",
        )
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.delivery is None
    assert model.allowed_actions == []
    assert "DELIVERY_INTEGRITY_FAILED" in {item.code for item in model.blockers}


def test_exact_archive_receipt_enables_reopen(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-archived")
        final, pack = seed_final_memorial(db, task_id=task.id)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        seed_exact_archive(db, task=task, final=final)
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.archive_receipt.archive_id == f"archive-{task.id}"
    assert model.allowed_actions == ["DOWNLOAD_ARTIFACT", "REOPEN_ARCHIVE"]


def test_synthetic_archive_never_becomes_a_receipt(
    isolated_session_local,
    tmp_path,
) -> None:
    with isolated_session_local() as db:
        task = seed_contract_task(db, task_id="task-synthetic-archive")
        final, pack = seed_final_memorial(db, task_id=task.id)
        seed_delivery(
            db,
            storage_root=tmp_path,
            task_id=task.id,
            final=final,
            pack=pack,
        )
        seed_exact_archive(db, task=task, final=final, synthetic_flag=True)
        db.commit()

        model = project_contract_task(db, storage_root=tmp_path, task=task)

    assert model.archive_receipt is None
    assert model.allowed_actions == []
    assert "ARCHIVE_LINEAGE_CONFLICT" in {item.code for item in model.blockers}
