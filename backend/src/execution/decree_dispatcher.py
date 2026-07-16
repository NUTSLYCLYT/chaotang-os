"""事务性 outbox 派单（阶段2）。

见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第6.7/9节。

confirm-edict 必须在同一 DB 事务里写：下旨记录 + 路由快照 + 初始任务状态 + outbox
事件；事务提交后再触发消费，避免"写库成功但派单丢失"或反过来"派单已发但下旨记录
没落库"的不一致窗口。

当前实现用项目既有的 threading.Thread(daemon=True) 模式(同 web/routers/swarm.py)
做"事务提交后立即触发消费"，不是真正的轮询式 worker——这是刻意的最小实现：
outbox 表本身才是可靠性的来源(事件落库了，即使这次触发失败，process_pending_events
也能在下次被外部调度重新捞起来跑)，不是靠这个触发线程。
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from hashlib import sha1
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_event_id(task_id: str, event_type: str) -> str:
    seed = f"{task_id}|{event_type}|{_now_iso()}"
    return f"outbox_{sha1(seed.encode('utf-8')).hexdigest()[:16]}"


def enqueue_dispatch(
    db: "Session",
    *,
    task_id: str,
    decision_id: str,
    event_type: str,
) -> str:
    """在调用方的事务里加入一条 outbox 记录，不在这里 commit(由调用方统一提交，
    保证下旨记录和 outbox 事件同一事务)。返回新事件 id。"""
    from src.core_tenant_lineage import tenant_id_for_task
    from src.db.models import OutboxEvent

    event_id = _make_event_id(task_id, event_type)
    db.add(
        OutboxEvent(
            id=event_id,
            tenant_id=tenant_id_for_task(db, task_id),
            task_id=task_id,
            decision_id=decision_id,
            event_type=event_type,
            status="pending",
            attempts=0,
            max_attempts=3,
            payload_json="{}",
            created_at=_now_iso(),
            updated_at=_now_iso(),
        )
    )
    return event_id


def dispatch_after_commit(event_id: str) -> None:
    """事务提交后调用。后台线程触发消费，失败不影响 HTTP 响应——outbox 行本身
    保留在数据库里，process_pending_events 之后仍能重试。"""

    def _run() -> None:
        from src.db.engine import SessionLocal
        from src.execution.outbox_worker import process_event

        db = SessionLocal()
        try:
            process_event(db, event_id)
        finally:
            db.close()

    threading.Thread(target=_run, daemon=True).start()
