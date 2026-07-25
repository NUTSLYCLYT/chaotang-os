from __future__ import annotations

import hashlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import pytest

from src.artifacts import storage
from src.artifacts.service import DeliveryIntegrityError
from src.artifacts.storage import read_verified_artifact, store_artifact_bytes


def _temporary_files(root: Path) -> list[Path]:
    return list(root.rglob("*.tmp"))


def test_store_rejects_artifact_path_that_escapes_root(tmp_path: Path) -> None:
    root = tmp_path / "storage"

    with pytest.raises(ValueError, match="escape"):
        store_artifact_bytes(
            root,
            tenant_id=7,
            artifact_id="../outside",
            content=b"contents",
        )

    assert not (tmp_path / "outside").exists()


def test_store_rejects_tenant_directory_swapped_to_external_symlink(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "storage"
    tenant_directory = root / "7"
    outside = tmp_path / "outside"
    tenant_directory.mkdir(parents=True)
    outside.mkdir()
    original_artifact_path = storage._artifact_path

    def swap_tenant_directory(
        root_arg: Path, *, tenant_id: int, artifact_id: str
    ) -> Path:
        path = original_artifact_path(
            root_arg,
            tenant_id=tenant_id,
            artifact_id=artifact_id,
        )
        tenant_directory.rmdir()
        tenant_directory.symlink_to(outside, target_is_directory=True)
        return path

    monkeypatch.setattr(storage, "_artifact_path", swap_tenant_directory)

    with pytest.raises(DeliveryIntegrityError, match="tenant"):
        store_artifact_bytes(
            root,
            tenant_id=7,
            artifact_id="symlink-escape",
            content=b"must remain inside root",
        )

    assert not (outside / "symlink-escape").exists()


def test_verified_read_rejects_tenant_symlink_to_matching_external_file(
    tmp_path: Path,
) -> None:
    root = tmp_path / "storage"
    outside = tmp_path / "outside"
    outside.mkdir()
    content = b"matching external artifact"
    external_artifact = outside / "artifact-verified"
    external_artifact.write_bytes(content)
    root.mkdir()
    (root / "7").symlink_to(outside, target_is_directory=True)

    with pytest.raises(DeliveryIntegrityError, match="tenant"):
        read_verified_artifact(
            root / "7" / external_artifact.name,
            expected_hash=hashlib.sha256(content).hexdigest(),
            expected_size=len(content),
        )


def test_store_returns_verified_artifact_for_first_write(tmp_path: Path) -> None:
    root = tmp_path / "storage"
    content = b"durable artifact contents"

    stored = store_artifact_bytes(
        root,
        tenant_id=7,
        artifact_id="artifact-001",
        content=content,
    )

    assert stored.path.resolve().is_relative_to(root.resolve())
    assert stored.path.read_bytes() == content
    assert stored.content_hash == hashlib.sha256(content).hexdigest()
    assert stored.byte_size == len(content)
    assert (
        read_verified_artifact(
            stored.path,
            expected_hash=stored.content_hash,
            expected_size=stored.byte_size,
        )
        == content
    )
    assert _temporary_files(root) == []


def test_store_reuses_identical_bytes_without_changing_mtime(tmp_path: Path) -> None:
    root = tmp_path / "storage"
    content = b"replayed artifact contents"
    first = store_artifact_bytes(
        root,
        tenant_id=7,
        artifact_id="artifact-002",
        content=content,
    )
    initial_mtime_ns = first.path.stat().st_mtime_ns

    replayed = store_artifact_bytes(
        root,
        tenant_id=7,
        artifact_id="artifact-002",
        content=content,
    )

    assert replayed == first
    assert replayed.path.stat().st_mtime_ns == initial_mtime_ns
    assert _temporary_files(root) == []


def test_store_rejects_different_bytes_without_leaving_temporary_file(
    tmp_path: Path,
) -> None:
    root = tmp_path / "storage"
    stored = store_artifact_bytes(
        root,
        tenant_id=7,
        artifact_id="artifact-003",
        content=b"original bytes",
    )

    with pytest.raises(DeliveryIntegrityError, match="different"):
        store_artifact_bytes(
            root,
            tenant_id=7,
            artifact_id="artifact-003",
            content=b"conflicting bytes",
        )

    assert stored.path.read_bytes() == b"original bytes"
    assert _temporary_files(root) == []


@pytest.mark.parametrize("corrupted", [b"truncated", b"replacement bytes"])
def test_verified_read_rejects_corrupted_stored_bytes(
    tmp_path: Path, corrupted: bytes
) -> None:
    stored = store_artifact_bytes(
        tmp_path / "storage",
        tenant_id=7,
        artifact_id="artifact-004",
        content=b"expected artifact bytes",
    )
    stored.path.write_bytes(corrupted)

    with pytest.raises(DeliveryIntegrityError, match="verification"):
        read_verified_artifact(
            stored.path,
            expected_hash=stored.content_hash,
            expected_size=stored.byte_size,
        )


def test_concurrent_writers_choose_one_winner_without_temporary_files(
    tmp_path: Path,
) -> None:
    root = tmp_path / "storage"
    start = Barrier(2)

    def write(content: bytes):
        start.wait()
        return store_artifact_bytes(
            root,
            tenant_id=7,
            artifact_id="artifact-005",
            content=content,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(write, content) for content in (b"winner-a", b"winner-b")]
        outcomes = []
        for future in futures:
            try:
                outcomes.append(future.result())
            except DeliveryIntegrityError as exc:
                outcomes.append(exc)

    winners = [outcome for outcome in outcomes if not isinstance(outcome, Exception)]
    conflicts = [outcome for outcome in outcomes if isinstance(outcome, DeliveryIntegrityError)]
    assert len(winners) == 1
    assert len(conflicts) == 1
    assert winners[0].path.read_bytes() in {b"winner-a", b"winner-b"}
    assert _temporary_files(root) == []
