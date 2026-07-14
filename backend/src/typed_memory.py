"""结构化记忆存储（四类型 + 多租户隔离 + 文件锁 + LLM 精排）。

参考 cc_source src/memdir/ 的四类型文件记忆架构，适配 jiqun_ai 多租户体系。

目录结构：
  memory/tenants/{tenant_slug}/   ← 租户隔离的记忆目录
  memory/shared/                  ← 全局共享记忆（reference 可放这里）

四类型：user / feedback / project / reference
"""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Callable

from src.runtime_paths import resolve_runtime_paths

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows only
    fcntl = None

try:
    import msvcrt
except ImportError:  # pragma: no cover - Unix only
    msvcrt = None

logger = logging.getLogger(__name__)

MEMORY_BASE = resolve_runtime_paths().memory
ENTRYPOINT = "MEMORY.md"
MAX_ENTRYPOINT_LINES = 200
MAX_ENTRYPOINT_BYTES = 25_000
MAX_MEMORY_FILES = 200
FRONTMATTER_MAX_LINES = 30
VALID_TYPES = ("user", "feedback", "project", "reference")
_LOCK_FILE = ".memory.lock"


@dataclass
class MemoryHeader:
    filename: str
    filepath: Path
    mtime_ms: float
    name: str
    description: str
    type: str
    tags: list[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class MemoryHit:
    header: MemoryHeader
    content: str


@dataclass
class EntrypointTruncation:
    content: str
    line_count: int
    byte_count: int
    was_line_truncated: bool
    was_byte_truncated: bool


class TypedMemoryStore:
    """文件系统结构化记忆存储（支持多租户隔离）。"""

    VALID_TYPES = VALID_TYPES

    def __init__(self, tenant_id: str = "default", memory_base: Path | None = None):
        self._base = memory_base or MEMORY_BASE
        self._tenant_id = tenant_id
        self._memory_dir = self._base / "tenants" / tenant_id
        self._memory_dir.mkdir(parents=True, exist_ok=True)
        self._lock_fd: BinaryIO | None = None

    @property
    def memory_dir(self) -> Path:
        return self._memory_dir

    @property
    def tenant_id(self) -> str:
        return self._tenant_id

    def save(self, name: str, content: str, type: str,
             description: str = "", tags: list[str] | None = None) -> dict:
        if type not in VALID_TYPES:
            return {"ok": False, "error": f"无效类型 {type!r}，允许: {VALID_TYPES}"}
        if not content or not content.strip():
            return {"ok": False, "error": "content 不能为空"}

        filename = self._generate_filename(name, type)
        now = datetime.now(timezone.utc).isoformat()
        tags = tags or []

        fm_lines = [
            "---",
            f"name: {name}",
            f"description: {description}",
            f"type: {type}",
            f"created_at: \"{now}\"",
            f"updated_at: \"{now}\"",
            f"tags: [{', '.join(tags)}]",
            "---",
        ]
        file_content = "\n".join(fm_lines) + "\n\n" + content.strip() + "\n"

        if not self._acquire_lock():
            return {"ok": False, "error": "无法获取文件锁（并发写入冲突）"}
        try:
            filepath = self._memory_dir / filename
            filepath.write_text(file_content, encoding="utf-8")
            self._update_entrypoint()
        except OSError as e:
            return {"ok": False, "error": f"写入失败: {e}"}
        finally:
            self._release_lock()

        total = len(self._list_memory_files())
        result: dict = {
            "ok": True,
            "filename": filename,
            "chars": len(content.strip()),
            "index_updated": True,
        }
        if total > MAX_MEMORY_FILES:
            result["warning"] = f"记忆文件数 ({total}) 超过建议上限 ({MAX_MEMORY_FILES})"
        return result

    def update(self, filename: str, content: str | None = None,
               description: str | None = None, tags: list[str] | None = None) -> dict:
        filepath = self._memory_dir / filename
        if not filepath.exists():
            return {"ok": False, "error": f"文件不存在: {filename}"}

        existing = self._read_file(filepath)
        if existing is None:
            return {"ok": False, "error": f"文件读取失败: {filename}"}

        fm, body = existing
        now = datetime.now(timezone.utc).isoformat()
        fm["updated_at"] = now
        if description is not None:
            fm["description"] = description
        if tags is not None:
            fm["tags"] = tags

        new_body = body
        if content is not None:
            if not content.strip():
                return {"ok": False, "error": "content 不能为空"}
            new_body = content.strip()

        file_content = self._serialize_file(fm, new_body)

        if not self._acquire_lock():
            return {"ok": False, "error": "无法获取文件锁"}
        try:
            filepath.write_text(file_content, encoding="utf-8")
            self._update_entrypoint()
        except OSError as e:
            return {"ok": False, "error": f"写入失败: {e}"}
        finally:
            self._release_lock()

        return {"ok": True, "filename": filename, "chars": len(new_body)}

    def delete(self, filename: str) -> dict:
        filepath = self._memory_dir / filename
        if not filepath.exists():
            return {"ok": False, "error": f"文件不存在: {filename}"}

        if not self._acquire_lock():
            return {"ok": False, "error": "无法获取文件锁"}
        try:
            filepath.unlink()
            self._update_entrypoint()
        except OSError as e:
            return {"ok": False, "error": f"删除失败: {e}"}
        finally:
            self._release_lock()

        return {"ok": True, "filename": filename}

    def get(self, filename: str) -> dict | None:
        filepath = self._memory_dir / filename
        if not filepath.exists():
            return None
        parsed = self._read_file(filepath)
        if parsed is None:
            return None
        fm, body = parsed
        return {
            "filename": filename,
            "name": fm.get("name", ""),
            "description": fm.get("description", ""),
            "type": fm.get("type", ""),
            "tags": fm.get("tags", []),
            "created_at": fm.get("created_at", ""),
            "updated_at": fm.get("updated_at", ""),
            "content": body,
        }

    def scan(self) -> list[MemoryHeader]:
        results: list[MemoryHeader] = []
        for md_file in self._list_memory_files():
            parsed = self._read_file(md_file)
            if parsed is None:
                continue
            fm, _ = parsed
            stat = md_file.stat()
            results.append(MemoryHeader(
                filename=md_file.name,
                filepath=md_file,
                mtime_ms=stat.st_mtime * 1000,
                name=fm.get("name", md_file.stem),
                description=fm.get("description", ""),
                type=fm.get("type", ""),
                tags=fm.get("tags", []),
                created_at=fm.get("created_at", ""),
                updated_at=fm.get("updated_at", ""),
            ))
        results.sort(key=lambda h: h.updated_at, reverse=True)
        return results

    def search_fts(self, query: str, limit: int = 5,
                   type_filter: str | None = None) -> list[MemoryHeader]:
        if not query or not query.strip():
            return []
        tokens = re.findall(r'[\w\u4e00-\u9fff]{2,}', query.lower())
        if not tokens:
            return []

        results: list[tuple[int, MemoryHeader]] = []
        for header in self.scan():
            if type_filter and header.type != type_filter:
                continue
            text = f"{header.name} {header.description} {' '.join(header.tags)}".lower()
            score = sum(1 for t in tokens if t in text)
            if score > 0:
                results.append((score, header))

        results.sort(key=lambda x: x[0], reverse=True)
        return [h for _, h in results[:limit]]

    def search_relevant(self, query: str, limit: int = 5,
                        on_llm_select: Callable | None = None) -> list[MemoryHit]:
        headers = self.scan()
        if not headers:
            return []
        if len(headers) <= limit:
            return self._headers_to_hits(headers[:limit])

        try:
            from src.typed_memory_llm import llm_select_memories
            selected_filenames = llm_select_memories(query, headers, limit)
            if on_llm_select:
                on_llm_select(query, selected_filenames)
        except Exception as e:
            logger.warning("LLM 精排失败，降级到 FTS: %s", e)
            return self._fts_fallback(query, limit)

        if not selected_filenames:
            return []

        filename_set = set(selected_filenames)
        selected_headers = [h for h in headers if h.filename in filename_set]
        selected_headers.sort(key=lambda h: selected_filenames.index(h.filename))

        return self._headers_to_hits(selected_headers[:limit])

    def rebuild_index(self) -> dict:
        if not self._acquire_lock():
            return {"ok": False, "error": "无法获取文件锁"}
        try:
            self._update_entrypoint()
        finally:
            self._release_lock()

        total = len(self._list_memory_files())
        return {"ok": True, "total": total}

    def stats(self) -> dict:
        headers = self.scan()
        by_type: dict[str, int] = {}
        for h in headers:
            by_type[h.type] = by_type.get(h.type, 0) + 1
        entrypoint_path = self._memory_dir / ENTRYPOINT
        index_lines = 0
        if entrypoint_path.exists():
            try:
                index_lines = len(entrypoint_path.read_text(encoding="utf-8").splitlines())
            except Exception:
                pass
        return {
            "tenant_id": self._tenant_id,
            "total": len(headers),
            "by_type": by_type,
            "index_lines": index_lines,
        }

    def _list_memory_files(self) -> list[Path]:
        if not self._memory_dir.exists():
            return []
        return sorted(
            [p for p in self._memory_dir.iterdir()
             if p.suffix == ".md" and p.name != ENTRYPOINT and p.name != _LOCK_FILE],
            key=lambda p: p.name,
        )

    def _read_file(self, filepath: Path) -> tuple[dict, str] | None:
        try:
            raw = filepath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            logger.warning("记忆文件读取失败 %s: %s", filepath.name, e)
            return None

        if not raw.startswith("---"):
            logger.warning("记忆文件缺少 frontmatter: %s", filepath.name)
            return None

        end = raw.find("\n---", 3)
        if end == -1:
            logger.warning("记忆文件 frontmatter 未闭合: %s", filepath.name)
            return None

        fm_text = raw[3:end].strip()
        body = raw[end + 4:].strip()

        if fm_text.count("\n") > FRONTMATTER_MAX_LINES:
            logger.warning("frontmatter 行数超限: %s", filepath.name)

        fm: dict = {}
        for line in fm_text.splitlines():
            if ":" not in line:
                continue
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            if key == "tags":
                if val.startswith("[") and val.endswith("]"):
                    inner = val[1:-1].strip()
                    fm["tags"] = [t.strip() for t in inner.split(",") if t.strip()] if inner else []
                else:
                    fm["tags"] = []
            elif key in ("name", "description", "type", "created_at", "updated_at"):
                fm[key] = val.strip('"').strip("'")

        if "tags" not in fm:
            fm["tags"] = []

        return fm, body

    def _serialize_file(self, fm: dict, body: str) -> str:
        lines = ["---"]
        lines.append(f"name: {fm.get('name', '')}")
        lines.append(f"description: {fm.get('description', '')}")
        lines.append(f"type: {fm.get('type', '')}")
        lines.append(f"created_at: \"{fm.get('created_at', '')}\"")
        lines.append(f"updated_at: \"{fm.get('updated_at', '')}\"")
        tags = fm.get("tags", [])
        lines.append(f"tags: [{', '.join(tags)}]")
        lines.append("---")
        return "\n".join(lines) + "\n\n" + body.strip() + "\n"

    def _generate_filename(self, name: str, type: str) -> str:
        safe = re.sub(r'[^\w]', '_', name).strip('_').lower()
        if not safe or len(safe) < 2:
            safe = hashlib.md5(name.encode()).hexdigest()[:8]
        filename = f"{type}_{safe}.md"
        counter = 2
        while (self._memory_dir / filename).exists():
            base = re.sub(r'_\d+$', '', safe)
            filename = f"{type}_{base}_{counter}.md"
            counter += 1
        return filename

    def _update_entrypoint(self) -> None:
        headers = self.scan()
        lines = [
            "# 记忆索引",
            "",
            "> 自动生成，勿手动编辑。每条记忆占一行索引，详情见对应文件。",
            "",
        ]
        for h in headers:
            desc_preview = h.description[:80].replace("\n", " ") if h.description else ""
            lines.append(f"- [{h.name}]({h.filename}) — {desc_preview}")

        lines.append("")
        lines.append("> ⚠ 记忆可能过时。使用前先验证当前状态是否与记忆一致。如果记忆与观察到的事实冲突，信任当前观察。")
        lines.append("")

        content = "\n".join(lines)
        truncation = self._truncate_index(content)

        entrypoint_path = self._memory_dir / ENTRYPOINT
        try:
            entrypoint_path.write_text(truncation.content, encoding="utf-8")
        except OSError as e:
            logger.warning("MEMORY.md 写入失败: %s", e)

    def _truncate_index(self, content: str) -> EntrypointTruncation:
        lines = content.split("\n")
        was_line_truncated = len(lines) > MAX_ENTRYPOINT_LINES
        if was_line_truncated:
            lines = lines[:MAX_ENTRYPOINT_LINES - 1]
            lines.append("\n> ⚠ 索引已截断（超过 200 行），完整列表请查看文件。")
            content = "\n".join(lines)

        was_byte_truncated = len(content.encode("utf-8")) > MAX_ENTRYPOINT_BYTES
        if was_byte_truncated:
            encoded = content.encode("utf-8")[:MAX_ENTRYPOINT_BYTES]
            content = encoded.decode("utf-8", errors="ignore")
            content += "\n\n> ⚠ 索引已截断（超过 25KB）。"

        return EntrypointTruncation(
            content=content,
            line_count=content.count("\n") + 1,
            byte_count=len(content.encode("utf-8")),
            was_line_truncated=was_line_truncated,
            was_byte_truncated=was_byte_truncated,
        )

    def _headers_to_hits(self, headers: list[MemoryHeader]) -> list[MemoryHit]:
        hits: list[MemoryHit] = []
        for h in headers:
            parsed = self._read_file(h.filepath)
            if parsed is None:
                continue
            _, body = parsed
            hits.append(MemoryHit(header=h, content=body))
        return hits

    def _fts_fallback(self, query: str, limit: int) -> list[MemoryHit]:
        fts_headers = self.search_fts(query, limit=limit)
        return self._headers_to_hits(fts_headers)

    def _acquire_lock(self) -> bool:
        lock_path = self._memory_dir / _LOCK_FILE
        try:
            self._lock_fd = open(lock_path, "a+b")
            if fcntl is not None:
                fcntl.flock(self._lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            elif msvcrt is not None:
                self._lock_fd.seek(0)
                if self._lock_fd.read(1) == b"":
                    self._lock_fd.write(b"\0")
                    self._lock_fd.flush()
                self._lock_fd.seek(0)
                msvcrt.locking(self._lock_fd.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except (IOError, OSError):
            if self._lock_fd:
                self._lock_fd.close()
                self._lock_fd = None
            return False

    def _release_lock(self) -> None:
        if self._lock_fd:
            try:
                if fcntl is not None:
                    fcntl.flock(self._lock_fd, fcntl.LOCK_UN)
                elif msvcrt is not None:
                    self._lock_fd.seek(0)
                    msvcrt.locking(self._lock_fd.fileno(), msvcrt.LK_UNLCK, 1)
            except Exception:
                pass
            finally:
                self._lock_fd.close()
            self._lock_fd = None
