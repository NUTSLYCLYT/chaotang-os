"""翰林院 P9 最小真源读模型回归门(2026-07-14)。

钉死:experiments/overview 从 truth_ledger 读真实判定;账本空时保持诚实 FALLBACK,
不编造数据。
"""

import json

from fastapi.testclient import TestClient

from web.main import app


def _seed_ledger(tmp_path, monkeypatch, entries):
    import src.truth_ledger as tl

    path = tmp_path / "truth_ledger.jsonl"
    path.write_text(
        "\n".join(json.dumps(e, ensure_ascii=False) for e in entries) + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(tl, "_ledger_path", lambda: path)
    return path


def _entry(h, verdict="PASS", provenance="authenticated"):
    return {
        "hash": h * 12,
        "ts": "2026-07-14T12:00:00+00:00",
        "swarm": "xingbu",
        "checker": "grounding",
        "deterministic": True,
        "provenance": provenance,
        "case_id": "case_1",
        "verdict": verdict,
        "score": None,
        "detail": "",
        "evidence": "",
    }


def test_experiments_read_truth_ledger(tmp_path, monkeypatch):
    _seed_ledger(tmp_path, monkeypatch, [_entry("a"), _entry("b", verdict="FAIL")])
    r = TestClient(app).get("/api/hanlin/experiments").json()
    assert r["source"] == "TRUTH_LEDGER"
    assert len(r["experiments"]) == 2
    exp = r["experiments"][0]
    assert exp["name"] == "xingbu/grounding"
    assert exp["verdict"] in ("PASS", "FAIL")
    assert exp["provenance"] == "authenticated"


def test_overview_carries_ledger_health(tmp_path, monkeypatch):
    _seed_ledger(tmp_path, monkeypatch, [_entry("a")])
    r = TestClient(app).get("/api/hanlin/overview").json()
    ov = r["overview"]
    assert ov["sourceLabel"] == "TRUTH_LEDGER"
    assert ov["truthLedger"]["total_entries"] == 1
    # 奖项等无产品数据字段仍保持诚实零值
    assert ov["summary"]["queuedAwards"] == 0


def test_corrupted_ledger_line_falls_back_not_500(tmp_path, monkeypatch):
    import src.truth_ledger as tl

    path = tmp_path / "truth_ledger.jsonl"
    path.write_text('{"hash": "ok"...malformed\n', encoding="utf-8")
    monkeypatch.setattr(tl, "_ledger_path", lambda: path)
    r = TestClient(app).get("/api/hanlin/experiments")
    assert r.status_code == 200
    assert r.json() == {"experiments": [], "source": "FALLBACK"}


def test_empty_ledger_stays_honest_fallback(tmp_path, monkeypatch):
    import src.truth_ledger as tl

    monkeypatch.setattr(tl, "_ledger_path", lambda: tmp_path / "missing.jsonl")
    c = TestClient(app)
    exp = c.get("/api/hanlin/experiments").json()
    assert exp == {"experiments": [], "source": "FALLBACK"}
    ov = c.get("/api/hanlin/overview").json()["overview"]
    assert ov["sourceLabel"] == "FALLBACK" and ov["truthLedger"] is None
