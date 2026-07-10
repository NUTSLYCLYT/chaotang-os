from fastapi.testclient import TestClient
from uuid import uuid4

from src.tenant import create_invite
from web.main import app
from web.routers import court_compat
from web.schemas.auth import CurrentUser


def test_verify_invite_accepts_real_unconsumed_code():
    code = f"P0-{uuid4().hex[:12]}"
    create_invite(code, max_uses=1)
    response = TestClient(app).post("/api/auth/verify-invite", json={"code": f" {code} "})

    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_verify_invite_rejects_unknown_code():
    response = TestClient(app).post("/api/auth/verify-invite", json={"code": "not-real"})

    assert response.status_code == 403
    assert response.json()["detail"]["valid"] is False


def test_court_backend_task_detail_returns_legacy_shape(monkeypatch):
    def fake_task_detail(task_id, user):
        assert task_id == "task-1"
        assert user.user_id == 1
        return {
            "success": True,
            "data": {
                "task": {
                    "id": "task-1",
                    "title": "测试任务",
                    "status": "report_ready",
                    "createdAt": "2026-07-09T00:00:00Z",
                    "updatedAt": "2026-07-09T00:01:00Z",
                    "finalReportId": "run-1",
                    "result": {"summary": "ok"},
                },
                "council": [{"agentCode": "hubu"}],
                "groupRuns": [{"groupId": "pack"}],
                "runId": "run-1",
            },
        }

    monkeypatch.setattr(court_compat, "task_detail", fake_task_detail)

    response = court_compat.backend_task_detail(
        "task-1",
        CurrentUser(user_id=1, username="tester", tenant_slug="default", role="user"),
    )

    assert response["task"]["id"] == "task-1"
    assert response["runs"][0]["id"] == "run-1"
    assert response["report"]["council"][0]["agentCode"] == "hubu"


