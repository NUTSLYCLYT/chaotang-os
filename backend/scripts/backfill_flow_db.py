#!/usr/bin/env python3
"""backfill_flow_db.py — 把现有 JSON 历史数据索引进 SQLite。

幂等(可重复跑):已存在的记录跳过(INSERT OR IGNORE 语义)。

数据源:
  data/default/runs/*/run_meta.json     → memorials 表 (~60 条)
  data/default/reviews/review_*.json   → reviews 表 (~25 条)
  data/default/memorial_status/*.json  → 覆盖 memorials.status (~9 条)
  data/default/retrospectives/*.json   → retrospectives 表 (0 条)

执行:
  cd jiqun_ai
  FENGQUN_AUTH=false python scripts/backfill_flow_db.py
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

# ── 确保 jiqun_ai 根目录在 sys.path ──────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.db.engine import SessionLocal  # noqa: E402
from src.db.flow_store import (  # noqa: E402
    get_memorial_status_db,
    get_retrospective_db,
    save_review_db,
    save_retrospective_db,
    upsert_memorial,
)
from src.db.models import Base, Memorial  # noqa: E402
from src.step_log import load_run  # noqa: E402
from src.runtime_paths import resolve_runtime_paths  # noqa: E402

_DATA_DEFAULT = resolve_runtime_paths().data / "default"


# ── 动态查询 tenant_id(D16②) ─────────────────────────────────────────────

def _get_default_tenant_id() -> int:
    db_path = resolve_runtime_paths().database
    if not db_path.exists():
        return 1
    try:
        conn = sqlite3.connect(str(db_path))
        row = conn.execute("SELECT id FROM tenants WHERE slug='default'").fetchone()
        conn.close()
        return int(row[0]) if row else 1
    except Exception:
        return 1


# ── 从 run_summary 派生 memorial 字段 ─────────────────────────────────────

def _run_to_memorial_fields(run_id: str) -> dict | None:
    """加载 run JSON 并派生 MemorialBrief 字段。失败返回 None。"""
    try:
        from web.run_utils import run_summary
        from src.chaotang_api import enrich_memorial
        run = load_run(run_id)
        if run is None:
            return None
        summary = run_summary(run)
        summary["final_output"] = run.final_output
        mem = enrich_memorial(summary)
        return mem
    except Exception as e:
        print(f"  [WARN] run {run_id} 派生失败: {e}", file=sys.stderr)
        return None


# ── backfill memorials ────────────────────────────────────────────────────

def backfill_memorials(session, tenant_id: int) -> tuple[int, int, int]:
    runs_dir = _DATA_DEFAULT / "runs"
    if not runs_dir.exists():
        return 0, 0, 0

    run_ids = [d.name for d in runs_dir.iterdir() if d.is_dir()]
    scanned = len(run_ids)
    inserted = 0
    skipped = 0

    # 读 memorial_status 覆盖 status
    status_dir = _DATA_DEFAULT / "memorial_status"

    for run_id in run_ids:
        # 幂等:已存在跳过
        existing = session.query(Memorial).filter_by(memorial_id=run_id).first()
        if existing:
            skipped += 1
            continue

        fields = _run_to_memorial_fields(run_id)
        if fields is None:
            skipped += 1
            continue

        # 读 chaotang_store 持久状态覆盖派生状态
        status = fields.get("status", "running")
        status_file = status_dir / f"{run_id}.json"
        if status_file.exists():
            try:
                persisted = json.loads(status_file.read_text(encoding="utf-8")).get("status")
                if persisted:
                    status = persisted
            except Exception:
                pass

        upsert_memorial(
            session=session,
            memorial_id=run_id,
            tenant_id=tenant_id,
            title=fields.get("title", ""),
            source_department=fields.get("sourceDepartment", ""),
            agent_code=fields.get("agentCode", ""),
            priority=fields.get("priority", "medium"),
            status=status,
            summary=fields.get("summary", ""),
            created_at=fields.get("createdAt", ""),
        )
        inserted += 1

    session.commit()
    return scanned, inserted, skipped


# ── backfill reviews ──────────────────────────────────────────────────────

def backfill_reviews(session, tenant_id: int) -> tuple[int, int, int]:
    reviews_dir = _DATA_DEFAULT / "reviews"
    if not reviews_dir.exists():
        return 0, 0, 0

    review_files = list(reviews_dir.glob("review_*.json"))
    scanned = len(review_files)
    inserted = 0
    skipped = 0

    from src.db.models import Review
    for f in review_files:
        try:
            rec = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            skipped += 1
            continue

        review_id = rec.get("id", "")
        if not review_id:
            skipped += 1
            continue

        # 幂等
        if session.query(Review).filter_by(review_id=review_id).first():
            skipped += 1
            continue

        save_review_db(
            session=session,
            review_id=review_id,
            memorial_id=rec.get("memorialId", ""),
            action=rec.get("action", "approve"),
            comment=rec.get("comment", ""),
            reviewer_name=rec.get("reviewerName", ""),
            tenant_id=tenant_id,
            created_at=rec.get("createdAt", ""),
        )
        inserted += 1

    session.commit()
    return scanned, inserted, skipped


# ── backfill retrospectives ───────────────────────────────────────────────

def backfill_retrospectives(session, tenant_id: int) -> tuple[int, int, int]:
    retros_dir = _DATA_DEFAULT / "retrospectives"
    if not retros_dir.exists():
        return 0, 0, 0

    retro_files = list(retros_dir.glob("*.json"))
    scanned = len(retro_files)
    inserted = 0
    skipped = 0

    from src.db.models import Retrospective
    for f in retro_files:
        task_id = f.stem
        if session.query(Retrospective).filter_by(task_id=task_id).first():
            skipped += 1
            continue
        try:
            rec = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            skipped += 1
            continue

        save_retrospective_db(
            session=session,
            task_id=task_id,
            score=int(rec.get("score", 3)),
            successes=list(rec.get("successes", [])),
            failures=list(rec.get("failures", [])),
            lessons=list(rec.get("lessons", [])),
            playbook=rec.get("playbook"),
            authored_by=rec.get("authoredBy", "史官"),
            tenant_id=tenant_id,
        )
        inserted += 1

    session.commit()
    return scanned, inserted, skipped


# ── main ──────────────────────────────────────────────────────────────────

def main() -> None:
    tenant_id = _get_default_tenant_id()
    print(f"[backfill] tenant_id={tenant_id} (slug=default)")

    session = SessionLocal()
    try:
        # memorials
        sc, ins, sk = backfill_memorials(session, tenant_id)
        print(f"[backfill] memorials: {sc} scanned, {ins} inserted, {sk} skipped")

        # reviews(写 reviews + 联动更新 memorials.status)
        sc, ins, sk = backfill_reviews(session, tenant_id)
        print(f"[backfill] reviews:   {sc} scanned, {ins} inserted, {sk} skipped")

        # retrospectives
        sc, ins, sk = backfill_retrospectives(session, tenant_id)
        print(f"[backfill] retrospectives: {sc} scanned, {ins} inserted, {sk} skipped")

        print("[backfill] done.")
    except Exception as e:
        session.rollback()
        print(f"[backfill] ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
