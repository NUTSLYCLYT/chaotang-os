#!/usr/bin/env python3
"""治理监控器 — 整改#2 凭良率收敛蜂群+治理层降级。

读取飞轮历史 + 独立评估日志，为每个蜂群计算良率，
更新 data/governance_state.json，并打印治理报告。

用法:
  python scripts/governance_monitor.py               # 检查所有注册蜂群
  python scripts/governance_monitor.py --swarm opc   # 只检查指定蜂群
  python scripts/governance_monitor.py --dry-run     # 只打印，不写入状态

良率规则(详见 src/governance.py):
  ACTIVE     良率 ≥ 70%、样本充足          → 无限制
  WATCH      良率 60-70% 或样本不足         → 仅警告
  DOWNGRADED 良率 40-60%                   → 下游触发门槛升至 4.0
  SUSPENDED  良率 < 40% 或不可逆风险错误   → 下游全部停用
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

_envf = ROOT / ".env"
if _envf.exists():
    for _line in _envf.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())


LEVEL_ICON = {
    "active": "✅",
    "watch": "⚠️ ",
    "downgraded": "🔽",
    "suspended": "⛔",
}


def _load_registered_swarms() -> list[str]:
    """从 swarm_orchestrator.yaml 读取已注册的蜂群 ID 列表。"""
    import yaml

    cfg_path = ROOT / "config" / "swarm_orchestrator.yaml"
    if not cfg_path.exists():
        return []
    with open(cfg_path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    return [s["id"] for s in cfg.get("swarms", [])]


def main() -> int:
    ap = argparse.ArgumentParser(description="蜂群治理监控器(整改#2)")
    ap.add_argument("--swarm", help="只检查指定蜂群 ID")
    ap.add_argument("--window", type=int, default=30, help="滑动窗口大小(默认30次)")
    ap.add_argument("--dry-run", action="store_true", help="只打印报告，不更新治理状态文件")
    ap.add_argument("--archive", action="store_true", help="状态变更后自动触发史馆归档")
    args = ap.parse_args()

    from src.governance import (
        GovernanceLevel,
        collect_scores,
        evaluate_swarm,
        load_governance_state,
        save_governance_state,
    )

    swarm_ids = [args.swarm] if args.swarm else _load_registered_swarms()
    if not swarm_ids:
        print("未找到任何注册蜂群，请检查 config/swarm_orchestrator.yaml")
        return 1

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    state = load_governance_state()
    updated: dict = {}

    print(f"\n{'蜂群治理报告':═^60}")
    print(f"{'蜂群':<22}{'样本':>5}{'良率':>8}{'等级':<12}{'说明'}")
    print("─" * 80)

    changed = False
    for swarm_id in swarm_ids:
        scores, irr_errors = collect_scores(swarm_id, window=args.window)
        rec = evaluate_swarm(swarm_id, scores, irr_errors, now_iso)
        updated[swarm_id] = rec

        icon = LEVEL_ICON.get(rec.level.value, "?")
        pct = f"{rec.pass_rate:.0%}" if rec.sample_count > 0 else "N/A"
        print(f"{swarm_id:<22}{rec.sample_count:>5}{pct:>8}  {icon} {rec.level.value:<10} {rec.reason}")

        old = state.get(swarm_id)
        if old is None or old.level != rec.level:
            changed = True

    print("─" * 80)

    # 统计
    levels = [r.level for r in updated.values()]
    suspended = levels.count(GovernanceLevel.SUSPENDED)
    downgraded = levels.count(GovernanceLevel.DOWNGRADED)
    watch = levels.count(GovernanceLevel.WATCH)
    active = levels.count(GovernanceLevel.ACTIVE)
    print(f"\n汇总: ✅ {active} ACTIVE · ⚠️  {watch} WATCH · 🔽 {downgraded} DOWNGRADED · ⛔ {suspended} SUSPENDED")

    if suspended:
        print(f"\n⛔ {suspended} 个蜂群 SUSPENDED — 其所有下游触发已被治理层禁用。")
        print("   修复路径: 提升提示词质量 → 积累到 ≥3 样本 → 良率 ≥40% → 重跑本脚本解禁。")
    if downgraded:
        print(f"\n🔽 {downgraded} 个蜂群 DOWNGRADED — 下游 binding 门槛自动升至 4.0。")

    if args.dry_run:
        print("\n[dry-run] 未写入治理状态文件。")
    else:
        state.update(updated)
        save_governance_state(state)
        if changed:
            print(f"\n治理状态已更新 → {ROOT / 'data' / 'governance_state.json'}")
            if args.archive:
                print("\n📜 触发史馆归档（治理状态变更）…")
                try:
                    from scripts.archive_manager import archive_governance_event

                    aid = archive_governance_event(dry_run=False)
                    if aid:
                        print(f"   史馆归档完成 → {aid}")
                except Exception as _ae:
                    print(f"   ⚠️ 史馆归档失败（非致命）: {_ae}")
        else:
            print("\n治理状态无变化，已覆写时间戳。")

    return 1 if suspended else 0


if __name__ == "__main__":
    sys.exit(main())
