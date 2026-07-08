"""带版本管理的Prompt系统 — 支持磁盘持久化"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

VERSIONS_DIR = Path(__file__).resolve().parent.parent / "prompt_versions"


@dataclass
class PromptVersion:
    """Prompt版本记录"""

    version: str  # v1, v2, v3...
    content: str  # prompt内容
    created_at: str  # 创建时间
    change_reason: str  # 修改原因
    author: str = "system"  # 修改人

    def to_dict(self, include_content: bool = False) -> dict:
        d = {
            "version": self.version,
            "created_at": self.created_at,
            "change_reason": self.change_reason,
            "author": self.author,
        }
        if include_content:
            d["content"] = self.content
        return d


class VersionedPrompt:
    """带版本管理的Prompt"""

    def __init__(
        self,
        key: str,
        initial_content: str,
        name: str = "",
        flow: str = "",
        persist: bool = False,
    ):
        self.key = key
        self.name = name
        self.flow = flow
        self._versions: List[PromptVersion] = []
        self._persist = persist
        self._add_version(initial_content, "初始版本")

    def _add_version(self, content: str, reason: str, author: str = "system"):
        """内部：添加新版本"""
        version_num = len(self._versions) + 1
        version = PromptVersion(
            version=f"v{version_num}",
            content=content,
            created_at=datetime.now().astimezone().isoformat(),
            change_reason=reason,
            author=author,
        )
        self._versions.append(version)
        if self._persist:
            _persist_to_disk(self)
        return version.version

    def update(self, new_content: str, reason: str, author: str = "system") -> str:
        """更新prompt，创建新版本"""
        return self._add_version(new_content, reason, author)

    @property
    def current(self) -> str:
        """获取当前版本内容"""
        return self._versions[-1].content if self._versions else ""

    @property
    def current_version(self) -> str:
        """获取当前版本号"""
        return self._versions[-1].version if self._versions else "v0"

    def get_version(self, version: str) -> Optional[str]:
        """获取指定版本内容"""
        for v in self._versions:
            if v.version == version:
                return v.content
        return None

    def get_history(self) -> List[PromptVersion]:
        """获取版本历史"""
        return self._versions.copy()

    def to_dict(self, include_content: bool = False) -> dict:
        """序列化（用于存储）"""
        return {
            "key": self.key,
            "name": self.name,
            "flow": self.flow,
            "current_version": self.current_version,
            "versions": [v.to_dict(include_content=include_content) for v in self._versions],
        }


# ===== 全局Prompt注册表 =====

_VERSIONED_PROMPTS: Dict[str, VersionedPrompt] = {}
_PROMPTS_LOADED = False


def _ensure_prompts_loaded():
    """加载所有prompt模块并注册全部prompt"""
    global _PROMPTS_LOADED
    if _PROMPTS_LOADED:
        return
    _PROMPTS_LOADED = True
    modules = [
        "src.prompts",
        "src.prompts_haolong",
        "src.prompts_product",
        "src.prompts_quotation",
        "src.prompts_ai_ops",
        "src.prompts_aftercare",
    ]
    for mod in modules:
        try:
            __import__(mod)
        except ImportError:
            pass
    _load_from_disk()


def _persist_to_disk(vp: VersionedPrompt):
    """将版本历史持久化到磁盘"""
    vp_dir = VERSIONS_DIR / vp.key
    vp_dir.mkdir(parents=True, exist_ok=True)
    versions_file = vp_dir / "versions.json"
    data = {
        "key": vp.key,
        "versions": [v.to_dict(include_content=True) for v in vp._versions],
    }
    versions_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    latest_file = vp_dir / "latest.txt"
    latest_file.write_text(vp.current, encoding="utf-8")


def _load_from_disk():
    """从磁盘加载持久化的版本，覆盖或追加到内存中的prompt"""
    if not VERSIONS_DIR.exists():
        return
    for key_dir in VERSIONS_DIR.iterdir():
        if not key_dir.is_dir():
            continue
        versions_file = key_dir / "versions.json"
        if not versions_file.exists():
            continue
        try:
            data = json.loads(versions_file.read_text(encoding="utf-8"))
            disk_versions = data.get("versions", [])
            if not disk_versions:
                continue
            key = data.get("key", key_dir.name)
            if key in _VERSIONED_PROMPTS:
                vp = _VERSIONED_PROMPTS[key]
                if len(disk_versions) > len(vp._versions):
                    vp._versions = [
                        PromptVersion(
                            version=v["version"],
                            content=v["content"],
                            created_at=v["created_at"],
                            change_reason=v.get("change_reason", ""),
                            author=v.get("author", "system"),
                        )
                        for v in disk_versions
                    ]
                    vp._persist = True
            else:
                vp = VersionedPrompt.__new__(VersionedPrompt)
                vp.key = key
                vp._versions = [
                    PromptVersion(
                        version=v["version"],
                        content=v["content"],
                        created_at=v["created_at"],
                        change_reason=v.get("change_reason", ""),
                        author=v.get("author", "system"),
                    )
                    for v in disk_versions
                ]
                vp._persist = True
                _VERSIONED_PROMPTS[key] = vp
        except Exception:
            pass


def register_prompt(
    key: str, content: str, name: str = "", flow: str = ""
) -> VersionedPrompt:
    """注册一个prompt，可附带角色名称和所属Flow"""
    if key in _VERSIONED_PROMPTS:
        vp = _VERSIONED_PROMPTS[key]
        if name:
            vp.name = name
        if flow:
            vp.flow = flow
        return vp
    vp = VersionedPrompt(key, content, name=name, flow=flow)
    _VERSIONED_PROMPTS[key] = vp
    return vp


def get_prompt(key: str, version: Optional[str] = None) -> str:
    """获取prompt内容"""
    _ensure_prompts_loaded()
    vp = _VERSIONED_PROMPTS.get(key)
    if not vp:
        raise KeyError(f"Prompt '{key}' not found")
    if version:
        content = vp.get_version(version)
        if content is None:
            raise ValueError(f"Version '{version}' not found for prompt '{key}'")
        return content
    return vp.current


def get_prompt_version(key: str) -> str:
    """获取当前版本号"""
    _ensure_prompts_loaded()
    vp = _VERSIONED_PROMPTS.get(key)
    return vp.current_version if vp else "unknown"


def update_prompt(
    key: str, new_content: str, reason: str, author: str = "system"
) -> str:
    """更新prompt，自动持久化到磁盘"""
    _ensure_prompts_loaded()
    vp = _VERSIONED_PROMPTS.get(key)
    if not vp:
        raise KeyError(f"Prompt '{key}' not found")
    vp._persist = True
    return vp.update(new_content, reason, author)


def get_prompt_history(key: str) -> List[PromptVersion]:
    """获取prompt版本历史"""
    _ensure_prompts_loaded()
    vp = _VERSIONED_PROMPTS.get(key)
    return vp.get_history() if vp else []


def get_prompt_content_with_history(key: str) -> dict:
    """获取prompt当前内容 + 版本历史（含content），用于编辑API"""
    _ensure_prompts_loaded()
    vp = _VERSIONED_PROMPTS.get(key)
    if not vp:
        raise KeyError(f"Prompt '{key}' not found")
    return {
        "key": key,
        "name": vp.name,
        "flow": vp.flow,
        "current_version": vp.current_version,
        "current_content": vp.current,
        "versions": [v.to_dict(include_content=True) for v in vp.get_history()],
    }


def list_prompts() -> List[dict]:
    """列出所有prompt及其当前版本、角色名、所属Flow"""
    _ensure_prompts_loaded()
    return [
        {
            "key": k,
            "version": v.current_version,
            "name": v.name,
            "flow": v.flow,
        }
        for k, v in _VERSIONED_PROMPTS.items()
    ]


def get_all_prompts() -> Dict[str, VersionedPrompt]:
    """获取所有已注册的prompt（用于初始化）"""
    _ensure_prompts_loaded()
    return _VERSIONED_PROMPTS.copy()
