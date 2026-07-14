"""聊天会话持久化 — sessions/{session_id}.json

与旧 web/app.py 的 _SESSIONS_DIR / _load_session / _save_session 行为完全一致。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.runtime_paths import resolve_runtime_paths

SESSIONS_DIR = resolve_runtime_paths().chat_sessions
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def load_session(session_id: str) -> dict[str, Any] | None:
    p = SESSIONS_DIR / f"{session_id}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_session(session: dict[str, Any]) -> None:
    p = SESSIONS_DIR / f"{session['session_id']}.json"
    p.write_text(
        json.dumps(session, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def list_sessions_meta() -> list[dict[str, Any]]:
    """供 GET /api/chat/sessions 使用 — 含 session_id/config/created_at/turn_count/last_input。"""
    sessions: list[dict[str, Any]] = []
    for p in sorted(
        SESSIONS_DIR.glob("*.json"),
        key=lambda x: x.stat().st_mtime,
        reverse=True,
    ):
        try:
            s = json.loads(p.read_text(encoding="utf-8"))
            sessions.append({
                "session_id": s["session_id"],
                "config": s.get("config", ""),
                "created_at": s.get("created_at", ""),
                "turn_count": len(s.get("turns", []) or []),
                "last_input": s["turns"][-1]["user"] if s.get("turns") else "",
            })
        except Exception:
            continue
    return sessions


def delete_session(session_id: str) -> bool:
    p = SESSIONS_DIR / f"{session_id}.json"
    if p.exists():
        p.unlink()
        return True
    return False
