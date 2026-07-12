"""src/db/flow_store.py — flow 持久化 CRUD helpers。

所有函数接受已开启的 SQLAlchemy Session,调用方负责 commit/rollback。
字段全部与 api-contracts.md Session-10 字段表对齐。

KP-7 action→MemorialStatus 映射:
  approve → archived
  reject  → rejected
  inquire → pending
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.db.models import Decree, Memorial, Retrospective, Review, Task

# ── 枚举常量(KP-7 全链路一致) ────────────────────────────────────────────

# ReviewActionType → MemorialStatus
_ACTION_TO_STATUS: dict[str, str] = {
    "approve": "archived",
    "reject": "rejected",
    "inquire": "pending",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


_DISPLAY_TO_INTERNAL_STATUS: dict[str, str] = {
    "draft": "running",
    "submitted": "running",
    "interpreting": "running",
    "planning": "running",
    "assigned": "running",
    "running": "running",
    "aggregating": "running",
    "report_ready": "done",
    "reviewed": "done",
    "archived": "done",
    "completed": "done",
    "failed": "error",
}


def _normalize_display_status(status: str | None) -> str:
    if status in _DISPLAY_TO_INTERNAL_STATUS:
        return status
    if status == "done":
        return "report_ready"
    if status == "error":
        return "failed"
    return "submitted"


def _internal_status(display_status: str) -> str:
    return _DISPLAY_TO_INTERNAL_STATUS.get(display_status, "running")


def _last_stage(display_status: str) -> str:
    if display_status in {"report_ready", "reviewed", "archived"}:
        return display_status
    if display_status == "failed":
        return "failed"
    return "dispatched"


def _parse_json_object(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _merge_result_json(
    existing_raw: str | None,
    result: dict[str, Any] | None,
    *,
    title: str | None = None,
    mode: str | None = None,
) -> str | None:
    merged = _parse_json_object(existing_raw)
    if result:
        merged.update(result)
    if title:
        merged.setdefault("title", title)
    if mode:
        merged.setdefault("mode", mode)
    return json.dumps(merged, ensure_ascii=False) if merged else None


def ensure_task_result_json_column(session: Session) -> None:
    """Ensure older DB files can accept Task.result_json writes."""
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    try:
        if dialect == "sqlite":
            rows = session.execute(text("PRAGMA table_info(tasks)")).all()
            if any(row[1] == "result_json" for row in rows):
                return
            session.execute(text("ALTER TABLE tasks ADD COLUMN result_json TEXT"))
            return
        session.execute(
            text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_json TEXT")
        )
    except Exception as exc:  # noqa: BLE001 - tolerate duplicate-column races only.
        message = str(exc).lower()
        if "duplicate column" not in message and "already exists" not in message:
            raise


def ensure_retrospective_outcome_column(session: Session) -> None:
    """Ensure older DB files can accept Retrospective.outcome writes.

    同 ensure_task_result_json_column 的必要性:Alembic 004 只在生产迁移路径跑,
    dev/旧进程仍靠 create_all(checkfirst=True)补救——它只建"不存在的表",不给
    已存在的表加新列,旧 retrospectives 表会永远缺这一列(2026-07-10 独立复审)。
    """
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    try:
        if dialect == "sqlite":
            rows = session.execute(text("PRAGMA table_info(retrospectives)")).all()
            if any(row[1] == "outcome" for row in rows):
                return
            session.execute(
                text(
                    "ALTER TABLE retrospectives ADD COLUMN outcome TEXT NOT NULL DEFAULT 'pending'"
                )
            )
            return
        session.execute(
            text(
                "ALTER TABLE retrospectives ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'pending'"
            )
        )
    except Exception as exc:  # noqa: BLE001 - tolerate duplicate-column races only.
        message = str(exc).lower()
        if "duplicate column" not in message and "already exists" not in message:
            raise


def ensure_decree_execution_event_sequence_column(session: Session) -> None:
    """Ensure older DB files can accept DecreeExecutionEvent.sequence writes.

    同 ensure_task_result_json_column/ensure_retrospective_outcome_column 的必要性:
    Alembic 005 只在生产迁移路径跑,dev/旧进程仍靠 create_all(checkfirst=True)补救——
    它只建"不存在的表",不给已存在的表加新列,旧 decree_execution_events 表会永远
    缺这一列(2026-07-12 复审：record_timeline_event/_load_timeline 会直接因
    "no such column: sequence" 报错，状态接口和事件写入全部失败)。
    """
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    try:
        if dialect == "sqlite":
            rows = session.execute(
                text("PRAGMA table_info(decree_execution_events)")
            ).all()
            if any(row[1] == "sequence" for row in rows):
                return
            session.execute(
                text(
                    "ALTER TABLE decree_execution_events ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0"
                )
            )
            return
        session.execute(
            text(
                "ALTER TABLE decree_execution_events ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0"
            )
        )
    except Exception as exc:  # noqa: BLE001 - tolerate duplicate-column races only.
        message = str(exc).lower()
        if "duplicate column" not in message and "already exists" not in message:
            raise


def task_record(row: Task) -> dict[str, Any]:
    display_status = row.task_status or _normalize_display_status(row.status)
    result = _parse_json_object(row.result_json)
    return {
        "taskId": row.task_id,
        "id": row.task_id,
        "title": result.get("title") or (row.task_input or "")[:80] or row.task_id,
        "rawCommand": row.task_input or "",
        "status": display_status,
        "mode": result.get("mode") or "hybrid",
        "progressPct": (
            int((row.completed_steps or 0) / row.total_steps * 100)
            if row.total_steps
            else (100 if row.status == "done" else 0)
        ),
        "createdAt": row.created_at or row.started_at or "",
        "updatedAt": row.updated_at or row.finished_at or row.created_at or "",
        "result": result,
    }


def upsert_persisted_task(
    *,
    session: Session,
    task_id: str,
    raw_command: str,
    title: str | None = None,
    status: str | None = None,
    mode: str | None = None,
    result: dict[str, Any] | None = None,
    at: str | None = None,
    tenant_id: int = 1,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Idempotently write a frontend/BFF task into the backend tasks table."""
    ensure_task_result_json_column(session)
    now = at or _now()
    display_status = _normalize_display_status(status)
    internal = _internal_status(display_status)
    row = session.query(Task).filter_by(task_id=task_id).first()
    result_json = _merge_result_json(
        None if row is None else row.result_json, result, title=title, mode=mode
    )

    if row is None:
        row = Task(
            task_id=task_id,
            decree_id=task_id,
            tenant_id=tenant_id,
            status=internal,
            task_status=display_status,
            task_input=raw_command,
            departments_json="[]",
            started_at=now,
            last_stage=_last_stage(display_status),
            created_at=now,
            updated_at=now,
            result_json=result_json,
        )
        session.add(row)
    else:
        row.status = internal
        row.task_status = display_status
        row.task_input = raw_command or row.task_input
        row.updated_at = now
        row.last_stage = _last_stage(display_status)
        if result_json is not None:
            row.result_json = result_json
        if row.decree_id is None:
            row.decree_id = task_id

    if not session.query(Decree).filter_by(decree_id=task_id).first():
        session.add(
            Decree(
                decree_id=task_id,
                tenant_id=tenant_id,
                user_id=user_id,
                raw_command=raw_command,
                intent=title,
                task_type=mode,
                ministers_json="[]",
                groups_json="[]",
                created_at=now,
            )
        )

    session.flush()
    return task_record(row)


