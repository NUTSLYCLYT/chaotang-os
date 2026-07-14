# src/chaotang_store.py
"""朝堂裁决/复盘的 JSON 文件存储 + 批准后回流知识库。

双写策略(Session-10 D15):
  写 → JSON 文件先落(保险兜底) + 同时写 SQLite(src/db/flow_store)
  读 → 优先 SQLite;SQLite 不可用/空时 fallback JSON
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any

from src.runtime_paths import resolve_runtime_paths

_DATA_ROOT = resolve_runtime_paths().data / "default"
_VALID_ACTIONS = {"approve", "reject", "inquire"}


def _get_default_tenant_id() -> int:
    """动态查询 slug='default' 的 tenant_id(D16②,不硬编码)。"""
    try:
        import sqlite3
        db = resolve_runtime_paths().database
        if not db.exists():
            return 1
        conn = sqlite3.connect(str(db))
        row = conn.execute("SELECT id FROM tenants WHERE slug='default'").fetchone()
        conn.close()
        return int(row[0]) if row else 1
    except Exception:
        return 1


def _db_session():
    """获取 SQLAlchemy Session;失败返回 None(降级到 JSON only)。"""
    try:
        from src.db.engine import SessionLocal

        return SessionLocal()
    except Exception:
        return None


# 裁决动作 → 持久化奏折状态(覆盖 run 派生状态)
_ACTION_TO_STATUS: dict[str, str] = {
    "approve": "archived",
    "reject": "rejected",
    "inquire": "pending",
}


def _reviews_dir() -> Path:
    d = _DATA_ROOT / "reviews"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _retros_dir() -> Path:
    d = _DATA_ROOT / "retrospectives"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _memorial_status_dir() -> Path:
    d = _DATA_ROOT / "memorial_status"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_memorial_status(memorial_id: str) -> str | None:
    """返回批阅后持久化的奏折状态(覆盖 run 派生值);若无批阅记录返回 None。

    读取优先级:SQLite memorials.status → JSON 文件兜底。
    """
    # 优先读 SQLite
    db = _db_session()
    if db is not None:
        try:
            from src.db.flow_store import get_memorial_status_db

            status = get_memorial_status_db(db, memorial_id)
            if status and status != "running":
                return status
        except Exception:
            pass
        finally:
            db.close()
    # JSON 兜底
    p = _memorial_status_dir() / f"{memorial_id}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8")).get("status")
    except Exception:
        return None


def save_review(
    memorial_id: str, *, action: str, comment: str, reviewer: str
) -> dict[str, Any]:
    """批阅裁决:先写 JSON(兜底),再双写 SQLite(优先)。"""
    rec = build_review_record(
        memorial_id, action=action, comment=comment, reviewer=reviewer
    )
    write_review_files(rec)
    # ② 双写 SQLite(优先读,写失败静默降级 JSON)
    db = _db_session()
    if db is not None:
        try:
            from src.db.flow_store import save_review_db

            save_review_db(
                session=db,
                review_id=rec["id"],
                memorial_id=memorial_id,
                action=action,
                comment=comment,
                reviewer_name=reviewer,
                tenant_id=_get_default_tenant_id(),
                created_at=rec["createdAt"],
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    return rec


def build_review_record(
    memorial_id: str, *, action: str, comment: str, reviewer: str
) -> dict[str, Any]:
    """Build one legacy-compatible review record without side effects."""
    if action not in _VALID_ACTIONS:
        raise ValueError(f"action 必须是 {_VALID_ACTIONS} 之一")
    return {
        "id": f"review_{datetime.now():%Y%m%d_%H%M%S}_{secrets.token_hex(3)}",
        "memorialId": memorial_id,
        "action": action,
        "comment": comment,
        "reviewerName": reviewer,
        "createdAt": datetime.now().isoformat(timespec="seconds"),
    }


def write_review_files(rec: dict[str, Any]) -> None:
    """Write the JSON compatibility copies after the formal DB commit."""
    memorial_id = str(rec["memorialId"])
    action = str(rec["action"])
    (_reviews_dir() / f"{rec['id']}.json").write_text(
        json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (_reviews_dir() / f"by_memorial_{memorial_id}.json").write_text(
        json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    status_rec = {
        "memorialId": memorial_id,
        "status": _ACTION_TO_STATUS[action],
        "action": action,
        "updatedAt": rec["createdAt"],
    }
    (_memorial_status_dir() / f"{memorial_id}.json").write_text(
        json.dumps(status_rec, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def get_review_for_memorial(memorial_id: str) -> dict[str, Any] | None:
    """读 memorial 最新 review:优先 SQLite,兜底 JSON。"""
    db = _db_session()
    if db is not None:
        try:
            from src.db.flow_store import get_review_for_memorial_db

            result = get_review_for_memorial_db(db, memorial_id)
            if result:
                return result
        except Exception:
            pass
        finally:
            db.close()
    # JSON 兜底
    p = _reviews_dir() / f"by_memorial_{memorial_id}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def list_reviews() -> list[dict[str, Any]]:
    """读全量 reviews:优先 SQLite,兜底扫 JSON。"""
    db = _db_session()
    if db is not None:
        try:
            from src.db.flow_store import list_reviews_db

            results = list_reviews_db(db, tenant_id=_get_default_tenant_id())
            if results:
                return results
        except Exception:
            pass
        finally:
            db.close()
    # JSON 兜底
    out = []
    for p in _reviews_dir().glob("review_*.json"):
        out.append(json.loads(p.read_text(encoding="utf-8")))
    out.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return out


_RETROSPECTIVE_OUTCOMES = {"success", "blocked", "pending"}


def save_retrospective(task_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """保存复盘:先写 JSON(兜底),再双写 SQLite。"""
    outcome = data.get("outcome", "pending")
    if outcome not in _RETROSPECTIVE_OUTCOMES:
        outcome = "pending"
    rec = {
        "score": int(data.get("score", 3)),
        "successes": list(data.get("successes", [])),
        "failures": list(data.get("failures", [])),
        "lessons": list(data.get("lessons", [])),
        "playbook": data.get("playbook"),
        "authoredBy": data.get("authoredBy", "史官"),
        "authoredAt": datetime.now().isoformat(timespec="seconds"),
        "synthetic": bool(data.get("synthetic", False)),
        "outcome": outcome,
    }
    # ① JSON 兜底
    (_retros_dir() / f"{task_id}.json").write_text(
        json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    # ② 双写 SQLite
    db = _db_session()
    if db is not None:
        try:
            from src.db.flow_store import save_retrospective_db

            save_retrospective_db(
                session=db,
                task_id=task_id,
                score=rec["score"],
                successes=rec["successes"],
                failures=rec["failures"],
                lessons=rec["lessons"],
                playbook=rec["playbook"],
                authored_by=rec["authoredBy"],
                tenant_id=_get_default_tenant_id(),
                outcome=rec["outcome"],
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    return rec


def get_retrospective(task_id: str) -> dict[str, Any] | None:
    """读复盘:优先 SQLite,兜底 JSON。"""
    db = _db_session()
    if db is not None:
        try:
            from src.db.flow_store import get_retrospective_db

            result = get_retrospective_db(db, task_id)
            if result:
                return result
        except Exception:
            pass
        finally:
            db.close()
    # JSON 兜底
    p = _retros_dir() / f"{task_id}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def feedback_to_knowledge(title: str, content: str) -> bool:
    """(P1)批准奏折/复盘 lessons 回流到知识索引,失败静默返回 False。

    使用 KnowledgeRAG.add_texts 的真实签名:list[(text, source, metadata)]。
    """
    try:
        from src.knowledge_rag import get_rag

        get_rag().add_texts([(content, "chaotang_approved", {"title": title})])
        return True
    except Exception:
        return False


def count_knowledge_items() -> int:
    """返回 chaotang_approved source 的知识条目数(chunks)。

    RAG 不可用时静默返回 0,不抛异常。
    """
    try:
        from src.knowledge_rag import get_rag

        return get_rag().count_by_source("chaotang_approved")
    except Exception:
        return 0
