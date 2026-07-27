#!/usr/bin/env python3
"""Isolated backend launcher for the W07 RUNNABLE_MINIMUM browser gate."""

from __future__ import annotations

import hashlib
import importlib
import json
import os
import secrets
import sys
import tempfile
import threading
from pathlib import Path

if os.environ.get("W07_RUNNABLE_E2E") != "1":
    raise SystemExit("W07_RUNNABLE_E2E=1 is required")

_backend_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_backend_root))

_runtime = tempfile.TemporaryDirectory(prefix="chaotang-w07-e2e-")
_runtime_root = Path(_runtime.name)
_identity_db = _runtime_root / "data" / "fengqun.db"
_identity_db.parent.mkdir(parents=True, exist_ok=True)

os.environ["FENGQUN_RUNTIME_ROOT"] = str(_runtime_root)
os.environ["FENGQUN_DB_PATH"] = str(_identity_db)
os.environ["DB_URL"] = "sqlite://"
os.environ["FENGQUN_SCHEMA_MODE"] = "test"
os.environ["FENGQUN_JWT_SECRET"] = secrets.token_urlsafe(48)
os.environ["FENGQUN_COOKIE_SECURE"] = "false"
os.environ["FENGQUN_BOOTSTRAP_INVITE_CODE"] = "W07-RUNNABLE-E2E"
os.environ["FENGQUN_OUTBOX_POLLER"] = "false"

from tests.tenant_test_schema import initialize_tenant_test_schema  # noqa: E402

initialize_tenant_test_schema(_identity_db)

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

db_package = importlib.import_module("src.db")
engine_module = importlib.import_module("src.db.engine")

_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
engine_module.engine = _engine
engine_module.SessionLocal = sessionmaker(
    bind=_engine,
    autocommit=False,
    autoflush=False,
)
db_package.engine = _engine
db_package.SessionLocal = engine_module.SessionLocal

from src.artifacts.delivery import render_one_artifact  # noqa: E402
from src.artifacts.service import deliver_artifact_packet  # noqa: E402
from src.contract_mission_repository import save_mission_snapshot  # noqa: E402
from src.contracts.mission_contract import (  # noqa: E402
    MissionContractV1,
    MissionGoal,
    MissionOutcome,
    compute_mission_content_digest,
)
from src.db.models import CourtReview, DecisionTask, FinalMemorial  # noqa: E402

_TASK_ID = os.environ.get("W07_E2E_TASK_ID", "task-w07-runnable-minimum")
_PARTIAL_TASK_ID = f"{_TASK_ID}-partial"
_seed_lock = threading.Lock()


def _mission(task_id: str) -> MissionContractV1:
    mission = MissionContractV1(
        mission_contract_id=task_id,
        task_id=task_id,
        revision=1,
        jurisdiction="CN_MAINLAND",
        language="zh-CN",
        contract_type="procurement",
        our_role="buyer",
        legal_question="contract_risk_screening",
        goal=MissionGoal(
            user_intent="完成采购合同审查",
            biggest_concern="付款、验收与责任边界",
        ),
        constraints=["不改变商业价格"],
        prohibited_actions=["不得伪造证据"],
        desired_outcome=MissionOutcome(required_artifacts=["PDF", "DOCX", "JSON"]),
        assumptions=["合成黄金合同文本完整"],
        budget_limit_minor=0,
        deadline_at="2026-08-01T00:00:00+00:00",
        read_scope=["synthetic:contract:w07"],
        plan_digest="a" * 64,
        content_digest="0" * 64,
        created_at="2026-07-27T00:00:00+00:00",
    )
    return mission.model_copy(
        update={"content_digest": compute_mission_content_digest(mission)}
    )


