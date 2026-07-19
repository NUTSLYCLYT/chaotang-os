"""finance-intel-loop 诚实标测试：LIVE 只属于真验证过的取证。"""

import json
from types import SimpleNamespace

from src.finance_intel_loop_contract import build_finance_intel_session


def _body(ticker="NVDA", source_label=None, pack_extra=None):
    pack = {"ticker": ticker, "market": "US"}
    if pack_extra:
        pack.update(pack_extra)
    return SimpleNamespace(
        evidence_bound_run={},
        intelligence_pack=pack,
        missing_evidence=[],
        forbidden_outputs=["trade_recommendation"],
        courtos_task_id="task-1",
        courtos_user_id="user-1",
        source_label=source_label,
        evidence_refs=[],
        courtos_edict_mode="public",
    )


def test_verified_fetch_labels_live():
    session = build_finance_intel_session(
        session_id="s-live",
        task_input="NVDA SEC 风险",
        body=_body(),
        evidence_fetcher=lambda t: {
            "sourceUrls": [
                "https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json",
                "https://data.sec.gov/submissions/CIK0001045810.json",
            ],
            "verified": True,
            "cik": "0001045810",
        },
    )
    loop = session["finance_intel_loop"]
    assert session["source_label"] == "LIVE"
    assert loop["evidenceVerified"] is True
    assert loop["qualityGate"]["checks"]["official_sources_verified"] is True
    assert loop["jinyiweiEvidence"]["verified"] is True
    assert "LIVE_SWARM" not in json.dumps(session)


def test_unverified_template_labels_fallback():
    session = build_finance_intel_session(
        session_id="s-tpl",
        task_input="AAPL SEC 风险",
        body=_body(ticker="AAPL"),
        evidence_fetcher=None,
    )
    loop = session["finance_intel_loop"]
    assert session["source_label"] == "FALLBACK"
    assert loop["evidenceVerified"] is False
    assert loop["qualityGate"]["checks"]["official_sources_verified"] is False
    assert loop["sourceUrls"]  # 模板 URL 仍保留，链条形态不回退


def test_fetch_failure_degrades_honestly():
    session = build_finance_intel_session(
        session_id="s-fail",
        task_input="AAPL SEC 风险",
        body=_body(ticker="AAPL"),
        evidence_fetcher=lambda t: {
            "sourceUrls": [
                "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
            ],
            "verified": False,
            "cik": "0000320193",
        },
    )
    assert session["source_label"] == "FALLBACK"
    assert session["finance_intel_loop"]["evidenceVerified"] is False


def test_user_supplied_urls_keep_request_label():
    session = build_finance_intel_session(
        session_id="s-user",
        task_input="NVDA SEC 风险",
        body=_body(
            source_label="LIVE",
            pack_extra={"sourceUrls": ["https://example.com/evidence.pdf"]},
        ),
        evidence_fetcher=lambda t: (_ for _ in ()).throw(AssertionError("不应调用 fetcher")),
    )
    loop = session["finance_intel_loop"]
    assert session["source_label"] == "LIVE"
    assert loop["evidenceVerified"] is False
    assert loop["qualityGate"]["checks"]["official_sources_verified"] is False
