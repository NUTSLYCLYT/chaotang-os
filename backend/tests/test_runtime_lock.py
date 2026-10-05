"""Closed-contract tests for the offline Python runtime lock."""

from __future__ import annotations

import hashlib
import json
import os
import select
import signal
import stat
import subprocess
import sys
import threading
import time
import types
import zipfile
from pathlib import Path

import _pytest.main
import pytest

from app.operations import runtime_lock

BACKEND_ROOT = Path(__file__).resolve().parent.parent
POSIX_PROCESS_TEST = pytest.mark.skipif(
    os.name == "nt",
    reason="requires POSIX pass_fds, process groups, and signal semantics",
)
LOCK_PATH = BACKEND_ROOT / "requirements-runtime.lock"
DOCKERFILE_PATH = BACKEND_ROOT / "Dockerfile"
LOCK_KEYS = {
    "schemaVersion",
    "pythonVersion",
    "targetPlatforms",
    "pyprojectDigest",
    "buildRoots",
    "runtimeRoots",
    "testRoots",
    "distributions",
    "lockDigest",
}
ROOT_KEYS = {"requirement", "normalizedName", "specifier", "extras", "marker"}
DISTRIBUTION_KEYS = {
    "normalizedName",
    "version",
    "requiresPython",
    "scopes",
    "dependencyEdges",
    "wheels",
}
EDGE_KEYS = {"targetNormalizedName", "specifier", "marker", "extras"}
WHEEL_KEYS = {
    "filename",
    "sha256",
    "pythonTags",
    "abiTags",
    "platformTags",
    "metadataDigest",
}


def _digest(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def _metadata_bytes(name: str, version: str, requires_dist: tuple[str, ...] = ()) -> bytes:
    lines = [
        "Metadata-Version: 2.3",
        f"Name: {name}",
        f"Version: {version}",
        "Requires-Python: >=3.11",
    ]
    lines.extend(f"Requires-Dist: {item}" for item in requires_dist)
    return ("\n".join(lines) + "\n").encode()


def _wheel(path: Path, name: str, version: str, requires_dist: tuple[str, ...] = ()) -> dict:
    distribution = name.replace("-", "_")
    metadata_name = f"{distribution}-{version}.dist-info/METADATA"
    metadata = _metadata_bytes(name, version, requires_dist)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(metadata_name, metadata)
    return {
        "filename": path.name,
        "sha256": _digest(path.read_bytes()),
        "pythonTags": ["py3"],
        "abiTags": ["none"],
        "platformTags": ["any"],
        "metadataDigest": _digest(metadata),
    }


def _root(requirement: str, name: str, specifier: str = "") -> dict:
    return {
        "requirement": requirement,
        "normalizedName": name,
        "specifier": specifier,
        "extras": [],
        "marker": "",
    }


def _minimal_lock(tmp_path: Path) -> tuple[Path, Path, Path]:
    wheelhouse = tmp_path / "wheelhouse"
    wheelhouse.mkdir()
    wheel_path = wheelhouse / "demo_pkg-1.0-py3-none-any.whl"
    wheel = _wheel(wheel_path, "demo-pkg", "1.0")
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text(
        "[project]\n"
        'name = "demo"\n'
        'version = "1.0"\n'
        'requires-python = ">=3.11"\n'
        'dependencies = ["demo-pkg==1.0"]\n\n'
        "[project.optional-dependencies]\n"
        "dev = []\n\n"
        "[build-system]\n"
        "requires = []\n"
        'build-backend = "demo"\n',
        encoding="utf-8",
    )
    document = {
        "schemaVersion": "chaotang.python-runtime-lock.v1",
        "pythonVersion": "3.12",
        "targetPlatforms": ["linux_x86_64"],
        "pyprojectDigest": _digest(pyproject.read_bytes()),
        "buildRoots": [],
        "runtimeRoots": [_root("demo-pkg==1.0", "demo-pkg", "==1.0")],
        "testRoots": [],
        "distributions": [
            {
                "normalizedName": "demo-pkg",
                "version": "1.0",
                "requiresPython": ">=3.11",
                "scopes": ["RUNTIME"],
                "dependencyEdges": [],
                "wheels": [wheel],
            }
        ],
    }
    document["lockDigest"] = _digest(runtime_lock.canonical_json_bytes(document))
    lock_path = tmp_path / "requirements-runtime.lock"
    lock_path.write_bytes(runtime_lock.canonical_json_bytes(document))
    return lock_path, wheelhouse, pyproject


def test_checked_in_lock_is_closed_canonical_json() -> None:
    raw = LOCK_PATH.read_bytes()
    document = runtime_lock.parse_json_no_duplicate_keys(raw)
    assert set(document) == LOCK_KEYS
    assert document["schemaVersion"] == "chaotang.python-runtime-lock.v1"
    assert raw == runtime_lock.canonical_json_bytes(document)
    without_self = dict(document)
    del without_self["lockDigest"]
    assert document["lockDigest"] == _digest(runtime_lock.canonical_json_bytes(without_self))
    assert document["pythonVersion"] == "3.12"
    assert document["targetPlatforms"] == ["linux_x86_64"]
    assert document["pyprojectDigest"] == _digest((BACKEND_ROOT / "pyproject.toml").read_bytes())
    assert {root["normalizedName"] for root in document["buildRoots"]} == {"hatchling"}
    assert {root["normalizedName"] for root in document["testRoots"]} == {"httpx", "pytest", "ruff"}
    assert all(
        set(root) == ROOT_KEYS
        for key in ("buildRoots", "runtimeRoots", "testRoots")
        for root in document[key]
    )
    distributions = document["distributions"]
    assert distributions == sorted(distributions, key=lambda item: item["normalizedName"])
    assert len(distributions) == len({item["normalizedName"] for item in distributions})
    ruff = next(item for item in distributions if item["normalizedName"] == "ruff")
    assert ruff["version"] == "0.16.3"
    assert all(set(item) == DISTRIBUTION_KEYS for item in distributions)
    assert all(set(edge) == EDGE_KEYS for item in distributions for edge in item["dependencyEdges"])
    assert all(set(wheel) == WHEEL_KEYS for item in distributions for wheel in item["wheels"])
    dockerfile = DOCKERFILE_PATH.read_text(encoding="utf-8")
    assert "COPY --from=builder /build/app" not in dockerfile
    assert "--target /wheel-app" in dockerfile
    assert "COPY --from=builder /wheel-app /app" in dockerfile
    assert "path.is_relative_to(root)" in dockerfile
    assert "dist.read_text('RECORD')" in dockerfile
    verifier = (BACKEND_ROOT / "app/operations/runtime_lock.py").read_text(
        encoding="utf-8"
    )
    assert "hashlib.sha256(wheel.read_bytes())" not in verifier
    assert "while chunk := wheel_stream.read(1024 * 1024)" in verifier


def test_strict_json_rejects_duplicate_keys_and_noncanonical_bytes() -> None:
    with pytest.raises(runtime_lock.LockValidationError, match="duplicate JSON key"):
        runtime_lock.parse_json_no_duplicate_keys(b'{"schemaVersion":"a","schemaVersion":"b"}')
    document = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    with pytest.raises(runtime_lock.LockValidationError, match="canonical JSON"):
        runtime_lock.load_lock_bytes(json.dumps(document, indent=2).encode())


def test_minimal_wheelhouse_replay_accepts_exact_inventory(tmp_path: Path) -> None:
    lock_path, wheelhouse, pyproject = _minimal_lock(tmp_path)
    result = runtime_lock.verify_lock(lock_path, wheelhouse, pyproject)
    assert result["lockDigest"].startswith("sha256:")
    assert result["distributionCount"] == 1
    assert result["wheelCount"] == 1


@pytest.mark.parametrize("mutation", ["extra", "missing", "symlink", "hardlink"])
def test_wheelhouse_inventory_fails_closed(tmp_path: Path, mutation: str) -> None:
    lock_path, wheelhouse, pyproject = _minimal_lock(tmp_path)
    wheel = next(wheelhouse.iterdir())
    if mutation == "extra":
        (wheelhouse / "extra.whl").write_bytes(b"not a wheel")
    elif mutation == "missing":
        wheel.unlink()
    elif mutation == "symlink":
        target = tmp_path / "target.whl"
        target.write_bytes(wheel.read_bytes())
        wheel.unlink()
        wheel.symlink_to(target)
    else:
        os.link(wheel, wheelhouse / "duplicate.whl")
    with pytest.raises(runtime_lock.LockValidationError):
        runtime_lock.verify_lock(lock_path, wheelhouse, pyproject)


def test_wheel_metadata_and_digest_are_replayed_from_same_bytes(tmp_path: Path) -> None:
    lock_path, wheelhouse, pyproject = _minimal_lock(tmp_path)
    document = json.loads(lock_path.read_text())
    document["distributions"][0]["wheels"][0]["metadataDigest"] = "sha256:" + "0" * 64
    without_self = dict(document)
    del without_self["lockDigest"]
    document["lockDigest"] = _digest(runtime_lock.canonical_json_bytes(without_self))
    lock_path.write_bytes(runtime_lock.canonical_json_bytes(document))
    with pytest.raises(runtime_lock.LockValidationError, match="METADATA digest"):
        runtime_lock.verify_lock(lock_path, wheelhouse, pyproject)


def test_candidate_rejects_a_wheelhouse_owned_by_the_candidate(tmp_path: Path) -> None:
    wheelhouse = tmp_path / "wheelhouse"
    wheelhouse.mkdir(mode=0o755)
    (wheelhouse / "demo.whl").write_bytes(b"demo")

    with pytest.raises(runtime_lock.LockValidationError, match="root-owned"):
        runtime_lock.verify_candidate_wheelhouse_permissions(wheelhouse)


@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX UID and mode-bit semantics are unavailable on Windows",
)
def test_secure_work_root_is_new_private_and_identity_bound(tmp_path: Path) -> None:
    tmp_path.chmod(0o1777)
    with runtime_lock.secure_work_root(
        parent=tmp_path, trusted_parent_uids={os.getuid()}
    ) as work_root:
        info = work_root.stat()
        assert stat.S_IMODE(info.st_mode) == 0o700
        assert info.st_uid == os.getuid()
        assert info.st_nlink == 2
        assert list(work_root.iterdir()) == []
        identity = (info.st_dev, info.st_ino)
        child = work_root / "nested"
        child.mkdir()
        (child / "evidence").write_text("verified", encoding="utf-8")
        assert identity[0] > 0 and identity[1] > 0
    assert not work_root.exists()


