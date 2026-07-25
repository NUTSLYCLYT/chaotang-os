"""Atomic, verified storage for generated delivery artifacts."""

from __future__ import annotations

import hashlib
import os
import stat
import uuid
from dataclasses import dataclass
from pathlib import Path

from src.artifacts.service import DeliveryIntegrityError


@dataclass(frozen=True)
class StoredArtifact:
    path: Path
    content_hash: str
    byte_size: int


def _directory_open_flags() -> int:
    return (
        os.O_RDONLY
        | getattr(os, "O_DIRECTORY", 0)
        | getattr(os, "O_NOFOLLOW", 0)
    )


def _file_open_flags() -> int:
    return os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)


def _artifact_filename(artifact_id: str) -> str:
    candidate = Path(artifact_id)
    if (
        artifact_id in {"", ".", ".."}
        or candidate.is_absolute()
        or candidate.name != artifact_id
    ):
        raise ValueError("artifact path must not escape storage root")
    return artifact_id


def _artifact_path(root: Path, *, tenant_id: int, artifact_id: str) -> Path:
    """Build an identifier path without opening or resolving it."""
    return root / str(tenant_id) / _artifact_filename(artifact_id)


def _open_root(root: Path, *, create: bool) -> int:
    if create:
        try:
            root.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise DeliveryIntegrityError("artifact storage root could not be created") from exc
    try:
        return os.open(root, _directory_open_flags())
    except OSError as exc:
        raise DeliveryIntegrityError("artifact storage root could not be opened safely") from exc


def _open_tenant(root_fd: int, tenant_name: str, *, create: bool) -> int:
    if create:
        try:
            os.mkdir(tenant_name, mode=0o700, dir_fd=root_fd)
        except FileExistsError:
            pass
        except OSError as exc:
            raise DeliveryIntegrityError("artifact tenant directory could not be created") from exc
    try:
        return os.open(tenant_name, _directory_open_flags(), dir_fd=root_fd)
    except OSError as exc:
        raise DeliveryIntegrityError("artifact tenant directory could not be opened safely") from exc


def _read_relative(tenant_fd: int, filename: str) -> bytes | None:
    try:
        file_fd = os.open(filename, _file_open_flags(), dir_fd=tenant_fd)
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise DeliveryIntegrityError("stored artifact could not be read") from exc

    try:
        if not stat.S_ISREG(os.fstat(file_fd).st_mode):
            raise DeliveryIntegrityError("stored artifact is not a regular file")
        with os.fdopen(file_fd, "rb") as stored_file:
            file_fd = -1
            return stored_file.read()
    except OSError as exc:
        raise DeliveryIntegrityError("stored artifact could not be read") from exc
    finally:
        if file_fd != -1:
            os.close(file_fd)


def _verify_content(content: bytes, *, expected_hash: str, expected_size: int) -> bytes:
    actual_hash = hashlib.sha256(content).hexdigest()
    if len(content) != expected_size or actual_hash != expected_hash:
        raise DeliveryIntegrityError("stored artifact verification failed")
    return content


def _read_verified_relative(
    tenant_fd: int,
    filename: str,
    *,
    expected_hash: str,
    expected_size: int,
) -> bytes:
    content = _read_relative(tenant_fd, filename)
    if content is None:
        raise DeliveryIntegrityError("stored artifact disappeared before verification")
    return _verify_content(
        content,
        expected_hash=expected_hash,
        expected_size=expected_size,
    )


def _read_existing(tenant_fd: int, filename: str, content: bytes) -> bool:
    existing = _read_relative(tenant_fd, filename)
    if existing is None:
        return False
    if existing != content:
        raise DeliveryIntegrityError("stored artifact bytes are different from supplied content")
    return True


def _stored_artifact(
    tenant_fd: int,
    filename: str,
    path: Path,
    content_hash: str,
    byte_size: int,
) -> StoredArtifact:
    _read_verified_relative(
        tenant_fd,
        filename,
        expected_hash=content_hash,
        expected_size=byte_size,
    )
    return StoredArtifact(path=path, content_hash=content_hash, byte_size=byte_size)


def _storage_path_parts(path: Path) -> tuple[Path, str, str]:
    filename = _artifact_filename(path.name)
    tenant_name = path.parent.name
    if tenant_name in {"", ".", ".."}:
        raise DeliveryIntegrityError("stored artifact path has no tenant directory")
    return path.parent.parent, tenant_name, filename


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
    tenant_name = str(tenant_id)
    root_fd = _open_root(root, create=True)
    try:
        tenant_fd = _open_tenant(root_fd, tenant_name, create=True)
        try:
            if _read_existing(tenant_fd, final_path.name, content):
                return _stored_artifact(
                    tenant_fd,
                    final_path.name,
                    final_path,
                    content_hash,
                    byte_size,
                )

            temporary_name = f".{final_path.name}.{uuid.uuid4().hex}.tmp"
            temporary_created = False
            try:
                try:
                    temporary_fd = os.open(
                        temporary_name,
                        os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                        0o600,
                        dir_fd=tenant_fd,
                    )
                except OSError as exc:
                    raise DeliveryIntegrityError(
                        "artifact temporary file could not be created"
                    ) from exc
                temporary_created = True
                try:
                    with os.fdopen(temporary_fd, "wb") as temporary_file:
                        temporary_file.write(content)
                        temporary_file.flush()
                        os.fsync(temporary_file.fileno())
                except OSError as exc:
                    raise DeliveryIntegrityError(
                        "artifact temporary file could not be written"
                    ) from exc

                try:
                    os.link(
                        temporary_name,
                        final_path.name,
                        src_dir_fd=tenant_fd,
                        dst_dir_fd=tenant_fd,
                        follow_symlinks=False,
                    )
                except FileExistsError:
                    if _read_existing(tenant_fd, final_path.name, content):
                        return _stored_artifact(
                            tenant_fd,
                            final_path.name,
                            final_path,
                            content_hash,
                            byte_size,
                        )
                    raise DeliveryIntegrityError(
                        "stored artifact disappeared before verification"
                    )
                except OSError as exc:
                    raise DeliveryIntegrityError("stored artifact could not be linked") from exc

                try:
                    os.replace(
                        temporary_name,
                        final_path.name,
                        src_dir_fd=tenant_fd,
                        dst_dir_fd=tenant_fd,
                    )
                except OSError as exc:
                    raise DeliveryIntegrityError("stored artifact could not be committed") from exc
                return _stored_artifact(
                    tenant_fd,
                    final_path.name,
                    final_path,
                    content_hash,
                    byte_size,
                )
            finally:
                if temporary_created:
                    try:
                        os.unlink(temporary_name, dir_fd=tenant_fd)
                    except FileNotFoundError:
                        pass
        finally:
            os.close(tenant_fd)
    finally:
        os.close(root_fd)


def read_verified_artifact(
    path: Path,
    *,
    expected_hash: str,
    expected_size: int,
) -> bytes:
    """Return artifact bytes only when their recorded identity still matches."""
    root, tenant_name, filename = _storage_path_parts(path)
    root_fd = _open_root(root, create=False)
    try:
        tenant_fd = _open_tenant(root_fd, tenant_name, create=False)
        try:
            return _read_verified_relative(
                tenant_fd,
                filename,
                expected_hash=expected_hash,
                expected_size=expected_size,
            )
        finally:
            os.close(tenant_fd)
    finally:
        os.close(root_fd)
