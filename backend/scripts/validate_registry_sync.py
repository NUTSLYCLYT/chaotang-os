"""registry ↔ orchestrator 确定性漂移检查器（T3）。

两份配置必须同源：`config/swarm_orchestrator.yaml`（运行真相源）与
`config/jiqun_registry.yaml`（制度登记）。本检查器产出一张"漂移地图"并在漂移时退出非 0，
作为 CI 门——范式同源于 ~/.claude/scripts/check-rule-sync.sh（守规则同源）。

扫三处漂移（见后端整体方略 §5）：
  1. only_in_orchestrator —— 注册了但 registry 没登记的蜂群。
  2. only_in_registry     —— registry 登记了但 orchestrator 没注册的蜂群。
  3. quality_gate_gaps    —— min_quality_score=0 且目标不是"强制归档/审查"的数据链路空门。
                            （归档/审查目标的 0 门是故意的：必须存档/必须过工部，不算违规。）

用法：
  python scripts/validate_registry_sync.py    # 漂移 → 退出 1，账面打印漂移地图
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

_ROOT = Path(__file__).resolve().parent.parent
_ORCH = _ROOT / "config" / "swarm_orchestrator.yaml"
_REGISTRY = _ROOT / "config" / "jiqun_registry.yaml"

# 这些目标的 min_quality_score=0 是故意的（强制归档/强制审查），不算质门空门。
MANDATORY_ZERO_ALLOWLIST: frozenset[str] = frozenset({"shiguan_archive", "gongbu_review"})


def _swarm_ids(doc: dict) -> set[str]:
    return {str(s["id"]) for s in (doc.get("swarms") or []) if isinstance(s, dict) and s.get("id")}


def compute_drift(orch_path: Path | None = None, registry_path: Path | None = None) -> dict:
    """计算 registry↔orchestrator 漂移地图。默认读真实 config。"""
    orch_doc = yaml.safe_load((orch_path or _ORCH).read_text(encoding="utf-8")) or {}
    reg_doc = yaml.safe_load((registry_path or _REGISTRY).read_text(encoding="utf-8")) or {}

    orch_swarms = _swarm_ids(orch_doc)
    reg_swarms = _swarm_ids(reg_doc)

    quality_gate_gaps = []
    for b in orch_doc.get("bindings") or []:
        if not isinstance(b, dict):
            continue
        score = b.get("min_quality_score", 0)
        target = str(b.get("target_swarm", ""))
        if score == 0 and target not in MANDATORY_ZERO_ALLOWLIST:
            quality_gate_gaps.append(
                {"topic": str(b.get("topic", "")), "target_swarm": target, "min_quality_score": score}
            )

    only_in_orchestrator = orch_swarms - reg_swarms
    only_in_registry = reg_swarms - orch_swarms
    in_sync = not only_in_orchestrator and not only_in_registry and not quality_gate_gaps
    return {
        "only_in_orchestrator": only_in_orchestrator,
        "only_in_registry": only_in_registry,
        "quality_gate_gaps": quality_gate_gaps,
        "in_sync": in_sync,
        "orchestrator_swarm_count": len(orch_swarms),
        "registry_swarm_count": len(reg_swarms),
    }


def _format(drift: dict) -> str:
    lines = [
        "registry ↔ orchestrator 漂移地图",
        f"  orchestrator 蜂群数: {drift['orchestrator_swarm_count']} | registry 蜂群数: {drift['registry_swarm_count']}",
    ]
    if drift["only_in_orchestrator"]:
        lines.append(f"  ❌ 仅在 orchestrator(registry 缺登记): {sorted(drift['only_in_orchestrator'])}")
    if drift["only_in_registry"]:
        lines.append(f"  ❌ 仅在 registry(orchestrator 缺注册): {sorted(drift['only_in_registry'])}")
    for g in drift["quality_gate_gaps"]:
        lines.append(f"  ❌ 质门空门: {g['topic']} → {g['target_swarm']} (min_quality_score=0,非强制归档/审查)")
    lines.append("  ✅ in_sync" if drift["in_sync"] else "  → 漂移存在,CI 门拦截")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    drift = compute_drift()
    print(_format(drift))
    return 0 if drift["in_sync"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