def test_git_security_adapters_are_platform_explicit() -> None:
    executable = Path(runtime_lock._git_executable())  # noqa: SLF001
    assert executable.is_absolute()
    assert executable.name.lower().startswith("git")
    assert runtime_lock._git_hooks_path() == ("NUL" if os.name == "nt" else "/dev/null")  # noqa: SLF001


@pytest.mark.parametrize("mode", [0o755, 0o777])
@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX sticky-bit semantics are unavailable on Windows",
)
def test_secure_work_root_rejects_a_non_sticky_parent(tmp_path: Path, mode: int) -> None:
    tmp_path.chmod(mode)
    with pytest.raises(runtime_lock.LockValidationError, match="sticky 01777"):
        with runtime_lock.secure_work_root(
            parent=tmp_path, trusted_parent_uids={os.getuid()}
        ):
            pass


@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX owner semantics are unavailable on Windows",
)
def test_secure_work_root_rejects_an_untrusted_parent_owner(tmp_path: Path) -> None:
    tmp_path.chmod(0o1777)
    with pytest.raises(runtime_lock.LockValidationError, match="owner"):
        with runtime_lock.secure_work_root(parent=tmp_path, trusted_parent_uids={0}):
            pass


@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX owner semantics are unavailable on Windows",
)
def test_secure_work_root_rejects_a_symlink_parent(tmp_path: Path) -> None:
    real_parent = tmp_path / "real"
    real_parent.mkdir(mode=0o1777)
    real_parent.chmod(0o1777)
    linked_parent = tmp_path / "linked"
    linked_parent.symlink_to(real_parent, target_is_directory=True)
    with pytest.raises(runtime_lock.LockValidationError, match="real directory"):
        with runtime_lock.secure_work_root(
            parent=linked_parent, trusted_parent_uids={os.getuid()}
        ):
            pass


@pytest.mark.parametrize("effective_uid", [0, 65534])
def test_verifier_identity_rejects_root_and_kernel_overflow(effective_uid: int) -> None:
    with pytest.raises(runtime_lock.LockValidationError, match="unsafe verifier identity"):
        runtime_lock._validate_verifier_identity(  # noqa: SLF001
            effective_uid=effective_uid, overflow_uid=65534
        )


