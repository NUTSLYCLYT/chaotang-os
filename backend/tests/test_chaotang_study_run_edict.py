from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from web.deps import get_current_user
from web.schemas.auth import CurrentUser


def _test_user() -> CurrentUser:
    return CurrentUser(user_id=1, username="ops", role="admin", tenant_slug="default")


@pytest.fixture()
def client():
    from web.main import app

    app.dependency_overrides[get_current_user] = _test_user
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _memorial(
    run_id: str,
    *,
    dept: str = "finance",
    title: str = "冷库储能报价是否可推进",
    summary: str = "客户有 100MWh 冷库储能意向，但报价和交期需要人工签字。",
    priority: str = "high",
    risk: str = "medium",
    status: str = "pending",
) -> dict:
    return {
        "id": run_id,
        "title": title,
        "sourceDepartment": dept,
        "agentCode": "hu_bu",
        "priority": priority,
        "riskLevel": risk,
        "status": status,
        "summary": summary,
        "createdAt": "2026-06-07T00:00:00",
        "suggestedAction": "准奏推进到军机处",
        "qualityScore": 4.2,
        "grade": "B",
    }


def test_study_run_returns_decision_ready_edict(client, monkeypatch):
    import web.routers.throne as throne_mod

    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [
            _memorial("run_100mwh"),
            _memorial(
                "run_legal",
                dept="legal",
                title="本司材料对外发布合规风险",
                summary="华为生态和 2026 收入预测口径需要补证。",
                risk="high",
            ),
        ],
    )
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    response = client.post(
        "/api/chaotang/study/run",
        json={"command": "帮我判断今天最该推进的客户事项", "mode": "dry_run"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    edict = body["data"]["edict"]

    assert edict["run_id"].startswith("study-dry-")
    assert edict["verdict"] in {"准奏", "需补证", "需人工复核", "驳回"}
    assert edict["summary"]
    assert edict["quality_gate"]["status"] in {"passed", "needs_review", "blocked"}
    assert edict["source_mode"] == "MIXED"

    assert len(edict["departments"]) >= 2
    assert {d["dept"] for d in edict["departments"]} >= {"finance", "legal"}
    assert all(d["opinion"] for d in edict["departments"])

    assert len(edict["evidence"]) >= 3
    assert all("label" in item and "value" in item for item in edict["evidence"])
    assert edict["risks"], "high/medium risk memorials should become edict risks"
    assert edict["next_actions"][0]["type"] in {"approve", "request_evidence", "ask_oracle"}


def test_study_run_without_memorials_still_returns_minimum_action(client, monkeypatch):
    import web.routers.throne as throne_mod

    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [])
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    response = client.post(
        "/api/chaotang/study/run",
        json={"command": "今天从哪里开始", "mode": "dry_run"},
    )

    assert response.status_code == 200
    edict = response.json()["data"]["edict"]
    assert edict["verdict"] == "需补证"
    assert edict["departments"][0]["dept"] == "prime_minister"
    assert edict["next_actions"][0]["type"] == "request_evidence"


def test_study_run_live_uses_swarm_adapter_and_exports_quality_gate(client, monkeypatch):
    import web.routers.chaotang as chaotang_mod
    import web.routers.throne as throne_mod

    class FakeSwarmDef:
        def __init__(self, name: str, config_path: str, qa_version: str = "v3"):
            self.name = name
            self.config_path = config_path
            self.qa_version = qa_version

    class FakeBinding:
        topic = "ai_ops_completed"
        target_swarm = "shiguan_archive"
        transform = "auto"
        min_quality_score = 7.0
        enabled = True

    class FakeSession:
        session_id = "study-live-session"
        status = "completed"
        swarm_runs = [
            type(
                "Run",
                (),
                {
                    "swarm_id": "ai_ops",
                    "run_id": "run-ai-ops-live",
                    "status": "completed",
                    "quality_score": 8.1,
                    "qa_result": {"qa_result": "pass"},
                },
            )()
        ]

    class FakeOrchestrator:
        def __init__(self, config_path: str, provider=None):
            self.config_path = config_path
            self.provider = provider
            self.swarms = {"ai_ops": FakeSwarmDef("AI运维元蜂群", "config/flow_ai_ops.yaml")}
            self.bindings = [FakeBinding()]

        def run(self, **kwargs):
            assert kwargs["task_input"] == "真实巡检 AI Ops 质量"
            assert kwargs["entry_swarm"] == "ai_ops"
            assert kwargs["session_id"].startswith("study-live-")
            return FakeSession()

    monkeypatch.setattr(chaotang_mod, "SwarmOrchestrator", FakeOrchestrator)
    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [_memorial("run_ai_ops", dept="ops")])
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    response = client.post(
        "/api/chaotang/study/run",
        json={"command": "真实巡检 AI Ops 质量", "mode": "live", "taskId": "run_ai_ops", "entrySwarm": "ai_ops"},
    )

    assert response.status_code == 200
    edict = response.json()["data"]["edict"]
    assert edict["source_mode"] == "LIVE_SWARM"
    assert edict["run_adapter"]["name"] == "swarm_orchestrator"
    assert edict["run_adapter"]["session_id"] == "study-live-session"
    assert edict["run_adapter"]["entry_swarm"] == "ai_ops"
    assert edict["run_adapter"]["replay_artifact"]["api_path"] == "/api/swarm/sessions/study-live-session"
    assert edict["run_adapter"]["replay_artifact"]["path"].endswith("swarm_sessions/study-live-session.json")
    assert edict["run_adapter"]["replay_artifact"]["owner"] == "shiguan"
    assert edict["quality_gate"]["status"] == "passed"
    assert edict["quality_gate"]["score"] == 0.81
    assert edict["quality_gate"]["config"]["entry_swarm"] == {
        "id": "ai_ops",
        "name": "AI运维元蜂群",
        "config": "config/flow_ai_ops.yaml",
        "qa_version": "v3",
    }
    assert edict["quality_gate"]["config"]["bindings"][0]["min_quality_score"] == 7.0
    assert any(item["source"] == "swarm_orchestrator" for item in edict["evidence"])
    assert any(item["source"] == "swarm_replay_artifact" for item in edict["evidence"])


