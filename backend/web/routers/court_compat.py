"""Compatibility endpoints for legacy `/api/court/*` frontend contracts.

These routes live in the backend service. They do not introduce a frontend BFF;
they only expose backend-owned facts under legacy paths while callers migrate.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import Body
from fastapi import APIRouter, Depends, HTTPException

from web.deps import get_current_user
from web.routers.chaotang import task_detail
from web.schemas.auth import CurrentUser
from web.task_registry import mark_status, register_task

router = APIRouter(prefix="/api/court", tags=["court-compat"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/backend/tasks/{task_id}")
def backend_task_detail(
    task_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    payload = task_detail(task_id, user)
    if not payload.get("success"):
        raise HTTPException(status_code=404, detail=payload.get("error") or "task not found")

    data = payload.get("data") or {}
    task = data.get("task") or {}
    run_id = data.get("runId") or task.get("finalReportId")

    runs = []
    if run_id:
        runs.append(
            {
                "id": run_id,
                "taskId": task.get("id") or task_id,
                "status": task.get("status") or "running",
                "startedAt": task.get("createdAt") or "",
                "finishedAt": task.get("updatedAt") or "",
            }
        )

    return {
        "sourceLabel": task.get("sourceLabel") or task.get("source_label") or "MIXED",
        "task": task,
        "runs": runs,
        "report": {
            "sourceLabel": task.get("sourceLabel") or task.get("source_label") or "MIXED",
            "runId": run_id,
            "council": data.get("council") or [],
            "groupRuns": data.get("groupRuns") or [],
            "result": task.get("result") or {},
        },
    }


@router.post("/bureaus/{department}/{bureau}/actions")
def bureau_action(
    department: str,
    bureau: str,
    body: dict[str, Any] = Body(default_factory=dict),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """Structured backend response for legacy bureau actions.

    The browser only sends action metadata, not the full BureauPageView, so the
    backend cannot honestly return an updated view model here. Return a clear
    contract error instead of a 404 or fabricated view.
    """
    return {
        "success": False,
        "data": None,
        "error": "bureau_action_requires_backend_view_model",
        "message": (
            f"{department}/{bureau} action {body.get('action') or 'unknown'} "
            "requires a backend-owned BureauPageView aggregation endpoint."
        ),
        "sourceLabel": "FALLBACK",
    }


def _case_plan(command: str) -> dict[str, Any]:
    clean = command.strip()
    lowered = clean.lower()
    departments = ["prime_minister", "jin_yi_wei", "qin_tian_jian", "scribe"]
    primary = "prime_minister"
    if any(token in lowered for token in ["预算", "成本", "报价", "roi", "现金流", "finance"]):
        departments = ["prime_minister", "hu_bu", "jin_yi_wei", "xing_bu", "scribe"]
        primary = "hu_bu"
    elif any(token in lowered for token in ["合同", "法务", "合规", "风险", "legal"]):
        departments = ["prime_minister", "xing_bu", "jin_yi_wei", "scribe"]
        primary = "xing_bu"
    elif any(token in lowered for token in ["技术", "交付", "系统", "研发", "工程"]):
        departments = ["prime_minister", "gong_bu", "jin_yi_wei", "scribe"]
        primary = "gong_bu"
    title = clean[:30] + ("..." if len(clean) > 30 else "")
    return {
        "intentType": "general_review",
        "title": title or "军机处综合会审",
        "objective": f"把“{clean}”转成可裁决回奏：结论、证据、风险、缺口、下一步。",
        "primaryDepartment": primary,
        "departments": departments,
        "swarms": ["intent_clarifier", "source_check", "risk_scan", "memorial_writer"],
        "advisors": ["drucker", "munger", "deming"],
        "evidencePolicy": "internal_ok",
        "qualityGates": ["clear_decision_goal", "risk_boundary_declared", "next_action_single"],
        "requiredReturnSections": ["圣裁", "分奏", "证据", "缺证", "风险", "后令", "质门", "来源"],
        "answerFormat": "先给可裁决结论，再列证据和下一步。",
        "userFacingReason": "丞相先定目标，锦衣卫补证，钦天监标不确定性，史官保留闭环。",
    }


def _case_file(command: str, task_id: str) -> dict[str, Any]:
    plan = _case_plan(command)
    workstreams = [
        {
            "id": f"{task_id}-{dept}",
            "department": dept,
            "agentName": dept,
            "mission": "按本部门职责补齐判断、证据和风险。",
            "status": "working" if dept == plan["primaryDepartment"] else "queued",
            "progressPct": 20 if dept == plan["primaryDepartment"] else 0,
            "dependencies": [],
            "expectedOutput": "部门意见、证据缺口、下一步建议",
        }
        for dept in plan["departments"]
    ]
    return {
        "caseId": f"case-{task_id}",
        "taskId": task_id,
        "title": plan["title"],
        "originalCommand": command,
        "objective": plan["objective"],
        "status": "planning",
        "sourceLabel": "MIXED",
        "createdAt": _now_iso(),
        "plan": plan,
        "workstreams": workstreams,
        "qualityGates": [
            {
                "id": "source_label_declared",
                "label": "来源标注",
                "passed": True,
                "blocking": False,
                "reason": "兼容立案仅生成任务骨架，不伪装 LIVE_SWARM。",
            }
        ],
        "progressPct": 15,
        "returnPolicy": {
            "firstScreen": ["圣裁", "分奏", "质门"],
            "memorialSections": plan["requiredReturnSections"],
            "evidenceRule": plan["evidencePolicy"],
        },
        "nextActions": ["进入军机处任务主卷", "补充证据", "等待部门会审"],
    }


@router.post("/junjichu/cases")
def junjichu_cases(
    body: dict[str, Any] = Body(default_factory=dict),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    command = str(body.get("command") or "").strip()
    if len(command) < 5:
        return {"success": False, "data": None, "error": "command_too_short", "message": "请把要办的事写得再具体一点。", "sourceLabel": "FALLBACK"}
    task_id = f"junjichu-{secrets.token_hex(6)}"
    register_task(task_id, task_input=command, config="junjichu-case-compat", monitor=True)
    mark_status(task_id, "done", finished_at=_now_iso(), run_index_required=False, user_id=user.user_id)
    case = _case_file(command, task_id)
    return {
        "success": True,
        "data": {
            "case": case,
            "taskId": task_id,
            "sourceLabel": "MIXED",
            "links": {
                "commandCenter": f"/command-center?taskId={task_id}",
                "briefing": f"/command-center?view=cases&taskId={task_id}",
            },
        },
        "error": None,
        "message": "军机处已立案",
        "sourceLabel": "MIXED",
    }


@router.post("/orchestrate")
def orchestrate(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    command = str(body.get("command") or "").strip()
    task_id = f"court-orch-{secrets.token_hex(5)}"
    register_task(task_id, task_input=command, config="court-orchestrate-compat", monitor=True)
    mark_status(task_id, "done", finished_at=_now_iso(), run_index_required=False)
    return {
        "ok": True,
        "sourceLabel": "FALLBACK",
        "command": command,
        "taskId": task_id,
        "decisionId": None,
        "called": ["prime_minister"],
        "route": {"departments": ["prime_minister"], "source": "compat", "matched": {}},
        "merge": {
            "summary": "后端兼容编排已登记任务；未伪装实时蜂群结果。",
            "grounded": False,
            "leadDept": "prime_minister",
            "contributors": [],
            "conflicts": [],
        },
    }


@router.post("/orchestrate/all")
def orchestrate_all(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    result = orchestrate(body)
    result.setdefault("sourceLabel", "FALLBACK")
    result["secret"] = body.get("mode") == "secret"
    result["coverage"] = {
        "responded": ["prime_minister"],
        "absent": [],
        "realExpected": 1,
        "realResponded": 0,
    }
    result["jiqunSwarm"] = {
        "ok": False,
        "status": 202,
        "taskId": result.get("taskId"),
        "sessionId": result.get("taskId"),
        "entrySwarm": None,
        "streamUrl": None,
        "message": "兼容路径已登记，未执行实时蜂群。",
    }
    return result


@router.post("/orchestrate/sign-off")
def orchestrate_sign_off(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    basis = json_safe_hash_basis(body)
    return {"ok": True, "sourceLabel": "FALLBACK", "outcomeHash": f"compat-{basis}"}


@router.get("/zhuangyuan/ministry-metrics")
def zhuangyuan_ministry_metrics() -> dict:
    departments = ["hu_bu", "gong_bu", "xing_bu", "li_bu", "bing_bu", "li_bu_rites"]
    return {
        "success": True,
        "data": {
            dept: {
                "sourceLabel": "FALLBACK",
                "score": 0,
                "activeTasks": 0,
                "updatedAt": _now_iso(),
            }
            for dept in departments
        },
        "error": None,
    }


def json_safe_hash_basis(body: dict[str, Any]) -> str:
    import hashlib
    import json

    raw = json.dumps(body, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