@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX UID and mode-bit semantics are unavailable on Windows",
)
def test_candidate_attestation_is_canonical_exclusive_and_identity_bound(
    tmp_path: Path,
) -> None:
    path = tmp_path / "candidate-attestation.json"
    expected = {
        "schemaVersion": "chaotang.python-candidate-guard-attestation.v1",
        "parentCommit": "0" * 40,
        "candidateCommit": "a" * 40,
        "candidateTree": "b" * 40,
        "candidateWheelDigest": "sha256:" + "c" * 64,
        "appPath": "/tmp/candidate/backend/app/__init__.py",
        "distributionDigest": "sha256:" + "d" * 64,
        "pluginDigest": "sha256:" + "e" * 64,
        "activePlugins": [],
        "verificationPhase": "runtime-lock-targeted",
        "status": "PASS",
    }

    runtime_lock._write_candidate_attestation(path, expected)  # noqa: SLF001

    assert path.read_bytes() == runtime_lock.canonical_json_bytes(expected)
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode)
    assert stat.S_IMODE(info.st_mode) == 0o600
    assert info.st_uid == os.geteuid()
    assert info.st_nlink == 1
    identity = runtime_lock._verify_candidate_attestation(path, expected)  # noqa: SLF001

    with pytest.raises(runtime_lock.LockValidationError, match="already exists"):
        runtime_lock._write_candidate_attestation(path, expected)  # noqa: SLF001

    path.write_bytes(b'{"status":"PASS"}')
    with pytest.raises(runtime_lock.LockValidationError, match="attestation"):
        runtime_lock._verify_candidate_attestation(path, expected)  # noqa: SLF001

    descriptor = os.open(path, os.O_RDONLY)
    try:
        path.unlink()
        path.write_bytes(runtime_lock.canonical_json_bytes(expected))
        path.chmod(0o600)
        with pytest.raises(runtime_lock.LockValidationError, match="inode drift"):
            runtime_lock._verify_candidate_attestation(  # noqa: SLF001
                path, expected, expected_identity=identity
            )
    finally:
        os.close(descriptor)


def test_candidate_distribution_inventory_is_exact() -> None:
    expected = {"chaotang-os-backend": "0.1.0", "pytest": "9.1.1"}
    runtime_lock._verify_distribution_inventory(expected, expected)  # noqa: SLF001

    with pytest.raises(runtime_lock.LockValidationError, match="distribution inventory"):
        runtime_lock._verify_distribution_inventory(  # noqa: SLF001
            {**expected, "unlocked-plugin": "1.0"}, expected
        )
    with pytest.raises(runtime_lock.LockValidationError, match="distribution inventory"):
        runtime_lock._verify_distribution_inventory(  # noqa: SLF001
            {"pytest": "9.1.1"}, expected
        )


def test_active_plugin_inventory_allows_only_builtin_guard_and_frozen_conftest(
    tmp_path: Path,
) -> None:
    guard = tmp_path / "chaotang_candidate_guard.py"
    guard.write_text("# guard\n", encoding="utf-8")
    conftest = tmp_path / "tests" / "conftest.py"
    conftest.parent.mkdir()
    conftest.write_text("# fixture\n", encoding="utf-8")
    rows = [
        {
            "kind": "builtin",
            "module": "_pytest.main",
            "name": "main",
            "origin": "/locked/site-packages/_pytest/main.py",
        },
        {
            "kind": "conftest",
            "module": "conftest",
            "name": str(conftest),
            "origin": str(conftest.resolve()),
        },
        {
            "kind": "guard",
            "module": "chaotang_candidate_guard",
            "name": "chaotang_candidate_guard",
            "origin": str(guard.resolve()),
        },
    ]
    assert runtime_lock._validate_active_plugin_inventory(  # noqa: SLF001
        rows, guard_path=guard, expected_conftests={conftest}
    ) == rows

    injected = [
        *rows,
        {
            "kind": "external",
            "module": "anyio.pytest_plugin",
            "name": "anyio",
            "origin": "/locked/site-packages/anyio/pytest_plugin.py",
        },
    ]
    with pytest.raises(runtime_lock.LockValidationError, match="plugin"):
        runtime_lock._validate_active_plugin_inventory(  # noqa: SLF001
            injected, guard_path=guard, expected_conftests={conftest}
        )


def test_live_plugin_snapshot_rejects_forged_builtin_object_and_guard_drift(
    tmp_path: Path,
) -> None:
    guard_path = tmp_path / "guard.py"
    guard_path.write_text("# guard\n", encoding="utf-8")
    guard = types.ModuleType("chaotang_candidate_guard")
    guard.__file__ = str(guard_path)

    class Manager:
        def __init__(self, rows: list[tuple[str, object]]) -> None:
            self.rows = rows

        def list_name_plugin(self) -> list[tuple[str, object]]:
            return self.rows

    baseline = Manager([("chaotang_candidate_guard", guard), ("pytest", pytest)])
    _rows, frozen = runtime_lock._snapshot_active_pytest_plugins(  # noqa: SLF001
        baseline,
        guard_module=guard,
        expected_conftests=set(),
        guard_phase="pre-conftest",
    )

    forged_type = type("ForgedPlugin", (), {"__module__": "_pytest.config"})
    forged = Manager([*baseline.rows, ("forged", forged_type())])
    with pytest.raises(runtime_lock.LockValidationError, match="plugin object"):
        runtime_lock._snapshot_active_pytest_plugins(  # noqa: SLF001
            forged,
            guard_module=guard,
            expected_conftests=set(),
            guard_phase="post-conftest",
            frozen_nonconftest=frozen,
        )

    without_guard = Manager([("pytest", pytest)])
    with pytest.raises(runtime_lock.LockValidationError, match="identity drift"):
        runtime_lock._snapshot_active_pytest_plugins(  # noqa: SLF001
            without_guard,
            guard_module=guard,
            expected_conftests=set(),
            guard_phase="post-conftest",
            frozen_nonconftest=frozen,
        )

    added_builtin = Manager([*baseline.rows, ("late-main", _pytest.main)])
    with pytest.raises(runtime_lock.LockValidationError, match="identity drift"):
        runtime_lock._snapshot_active_pytest_plugins(  # noqa: SLF001
            added_builtin,
            guard_module=guard,
            expected_conftests=set(),
            guard_phase="post-conftest",
            frozen_nonconftest=frozen,
        )


