"""src/db/engine.py — SQLAlchemy Engine + Session 工厂。

DB_URL 环境变量控制数据库:
  SQLite (dev默认): sqlite:///data/fengqun.db
  Postgres (迁移):  postgresql://user:pass@host/dbname

SQLite 注意:
  - check_same_thread=False(FastAPI 多线程 handler)
  - WAL 模式(通过 connect_event 注入)与现有 tenant.py sqlite3 WAL 并存安全
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from src.runtime_paths import guard_legacy_database, resolve_runtime_paths

# ── DB_URL ────────────────────────────────────────────────────────────────

_DEFAULT_DB = f"sqlite:///{resolve_runtime_paths().database}"
DB_URL: str = os.environ.get("DB_URL", _DEFAULT_DB)
if "DB_URL" not in os.environ:
    guard_legacy_database()

# ── Engine ────────────────────────────────────────────────────────────────

_connect_args: dict = {}
if DB_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False

engine = create_engine(DB_URL, connect_args=_connect_args, echo=False)

# SQLite: 启用 WAL 模式(与现有 fengqun.db WAL 设置一致)
if DB_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_wal(dbapi_conn, _connection_record):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

# ── Session ───────────────────────────────────────────────────────────────

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_session():
    """FastAPI Depends / 上下文管理器均可使用。

    用法(Depends):
        def my_endpoint(db: Session = Depends(get_session)): ...

    用法(with):
        with next(get_session()) as db: ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
