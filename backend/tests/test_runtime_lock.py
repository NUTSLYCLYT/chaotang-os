"""Closed-contract tests for the offline Python runtime lock."""

from __future__ import annotations

import hashlib
import json
import os
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

from app.operations import runtime_lock

BACKEND_ROOT = Path(__file__).resolve().parent.parent
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


def test_secure_work_root_is_new_private_and_identity_bound(tmp_path: Path) -> None:
    with runtime_lock.secure_work_root(parent=tmp_path) as work_root:
        info = work_root.stat()
        assert stat.S_IMODE(info.st_mode) == 0o700
        assert info.st_uid == os.getuid()
        assert info.st_nlink == 2
        assert list(work_root.iterdir()) == []
        identity = (info.st_dev, info.st_ino)
        child = work_root / "nested"
        child.mkdir()
        (child / "evidence").write_text("verified", encoding="utf-8")
    assert not work_root.exists()
    assert identity[0] > 0 and identity[1] > 0


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
    assert "materialize_candidate_snapshot(" in source
    assert "mirror_candidate_support_tree(snapshot_backend, staged_backend)" in source
    assert "mirror_candidate_repository_support(snapshot_backend, staged_repository)" in source
    assert '"chaotang-candidate.pth"' in source


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