def test_real_pytest_rejects_external_object_registered_by_candidate_conftest(
    tmp_path: Path,
) -> None:
    conftest = tmp_path / "conftest.py"
    guard = tmp_path / "probe_guard.py"
    test_file = tmp_path / "test_probe.py"
    guard.write_text(
        "import pathlib,sys,pytest\n"
        "from app.operations.runtime_lock import _snapshot_active_pytest_plugins\n"
        "MANAGER=None\n"
        "def _active(phase,frozen=None,checker=_snapshot_active_pytest_plugins):\n"
        " return checker(MANAGER,guard_module=sys.modules[__name__],"
        f"expected_conftests={{pathlib.Path({str(conftest)!r})}},"
        "guard_phase=phase,frozen_nonconftest=frozen)\n"
        "def _attest(phase,frozen=None,checker=_active):\n"
        " return checker(phase,frozen)\n"
        "@pytest.hookimpl(hookwrapper=True,tryfirst=True)\n"
        "def pytest_load_initial_conftests(early_config,parser,args):\n"
        " global MANAGER;MANAGER=early_config.pluginmanager\n"
        " trusted=_attest;functions=[];pending=[trusted];seen=set()\n"
        " while pending:\n"
        "  function=pending.pop()\n"
        "  if id(function) in seen: continue\n"
        "  seen.add(id(function));state=(function,function.__code__,function.__defaults__)\n"
        "  functions.append(state)\n"
        "  pending.extend(value for value in function.__defaults__ or () "
        "if hasattr(value,'__code__'))\n"
        " _,frozen=trusted('pre-conftest')\n"
        " yield\n"
        " if any(function.__code__ is not code or function.__defaults__ is not defaults "
        "for function,code,defaults in functions):\n"
        "  raise RuntimeError('trusted candidate guard function identity drift')\n"
        " trusted('post-conftest',frozen)\n",
        encoding="utf-8",
    )
    conftest.write_text(
        "import probe_guard\n"
        "probe_guard._snapshot_active_pytest_plugins=lambda *a,**k: ([],{})\n"
        "probe_guard._attest.__code__=(lambda *a,**k: ([],{})).__code__\n"
        "Forged=type('Forged',(),{'__module__':'_pytest.config'})\n"
        "probe_guard.MANAGER.register(Forged(),'candidate-forged-plugin')\n",
        encoding="utf-8",
    )
    test_file.write_text("def test_probe(): assert True\n", encoding="utf-8")
    environment = {
        **os.environ,
        "PYTHONPATH": f"{tmp_path}:{BACKEND_ROOT}",
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
    }

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "probe_guard", str(test_file)],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "trusted candidate guard function identity drift" in result.stderr


def test_malicious_conftest_is_rejected_by_frozen_bytes_before_pytest(
    tmp_path: Path,
) -> None:
    conftest = tmp_path / "conftest.py"
    conftest.write_text(
        "def pytest_configure(config): config.pluginmanager.unregister(name='guard')\n",
        encoding="utf-8",
    )

    with pytest.raises(runtime_lock.LockValidationError, match="conftest identity"):
        runtime_lock._verify_frozen_candidate_conftest(  # noqa: SLF001
            conftest, {conftest}
        )


@pytest.mark.parametrize("replace_phase", [None, "pre-conftest", "post-conftest"])
@POSIX_PROCESS_TEST
def test_attestation_handshake_freezes_both_inodes_before_candidate_execution(
    tmp_path: Path, replace_phase: str | None
) -> None:
    guard = tmp_path / "chaotang_candidate_guard.py"
    guard.write_text("# guard\n", encoding="utf-8")
    active_plugins = [
        {
            "kind": "guard",
            "module": "chaotang_candidate_guard",
            "name": "chaotang_candidate_guard",
            "origin": str(guard.resolve()),
        }
    ]
    expectations = []
    payloads = []
    for guard_phase in ("pre-conftest", "post-conftest"):
        attestation = tmp_path / f"{guard_phase}.json"
        fixed = {
            "schemaVersion": "chaotang.python-candidate-guard-attestation.v1",
            "parentCommit": "0" * 40,
            "candidateCommit": "a" * 40,
            "candidateTree": "b" * 40,
            "candidateWheelDigest": "sha256:" + "c" * 64,
            "appPath": "/tmp/candidate/backend/app/__init__.py",
            "distributionDigest": "sha256:" + "d" * 64,
            "verificationPhase": guard_phase,
            "status": "PASS",
        }
        expectations.append((attestation, fixed, set()))
        payloads.append(
            {
                **fixed,
                "activePlugins": active_plugins,
                "pluginDigest": _digest(runtime_lock.canonical_json_bytes(active_plugins)),
            }
        )
    script = (
        "import json,os,pathlib\n"
        "rows=json.loads(os.environ['TEST_ROWS'])\n"
        "fds=json.loads(os.environ['CHAOTANG_CANDIDATE_ATTESTATION_FDS'])\n"
        "for row in rows:\n"
        " path=pathlib.Path(row['path']);raw=row['raw'].encode();fd=int(fds[row['phase']])\n"
        " assert os.write(fd,raw)==len(raw);os.fsync(fd)\n"
        " os.write(int(os.environ['CHAOTANG_CANDIDATE_READY_FD']),b'1')\n"
        " assert os.read(int(os.environ['CHAOTANG_CANDIDATE_ACK_FD']),1)==b'1'\n"
        " if os.environ['TEST_REPLACE']==row['phase']:\n"
        "  path.unlink();path.write_bytes(raw);path.chmod(0o600)\n"
    )
    environment = {
        **os.environ,
        "TEST_ROWS": json.dumps(
            [
                {
                    "path": str(expectations[index][0]),
                    "phase": payload["verificationPhase"],
                    "raw": runtime_lock.canonical_json_bytes(payload).decode(),
                }
                for index, payload in enumerate(payloads)
            ]
        ),
        "TEST_REPLACE": replace_phase or "",
    }
    invocation = lambda: runtime_lock._run_pytest_with_attestation(  # noqa: E731, SLF001
        [sys.executable, "-c", script],
        cwd=tmp_path,
        environment=environment,
        attestation_expectations=expectations,
        guard_path=guard,
        deadline_at=time.monotonic() + 5,
    )
    if replace_phase:
        with pytest.raises(runtime_lock.LockValidationError, match="identity drift"):
            invocation()
    else:
        assert set(invocation()) == {"pre-conftest", "post-conftest"}


