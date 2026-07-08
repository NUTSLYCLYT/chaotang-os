"""tests/test_hubu_cashflow_court_doc.py — 户部现金跑道 → court_doc 桥接(收编越界模块)。"""
from __future__ import annotations

from src import hubu_memorial_verdict as hm
from src.hubu_cashflow_runway_memorial import (
    CashRunwayMemorial,
    FinanceEvidencePack,
    MonthlyFlow,
    SourcedAmount,
    build_cashflow_runway_memorial,
)


def _mem(verdict: str, **kw) -> CashRunwayMemorial:
    base = dict(
        task_id="t1", verdict=verdict, headline="现金跑道核算", currency="元",
        cash_on_hand=1_000_000.0, runway_months=6.0, runway_low=5.0, runway_high=7.0,
        runway_precision="rough", money_stuck={}, next_month_forecast={},
        perspectives=[], missing_evidence=[], risks=[], human_review_required=False,
        source_label="internal_uploaded_file", source_coverage_pct=0.9,
    )
    base.update(kw)
    return CashRunwayMemorial(**base)


def test_healthy_to_green_grounded():
    doc = hm.cashflow_to_court_doc(_mem("healthy"), archive=False)
    assert doc["dept"] == "hubu" and doc["doc_type"] == "memorial"
    assert doc["light"] == "green"
    assert doc["seal"]["stamp"] == "算盘印"
    assert doc["provenance"]["grounding"] == "deterministic"


def test_critical_to_red():
    assert hm.cashflow_to_court_doc(_mem("critical"), archive=False)["light"] == "red"


def test_needs_evidence_blocks_fake_pass():
    doc = hm.cashflow_to_court_doc(_mem("needs_evidence"), archive=False)
    assert doc["provenance"]["gate"] == "pending"
    assert doc["provenance"]["deterministic_gated"] is False
    assert "需补现金证据" in doc["headline"]


def test_shielded_present():
    doc = hm.cashflow_to_court_doc(_mem("watch"), archive=False)
    assert "现金跑道" in (doc["shielded"] or "")
    assert doc["light"] == "yellow"


# ── 被收编引擎本体冒烟(确定性计算真跑)──────────────────────────────────────

def test_engine_returns_valid_verdict():
    pack = FinanceEvidencePack(
        task_id="smoke", cash=SourcedAmount(2_000_000.0, "internal_uploaded_file"),
        monthly_flows=[MonthlyFlow("2026-05", 500_000.0, 400_000.0),
                       MonthlyFlow("2026-06", 500_000.0, 400_000.0)],
    )
    m = build_cashflow_runway_memorial(pack)
    assert m.verdict in ("healthy", "watch", "critical", "needs_evidence")
    assert isinstance(m.headline, str) and m.preview_only is True


def test_engine_to_court_doc_end_to_end():
    pack = FinanceEvidencePack(task_id="e2e")  # 空证据
    doc = hm.run_cashflow_court_doc(pack, archive=False)
    assert doc["dept"] == "hubu" and doc["doc_type"] == "memorial"
    assert doc["light"] in ("green", "yellow", "red", "black")


def test_advisors_match_dept_design_doc():
    """docs/dept_design/hubu.md §三:财务分支判官(ben-graham/deming)+ 5 位顾问。
    这轮才补上(此前 provenance.advisors 一直是空的,审计追不到"设计上该谁看")。
    """
    doc = hm.cashflow_to_court_doc(_mem("healthy"), archive=False)
    assert doc["provenance"]["advisors"] == [
        "ben-graham", "deming", "drucker", "taleb-perspective",
        "dalio-perspective", "howard-marks-perspective", "duan-yongping",
    ]
