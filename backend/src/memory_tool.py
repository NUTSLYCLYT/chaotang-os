"""
Hermes 风格 memory 工具 — 操作 memory/persons/{id}.md 快照文件
对应 Hermes 的 memory tool（add / replace / remove）
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from src.runtime_paths import BACKEND_ROOT, resolve_runtime_paths

logger = logging.getLogger(__name__)

# memory/persons/ 目录
MEMORY_DIR = resolve_runtime_paths().memory
PERSONS_DIR = MEMORY_DIR / "persons"
PERSON_SEEDS_DIR = BACKEND_ROOT / "resources" / "memory_profiles" / "persons"

MAX_CHARS = 2000  # 约 500 tokens（500 tokens ≈ 2000 中文字符）
WARN_PCT = 0.80   # 超过 80% 时给出警告


def _person_path(person_id: str) -> Path:
    """返回可写 profile；首次访问时从版本化种子复制。"""
    PERSONS_DIR.mkdir(parents=True, exist_ok=True)
    destination = PERSONS_DIR / f"{person_id}.md"
    seed = PERSON_SEEDS_DIR / f"{person_id}.md"
    if not destination.exists() and seed.is_file():
        # copy2 保留种子的时间元数据；之后只修改 var/ 下的运行副本。
        shutil.copy2(seed, destination)
    return destination


def _read_content(person_id: str) -> str:
    """读取快照内容，不存在则返回空字符串。"""
    p = _person_path(person_id)
    if p.exists():
        return p.read_text(encoding="utf-8")
    return ""


def _write_content(person_id: str, content: str) -> None:
    """写入快照内容。"""
    _person_path(person_id).write_text(content, encoding="utf-8")


def get_capacity(person_id: str) -> dict:
    """返回 {"chars": N, "max_chars": 2000, "pct": 0.75}"""
    content = _read_content(person_id)
    chars = len(content)
    pct = round(chars / MAX_CHARS, 4)
    return {"chars": chars, "max_chars": MAX_CHARS, "pct": pct}


def add_memory(person_id: str, content: str) -> dict:
    """
    追加新条目到快照文件末尾。
    - 超过 80% 容量时返回 warning（仍写入）
    - 超过 100% 时拒绝写入并返回 error
    """
    if not content or not content.strip():
        return {"ok": False, "error": "content 不能为空"}

    current = _read_content(person_id)
    new_content = (current.rstrip("\n") + "\n" + content.strip() + "\n") if current else (content.strip() + "\n")
    new_chars = len(new_content)

    if new_chars > MAX_CHARS:
        return {
            "ok": False,
            "error": f"容量已满（{new_chars}/{MAX_CHARS} 字符），写入被拒绝。请先删除旧条目。",
            "chars": new_chars,
            "max_chars": MAX_CHARS,
        }

    _write_content(person_id, new_content)

    result: dict = {"ok": True, "chars": new_chars, "max_chars": MAX_CHARS}
    if new_chars > MAX_CHARS * WARN_PCT:
        result["warning"] = f"快照容量已达 {round(new_chars/MAX_CHARS*100, 1)}%，建议清理旧条目。"
    return result


def replace_memory(person_id: str, old_text: str, new_text: str) -> dict:
    """
    子字符串匹配替换（对应 Hermes 的 replace 操作）。
    old_text 不存在时返回 error。
    """
    if not old_text:
        return {"ok": False, "error": "old_text 不能为空"}

    current = _read_content(person_id)
    if old_text not in current:
        return {"ok": False, "error": f"未找到要替换的内容: {old_text!r}"}

    new_content = current.replace(old_text, new_text, 1)
    new_chars = len(new_content)

    if new_chars > MAX_CHARS:
        return {
            "ok": False,
            "error": f"替换后超出容量上限（{new_chars}/{MAX_CHARS} 字符），写入被拒绝。",
        }

    _write_content(person_id, new_content)
    result: dict = {"ok": True, "chars": new_chars, "max_chars": MAX_CHARS}
    if new_chars > MAX_CHARS * WARN_PCT:
        result["warning"] = f"快照容量已达 {round(new_chars/MAX_CHARS*100, 1)}%，建议清理旧条目。"
    return result


def remove_memory(person_id: str, old_text: str) -> dict:
    """删除包含 old_text 的行（完整行匹配）。"""
    if not old_text:
        return {"ok": False, "error": "old_text 不能为空"}

    current = _read_content(person_id)
    if not current:
        return {"ok": False, "error": "快照文件不存在或为空"}

    lines = current.splitlines(keepends=True)
    new_lines = [line for line in lines if old_text not in line]

    if len(new_lines) == len(lines):
        return {"ok": False, "error": f"未找到包含该文本的行: {old_text!r}"}

    removed_count = len(lines) - len(new_lines)
    new_content = "".join(new_lines)
    _write_content(person_id, new_content)
    return {"ok": True, "removed_lines": removed_count, "chars": len(new_content)}