def patch_persisted_task_result(
    *,
    session: Session,
    task_id: str,
    status: str | None = None,
    result: dict[str, Any] | None = None,
    raw_command: str | None = None,
    title: str | None = None,
    mode: str | None = None,
    at: str | None = None,
    tenant_id: int = 1,
    user_id: int | None = None,
) -> dict[str, Any] | None:
    """Patch result_json/status. If command is supplied, missing rows are created."""
    ensure_task_result_json_column(session)
    row = session.query(Task).filter_by(task_id=task_id).first()
    if row is None:
        if not raw_command:
            return None
        return upsert_persisted_task(
            session=session,
            task_id=task_id,
            raw_command=raw_command,
            title=title,
            status=status or "submitted",
            mode=mode,
            result=result,
            at=at,
            tenant_id=tenant_id,
            user_id=user_id,
        )

    display_status = _normalize_display_status(status or row.task_status or row.status)
    row.status = _internal_status(display_status)
    row.task_status = display_status
    row.updated_at = at or _now()
    row.last_stage = _last_stage(display_status)
    if raw_command:
        row.task_input = raw_command
    result_json = _merge_result_json(row.result_json, result, title=title, mode=mode)
    if result_json is not None:
        row.result_json = result_json
    session.flush()
    return task_record(row)


