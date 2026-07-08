"""任务监控总览 — /api/tasks

返回所有任务快照：running 全部 + done/error 最近 30 条。
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.streaming import TaskMonitorEntry, TasksSnapshot
from web.task_registry import task_snapshot

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks", response_model=TasksSnapshot)
def api_tasks(
    _: CurrentUser = Depends(get_current_user),
) -> TasksSnapshot:
    now_ts = datetime.now()
    running: list[TaskMonitorEntry] = []
    recent: list[TaskMonitorEntry] = []

    for task_id, t in task_snapshot().items():
        t.pop("queue", None)  # queue 不可序列化
        try:
            started = datetime.fromisoformat(t["started_at"])
            end = (
                datetime.fromisoformat(t["finished_at"])
                if t.get("finished_at") else now_ts
            )
            elapsed = int((end - started).total_seconds())
        except Exception:
            elapsed = None

        entry = TaskMonitorEntry(
            task_id=task_id,
            status=t.get("status"),
            task_input=t.get("task_input", "") or "",
            config=t.get("config"),
            started_at=t.get("started_at"),
            finished_at=t.get("finished_at"),
            flow_name=t.get("flow_name"),
            total_steps=t.get("total_steps"),
            current_step=t.get("current_step"),
            current_step_name=t.get("current_step_name"),
            completed_steps=t.get("completed_steps", 0) or 0,
            step_names=t.get("step_names") or [],
            run_id=t.get("run_id"),
            error=t.get("error"),
            elapsed_seconds=elapsed,
        )
        if t.get("status") == "running":
            running.append(entry)
        else:
            recent.append(entry)

    recent.sort(key=lambda x: x.started_at or "", reverse=True)
    return TasksSnapshot(running=running, recent=recent[:30])
