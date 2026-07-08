"""Preset 加载器：把 step.preset 字段展开为完整的 tools + knowledge。

设计：
- preset 在 flow 加载时静态展开（不在运行时再读盘）
- step 自带的 tools / knowledge 与 preset 合并去重
- step 显式配置 > preset 默认（用户可在 preset 基础上微调）
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_presets() -> dict:
    path = Path(__file__).resolve().parent.parent / "config" / "presets.yaml"
    if not path.exists():
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        return data.get("presets", {})
    except Exception as e:  # noqa: BLE001
        logger.warning("加载 presets.yaml 失败: %s", e)
        return {}


def list_presets() -> list[dict]:
    """供 /api/presets 返回的列表。"""
    return [
        {
            "name": name,
            "description": cfg.get("description", ""),
            "tools": cfg.get("tools", []),
            "knowledge": cfg.get("knowledge", []),
        }
        for name, cfg in _load_presets().items()
    ]


def _merge_tools(preset_tools: list[dict], step_tools: list[dict]) -> list[dict]:
    """按 server 合并 capabilities，去重。"""
    by_server: dict[str, set[str]] = {}
    for src in (preset_tools, step_tools):
        for entry in src or []:
            srv = entry.get("server")
            caps = entry.get("capabilities") or []
            if not srv:
                continue
            by_server.setdefault(srv, set()).update(caps)
    return [{"server": s, "capabilities": sorted(c)} for s, c in by_server.items()]


def _merge_knowledge(preset_kn: list[dict], step_kn: list[dict]) -> list[dict]:
    """按 (source, dataset) 去重，step 级覆盖 preset 级（top_k 等可被覆盖）。"""
    seen: dict[tuple, dict] = {}
    for entry in (preset_kn or []):
        key = (entry.get("source"), entry.get("dataset"))
        seen[key] = dict(entry)
    for entry in (step_kn or []):
        key = (entry.get("source"), entry.get("dataset"))
        seen[key] = dict(entry)  # 覆盖
    return list(seen.values())


def apply_preset(step_config: dict) -> dict:
    """把 step.preset 字段展开。返回新的 step_config（不修改原对象）。

    没有 preset 字段时直接返回原对象。preset 不存在时记日志、原样返回。
    """
    preset_name = step_config.get("preset")
    if not preset_name:
        return step_config

    presets = _load_presets()
    preset = presets.get(preset_name)
    if preset is None:
        logger.warning("step %s 引用的 preset '%s' 不存在", step_config.get("id"), preset_name)
        return step_config

    new_step = dict(step_config)
    new_step["tools"] = _merge_tools(preset.get("tools", []), step_config.get("tools", []))
    new_step["knowledge"] = _merge_knowledge(preset.get("knowledge", []), step_config.get("knowledge", []))
    new_step["_preset_applied"] = preset_name  # 调试可见
    return new_step
