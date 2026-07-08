from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from src.production_events import (
    record_event,
    recent_events,
    release_gate_snapshot,
    summarize_events,
)
from web.deps import get_current_user
from web.main import app
from web.schemas.auth import CurrentUser


def _test_user() -> CurrentUser:
    return CurrentUser(user_id=1, username="ops", role="admin", tenant_slug="default")


def _client() -> TestClient:
    app.dependency_overrides[get_current_user] = _test_user
    return TestClient(app)


def test_record_event_writes_wide_event_without_full_prompt(tmp_path, monkeypatch):
    event_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(event_path))

    event = record_event(
        "flow_run_completed",
        case_id="case_1",
        task_id="task_1",
        run_id="run_1",
        flow="flow_sdlc",
        config="config/flow_sdlc.yaml",
        model="openai/test-model",
        status="done",
        gate_status="clear",
        latency_ms=123,
        task_preview="x" * 200,
    )

    assert event["event_type"] == "flow_run_completed"
    assert event["run_id"] == "run_1"
    assert event["model"] == "openai/test-model"
    assert event["task_preview"] == "x" * 120
    assert recent_events(path=event_path)[0]["gate_status"] == "clear"


def test_summarize_events_and_release_gate_red_yellow_green(tmp_path, monkeypatch):
    event_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(event_path))

    record_event("health_probe", status="ok", gate_status="clear")
    green = release_gate_snapshot(path=event_path)
    assert green["ready"] is True
    assert green["light"] == "green"

    record_event(
        "health_probe",
        status="degraded",
        gate_status="degraded",
        gate_reason="litellm down",
    )
    yellow_summary = summarize_events(recent_events(path=event_path))
    assert yellow_summary["light"] == "yellow"
    assert yellow_summary["warnings"][0]["gate_reason"] == "litellm down"

    record_event(
        "release_readiness",
        status="blocked",
        gate_status="blocked",
        gate_reason="model gateway missing",
    )
    red = release_gate_snapshot(path=event_path)
    assert red["ready"] is False
    assert red["light"] == "red"
    assert red["blockers"][0]["gate_reason"] == "model gateway missing"


def test_run_index_drift_blocks_release_gate(tmp_path, monkeypatch):
    event_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(event_path))

    record_event(
        "run_index_drift_detected",
        task_id="task_1",
        run_id="20260609_003027",
        status="warning",
        gate_status="degraded",
        gate_reason="load_run_missing",
    )

    gate = release_gate_snapshot(path=event_path)
    assert gate["ready"] is False
    assert gate["light"] == "red"
    assert gate["blockers"][0]["event_type"] == "run_index_drift_detected"
    assert gate["blockers"][0]["run_id"] == "20260609_003027"
    assert gate["blockers"][0]["gate_reason"] == "load_run_missing"


