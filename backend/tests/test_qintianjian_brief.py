"""tests/test_qintianjian_brief.py — SEALED_BRIEF 落地存储(复用 truth_ledger)。"""

from __future__ import annotations

import json

from src import qintianjian_brief as qb
from src import truth_ledger


def test_seal_brief_writes_to_truth_ledger(tmp_path, monkeypatch):
    monkeypatch.setattr(truth_ledger, "LEDGER", tmp_path / "truth_ledger.jsonl")

    brief = qb.seal_brief(
        "要不要接这个储能项目",
        must_decide_now=[{"question": "现金流够不够", "recommended_option": "A"}],
        defer=["组织排期"],
        personas=["taleb-perspective", "munger-perspective"],
        human_signoff_required=True,
        execution_boundary="只做方案核查,不签合同",
        target_swarm="hubu_finance_swarm",
        case_id="QTJ-test-001",
    )

    assert brief["status"] == "SEALED_BRIEF"
    assert brief["human_signoff_required"] is True
    assert brief["archive_hash"]

    lines = truth_ledger.LEDGER.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry["checker"] == "qintianjian_brief"
    assert entry["verdict"] == "signoff_pending"
    assert entry["provenance"] == "qintianjian_protocol"


def test_seal_brief_without_signoff_uses_sealed_verdict(tmp_path, monkeypatch):
    monkeypatch.setattr(truth_ledger, "LEDGER", tmp_path / "truth_ledger.jsonl")

    qb.seal_brief(
        "小改动要不要发布",
        must_decide_now=[],
        target_swarm="bingbu_strategy_swarm",
        case_id="QTJ-test-002",
    )
    entry = json.loads(truth_ledger.LEDGER.read_text(encoding="utf-8").splitlines()[0])
    assert entry["verdict"] == "sealed"


def test_latest_brief_for_found(tmp_path, monkeypatch):
    monkeypatch.setattr(truth_ledger, "LEDGER", tmp_path / "truth_ledger.jsonl")

    qb.seal_brief(
        "小改动要不要发布",
        must_decide_now=[],
        target_swarm="bingbu_strategy_swarm",
        case_id="QTJ-test-002",
    )
    found = qb.latest_brief_for("bingbu_strategy_swarm", "QTJ-test-002")
    assert found is not None
    assert found["checker"] == "qintianjian_brief"


def test_latest_brief_for_not_found(tmp_path, monkeypatch):
    monkeypatch.setattr(truth_ledger, "LEDGER", tmp_path / "truth_ledger.jsonl")
    assert qb.latest_brief_for("hubu_finance_swarm", "no-such-case") is None


def test_check_outcome_computes_brier_score(tmp_path, monkeypatch):
    monkeypatch.setattr(truth_ledger, "LEDGER", tmp_path / "truth_ledger.jsonl")
    entry = qb.check_outcome(
        "tianjian",
        "QTJ-test-003",
        predicted_probability=0.6,
        actual_outcome=1.0,
    )
    assert entry["checker"] == "qintianjian_calibration"
    assert abs(entry["score"] - 0.16) < 1e-9  # (0.6-1.0)**2
