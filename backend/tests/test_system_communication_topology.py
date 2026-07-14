from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from web.deps import get_current_user
from web.main import app
from web.schemas.auth import CurrentUser


def _test_user() -> CurrentUser:
    return CurrentUser(user_id=1, username="tester", role="admin", tenant_slug="default")


def _client() -> TestClient:
    app.dependency_overrides[get_current_user] = _test_user
    return TestClient(app)


@dataclass
class FakeRunLog:
    run_id: str = "flow-smoke-run"
    final_output: dict | None = None
    quality_score: dict | None = None
    qa_result: dict | None = None
    run_status: str = "normal"


class FakeFlowEngine:
    def __init__(self, config_path: str, qa_version: str | None = None, execution_modes: dict | None = None):
        self.config_path = config_path
        self.qa_version = qa_version
        self.execution_modes = execution_modes or {}
        self.step_configs = [{"id": "draft"}, {"id": "qa"}]

    def run(self, task_input: str, **callbacks):
        callbacks["on_flow_start"](2, "通信 smoke flow", ["draft", "qa"])
        callbacks["on_step_start"](0, "起草", "mock-model")
        callbacks["on_token"](0, "hello")
        callbacks["on_step_done"](0, 2, "起草", 0.01, "success", "第一步输出")
        callbacks["on_step_start"](1, "质检", "mock-model")
        callbacks["on_step_done"](1, 2, "质检", 0.01, "success", "QA输出")
        return FakeRunLog(
            final_output={"summary": task_input},
            quality_score={"total_score": 4.5},
            qa_result={"qa_result": "pass"},
        )


class FakeSwarmSession:
    session_id = "swarm-smoke-session"
    swarm_runs = [
        SimpleNamespace(
            swarm_id="ai_ops",
            run_id="ai-ops-run",
            status="completed",
            quality_score=4.6,
            qa_result={"qa_result": "pass"},
        )
    ]


class FakeStreamingOrchestrator:
    def __init__(self, config_path: str):
        self.config_path = config_path
        # _run_swarm 的入口校验/意图路由会读 swarms 注册表
        self.swarms = {
            "ai_ops": SimpleNamespace(
                name="AI运维元蜂群",
                config_path="config/flow_ai_ops.yaml",
                qa_version="v3",
            )
        }

    def run(self, task_input: str, entry_swarm=None, session_id=None, on_swarm_start=None, on_swarm_done=None, on_step_done=None):
        run_log = FakeRunLog(
            run_id="ai-ops-run",
            quality_score={"total_score": 4.6},
            qa_result={"qa_result": "pass"},
        )
        on_swarm_start("ai_ops", "AI运维元蜂群")
        on_step_done(0, 1, "诊断", 0.01, "success", "蜂群步骤输出")
        on_swarm_done("ai_ops", "AI运维元蜂群", run_log)
        return FakeSwarmSession()


class FakeApiOrchestrator:
    run_calls = 0

    def __init__(self, config_path: str, provider: str | None = None):
        self.config_path = config_path
        self.provider = provider
        self.swarms = {
            "ai_ops": SimpleNamespace(
                name="AI运维元蜂群",
                config_path="config/flow_ai_ops.yaml",
                qa_version="v3",
            )
        }
        self.bindings = [
            SimpleNamespace(
                topic="ai_ops_completed",
                target_swarm="shiguan_archive",
                transform="auto",
                min_quality_score=3.0,
                enabled=True,
            )
        ]

    def run(
        self, task_input: str, entry_swarm=None, session_id=None, project_id=None
    ):
        type(self).run_calls += 1
        path = Path("swarm_sessions") / f"{session_id}.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "session_id": session_id,
                    "task_input": task_input,
                    "status": "completed",
                    "start_time": "2026-06-07T00:00:00+08:00",
                    "end_time": "2026-06-07T00:00:01+08:00",
                    "swarm_runs": [
                        {
                            "swarm_id": entry_swarm or "ai_ops",
                            "run_id": "api-swarm-run",
                            "status": "completed",
                            "quality_score": 4.4,
                            "qa_result": {"qa_result": "pass"},
                            "triggered_by": "manual",
                        }
                    ],
                    "events": [],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )


