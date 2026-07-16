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

# 保守取值:远低于 SQLite 历史默认的 SQLITE_MAX_VARIABLE_NUMBER(999)和
# Postgres 的 int16 参数上限(32767),两边都留足余量。跟
# alembic/versions/005_decree_execution_event_sequence.py 的
# _IN_CLAUSE_CHUNK_SIZE 同源同值。
_SEQUENCE_REPAIR_CHUNK_SIZE = 500

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

    2026-07-12 Codex 停止前二次审查纠正："自愈避免了崩溃，但没有完成旧库的正确
    迁移"——只加列、旧行全部落到 DEFAULT 0，同一 task_id 下的历史事件互相之间
    仍然没有确定顺序，等于没修 sequence 要解决的排序问题本身。

    2026-07-12 Codex 停止前三次审查纠正："自愈仍然没有修复此前遗留在中间坏状态
    的数据库"——上一版只在"本次调用真的把列加上"时才回填，如果一个库已经在
    早期(只加列不回填的)自愈版本下跑过一次、卡在"列存在但全是 DEFAULT 0"的
    中间坏状态，之后每次调用都会在 PRAGMA/information_schema 检测到列已存在
    就直接 return，永远不会再去补回填。这里改成:不管列是不是本次调用加的，
    只要检测到"列存在但存在退化值"就重新回填。退化值判定依据：合法 sequence
    永远从 1 开始(本函数的回填、以及 alembic 005 迁移的回填，都是从 1 开始
    编号；record_timeline_event 写入时也是 MAX(已有值)+1，最小可能是 1)，
    所以任何 sequence=0 的行都只可能是"从未被回填过"的残留状态，不可能是
    合法产生的值。回填函数本身是幂等的纯重新推导(按 occurred_at/id 排序
    重新编号整张表)，重复调用不会破坏已经正确的排序。"""
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    try:
        if dialect == "sqlite":
            rows = session.execute(
                text("PRAGMA table_info(decree_execution_events)")
            ).all()
            if not any(row[1] == "sequence" for row in rows):
                session.execute(
                    text(
                        "ALTER TABLE decree_execution_events ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0"
                    )
                )
        else:
            exists = session.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name='decree_execution_events' AND column_name='sequence'"
                )
            ).first()
            if not exists:
                session.execute(
                    text(
                        "ALTER TABLE decree_execution_events ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0"
                    )
                )
    except Exception as exc:  # noqa: BLE001 - tolerate duplicate-column races only.
        message = str(exc).lower()
        if "duplicate column" not in message and "already exists" not in message:
            raise
        # 另一个并发调用已经加过列——继续往下走，仍然要检查是否需要回填。

    _repair_decree_execution_event_sequence_if_degenerate(session)


def ensure_decree_execution_event_ledger_columns(session: Session) -> None:
    """Upgrade legacy timeline tables to the structured event-ledger envelope.

    create_all(checkfirst=True) does not add columns to an existing table, so local/dev
    databases that have not run Alembic 009 must be repaired before ORM reads or writes.
    The defaults deliberately preserve old timeline rows as FALLBACK timeline notes.
    """
    ensure_decree_execution_event_sequence_column(session)
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    columns = {
        "tenant_id": "INTEGER",
        "event_type": "TEXT NOT NULL DEFAULT 'timeline.note'",
        "trace_id": "TEXT",
        "source_label": "TEXT NOT NULL DEFAULT 'FALLBACK'",
        "payload_json": "TEXT NOT NULL DEFAULT '{}'",
        "idempotency_key": "TEXT",
    }
    try:
        if dialect == "sqlite":
            existing = {
                row[1]
                for row in session.execute(
                    text("PRAGMA table_info(decree_execution_events)")
                ).all()
            }
            for name, definition in columns.items():
                if name not in existing:
                    session.execute(
                        text(
                            f"ALTER TABLE decree_execution_events ADD COLUMN {name} {definition}"
                        )
                    )
            session.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "uq_decree_execution_events_task_idempotency "
                    "ON decree_execution_events(task_id, idempotency_key)"
                )
            )
            return

        for name, definition in columns.items():
            session.execute(
                text(
                    "ALTER TABLE decree_execution_events "
                    f"ADD COLUMN IF NOT EXISTS {name} {definition}"
                )
            )
        session.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "uq_decree_execution_events_task_idempotency "
                "ON decree_execution_events(task_id, idempotency_key)"
            )
        )
    except Exception as exc:  # noqa: BLE001 - tolerate concurrent DDL only.
        message = str(exc).lower()
        if "duplicate column" not in message and "already exists" not in message:
            raise


def _repair_decree_execution_event_sequence_if_degenerate(session: Session) -> None:
    """检测哪些 task_id 存在 sequence=0 的退化行(只可能来自"从未被回填过"的旧
    状态，不可能是合法写入产生的值)，只回填这些 task_id。

    2026-07-14 复审(跟 alembic 005 同一轮审查揪出的同款 bug):原实现只要检测
    到"表里存在任意一行退化"就对全表所有 task_id 重新编号，会拿"事后猜的"顺序
    覆盖跟这行退化数据完全无关的其它 task_id 已经合法的 sequence——这个函数
    在每次 app 启动时都跑，live risk 比 alembic 那条一次性迁移路径还大。改成
    只收集有退化行的 task_id，只回填这些，其余任务完全不碰。"""
    from src.db.models import DecreeExecutionEvent

    degenerate_task_ids = [
        row.task_id
        for row in session.query(DecreeExecutionEvent.task_id)
        .filter(DecreeExecutionEvent.sequence == 0)
        .distinct()
        .all()
    ]
    if not degenerate_task_ids:
        return
    _backfill_decree_execution_event_sequence(session, degenerate_task_ids)


def _backfill_decree_execution_event_sequence(
    session: Session, task_ids: list[str]
) -> None:
    """给指定 task_id 集合回填单调递增序号。跟
    alembic/versions/005_decree_execution_event_sequence.py 的回填逻辑同源
    (按 task_id 分组、occurred_at/id 排序、逐行编号)，这里直接用 ORM 查询，
    因为 flow_store.py 本来就允许 import ORM 模型，不需要 Alembic 迁移那种
    "不依赖 app 模型"的克制。

    只回填传入的 task_id，不碰其余任务已经合法的顺序；task_id 数量按
    _SEQUENCE_REPAIR_CHUNK_SIZE 分批查询，避免单条 IN(...) 在退化任务多的库
    上撞 SQL 参数上限。"""
    from src.db.models import DecreeExecutionEvent

    counters: dict[str, int] = {}
    for start in range(0, len(task_ids), _SEQUENCE_REPAIR_CHUNK_SIZE):
        chunk = task_ids[start : start + _SEQUENCE_REPAIR_CHUNK_SIZE]
        rows = (
            session.query(DecreeExecutionEvent.id, DecreeExecutionEvent.task_id)
            .filter(DecreeExecutionEvent.task_id.in_(chunk))
            .order_by(
                DecreeExecutionEvent.task_id,
                DecreeExecutionEvent.occurred_at,
                DecreeExecutionEvent.id,
            )
            .all()
        )
        for row in rows:
            counters[row.task_id] = counters.get(row.task_id, 0) + 1
            session.query(DecreeExecutionEvent).filter_by(id=row.id).update(
                {"sequence": counters[row.task_id]}
            )


def ensure_jinyiwei_evidence_unique_constraint(session: Session) -> None:
    """给已存在的 jinyiwei_evidence 表补上 (tenant_id, claim_key) 唯一约束。

    P0(2026-07-12,外部审查指出)：`upsert_evidence()` 原来是"先 SELECT
    有没有,没有就 INSERT"的应用层去重,是经典 TOCTOU 竞态。真正的修复是
    数据库级 `UniqueConstraint`(见 alembic/versions/007_...、
    src/db/models.py::JinyiweiEvidence.__table_args__)，但 `create_all
    (checkfirst=True)`(web/main.py)对已经存在的表不做约束/索引级 diff——
    只对没跑过 alembic 007 迁移的旧 create_all 建表(dev 环境的常态)补这个
    约束，SQLite 的 ALTER TABLE 不支持给已有表加表级约束，等价的强制手段
    是建一个唯一索引。

    如果表里已经有重复的 (tenant_id, claim_key)(旧竞态遗留的坏数据)，
    直接建唯一索引会失败——那种情况下先去重(保留 updated_at 最新的一行)，
    再重试一次建索引。"""
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    try:
        if dialect == "sqlite":
            session.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "uq_jinyiwei_evidence_tenant_claim_key "
                    "ON jinyiwei_evidence(tenant_id, claim_key)"
                )
            )
            return
        # PostgreSQL 的 ADD CONSTRAINT 不支持 IF NOT EXISTS(只有 ADD COLUMN
        # 才支持)——约束已存在时这条语句必然报错，重启后每次都会撞上。裸
        # execute 报错会让 PostgreSQL 把当前事务标记为 aborted，即便这里
        # try/except 接住了 Python 异常，同一 session 后续任何语句(下一个
        # ensure_*、lifespan 里的 db.commit())都会因为
        # "current transaction is aborted" 连带失败。用 begin_nested()
        # (SAVEPOINT)顶住失败只回滚这一小步，跟 upsert_evidence 里
        # IntegrityError 的处理手法同源。
        with session.begin_nested():
            session.execute(
                text(
                    "ALTER TABLE jinyiwei_evidence "
                    "ADD CONSTRAINT uq_jinyiwei_evidence_tenant_claim_key "
                    "UNIQUE (tenant_id, claim_key)"
                )
            )
    except Exception as exc:  # noqa: BLE001 - 区分"有重复数据需要去重"/"约束已存在"两种已知情况
        message = str(exc).lower()
        # 2026-07-12 Codex 独立审查纠正："PostgreSQL 写入路径的错误消息分支判断有 bug"
        # ——PostgreSQL 表里已有重复数据时建唯一索引报的是
        # `could not create unique index "..." DETAIL: Key (...) is duplicated.`(本机
        # 真实 PostgreSQL 16 手工复现)，这条消息里天然包含"duplicate"(是"duplicated"
        # 的子串)。原来的分支顺序是先查"already exists" or "duplicate"，会把这个真正
        # 需要去重的场景误判成"约束已存在，直接返回"——_dedupe_jinyiwei_evidence()
        # 永远不会被调用，约束永远建不成，白修了这个 P0 本来要挡的竞态坏数据场景。
        # 改成先判定"是不是因为数据本身有重复导致建索引/约束失败"(PostgreSQL 的
        # "is duplicated"/"could not create unique index"、SQLite 的
        # "unique constraint failed"，都是真实观测到的消息)，命中就去重重试；
        # 判定不出来才退回"大概率是约束名已存在"这个更宽泛、误判代价更小的分支。
        is_duplicate_data_conflict = (
            "is duplicated" in message
            or "could not create unique index" in message
            or ("unique" in message and "constraint failed" in message)
            or ("unique" in message and "violat" in message)
        )
        if is_duplicate_data_conflict:
            _dedupe_jinyiwei_evidence(session)
            if dialect == "sqlite":
                session.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS "
                        "uq_jinyiwei_evidence_tenant_claim_key "
                        "ON jinyiwei_evidence(tenant_id, claim_key)"
                    )
                )
            else:
                with session.begin_nested():
                    session.execute(
                        text(
                            "ALTER TABLE jinyiwei_evidence "
                            "ADD CONSTRAINT uq_jinyiwei_evidence_tenant_claim_key "
                            "UNIQUE (tenant_id, claim_key)"
                        )
                    )
            return
        if "already exists" in message:
            return
        raise


def _dedupe_jinyiwei_evidence(session: Session) -> None:
    """同一 (tenant_id, claim_key) 保留 updated_at 最新的一行，删掉其余——
    跟 alembic/versions/007_jinyiwei_evidence_unique_constraint.py 的去重
    逻辑同源，这里是运行时自愈版本。"""
    from src.db.models import JinyiweiEvidence

    rows = (
        session.query(
            JinyiweiEvidence.id, JinyiweiEvidence.tenant_id, JinyiweiEvidence.claim_key
        )
        .order_by(
            JinyiweiEvidence.tenant_id,
            JinyiweiEvidence.claim_key,
            JinyiweiEvidence.updated_at.desc(),
        )
        .all()
    )
    seen: set[tuple[int, str]] = set()
    stale_ids: list[str] = []
    for row in rows:
        key = (row.tenant_id, row.claim_key)
        if key in seen:
            stale_ids.append(row.id)
        else:
            seen.add(key)
    if stale_ids:
        session.query(JinyiweiEvidence).filter(
            JinyiweiEvidence.id.in_(stale_ids)
        ).delete(synchronize_session=False)


def ensure_build_ledger_ownership_columns(session: Session) -> None:
    """给老库(create_all 建的、没跑过 alembic 008 迁移的)补
    build_ledger_entries/build_ledger_audit_events 的 tenant_id/user_id 归属列。

    P0-A(2026-07-12,独立只读审查发现):这两张表原来完全没有归属列，
    /api/court/build-ledger 的 GET(不带 taskId)会把最近 50 条记录跨所有
    用户/租户返回给任意已登录调用方——是 IDOR/broken access control。跟
    ensure_task_result_json_column 同一个理由:纯 ADD COLUMN(不是约束)，
    SQLite/PostgreSQL 都不需要 SAVEPOINT——这不是 alembic 007 那种"PostgreSQL
    的 ADD CONSTRAINT 不支持 IF NOT EXISTS"的问题，ADD COLUMN IF NOT EXISTS
    在 PostgreSQL 上是合法语法，不会报错、不会毒死事务。"""
    bind = session.get_bind()
    dialect = bind.dialect.name if bind is not None else ""
    for table in ("build_ledger_entries", "build_ledger_audit_events"):
        try:
            if dialect == "sqlite":
                rows = session.execute(text(f"PRAGMA table_info({table})")).all()
                existing = {row[1] for row in rows}
                if "tenant_id" not in existing:
                    session.execute(
                        text(
                            f"ALTER TABLE {table} ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1"
                        )
                    )
                if "user_id" not in existing:
                    session.execute(
                        text(
                            f"ALTER TABLE {table} ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous'"
                        )
                    )
                continue
            session.execute(
                text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "
                    "tenant_id INTEGER NOT NULL DEFAULT 1"
                )
            )
            session.execute(
                text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "
                    "user_id TEXT NOT NULL DEFAULT 'anonymous'"
                )
            )
        except Exception as exc:  # noqa: BLE001 - tolerate duplicate-column races only.
            message = str(exc).lower()
            if "duplicate column" not in message and "already exists" not in message:
                raise

    # 独立只读审查(2026-07-12)指出:自愈只补列、不补 (tenant_id, user_id) 组合
    # 索引——create_all(checkfirst=True) 对已存在的表不做索引级 diff,只靠这条
    # 自愈路径升级过的老库会一直缺这个索引(过滤仍然正确,只是没走索引)。
    # CREATE INDEX IF NOT EXISTS 在 SQLite/PostgreSQL 上都合法、不需要
    # dialect 分支,也不会像 alembic 007 的 ADD CONSTRAINT 那样在已存在时报错。
    session.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_build_ledger_entries_tenant_user "
            "ON build_ledger_entries(tenant_id, user_id)"
        )
    )
    session.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_build_ledger_audit_tenant_user "
            "ON build_ledger_audit_events(tenant_id, user_id)"
        )
    )


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
    legacy_writer_id: str | None = None,
) -> dict[str, Any]:
    """Idempotently write a frontend/BFF task into the backend tasks table."""
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.upsert_persisted_task", legacy_writer_id)
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
    legacy_writer_id: str | None = None,
) -> dict[str, Any] | None:
    """Patch result_json/status. If command is supplied, missing rows are created."""
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.patch_persisted_task_result", legacy_writer_id)
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
            legacy_writer_id=legacy_writer_id,
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
    legacy_writer_id: str | None = None,
) -> None:
    """POST /decree/dispatch 后写 decrees + tasks 两表。

    decree_id == task_id(D16①)。
    """
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.save_decree_and_task", legacy_writer_id)
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
    legacy_writer_id: str | None = None,
) -> None:
    """mark_status / 运行进度更新后同步 tasks 表。

    不存在的 task_id 幂等忽略(内存与 DB 可能不同步)。
    """
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.update_task_status", legacy_writer_id)
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
    legacy_writer_id: str | None = None,
) -> None:
    """INSERT(新) 或 UPDATE status/summary/updated_at(已存在)。

    status 必须在 MemorialStatus 值域内(KP-7):
    pending | running | approved | archived | rejected
    """
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.upsert_memorial", legacy_writer_id)
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
    legacy_writer_id: str | None = None,
) -> dict[str, Any]:
    """写 reviews 表 + 联动更新 memorials.status(KP-7)。

    返回 ReviewAction 格式 dict(与 chaotang_store.save_review 返回对齐)。
    """
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.save_review_db", legacy_writer_id)
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
    legacy_writer_id: str | None = None,
) -> dict[str, Any]:
    """INSERT OR UPDATE retrospectives 表。

    返回与 chaotang_store.save_retrospective 格式一致的 dict。
    """
    from src.legacy_write_tripwire import require_legacy_write

    require_legacy_write("flow_store.save_retrospective_db", legacy_writer_id)
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
