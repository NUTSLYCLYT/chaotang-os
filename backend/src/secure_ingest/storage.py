"""原始字节落盘——只落 `var/`（已排除提交），DB 只存摘要 + 元数据，绝不存字节。"""

from __future__ import annotations

from pathlib import Path

from src.runtime_paths import RUNTIME_PATHS

SECURE_INGEST_ROOT = RUNTIME_PATHS.root / "secure_ingest"


def artifact_storage_path(tenant_slug: str, artifact_id: str) -> Path:
    safe_tenant = tenant_slug.replace("/", "_").replace("..", "_")
    safe_artifact = artifact_id.replace("/", "_").replace("..", "_")
    return SECURE_INGEST_ROOT / safe_tenant / f"{safe_artifact}.bin"


def write_artifact_bytes(tenant_slug: str, artifact_id: str, raw_bytes: bytes) -> Path:
    path = artifact_storage_path(tenant_slug, artifact_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw_bytes)
    return path


def read_artifact_bytes(tenant_slug: str, artifact_id: str) -> bytes:
    return artifact_storage_path(tenant_slug, artifact_id).read_bytes()
