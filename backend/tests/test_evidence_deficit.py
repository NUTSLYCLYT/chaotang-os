"""缺证率北极星 · 回归门(2026-07-08)。

钉死:率与按司分解正确、空账本说没数据不编 0、日快照带 Δ、一行人话含最大贡献司。
"""

from datetime import datetime, timedelta, timezone

import pytest

import src.tenant as T
from src import evidence_deficit as ed


@pytest.fixture()
def tenant_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("t_ns"):
        yield tmp_path


_SEQ = {"n": 0}


def _seed(rows: list[tuple[str, str]]):
    from src.truth_ledger import record

    base = datetime.now(timezone.utc) - timedelta(hours=len(rows))
    for i, (swarm, verdict) in enumerate(rows):
        _SEQ["n"] += 1  # 全局唯一 case_id,防 truth_ledger 幂等哈希吞掉同内容种子
        record(
            swarm=swarm,
            checker="quotation_real_score",
            verdict=verdict,
            case_id=f"c{_SEQ['n']}",
            evidence=f"e{i}",
            ts=(base + timedelta(hours=i)).isoformat(),
        )


def test_snapshot_rate_and_offender(tenant_tmp):
    _seed(
        [
            ("quotation", "green"),
            ("qintianjian", "yellow"),
            ("qintianjian", "yellow"),
            ("legal", "UNKNOWN"),
            ("quotation", "red"),
        ]
    )
    snap = ed.snapshot()
    assert snap["judged"] == 5 and snap["deficit"] == 3
    assert snap["rate"] == 0.6
    # 会审(Deming):按司分解带分母;top_offender 要求 judged>=5,样本不足不点名(防噪声)
    assert snap["by_swarm"]["qintianjian"] == {"deficit": 2, "judged": 2, "rate": 1.0}
    assert snap["by_swarm"]["legal"] == {"deficit": 1, "judged": 1, "rate": 1.0}
    assert snap["top_offender"] is None

    _seed([("qintianjian", "green")] * 3)  # qintianjian 凑满5判 → 2/5=0.4,可点名
    snap2 = ed.snapshot()
    assert snap2["top_offender"] == "qintianjian"
    assert snap2["by_swarm"]["qintianjian"]["rate"] == 0.4


def test_empty_ledger_says_no_data(tenant_tmp):
    snap = ed.snapshot()
    assert snap["rate"] is None
    assert "无判定记录" in ed.summary_line(snap)


def test_daily_history_delta(tenant_tmp):
    _seed([("q", "yellow"), ("q", "green")])  # 50%
    first = ed.record_daily()
    assert first["delta_pp"] is None, "首条无前值不编 Δ"
    _seed([("q", "green"), ("q", "green"), ("q", "green")])  # 累计5条:20%,过最小样本可点名
    second = ed.record_daily()
    assert second["rate"] == 0.2
    assert second["delta_pp"] == -30.0
    line = ed.summary_line(second)
    assert "20%" in line and "↓30.0pp" in line and "最大贡献:q(1/5)" in line
