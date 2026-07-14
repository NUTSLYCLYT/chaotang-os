# web/routers/chaotang.py
"""朝堂 OS 产品 API。统一信封 {success,data,error}。"""

from __future__ import annotations

import copy
import json
import os
import queue
import re
import secrets
import threading
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.chaotang import (
    DraftRequest,
    DispatchRequest,
    PatchTaskRequest,
    PersistTaskRequest,
    ReviewRequest,
    StudyRunRequest,
)
from src import chaotang_store
from src.tenant import with_tenant
from src.swarm_orchestrator import SESSIONS_DIR, SwarmOrchestrator
from web.task_registry import register_task, get_task, task_snapshot, mark_status
from src.step_log import load_run
from src.chaotang_agents import agent_code_of
from src.chaotang_department_router import (
    department_system_payload,
    route_department_task,
)
from src.decree_swarm_router import (
    select_model_tier,
    select_orchestration_tier,
)
from src.securities_redline import route_with_redline_precheck
from src.chaotang_launch_loop import (
    build_launch_loop_case,
    build_prior_context,
    evaluate_launch_loop_case,
    find_by_idempotency_key,
    launch_loop_archive_path,
    read_launch_loop_cases,
    recall_prior_cases,
    write_launch_loop_archive,
)
from src.manor_groups import load_manor_groups
from src.production_events import record_event
from web.routers._envelope import ok, fail

router = APIRouter(prefix="/api/chaotang", tags=["chaotang"])

_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _validate_id(id_str: str) -> bool:
    """仅允许安全字符集,防止路径穿越(path traversal)攻击。"""
    return bool(_SAFE_ID_RE.match(id_str))


def _system_status() -> dict:
    overall, litellm = "ok", "up"
    if not os.getenv("DASHSCOPE_API_KEY"):
        overall, litellm = "degraded", "down"
    return {"overall": overall, "litellm": litellm, "knowledge": "ok"}


@router.get("/throne/overview")
def throne_overview(_: CurrentUser = Depends(get_current_user)) -> dict:
    from src.chaotang_api import aggregate_ministers, aggregate_risks, MINISTER_DEFS
    from web.routers.throne import _build_memorial_list

    memorials = _build_memorial_list()
    # 收集在跑任务的部门集合,注入 aggregate_ministers(P1-2)
    _running_depts = [
        dept
        for t in task_snapshot().values()
        if t.get("status") == "running"
        for dept in (t.get("departments") or [])
    ]
    # 用 aggregate_ministers 推断真实大臣状态(非全 idle)
    minister_statuses = {
        m["department"]: m for m in aggregate_ministers(memorials, _running_depts)
    }
    ministers = []
    for d in MINISTER_DEFS:
        ms = minister_statuses.get(d["department"], {})
        ministers.append(
            {
                "id": d["id"],
                "agentCode": agent_code_of(d["department"]),
                "name": d["name"],
                "role": d["role"],
                "department": d["department"],
                "status": ms.get("status", "idle"),
                "pendingCount": ms.get("pendingCount", 0),
                "riskLevel": ms.get("riskLevel", "low"),
                "lastAction": ms.get("lastAction"),
                "lastRunId": ms.get("lastRunId"),
                "currentTaskTitle": None,
                "latestSummary": None,
                "route": d.get("route", ""),
            }
        )
    risks = aggregate_risks(memorials, limit=5)
    pending = sum(1 for m in memorials if m.get("status") == "running")
    pulse = {
        "activeTasks": sum(1 for m in memorials if m.get("status") == "running"),
        "pendingDecisions": pending,
        "riskCount": len(risks),
        "opportunityCount": sum(1 for m in memorials if m.get("priority") == "high"),
        "memorialsToday": len(memorials[:5]),
        "swarmActivity": sum(1 for m in memorials if m.get("status") == "running"),
    }
    return ok(
        {
            "ministers": ministers,
            "pulse": pulse,
            "memorialsToday": memorials[:5],
            "risks": [
                {
                    "label": r.get("title", ""),
                    "level": r.get("level", "low"),
                    "memorialId": str(r.get("id", "")).replace("risk_", ""),
                }
                for r in risks
            ],
            "systemStatus": _system_status(),
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
        }
    )


@router.get("/manor/groups")
def manor_groups(_: CurrentUser = Depends(get_current_user)) -> dict:
    out = []
    for g in load_manor_groups():
        out.append(
            {
                "id": g.id,
                "name": g.name,
                "ministers": g.ministers,
                "runtime": g.resolved_runtime(),
                "subagentCount": g.subagent_max,
                "description": g.desc,
            }
        )
    return ok(out)


@router.get("/system/status")
def system_status(_: CurrentUser = Depends(get_current_user)) -> dict:
    return ok(_system_status())


@router.get("/department-system")
def department_system(_: CurrentUser = Depends(get_current_user)) -> dict:
    """六部、蜂群调用和大神设计规则的只读系统契约。"""
    return ok(department_system_payload())


class _DepartmentRouteRequest(BaseModel):
    task: str
    context: str = ""


@router.post("/department-system/route")
def department_system_route(
    body: _DepartmentRouteRequest, _: CurrentUser = Depends(get_current_user)
) -> dict:
    """根据任务文本建议应召集的六部和蜂群；只给派单建议，不执行蜂群。"""
    task = (body.task or "").strip()
    if not task:
        return fail("task 不能为空")
    text = task if not body.context else f"{body.context}\n{task}"
    return ok(route_department_task(text))


@router.post("/decree/draft")
def decree_draft(
    body: DraftRequest, _: CurrentUser = Depends(get_current_user)
) -> dict:
    from src import chaotang_orchestrator as orch

    try:
        return ok(orch.draft_decree(body.rawCommand))
    except Exception as e:
        return fail(str(e))


def _spawn_run(
    task_id, q, flow_path, budget_calls, min_success, task_input="", stakes="low"
):
    from src import chaotang_orchestrator as orch

    def _run():
        try:
            orch.run_chaotang_task(
                task_id,
                q,
                flow_path=flow_path,
                task_input=task_input,
                budget_max_calls=budget_calls,
                min_success_groups=min_success,
                stakes=stakes,
            )
        except Exception as e:
            q.put({"type": "error", "message": str(e)})

    threading.Thread(target=with_tenant(_run), daemon=True).start()


@router.post("/decree/dispatch")
def decree_dispatch(
    body: DispatchRequest, user: CurrentUser = Depends(get_current_user)
) -> dict:
    from src import chaotang_orchestrator as orch

    ALL_GROUPS = ["intel", "content", "finlaw", "rnd", "exec", "review"]
    if body.councilAll:
        from src.manor_groups import load_manor_groups

        ministers = sorted({m for g in load_manor_groups() for m in g.ministers})
        if body.selectedCategories:
            ministers = sorted(
                set(ministers)
                | {m for c in body.selectedCategories for m in c.ministers}
            )
        groups = ALL_GROUPS
        task_type = "strategy"
    else:
        chosen = body.selectedCategories
        if not chosen:
            return fail("selectedCategories 不能为空(或设 councilAll=true)")
        ministers = sorted({m for c in chosen for m in c.ministers})
        groups, seen = [], set()
        for c in chosen:
            for g in c.groups:
                if g not in seen:
                    seen.add(g)
                    groups.append(g)
        task_type = chosen[0].taskType
    intent = body.intent or body.rawCommand[:60]
    task_id = secrets.token_hex(8)
    # 推断部门 slug 列表,供 dept/overview activeTasks 按部门过滤(P1-10)
    from src.chaotang_agents import dept_of_agent_code

    task_depts = sorted({dept_of_agent_code(m) for m in ministers})
    accepted_at = datetime.now().isoformat(timespec="seconds")
    plan = {
        "rawCommand": body.rawCommand,
        "intent": intent,
        "taskType": task_type,
        "ministers": ministers,
        "groups": groups,
    }
    max_sub = body.budget.maxSubagentsPerGroup if body.budget else None
    flow_path = orch.assemble_flow(
        plan, task_id=task_id, max_subagents_per_group=max_sub
    )
    budget_calls = (
        body.budget.maxCalls if body.budget and body.budget.maxCalls is not None else 80
    )
    stakes = getattr(body, "stakes", "low") or "low"
    # 正式任务事实与旧 execution 索引先在同一事务提交。只有提交成功后才允许
    # 注册内存队列并启动后台蜂群，避免“执行已开始、数据库却没有任务”的幽灵任务。
    from src.chancellor.decree_status import record_timeline_event
    from src.compat_decision_adapter import add_compat_decision_task
    from src.db.engine import SessionLocal
    from src.db.flow_store import save_decree_and_task
    from src.chaotang_store import _get_default_tenant_id  # type: ignore[attr-defined]

    _db = SessionLocal()
    try:
        add_compat_decision_task(
            _db,
            task_id=task_id,
            user_id=str(user.user_id or user.username or user.tenant_slug or "anonymous"),
            command=body.rawCommand,
            source_label="MIXED",
            compat_entrypoint="chaotang.decree_dispatch",
            status="executing",
            draft_context={
                "human_confirmed": True,
                "confirmed_at": accepted_at,
                "dispatch_plan": plan,
            },
        )
        record_timeline_event(
            _db,
            task_id=task_id,
            stage="executing",
            actor="emperor",
            message="皇上通过兼容派单入口确认下旨，任务进入执行。",
            event_type="dispatch.started",
            source_label="MIXED",
            payload={"intent": intent, "task_type": task_type, "plan": plan},
            idempotency_key=f"dispatch.started:{task_id}",
        )
        save_decree_and_task(
            session=_db,
            task_id=task_id,
            raw_command=body.rawCommand,
            intent=intent,
            task_type=task_type,
            ministers=ministers,
            groups=groups,
            departments=task_depts,
            started_at=accepted_at,
            tenant_id=_get_default_tenant_id(),
            user_id=_safe_user_id(user.user_id),
        )
        _db.commit()
    except Exception as exc:
        _db.rollback()
        return fail(f"dispatch_persistence_failed: {exc}")
    finally:
        _db.close()

    q = register_task(
        task_id,
        task_input=body.rawCommand,
        config="(chaotang)",
        monitor=True,
        departments=task_depts,
        decision_task_id=task_id,
    )
    _spawn_run(task_id, q, flow_path, budget_calls, 1, body.rawCommand, stakes=stakes)
    budget_out = body.budget.model_dump() if body.budget else None
    return ok(
        {
            "taskId": task_id,
            "status": "running",
            "acceptedAt": accepted_at,
            "streamUrl": f"/api/chaotang/stream/{task_id}",
            "intent": intent,
            "taskType": task_type,
            "ministers": ministers,
            "groups": groups,
            "budget": budget_out,
        }
    )