def test_study_run_live_records_orchestration_tier(client, monkeypatch):
    """§8 入口层:LIVE 圣旨必须带 orchestration{tier,value_thesis,reason},编排决策可观测。"""
    import web.routers.chaotang as chaotang_mod
    import web.routers.throne as throne_mod

    class FakeSwarmDef:
        def __init__(self, name, config_path, qa_version="v3"):
            self.name, self.config_path, self.qa_version = name, config_path, qa_version

    class FakeSession:
        session_id = "study-live-session"
        status = "completed"
        swarm_runs = [
            type(
                "Run",
                (),
                {
                    "swarm_id": "ai_ops",
                    "run_id": "r1",
                    "status": "completed",
                    "quality_score": 8.1,
                    "qa_result": {"qa_result": "pass"},
                },
            )()
        ]

    class FakeOrchestrator:
        def __init__(self, config_path, provider=None):
            self.swarms = {"ai_ops": FakeSwarmDef("AI运维元蜂群", "config/flow_ai_ops.yaml")}
            self.bindings = []

        def run(self, **kwargs):
            return FakeSession()

    events: list[dict] = []
    monkeypatch.setattr(chaotang_mod, "SwarmOrchestrator", FakeOrchestrator)
    monkeypatch.setattr(
        chaotang_mod,
        "record_event",
        lambda name, **kw: events.append({"name": name, **kw}),
    )
    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [_memorial("run_ai_ops", dept="ops")])
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    # 可逆+单部门巡检 → T-Solo（编排无回本理由，省钱）
    resp = client.post(
        "/api/chaotang/study/run",
        json={"command": "真实巡检 AI Ops 质量", "mode": "live", "taskId": "run_ai_ops", "entrySwarm": "ai_ops"},
    )
    assert resp.status_code == 200
    edict = resp.json()["data"]["edict"]
    assert edict["orchestration"]["tier"] == "T-Solo"
    assert edict["orchestration"]["value_thesis"] == "none"
    assert edict["orchestration"]["reason"]
    # wide event 已记录编排决策（可观测，绝不静默）
    tier_events = [e for e in events if e["name"] == "orchestration_tier_selected"]
    assert tier_events and tier_events[0]["tier"] == "T-Solo"
    assert tier_events[0]["value_thesis"] == "none"


