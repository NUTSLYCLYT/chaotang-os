"""缺证率北极星(2026-07-08 · 用户拍板盯两周)。

北极星定义:truth_ledger 近窗判定里"缺凭据/有保留"(yellow/UNKNOWN)的占比。
它度量的是**确定性门的覆盖面**——每给某个司补一条真凭据链路,这个数就该掉。

本模块三件事,纯读账本不调 LLM:
- snapshot():当前缺证率 + 按司分解(谁贡献的黄灯/盲判最多=下一个该补凭据的司)。
- record_daily():快照落 history.jsonl(append-only)+ 与上一条比 Δ——趋势不靠记忆。
- summary_line():一行人话,给 cron 推 Telegram 用。
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from src.qintianjian_signals import _norm_verdict, _truth_rows

logger = logging.getLogger(__name__)

WINDOW_DAYS = 30  # 会审(Deming):按天不按条——"最近30条"可被一批便宜检查把旧行挤出窗口刷分
MIN_JUDGED_FOR_OFFENDER = 5  # 3判3黄(100%)比20判5黄(25%)更该被点名,但样本<5不点名(防噪声)


def _history_path() -> Path:
    from src.tenant import get_tenant_data_dir

    return get_tenant_data_dir("eval") / "evidence_deficit_history.jsonl"


def snapshot(window_days: int = WINDOW_DAYS) -> dict[str, Any]:
    """当前缺证率 + 按司分解(带分母的率)。judged=0 时 rate=None(没数据就说没数据)。

    会审(Deming)三处修:①窗口按天(刷一批便宜绿检查挤不掉旧行);②按司分解带分母
    (rate 排序,忙司不因绝对数背锅、小司不因分母小隐身);③top_offender 要求最小样本。
    """
    from datetime import timedelta

    cutoff = (datetime.now().astimezone() - timedelta(days=window_days)).isoformat()
    recent = [r for r in _truth_rows() if str(r.get("ts", "")) >= cutoff]
    deficit_rows = [r for r in recent if _norm_verdict(r) in ("blind", "reserved")]
    by_swarm: dict[str, dict[str, Any]] = {}
    for r in recent:
        sw = r.get("swarm", "?") or "?"
        b = by_swarm.setdefault(sw, {"deficit": 0, "judged": 0})
        b["judged"] += 1
        if _norm_verdict(r) in ("blind", "reserved"):
            b["deficit"] += 1
    for b in by_swarm.values():
        b["rate"] = round(b["deficit"] / b["judged"], 4) if b["judged"] else None
    eligible = [
        (sw, b) for sw, b in by_swarm.items() if b["judged"] >= MIN_JUDGED_FOR_OFFENDER
    ]
    top = sorted(eligible, key=lambda kv: -(kv[1]["rate"] or 0))
    return {
        "ts": datetime.now().astimezone().isoformat(),
        "window_days": window_days,
        "judged": len(recent),
        "deficit": len(deficit_rows),
        "rate": round(len(deficit_rows) / len(recent), 4) if recent else None,
        "by_swarm": by_swarm,
        "top_offender": top[0][0] if top else None,
    }


def record_daily(window_days: int = WINDOW_DAYS) -> dict[str, Any]:
    """落一条日快照,并带上与上一条的 Δ(百分点)。同日重跑照记(append-only,读端取末条即可)。"""
    snap = snapshot(window_days)
    prev_rate = None
    path = _history_path()
    if path.exists():
        lines = [x for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
        if lines:
            try:
                prev_rate = json.loads(lines[-1]).get("rate")
            except json.JSONDecodeError:
                prev_rate = None
    snap["delta_pp"] = (
        round((snap["rate"] - prev_rate) * 100, 1)
        if snap["rate"] is not None and prev_rate is not None
        else None
    )
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(snap, ensure_ascii=False) + "\n")
    return snap


def summary_line(snap: dict[str, Any]) -> str:
    """一行人话:率 + 最大贡献司 + 昨日 Δ。"""
    if snap.get("rate") is None:
        return "缺证率:账本无判定记录(窗口空)"
    pct = round(snap["rate"] * 100)
    line = f"缺证率 {pct}%({snap['deficit']}/{snap['judged']})"
    if snap.get("top_offender"):
        b = snap["by_swarm"][snap["top_offender"]]
        line += f" · 最大贡献:{snap['top_offender']}({b['deficit']}/{b['judged']})"
    if snap.get("delta_pp") is not None:
        arrow = "↓" if snap["delta_pp"] < 0 else ("↑" if snap["delta_pp"] > 0 else "→")
        line += f" · 较上次 {arrow}{abs(snap['delta_pp'])}pp"
    return line


if __name__ == "__main__":
    s = record_daily()
    print(summary_line(s))
