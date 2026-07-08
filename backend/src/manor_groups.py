# src/manor_groups.py
"""庄园 6 大分组配置加载。"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

_CONFIG = Path(__file__).resolve().parent.parent / "config" / "manor_groups.yaml"


@dataclass(frozen=True)
class ManorGroup:
    id: str
    name: str
    ministers: list[str]
    subagent_max: int
    runtime: str
    openclaw_base_url_env: str | None
    desc: str

    def resolved_runtime(self) -> str:
        """若声明了 openclaw 且对应 env 有值,则走 openclaw,否则 spawn。"""
        if self.openclaw_base_url_env and os.getenv(self.openclaw_base_url_env):
            return "openclaw"
        return "spawn"


def load_manor_groups(path: Path = _CONFIG) -> list[ManorGroup]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    groups: list[ManorGroup] = []
    for raw in data.get("groups", []):
        groups.append(ManorGroup(
            id=raw["id"],
            name=raw["name"],
            ministers=list(raw.get("ministers", [])),
            subagent_max=int(raw.get("subagent_max", 3)),
            runtime=raw.get("runtime", "spawn"),
            openclaw_base_url_env=raw.get("openclaw_base_url_env"),
            desc=raw.get("desc", ""),
        ))
    if len(groups) != 6:
        raise ValueError(f"manor_groups.yaml 必须定义 6 组,实得 {len(groups)}")
    return groups


def groups_for_ministers(agent_codes: list[str]) -> list[str]:
    """据出意见大臣推断涉及的执行组 id(去重,保持首次出现顺序)。"""
    groups = load_manor_groups()
    member_to_group = {m: g.id for g in groups for m in g.ministers}
    out: list[str] = []
    for code in agent_codes:
        gid = member_to_group.get(code)
        if gid and gid not in out:
            out.append(gid)
    return out
