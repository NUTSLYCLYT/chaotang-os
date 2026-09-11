"""HTTP contract for Scene Pack V1 and military-office scene missions."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import ValidationError

from app.api.auth import CurrentUser
from app.scene_packs import storage
from app.scene_packs.models import BoardMission, MissionPatch, ScenePack, SceneRun, SceneRunInput


class _SceneRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            try:
                return await original(request)
            except RequestValidationError:
                return _error(422, "validation")
            except (storage.SceneUnavailableError, ValidationError):
                return _error(503, "unavailable")

        return handler


router = APIRouter(prefix="/api/v1/court", tags=["scene-packs"], route_class=_SceneRoute)

_ALLOWED_MISSION_QUERY_FIELDS = frozenset({"stage", "risk_grade", "pack_slug"})
_ALLOWED_STAGES = frozenset({"todo", "in_progress", "awaiting_input", "blocked", "done"})
_ALLOWED_RISKS = frozenset({"low", "medium", "high"})


def _error(status_code: int, reason: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"status": "error", "reason": reason})


def _next_action_json(action) -> dict[str, str]:
    return {
        "title": action.title,
        "ownerDept": action.owner_dept,
        "priority": action.priority,
        "dueHint": action.due_hint,
    }


def _evidence_json(evidence) -> dict[str, str]:
    return {
        "claim": evidence.claim,
        "sourceLabel": evidence.source_label,
        "sourceType": evidence.source_type,
        "capturedAt": evidence.captured_at,
        "reliability": evidence.reliability,
    }


def _pack_json(pack: ScenePack) -> dict[str, Any]:
    return {
        "id": pack.id,
        "slug": pack.slug,
        "name": pack.name,
        "shortValue": pack.short_value,
        "targetUser": pack.target_user,
        "defaultOwnerDept": pack.default_owner_dept,
        "sortOrder": pack.sort_order,
        "requiredInputs": pack.required_inputs,
        "optionalInputs": pack.optional_inputs,
        "outputContract": pack.output_contract,
        "enabled": pack.enabled,
        "implementationStatus": pack.implementation_status,
        "entryRoute": pack.entry_route,
        "demoAvailable": pack.demo_available,
        "canExecute": pack.enabled,
        "exampleHint": (
            "可一键载入 demo 样例，demo=true，不混入真实业务数据。"
            if pack.demo_available
            else "暂无样例"
        ),
        "createdAt": pack.created_at,
        "updatedAt": pack.updated_at,
    }


def _mission_json(mission: BoardMission) -> dict[str, Any]:
    return {
        "missionId": mission.id,
        "runId": mission.run_id,
        "packId": mission.pack_id,
        "packSlug": mission.pack_slug,
        "packName": mission.pack_name,
        "title": mission.title,
        "owner": mission.owner,
        "stage": mission.stage,
        "riskGrade": mission.risk_grade,
        "nextMilestone": mission.next_milestone,
        "dueAt": mission.due_at,
        "pinned": mission.pinned,
        "createdAt": mission.created_at,
        "updatedAt": mission.updated_at,
    }


def _run_json(run: SceneRun, mission: BoardMission | None) -> dict[str, Any]:
    details = dict(run.action_payload)
    common = {
        "runId": run.id,
        "packSlug": run.pack_slug,
        "status": run.status,
        "verdict": run.verdict,
        "verdictText": run.verdict_text,
        "confidence": run.confidence,
        "riskGrade": run.risk_grade,
        "opportunityGrade": run.opportunity_grade,
        "missingItems": run.missing_items,
        "nextActions": [_next_action_json(action) for action in run.next_actions],
        "evidenceRefs": [_evidence_json(evidence) for evidence in run.evidence_refs],
        "summaryForUser": run.result_summary,
        "canProceed": bool(details.get("canProceed", False)),
        "demo": bool(details.get("demo", False)),
        "details": details,
        "createdAt": run.created_at,
        "updatedAt": run.updated_at,
    }
    if mission is not None:
        common["missionId"] = mission.id
        common["boardMission"] = {
            "title": mission.title,
            "stage": mission.stage,
            "nextMilestone": mission.next_milestone,
        }
    if run.pack_slug == "b2b-inquiry-conversion":
        for key in (
            "leadScore",
            "authenticityScore",
            "fitScore",
            "urgencyScore",
            "paymentRiskScore",
            "conflicts",
            "recommendedReply",
            "followUpPlan",
        ):
            common[key] = details.get(key, [] if key in {"conflicts", "followUpPlan"} else None)
    return common


@router.get("/scene-packs", response_model=None)
def list_scene_packs(current_user: CurrentUser) -> dict[str, Any]:
    del current_user
    return {"status": "ok", "scenePacks": [_pack_json(pack) for pack in storage.list_scene_packs()]}


@router.get("/scene-packs/{slug}", response_model=None)
def get_scene_pack(slug: str, current_user: CurrentUser) -> dict[str, Any] | JSONResponse:
    del current_user
    pack = storage.get_scene_pack(slug)
    if pack is None:
        return _error(404, "scene_pack_not_found")
    return {"status": "ok", "scenePack": _pack_json(pack)}


@router.post("/scene-runs", response_model=None)
def create_scene_run(
    payload: dict[str, Any], current_user: CurrentUser
) -> dict[str, Any] | JSONResponse:
    try:
        normalized = dict(payload)
        if "packSlug" in normalized and "pack_slug" not in normalized:
            normalized["pack_slug"] = normalized.pop("packSlug")
        run_input = SceneRunInput.model_validate(normalized)
    except ValidationError:
        return _error(422, "validation")
    response = None

    def prepare_response(run: SceneRun, mission: BoardMission) -> None:
        nonlocal response
        response = {
            "status": "ok",
            "runId": run.id,
            "initialStatus": run.status,
            "sceneRun": _run_json(run, mission),
        }
        JSONResponse(content=response)  # Finish response serialization before either INSERT.

    try:
        run, mission = storage.create_scene_run(
            run_input,
            owner_user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            validate_response=prepare_response,
        )
    except storage.SceneUnavailableError:
        return _error(503, "unavailable")
    except LookupError:
        return _error(404, "scene_pack_not_found")
    return response


@router.get("/scene-runs/{run_id}", response_model=None)
def get_scene_run(run_id: str, current_user: CurrentUser) -> dict[str, Any] | JSONResponse:
    try:
        result = storage.get_scene_run(
            run_id,
            owner_user_id=current_user.id,
            tenant_id=current_user.tenant_id,
        )
    except (storage.SceneUnavailableError, ValidationError):
        return _error(503, "unavailable")
    if result is None:
        return _error(404, "scene_run_not_found")
    run, mission = result
    return {"status": "ok", "sceneRun": _run_json(run, mission)}


@router.get("/military-office/missions", response_model=None)
def list_missions(
    request: Request,
    current_user: CurrentUser,
    stage: str | None = None,
    risk_grade: str | None = None,
    pack_slug: str | None = None,
) -> dict[str, Any] | JSONResponse:
    keys = list(request.query_params.keys())
    if any(key not in _ALLOWED_MISSION_QUERY_FIELDS for key in keys) or any(
        len(request.query_params.getlist(key)) != 1 for key in keys
    ):
        return _error(400, "validation")
    if stage is not None and stage not in _ALLOWED_STAGES:
        return _error(400, "validation")
    if risk_grade is not None and risk_grade not in _ALLOWED_RISKS:
        return _error(400, "validation")
    missions = storage.list_board_missions(
        owner_user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        stage=stage,
        risk_grade=risk_grade,
        pack_slug=pack_slug,
    )
    return {"status": "ok", "missions": [_mission_json(mission) for mission in missions]}


@router.patch("/military-office/missions/{mission_id}", response_model=None)
def patch_mission(
    mission_id: str, payload: MissionPatch, current_user: CurrentUser
) -> dict[str, Any] | JSONResponse:
    mission = storage.update_board_mission(
        mission_id,
        payload,
        owner_user_id=current_user.id,
        tenant_id=current_user.tenant_id,
    )
    if mission is None:
        return _error(404, "mission_not_found")
    return {"status": "ok", "mission": _mission_json(mission)}