@router.get("/stream/{task_id}")
def decree_stream(
    task_id: str, _: CurrentUser = Depends(get_current_user)
) -> StreamingResponse:
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task 不存在")
    q: queue.Queue = task["queue"]

    def gen():
        try:
            while True:
                try:
                    ev = q.get(timeout=8)
                    yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                    if ev.get("type") in ("done", "error"):
                        break
                except queue.Empty:
                    yield 'data: {"type": "heartbeat"}\n\n'
        except GeneratorExit:
            return

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


_RUNSTATE_TO_TASKSTATUS = {
    "running": "running",
    "done": "report_ready",
    "error": "failed",
}


def _progress(t: dict) -> int:
    done, total = t.get("completed_steps", 0) or 0, t.get("total_steps") or 0
    return (
        int(done / total * 100) if total else (100 if t.get("status") == "done" else 0)
    )


def _safe_user_id(value: object) -> int | None:
    return value if isinstance(value, int) else None


def _default_tenant_id() -> int:
    try:
        return chaotang_store._get_default_tenant_id()
    except Exception:
        return 1


@router.post("/tasks/persist")
def task_persist(
    body: PersistTaskRequest, user: CurrentUser = Depends(get_current_user)
) -> dict:
    from src.db.engine import SessionLocal
    from src.db.flow_store import upsert_persisted_task

    task_id = (body.taskId or "").strip() or f"task_{secrets.token_hex(8)}"
    if not _validate_id(task_id):
        return fail("invalid task_id")

    db = SessionLocal()
    try:
        record = upsert_persisted_task(
            session=db,
            task_id=task_id,
            raw_command=body.command.strip(),
            title=body.title,
            status=body.status,
            mode=body.mode,
            result=body.result,
            at=body.at,
            tenant_id=_default_tenant_id(),
            user_id=_safe_user_id(getattr(user, "user_id", None)),
        )
        db.commit()
        if isinstance(record, dict):
            record.setdefault("sourceLabel", "LIVE")
        return ok(record)
    except Exception as exc:
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.patch("/tasks/{task_id}/persist")
def task_persist_patch(
    task_id: str, body: PatchTaskRequest, user: CurrentUser = Depends(get_current_user)
) -> dict:
    if not _validate_id(task_id):
        return fail("invalid task_id")

    from src.db.engine import SessionLocal
    from src.db.flow_store import patch_persisted_task_result

    db = SessionLocal()
    try:
        record = patch_persisted_task_result(
            session=db,
            task_id=task_id,
            status=body.status,
            result=body.result,
            raw_command=body.command.strip() if body.command else None,
            title=body.title,
            mode=body.mode,
            at=body.at,
            tenant_id=_default_tenant_id(),
            user_id=_safe_user_id(getattr(user, "user_id", None)),
        )
        if record is None:
            db.rollback()
            return fail(f"task {task_id} does not exist")
        db.commit()
        if isinstance(record, dict):
            record.setdefault("sourceLabel", "LIVE")
        return ok(record)
    except Exception as exc:
        db.rollback()
        return fail(str(exc))
    finally:
        db.close()


@router.get("/tasks")
def tasks_list(
    limit: int = Query(100, ge=1, le=200), _: CurrentUser = Depends(get_current_user)
) -> dict:
    """任务列表:内存在飞任务优先,重启后从 DB 读历史任务补全。"""
    # 内存在飞任务
    live = {}
    for tid, t in task_snapshot().items():
        live[tid] = {
            "sourceLabel": "LIVE",
            "taskId": tid,
            "title": (t.get("task_input") or "")[:40] or "未命名",
            "status": _RUNSTATE_TO_TASKSTATUS.get(t.get("status"), "running"),
            "progressPct": _progress(t),
            "id": tid,
            "title": (t.get("task_input") or "")[:80] or tid,
            "rawCommand": t.get("task_input", ""),
            "status": t.get("task_status")
            or _RUNSTATE_TO_TASKSTATUS.get(t.get("status"), "running"),
            "mode": "live",
            "createdAt": t.get("started_at", ""),
            "updatedAt": t.get("finished_at") or t.get("started_at", ""),
            "result": t.get("result") if isinstance(t.get("result"), dict) else {},
        }
    # DB 历史任务补全(重启后内存为空时兜底)
    try:
        from src.db.engine import SessionLocal
        from src.db.flow_store import ensure_task_result_json_column, task_record
        from src.db.models import Task as DbTask

        _db = SessionLocal()
        try:
            ensure_task_result_json_column(_db)
            rows = (
                _db.query(DbTask)
                .order_by(DbTask.updated_at.desc(), DbTask.created_at.desc())
                .limit(limit)
                .all()
            )
            for r in rows:
                # 内存优先:内存已有该任务则跳过,DB 仅在内存为空时兜底历史终态。
                if r.task_id not in live:
                    record = task_record(r)
                    if isinstance(record, dict):
                        record.setdefault("sourceLabel", "LIVE")
                    live[r.task_id] = record
            _db.commit()
        finally:
            _db.close()
    except Exception as _e:
        # 不再静默吞错:DB 历史合并失败若无声,会让全部历史任务凭空消失而无人知。
        import logging as _logging

        _logging.getLogger(__name__).warning("tasks_list DB 历史合并失败: %s", _e)
    out = sorted(
        live.values(),
        key=lambda x: x.get("updatedAt") or x.get("createdAt") or x.get("taskId") or "",
        reverse=True,
    )
    return ok(out[:limit])


