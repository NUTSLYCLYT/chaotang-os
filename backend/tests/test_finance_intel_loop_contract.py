from fastapi.testclient import TestClient


def test_swarm_run_accepts_finance_intel_loop_contract(tmp_path, monkeypatch):
    import web.routers.swarm as swarm_router
    import src.swarm_orchestrator as swarm_orchestrator
    from web.main import app

    monkeypatch.setattr(swarm_router, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(swarm_orchestrator, "SESSIONS_DIR", tmp_path)
    with TestClient(app) as client:
        response = client.post(
            "/api/swarm/run",
            json={
                "task_input": "Evaluate AAPL valuation using SEC sources only.",
                "entry_swarm": "finance",
                "courtos_task_id": "task_intel_contract",
                "courtos_departments": ["hu_bu"],
                "courtos_swarm_bundles": ["finance"],
                "source_label": "LIVE",
                "intelligence_pack_id": "jinyiwei_finance_aapl",
                "intelligence_pack": {
                    "ticker": "AAPL",
                    "sourceUrls": [
                        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
                        "https://data.sec.gov/submissions/CIK0000320193.json",
                    ],
                },
                "evidence_refs": ["intel_signal:intel_fin_aapl"],
                "missing_evidence": [],
                "forbidden_outputs": ["real_trade_order", "payment_instruction"],
                "evidence_bound_run": {
                    "entry_swarm": "finance",
                    "source_label": "LIVE",
                    "intelligence_pack_id": "jinyiwei_finance_aapl",
                    "intelligence_pack": {
                        "sourceUrls": [
                            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
                            "https://data.sec.gov/submissions/CIK0000320193.json",
                        ],
                    },
                    "missing_evidence": [],
                    "forbidden_outputs": ["real_trade_order", "payment_instruction"],
                },
            },
        )

        assert response.status_code == 202
        body = response.json()
        assert body["success"] is True
        assert body["entry_swarm"] == "finance"
        assert body["route_reason"] == "finance_intel_loop_contract"

        detail = client.get(f"/api/swarm/sessions/{body['session_id']}")
        assert detail.status_code == 200
        session = detail.json()
        assert session["status"] == "completed"
        assert session["release_gate"] == "clear"
        assert session["session_type"] == "finance_intel_loop"
        assert [step["id"] for step in session["finance_intel_loop"]["chain"]] == [
            "shangshufang_case",
            "jinyiwei_evidence",
            "hubu_memorial",
            "shangshufang_adjudication",
            "execution_report",
            "shiguan_archive",
        ]
        finance_run = next(run for run in session["swarm_runs"] if run["swarm_id"] == "finance")
        assert finance_run["final_output"]["memorial"]["department"] == "hu_bu"
        assert session["finance_intel_loop"]["sourceUrls"] == [
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
            "https://data.sec.gov/submissions/CIK0000320193.json",
        ]
        memorial = session["finance_intel_loop"]["memorial"]
        assert memorial["previewOnly"] is True
        assert memorial["executionAllowed"] is False
        assert memorial["sideEffects"] == "none"
        assert session["finance_intel_loop"]["adjudication"]["decision"] == "adopt_internal_action"
        assert session["finance_intel_loop"]["executionReport"]["sideEffects"] == "internal_only"
        assert session["finance_intel_loop"]["archive"]["status"] == "archived"


def test_swarm_run_auto_collects_sec_sources_for_public_edict(tmp_path, monkeypatch):
    import web.routers.swarm as swarm_router
    import src.swarm_orchestrator as swarm_orchestrator
    from web.main import app

    monkeypatch.setattr(swarm_router, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(swarm_orchestrator, "SESSIONS_DIR", tmp_path)
    with TestClient(app) as client:
        response = client.post(
            "/api/swarm/run",
            json={
                "task_input": "用 SEC 官方来源评估 AAPL 当前估值是否合理，只做内部观察，不给买卖建议。",
                "entry_swarm": "finance",
                "courtos_edict_mode": "public",
                "forbidden_outputs": ["real_trade_order", "payment_instruction"],
            },
        )

        assert response.status_code == 202
        detail = client.get(f"/api/swarm/sessions/{response.json()['session_id']}")
        session = detail.json()
        assert session["release_gate"] == "clear"
        loop = session["finance_intel_loop"]
        assert loop["ticker"] == "AAPL"
        assert loop["edictMode"] == "public"
        assert loop["jinyiweiEvidence"]["sourceUrls"] == [
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
            "https://data.sec.gov/submissions/CIK0000320193.json",
        ]
        assert loop["memorial"]["nonAdviceDisclaimer"] is True
        assert loop["chain"][-1]["status"] == "archived"


def test_swarm_run_marks_secret_edict_without_losing_public_sources(tmp_path, monkeypatch):
    import web.routers.swarm as swarm_router
    import src.swarm_orchestrator as swarm_orchestrator
    from web.main import app

    monkeypatch.setattr(swarm_router, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(swarm_orchestrator, "SESSIONS_DIR", tmp_path)
    with TestClient(app) as client:
        response = client.post(
            "/api/swarm/run",
            json={
                "task_input": "用 SEC 官方来源评估 MSFT 当前估值风险，只做内部观察，不给买卖建议。",
                "entry_swarm": "finance",
                "courtos_edict_mode": "secret",
                "forbidden_outputs": ["real_trade_order", "payment_instruction"],
            },
        )

        assert response.status_code == 202
        detail = client.get(f"/api/swarm/sessions/{response.json()['session_id']}")
        loop = detail.json()["finance_intel_loop"]
        assert loop["ticker"] == "MSFT"
        assert loop["edictMode"] == "secret"
        assert loop["visibility"] == "secret"
        assert loop["sourceUrls"] == [
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json",
            "https://data.sec.gov/submissions/CIK0000789019.json",
        ]


def test_finance_intel_loop_blocks_release_without_source_urls(tmp_path, monkeypatch):
    import web.routers.swarm as swarm_router
    import src.swarm_orchestrator as swarm_orchestrator
    from web.main import app

    monkeypatch.setattr(swarm_router, "SESSIONS_DIR", tmp_path)
    monkeypatch.setattr(swarm_orchestrator, "SESSIONS_DIR", tmp_path)
    with TestClient(app) as client:
        response = client.post(
            "/api/swarm/run",
            json={
                "task_input": "Evaluate AAPL valuation, but source pack is incomplete.",
                "entry_swarm": "finance",
                "courtos_task_id": "task_intel_missing_sources",
                "intelligence_pack": {"ticker": "AAPL"},
                "missing_evidence": ["official_sec_companyfacts_url"],
                "forbidden_outputs": ["real_trade_order", "payment_instruction"],
                "evidence_bound_run": {
                    "entry_swarm": "finance",
                    "source_label": "LIVE",
                    "intelligence_pack": {},
                    "missing_evidence": ["official_sec_companyfacts_url"],
                    "forbidden_outputs": ["real_trade_order", "payment_instruction"],
                },
            },
        )

        assert response.status_code == 202
        session_id = response.json()["session_id"]

        detail = client.get(f"/api/swarm/sessions/{session_id}")
        assert detail.status_code == 200
        session = detail.json()
        assert session["status"] == "blocked_needs_evidence"
        assert session["release_gate"] == "blocked"
        run = next(run for run in session["swarm_runs"] if run["swarm_id"] == "finance")
        assert run["qa_result"]["qa_result"] == "fail"
        assert run["qa_result"]["checks"]["source_urls_present"] is False
        memorial = session["finance_intel_loop"]["memorial"]
        assert memorial["riskLevel"] == "high"
        assert memorial["sourceUrls"] == []
        assert memorial["missingEvidence"] == ["official_sec_companyfacts_url"]
        assert "attach_official_source_urls" in memorial["nextActions"]
        loop = session["finance_intel_loop"]
        assert loop["adjudication"]["decision"] == "blocked_waiting_for_evidence"
        assert loop["executionReport"]["status"] == "blocked"
        assert loop["archive"]["status"] == "not_archived"
        assert loop["chain"][-1]["status"] == "blocked"


def test_hubu_computes_real_roi_and_payback():
    from src.finance_intel_loop_contract import compute_finance_metrics

    m = compute_finance_metrics({"financials": {"investment": 500000, "annualNetCashflow": 200000}}, {})
    assert m["computed"] is True
    assert m["roiPct"] == 40.0
    assert m["paybackMonths"] == 30.0
    assert m["verdict"] == "slow_payback"
    assert m["sensitivity"]["downside_minus20pct"]["paybackMonths"] == 37.5


def test_hubu_metrics_honest_when_no_numbers():
    from src.finance_intel_loop_contract import compute_finance_metrics

    m = compute_finance_metrics({"sourceUrls": ["https://x"]}, {})
    assert m["computed"] is False and "note" in m


def test_finance_session_carries_metrics_in_memorial():
    from types import SimpleNamespace
    from src.finance_intel_loop_contract import build_finance_intel_session

    session = build_finance_intel_session(
        session_id="s1",
        task_input="评估该项目投入产出",
        body=SimpleNamespace(
            entry_swarm="finance",
            intelligence_pack={
                "sourceUrls": ["https://data.sec.gov/x"],
                "financials": {"investment": 120000, "monthlyNetCashflow": 20000},
            },
            evidence_bound_run={},
        ),
    )
    metrics = session["finance_intel_loop"]["memorial"]["metrics"]
    assert metrics["computed"] is True and metrics["roiPct"] == 200.0
    assert session["finance_intel_loop"]["financeMetrics"]["paybackMonths"] == 6.0