def test_study_run_live_tier_reflects_command_signal(client, monkeypatch):
    """命令带不可逆信号 → 入口层升档 T-Verify（证明 command 真传进 tier 选择器）。"""
    import web.routers.chaotang as chaotang_mod
    import web.routers.throne as throne_mod

    _install_fake_swarm(monkeypatch)

    resp = client.post(
        "/api/chaotang/study/run",
        json={
            "command": "和客户签合同并对外发布这个方案",
            "mode": "live",
            "taskId": "run_ai_ops",
            "entrySwarm": "ai_ops",
        },
    )
    assert resp.status_code == 200
    edict = resp.json()["data"]["edict"]
    assert edict["orchestration"]["tier"] == "T-Verify"
    assert edict["orchestration"]["value_thesis"] == "adversarial"
    # 执行层:T-Verify 强制人工圣裁——即使 live run 分数通过(8.1→passed)也不许自动放行(单向门)
    assert edict["quality_gate"]["status"] == "passed"
    assert edict["quality_gate"]["human_signoff_required"] is True
    assert any("T-Verify" in r for r in edict["quality_gate"]["reasons"])


def _install_fake_swarm(monkeypatch):
    """Install a fast in-memory SwarmOrchestrator so live runs complete instantly."""
    import web.routers.chaotang as chaotang_mod
    import web.routers.throne as throne_mod

    class FakeSwarmDef:
        def __init__(self, name: str, config_path: str, qa_version: str = "v3"):
            self.name = name
            self.config_path = config_path
            self.qa_version = qa_version

    class FakeBinding:
        topic = "ai_ops_completed"
        target_swarm = "shiguan_archive"
        transform = "auto"
        min_quality_score = 7.0
        enabled = True

    class FakeSession:
        session_id = "study-live-session"
        status = "completed"
        swarm_runs = [
            type(
                "Run",
                (),
                {
                    "swarm_id": "ai_ops",
                    "run_id": "run-ai-ops-live",
                    "status": "completed",
                    "quality_score": 8.1,
                    "qa_result": {"qa_result": "pass"},
                },
            )()
        ]

    class FakeOrchestrator:
        def __init__(self, config_path: str, provider=None):
            self.config_path = config_path
            self.provider = provider
            self.swarms = {"ai_ops": FakeSwarmDef("AI运维元蜂群", "config/flow_ai_ops.yaml")}
            self.bindings = [FakeBinding()]

        def run(self, **kwargs):
            return FakeSession()

    monkeypatch.setattr(chaotang_mod, "SwarmOrchestrator", FakeOrchestrator)
    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [_memorial("run_ai_ops", dept="ops")])
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0


def _drain_sse(client, task_id: str, *, max_events: int = 30) -> list[dict]:
    """Consume the SSE stream until a terminal event, skipping heartbeats."""
    events: list[dict] = []
    with client.stream("GET", f"/api/chaotang/stream/{task_id}") as stream:
        for line in stream.iter_lines():
            if not line or not line.startswith("data: "):
                continue
            ev = json.loads(line[len("data: ") :])
            if ev.get("type") == "heartbeat":
                continue
            events.append(ev)
            if ev.get("type") in ("done", "error") or len(events) >= max_events:
                break
    return events


