"""src/ima_knowledge_store.py — IMA 知识库(上书房补证附件)文件 + 元数据存储。

2026-07-10 接线(P3-B):`/api/court/ima-knowledge` 此前从未有过后端实现——
knowledge.py 的 /api/knowledge/upload 是最接近的既有能力(写文件+RAG 索引),
但没有 id/status/元数据列表,不支持这里要的按文件维度归档/启用契约。这里独立
建一套元数据存储(单 JSON 文件,同 chaotang_store.py 的 JSON 落盘惯例),复用
knowledge_rag 做真实检索索引,不重造一套 RAG。

诚实边界:knowledge_rag.KnowledgeRAG 只有 add,没有 remove——"归档"能做到的是
(1) 移出主动扫描目录,不再被新一轮 add_directory 捡入,(2) 列表/启用状态里隐藏。
但如果这条内容在归档前已经被索引过,当次向量库里已存的 chunk 不会被这里追溯
清除(RAG 本身不支持)。不在这里假装"归档=已从检索结果里彻底抹掉"。
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DOCS_ROOT = _PROJECT_ROOT / "knowledge" / "docs"
_ACTIVE_DIR = _DOCS_ROOT / "ima_uploads"
_ARCHIVED_DIR = _DOCS_ROOT / "ima_archived"
_METADATA_DIR = _PROJECT_ROOT / "data" / "default" / "ima_knowledge"
_METADATA_FILE = _METADATA_DIR / "documents.json"

_MIME_BY_EXT = {
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
}
_VALID_STATUSES = {"active", "archived"}


def _dirs_ready() -> None:
    _ACTIVE_DIR.mkdir(parents=True, exist_ok=True)
    _ARCHIVED_DIR.mkdir(parents=True, exist_ok=True)
    _METADATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_metadata() -> list[dict[str, Any]]:
    if not _METADATA_FILE.exists():
        return []
    try:
        return json.loads(_METADATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _write_metadata(docs: list[dict[str, Any]]) -> None:
    _dirs_ready()
    _METADATA_FILE.write_text(
        json.dumps(docs, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _reindex_active() -> None:
    """把当前活跃目录重新过一遍 RAG 索引(add 是内容哈希去重,重复调用安全)。"""
    try:
        from src.knowledge_rag import get_rag

        get_rag().add_directory(str(_ACTIVE_DIR))
    except Exception:
        pass  # RAG 不可用不阻断文档本身的上传/归档


def list_documents() -> list[dict[str, Any]]:
    return sorted(_read_metadata(), key=lambda d: d.get("createdAt", ""), reverse=True)


def save_document(
    filename: str, content: str, source: str = "shangshufang"
) -> dict[str, Any]:
    """写文件到活跃目录 + 建元数据记录 + 真实 RAG 索引。id 用文件名(同名覆盖)。"""
    _dirs_ready()
    safe_name = Path(filename).name
    if not safe_name.endswith((".md", ".txt", ".csv", ".json")):
        safe_name = safe_name + ".md"
    target = _ACTIVE_DIR / safe_name
    target.write_text(content, encoding="utf-8")

    now = datetime.now().isoformat(timespec="seconds")
    docs = [d for d in _read_metadata() if d.get("id") != safe_name]
    existing_created_at = next(
        (d.get("createdAt") for d in _read_metadata() if d.get("id") == safe_name), now
    )
    record = {
        "id": safe_name,
        "title": Path(safe_name).stem,
        "filename": safe_name,
        "mimeType": _MIME_BY_EXT.get(
            Path(safe_name).suffix.lower(), "application/octet-stream"
        ),
        "size": target.stat().st_size,
        "contentChars": len(content),
        "contentExcerpt": content[:200],
        "source": source,
        "status": "active",
        "createdAt": existing_created_at,
        "updatedAt": now,
        "archiveHref": f"/api/court/ima-knowledge/{safe_name}",
    }
    docs.append(record)
    _write_metadata(docs)
    _reindex_active()
    return record


def set_status(doc_id: str, status: str) -> dict[str, Any] | None:
    """归档/启用:在元数据里切状态,并把文件在 ima_uploads/ima_archived 间搬动。"""
    if status not in _VALID_STATUSES:
        return None
    _dirs_ready()
    docs = _read_metadata()
    target_doc = next((d for d in docs if d.get("id") == doc_id), None)
    if target_doc is None:
        return None

    src_dir = _ARCHIVED_DIR if target_doc["status"] == "archived" else _ACTIVE_DIR
    dst_dir = _ARCHIVED_DIR if status == "archived" else _ACTIVE_DIR
    src_path = src_dir / doc_id
    if src_path.exists() and src_dir != dst_dir:
        src_path.rename(dst_dir / doc_id)

    target_doc["status"] = status
    target_doc["updatedAt"] = datetime.now().isoformat(timespec="seconds")
    _write_metadata(docs)
    _reindex_active()  # 归档后活跃目录少一个文件,重扫不会再捡回来
    return target_doc
