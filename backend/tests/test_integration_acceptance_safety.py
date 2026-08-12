from __future__ import annotations

import importlib
import socket
import sys
import time
from pathlib import Path

import pytest

import app.api.report_artifacts as report_artifacts_api
from app.api.decree_jobs import get_decree_job_store
from app.auth import storage as auth_storage
from app.main import app as main_app
from app.shiguan import db as shiguan_db
from tests import run_accounting_synthetic_acceptance as accounting_acceptance


def test_integration_app_confines_auth_and_job_storage_to_declared_temp_root(
    monkeypatch, tmp_path: Path
) -> None:
    original_auth_path = auth_storage._configured_db_path
    original_shiguan_path = shiguan_db._DEFAULT_DB_PATH
    original_artifact_path = report_artifacts_api._configured_db_path
    original_override = main_app.dependency_overrides.get(get_decree_job_store)

    monkeypatch.setenv("CHAOTANG_INTEGRATION_TMP", str(tmp_path))
    sys.modules.pop("tests.integration_isolated_app", None)
    try:
        module = importlib.import_module("tests.integration_isolated_app")

        assert auth_storage._configured_db_path == tmp_path / "shiguan.sqlite3"
        assert shiguan_db._DEFAULT_DB_PATH == tmp_path / "shiguan.sqlite3"
        assert report_artifacts_api._configured_db_path == (
            tmp_path / "report_artifacts.sqlite3"
        )
        provider = module.app.dependency_overrides[get_decree_job_store]
        assert provider().db_path == tmp_path / "decree_jobs.sqlite3"
    finally:
        auth_storage.configure_auth_db(original_auth_path)
        shiguan_db._DEFAULT_DB_PATH = original_shiguan_path
        report_artifacts_api.configure_report_artifact_db(original_artifact_path)
        if original_override is None:
            main_app.dependency_overrides.pop(get_decree_job_store, None)
        else:
            main_app.dependency_overrides[get_decree_job_store] = original_override
        sys.modules.pop("tests.integration_isolated_app", None)
        assert report_artifacts_api._configured_db_path == original_artifact_path


def test_synthetic_acceptance_retries_protected_and_duplicate_ports(monkeypatch) -> None:
    assigned = iter((3000, 41001, 41001, 41002))

    class FakeSocket:
        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def bind(self, _address) -> None:
            return None

        def getsockname(self) -> tuple[str, int]:
            return ("127.0.0.1", next(assigned))

    monkeypatch.setattr(accounting_acceptance.socket, "socket", FakeSocket)
    used = set(accounting_acceptance.PROTECTED_PORTS)

    first = accounting_acceptance._free_port(used)
    used.add(first)
    second = accounting_acceptance._free_port(used)

    assert (first, second) == (41001, 41002)
    assert first not in accounting_acceptance.PROTECTED_PORTS
    assert second not in accounting_acceptance.PROTECTED_PORTS


def test_synthetic_acceptance_stops_backend_when_frontend_spawn_fails(
    monkeypatch,
) -> None:
    backend = object()
    calls = 0

    def popen(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            return backend
        raise OSError("frontend spawn failed")

    stopped: list[object] = []
    monkeypatch.setattr(accounting_acceptance, "_tracked_popen", popen)
    monkeypatch.setattr(accounting_acceptance, "_stop", stopped.append)

    with pytest.raises(OSError, match="frontend spawn failed"):
        accounting_acceptance._start_servers(41001, 41002, {})

    assert stopped == [backend]


@pytest.mark.skipif(sys.platform != "win32", reason="Windows process-tree contract")
def test_stop_terminates_spawned_child_and_releases_its_port() -> None:
    port = accounting_acceptance._free_port(set())
    child_code = (
        "import socket,time; s=socket.socket(); "
        f"s.bind(('127.0.0.1',{port})); s.listen(); time.sleep(60)"
    )
    parent_code = (
        "import subprocess,sys,time; "
        f"subprocess.Popen([sys.executable,'-c',{child_code!r}]); time.sleep(60)"
    )
    process = accounting_acceptance._tracked_popen([sys.executable, "-c", parent_code])
    deadline = time.monotonic() + 5
    while True:
        probe = socket.socket()
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            probe.close()
            break
        probe.close()
        assert time.monotonic() < deadline
        time.sleep(0.02)

    accounting_acceptance._stop(process)

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", port))