def test_study_run_live_empty_swarm_output_must_not_pass_gate(client, monkeypatch):
    """空输出不许亮绿(feedback_stop_tampering)。golden-loop 实测:opc 蜂群 status=completed
    但产出空、无 quality_score → 旧逻辑判 passed@0.0(戏台)。fail-secure:completed 但无实质
    评分必须判 needs_review + 诚实标注空产出,绝不冒充通过。"""
    import web.routers.chaotang as chaotang_mod
    import web.routers.throne as throne_mod

    class FakeSwarmDef:
        def __init__(self, name, config_path, qa_version="v3"):
            self.name, self.config_path, self.qa_version = name, config_path, qa_version

    class FakeSession:
        session_id = "study-live-empty"
        status = "completed"
        # 一个 completed 但空产出(无 quality_score)的 run —— 正是 golden-loop 的 opc。
        swarm_runs = [type("Run", (), {"swarm_id": "opc", "run_id": "r-empty", "status": "completed"})()]

    class FakeOrchestrator:
        def __init__(self, config_path, provider=None):
            self.swarms = {"opc": FakeSwarmDef("方案蜂群", "config/flow_opc.yaml")}
            self.bindings = []

        def run(self, **kwargs):
            return FakeSession()

    monkeypatch.setattr(chaotang_mod, "SwarmOrchestrator", FakeOrchestrator)
    monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [_memorial("run_x", dept="ops")])
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    response = client.post(
        "/api/chaotang/study/run",
        json={"command": "判断储能项目是否推进", "mode": "live", "entrySwarm": "opc"},
    )
    assert response.status_code == 200
    qg = response.json()["data"]["edict"]["quality_gate"]
    assert qg["status"] != "passed", f"空产出绝不许 passed,实得 {qg}"
    assert qg["status"] == "needs_review"
    assert "live_swarm_completed_but_empty_output" in qg["reasons"]
    assert qg["human_signoff_required"] is True


def test_study_run_live_async_returns_task_immediately_and_streams_final_edict(
    client, monkeypatch, isolated_session_local
):
    """live + asyncRun must NOT block on the 51s swarm: return a taskId + skeleton at once,
    then push the full LIVE_SWARM edict over the existing /stream/{task_id} SSE."""
    _install_fake_swarm(monkeypatch)

    response = client.post(
        "/api/chaotang/study/run",
        json={
            "command": "真实巡检 AI Ops 质量",
            "mode": "live",
            "asyncRun": True,
            "taskId": "run_ai_ops",
            "entrySwarm": "ai_ops",
        },
    )

    # 1) Immediate, non-blocking handoff — no 502, no 51s wait.
    assert response.status_code == 200
    data = response.json()["data"]
    task_id = data["taskId"]
    assert data["isAsync"] is True
    assert data["status"] == "running"
    assert data["streamUrl"] == f"/api/chaotang/stream/{task_id}"

    # 2) The synchronously-returned edict is an honest "running" skeleton, NOT a fake result.
    skeleton = data["edict"]
    assert skeleton["run_status"] == "running"
    assert skeleton["source_mode"] != "LIVE_SWARM"  # not yet — swarm hasn't run

    # 3) The background run streams the real final edict + launch-loop case.
    events = _drain_sse(client, task_id)
    terminal = events[-1]
    assert terminal["type"] == "done", f"expected done, got {events}"
    final = terminal["data"]["edict"]
    assert final["run_status"] == "done"
    assert final["source_mode"] == "LIVE_SWARM"
    assert final["run_adapter"]["session_id"] == "study-live-session"
    assert final["run_adapter"]["entry_swarm"] == "ai_ops"
    assert terminal["data"]["launchLoopCase"]["case_id"]
    assert "launchLoopGate" in terminal["data"]