def _review_pack(tenant_id: int, task_id: str) -> dict:
    mission = _mission(task_id)
    return {
        "schema_version": "ContractReviewPackV1",
        "review_pack_id": f"pack-{task_id}",
        "tenant_id": str(tenant_id),
        "task_id": task_id,
        "mission_contract_id": task_id,
        "mission_revision": mission.revision,
        "mission_content_digest": mission.content_digest,
        "court_review_id": f"review-{task_id}",
        "evidence_packet_ids": ["evidence-synthetic-contract-v1"],
        "jurisdiction": "CN_MAINLAND",
        "language": "zh-CN",
        "contract_type": "procurement",
        "our_role": "buyer",
        "legal_question": "contract_risk_screening",
        "risk_items": [],
        "verdict": "PROCEED_TO_HUMAN_APPROVAL",
        "decision_summary": "付款节点、验收异议期和责任上限需修改后再推进。",
        "affected_sections": ["contract_review"],
        "source_labels": ["TASK_EVIDENCE"],
        "engine_tiers": ["deterministic"],
        "quality_gate_status": "PASSED",
        "candidate_status": "CANDIDATE",
    }


def _partial_renderer(**kwargs):
    if kwargs["kind"] == "PDF":
        raise RuntimeError("seeded PDF renderer failure")
    return render_one_artifact(**kwargs)


def _seed_contract_task(
    db,
    *,
    task_id: str,
    user_id: int,
    tenant_id: int,
    partial: bool,
) -> None:
    if db.get(DecisionTask, task_id) is not None:
        return
    task = DecisionTask(
        id=task_id,
        tenant_id=tenant_id,
        user_id=str(user_id),
        raw_question=(
            "审查合成采购合同（部分交付）"
            if partial
            else "审查合成采购合同"
        ),
        refined_edict="识别付款、验收与责任风险并生成审查包",
        status="awaiting_decision",
        source_label="LIVE",
    )
    db.add(task)
    db.flush()
    save_mission_snapshot(
        db,
        task=task,
        mission=_mission(task_id),
        state="confirmed",
    )
    pack = _review_pack(tenant_id, task_id)
    memorial = {"contract_review": pack}
    memorial_json = json.dumps(
        memorial,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    review_id = f"review-{task_id}"
    db.add(
        CourtReview(
            id=review_id,
            tenant_id=tenant_id,
            task_id=task_id,
            review_status="awaiting_decision",
            routing_plan_json="{}",
            ministry_outputs_json="[]",
            conflict_summary_json="[]",
            memorial_json=memorial_json,
        )
    )
    final = FinalMemorial(
        id=f"final-{task_id}",
        tenant_id=tenant_id,
        task_id=task_id,
        review_id=review_id,
        swarm_run_id=f"swarm-{task_id}",
        quality_result_id=f"quality-{task_id}",
        status="ready_for_decision",
        source_label="LIVE",
        memorial_json=memorial_json,
        content_hash=hashlib.sha256(
            memorial_json.encode("utf-8")
        ).hexdigest(),
        version=1,
        is_current=True,
    )
    db.add(final)
    db.flush()
    if partial:
        deliver_artifact_packet(
            db,
            storage_root=_runtime_root / "artifacts",
            tenant_id=tenant_id,
            task_id=task_id,
            final_memorial_id=final.id,
            final_memorial_version=final.version,
            payload=pack,
            delivery_formula_version="w06-v1",
            idempotency_key=f"seed-partial:{task_id}",
            requested_expiry_seconds=3600,
            renderer=_partial_renderer,
        )


from fastapi import Depends, HTTPException  # noqa: E402

from web.deps import get_current_user  # noqa: E402
from web.main import app  # noqa: E402
from web.schemas.auth import CurrentUser  # noqa: E402


@app.post("/__w07/seed", include_in_schema=False)
def _seed_authenticated_contracts(
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    if user.user_id is None or user.tenant_id is None:
        raise HTTPException(status_code=403, detail="authenticated tenant required")
    with _seed_lock:
        with engine_module.SessionLocal() as db:
            _seed_contract_task(
                db,
                task_id=_PARTIAL_TASK_ID,
                user_id=user.user_id,
                tenant_id=user.tenant_id,
                partial=True,
            )
            _seed_contract_task(
                db,
                task_id=_TASK_ID,
                user_id=user.user_id,
                tenant_id=user.tenant_id,
                partial=False,
            )
            db.commit()
    return {"status": "seeded"}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8081, log_level="warning")
