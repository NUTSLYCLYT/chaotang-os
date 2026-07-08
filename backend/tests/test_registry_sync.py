"""T3 验收：registry ↔ orchestrator 确定性漂移检查器 + 质门空门扫描。

对应 docs/chaotang_backend_grand_strategy_2026-06-10.md §5、§6 T3。
范式同源：与 ~/.claude/scripts/check-rule-sync.sh 一样，是"两份配置必须同源"的确定性 drift 门。
锁住：① 蜂群集合漂移可检测 ② min_quality_score=0 区分"数据链路空门(违规)"vs"归档/审查强制门(故意)"
③ 修复后真实仓库 in_sync ④ main() 漂移时退出非 0(CI 门)。
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from scripts.validate_registry_sync import (
    MANDATORY_ZERO_ALLOWLIST,
    compute_drift,
    main,
)


def _write(tmp_path: Path, orch_swarms, registry_swarms, bindings) -> tuple[Path, Path]:
    orch = {"swarms": [{"id": s} for s in orch_swarms], "bindings": bindings}
    reg = {"swarms": [{"id": s} for s in registry_swarms]}
    import yaml

    o = tmp_path / "orch.yaml"
    r = tmp_path / "reg.yaml"
    o.write_text(yaml.safe_dump(orch, allow_unicode=True), encoding="utf-8")
    r.write_text(yaml.safe_dump(reg, allow_unicode=True), encoding="utf-8")
    return o, r


def test_detects_swarm_only_in_orchestrator(tmp_path):
    o, r = _write(tmp_path, ["a", "b", "c"], ["a", "b"], [])
    drift = compute_drift(o, r)
    assert drift["only_in_orchestrator"] == {"c"}
    assert drift["only_in_registry"] == set()
    assert drift["in_sync"] is False


def test_detects_swarm_only_in_registry(tmp_path):
    o, r = _write(tmp_path, ["a"], ["a", "z"], [])
    drift = compute_drift(o, r)
    assert drift["only_in_registry"] == {"z"}
    assert drift["in_sync"] is False


def test_zero_gate_to_business_swarm_is_a_gap(tmp_path):
    o, r = _write(
        tmp_path,
        ["a", "opc"],
        ["a", "opc"],
        [{"topic": "a_completed", "target_swarm": "opc", "min_quality_score": 0}],
    )
    drift = compute_drift(o, r)
    gaps = {(g["topic"], g["target_swarm"]) for g in drift["quality_gate_gaps"]}
    assert ("a_completed", "opc") in gaps
    assert drift["in_sync"] is False


def test_zero_gate_to_mandatory_archive_is_not_a_gap(tmp_path):
    """归档/审查目标的 0 门是故意的(必须存档/必须过工部),不算违规。"""
    assert {"shiguan_archive", "gongbu_review"} <= MANDATORY_ZERO_ALLOWLIST
    o, r = _write(
        tmp_path,
        ["x", "shiguan_archive", "gongbu_review"],
        ["x", "shiguan_archive", "gongbu_review"],
        [
            {"topic": "x_completed", "target_swarm": "shiguan_archive", "min_quality_score": 0},
            {"topic": "x_completed", "target_swarm": "gongbu_review", "min_quality_score": 0},
        ],
    )
    drift = compute_drift(o, r)
    assert drift["quality_gate_gaps"] == []
    assert drift["in_sync"] is True


def test_real_repo_is_in_sync_after_t3_fix():
    """修复后真实仓库必须 in_sync：registry 补齐 3 蜂群 + 数据链路空门已设阈值。"""
    drift = compute_drift()  # 默认读真实 config
    assert drift["only_in_orchestrator"] == set(), f"registry 缺登记：{drift['only_in_orchestrator']}"
    assert drift["only_in_registry"] == set(), f"orchestrator 缺注册：{drift['only_in_registry']}"
    assert drift["quality_gate_gaps"] == [], f"数据链路质门空门未修：{drift['quality_gate_gaps']}"
    assert drift["in_sync"] is True


def test_main_returns_zero_when_in_sync():
    assert main([]) == 0
