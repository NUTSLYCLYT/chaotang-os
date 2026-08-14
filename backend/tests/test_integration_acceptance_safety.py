from __future__ import annotations

import ctypes
import importlib
import json
import socket
import subprocess
import sys
import time
from ctypes import wintypes
from pathlib import Path

import pytest

import app.api.report_artifacts as report_artifacts_api
from app.api.decree_jobs import get_decree_job_store
from app.auth import storage as auth_storage
from app.main import app as main_app
from app.shiguan import db as shiguan_db
from tests import run_accounting_synthetic_acceptance as accounting_acceptance


def test_tracked_popen_discards_gate_when_bootstrap_spawn_raises(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    gate = tmp_path / "gate-root" / "release"
    gate.parent.mkdir()
    original_error = OSError("bootstrap spawn failed")

    monkeypatch.setattr(accounting_acceptance.sys, "platform", "win32")
    monkeypatch.setattr(accounting_acceptance, "_create_windows_gate", lambda: gate)
    monkeypatch.setattr(
        accounting_acceptance.subprocess,
        "Popen",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(original_error),
    )

    with pytest.raises(OSError) as raised:
        accounting_acceptance._tracked_popen(["ignored"])

    assert raised.value is original_error
    assert not gate.parent.exists()


def test_tracked_popen_reaps_bootstrap_when_kernel_loader_raises(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    gate = tmp_path / "gate-root" / "release"
    gate.parent.mkdir()
    original_error = RuntimeError("kernel loader failed")

    class FakeProcess:
        pid = 6262
        returncode: int | None = None

        def poll(self) -> int | None:
            return self.returncode

        def terminate(self) -> None:
            return None

        def wait(self, timeout: float) -> int:
            self.returncode = 1
            return self.returncode

    process = FakeProcess()
    taskkill_calls: list[list[str]] = []

    monkeypatch.setattr(accounting_acceptance.sys, "platform", "win32")
    monkeypatch.setattr(accounting_acceptance, "_create_windows_gate", lambda: gate)
    monkeypatch.setattr(accounting_acceptance.subprocess, "Popen", lambda *_a, **_k: process)
    monkeypatch.setattr(
        accounting_acceptance,
        "_windows_kernel32",
        lambda: (_ for _ in ()).throw(original_error),
    )

    def run(command: list[str], **_kwargs) -> subprocess.CompletedProcess[str]:
        taskkill_calls.append(command)
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(accounting_acceptance.subprocess, "run", run)

    with pytest.raises(RuntimeError) as raised:
        accounting_acceptance._tracked_popen(["ignored"])

    assert raised.value is original_error
    assert taskkill_calls == [["taskkill", "/PID", "6262", "/T", "/F"]]
    assert process.returncode == 1
    assert process.pid not in accounting_acceptance._PROCESS_JOBS
    assert process.pid not in accounting_acceptance._PROCESS_GATES
    assert not gate.parent.exists()


def test_tracked_popen_cleans_job_when_winapi_call_raises_python_exception(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    gate = tmp_path / "gate-root" / "release"
    gate.parent.mkdir()
    original_error = RuntimeError("SetInformationJobObject exploded")

    class FakeProcess:
        pid = 7373
        _handle = wintypes.HANDLE(202)
        returncode: int | None = None

        def poll(self) -> int | None:
            return self.returncode

        def terminate(self) -> None:
            return None

        def wait(self, timeout: float) -> int:
            self.returncode = 1
            return self.returncode

    class FakeKernel32:
        def __init__(self) -> None:
            self.closed: list[int] = []

        def CreateJobObjectW(self, _attributes, _name) -> int:
            return 97

        def SetInformationJobObject(self, *_args) -> bool:
            raise original_error

        def CloseHandle(self, handle: int) -> bool:
            self.closed.append(handle)
            return True

    process = FakeProcess()
    kernel32 = FakeKernel32()
    taskkill_calls: list[list[str]] = []

    monkeypatch.setattr(accounting_acceptance.sys, "platform", "win32")
    monkeypatch.setattr(accounting_acceptance, "_create_windows_gate", lambda: gate)
    monkeypatch.setattr(accounting_acceptance.subprocess, "Popen", lambda *_a, **_k: process)
    monkeypatch.setattr(accounting_acceptance, "_windows_kernel32", lambda: kernel32)

    def run(command: list[str], **_kwargs) -> subprocess.CompletedProcess[str]:
        taskkill_calls.append(command)
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(accounting_acceptance.subprocess, "run", run)

    with pytest.raises(RuntimeError) as raised:
        accounting_acceptance._tracked_popen(["ignored"])

    assert raised.value is original_error
    assert taskkill_calls == [["taskkill", "/PID", "7373", "/T", "/F"]]
    assert process.returncode == 1
    assert kernel32.closed == [97]
    assert process.pid not in accounting_acceptance._PROCESS_JOBS
    assert process.pid not in accounting_acceptance._PROCESS_GATES
    assert not gate.parent.exists()


@pytest.mark.parametrize(
    ("failed_operation", "expected_error"),
    (("SetInformationJobObject", 1234), ("AssignProcessToJobObject", 5678)),
)
def test_tracked_popen_preserves_windows_job_error_and_reaps_process(
    monkeypatch: pytest.MonkeyPatch,
    failed_operation: str,
    expected_error: int,
) -> None:
    class FakeProcess:
        pid = 4242
        _handle = wintypes.HANDLE(99)
        returncode: int | None = None

        def __init__(self) -> None:
            self.terminate_calls = 0
            self.kill_calls = 0
            self.wait_calls: list[float] = []

        def poll(self) -> int | None:
            return self.returncode

        def terminate(self) -> None:
            self.terminate_calls += 1

        def kill(self) -> None:
            self.kill_calls += 1

        def wait(self, timeout: float) -> int:
            self.wait_calls.append(timeout)
            self.returncode = 1
            return self.returncode

    class FakeKernel32:
        def __init__(self) -> None:
            self.closed: list[int] = []
            self.last_error = 0

        def CreateJobObjectW(self, _attributes, _name) -> int:
            return 73

        def SetInformationJobObject(self, *_args) -> bool:
            if failed_operation == "SetInformationJobObject":
                self.last_error = expected_error
                return False
            return True

        def AssignProcessToJobObject(self, *_args) -> bool:
            if failed_operation == "AssignProcessToJobObject":
                self.last_error = expected_error
                return False
            return True

        def CloseHandle(self, handle: int) -> bool:
            self.closed.append(handle)
            return True

    process = FakeProcess()
    kernel32 = FakeKernel32()
    taskkill_calls: list[list[str]] = []

    monkeypatch.setattr(accounting_acceptance.subprocess, "Popen", lambda *_a, **_k: process)
    monkeypatch.setattr(accounting_acceptance.sys, "platform", "win32")
    monkeypatch.setattr(accounting_acceptance, "_windows_kernel32", lambda: kernel32)
    monkeypatch.setattr(
        accounting_acceptance,
        "_get_windows_last_error",
        lambda: kernel32.last_error,
    )

    def run(command: list[str], **_kwargs) -> subprocess.CompletedProcess[str]:
        taskkill_calls.append(command)
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(accounting_acceptance.subprocess, "run", run)

    with pytest.raises(OSError) as raised:
        accounting_acceptance._tracked_popen(["ignored"])

    assert raised.value.errno == expected_error
    assert failed_operation in str(raised.value)
    assert taskkill_calls == [["taskkill", "/PID", "4242", "/T", "/F"]]
    assert process.wait_calls == [10]
    assert kernel32.closed == [73]


def test_tracked_popen_releases_gate_only_after_job_assignment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []

    class FakeProcess:
        pid = 5151
        _handle = wintypes.HANDLE(101)

    class FakeKernel32:
        def CreateJobObjectW(self, _attributes, _name) -> int:
            events.append("create-job")
            return 83

        def SetInformationJobObject(self, *_args) -> bool:
            events.append("configure-job")
            return True

        def AssignProcessToJobObject(self, *_args) -> bool:
            events.append("assign-job")
            return True

    def popen(*_args, **_kwargs):
        events.append("spawn-bootstrap")
        return FakeProcess()

    def release(_gate: Path) -> None:
        events.append("release-gate")

    monkeypatch.setattr(accounting_acceptance.sys, "platform", "win32")
    monkeypatch.setattr(accounting_acceptance.subprocess, "Popen", popen)
    monkeypatch.setattr(accounting_acceptance, "_windows_kernel32", FakeKernel32)
    monkeypatch.setattr(accounting_acceptance, "_release_windows_gate", release)

    process = accounting_acceptance._tracked_popen(
        [sys.executable, "-c", "raise SystemExit(0)"],
        cwd=Path.cwd(),
        env={"PATH": "test-path"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )

    assert process.pid == 5151
    assert events == [
        "spawn-bootstrap",
        "create-job",
        "configure-job",
        "assign-job",
        "release-gate",
    ]
    accounting_acceptance._PROCESS_JOBS.pop(process.pid, None)
    accounting_acceptance._discard_windows_gate(
        accounting_acceptance._PROCESS_GATES.pop(process.pid, None)
    )


def test_failed_windows_spawn_reaps_exited_process_without_taskkill(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class ExitedProcess:
        pid = 4242
        returncode = 1

        def __init__(self) -> None:
            self.wait_calls: list[float] = []

        def poll(self) -> int:
            return self.returncode

        def wait(self, timeout: float) -> int:
            self.wait_calls.append(timeout)
            return self.returncode

    class FakeKernel32:
        def __init__(self) -> None:
            self.closed: list[int] = []

        def CloseHandle(self, handle: int) -> bool:
            self.closed.append(handle)
            return True

    taskkill_calls: list[list[str]] = []

    def run(command: list[str], **_kwargs) -> subprocess.CompletedProcess[str]:
        taskkill_calls.append(command)
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(accounting_acceptance.subprocess, "run", run)
    process = ExitedProcess()
    kernel32 = FakeKernel32()

    cleanup_errors = accounting_acceptance._cleanup_failed_windows_spawn(
        process, kernel32, 73
    )

    assert cleanup_errors == []
    assert taskkill_calls == []
    assert process.wait_calls == [10]
    assert kernel32.closed == [73]


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


def test_stop_all_attempts_every_process_and_preserves_active_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    frontend = object()
    backend = object()
    stopped: list[object] = []

    def stop(process: object) -> None:
        stopped.append(process)
        if process is frontend:
            raise OSError("frontend stop failed")

    monkeypatch.setattr(accounting_acceptance, "_stop", stop)
    business_error = RuntimeError("business failed")

    try:
        raise business_error
    except RuntimeError:
        accounting_acceptance._stop_all(
            frontend,
            backend,
            active_error=sys.exception(),
        )

    assert stopped == [frontend, backend]
    assert business_error.__notes__ == ["cleanup error: OSError('frontend stop failed')"]


@pytest.mark.skipif(sys.platform != "win32", reason="Windows process-tree contract")
def test_stop_terminates_spawned_child_and_releases_its_port(tmp_path: Path) -> None:
    child_ready_path = tmp_path / "child-ready.json"
    child_code = (
        "import json,os,socket,sys,time\n"
        "s=socket.socket(); s.bind(('127.0.0.1',0)); s.listen()\n"
        "ready_path=sys.argv[1]; temp_path=ready_path+'.tmp-'+str(os.getpid())\n"
        "with open(temp_path,'w',encoding='utf-8') as ready_file:\n"
        " json.dump({'port':s.getsockname()[1],'pid':os.getpid()},ready_file)\n"
        " ready_file.flush(); os.fsync(ready_file.fileno())\n"
        "os.replace(temp_path,ready_path)\n"
        "time.sleep(60)\n"
    )
    parent_code = (
        "import subprocess,sys; "
        "raise SystemExit(subprocess.call([sys.executable,'-c',sys.argv[1],sys.argv[2]]))"
    )
    process = accounting_acceptance._tracked_popen(
        [sys.executable, "-c", parent_code, child_code, str(child_ready_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    duplicate_job = wintypes.HANDLE()
    kernel32 = None
    try:
        job = accounting_acceptance._PROCESS_JOBS[process.pid]
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        kernel32.DuplicateHandle.argtypes = (
            wintypes.HANDLE,
            wintypes.HANDLE,
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.HANDLE),
            wintypes.DWORD,
            wintypes.BOOL,
            wintypes.DWORD,
        )
        kernel32.DuplicateHandle.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel32.CloseHandle.restype = wintypes.BOOL
        current_process = kernel32.GetCurrentProcess()
        assert kernel32.DuplicateHandle(
            current_process,
            wintypes.HANDLE(job),
            current_process,
            ctypes.byref(duplicate_job),
            0,
            False,
            0x00000002,  # DUPLICATE_SAME_ACCESS
        )

        deadline = time.monotonic() + 10
        while not child_ready_path.exists():
            if process.poll() is not None:
                stderr = process.stderr.read() if process.stderr is not None else ""
                pytest.fail(f"job child exited before readiness: {stderr}")
            if time.monotonic() >= deadline:
                accounting_acceptance._stop(process)
                stderr = process.stderr.read() if process.stderr is not None else ""
                pytest.fail(f"job child did not report readiness: {stderr}")
            time.sleep(0.01)
        child = json.loads(child_ready_path.read_text(encoding="utf-8"))
        assert child["pid"] != process.pid
        assert list(tmp_path.glob("child-ready.json.tmp-*")) == []

        accounting_acceptance._stop(process)

        assert process.pid not in accounting_acceptance._PROCESS_JOBS
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", child["port"]))
    finally:
        active_error = sys.exception()
        cleanup_errors: list[Exception] = []
        if process.pid in accounting_acceptance._PROCESS_JOBS:
            try:
                accounting_acceptance._stop(process)
            except Exception as error:
                cleanup_errors.append(error)
        if duplicate_job.value and kernel32 is not None:
            try:
                if not kernel32.CloseHandle(duplicate_job):
                    cleanup_errors.append(
                        OSError(ctypes.get_last_error(), "CloseHandle(duplicate job) failed")
                    )
            except Exception as error:
                cleanup_errors.append(error)
        if process.poll() is None:
            try:
                process.kill()
                process.wait(timeout=10)
            except Exception as error:
                cleanup_errors.append(error)
        else:
            process.wait(timeout=10)
        if cleanup_errors:
            if active_error is not None:
                for error in cleanup_errors:
                    active_error.add_note(f"test cleanup error: {error!r}")
            else:
                raise ExceptionGroup("test cleanup failed", cleanup_errors)
