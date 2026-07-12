"""运营闭环构建台账(2026-07-11 补齐)。

frontend/src/features/operating-loop/lib/build-ledger.ts 调用的
/api/court/build-ledger 一直是死链——前端曾有一份 Node fs 版本
(build-ledger-store.ts)，随"前端 BFF 退休"一起变成孤儿代码。这里用真实
数据库表重新实现同一份契约：GET 支持 taskId 过滤 / ?audit=1 审计事件 /
?format=export 全量导出；POST 支持 {entry} 直接持久化、
{action:'dispatch', entry}、{action:'prune', retentionDays}、
{action:'transition', taskId, toStatus, note} 四种动作。

P0-A(2026-07-12,独立只读审查发现):"BuildLedgerEntry/BuildLedgerAuditEvent
完全没有租户/用户归属，GET(不带 taskId)会把最近 50 条记录跨所有用户/
租户返回给任意已登录调用方"——是 IDOR/broken access control。这里给每个
读写路径都补上 (tenant_id, user_id) 归属校验:
- tenant_id 走 src.tenant.resolve_current_tenant_id()(本仓库 Decree/Task/
  JinyiweiEvidence 的既有惯例)。
- user_id 走 _owner_id(user) —— DecisionTask/_user_id() 的同款惯例:
  user.user_id or user.username or user.tenant_slug or "anonymous"。
- 按 taskId 查询别人的条目、transition 别人的条目，统一表现得像"不存在"
  (不泄露对方存在)，而不是返回一个专门的"无权限"错误。
- prune 是唯一的例外:本项目没有独立的"跨租户 super-admin"角色模型，role
  只有 admin/user 一种区分，admin 权限始终局限在其 JWT 自带的那个
  tenant_slug 内——所以 prune 按 tenant_id 收口(admin 可以清理"本租户"
  所有用户的过期条目，这是"管理本租户台账"这个动作本身的合理范围，不算
  跨用户泄漏)，但绝不触碰其他租户的数据。
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

# 2026-07-12 历史数据归属方案(用户拍板选定，见 review-handoff.md)：迁移前的行
# owner 不可靠推断，回填成这个哨兵值——_owner_id() 对任何真实请求都不会算出
# "anonymous"(CurrentUser.tenant_slug 永远有非空默认值 "default")，所以这些
# 行默认对所有人都不可见，不是"低权限"而是"永久孤儿"。GET 端点给 admin 加一个
# 显式 opt-in 的 ?includeUnowned=1，按 tenant_id 收口，让 admin 能找到、处理
# 这些孤儿行，而不是放着它们默认永久不可达。
_UNOWNED_SENTINEL = "anonymous"


def _owner_id(user: CurrentUser) -> str:
    return str(user.user_id or user.username or user.tenant_slug or _UNOWNED_SENTINEL)

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
    includeUnowned: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    from sqlalchemy import or_

    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerAuditEvent, BuildLedgerEntry
    from src.tenant import resolve_current_tenant_id

    tenant_id = resolve_current_tenant_id()
    owner_id = _owner_id(user)
    # 只有 admin 显式传 includeUnowned=1 才放宽——普通用户传这个参数会被
    # 忽略,不会因此看到孤儿行,更不会看到其他真实用户的行(见下方 or_ 条件,
    # 只多加了 user_id == 哨兵值这一种情况,不是"admin 能看租户内一切")。
    include_unowned = includeUnowned == "1" and user.role == "admin"

    db = SessionLocal()
    try:
        if audit == "1":
            q = db.query(BuildLedgerAuditEvent).filter(
                BuildLedgerAuditEvent.tenant_id == tenant_id
            )
            if include_unowned:
                q = q.filter(
                    or_(
                        BuildLedgerAuditEvent.user_id == owner_id,
                        BuildLedgerAuditEvent.user_id == _UNOWNED_SENTINEL,
                    )
                )
            else:
                q = q.filter(BuildLedgerAuditEvent.user_id == owner_id)
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

        q = db.query(BuildLedgerEntry).filter(BuildLedgerEntry.tenant_id == tenant_id)
        if include_unowned:
            q = q.filter(
                or_(
                    BuildLedgerEntry.user_id == owner_id,
                    BuildLedgerEntry.user_id == _UNOWNED_SENTINEL,
                )
            )
        else:
            q = q.filter(BuildLedgerEntry.user_id == owner_id)
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
    from src.tenant import resolve_current_tenant_id

    tenant_id = resolve_current_tenant_id()
    owner_id = _owner_id(user)

    action = body.get("action")
    if action == "prune":
        # 独立安全审查(2026-07-11)发现: 批量硬删除不该对所有已登录用户开放,
        # 只有 admin 能清理台账保留期外的记录。
        from fastapi import HTTPException

        if user.role != "admin":
            raise HTTPException(status_code=403, detail="需要管理员权限才能清理台账")
        return _prune(int(body.get("retentionDays") or _DEFAULT_RETENTION_DAYS), tenant_id=tenant_id)
    if action == "dispatch":
        return _dispatch(body.get("entry") or {}, tenant_id=tenant_id, user_id=owner_id)
    if action == "transition":
        return _transition(
            task_id=str(body.get("taskId") or ""),
            to_status=str(body.get("toStatus") or ""),
            note=str(body.get("note") or ""),
            actor=user.username or owner_id,
            tenant_id=tenant_id,
            user_id=owner_id,
        )
    entry = body.get("entry")
    if entry:
        return _persist(entry, tenant_id=tenant_id, user_id=owner_id)
    return {"success": False, "data": None, "error": "unsupported_action"}


def _persist(entry: dict[str, Any], *, tenant_id: int, user_id: str) -> dict[str, Any]:
    """2026-07-12 独立审查第二轮纠正："_persist 的 check-then-insert 存在并发
    同 ID 竞态"——原来是"查当前 owner 范围内有没有 → 查全局 id 冲突 →
    INSERT"三步走，两个并发请求可能都在对方提交前通过前两步检查，第二个在
    commit 时因主键冲突抛 IntegrityError，变成未处理的 500(已用真实并发线程
    测试复现，见 test_build_ledger_persist_concurrency.py)。

    改成跟 upsert_evidence(P0-1/P0-C)同源的手法:owner 范围内的查询只是常见
    路径的性能优化,真正的仲裁是数据库主键唯一约束——插入包进
    db.begin_nested()(SAVEPOINT),失败时捕获 IntegrityError、回滚 SAVEPOINT
    (不拖累外层事务)，再原地查一次真正冲突的是谁:
    - 冲突行属于同一个 (tenant_id, user_id):说明是同一个 owner 的并发写入
      (比如同一个人两次几乎同时提交)，退回去做原地更新,不是错误。
    - 冲突行属于别的 owner:这才是真正的 id 冲突,返回 id_conflict,不泄露
      对方身份，也不静默接管。
    - 唯一约束报错却查不到冲突的那一行:不是预期里的并发场景,不静默吞掉。
    """
    from sqlalchemy.exc import IntegrityError

    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerEntry

    db = SessionLocal()
    try:
        task_id = str(entry.get("taskId") or "")
        entry_id = str(entry.get("id") or _make_id("ledger", task_id, _now_iso()))
        status = str(entry.get("status") or "dispatched")
        now = _now_iso()
        stored = {k: v for k, v in entry.items() if k not in {"id", "taskId", "status", "createdAt", "updatedAt"}}

        def _apply_update(target: BuildLedgerEntry) -> None:
            target.status = status
            target.entry_json = json.dumps(stored, ensure_ascii=False)
            target.updated_at = now

        row = (
            db.query(BuildLedgerEntry)
            .filter_by(id=entry_id, tenant_id=tenant_id, user_id=user_id)
            .first()
        )
        if row is not None:
            _apply_update(row)
            db.commit()
            return {"success": True, "data": {"entry": _row_to_entry(row)}, "error": None}

        new_row = BuildLedgerEntry(
            id=entry_id,
            task_id=task_id,
            status=status,
            entry_json=json.dumps(stored, ensure_ascii=False),
            tenant_id=tenant_id,
            user_id=user_id,
            created_at=str(entry.get("createdAt") or now),
            updated_at=now,
        )
        try:
            with db.begin_nested():
                db.add(new_row)
                db.flush()
        except IntegrityError:
            conflict = db.query(BuildLedgerEntry).filter_by(id=entry_id).first()
            if conflict is None:
                raise
            if conflict.tenant_id == tenant_id and conflict.user_id == user_id:
                _apply_update(conflict)
                db.commit()
                return {"success": True, "data": {"entry": _row_to_entry(conflict)}, "error": None}
            return {"success": False, "data": None, "error": "id_conflict"}
        db.commit()
        return {"success": True, "data": {"entry": _row_to_entry(new_row)}, "error": None}
    finally:
        db.close()


def _dispatch(entry: dict[str, Any], *, tenant_id: int, user_id: str) -> dict[str, Any]:
    entry = {**entry, "status": entry.get("status") or "dispatched"}
    return _persist(entry, tenant_id=tenant_id, user_id=user_id)


def _transition(
    *, task_id: str, to_status: str, note: str, actor: str, tenant_id: int, user_id: str
) -> dict[str, Any]:
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerAuditEvent, BuildLedgerEntry

    if to_status not in _STATUS_LABEL:
        return {"success": False, "data": None, "error": "invalid_status"}

    db = SessionLocal()
    try:
        row = (
            db.query(BuildLedgerEntry)
            .filter_by(task_id=task_id, tenant_id=tenant_id, user_id=user_id)
            .order_by(BuildLedgerEntry.created_at.desc())
            .first()
        )
        if row is None:
            # 真的不存在、和"存在但属于别人"统一表现成同一个错误——不泄露
            # 别人是否有这个 taskId 的台账条目。
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
                tenant_id=tenant_id,
                user_id=user_id,
                created_at=now,
            )
        )
        row.status = to_status
        row.updated_at = now
        db.commit()
        return {"success": True, "data": {"entry": _row_to_entry(row)}, "error": None}
    finally:
        db.close()


def _prune(retention_days: int, *, tenant_id: int) -> dict[str, Any]:
    """按 tenant_id 收口(不是 tenant_id+user_id)——本项目没有独立的跨租户
    super-admin 角色模型,admin 权限局限在其自己的 tenant_slug 内;admin 清理
    "本租户"所有用户的过期条目是这个动作本身的合理范围,但绝不触碰其他
    租户的数据。"""
    from src.db.engine import SessionLocal
    from src.db.models import BuildLedgerEntry

    db = SessionLocal()
    try:
        before = db.query(BuildLedgerEntry).filter_by(tenant_id=tenant_id).count()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat(timespec="seconds")
        stale = (
            db.query(BuildLedgerEntry)
            .filter(
                BuildLedgerEntry.tenant_id == tenant_id,
                BuildLedgerEntry.created_at < cutoff,
            )
            .all()
        )
        for row in stale:
            db.delete(row)
        db.commit()
        after = db.query(BuildLedgerEntry).filter_by(tenant_id=tenant_id).count()
        return {
            "success": True,
            "data": {"before": before, "after": after, "removed": before - after},
            "error": None,
        }
    finally:
        db.close()