def test_candidate_test_inventory_is_exactly_partitioned_into_three_stable_shards() -> None:
    records = [
        {
            "path": f"backend/tests/test_{index:03d}.py",
            "mode": "100644",
            "blob": f"{index:040x}",
        }
        for index in range(9)
    ]

    shards = runtime_lock._partition_candidate_tests(records, shard_count=3)  # noqa: SLF001

    assert shards == [records[0::3], records[1::3], records[2::3]]
    assert [row for shard in shards for row in shard] != records
    assert sorted(row["path"] for shard in shards for row in shard) == [
        row["path"] for row in records
    ]
    with pytest.raises(runtime_lock.LockValidationError, match="shard count"):
        runtime_lock._partition_candidate_tests(records, shard_count=2)  # noqa: SLF001
    with pytest.raises(runtime_lock.LockValidationError, match="duplicate"):
        runtime_lock._partition_candidate_tests(  # noqa: SLF001
            [*records, records[0]], shard_count=3
        )


def test_candidate_test_inventory_parser_is_top_level_blob_and_mode_closed() -> None:
    rows = [
        f"100644 blob {index:040x}\tbackend/tests/test_{index:03d}.py"
        for index in range(6)
    ]
    raw = "\n".join(
        [
            *rows,
            f"100644 blob {'a' * 40}\tbackend/tests/sub/test_nested.py",
            f"100644 blob {'b' * 40}\tbackend/tests/helper.py",
        ]
    )

    inventory = runtime_lock._parse_candidate_test_inventory(  # noqa: SLF001
        raw, expected_count=6
    )

    assert [row["path"] for row in inventory] == [
        f"backend/tests/test_{index:03d}.py" for index in range(6)
    ]
    assert _digest(runtime_lock.canonical_json_bytes(inventory)).startswith("sha256:")
    with pytest.raises(runtime_lock.LockValidationError, match="mode"):
        runtime_lock._parse_candidate_test_inventory(  # noqa: SLF001
            raw.replace("100644", "100755", 1), expected_count=6
        )
    with pytest.raises(runtime_lock.LockValidationError, match="count"):
        runtime_lock._parse_candidate_test_inventory(raw, expected_count=7)  # noqa: SLF001


