#!/usr/bin/env python3
"""Validate advisor protocols for every swarm flow.

The protocol is deliberately centralised in config/advisor_protocols.yaml so we
can upgrade all swarms without duplicating prompt text in every flow YAML.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "config"
PROTOCOL = CFG / "advisor_protocols.yaml"

REQUIRED_GLOBAL_OUTPUTS = {"warning", "genius_advice", "failure_path", "evidence_gap", "confidence"}
REQUIRED_LEVELS = {"routine", "substantial", "design", "irreversible"}
REQUIRED_SWARM_FIELDS = {"profile", "level", "owner", "genius_design"}


def load_yaml(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def flow_id(path: Path) -> str:
    return path.stem.removeprefix("flow_")


def validate() -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    if not PROTOCOL.exists():
        return [f"缺少大神协议配置: {PROTOCOL.relative_to(ROOT)}"], {}

    doc = load_yaml(PROTOCOL)
    global_contract = doc.get("global_contract") or {}
    profiles = doc.get("profiles") or {}
    swarms = doc.get("swarms") or {}
    levels = (global_contract.get("levels") or {}).keys()
    required_outputs = set(global_contract.get("required_outputs") or [])

    if global_contract.get("enabled") is not True:
        errors.append("global_contract.enabled 必须为 true")
    missing_outputs = REQUIRED_GLOBAL_OUTPUTS - required_outputs
    if missing_outputs:
        errors.append(f"global_contract.required_outputs 缺少: {', '.join(sorted(missing_outputs))}")
    missing_levels = REQUIRED_LEVELS - set(levels)
    if missing_levels:
        errors.append(f"global_contract.levels 缺少: {', '.join(sorted(missing_levels))}")

    for name, profile in profiles.items():
        advisors = profile.get("advisors") or []
        if len(advisors) < 2:
            errors.append(f"profile '{name}' 至少需要 2 位 advisor")
        if not profile.get("department"):
            errors.append(f"profile '{name}' 缺少 department")
        if not profile.get("use_for"):
            errors.append(f"profile '{name}' 缺少 use_for")

    flows = sorted(CFG.glob("flow_*.yaml"))
    flow_ids = {flow_id(path) for path in flows}
    missing = flow_ids - set(swarms)
    extra = set(swarms) - flow_ids
    for sid in sorted(missing):
        errors.append(f"flow_{sid}.yaml 缺少 advisor_protocols.swarms.{sid}")
    for sid in sorted(extra):
        errors.append(f"advisor_protocols.swarms.{sid} 没有对应 flow_{sid}.yaml")

    for sid, entry in sorted(swarms.items()):
        missing_fields = REQUIRED_SWARM_FIELDS - set(entry)
        if missing_fields:
            errors.append(f"swarm '{sid}' 缺少字段: {', '.join(sorted(missing_fields))}")
        profile_name = entry.get("profile")
        if profile_name not in profiles:
            errors.append(f"swarm '{sid}' 引用未知 profile: {profile_name}")
        level = entry.get("level")
        if level not in REQUIRED_LEVELS:
            errors.append(f"swarm '{sid}' level 非法: {level}")
        genius_design = str(entry.get("genius_design") or "").strip()
        if len(genius_design) < 20:
            errors.append(f"swarm '{sid}' genius_design 过短，必须是可执行系统设计")

    summary = {
        "flows": len(flows),
        "profiles": len(profiles),
        "swarms": len(swarms),
        "levels": sorted(levels),
    }
    return errors, summary


def main() -> int:
    errors, summary = validate()
    print(
        f"advisor_protocols: flow={summary.get('flows', 0)} "
        f"profile={summary.get('profiles', 0)} swarm={summary.get('swarms', 0)}"
    )
    if errors:
        print(f"\n❌ {len(errors)} 个大神协议错误:")
        for error in errors:
            print("   -", error)
        return 1
    print("✅ 所有 flow_*.yaml 都已接入大神协议、天才建议/天才设计输出契约和签字边界。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