def test_async_flow_endpoint_streams_flow_events(monkeypatch):
    monkeypatch.setattr("src.flow_engine.FlowEngine", FakeFlowEngine)

    with _client() as client:
        accepted = client.post(
            "/api/runs/async",
            json={
                "task_input": "检查前后端通信",
                "config": "config/flow_sdlc.yaml",
                "execution_modes": {"draft": "B"},
            },
        )
        assert accepted.status_code == 200
        task_id = accepted.json()["task_id"]

        with client.stream("GET", f"/api/runs/stream/{task_id}") as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

        assert '"type": "flow_start"' in body
        assert '"type": "step_start"' in body
        assert '"type": "token"' in body
        assert '"type": "done"' in body

        status = client.get(f"/api/runs/stream/{task_id}/status")
        assert status.json()["status"] == "done"
        assert status.json()["run_id"] == "flow-smoke-run"


def test_async_swarm_endpoint_streams_swarm_events(monkeypatch):
    monkeypatch.setattr("src.swarm_orchestrator.SwarmOrchestrator", FakeStreamingOrchestrator)

    with _client() as client:
        accepted = client.post(
            "/api/runs/async",
            json={
                "task_input": "检查蜂群通信",
                "config": "config/flow_sdlc.yaml",
                "swarm": "ai_ops",
            },
        )
        assert accepted.status_code == 200
        task_id = accepted.json()["task_id"]

        with client.stream("GET", f"/api/runs/stream/{task_id}") as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

        assert '"type": "swarm_start"' in body
        assert '"type": "swarm_done"' in body
        assert '"session_id": "swarm-smoke-session"' in body
        assert client.get(f"/api/runs/stream/{task_id}/status").json()["status"] == "done"


def test_swarm_api_config_run_and_session_replay(monkeypatch):
    import web.routers.swarm as swarm_router

    monkeypatch.setattr(swarm_router, "SwarmOrchestrator", FakeApiOrchestrator)

    with _client() as client:
        config = client.get("/api/swarm/config")
        assert config.status_code == 200
        assert any(s["id"] == "ai_ops" for s in config.json()["swarms"])

        run = client.post(
            "/api/swarm/run",
            json={"task_input": "检查 session replay", "entry_swarm": "ai_ops"},
        )
        assert run.status_code == 202
        session_id = run.json()["session_id"]

        detail = client.get(f"/api/swarm/sessions/{session_id}")
        for _ in range(20):
            if detail.status_code == 200:
                break
            time.sleep(0.05)
            detail = client.get(f"/api/swarm/sessions/{session_id}")
        assert detail.status_code == 200
        data = detail.json()
        assert data["release_gate"] == "clear"
        assert data["graph"]["nodes"][0]["swarm_id"] == "ai_ops"


def test_swarm_run_routes_missing_entry_swarm(monkeypatch):
    import web.routers.swarm as swarm_router

    FakeApiOrchestrator.run_calls = 0
    monkeypatch.setattr(swarm_router, "SwarmOrchestrator", FakeApiOrchestrator)

    with _client() as client:
        run = client.post(
            "/api/swarm/run",
            json={"task_input": "TRACE-123 请做一次低风险联通自检，返回链路健康和会话ID"},
        )
        assert run.status_code == 202
        body = run.json()
        assert body["entry_swarm"] == "health_check"
        assert body["route_matched"] is True
        session_id = body["session_id"]

        detail = client.get(f"/api/swarm/sessions/{session_id}")
        assert detail.status_code == 200
        data = detail.json()
        assert data["status"] == "completed"
        assert data["release_gate"] == "clear"
        assert data["synthetic"] is True
        assert data["session_type"] == "health_check"
        assert data["graph"]["nodes"][0]["swarm_id"] == "health_check"
        assert FakeApiOrchestrator.run_calls == 0

        sessions = client.get("/api/swarm/sessions")
        assert sessions.status_code == 200
        summary = next(item for item in sessions.json() if item["session_id"] == session_id)
        assert summary["synthetic"] is True
        assert summary["session_type"] == "health_check"


def test_swarm_run_still_routes_real_ops_to_ai_ops(monkeypatch):
    import web.routers.swarm as swarm_router

    FakeApiOrchestrator.run_calls = 0
    monkeypatch.setattr(swarm_router, "SwarmOrchestrator", FakeApiOrchestrator)

    with _client() as client:
        run = client.post(
            "/api/swarm/run",
            json={"task_input": "巡检一下蜂群质量和系统健康,排查异常"},
        )
        assert run.status_code == 202
        body = run.json()
        assert body["entry_swarm"] == "ai_ops"
        session_id = body["session_id"]

        detail = client.get(f"/api/swarm/sessions/{session_id}")
        for _ in range(20):
            if detail.status_code == 200:
                break
            time.sleep(0.05)
            detail = client.get(f"/api/swarm/sessions/{session_id}")
        assert detail.status_code == 200
        assert detail.json()["graph"]["nodes"][0]["swarm_id"] == "ai_ops"
        assert FakeApiOrchestrator.run_calls == 1
