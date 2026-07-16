"""Alembic is the only production authority for the primary database schema.

This module deliberately does not import Alembic.  The web runtime must be able
to prove that its database is at the code's migration head without carrying the
migration CLI environment into the serving process.
"""

from __future__ import annotations

import ast
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.schema import MetaData

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_VERSIONS_DIR = _BACKEND_ROOT / "alembic" / "versions"


class SchemaAuthorityError(RuntimeError):
    """The database cannot be safely served by this code revision."""


@dataclass(frozen=True)
class SchemaIdentity:
    current: str
    head: str
    ready: bool
    mode: str = "strict"


def _literal_assignment(tree: ast.Module, name: str):
    for node in tree.body:
        if isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == name for target in node.targets):
                return ast.literal_eval(node.value)
    raise SchemaAuthorityError(f"migration file is missing {name!r}")


@lru_cache(maxsize=4)
def expected_alembic_heads(versions_dir: str | None = None) -> tuple[str, ...]:
    root = Path(versions_dir) if versions_dir else _VERSIONS_DIR
    revisions: set[str] = set()
    parents: set[str] = set()
    for path in sorted(root.glob("*.py")):
        if path.name.startswith("__"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        revision = _literal_assignment(tree, "revision")
        down_revision = _literal_assignment(tree, "down_revision")
        if not isinstance(revision, str) or not revision:
            raise SchemaAuthorityError(f"invalid revision in {path.name}")
        if revision in revisions:
            raise SchemaAuthorityError(f"duplicate Alembic revision: {revision}")
        revisions.add(revision)
        if isinstance(down_revision, str):
            parents.add(down_revision)
        elif isinstance(down_revision, (tuple, list)):
            parents.update(str(value) for value in down_revision)
        elif down_revision is not None:
            raise SchemaAuthorityError(f"invalid down_revision in {path.name}")
    heads = tuple(sorted(revisions - parents))
    if not heads:
        raise SchemaAuthorityError("Alembic migration graph has no head")
    return heads


def expected_alembic_head() -> str:
    heads = expected_alembic_heads()
    if len(heads) != 1:
        raise SchemaAuthorityError("production requires exactly one Alembic head; found " + ", ".join(heads))
    return heads[0]


def database_revisions(engine: Engine) -> tuple[str, ...]:
    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        return ()
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT version_num FROM alembic_version ORDER BY version_num"))
        return tuple(str(row[0]) for row in rows)


def assert_database_at_head(engine: Engine) -> SchemaIdentity:
    head = expected_alembic_head()
    current = database_revisions(engine)
    if not current:
        raise SchemaAuthorityError(
            f"primary database has no alembic_version; explicit legacy adoption is required before head={head}"
        )
    if len(current) != 1:
        raise SchemaAuthorityError(
            f"primary database has multiple current revisions: {', '.join(current)}; head={head}"
        )
    if current[0] != head:
        raise SchemaAuthorityError(f"primary database is not at Alembic head: current={current[0]} head={head}")
    return SchemaIdentity(current=current[0], head=head, ready=True)


def assert_primary_identity_store_alignment(
    engine: Engine,
    *,
    identity_database: Path | None = None,
) -> None:
    """Reject the split-brain SQLAlchemy/legacy-auth database configuration."""
    if engine.url.get_backend_name() != "sqlite":
        raise SchemaAuthorityError(
            "the legacy identity adapter is SQLite-only; a non-SQLite primary "
            "database requires migrating src.tenant before service startup"
        )
    primary_database = engine.url.database
    if not primary_database or primary_database == ":memory:":
        raise SchemaAuthorityError("strict mode requires a file-backed primary database")
    if identity_database is None:
        from src.runtime_paths import resolve_runtime_paths

        identity_database = resolve_runtime_paths().database
    primary_path = Path(primary_database).resolve()
    identity_path = Path(identity_database).resolve()
    if primary_path != identity_path:
        raise SchemaAuthorityError(
            f"primary and identity database diverges: primary={primary_path} identity={identity_path}"
        )


def prepare_database_schema(
    engine: Engine,
    metadata: MetaData,
    *,
    mode: str | None = None,
) -> SchemaIdentity:
    selected = (mode or os.environ.get("FENGQUN_SCHEMA_MODE", "strict")).strip().lower()
    if selected == "strict":
        assert_primary_identity_store_alignment(engine)
        return assert_database_at_head(engine)
    if selected != "test":
        raise SchemaAuthorityError(f"unknown FENGQUN_SCHEMA_MODE={selected!r}; allowed values are strict,test")
    if not (engine.url.get_backend_name() == "sqlite" and engine.url.database in {None, "", ":memory:"}):
        raise SchemaAuthorityError("test bootstrap is restricted to an isolated in-memory SQLite database")
    metadata.create_all(engine, checkfirst=True)
    head = expected_alembic_head()
    return SchemaIdentity(current="test-bootstrap", head=head, ready=True, mode="test")
