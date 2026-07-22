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


def read_artifact_bytes_at_path(storage_path: str) -> bytes:
    """按持久化的 storage_path 直接读取——调用方已用 tenant_id 过滤过该行,不必也不该
    用下载者当下的 tenant_slug 重新拼路径(两者理论上应一致,但拼错就该是可控的
    FileNotFoundError,而不是悄悄读到别的路径或者两次拼接结果不一致导致的意外行为)。"""
    return Path(storage_path).read_bytes()
