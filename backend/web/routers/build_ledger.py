"""运营闭环构建台账(2026-07-11 补齐)。

frontend/src/features/operating-loop/lib/build-ledger.ts 调用的
/api/court/build-ledger 一直是死链——前端曾有一份 Node fs 版本
(build-ledger-store.ts)，随"前端 BFF 退休"一起变成孤儿代码。这里用真实
数据库表重新实现同一份契约：GET 支持 taskId 过滤 / ?audit=1 审计事件 /
?format=export 全量导出；POST 支持 {entry} 直接持久化、
{action:'dispatch', entry}、{action:'prune', retentionDays}、
{action:'transition', taskId, toStatus, note} 四种动作。
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from hashlib import sha1
from typing import Any

from fastapi import APIRouter, Body, Depends, Query

from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/court/build-ledger", tags=["build-ledger"])

_LIMIT = 50
_DEFAULT_RETENTION_DAYS = 90

_ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "dispatched": ["reviewing", "returned", "archived"],
    "reviewing": ["returned", "archived"],
    "returned": ["reviewing", "archived"],
    "archived": [],
}

_STATUS_LABEL = {
    "dispatched": "待军机复核",
    "reviewing": "军机复核中",
    "returned": "退回工部补证",
    "archived": "已入史馆",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_id(prefix: str, *parts: object) -> str:
    seed = "|".join(str(p) for p in parts)
    return f"{prefix}_{sha1(seed.encode('utf-8')).hexdigest()[:12]}"


def _row_to_entry(row) -> dict[str, Any]:
    entry = json.loads(row.entry_json)
    entry["id"] = row.id
    entry["taskId"] = row.task_id
    entry["status"] = row.status
    entry["createdAt"] = row.created_at
    entry["updatedAt"] = row.updated_at
    return entry


@router.get("")
def build_ledger_get(
    taskId: str | None = Query(default=None),
    audit: str | None = Query(default=None),
    format: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerAuditEvent, BuildLedgerEntry

    db = SessionLocal()
    try:
        if audit == "1":
            q = db.query(BuildLedgerAuditEvent)
            if taskId:
                q = q.filter_by(task_id=taskId)
            rows = q.order_by(BuildLedgerAuditEvent.created_at.desc()).limit(_LIMIT).all()
            data = [
                {
                    "id": r.id,
                    "taskId": r.task_id,
                    "actor": r.actor,
                    "action": r.action,
                    "fromStatus": r.from_status,
                    "toStatus": r.to_status,
                    "note": r.note,
                    "createdAt": r.created_at,
                }
                for r in rows
            ]
            return {"success": True, "data": data, "error": None}

        q = db.query(BuildLedgerEntry)
        if taskId:
            q = q.filter_by(task_id=taskId)
        rows = q.order_by(BuildLedgerEntry.created_at.desc()).limit(_LIMIT).all()
        entries = [_row_to_entry(r) for r in rows]

        if format == "export":
            return {
                "success": True,
                "data": {
                    "schema": "chaotang.build-ledger.v1",
                    "exportedAt": _now_iso(),
                    "count": len(entries),
                    "entries": entries,
                },
                "error": None,
            }

        return {"success": True, "data": entries, "error": None}
    finally:
        db.close()


@router.post("")
def build_ledger_post(
    body: dict[str, Any] = Body(default_factory=dict),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    action = body.get("action")
    if action == "prune":
        # 独立安全审查(2026-07-11)发现: 批量硬删除不该对所有已登录用户开放,
        # 只有 admin 能清理台账保留期外的记录。
        from fastapi import HTTPException

        if user.role != "admin":
            raise HTTPException(status_code=403, detail="需要管理员权限才能清理台账")
        return _prune(int(body.get("retentionDays") or _DEFAULT_RETENTION_DAYS))
    if action == "dispatch":
        return _dispatch(body.get("entry") or {})
    if action == "transition":
        return _transition(
            task_id=str(body.get("taskId") or ""),
            to_status=str(body.get("toStatus") or ""),
            note=str(body.get("note") or ""),
            actor=user.username,
        )
    entry = body.get("entry")
    if entry:
        return _persist(entry)
    return {"success": False, "data": None, "error": "unsupported_action"}


def _persist(entry: dict[str, Any]) -> dict[str, Any]:
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerEntry

    db = SessionLocal()
    try:
        task_id = str(entry.get("taskId") or "")
        entry_id = str(entry.get("id") or _make_id("ledger", task_id, _now_iso()))
        status = str(entry.get("status") or "dispatched")
        now = _now_iso()
        stored = {k: v for k, v in entry.items() if k not in {"id", "taskId", "status", "createdAt", "updatedAt"}}
        row = db.query(BuildLedgerEntry).filter_by(id=entry_id).first()
        if row is None:
            row = BuildLedgerEntry(
                id=entry_id,
                task_id=task_id,
                status=status,
                entry_json=json.dumps(stored, ensure_ascii=False),
                created_at=str(entry.get("createdAt") or now),
                updated_at=now,
            )
            db.add(row)
        else:
            row.status = status
            row.entry_json = json.dumps(stored, ensure_ascii=False)
            row.updated_at = now
        db.commit()
        return {"success": True, "data": {"entry": _row_to_entry(row)}, "error": None}
    finally:
        db.close()


def _dispatch(entry: dict[str, Any]) -> dict[str, Any]:
    entry = {**entry, "status": entry.get("status") or "dispatched"}
    return _persist(entry)


def _transition(*, task_id: str, to_status: str, note: str, actor: str) -> dict[str, Any]:
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerAuditEvent, BuildLedgerEntry

    if to_status not in _STATUS_LABEL:
        return {"success": False, "data": None, "error": "invalid_status"}

    db = SessionLocal()
    try:
        row = (
            db.query(BuildLedgerEntry)
            .filter_by(task_id=task_id)
            .order_by(BuildLedgerEntry.created_at.desc())
            .first()
        )
        if row is None:
            return {"success": False, "data": None, "error": "entry_not_found"}
        if to_status not in _ALLOWED_TRANSITIONS.get(row.status, []):
            return {
                "success": False,
                "data": None,
                "error": f"transition_not_allowed:{row.status}->{to_status}",
            }
        now = _now_iso()
        db.add(
            BuildLedgerAuditEvent(
                id=_make_id("audit", task_id, row.status, to_status, now),
                task_id=task_id,
                actor=actor,
                action=f"{_STATUS_LABEL[row.status]} -> {_STATUS_LABEL[to_status]}",
                from_status=row.status,
                to_status=to_status,
                note=note,
                created_at=now,
            )
        )
        row.status = to_status
        row.updated_at = now
        db.commit()
        return {"success": True, "data": {"entry": _row_to_entry(row)}, "error": None}
    finally:
        db.close()


def _prune(retention_days: int) -> dict[str, Any]:
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerEntry

    db = SessionLocal()
    try:
        before = db.query(BuildLedgerEntry).count()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat(timespec="seconds")
        stale = db.query(BuildLedgerEntry).filter(BuildLedgerEntry.created_at < cutoff).all()
        for row in stale:
            db.delete(row)
        db.commit()
        after = db.query(BuildLedgerEntry).count()
        return {
            "success": True,
            "data": {"before": before, "after": after, "removed": before - after},
            "error": None,
        }
    finally:
        db.close()