@router.get("/tasks/{task_id}")
def task_detail(task_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    """任务详情:内存优先,重启后从 DB 恢复终态(静态渲染,无 SSE queue)。"""
    t = get_task(task_id)
    _db_fallback = False
    if not t:
        # DB fallback:重启后内存清空,从 tasks 表读历史终态
        try:
            from src.db.engine import SessionLocal
            from src.db.flow_store import ensure_task_result_json_column, task_record
            from src.db.models import Task as DbTask

            _db2 = SessionLocal()
            try:
                ensure_task_result_json_column(_db2)
                row = _db2.query(DbTask).filter_by(task_id=task_id).first()
                if row:
                    persisted = task_record(row)
                    t = {
                        "sourceLabel": "LIVE",
                        "status": row.status,
                        "task_status": row.task_status,
                        "title": persisted.get("title") or "",
                        "task_input": row.task_input or "",
                        "mode": persisted.get("mode") or "hybrid",
                        "result": persisted.get("result") or {},
                        "run_id": row.run_id,
                        "started_at": row.started_at or "",
                        "finished_at": row.finished_at or "",
                        "created_at": persisted.get("createdAt") or "",
                        "updated_at": persisted.get("updatedAt") or "",
                        "completed_steps": row.completed_steps or 0,
                        "total_steps": row.total_steps or 0,
                    }
                    _db_fallback = True
                _db2.commit()
            finally:
                _db2.close()
        except Exception:
            pass
    if not t:
        return fail(f"task {task_id} 不存在")
    run_id = t.get("run_id")
    result = t.get("result") if isinstance(t.get("result"), dict) else {}
    display_status = t.get("task_status") or _RUNSTATE_TO_TASKSTATUS.get(
        t.get("status"), "running"
    )
    council, group_runs = [], []
    if run_id:
        run = load_run(run_id)
        if run:
            for s in run.steps:
                name = s.agent_name or ""
                if name.startswith("council_"):
                    council.append(
                        {
                            "agentCode": name[len("council_") :],
                            "name": name,
                            "opinion": (s.output or "")[:800],
                            "qualityScore": (
                                (s.quality_score or {}).get("total_score")
                                if s.quality_score
                                else None
                            ),
                            "status": s.status,
                        }
                    )
                elif name.startswith("group_") and not name.endswith("_dispatch"):
                    group_runs.append(
                        {
                            "groupId": name[len("group_") :],
                            "name": name,
                            "status": s.status,
                            "subagents": [],
                            "aggregateSummary": (s.output or "")[:800],
                        }
                    )
    return ok(
        {
            "task": {
                "id": task_id,
                "sourceLabel": "LIVE",
                "title": t.get("title") or (t.get("task_input") or "")[:80],
                "rawCommand": t.get("task_input", ""),
                "status": display_status,
                "mode": t.get("mode") or "live",
                "createdAt": t.get("created_at") or t.get("started_at", ""),
                "updatedAt": t.get("updated_at") or t.get("finished_at") or "",
                "finalReportId": run_id,
                "result": result,
            },
            "council": council,
            "groupRuns": group_runs,
            "runId": run_id,
        }
    )


@router.get("/memorials")
def memorials_list(_: CurrentUser = Depends(get_current_user)) -> dict:
    """奏折列表:优先读 DB memorials 表(含新 dispatch 终态),空时 fallback JSON 扫描。

    M-3/GAP-1: DB 表有数据时直接返回 MemorialBrief 格式,无需重扫 60 个 run 目录。
    两路结果按 createdAt 降序合并:DB 条目(含持久终态)优先,JSON 路扫描补缺。
    """
    from web.routers.throne import _build_memorial_list

    # 尝试读 DB
    db_items: dict[str, dict] = {}
    try:
        from src.db.engine import SessionLocal
        from src.db.models import Memorial as DbMemorial

        _db = SessionLocal()
        try:
            rows = (
                _db.query(DbMemorial)
                .order_by(DbMemorial.created_at.desc())
                .limit(200)
                .all()
            )
            for r in rows:
                db_items[r.memorial_id] = {
                    "id": r.memorial_id,
                    "title": r.title,
                    "sourceDepartment": r.source_department,
                    "agentCode": r.agent_code,
                    "priority": r.priority,
                    "status": r.status,
                    "summary": r.summary,
                    "createdAt": r.created_at,
                }
        finally:
            _db.close()
    except Exception:
        pass
    # JSON fallback(补齐 DB 没有的旧 run + 提供 riskLevel 等完整字段)
    json_items = _build_memorial_list()
    if not db_items:
        # DB 为空(未迁移/首次),直接返回 JSON 路径
        return ok(json_items)
    # 合并:DB 条目 status 优先覆盖 JSON 派生状态
    merged: dict[str, dict] = {}
    for m in json_items:
        merged[m["id"]] = m
    for mid, db_m in db_items.items():
        if mid in merged:
            # DB 持久 status 覆盖 JSON 派生 status
            merged[mid] = {**merged[mid], "status": db_m["status"]}
        else:
            merged[mid] = db_m
    out = sorted(merged.values(), key=lambda x: x.get("createdAt", ""), reverse=True)
    return ok(out)


@router.get("/memorials/{run_id}")
def memorial_detail(run_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    if not _validate_id(run_id):
        return fail("无效的 run_id")
    from src.chaotang_api import enrich_memorial, build_memorial_sections
    from web.run_utils import run_summary

    run = load_run(run_id)
    if not run:
        return fail(f"奏折 {run_id} 不存在")
    summary = run_summary(run)
    summary["final_output"] = run.final_output
    mem = enrich_memorial(summary)
    # 批阅后持久状态覆盖 run 派生状态
    persisted = chaotang_store.get_memorial_status(run_id)
    if persisted:
        mem = {**mem, "status": persisted}
    return ok(
        {
            **mem,
            "memorial": build_memorial_sections(run.final_output),
            "fullContent": run.final_output or {},
            "review": chaotang_store.get_review_for_memorial(run_id),
        }
    )


@router.post("/memorials/{run_id}/review")
def memorial_review(
    run_id: str, body: ReviewRequest, user: CurrentUser = Depends(get_current_user)
) -> dict:
    if not _validate_id(run_id):
        return fail("无效的 run_id")
    run = load_run(run_id)
    if run is None:
        return fail(f"奏折 {run_id} 不存在")
    try:
        rec = chaotang_store.save_review(
            run_id,
            action=body.action,
            comment=body.comment,
            reviewer=getattr(user, "username", "皇上") or "皇上",
        )
    except ValueError as e:
        return fail(str(e))
    # 批阅后立即失效 memorial 缓存,下次列表端点返回更新后状态
    from web.routers.throne import _CT_MEMORIAL_CACHE

    _CT_MEMORIAL_CACHE["expires_at"] = 0.0
    task_status = "archived" if body.action == "approve" else "reviewed"
    if body.action == "approve" and run.final_output:
        from src.chaotang_api import build_memorial_sections

        sec = build_memorial_sections(run.final_output)
        chaotang_store.feedback_to_knowledge(
            title=(run.task_input or run_id)[:60],
            content=f"{sec['background']}\n{sec['recommendation']}",
        )
    return ok({**rec, "taskStatus": task_status})


@router.get("/study/briefing")
def study_briefing(_: CurrentUser = Depends(get_current_user)) -> dict:
    from web.routers.throne import _build_memorial_list

    memorials = _build_memorial_list()
    # 待裁决:running(进行中) + pending(等待批阅) 都需要关注
    pending = [m for m in memorials if m.get("status") in ("running", "pending")][:5]
    events = []
    for m in memorials[:8]:
        events.append(
            {
                "dept": m.get("sourceDepartment", ""),
                "agentCode": m.get("agentCode", "scribe"),
                "title": m.get("title", ""),
                "tag": "需关注",
                "priority": m.get("priority", "medium"),
                "at": m.get("createdAt", ""),
            }
        )
    tasks = [
        {
            "taskId": tid,
            "title": (t.get("task_input") or "")[:40],
            "status": _RUNSTATE_TO_TASKSTATUS.get(t.get("status"), "running"),
            "progressPct": _progress(t),
        }
        for tid, t in task_snapshot().items()
    ][:6]
    return ok(
        {
            "dailyReport": {
                "memorialTotal": len(memorials),
                "importantEvents": len(events),
                "pendingDecisions": len(pending),
                "handledToday": sum(
                    1 for m in memorials if m.get("status") == "approved"
                ),
            },
            "importantEvents": events,
            "pendingDecisions": [
                {
                    "memorialId": m["id"],
                    "dept": m.get("sourceDepartment", ""),
                    "title": m.get("title", ""),
                    "summary": m.get("summary", ""),
                    "priority": m.get("priority", "medium"),
                    "urgent": m.get("priority") == "high",
                }
                for m in pending
            ],
            "recommendations": [
                {
                    "icon": "alert",
                    "title": "优先处理紧急事项",
                    "detail": f"今日 {len(pending)} 件待裁决",
                    "actionHref": "/court-briefing",
                }
            ],
            "recentMemorials": memorials[:5],
            "recentTasks": tasks,
        }
    )


@router.post("/study/run")
def study_run_edict(
    body: StudyRunRequest, user: CurrentUser = Depends(get_current_user)
) -> dict:
    """把上书房输入和蜂群/奏折现状编排成前端圣旨可直接显示的 edict 合同。

    第一版是 deterministic contract: 不依赖模型/provider, 先让前端稳定展示
    「结论、分奏、证据、风险、下一步、质量门、run_id」。后续真实蜂群 run
    只需要填充同一结构。
    """
    from web.routers.throne import _build_memorial_list

    command = body.command.strip()
    memorials = _build_memorial_list()
    selected = _select_edict_memorials(memorials, body.taskId)
    edict = _build_study_edict(
        command=command, mode=body.mode, task_id=body.taskId, memorials=selected
    )
    tenant = user.tenant_slug or "default"
    # 幂等短路：同一 (租户, key) 重放只记一次，直接返回原案，不重复写库/发事件。
    # 注意：在跑蜂群之前短路，避免重放也触发 51s live 执行。
    if body.idempotencyKey:
        existing = find_by_idempotency_key(tenant, body.idempotencyKey)
        if existing is not None:
            return ok(
                {
                    "edict": edict,
                    "launchLoopCase": existing,
                    "launchLoopGate": evaluate_launch_loop_case(existing),
                    "launchLoopArchive": {
                        "archivePath": str(launch_loop_archive_path()),
                        "case_id": existing["case_id"],
                    },
                    "idempotentReplay": True,
                }
            )
    # 异步 live：不阻塞 HTTP（蜂群 ~51s > 代理 20s 必 502）。立即交接 taskId + skeleton，
    # 蜂群后台跑完经 /api/chaotang/stream/{taskId} 推送最终 LIVE_SWARM edict。
    if body.mode == "live" and body.asyncRun:
        return _dispatch_study_live_async(
            edict=edict, command=command, body=body, tenant=tenant
        )
    # 同步路径：dry_run 是诚实主线；live 同步仅供内网直连 / 测试 / 短任务（仍可能超代理时）。
    if body.mode == "live":
        edict = _attach_live_study_run(
            edict=edict,
            command=command,
            entry_swarm=body.entrySwarm,
            provider=body.provider,
        )
    return ok(
        _finalize_study_run(edict=edict, command=command, body=body, tenant=tenant)
    )


def _finalize_study_run(
    *, edict: dict, command: str, body: StudyRunRequest, tenant: str
) -> dict:
    """把 edict 落成 launch-loop 真案（读回历史 prior → 建案 → 质门 → 归档 → 记事件）。

    同步与异步 live 两条路共用同一收口，保证回奏结构、归档、飞轮事件完全一致。
    """
    source_id = body.taskId or str(edict.get("run_id", ""))
    # 闭环读侧：把同一租户同一任务的历史真案读回来，喂进本次 case（attempt / scoreDelta / goldenCandidate）。
    prior_context = build_prior_context(
        recall_prior_cases(source_id, tenant_slug=tenant)
    )
    launch_case = build_launch_loop_case(
        command=command,
        edict=edict,
        source_id=source_id,
        prior_context=prior_context,
        tenant_slug=tenant,
        idempotency_key=body.idempotencyKey,
    )
    launch_gate = evaluate_launch_loop_case(launch_case)
    archive_write = write_launch_loop_archive(launch_case)
    prior_view = (
        launch_case.get("prior", {})
        if isinstance(launch_case.get("prior"), dict)
        else {}
    )
    run_adapter = (
        edict.get("run_adapter") if isinstance(edict.get("run_adapter"), dict) else {}
    )
    record_event(
        "launch_loop_case_created",
        case_id=launch_case["case_id"],
        task_id=launch_case.get("taskId", ""),
        run_id=launch_case.get("runId", ""),
        session_id=run_adapter.get("session_id", ""),
        status=launch_case.get("status", ""),
        gate_status="clear" if launch_gate["passed"] else "blocked",
        gate_reason=",".join(launch_gate["reasons"]),
        flow="chaotang_launch_loop",
        swarm=run_adapter.get("entry_swarm", ""),
        source_mode=launch_case.get("sourceMode", ""),
        next_action=launch_case.get("nextAction", {}),
        attempt=launch_case.get("attempt", 1),
        prior_runs=prior_view.get("priorRuns", 0),
        score_delta=prior_view.get("scoreDelta"),
        tenant_slug=tenant,
        archive_path=archive_write["archivePath"],
    )
    return {
        "edict": edict,
        "launchLoopCase": launch_case,
        "launchLoopGate": launch_gate,
        "launchLoopArchive": archive_write,
    }


def _dispatch_study_live_async(
    *, edict: dict, command: str, body: StudyRunRequest, tenant: str
) -> dict:
    """立即返回 taskId + running skeleton，蜂群后台跑，结果走 SSE。绕开代理超时死结。"""
    task_id = f"study-live-{secrets.token_hex(4)}"
    edict["run_status"] = "running"
    edict["async"] = True
    q = register_task(task_id, task_input=command, config="(study-live)", monitor=True)
    # 不静默：异步派发记进事件流，账面可见这条 live 走了后台、去了哪个蜂群。
    record_event(
        "study_live_async_dispatched",
        task_id=task_id,
        command=command[:120],
        entry_swarm=body.entrySwarm or "",
        tenant_slug=tenant,
        source_mode="LIVE_SWARM_PENDING",
    )
    # 给后台线程一份独立副本：避免它在 FastAPI 序列化同步响应前改写 skeleton（竞争）。
    worker_edict = copy.deepcopy(edict)
    threading.Thread(
        target=with_tenant(_run_study_live_async),
        args=(task_id, q, worker_edict, command, body, tenant),
        daemon=True,
    ).start()
    return ok(
        {
            "taskId": task_id,
            "status": "running",
            "isAsync": True,
            "streamUrl": f"/api/chaotang/stream/{task_id}",
            "edict": edict,
        }
    )


def _run_study_live_async(
    task_id: str,
    q: queue.Queue,
    edict: dict,
    command: str,
    body: StudyRunRequest,
    tenant: str,
) -> None:
    """后台线程：跑真实蜂群 → 收口落案 → 把最终 edict 推 SSE。

    任何异常都必须送回 SSE（type=error），绝不静默吞（真链路纪律：fail loud）。
    """
    try:
        q.put({"type": "stage", "stage": "swarm_dispatched", "taskId": task_id})
        full_edict = _attach_live_study_run(
            edict=edict,
            command=command,
            entry_swarm=body.entrySwarm,
            provider=body.provider,
        )
        full_edict["run_status"] = "done"
        full_edict.pop("async", None)
        data = _finalize_study_run(
            edict=full_edict, command=command, body=body, tenant=tenant
        )
        mark_status(task_id, "done")
        q.put({"type": "done", "taskId": task_id, "data": data})
    except Exception as e:  # noqa: BLE001 — 后台错误必须回流 SSE，不能静默
        mark_status(task_id, "error", error=str(e))
        q.put({"type": "error", "message": str(e)})


@router.get("/launch-loop/cases")
def launch_loop_cases(
    limit: int = Query(default=50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Read durable launch-loop cases for Shiguan recall and dashboards (tenant-scoped)."""
    cases = read_launch_loop_cases(
        limit=limit, tenant_slug=user.tenant_slug or "default"
    )
    return ok(
        {
            "count": len(cases),
            "cases": cases,
            "latest": cases[-1] if cases else None,
        }
    )


_SEVERITY_ORDER = {"high": 3, "medium": 2, "low": 1}


def _extract_dissent(runs: list) -> dict | None:
    """从蜂群 run 的 qa_result 提炼**单条最强异见**(体验会审钦点:一条「臣斗胆」,非平铺)。

    优先级:失败的硬核查(C1-C8,代码强制,最硬的盲点)> 最高 severity 的质检 issue。
    护栏(铁律·真链路):无 FAIL 硬核查且无 issue → 返回 None,前端据此显「本议无异见·全员一致」,
    **严禁造假异见**(捏造的反对声音比没有更毁信任)。返回的 top_issue 即圣旨上可点开的"凭何"。
    """
    best: dict | None = None
    best_rank = -1
    failed_checks: list[str] = []
    for run in runs:
        qa = getattr(run, "qa_result", None)
        if not isinstance(qa, dict):
            continue
        for name, verdict in (qa.get("hard_checks") or {}).items():
            if str(verdict).upper() == "FAIL" and name not in failed_checks:
                failed_checks.append(name)
        qs = qa.get("quality_score")
        issues = qs.get("issues") if isinstance(qs, dict) else None
        for it in issues or []:
            rank = _SEVERITY_ORDER.get(str(it.get("severity", "")).lower(), 0)
            if rank > best_rank:
                best_rank = rank
                best = {
                    "field": it.get("field", ""),
                    "problem": str(it.get("problem", ""))[:280],
                    "suggestion": str(it.get("suggestion", ""))[:200],
                    "severity": it.get("severity", ""),
                    "source_agent": it.get("source_agent", ""),
                    "run_id": getattr(run, "run_id", ""),
                }
    if best is None and not failed_checks:
        return None
    if failed_checks:
        headline = f"硬核查未过:{'、'.join(failed_checks[:2])}"
    else:
        headline = (
            f"{best['field']}:{best['problem'][:36]}" if best else "存在待补证之处"
        )
    return {"headline": headline, "failed_checks": failed_checks, "top_issue": best}


def _attach_live_study_run(
    *,
    edict: dict,
    command: str,
    entry_swarm: str | None,
    provider: str | None,
) -> dict:
    """Run the real swarm adapter and merge auditable session evidence into edict."""
    config_path = "config/swarm_orchestrator.yaml"
    orch = SwarmOrchestrator(config_path, provider=provider)
    # 按密旨内容选对蜂群,取代旧的"盲投 ai_ops"默认(就绪度审计根因:储能密旨被 ai_ops 答非所问)。
    if entry_swarm:
        selected_entry = entry_swarm
    else:
        routed = route_with_redline_precheck(command, orch.swarms)
        # 证券红线无合规落点 → 拒绝,绝不下放给 orch.run 的默认兜底(会审 MEDIUM:防 fail-open 到业务蜂群)
        if routed.get("needs_compliance"):
            raise HTTPException(
                status_code=422,
                detail="证券/投资类问题需合规蜂群或人工裁决,当前无合规落点,已拒绝自动派单。",
            )
        selected_entry = routed["swarm"]
        # 不静默:把意图路由决策记进事件流,账面可见密旨去了哪个蜂群、为什么。
        record_event(
            "decree_swarm_routed",
            command=command[:120],
            selected_swarm=selected_entry,
            reason=routed["reason"],
            matched=routed["matched"],
        )
    # §8 四档编排:把"是否值得多 agent + 用哪档"做成一次显式可观测决策(decision_class
    # 暂由 command 关键词推断,待 StudyRunRequest.v2 接入后改传真值)。value_thesis=回本理由。
    tier_decision = select_orchestration_tier(command, entry_swarm=selected_entry)
    record_event(
        "orchestration_tier_selected",
        command=command[:120],
        tier=tier_decision["tier"],
        value_thesis=tier_decision["value_thesis"],
        reason=tier_decision["reason"],
        entry_swarm=selected_entry,
    )
    # A2②:分层模型路由(该用哪档脑子:红线人工/Hermes专家/litellm/本地免费),可观测
    model_tier = select_model_tier(command)
    record_event(
        "model_tier_selected",
        command=command[:120],
        model_tier=model_tier["tier"],
        target=model_tier["target"],
        cost=model_tier["cost"],
        reason=model_tier["reason"],
    )
    session_id = f"study-live-{secrets.token_hex(4)}"
    session = orch.run(
        task_input=command,
        entry_swarm=selected_entry,
        session_id=session_id,
    )
    runs = list(getattr(session, "swarm_runs", []) or [])
    completed_runs = [run for run in runs if getattr(run, "status", "") == "completed"]
    failed_runs = [run for run in runs if getattr(run, "status", "") == "failed"]
    scores = [
        float(getattr(run, "quality_score"))
        for run in runs
        if isinstance(getattr(run, "quality_score", None), (int, float))
    ]
    normalized_score = (
        round(max(scores) / 10, 2)
        if scores and max(scores) > 5
        else round(max(scores or [0.0]) / 5, 2)
    )
    # 空输出不许亮绿(feedback_stop_tampering):completed 但无实质评分(scores 空或全 0)= 空产出。
    # golden-loop 实测 opc status=completed 却产出 {}、无 quality_score,旧逻辑判 passed@0.0(戏台)。
    # fail-secure:跑完但没真产出一律判 needs_review,逼人工复核,绝不冒充通过。
    has_real_output = bool(scores) and max(scores) > 0
    if failed_runs:
        gate_status = "blocked"
    elif completed_runs and has_real_output:
        gate_status = "passed"
    else:
        gate_status = "needs_review"
    if completed_runs and has_real_output:
        gate_reasons = ["live_swarm_session_completed"]
    elif completed_runs:
        gate_reasons = [
            "live_swarm_completed_but_empty_output"
        ]  # 诚实标注:跑了但空产出
    else:
        gate_reasons = ["live_swarm_no_completed_runs"]
    if failed_runs:
        gate_reasons.append("live_swarm_failed_runs_present")

    resolved_session_id = getattr(session, "session_id", session_id)
    replay_artifact = _study_replay_artifact(resolved_session_id)
    edict["source_mode"] = "LIVE_SWARM"
    edict["orchestration"] = (
        tier_decision  # {tier, reason, value_thesis} —— 编排决策入圣旨,可观测
    )
    edict["run_adapter"] = {
        "name": "swarm_orchestrator",
        "session_id": resolved_session_id,
        "entry_swarm": selected_entry,
        "status": getattr(session, "status", "unknown"),
        "run_count": len(runs),
        "completed_count": len(completed_runs),
        "replay_artifact": replay_artifact,
    }
    # §8 执行层:T-Verify(不可逆/高 stakes)强制人工圣裁——即使分数通过也不许自动放行
    # (Bezos 单向门 + 契约 decisionClass→signoff)。不可逆决策不能因为评分高就绕过人。
    human_signoff_required = gate_status != "passed"
    if tier_decision["tier"] == "T-Verify":
        human_signoff_required = True
        gate_reasons.append(
            "orchestration_tier=T-Verify → 不可逆/高stakes强制人工圣裁(单向门)"
        )
    edict["quality_gate"] = {
        "status": gate_status,
        "score": min(1.0, max(0.0, normalized_score)),
        "reasons": gate_reasons,
        "human_signoff_required": human_signoff_required,
        "config": _study_quality_gate_config(orch, selected_entry),
    }
    # 异见(体验会审第一超预期动作):蜂群替陛下发现的最强盲点,一条「臣斗胆」+ 可点开凭何。
    # 无真实异见时为 None,前端显「全员一致」,绝不造假异见。
    edict["dissent"] = _extract_dissent(runs)
    edict["evidence"] = [
        *edict.get("evidence", []),
        {
            "label": "真实蜂群会话",
            "value": resolved_session_id,
            "source": "swarm_orchestrator",
        },
        {
            "label": "史馆复盘入口",
            "value": replay_artifact["api_path"],
            "source": "swarm_replay_artifact",
        },
        {
            "label": "真实蜂群运行",
            "value": ", ".join(
                f"{getattr(run, 'swarm_id', 'unknown')}:{getattr(run, 'run_id', '') or getattr(run, 'status', '')}"
                for run in runs[:5]
            )
            or "无完成运行",
            "source": "swarm_orchestrator",
        },
    ]
    return edict


def _study_replay_artifact(session_id: str) -> dict:
    return {
        "kind": "swarm_session",
        "session_id": session_id,
        "path": str(SESSIONS_DIR / f"{session_id}.json"),
        "api_path": f"/api/swarm/sessions/{session_id}",
        "owner": "shiguan",
    }


def _study_quality_gate_config(orch: SwarmOrchestrator, entry_swarm: str) -> dict:
    swarm = orch.swarms.get(entry_swarm)
    return {
        "entry_swarm": {
            "id": entry_swarm,
            "name": getattr(swarm, "name", entry_swarm),
            "config": getattr(swarm, "config_path", ""),
            "qa_version": getattr(swarm, "qa_version", ""),
        },
        "bindings": [
            {
                "topic": b.topic,
                "target_swarm": b.target_swarm,
                "transform": b.transform,
                "min_quality_score": b.min_quality_score,
                "enabled": b.enabled,
            }
            for b in orch.bindings
            if b.enabled
            and (b.topic == f"{entry_swarm}_completed" or b.target_swarm == entry_swarm)
        ],
    }


def _select_edict_memorials(memorials: list[dict], task_id: str | None) -> list[dict]:
    if task_id:
        matched = [
            m for m in memorials if m.get("id") == task_id or m.get("taskId") == task_id
        ]
        if matched:
            return matched[:5]

    priority_order = {"high": 0, "urgent": 0, "medium": 1, "normal": 2, "low": 3}
    status_order = {
        "pending": 0,
        "running": 1,
        "reviewed": 2,
        "approved": 3,
        "archived": 4,
    }
    candidates = [
        m
        for m in memorials
        if m.get("status") in ("pending", "running", "reviewed")
        or m.get("priority") in ("high", "urgent")
    ]
    if not candidates:
        candidates = memorials[:5]
    return sorted(
        candidates,
        key=lambda m: (
            priority_order.get(str(m.get("priority", "normal")), 2),
            status_order.get(str(m.get("status", "running")), 1),
            str(m.get("createdAt", "")),
        ),
    )[:5]


def _build_study_edict(
    *, command: str, mode: str, task_id: str | None, memorials: list[dict]
) -> dict:
    now = datetime.now().isoformat(timespec="seconds")
    safe_token = secrets.token_hex(4)
    run_id = task_id or f"study-{mode.replace('_', '-')}-{safe_token}"

    if not memorials:
        return {
            "run_id": run_id,
            "source_mode": "MIXED",
            "title": "上书房待立真案",
            "verdict": "需补证",
            "summary": f"已收到旨意「{command}」，但当前没有可绑定的蜂群奏折或任务证据，建议先补充目标、材料和期望结果。",
            "departments": [
                {
                    "dept": "prime_minister",
                    "name": "丞相",
                    "opinion": "先把问题立成可执行任务，再召集对应蜂群。",
                    "confidence": 0.62,
                    "status": "needs_evidence",
                    "run_id": run_id,
                }
            ],
            "evidence": [
                {"label": "用户旨意", "value": command, "source": "study_input"},
                {
                    "label": "绑定任务",
                    "value": "未找到 taskId / memorial",
                    "source": "chaotang_store",
                },
                {"label": "生成时间", "value": now, "source": "system"},
            ],
            "risks": ["没有证据链时不能伪装成蜂群结论。"],
            "next_actions": [
                {
                    "type": "request_evidence",
                    "label": "补充材料后再召集蜂群",
                    "target": "/court-briefing",
                    "owner": "user",
                },
                {
                    "type": "ask_oracle",
                    "label": "追问钦天监如何立案",
                    "target": "/court-briefing",
                    "owner": "qintianjian",
                },
            ],
            "quality_gate": {
                "status": "needs_review",
                "score": 0.42,
                "reasons": ["missing_bound_memorial", "human_intent_only"],
                "human_signoff_required": True,
            },
            "created_at": now,
        }

    high_risk = [
        m
        for m in memorials
        if m.get("riskLevel") == "high" or m.get("priority") in ("high", "urgent")
    ]
    medium_risk = [m for m in memorials if m.get("riskLevel") in ("medium", "high")]
    needs_review = bool(
        high_risk or any(m.get("status") == "pending" for m in memorials)
    )
    verdict = "需人工复核" if high_risk else "需补证" if needs_review else "准奏"
    primary = memorials[0]
    departments = [_memorial_to_department(m) for m in memorials]
    risks = _edict_risks(memorials)
    next_actions = _edict_next_actions(verdict, primary)
    gate_score = round(
        max(0.35, min(0.92, 0.78 - 0.12 * len(high_risk) - 0.05 * len(medium_risk))), 2
    )

    return {
        "run_id": run_id,
        "source_mode": "MIXED",
        "title": primary.get("title") or "上书房圣旨",
        "verdict": verdict,
        "summary": _edict_summary(command, primary, verdict),
        "departments": departments,
        "evidence": _edict_evidence(command, memorials, now),
        "risks": risks,
        "next_actions": next_actions,
        "quality_gate": {
            "status": "needs_review" if needs_review else "passed",
            "score": gate_score,
            "reasons": _gate_reasons(memorials, high_risk),
            "human_signoff_required": needs_review,
        },
        "created_at": now,
    }


def _memorial_to_department(m: dict) -> dict:
    dept = str(m.get("sourceDepartment") or "unknown")
    name_map = {
        "finance": "户部",
        "legal": "刑部",
        "market": "礼部",
        "ops": "军机处",
        "guard": "锦衣卫",
        "engineering": "工部",
    }
    confidence = m.get("qualityScore")
    if isinstance(confidence, (int, float)):
        confidence = max(0.0, min(1.0, float(confidence) / 5.0))
    else:
        confidence = 0.68 if m.get("status") == "running" else 0.74
    return {
        "dept": dept,
        "name": name_map.get(dept, dept),
        "opinion": m.get("summary")
        or m.get("suggestedAction")
        or "已有蜂群分奏，需展开证据后裁决。",
        "confidence": round(confidence, 2),
        "status": m.get("status", "running"),
        "run_id": m.get("id") or m.get("taskId") or "",
    }


def _edict_summary(command: str, primary: dict, verdict: str) -> str:
    summary = (
        primary.get("summary") or primary.get("suggestedAction") or "蜂群已有初步分奏。"
    )
    return f"围绕「{command}」，当前首要事项是「{primary.get('title', '未命名奏折')}」。结论：{verdict}。{summary}"


def _edict_evidence(command: str, memorials: list[dict], now: str) -> list[dict]:
    evidence = [
        {"label": "用户旨意", "value": command, "source": "study_input"},
        {"label": "绑定奏折数", "value": len(memorials), "source": "chaotang_store"},
        {"label": "生成时间", "value": now, "source": "system"},
    ]
    for m in memorials[:3]:
        evidence.append(
            {
                "label": m.get("title") or m.get("id") or "奏折",
                "value": m.get("summary")
                or m.get("suggestedAction")
                or m.get("status", ""),
                "source": m.get("id") or "memorial",
            }
        )
    return evidence


def _edict_risks(memorials: list[dict]) -> list[str]:
    risks: list[str] = []
    for m in memorials:
        risk = m.get("riskLevel")
        if risk in ("high", "medium") or m.get("priority") in ("high", "urgent"):
            title = m.get("title") or m.get("id") or "未命名奏折"
            risks.append(
                f"{title}: {risk or m.get('priority')} 风险，需人工复核证据和承诺边界。"
            )
    return risks or ["暂无高风险项；仍需保留 runId 和证据链以便史馆归档。"]


def _edict_next_actions(verdict: str, primary: dict) -> list[dict]:
    target = (
        f"/command-center?taskId={primary.get('id')}"
        if primary.get("id")
        else "/command-center"
    )
    if verdict == "准奏":
        return [
            {
                "type": "approve",
                "label": "准奏推进到军机处",
                "target": target,
                "owner": "user",
            },
            {
                "type": "archive",
                "label": "同步史馆归档",
                "target": "/scribe",
                "owner": "scribe",
            },
        ]
    return [
        {
            "type": "request_evidence",
            "label": "打回补证",
            "target": "/court-briefing",
            "owner": "user",
        },
        {
            "type": "ask_oracle",
            "label": "追问钦天监",
            "target": "/court-briefing",
            "owner": "qintianjian",
        },
        {
            "type": "dispatch",
            "label": "带风险边界交军机处",
            "target": target,
            "owner": "command_center",
        },
    ]


def _gate_reasons(memorials: list[dict], high_risk: list[dict]) -> list[str]:
    reasons = ["bound_memorials_present", "edict_contract_ready"]
    if high_risk:
        reasons.append("high_risk_requires_human_review")
    if any(m.get("status") == "pending" for m in memorials):
        reasons.append("pending_decision_requires_user_action")
    return reasons


@router.get("/archive")
def archive_list(_: CurrentUser = Depends(get_current_user)) -> dict:
    from web.routers.throne import _build_memorial_list

    reviews = chaotang_store.list_reviews()
    # 已批准/归档裁决的奏折 id —— 即便其 run 派生状态未到 done,也应进"已归档奏折"
    archived_ids = {r["memorialId"] for r in reviews if r.get("action") in ("approve",)}
    memorials = [
        m
        for m in _build_memorial_list()
        if m.get("status") in ("approved", "archived", "done")
        or m.get("id") in archived_ids
    ]
    return ok({"memorials": memorials, "decisions": reviews})


# ── P3-C(2026-07-10):问太史令·生成史册,真实数据聚合 + LLM 摘要,不落库 ──

_CHRONICLE_TYPE_DAYS = {"日史": 1, "周史": 7, "月史": 30, "专题史": 30}
_CHRONICLE_DECISION_STATUS = {
    "approve": "已完成",
    "reject": "已完成",
    "inquire": "执行中",
}


class _ChronicleRequest(BaseModel):
    type: Literal["日史", "周史", "月史", "专题史"] = "日史"
    days: int | None = None


@router.post("/archive/chronicle")
def archive_chronicle(
    body: _ChronicleRequest, _: CurrentUser = Depends(get_current_user)
) -> dict:
    """史册生成:窗口内真实奏折/决策/复盘聚合 + LLM 写一段摘要。按需生成,不归档存表
    (是否要建史册归档表是独立产品决策,见 docs/shiguan-jinyiwei-wiring-plan P3)。
    """
    from datetime import date, timedelta

    from web.routers.throne import _build_memorial_list

    window_days = body.days or _CHRONICLE_TYPE_DAYS.get(body.type, 1)
    cutoff = (date.today() - timedelta(days=window_days)).isoformat()

    memorials = [
        m
        for m in _build_memorial_list()
        if m.get("status") in ("approved", "archived", "done")
        and (m.get("createdAt") or "") >= cutoff
    ]
    reviews = [
        r for r in chaotang_store.list_reviews() if (r.get("createdAt") or "") >= cutoff
    ]
    memorial_by_id = {m["id"]: m for m in memorials}

    events = [m.get("title", "") for m in memorials if m.get("title")]
    decisions = []
    for r in reviews:
        m = memorial_by_id.get(r.get("memorialId"))
        title = m.get("title") if m else f"批阅：{r.get('memorialId', '')}"
        decisions.append(
            {
                "title": title,
                "status": _CHRONICLE_DECISION_STATUS.get(r.get("action"), "执行中"),
            }
        )

    knowledge: list[str] = []
    for m in memorials:
        rec = chaotang_store.get_retrospective(m["id"])
        if rec and not rec.get("synthetic"):
            knowledge.extend(rec.get("lessons") or [])

    summary, llm_degraded = _chronicle_summary(events, decisions)

    return ok(
        {
            "type": body.type,
            "days": window_days,
            "events": events,
            "decisions": decisions,
            "summary": summary,
            "knowledge": knowledge,
            "llmDegraded": llm_degraded,
        }
    )


def _chronicle_summary(events: list[str], decisions: list[dict]) -> tuple[str, bool]:
    """真实事件/决策 → LLM 摘要。LLM 不可用或空产出 → 诚实兜底,不冒充生成成功。"""
    import os

    if not events and not decisions:
        return "此窗口内没有真实归档事件，未生成摘要(不编造)。", False

    fallback = f"(LLM 摘要暂不可用，以下为真实数据直陈)本窗口共 {len(events)} 件事项、{len(decisions)} 项决策。"
    try:
        from src.model_adapter import ModelAdapter

        event_digest = "\n".join(f"- {e}" for e in events[:20]) or "(无事件)"
        decision_digest = (
            "\n".join(f"- {d['title']}({d['status']})" for d in decisions[:20])
            or "(无决策)"
        )
        adapter = ModelAdapter(
            model="openai/qwen-turbo",
            api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key=os.getenv("DASHSCOPE_API_KEY"),
        )
        res = adapter.call(
            system_prompt=(
                "你是朝堂OS的太史令,用简洁的古风口吻,把下面的真实朝堂事件和决策写成一段"
                "不超过120字的复盘摘要,只依据给出的内容,不夸大、不编造未提及的事项。"
            ),
            user_prompt=f"事件:\n{event_digest}\n\n决策:\n{decision_digest}",
        )
        if res.get("status") == "success" and (res.get("output") or "").strip():
            return res["output"].strip(), False
        return fallback, True
    except Exception:
        return fallback, True


# ── P1-4: 史馆知识条目 count(静态路由须在 {task_id} 通配之前注册)──


@router.get("/archive/knowledge/count")
def archive_knowledge_count(_: CurrentUser = Depends(get_current_user)) -> dict:
    """返回 chaotang_approved 来源已沉淀知识条目数(替前端硬编码 '—')。

    RAG 不可用时返回 count=0,不报错。
    """
    count = chaotang_store.count_knowledge_items()
    return ok({"count": count, "source": "chaotang_approved"})


# ── CL-2: 反哺丞相触发端点(静态路由须在 {task_id} 通配之前注册)──


@router.post("/archive/knowledge/feedback")
def archive_knowledge_feedback(_: CurrentUser = Depends(get_current_user)) -> dict:
    """把所有已批准奏折的内容批量回流到知识库(幂等,upsert)。

    遍历当前全部 approved/archived 奏折,对每条调用 feedback_to_knowledge。
    因 RAG upsert 用内容哈希去重,重复调用不增加条目。
    返回:本次处理条数 + 成功条数 + 回流后总知识条目数。
    """
    from web.routers.throne import _build_memorial_list
    from src.chaotang_api import build_memorial_sections
    from src.step_log import load_run

    memorials = _build_memorial_list()
    targets = [m for m in memorials if m.get("status") in ("approved", "archived")]

    processed = 0
    succeeded = 0
    for m in targets:
        run_id = m.get("id")
        if not run_id:
            continue
        processed += 1
        try:
            run = load_run(run_id)
            if run and run.final_output:
                sec = build_memorial_sections(run.final_output)
                content = f"{sec['background']}\n{sec['recommendation']}".strip()
            else:
                content = (m.get("summary") or "").strip()
            if content:
                ok_ = chaotang_store.feedback_to_knowledge(
                    title=(m.get("title") or run_id)[:60],
                    content=content,
                )
                if ok_:
                    succeeded += 1
        except Exception:
            continue

    total_count = chaotang_store.count_knowledge_items()
    return ok(
        {
            "processed": processed,
            "succeeded": succeeded,
            "totalKnowledgeCount": total_count,
            "source": "chaotang_approved",
        }
    )


# ── P1-2: 钦天监教学对话 ──


class _TeachingRequest(BaseModel):
    message: str
    context: str = ""  # 可选:当前页面上下文(上书房/大殿/军机处...)


@router.post("/study/teaching")
def study_teaching(
    body: _TeachingRequest, _: CurrentUser = Depends(get_current_user)
) -> dict:
    """钦天监教学对话:回答老板关于系统使用的问题。

    教学角色:告诉老板怎么下旨、怎么看奏折、怎么召集大臣。
    """
    from src.model_adapter import ModelAdapter
    import os

    system_prompt = (
        "你是朝堂OS的钦天监,负责教导老板(陛下)如何使用朝堂系统。"
        "你的语气要恭敬、亲切、带点古风但不生硬。"
        "朝堂OS是一个企业AI指挥系统,老板通过它管理公司:\n"
        "- 上书房:每日简报、待裁决事项、快速下旨\n"
        "- 大殿:查看十位AI大臣状态,一键召集\n"
        "- 军机处:复杂任务多Agent会审和推演\n"
        "- 庄园:企业资源、客户、项目经营地图\n"
        "- 史馆:任务归档、知识沉淀、复盘进化\n"
        "- 下旨方式:输入一句话,丞相自动理解和拆解\n"
        "- 批阅奏折:在奏折详情页批准/驳回/询问\n\n"
        "回答限制在3句话以内,简洁明了。"
    )

    user_prompt = body.message
    if body.context:
        user_prompt = f"老板当前在「{body.context}」页面。\n{body.message}"

    try:
        adapter = ModelAdapter(
            model="openai/qwen-turbo",
            api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key=os.getenv("DASHSCOPE_API_KEY"),
        )
        res = adapter.call(system_prompt=system_prompt, user_prompt=user_prompt)
        reply = res.get("output", "陛下,老奴这就去办。")
    except Exception:
        # LLM 不可用时返回规则回复
        reply = _rule_teaching_reply(body.message)

    return ok(
        {
            "reply": reply,
            "context": body.context or "上书房",
        }
    )


def _rule_teaching_reply(message: str) -> str:
    """LLM 不可用时的规则兜底回复。"""
    msg_lower = message.lower()
    if "下旨" in msg_lower or "怎么用" in msg_lower:
        return "陛下,您在上书房输入一句话即可下旨。比如:「帮我分析这个项目值不值得投」,丞相会立即为您拆解处理。"
    if "奏折" in msg_lower or "批阅" in msg_lower:
        return "陛下,奏折完成后会自动呈到上书房。您可以点进去查看详情,然后批示「批准」「驳回」或「询问」。"
    if "大臣" in msg_lower or "召集" in msg_lower:
        return "陛下,您可以在大殿看到所有大臣的状态。点击大臣卡片可进入其部门页,也可以输入口谕召集多位大臣会审。"
    if "庄园" in msg_lower or "商机" in msg_lower:
        return "陛下,庄园是企业经营地图。您可以看到客户商机、项目进度、供应链资源,还能直接从庄园发起AI分析任务。"
    if "史馆" in msg_lower or "归档" in msg_lower:
        return "陛下,史馆记录了所有奏折、决策和复盘。批准后的奏折会自动归档,史官会持续沉淀知识,让系统越来越懂您。"
    return "陛下,您在朝堂OS中可以输入任何问题或指令,丞相和大臣们随时待命。老奴建议您先试试上书房,那是您每天处理朝政的第一站。"


# ── P1-3: 一键召集 ──


class _QuickSummonRequest(BaseModel):
    mode: str  # "full_court" | "six_ministries" | "war_room" | "intel_sweep" | "history_check"
    topic: str = ""


@router.post("/throne/quick-summon")
def throne_quick_summon(
    body: _QuickSummonRequest, _: CurrentUser = Depends(get_current_user)
) -> dict:
    """一键召集:根据不同模式自动选大臣+蜂群,返回可直接用于 dispatch 的参数。

    模式:
    - full_court: 全朝会审(所有大臣)
    - six_ministries: 六部会审(户部/吏部/刑部/工部/礼部/兵部)
    - war_room: 军机推演(锦衣卫+钦天监+兵部+丞相)
    - intel_sweep: 情报扫荡(锦衣卫)
    - history_check: 查询历史(史官+丞相)
    """
    from src.manor_groups import groups_for_ministers

    MODE_MINISTERS: dict[str, list[str]] = {
        "full_court": [
            "hu_bu",
            "li_bu",
            "xing_bu",
            "gong_bu",
            "li_bu_rites",
            "bing_bu",
            "jin_yi_wei",
            "qin_tian_jian",
            "scribe",
            "tai_yi_yuan",
        ],
        "six_ministries": [
            "hu_bu",
            "li_bu",
            "xing_bu",
            "gong_bu",
            "li_bu_rites",
            "bing_bu",
        ],
        "war_room": ["jin_yi_wei", "qin_tian_jian", "bing_bu", "scribe"],
        "intel_sweep": ["jin_yi_wei"],
        "history_check": ["scribe", "prime_minister"],
    }

    MODE_LABELS: dict[str, str] = {
        "full_court": "全朝会审",
        "six_ministries": "六部会审",
        "war_room": "军机推演",
        "intel_sweep": "情报扫荡",
        "history_check": "历史查询",
    }

    if body.mode not in MODE_MINISTERS:
        return fail(
            f"不支持的召集模式: {body.mode!r},允许值: {sorted(MODE_MINISTERS.keys())}"
        )

    ministers = MODE_MINISTERS[body.mode]
    groups = sorted({g for m in ministers for g in groups_for_ministers([m])})

    return ok(
        {
            "mode": body.mode,
            "modeLabel": MODE_LABELS[body.mode],
            "ministers": ministers,
            "groups": groups,
            "suggestedCommand": body.topic or "请分析当前企业状况",
            "readyForDispatch": True,
        }
    )


# ── P1-1: 史馆搜索 ──


@router.get("/archive/search")
def archive_search(q: str = "", _: CurrentUser = Depends(get_current_user)) -> dict:
    """史馆搜索与追问:支持关键词搜索历史奏折和决策。

    搜索范围:奏折标题+摘要+决策评语。
    """
    if not q.strip():
        return ok({"results": [], "query": q, "total": 0, "sourceLabel": "LIVE"})

    from web.routers.throne import _build_memorial_list

    memorials = _build_memorial_list()
    reviews = chaotang_store.list_reviews()

    query_lower = q.strip().lower()
    results = []

    # 搜索奏折 (标题/摘要匹配)
    for m in memorials:
        title = (m.get("title", "") or "").lower()
        summary = (m.get("summary", "") or "").lower()
        if query_lower in title or query_lower in summary:
            results.append(
                {
                    "type": "memorial",
                    "id": m.get("id", ""),
                    "title": m.get("title", ""),
                    "summary": (m.get("summary", "") or "")[:200],
                    "status": m.get("status", ""),
                    "createdAt": m.get("createdAt", ""),
                    "matchField": "title" if query_lower in title else "summary",
                }
            )

    # 搜索决策
    for r in reviews:
        comment = (r.get("comment", "") or "").lower()
        if query_lower in comment:
            results.append(
                {
                    "type": "decision",
                    "id": r.get("id", ""),
                    "memorialId": r.get("memorialId", ""),
                    "action": r.get("action", ""),
                    "comment": (r.get("comment", "") or "")[:200],
                    "reviewerName": r.get("reviewerName", ""),
                    "createdAt": r.get("createdAt", ""),
                    "matchField": "comment",
                }
            )

    results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    return ok(
        {
            "results": results[:20],
            "query": q.strip(),
            "total": len(results),
            "sourceLabel": "LIVE",
        }
    )


@router.get("/archive/{task_id}/retrospective")
def archive_retrospective(
    task_id: str, _: CurrentUser = Depends(get_current_user)
) -> dict:
    if not _validate_id(task_id):
        return fail("无效的 task_id")
    existing = chaotang_store.get_retrospective(task_id)
    if existing:
        return ok(existing)
    run = load_run(task_id)
    score = 4 if run and run.final_output else 3
    synth = {
        "score": score,
        "successes": ["闭环跑通"],
        "failures": [],
        "lessons": ["复用既有蜂群编排"],
        "playbook": None,
        "authoredBy": "史官",
        "authoredAt": datetime.now().isoformat(timespec="seconds"),
        "synthetic": True,
        "outcome": "success" if score >= 4 else "pending",
    }
    return ok(synth)


class _RetrospectiveRequest(BaseModel):
    score: int = 3
    successes: list[str] = []
    failures: list[str] = []
    lessons: list[str] = []
    playbook: str | None = None
    authoredBy: str = "史官"
    outcome: Literal["success", "blocked", "pending"] = "pending"


@router.post("/archive/{task_id}/retrospective")
def archive_retrospective_save(
    task_id: str,
    body: _RetrospectiveRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """保存或更新任务复盘。task_id 仅允许安全字符集,防止路径穿越。"""
    if not _validate_id(task_id):
        return fail("无效的 task_id")
    rec = chaotang_store.save_retrospective(task_id, body.model_dump())
    return ok(rec)


# ── P0-1: 快捷下旨智能路由 ──


class _QuickCommandRequest(BaseModel):
    rawCommand: str


@router.post("/study/quick-command")
def study_quick_command(
    body: _QuickCommandRequest, _: CurrentUser = Depends(get_current_user)
) -> dict:
    """快捷下旨:输入一句话→自动判断路由(简单问答/复杂任务/部门调度)。

    与 decree/draft 的区别:
    - decree/draft: 返回推荐分类,需用户二次确认
    - quick-command:  直接判断路由+自动dispatch(简单任务)或返回军机处引导
    """
    from src import chaotang_orchestrator as orch

    try:
        draft = orch.draft_decree(body.rawCommand)
    except Exception as e:
        return fail(f"拟旨失败: {e}")

    # 简单判断路由
    cats = draft.get("recommendedCategories", [])
    confidence = cats[0]["confidence"] if cats else 0.0

    if not cats or confidence < 0.3:
        # 无法理解,交给丞相直接回答
        return ok(
            {
                "route": "chancellor",
                "message": f"丞相将为您直接解答: {body.rawCommand[:40]}",
                "draft": draft.get("draft", ""),
                "suggestedAction": "ask_chancellor",
            }
        )

    # 判断是否为简单问答
    top_cat = cats[0]
    if top_cat.get("taskType") == "general" and len(top_cat.get("ministers", [])) <= 2:
        return ok(
            {
                "route": "chancellor",
                "message": f"此事丞相可直接处理",
                "draft": draft.get("draft", ""),
                "suggestedAction": "ask_chancellor",
                "category": {
                    "label": top_cat["label"],
                    "taskType": top_cat["taskType"],
                },
            }
        )

    # 复杂任务 → 自动推荐进入军机处
    return ok(
        {
            "route": "command_center",
            "message": f"此事需召集大臣会审,建议进入军机处",
            "draft": draft.get("draft", ""),
            "intent": draft.get("intent", ""),
            "suggestedAction": "enter_war_room",
            "recommendedCategories": cats[:3],
        }
    )


@router.post("/decree/{task_id}/proceed")
def decree_proceed(task_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    """前端用户批准出动蜂群 — 释放 governance pause gate。"""
    if not _validate_id(task_id):
        raise HTTPException(status_code=400, detail="无效 task_id")
    from web.task_registry import resolve_governance_event

    resolved = resolve_governance_event(task_id)
    if not resolved:
        return fail(f"task {task_id} 无待批准的治理事件（可能已超时或不需审批）")
    return ok({"proceeded": True, "taskId": task_id, "sourceLabel": "LIVE"})
