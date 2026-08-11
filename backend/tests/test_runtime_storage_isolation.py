"""Guard pytest against writing repository runtime storage by default."""

import inspect
from pathlib import Path

import pytest

from app.accounting_reports import storage as accounting_storage
from app.api import decrees, report_artifacts
from app.junjichu_cases import storage as junjichu_storage


def test_writable_runtime_defaults_are_scoped_to_the_current_test(tmp_path: Path) -> None:
    isolated_root = tmp_path / "runtime-defaults"

    assert inspect.signature(accounting_storage.ArtifactStorage).parameters[
        "artifact_dir"
    ].default is None
    assert inspect.signature(accounting_storage.ArtifactStorage).parameters[
        "db_path"
    ].default is None
    assert inspect.signature(accounting_storage.get_published_artifact).parameters[
        "db_path"
    ].default is None
    assert inspect.signature(
        accounting_storage.read_verified_published_artifact
    ).parameters["db_path"].default is None

    assert junjichu_storage._DEFAULT_DB_PATH == isolated_root / "junjichu_cases.sqlite3"
    assert accounting_storage.DEFAULT_DB_PATH == isolated_root / "report_artifacts.sqlite3"
    assert accounting_storage.DEFAULT_ARTIFACT_DIR == isolated_root / "report_artifacts"
    assert decrees.DEFAULT_DB_PATH == accounting_storage.DEFAULT_DB_PATH
    assert decrees.DEFAULT_ARTIFACT_DIR == accounting_storage.DEFAULT_ARTIFACT_DIR
    assert report_artifacts.DEFAULT_DB_PATH == accounting_storage.DEFAULT_DB_PATH
    assert report_artifacts.DEFAULT_ARTIFACT_DIR == accounting_storage.DEFAULT_ARTIFACT_DIR
    assert report_artifacts._configured_db_path == accounting_storage.DEFAULT_DB_PATH

    storage = accounting_storage.ArtifactStorage()
    assert storage.db_path == accounting_storage.DEFAULT_DB_PATH
    assert storage.artifact_dir == accounting_storage.DEFAULT_ARTIFACT_DIR.resolve()

    with pytest.raises(accounting_storage.ArtifactNotFound):
        accounting_storage.get_published_artifact("missing", "owner")
    with pytest.raises(accounting_storage.ArtifactNotFound):
        accounting_storage.read_verified_published_artifact("missing", "owner")

    assert accounting_storage.DEFAULT_DB_PATH.is_file()