def test_court_backend_task_detail_404s_missing(monkeypatch):
    monkeypatch.setattr(
        court_compat,
        "task_detail",
        lambda task_id, user: {"success": False, "error": "task missing"},
    )

    try:
        court_compat.backend_task_detail(
            "missing",
            CurrentUser(user_id=1, username="tester", tenant_slug="default", role="user"),
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("missing task must raise 404")


def test_prompt_suggest_contract_returns_existing_frontend_shape():
    response = TestClient(app).post("/api/prompt/suggest", json={"input": "户部分析预算"})

    assert response.status_code == 200
    data = response.json()
    suggestion = data["suggestions"]
    assert suggestion["suggestions"]["fast"]["mode"] == "fast"
    assert suggestion["recommended"] in {"fast", "standard", "deep"}


def test_orchestration_run_contract_streams_stage_events():
    with TestClient(app).stream(
        "POST",
        "/api/orchestration/run",
        json={"command": "请三省审议预算"},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: stage_start" in body
    assert "event: pipeline_done" in body
    assert '"sourceLabel": "FALLBACK"' in body


def test_qintian_chat_contract_streams_fallback_tokens():
    with TestClient(app).stream(
        "POST",
        "/api/qintian/chat",
        json={"message": "预测 AI 采纳率", "scenarioContext": None},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert '"token"' in body
    assert '"sourceLabel": "FALLBACK"' in body


def test_intel_dispatch_contract_registers_backend_task():
    response = TestClient(app).post(
        "/api/court/intel/signals/signal-1/dispatch",
        json={"targetAgents": ["hu_bu"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["taskId"].startswith("intel-signal-1-")


def test_dept_swarm_dispatch_contract_is_honest_fallback():
    response = TestClient(app).post(
        "/api/court/dept/swarm-dispatch",
        json={"deptCode": "hu_bu", "question": "核算现金流"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["sourceLabel"] == "FALLBACK"
    assert body["verified"] is False


def test_frontend_metric_ingest_accepts_fire_and_forget_event():
    response = TestClient(app).post(
        "/api/metrics",
        json={"name": "page_load", "route": "/dadian", "durationMs": 12, "ts": 1},
    )

    assert response.status_code == 200
    assert response.json()["data"]["accepted"] is True


def test_junjichu_cases_contract_returns_case_file():
    response = TestClient(app).post(
        "/api/court/junjichu/cases",
        json={"command": "请军机处评估这个报价是否值得推进"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["case"]["taskId"].startswith("junjichu-")
    assert body["data"]["case"]["sourceLabel"] == "MIXED"


def test_bureau_action_contract_returns_structured_error_not_404():
    response = TestClient(app).post(
        "/api/court/bureaus/hu_bu/accounting/actions",
        json={"viewId": "v1", "action": "archive", "intent": "archive"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["error"] == "bureau_action_requires_backend_view_model"


def test_court_orchestrate_contract_returns_legacy_shape():
    response = TestClient(app).post("/api/court/orchestrate", json={"command": "核算预算"})

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["taskId"].startswith("court-orch-")
    assert body["merge"]["grounded"] is False


def test_court_orchestrate_all_contract_returns_swarm_receipt_shape():
    response = TestClient(app).post(
        "/api/court/orchestrate/all",
        json={"command": "密旨评估", "mode": "secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["secret"] is True
    assert body["jiqunSwarm"]["ok"] is False


def test_court_sign_off_contract_returns_hash():
    response = TestClient(app).post(
        "/api/court/orchestrate/sign-off",
        json={"decisionId": 1, "action": "signed", "chosenDept": "hu_bu"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["outcomeHash"].startswith("compat-")


def test_zhuangyuan_ministry_metrics_contract_returns_envelope():
    response = TestClient(app).get("/api/court/zhuangyuan/ministry-metrics")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["hu_bu"]["sourceLabel"] == "FALLBACK"


def test_governance_bill_lifecycle_contract():
    client = TestClient(app)
    created = client.post("/api/governance/bills", json={"command": "请中书起草预算案"}).json()

    assert created["id"].startswith("bill-")
    listed = client.get("/api/governance/bills").json()
    assert listed["count"] >= 1

    transitioned = client.post(
        f"/api/governance/bills/{created['id']}/transition",
        json={"type": "submit_to_review", "actor": "zhongshu", "reason": "送审"},
    ).json()
    assert transitioned["state"] == "under_review"

    audit = client.get(f"/api/governance/bills/{created['id']}/audit").json()
    assert audit["ok"] is True


def test_governance_deliberate_contract_returns_fallback_header():
    response = TestClient(app).post(
        "/api/governance/deliberate",
        json={"command": "请三省审议预算", "constitutions": []},
    )

    assert response.status_code == 200
    assert response.headers["X-Upstream"] == "fallback"
    assert response.json()["finalVerdict"] == "再议"


def test_scribe_and_shiguan_contracts_return_empty_backend_states():
    client = TestClient(app)

    annal = client.post(
        "/api/scribe/annals",
        json={"period": "2026-07-W2", "events": [{"id": "e1"}]},
    ).json()
    assert annal["sourceEventIds"] == ["e1"]

    assert client.get("/api/scribe/lessons").json()["data"]["lessons"] == []
    assert client.post("/api/court/shiguan/analyze").json()["citations"] == []
    assert client.get("/api/court/shiguan/release-gates").json()["success"] is True
    assert client.get("/api/court/shiguan/promo-archive").json()["success"] is True
    retrospective = client.post(
        "/api/shiguan/archives/archive-1/retrospective",
        json={"retrospective_status": "达成"},
    ).json()
    assert retrospective["data"]["archiveId"] == "archive-1"


def test_ima_knowledge_patch_and_list_contract():
    client = TestClient(app)
    filename = f"doc-{uuid4().hex[:12]}.md"
    uploaded = client.post(
        "/api/court/ima-knowledge",
        json={"filename": filename, "content": "contract evidence"},
    ).json()
    assert uploaded["data"]["document"]["id"] == filename

    patched = client.patch(
        "/api/court/ima-knowledge",
        json={"id": filename, "status": "archived"},
    ).json()

    assert patched["data"]["document"]["id"] == filename
    listed = client.get("/api/court/ima-knowledge?limit=20").json()
    assert listed["success"] is True
    assert any(document["id"] == filename for document in listed["data"]["documents"])


def test_medical_chat_contract_streams_sse_tokens():
    with TestClient(app).stream("POST", "/api/chat", json={"message": "LDL 偏高"}) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "data:" in body
    assert "FALLBACK" in body


def test_true_chain_health_contract_returns_honest_degraded_status():
    response = TestClient(app).get("/api/court/true-chain-health")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["sourceLabel"] == "FALLBACK"


def test_manor_stream_contract_emits_open_fallback_eof():
    with TestClient(app).stream("POST", "/api/manor/stream", json={"domain": "legal"}) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: open" in body
    assert "event: fallback" in body
    assert "event: eof" in body
