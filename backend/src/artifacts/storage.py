"""Atomic, verified storage for generated delivery artifacts."""

from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from src.artifacts.service import DeliveryIntegrityError


@dataclass(frozen=True)
class StoredArtifact:
    path: Path
    content_hash: str
    byte_size: int


def _resolved_within_root(root: Path, candidate: Path) -> Path:
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    try:
        resolved_candidate.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError("artifact path must not escape storage root") from exc
    return resolved_candidate


def _artifact_path(root: Path, *, tenant_id: int, artifact_id: str) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    resolved_root = root.resolve()
    tenant_path = _resolved_within_root(
        resolved_root,
        resolved_root / str(tenant_id),
    )
    candidate = _resolved_within_root(resolved_root, tenant_path / artifact_id)
    return _resolved_within_root(tenant_path, candidate)


def _read_existing(path: Path, content: bytes) -> bool:
    try:
        existing = path.read_bytes()
    except FileNotFoundError:
        return False
    except OSError as exc:
        raise DeliveryIntegrityError("stored artifact could not be read") from exc
    if existing != content:
        raise DeliveryIntegrityError("stored artifact bytes are different from supplied content")
    return True


def _stored_artifact(path: Path, content_hash: str, byte_size: int) -> StoredArtifact:
    read_verified_artifact(
        path,
        expected_hash=content_hash,
        expected_size=byte_size,
    )
    return StoredArtifact(
        path=path,
        content_hash=content_hash,
        byte_size=byte_size,
    )


def store_artifact_bytes(
    root: Path,
    *,
    tenant_id: int,
    artifact_id: str,
    content: bytes,
) -> StoredArtifact:
    """Persist bytes once and fail closed if the artifact identity conflicts."""
    content_hash = hashlib.sha256(content).hexdigest()
    byte_size = len(content)
    final_path = _artifact_path(root, tenant_id=tenant_id, artifact_id=artifact_id)

    if _read_existing(final_path, content):
        return _stored_artifact(final_path, content_hash, byte_size)

    final_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = final_path.with_name(f".{final_path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with open(temporary_path, "xb") as temporary_file:
            temporary_file.write(content)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())

        try:
            # link(2) gives exactly one writer the final name without replacing a
            # concurrent winner. os.replace then commits this writer's temp name.
            os.link(temporary_path, final_path)
        except FileExistsError:
            if _read_existing(final_path, content):
                return _stored_artifact(final_path, content_hash, byte_size)
            raise DeliveryIntegrityError("stored artifact disappeared before verification")

        os.replace(temporary_path, final_path)
        return _stored_artifact(final_path, content_hash, byte_size)
    finally:
        temporary_path.unlink(missing_ok=True)


def read_verified_artifact(
    path: Path,
    *,
    expected_hash: str,
    expected_size: int,
) -> bytes:
    """Return artifact bytes only when their recorded identity still matches."""
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise DeliveryIntegrityError("stored artifact could not be read") from exc

    actual_hash = hashlib.sha256(content).hexdigest()
    if len(content) != expected_size or actual_hash != expected_hash:
        raise DeliveryIntegrityError("stored artifact verification failed")
    return content