def test_candidate_test_inventory_reads_repository_paths_from_backend_cwd(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    backend = repository / "backend"
    test_path = backend / "tests/test_only.py"
    test_path.parent.mkdir(parents=True)
    test_path.write_text("def test_only(): assert True\n", encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=repository, check=True)
    subprocess.run(["git", "config", "user.name", "P15 Test"], cwd=repository, check=True)
    subprocess.run(
        ["git", "config", "user.email", "p15@example.invalid"], cwd=repository, check=True
    )
    subprocess.run(["git", "add", "."], cwd=repository, check=True)
    subprocess.run(["git", "commit", "-qm", "fixture"], cwd=repository, check=True)
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    assert runtime_lock._candidate_test_inventory(  # noqa: SLF001
        backend, commit, expected_count=1
    ) == [
        {
            "path": "backend/tests/test_only.py",
            "mode": "100644",
            "blob": subprocess.run(
                ["git", "rev-parse", "HEAD:backend/tests/test_only.py"],
                cwd=repository,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip(),
        }
    ]


@pytest.mark.parametrize(
    ("reports", "expected"),
    [
        ([{"when": "call", "outcome": "passed", "wasxfail": False}], "passed"),
        ([{"when": "call", "outcome": "skipped", "wasxfail": True}], "xfailed"),
        ([{"when": "call", "outcome": "passed", "wasxfail": True}], "xpassed"),
        ([{"when": "call", "outcome": "failed", "wasxfail": False}], "failed"),
        ([{"when": "setup", "outcome": "failed", "wasxfail": False}], "error"),
        ([{"when": "setup", "outcome": "skipped", "wasxfail": True}], "xfailed"),
        ([{"when": "setup", "outcome": "skipped", "wasxfail": False}], "skipped"),
        (
            [
                {"when": "call", "outcome": "passed", "wasxfail": False},
                {"when": "teardown", "outcome": "skipped", "wasxfail": True},
            ],
            "xfailed",
        ),
        (
            [
                {"when": "call", "outcome": "passed", "wasxfail": False},
                {"when": "teardown", "outcome": "skipped", "wasxfail": False},
            ],
            "skipped",
        ),
        (
            [
                {"when": "call", "outcome": "passed", "wasxfail": False},
                {"when": "teardown", "outcome": "failed", "wasxfail": False},
            ],
            "error",
        ),
    ],
)
def test_terminal_outcome_is_closed_and_uses_frozen_precedence(
    reports: list[dict[str, object]], expected: str
) -> None:
    assert runtime_lock._terminal_outcome(reports) == expected  # noqa: SLF001
    with pytest.raises(runtime_lock.LockValidationError, match="duplicate"):
        runtime_lock._terminal_outcome([*reports, reports[0]])  # noqa: SLF001


def test_verify_candidate_cli_requires_the_frozen_shard_contract() -> None:
    parser = runtime_lock._build_parser()  # noqa: SLF001
    common = [
        "verify-candidate",
        "--lock",
        "lock.json",
        "--wheelhouse",
        "wheelhouse",
        "--pyproject",
        "pyproject.toml",
        "--source-root",
        "backend",
    ]
    arguments = parser.parse_args(
        [
            *common,
            "--shard-count",
            "3",
            "--shard-index",
            "2",
            "--deadline-seconds",
            "240",
        ]
    )
    assert arguments.shard_count == 3
    assert arguments.shard_index == 2
    assert arguments.deadline_seconds == 240
    with pytest.raises(SystemExit):
        parser.parse_args(common)


@POSIX_PROCESS_TEST
def test_completed_verifier_child_cannot_leave_a_grandchild_process(
    tmp_path: Path,
) -> None:
    pid_path = tmp_path / "grandchild.pid"
    script = (
        "import pathlib,subprocess,sys\n"
        "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],"
        "stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n"
        "pathlib.Path(sys.argv[1]).write_text(str(child.pid),encoding='ascii')\n"
    )
    grandchild_pid = -1
    try:
        runtime_lock._run_capture(  # noqa: SLF001
            [sys.executable, "-c", script, str(pid_path)],
            cwd=tmp_path,
            environment=os.environ.copy(),
        )
        grandchild_pid = int(pid_path.read_text(encoding="ascii"))
        time.sleep(0.05)
        with pytest.raises(ProcessLookupError):
            os.kill(grandchild_pid, 0)
    finally:
        if grandchild_pid > 0:
            try:
                os.kill(grandchild_pid, signal.SIGKILL)
            except ProcessLookupError:
                pass


@POSIX_PROCESS_TEST
def test_verifier_sigterm_is_controlled_and_cleans_the_child_process_group(
    tmp_path: Path,
) -> None:
    pid_path = tmp_path / "grandchild.pid"
    script = (
        "import pathlib,subprocess,sys,time\n"
        "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],"
        "stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n"
        "pathlib.Path(sys.argv[1]).write_text(str(child.pid),encoding='ascii')\n"
        "time.sleep(30)\n"
    )
    timer = threading.Timer(0.2, os.kill, args=(os.getpid(), signal.SIGTERM))
    timer.start()
    try:
        with pytest.raises(runtime_lock.LockValidationError, match="terminated"):
            with runtime_lock._controlled_verifier_lifetime(  # noqa: SLF001
                time.monotonic() + 5
            ):
                runtime_lock._run_capture(  # noqa: SLF001
                    [sys.executable, "-c", script, str(pid_path)],
                    cwd=tmp_path,
                    environment=os.environ.copy(),
                    deadline_at=time.monotonic() + 5,
                )
    finally:
        timer.cancel()
    grandchild_pid = int(pid_path.read_text(encoding="ascii"))
    with pytest.raises(ProcessLookupError):
        os.kill(grandchild_pid, 0)


@POSIX_PROCESS_TEST
def test_verifier_deadline_interrupts_synchronous_work() -> None:
    started = time.monotonic()
    with pytest.raises(runtime_lock.LockValidationError, match="deadline exceeded"):
        with runtime_lock._controlled_verifier_lifetime(  # noqa: SLF001
            time.monotonic() + 0.05
        ):
            time.sleep(30)
    assert time.monotonic() - started < 1


@POSIX_PROCESS_TEST
def test_verifier_deadline_still_removes_its_secure_work_root() -> None:
    deadline_at = time.monotonic() + 0.05
    work_root: Path | None = None
    with pytest.raises(runtime_lock.LockValidationError, match="deadline exceeded"):
        with runtime_lock._controlled_verifier_lifetime(deadline_at):  # noqa: SLF001
            with runtime_lock.secure_work_root(
                trusted_parent_uids={Path("/tmp").stat().st_uid},
                deadline_at=deadline_at,
            ) as work_root:
                (work_root / "nested").mkdir()
                (work_root / "nested/evidence").write_text("pending", encoding="utf-8")
                time.sleep(30)
    assert work_root is not None
    assert not work_root.exists()


@POSIX_PROCESS_TEST
def test_no_ready_timeout_kills_the_entire_pytest_process_group(tmp_path: Path) -> None:
    guard = tmp_path / "guard.py"
    guard.write_text("# guard\n", encoding="utf-8")
    pid_path = tmp_path / "grandchild.pid"
    script = (
        "import pathlib,subprocess,sys,time\n"
        "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],"
        "stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n"
        "pathlib.Path(sys.argv[1]).write_text(str(child.pid),encoding='ascii')\n"
        "time.sleep(30)\n"
    )
    fixed = {
        "schemaVersion": "chaotang.python-candidate-guard-attestation.v1",
        "parentCommit": "0" * 40,
        "candidateCommit": "a" * 40,
        "candidateTree": "b" * 40,
        "candidateWheelDigest": "sha256:" + "c" * 64,
        "appPath": "/tmp/candidate/backend/app/__init__.py",
        "distributionDigest": "sha256:" + "d" * 64,
        "verificationPhase": "pre-conftest",
        "status": "PASS",
    }
    with pytest.raises(runtime_lock.LockValidationError, match="handshake timed out"):
        runtime_lock._run_pytest_with_attestation(  # noqa: SLF001
            [sys.executable, "-c", script, str(pid_path)],
            cwd=tmp_path,
            environment=os.environ.copy(),
            attestation_expectations=[
                (tmp_path / "pre.json", fixed, set()),
                (
                    tmp_path / "post.json",
                    {**fixed, "verificationPhase": "post-conftest"},
                    set(),
                ),
            ],
            guard_path=guard,
            deadline_at=time.monotonic() + 0.2,
        )
    grandchild_pid = int(pid_path.read_text(encoding="ascii"))
    with pytest.raises(ProcessLookupError):
        os.kill(grandchild_pid, 0)


@POSIX_PROCESS_TEST
def test_post_ack_timeout_kills_the_entire_pytest_process_group(tmp_path: Path) -> None:
    guard = tmp_path / "guard.py"
    guard.write_text("# guard\n", encoding="utf-8")
    pid_path = tmp_path / "grandchild.pid"
    active_plugins = [
        {
            "kind": "guard",
            "module": "chaotang_candidate_guard",
            "name": "chaotang_candidate_guard",
            "origin": str(guard.resolve()),
        }
    ]
    expectations = []
    payloads = []
    for phase in ("pre-conftest", "post-conftest"):
        fixed = {
            "schemaVersion": "chaotang.python-candidate-guard-attestation.v1",
            "parentCommit": "0" * 40,
            "candidateCommit": "a" * 40,
            "candidateTree": "b" * 40,
            "candidateWheelDigest": "sha256:" + "c" * 64,
            "appPath": "/tmp/candidate/backend/app/__init__.py",
            "distributionDigest": "sha256:" + "d" * 64,
            "verificationPhase": phase,
            "status": "PASS",
        }
        path = tmp_path / f"{phase}.json"
        expectations.append((path, fixed, set()))
        payloads.append(
            {
                **fixed,
                "activePlugins": active_plugins,
                "pluginDigest": _digest(runtime_lock.canonical_json_bytes(active_plugins)),
            }
        )
    script = (
        "import json,os,pathlib,subprocess,sys,time\n"
        "fds=json.loads(os.environ['CHAOTANG_CANDIDATE_ATTESTATION_FDS'])\n"
        "for row in json.loads(os.environ['TEST_ROWS']):\n"
        " raw=row['raw'].encode();fd=int(fds[row['phase']])\n"
        " assert os.write(fd,raw)==len(raw);os.fsync(fd)\n"
        " os.write(int(os.environ['CHAOTANG_CANDIDATE_READY_FD']),b'1')\n"
        " assert os.read(int(os.environ['CHAOTANG_CANDIDATE_ACK_FD']),1)==b'1'\n"
        "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],"
        "stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n"
        "pathlib.Path(sys.argv[1]).write_text(str(child.pid),encoding='ascii')\n"
        "time.sleep(30)\n"
    )
    environment = {
        **os.environ,
        "TEST_ROWS": json.dumps(
            [
                {
                    "path": str(expectations[index][0]),
                    "phase": payload["verificationPhase"],
                    "raw": runtime_lock.canonical_json_bytes(payload).decode(),
                }
                for index, payload in enumerate(payloads)
            ]
        ),
    }

    with pytest.raises(runtime_lock.LockValidationError, match="pytest timed out"):
        runtime_lock._run_pytest_with_attestation(  # noqa: SLF001
            [sys.executable, "-c", script, str(pid_path)],
            cwd=tmp_path,
            environment=environment,
            attestation_expectations=expectations,
            guard_path=guard,
            deadline_at=time.monotonic() + 0.4,
        )
    grandchild_pid = int(pid_path.read_text(encoding="ascii"))
    with pytest.raises(ProcessLookupError):
        os.kill(grandchild_pid, 0)


@POSIX_PROCESS_TEST
@pytest.mark.parametrize("exit_path", ["normal", "sigterm", "timeout"])
def test_bwrap_pid_namespace_reaps_setsid_double_fork_descendants(
    exit_path: str,
) -> None:
    ready_read, ready_write = os.pipe()
    script = (
        "import os,sys,time\n"
        "child=os.fork()\n"
        "if child==0:\n"
        " os.setsid();grandchild=os.fork()\n"
        " if grandchild>0: os._exit(0)\n"
        " os.write(int(sys.argv[1]),b'1');time.sleep(30);os._exit(0)\n"
        "os.waitpid(child,0)\n"
        "if sys.argv[2]!='normal': time.sleep(30)\n"
    )
    process = subprocess.Popen(
        [
            "/usr/bin/bwrap",
            "--unshare-user",
            "--unshare-pid",
            "--die-with-parent",
            "--ro-bind",
            "/",
            "/",
            "--proc",
            "/proc",
            "--dev",
            "/dev",
            sys.executable,
            "-I",
            "-c",
            script,
            str(ready_write),
            exit_path,
        ],
        pass_fds=(ready_write,),
        start_new_session=True,
    )
    os.close(ready_write)
    try:
        readable, _, _ = select.select([ready_read], [], [], 3)
        assert readable and os.read(ready_read, 1) == b"1"
        if exit_path == "normal":
            assert process.wait(timeout=3) == 0
        elif exit_path == "sigterm":
            process.terminate()
            process.wait(timeout=3)
        else:
            runtime_lock._terminate_process_group(process.pid, leader=process)  # noqa: SLF001
        readable, _, _ = select.select([ready_read], [], [], 3)
        assert readable and os.read(ready_read, 1) == b""
    finally:
        os.close(ready_read)
        if process.poll() is None:
            runtime_lock._terminate_process_group(process.pid, leader=process)  # noqa: SLF001


def test_pytest_popen_failure_closes_every_precreated_pipe(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    created: list[int] = []
    real_pipe = os.pipe

    def tracked_pipe() -> tuple[int, int]:
        pair = real_pipe()
        created.extend(pair)
        return pair

    monkeypatch.setattr(runtime_lock.os, "pipe", tracked_pipe)

    def fail_popen(*_args: object, **_kwargs: object) -> None:
        raise OSError("synthetic Popen failure")

    monkeypatch.setattr(runtime_lock.subprocess, "Popen", fail_popen)
    with pytest.raises(OSError, match="synthetic"):
        runtime_lock._run_pytest_with_attestation(  # noqa: SLF001
            [sys.executable, "-c", "pass"],
            cwd=tmp_path,
            environment=os.environ.copy(),
            attestation_expectations=[
                (
                    tmp_path / "pre.json",
                    {"verificationPhase": "pre-conftest"},
                    set(),
                ),
                (
                    tmp_path / "post.json",
                    {"verificationPhase": "post-conftest"},
                    set(),
                ),
            ],
            guard_path=tmp_path / "guard.py",
            deadline_at=time.monotonic() + 1,
        )
    assert created
    for descriptor in created:
        with pytest.raises(OSError):
            os.fstat(descriptor)


@pytest.mark.parametrize("fail_on_call", [2, 3])
def test_held_evidence_creation_failure_closes_all_earlier_resources(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fail_on_call: int
) -> None:
    created: list[int] = []
    real_pipe = os.pipe
    real_create = runtime_lock._create_held_evidence_file  # noqa: SLF001
    calls = 0

    def tracked_pipe() -> tuple[int, int]:
        pair = real_pipe()
        created.extend(pair)
        return pair

    def fail_creation(path: Path) -> tuple[int, tuple[int, int, int, int, int]]:
        nonlocal calls
        calls += 1
        if calls == fail_on_call:
            raise OSError("synthetic held evidence creation failure")
        descriptor, identity = real_create(path)
        created.append(descriptor)
        return descriptor, identity

    monkeypatch.setattr(runtime_lock.os, "pipe", tracked_pipe)
    monkeypatch.setattr(runtime_lock, "_create_held_evidence_file", fail_creation)
    with pytest.raises(OSError, match="synthetic held evidence"):
        runtime_lock._run_pytest_with_attestation(  # noqa: SLF001
            [sys.executable, "-c", "pass"],
            cwd=tmp_path,
            environment=os.environ.copy(),
            attestation_expectations=[
                (tmp_path / "pre.json", {"verificationPhase": "pre-conftest"}, set()),
                (tmp_path / "post.json", {"verificationPhase": "post-conftest"}, set()),
            ],
            guard_path=tmp_path / "guard.py",
            deadline_at=time.monotonic() + 1,
            execution_evidence_path=tmp_path / "execution.json",
        )
    assert created
    for descriptor in created:
        with pytest.raises(OSError):
            os.fstat(descriptor)


def test_support_mirror_uses_only_tracked_non_application_bytes(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repository, check=True)
    subprocess.run(["git", "config", "user.name", "P15 Test"], cwd=repository, check=True)
    subprocess.run(
        ["git", "config", "user.email", "p15@example.invalid"], cwd=repository, check=True
    )
    tracked = {
        "app/module.py": "application comes only from the wheel\n",
        "config/runtime.yaml": "enabled: true\n",
        "tests/conftest.py": "FIXTURE = True\n",
        "pyproject.toml": "[project]\nname='fixture'\n",
    }
    for relative, contents in tracked.items():
        path = repository / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents, encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=repository, check=True)
    subprocess.run(["git", "commit", "-qm", "fixture"], cwd=repository, check=True)
    (repository / "untracked-secret").write_text("must not copy", encoding="utf-8")

    target = tmp_path / "venv" / "candidate" / "repository" / "backend"
    runtime_lock.mirror_candidate_support_tree(repository, target)

    assert not (target / "app").exists()
    assert not (target / "untracked-secret").exists()
    for relative, contents in tracked.items():
        if relative.startswith("app/"):
            continue
        assert (target / relative).read_text(encoding="utf-8") == contents


def test_repository_support_mirror_is_closed_and_excludes_product_sources(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    backend = repository / "backend"
    backend.mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=repository, check=True)
    subprocess.run(["git", "config", "user.name", "P15 Test"], cwd=repository, check=True)
    subprocess.run(
        ["git", "config", "user.email", "p15@example.invalid"], cwd=repository, check=True
    )
    tracked = {
        ".github/workflows/harness.yml": "name: harness\n",
        "docs/contracts/health.schema.json": "{}\n",
        "docs/decisions/0044-six-ministry-evidence-spine.md": "# Evidence spine\n",
        "docs/migrations/readiness.json": "{}\n",
        "scripts/check_harness.mjs": "export default true;\n",
        "scripts/six_ministry_evidence_spine_contract.test.mjs": "export default true;\n",
        "frontend/src/secret.ts": "must not copy\n",
        "backend/app/main.py": "must come from wheel\n",
    }
    for relative, contents in tracked.items():
        path = repository / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents, encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=repository, check=True)
    subprocess.run(["git", "commit", "-qm", "fixture"], cwd=repository, check=True)
    (repository / "docs/contracts/untracked.json").write_text("secret\n", encoding="utf-8")

    target = tmp_path / "venv" / "candidate" / "repository"
    runtime_lock.mirror_candidate_repository_support(backend, target)

    assert (target / "docs/contracts/health.schema.json").read_text(encoding="utf-8") == "{}\n"
    assert (target / ".github/workflows/harness.yml").read_text(encoding="utf-8") == (
        "name: harness\n"
    )
    assert (
        target / "docs/decisions/0044-six-ministry-evidence-spine.md"
    ).read_text(encoding="utf-8") == "# Evidence spine\n"
    assert (target / "docs/migrations/readiness.json").read_text(encoding="utf-8") == "{}\n"
    assert (target / "scripts/check_harness.mjs").read_text(encoding="utf-8") == (
        "export default true;\n"
    )
    assert (
        target / "scripts/six_ministry_evidence_spine_contract.test.mjs"
    ).read_text(encoding="utf-8") == "export default true;\n"
    assert not (target / "docs/contracts/untracked.json").exists()
    assert not (target / "frontend").exists()
    assert not (target / "backend/app").exists()


def test_cli_rejects_missing_wheelhouse_without_creating_candidate_artifacts(
    tmp_path: Path,
) -> None:
    lock_path, _wheelhouse, pyproject = _minimal_lock(tmp_path)
    missing = tmp_path / "missing"
    repository = tmp_path / "repository"
    repository.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repository, check=True)
    subprocess.run(["git", "config", "user.name", "P15 Test"], cwd=repository, check=True)
    subprocess.run(
        ["git", "config", "user.email", "p15@example.invalid"], cwd=repository, check=True
    )
    (repository / "tracked").write_text("frozen", encoding="utf-8")
    subprocess.run(["git", "add", "tracked"], cwd=repository, check=True)
    subprocess.run(["git", "commit", "-qm", "base"], cwd=repository, check=True)
    (repository / "tracked").write_text("candidate", encoding="utf-8")
    subprocess.run(["git", "commit", "-qam", "candidate"], cwd=repository, check=True)
    completed = subprocess.run(
        [
            sys.executable,
            "-I",
            str(BACKEND_ROOT / "app/operations/runtime_lock.py"),
            "verify-candidate",
            "--lock",
            str(lock_path),
            "--wheelhouse",
            str(missing),
            "--pyproject",
            str(pyproject),
            "--source-root",
            str(repository),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode != 0
    assert "wheelhouse" in completed.stderr.lower()
    assert not missing.exists()


def test_isolated_pytest_keeps_the_candidate_test_fixtures() -> None:
    source = Path(runtime_lock.__file__).read_text(encoding="utf-8")
    assert '"--confcutdir"' in source
    assert 'str(staged_backend / "tests")' in source
    assert '"--rootdir",\n            str(staged_repository)' in source
    assert "materialize_candidate_snapshot(" in source
    assert "mirror_candidate_support_tree(" in source
    assert "snapshot_backend, staged_backend, deadline_at=deadline_at" in source
    assert "mirror_candidate_repository_support(" in source
    assert "snapshot_backend, staged_repository, deadline_at=deadline_at" in source
    assert '"chaotang-candidate.pth"' in source


def test_isolated_pytest_explicitly_loads_and_attests_the_candidate_guard() -> None:
    source = Path(runtime_lock.__file__).read_text(encoding="utf-8")
    assert '"chaotang_candidate_guard.py"' in source
    assert '"-p"' in source
    assert '"chaotang_candidate_guard"' in source
    assert '"PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"' in source
    assert "os.O_CREAT | os.O_EXCL" in source
    assert "_verify_candidate_attestation" in source
    assert "subprocess.Popen" in source
    assert "select.select" in source
    assert "pass_fds" in source
    assert "list_name_plugin" in source
    assert "list_plugin_distinfo" in source
    assert "resolved_entry.is_relative_to(source)" in source
    assert 'config_root / "conftest.py"' not in source
    assert "pytest_load_initial_conftests" in source
    assert "hookwrapper=True" in source or "wrapper=True" in source
    assert "pytest_sessionstart" not in source
    assert "start_new_session=True" in source
    assert "os.killpg" in source


def test_candidate_snapshot_reads_committed_objects_not_worktree_bytes(tmp_path: Path) -> None:
    repository = BACKEND_ROOT.parent
    if not (repository / ".git").exists():
        pytest.skip("requires the verifier-owned Git object store")
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD^{commit}"],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    expected = subprocess.run(
        ["git", "show", f"{commit}:backend/Dockerfile"],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    ).stdout

    snapshot_backend = runtime_lock.materialize_candidate_snapshot(
        BACKEND_ROOT, commit, tmp_path / "snapshot"
    )

    assert (snapshot_backend / "Dockerfile").read_text(encoding="utf-8") == expected


def test_dockerfile_uses_verified_json_lock_and_never_online_resolves() -> None:
    dockerfile = DOCKERFILE_PATH.read_text(encoding="utf-8")
    assert "app/operations/runtime_lock.py" in dockerfile
    assert "--no-index" in dockerfile
    assert "--require-hashes" in dockerfile
    assert "--only-binary=:all:" in dockerfile
    assert "--no-build-isolation --no-deps" in dockerfile
    assert "pip install -r requirements-runtime.lock" not in dockerfile
    assert dockerfile.count("FROM --platform=linux/amd64 docker.io/library/python@sha256:") == 2
