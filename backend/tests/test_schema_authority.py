"""P5: production schema authority belongs exclusively to Alembic."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, text


def test_expected_head_is_derived_from_the_version_graph() -> None:
    from src.schema_authority import expected_alembic_head

    assert expected_alembic_head() == "024_artifact_manifest_tenant"


def test_strict_mode_rejects_an_unversioned_database_without_writing(tmp_path: Path) -> None:
    from src.schema_authority import SchemaAuthorityError, assert_database_at_head

    path = tmp_path / "unversioned.db"
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE legacy_fact (id INTEGER PRIMARY KEY)"))
    before = path.read_bytes()

    with pytest.raises(SchemaAuthorityError, match="alembic_version"):
        assert_database_at_head(engine)

    assert path.read_bytes() == before
    engine.dispose()


@pytest.mark.parametrize("as_uri", [False, True])
def test_strict_mode_rejects_a_missing_sqlite_file_without_creating_it(
    tmp_path: Path,
    as_uri: bool,
) -> None:
    from src.schema_authority import SchemaAuthorityError, assert_database_at_head

    path = tmp_path / "must-not-be-created.db"
    db_url = f"sqlite:///file:{path}?uri=true" if as_uri else f"sqlite:///{path}"
    engine = create_engine(db_url)

    with pytest.raises(SchemaAuthorityError, match="does not exist"):
        assert_database_at_head(engine)

    assert not path.exists()
    engine.dispose()


def test_strict_mode_rejects_a_database_behind_head(tmp_path: Path) -> None:
    from src.schema_authority import SchemaAuthorityError, assert_database_at_head

    path = tmp_path / "behind.db"
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version(version_num) VALUES ('013_core_tenant_lineage')"))

    with pytest.raises(
        SchemaAuthorityError,
        match="current=013_core_tenant_lineage.*head=024_artifact_manifest_tenant",
    ):
        assert_database_at_head(engine)
    engine.dispose()


def test_strict_mode_accepts_exactly_one_current_head(tmp_path: Path) -> None:
    from src.schema_authority import assert_database_at_head

    path = tmp_path / "head.db"
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version(version_num) VALUES ('024_artifact_manifest_tenant')"))

    identity = assert_database_at_head(engine)
    assert identity.current == "024_artifact_manifest_tenant"
    assert identity.head == "024_artifact_manifest_tenant"
    assert identity.ready is True
    engine.dispose()


def test_test_bootstrap_refuses_a_normal_file_database(tmp_path: Path) -> None:
    from src.db.models import Base
    from src.schema_authority import SchemaAuthorityError, prepare_database_schema

    engine = create_engine(f"sqlite:///{tmp_path / 'looks-like-production.db'}")
    with pytest.raises(SchemaAuthorityError, match="test bootstrap"):
        prepare_database_schema(engine, Base.metadata, mode="test")
    engine.dispose()


def test_strict_mode_rejects_a_separate_legacy_identity_database(tmp_path: Path) -> None:
    from src.schema_authority import (
        SchemaAuthorityError,
        assert_primary_identity_store_alignment,
    )

    engine = create_engine(f"sqlite:///{tmp_path / 'primary.db'}")
    with pytest.raises(SchemaAuthorityError, match="identity database diverges"):
        assert_primary_identity_store_alignment(
            engine,
            identity_database=tmp_path / "identity.db",
        )
    engine.dispose()