# ── decree + task 双写 ────────────────────────────────────────────────────


def save_decree_and_task(
    *,
    session: Session,
    task_id: str,
    raw_command: str = "",
    intent: str | None = None,
    task_type: str | None = None,
    ministers: list[str] | None = None,
    groups: list[str] | None = None,
    departments: list[str] | None = None,
    started_at: str | None = None,
    tenant_id: int = 1,
    user_id: int | None = None,
) -> None:
    """POST /decree/dispatch 后写 decrees + tasks 两表。

    decree_id == task_id(D16①)。
    """
    now = started_at or _now()
    ensure_task_result_json_column(session)

    # 幂等:已存在则跳过
    if not session.query(Decree).filter_by(decree_id=task_id).first():
        session.add(
            Decree(
                decree_id=task_id,
                tenant_id=tenant_id,
                user_id=user_id,
                raw_command=raw_command,
                intent=intent,
                task_type=task_type,
                ministers_json=json.dumps(ministers or [], ensure_ascii=False),
                groups_json=json.dumps(groups or [], ensure_ascii=False),
                created_at=now,
            )
        )

    if not session.query(Task).filter_by(task_id=task_id).first():
        session.add(
            Task(
                task_id=task_id,
                decree_id=task_id,  # FK 与 decree_id 共用同一串
                tenant_id=tenant_id,
                status="running",
                task_status="running",
                task_input=raw_command[:120] if raw_command else "",
                departments_json=json.dumps(departments or [], ensure_ascii=False),
                started_at=now,
                last_stage="dispatched",
                created_at=now,
                updated_at=now,
            )
        )

    session.flush()


def update_task_status(
    *,
    session: Session,
    task_id: str,
    status: str,
    task_status: str | None = None,
    run_id: str | None = None,
    finished_at: str | None = None,
    last_stage: str | None = None,
    completed_steps: int | None = None,
    total_steps: int | None = None,
    error: str | None = None,
) -> None:
    """mark_status / 运行进度更新后同步 tasks 表。

    不存在的 task_id 幂等忽略(内存与 DB 可能不同步)。
    """
    row = session.query(Task).filter_by(task_id=task_id).first()
    if row is None:
        return
    row.status = status
    row.updated_at = _now()
    if task_status is not None:
        row.task_status = task_status
    if run_id is not None:
        row.run_id = run_id
    if finished_at is not None:
        row.finished_at = finished_at
    if last_stage is not None:
        row.last_stage = last_stage
    if completed_steps is not None:
        row.completed_steps = completed_steps
    if total_steps is not None:
        row.total_steps = total_steps
    if error is not None:
        row.error = error
    session.flush()


# ── memorial 双写 ─────────────────────────────────────────────────────────


def upsert_memorial(
    *,
    session: Session,
    memorial_id: str,
    tenant_id: int = 1,
    task_id: str | None = None,
    title: str = "",
    source_department: str = "",
    agent_code: str = "",
    priority: str = "medium",
    status: str = "running",
    summary: str = "",
    created_at: str = "",
) -> None:
    """INSERT(新) 或 UPDATE status/summary/updated_at(已存在)。

    status 必须在 MemorialStatus 值域内(KP-7):
    pending | running | approved | archived | rejected
    """
    row = session.query(Memorial).filter_by(memorial_id=memorial_id).first()
    if row is None:
        session.add(
            Memorial(
                memorial_id=memorial_id,
                tenant_id=tenant_id,
                task_id=task_id,
                title=title,
                source_department=source_department,
                agent_code=agent_code,
                priority=priority,
                status=status,
                summary=summary,
                created_at=created_at,
                updated_at=_now(),
            )
        )
    else:
        row.status = status
        row.summary = summary
        row.updated_at = _now()
        if task_id is not None:
            row.task_id = task_id
    session.flush()


def get_memorial_status_db(session: Session, memorial_id: str) -> str | None:
    """读 memorials.status;不存在返回 None。优先于 JSON 文件读取。"""
    row = session.query(Memorial.status).filter_by(memorial_id=memorial_id).first()
    return row[0] if row else None


# ── review 双写 ───────────────────────────────────────────────────────────


