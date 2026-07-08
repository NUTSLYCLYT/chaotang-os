"""Commercial loop dashboard endpoints."""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.chaotang_department_payload import build_prime_minister_next_step
from src.production_events import record_event
from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/commercial-loop", tags=["commercial-loop"])

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_RUNNER_PATH = _PROJECT_ROOT / "harness" / "chaotang-commercial-loop" / "scripts" / "run_harness.py"


class GoldenReviewRequest(BaseModel):
    reviewer: str = "史馆"
    note: str = ""
    reference: str = ""


def _load_runner():
    spec = importlib.util.spec_from_file_location("commercial_loop_runner_api", _RUNNER_PATH)
    if not spec or not spec.loader:
        raise RuntimeError("commercial loop runner not found")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _promoted_golden_cases_path(runner) -> Path:
    return _path_from_env(
        runner,
        "FENGQUN_COMMERCIAL_GOLDEN_CASES",
        runner.HARNESS_ROOT / "artifacts" / "commercial_loop_promoted_cases.json",
    )


def _path_from_env(runner, env_name: str, default: Path) -> Path:
    configured = os.environ.get(env_name)
    if configured:
        return Path(configured)
    return default


def _commercial_paths(runner) -> dict[str, Path]:
    return {
        "business": _path_from_env(runner, "FENGQUN_COMMERCIAL_BUSINESS_LEDGER", runner.DEFAULT_BUSINESS_LEDGER),
        "candidates": _path_from_env(runner, "FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES", runner.DEFAULT_GOLDEN_CANDIDATES),
        "events": _path_from_env(runner, "FENGQUN_COMMERCIAL_EVENTS", runner.DEFAULT_EVENTS),
        "failures": _path_from_env(runner, "FENGQUN_COMMERCIAL_FAILURES", runner.DEFAULT_FAILURES),
        "promoted_cases": _promoted_golden_cases_path(runner),
    }


def _business_cards(cases: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    cards = []
    for case_id, case in sorted(cases.items()):
        cards.append(
            {
                "case_id": case_id,
                "task": case.get("task", ""),
                "source": case.get("source", ""),
                "owner": case.get("owner", "未指定"),
                "light": case.get("light", "gray"),
                "status": case.get("status", "unknown"),
                "headline": case.get("headline", ""),
                "why": case.get("why", ""),
                "next_action": case.get("next_action", "未指定"),
                "forbidden_actions": case.get("forbidden_actions", []),
                "outcome": case.get("outcome"),
                "customer_response": case.get("customer_response", ""),
                "lesson": case.get("lesson", ""),
            }
        )
    return cards


@router.get("/dashboard")
def api_commercial_loop_dashboard(_: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
    runner = _load_runner()
    paths = _commercial_paths(runner)
    business_cases = runner.load_business_cases(paths["business"])
    candidates = runner.load_golden_candidate_states(paths["candidates"])
    review = runner.build_board_review(
        business_path=paths["business"],
        event_path=paths["events"],
        failure_path=paths["failures"],
        golden_candidate_path=paths["candidates"],
    )
    pending = [c for c in candidates.values() if c.get("promotion_status") == "needs_human_review"]
    promoted = [c for c in candidates.values() if c.get("promotion_status") == "promoted"]
    rejected = [c for c in candidates.values() if c.get("promotion_status") == "rejected"]
    return {
        "board": review["board"],
        "maturity_level": review["maturity_level"],
        "counts": review["counts"],
        "business_cards": _business_cards(business_cases),
        "golden_candidates": {
            "pending": pending,
            "promoted": promoted,
            "rejected": rejected,
        },
        "missing": review["missing"],
        "build": review["build"],
        "advisor_notes": review["advisor_notes"],
    }


def _record_review_event(candidate_id: str, event: dict[str, Any], user: CurrentUser) -> None:
    review_status = str(event.get("review_status", "unknown"))
    next_action = (
        "史馆归档为商业闭环 golden case，并由兵部复用到销售/售后话术。"
        if review_status == "promoted"
        else "史馆保留拒绝理由；兵部不得复用该样本。"
    )
    record_event(
        "commercial_golden_candidate_review",
        case_id=str(event.get("case_id", "")),
        task_id=candidate_id,
        flow="commercial_loop",
        swarm="bingbu",
        step="golden_candidate_review",
        status=review_status,
        gate_status="clear",
        gate_reason=str(event.get("review_note", "")),
        tenant_slug=user.tenant_slug,
        user_role=user.role or "",
        reviewer=str(event.get("reviewer", "")),
        reference=str(event.get("reference", "")),
        prime_minister_next_step=build_prime_minister_next_step("bingbu", next_action),
        qintianjian_trigger={
            "signal": "customer_outcome_or_aftercare_feedback",
            "threshold": "any contradiction or repeated success pattern",
            "watch_window": "每次销售/售后复用后",
            "decision_change": "若真实客户反馈证伪，则撤回 golden case 并回御史复审",
        },
    )


def _review_candidate(candidate_id: str, status: str, body: GoldenReviewRequest, user: CurrentUser) -> dict[str, Any]:
    runner = _load_runner()
    paths = _commercial_paths(runner)
    try:
        event = runner.review_golden_candidate(
            candidate_path=paths["candidates"],
            golden_cases_path=paths["promoted_cases"],
            candidate_id=candidate_id,
            status=status,
            reviewer=body.reviewer,
            note=body.note,
            reference=body.reference,
        )
    except SystemExit as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _record_review_event(candidate_id, event, user)
    return {"status": event["review_status"], "event": event}


@router.post("/golden-candidates/{candidate_id}/promote")
def api_promote_golden_candidate(
    candidate_id: str,
    body: GoldenReviewRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return _review_candidate(candidate_id, "promoted", body, user)


@router.post("/golden-candidates/{candidate_id}/reject")
def api_reject_golden_candidate(
    candidate_id: str,
    body: GoldenReviewRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return _review_candidate(candidate_id, "rejected", body or GoldenReviewRequest(), user)
