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

import json
import logging
import os
import threading
from datetime import datetime, timezone
from hashlib import sha1, sha256
from typing import TYPE_CHECKING

from sqlalchemy import func

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy.orm import Session


_logger = logging.getLogger(__name__)


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


def enqueue_evidence_rework_generation(
    db: "Session",
    *,
    task_id: str,
    decision_id: str,
    prior_final_memorial_content_hash: str,
    reason: str,
    followup_question: str | None,
) -> tuple[dict[str, object], bool]:
    """Create or reuse the generation bound to one exact evidence request."""
    from src.core_tenant_lineage import tenant_id_for_task
    from src.db.models import OutboxEvent

    identity_payload = {
        "task_id": task_id,
        "prior_final_memorial_content_hash": prior_final_memorial_content_hash,
        "reason": reason,
        "followup_question": followup_question,
    }
    canonical = json.dumps(
        identity_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    idempotency_key = f"evidence-rework:{sha256(canonical.encode('utf-8')).hexdigest()}"
    existing = (
        db.query(OutboxEvent)
        .filter_by(task_id=task_id, idempotency_key=idempotency_key)
        .first()
    )
    if existing is not None:
        return json.loads(existing.payload_json), False

    latest_generation = (
        db.query(func.max(OutboxEvent.generation))
        .filter_by(task_id=task_id)
        .scalar()
    )
    generation = max(latest_generation or 1, 1) + 1
    generation_id = f"outbox_rework_{sha256(idempotency_key.encode('utf-8')).hexdigest()[:16]}"
    payload: dict[str, object] = {
        "schema_version": "EvidenceReworkGenerationV1",
        "generation_id": generation_id,
        "generation": generation,
        "status": "awaiting_evidence",
        "prior_final_memorial_content_hash": prior_final_memorial_content_hash,
        "evidence_request": {
            "reason": reason,
            "followup_question": followup_question,
        },
        "affected_sections": ["contract_review"],
    }
    now = _now_iso()
    db.add(
        OutboxEvent(
            id=generation_id,
            tenant_id=tenant_id_for_task(db, task_id),
            task_id=task_id,
            decision_id=decision_id,
            event_type="evidence.rework",
            generation=generation,
            idempotency_key=idempotency_key,
            status="awaiting_evidence",
            attempts=0,
            max_attempts=3,
            payload_json=json.dumps(
                payload,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ),
            created_at=now,
            updated_at=now,
        )
    )
    return payload, True


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


def _poll_pending_once() -> None:
    from src.db.engine import SessionLocal
    from src.execution.outbox_worker import process_pending_events

    db = SessionLocal()
    try:
        results = process_pending_events(db, limit=10)
        if results:
            _logger.info("outbox poll processed=%d", len(results))
    finally:
        db.close()


class OutboxPoller:
    """Small lifecycle-owned trigger for the durable database outbox.

    Correctness remains in the compare-and-swap claim and persisted retry state;
    this thread only guarantees that pending and stale events are revisited after
    a process crash even when no external scheduler is installed.
    """

    def __init__(
        self,
        *,
        interval_seconds: float,
        poll_once: "Callable[[], object]" = _poll_pending_once,
    ) -> None:
        self._interval_seconds = interval_seconds
        self._poll_once = poll_once
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=self._run,
            name="chaotang-outbox-poller",
            daemon=True,
        )

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._poll_once()
            except Exception:  # noqa: BLE001 - a later retry must survive one poll failure.
                _logger.exception("outbox poll failed")
            self._stop.wait(self._interval_seconds)

    def start(self) -> None:
        self._thread.start()

    def stop(self, *, timeout: float = 5.0) -> None:
        self._stop.set()
        self._thread.join(timeout=timeout)

    def is_alive(self) -> bool:
        return self._thread.is_alive()


def start_outbox_poller() -> OutboxPoller | None:
    schema_mode = os.environ.get("FENGQUN_SCHEMA_MODE", "strict").strip().lower()
    configured = os.environ.get("FENGQUN_OUTBOX_POLLER", "true").strip().lower()
    if schema_mode == "test" or configured not in {"1", "true", "yes"}:
        return None
    try:
        interval = max(1.0, float(os.environ.get("FENGQUN_OUTBOX_POLL_SECONDS", "30")))
    except ValueError:
        interval = 30.0
    poller = OutboxPoller(interval_seconds=interval)
    poller.start()
    return poller