def save_review_db(
    *,
    session: Session,
    review_id: str,
    memorial_id: str,
    action: str,
    comment: str = "",
    reviewer_name: str = "",
    tenant_id: int = 1,
    created_at: str | None = None,
) -> dict[str, Any]:
    """写 reviews 表 + 联动更新 memorials.status(KP-7)。

    返回 ReviewAction 格式 dict(与 chaotang_store.save_review 返回对齐)。
    """
    now = created_at or _now()

    # 幂等:已存在则跳过写入
    if not session.query(Review).filter_by(review_id=review_id).first():
        session.add(
            Review(
                review_id=review_id,
                memorial_id=memorial_id,
                tenant_id=tenant_id,
                action=action,
                comment=comment,
                reviewer_name=reviewer_name,
                created_at=now,
            )
        )

    # 联动更新 memorials.status(approve→archived, reject→rejected, inquire→pending)
    mapped_status = _ACTION_TO_STATUS.get(action)
    if mapped_status:
        mem = session.query(Memorial).filter_by(memorial_id=memorial_id).first()
        if mem:
            mem.status = mapped_status
            mem.updated_at = now

    session.flush()
    return {
        "id": review_id,
        "memorialId": memorial_id,
        "action": action,
        "comment": comment,
        "reviewerName": reviewer_name,
        "createdAt": now,
    }


def get_review_for_memorial_db(
    session: Session, memorial_id: str
) -> dict[str, Any] | None:
    """读 memorial 最新 review;不存在返回 None。"""
    row = (
        session.query(Review)
        .filter_by(memorial_id=memorial_id)
        .order_by(Review.created_at.desc())
        .first()
    )
    if row is None:
        return None
    return {
        "id": row.review_id,
        "memorialId": row.memorial_id,
        "action": row.action,
        "comment": row.comment,
        "reviewerName": row.reviewer_name,
        "createdAt": row.created_at,
    }


def list_reviews_db(session: Session, tenant_id: int = 1) -> list[dict[str, Any]]:
    """读全量 reviews,按 created_at 降序。"""
    rows = (
        session.query(Review)
        .filter_by(tenant_id=tenant_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.review_id,
            "memorialId": r.memorial_id,
            "action": r.action,
            "comment": r.comment,
            "reviewerName": r.reviewer_name,
            "createdAt": r.created_at,
        }
        for r in rows
    ]


# ── retrospective 双写 ────────────────────────────────────────────────────


def save_retrospective_db(
    *,
    session: Session,
    task_id: str,
    score: int = 3,
    successes: list[str] | None = None,
    failures: list[str] | None = None,
    lessons: list[str] | None = None,
    playbook: str | None = None,
    authored_by: str = "史官",
    tenant_id: int = 1,
    outcome: str = "pending",
) -> dict[str, Any]:
    """INSERT OR UPDATE retrospectives 表。

    返回与 chaotang_store.save_retrospective 格式一致的 dict。
    """
    ensure_retrospective_outcome_column(session)
    now = _now()
    row = session.query(Retrospective).filter_by(task_id=task_id).first()
    if row is None:
        row = Retrospective(task_id=task_id, tenant_id=tenant_id)
        session.add(row)
    row.score = score
    row.successes_json = json.dumps(successes or [], ensure_ascii=False)
    row.failures_json = json.dumps(failures or [], ensure_ascii=False)
    row.lessons_json = json.dumps(lessons or [], ensure_ascii=False)
    row.playbook = playbook
    row.authored_by = authored_by
    row.authored_at = now
    row.synthetic = False
    row.outcome = outcome
    session.flush()

    return {
        "score": score,
        "successes": successes or [],
        "failures": failures or [],
        "lessons": lessons or [],
        "playbook": playbook,
        "authoredBy": authored_by,
        "authoredAt": now,
        "synthetic": False,
        "outcome": outcome,
    }


def get_retrospective_db(session: Session, task_id: str) -> dict[str, Any] | None:
    """读 retrospective;不存在返回 None。"""
    ensure_retrospective_outcome_column(session)
    row = session.query(Retrospective).filter_by(task_id=task_id).first()
    if row is None:
        return None
    return {
        "score": row.score,
        "successes": json.loads(row.successes_json or "[]"),
        "failures": json.loads(row.failures_json or "[]"),
        "lessons": json.loads(row.lessons_json or "[]"),
        "playbook": row.playbook,
        "authoredBy": row.authored_by,
        "authoredAt": row.authored_at,
        "synthetic": row.synthetic,
        "outcome": getattr(row, "outcome", "pending"),
    }