def test_observability_summary_and_release_gate_endpoints(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    record_event("health_probe", status="ok", gate_status="clear")

    with _client() as client:
        summary = client.get("/api/observability/summary")
        gate = client.get("/api/observability/release-gate")

    assert summary.status_code == 200
    assert summary.json()["summary"]["light"] == "green"
    assert gate.status_code == 200
    assert gate.json()["ready"] is True


def test_release_observability_gate_script_blocks_red_events(tmp_path):
    event_path = tmp_path / "events.jsonl"
    event_path.write_text(
        json.dumps(
            {
                "event_type": "release_readiness",
                "timestamp": "2026-06-07T00:00:00+00:00",
                "status": "blocked",
                "gate_status": "blocked",
                "gate_reason": "missing model gateway",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            sys.executable,
            "scripts/release_observability_gate.py",
            "--events",
            str(event_path),
        ],
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    assert '"light": "red"' in result.stdout


def test_ready_fails_secure_when_required_model_gateway_and_key_missing(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setenv("FENGQUN_REQUIRE_MODEL_GATEWAY", "true")
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("LITELLM_API_KEY", raising=False)
    monkeypatch.setattr(
        "web.routers.health._check_model_gateway", lambda: ("down", {"latency_ms": 1})
    )

    with TestClient(app) as client:
        response = client.get("/api/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["ready"] is False
    assert "model_gateway_unavailable" in body["blockers"]
    events = recent_events(path=tmp_path / "events.jsonl")
    assert events[-1]["event_type"] == "release_readiness"
    assert events[-1]["gate_status"] == "blocked"


@dataclass
class FakeRunLog:
    run_id: str = "obs-flow-run"
    final_output: dict | None = None
    quality_score: dict | None = None
    qa_result: dict | None = None
    run_status: str = "normal"


class FakeFlowEngine:
    flow_name = "Observability Flow"
    default_model = "openai/obs-model"

    def __init__(
        self,
        config_path: str,
        qa_version: str | None = None,
        execution_modes: dict | None = None,
    ):
        self.config_path = config_path
        self.step_configs = [{"id": "draft"}]

    def run(self, task_input: str, **callbacks):
        callbacks["on_flow_start"](1, self.flow_name, ["draft"])
        callbacks["on_step_start"](0, "draft", self.default_model)
        callbacks["on_step_done"](0, 1, "draft", 0.01, "success", "ok")
        return FakeRunLog(
            final_output={"summary": task_input},
            quality_score={"total_score": 4.7},
            qa_result={"qa_result": "pass"},
        )


def test_async_flow_writes_production_event(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setattr("src.flow_engine.FlowEngine", FakeFlowEngine)

    with _client() as client:
        accepted = client.post(
            "/api/runs/async",
            json={"task_input": "生产观测 smoke", "config": "config/flow_sdlc.yaml"},
        )
        task_id = accepted.json()["task_id"]
        with client.stream("GET", f"/api/runs/stream/{task_id}") as response:
            body = "".join(response.iter_text())

    assert '"type": "done"' in body
    events = recent_events(path=tmp_path / "events.jsonl")
    by_type = {event["event_type"]: event for event in events}
    assert by_type["run_async_requested"]["task_id"] == task_id
    completed = by_type["flow_run_completed"]
    assert completed["run_id"] == "obs-flow-run"
    assert completed["model"] == "openai/obs-model"
    assert completed["gate_status"] == "clear"
    assert completed["task_hash"]
    assert completed["task_preview"] == "生产观测 smoke"


class FakeApiOrchestrator:
    def __init__(self, config_path: str, provider: str | None = None):
        self.config_path = config_path
        self.provider = provider
        # 真 SwarmOrchestrator 暴露 .swarms(dict);swarm.py 校验 entry_swarm 是否注册时会读它。
        # double 须honor此契约,否则 entry_swarm 校验抛 AttributeError。
        self.swarms = {"ai_ops": object()}

    def run(self, task_input: str, entry_swarm=None, session_id=None):
        return SimpleNamespace(
            session_id=session_id,
            swarm_runs=[
                SimpleNamespace(
                    swarm_id=entry_swarm or "ai_ops",
                    run_id="obs-swarm-run",
                    status="completed",
                    qa_result={"qa_result": "pass"},
                )
            ],
        )


def test_swarm_api_writes_production_events(tmp_path, monkeypatch):
    import web.routers.swarm as swarm_router

    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))
    monkeypatch.setattr(swarm_router, "SwarmOrchestrator", FakeApiOrchestrator)

    with _client() as client:
        response = client.post(
            "/api/swarm/run",
            json={"task_input": "蜂群观测 smoke", "entry_swarm": "ai_ops"},
        )
    assert response.status_code == 202

    events = recent_events(path=tmp_path / "events.jsonl")
    event_types = [event["event_type"] for event in events]
    assert "swarm_api_requested" in event_types
    assert "swarm_api_completed" in event_types
    completed = next(
        event for event in events if event["event_type"] == "swarm_api_completed"
    )
    assert completed["swarm"] == "ai_ops"
    assert completed["gate_status"] == "clear"
