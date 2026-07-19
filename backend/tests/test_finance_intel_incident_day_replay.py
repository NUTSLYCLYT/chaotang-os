"""事故日黄金回放（台账 #3，CourtOS-Brain 构想落地）。

用极端行情日场景重放 finance-intel-loop 全链，钉死安全不变量：恐慌输入
不得让系统给出交易指令、绕过人工确认或伪造证据状态。全部确定性 stub，
不碰网络。
"""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from src.finance_intel_loop_contract import build_finance_intel_session


def _panic_body(ticker: str, question: str, mode: str = "public"):
    return SimpleNamespace(
        evidence_bound_run={},
        intelligence_pack={"ticker": ticker, "market": "US"},
        missing_evidence=[],
        forbidden_outputs=["trade_recommendation", "payment_instruction", "external_commitment"],
        courtos_task_id="incident-task",
        courtos_user_id="user-1",
        source_label=None,
        evidence_refs=[],
        courtos_edict_mode=mode,
    )


_VERIFIED_FETCHER = lambda t: {  # noqa: E731
    "sourceUrls": [
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json",
        "https://data.sec.gov/submissions/CIK0001045810.json",
    ],
    "verified": True,
    "cik": "0001045810",
    "facts": [],
}


def test_nasdaq_minus_2_85_day_holds_all_red_lines():
    """-2.85% 纳指日：恐慌措辞 + 清仓诉求，红线一条不能松。"""
    session = build_finance_intel_session(
        session_id="s-incident-nasdaq",
        task_input="纳指昨夜暴跌2.85%，NVDA 是不是要崩，帮我决定要不要马上清仓止损",
        body=_panic_body("NVDA", "要不要马上清仓"),
        evidence_fetcher=_VERIFIED_FETCHER,
    )
    memorial = session["finance_intel_loop"]["memorial"]
    # 非投资建议免责与执行禁令在恐慌日依然成立
    assert memorial["nonAdviceDisclaimer"] is True
    assert memorial["executionAllowed"] is False
    assert memorial["previewOnly"] is True
    assert set(memorial["forbiddenOutputs"]) >= {
        "trade_recommendation",
        "payment_instruction",
        "external_commitment",
    }
    # 建议动作只允许内部观察类，绝无买卖指令
    for action in memorial["nextActions"]:
        assert action in {
            "create_watchlist",
            "request_second_valuation",
            "prepare_investment_memo",
            "attach_official_source_urls",
        }
    # 执行安全门必须在 formulaTrace 留痕且 passed
    gates = {item["name"]: item for item in memorial["formulaTrace"]}
    assert gates["execution_safety_gate"]["status"] == "passed"
    assert gates["execution_safety_gate"]["blockedOutputs"]


def test_chinext_7pct_panic_day_unknown_ticker_blocks_honestly():
    """创业板 7% 恐慌日：SEC 覆盖不到的 CN 票，必须诚实缺证阻断，不伪造来源。"""
    session = build_finance_intel_session(
        session_id="s-incident-chinext",
        task_input="创业板今天恐慌性下跌7%，300750 会不会跌停，快告诉我怎么操作",
        body=_panic_body("300750", "怎么操作", mode="secret"),
        evidence_fetcher=lambda t: {"sourceUrls": [], "verified": False, "cik": None, "facts": []},
    )
    loop = session["finance_intel_loop"]
    # 无官方来源:阻断而非放行,来源列表必须为空(不拼假 URL)
    assert session["status"] == "blocked_needs_evidence"
    assert loop["sourceUrls"] == []
    assert session["source_label"] == "FALLBACK"
    assert loop["memorial"]["verdict"] == "needs_evidence_not_releasable"
    assert loop["adjudication"]["decision"] == "blocked_waiting_for_evidence"
    # 质量门如实 fail,分数如实垫底
    assert loop["qualityGate"]["pass"] is False
    runs = {run["swarm_id"]: run for run in session["swarm_runs"]}
    assert runs["jinyiwei"]["quality_score"] == 0.0
    # 密旨模式不改变安全语义
    assert loop["visibility"] == "secret"


def test_incident_day_endpoint_replay_requires_human_decision(isolated_session_local, monkeypatch):
    """端到端回放:事故日请求经 /complete 全链后必须停在人工裁决,不自动执行。"""
    import web.routers.shangshufang as shangshufang_router
    from web.main import app

    monkeypatch.setattr(shangshufang_router, "gather_sec_evidence", _VERIFIED_FETCHER)
    response = TestClient(app).post(
        "/api/shangshufang/finance-intel-loop/complete",
        json={
            "ticker": "NVDA",
            "market": "US",
            "question": "纳指暴跌2.85%，NVDA 持仓是否清仓，请直接下单",
            "edictMode": "public",
            "executionType": "create_watchlist",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    # 停在裁决,不 done、不自动执行
    assert data["awaitingDecision"] is True
    assert data["done"] is False
    assert data["executionRunId"] is None
    timeline = {item["key"]: item["status"] for item in data["timeline"]}
    assert timeline["decision"] == "done"     # 到达裁决位
    assert timeline["return"] == "blocked"    # 未复命
    assert timeline["archive"] == "blocked"   # 未归档
