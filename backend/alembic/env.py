"""Alembic env.py — 读 DB_URL 环境变量,支持 SQLite(dev)/Postgres(prod)。

target_metadata = src.db.models.Base.metadata
→ autogenerate 可检测 ORM 与 DB 的 schema 差异。
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── 确保 jiqun_ai 根目录在 sys.path ──────────────────────────────────────
_HERE = Path(__file__).resolve().parent.parent  # jiqun_ai/
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

# ── 导入 ORM Base ─────────────────────────────────────────────────────────
from src.db.models import Base  # noqa: E402

# ── Alembic config 对象 ───────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DB_URL 环境变量优先;兜底用 SQLite fengqun.db
from src.runtime_paths import guard_legacy_database, resolve_runtime_paths

_default_db = str(resolve_runtime_paths().database)
db_url = os.environ.get("DB_URL", f"sqlite:///{_default_db}")
if "DB_URL" not in os.environ:
    guard_legacy_database()
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata

# L-1: flow 表白名单。autogenerate 时只对这 5 张表做差分,
# 跳过 tenants/users/kpi_*/sqlite_sequence 等非 flow 表,
# 防止 Alembic 误生成 DROP TABLE tenants 等破坏性迁移语句。
_FLOW_TABLES = frozenset({"decrees", "tasks", "memorials", "reviews", "retrospectives"})


def include_object(object, name, type_, reflected, compare_to):  # noqa: A002
    """只对 flow 表做 autogenerate 差分,跳过其余已有表。"""
    if type_ == "table" and name not in _FLOW_TABLES:
        return False
    return True


# ── offline 模式 ──────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """SQL 脚本输出模式(不需要活跃 DB 连接)。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── online 模式 ───────────────────────────────────────────────────────────

def run_migrations_online() -> None:
    """连接真实 DB 执行迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
