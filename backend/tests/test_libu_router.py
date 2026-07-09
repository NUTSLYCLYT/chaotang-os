# tests/test_libu_router.py
from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def test_appointment_verdict_rejects_empty_task_text(monkeypatch):
    c = _client(monkeypatch)
    r = c.post("/api/libu/appointment/verdict", json={"task_text": ""})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False


def test_appointment_verdict_returns_engine_output(monkeypatch):
    from src import libu_appointment_vet

    monkeypatch.setattr(
        libu_appointment_vet,
        "run_libu_appointment",
        lambda task_text, *, archive=True: {"verdict": "red", "task_text": task_text},
    )
    c = _client(monkeypatch)
    r = c.post("/api/libu/appointment/verdict", json={"task_text": "辞退某员工"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["verdict"] == "red"
    assert data["task_text"] == "辞退某员工"


def test_recruit_verdict_rejects_empty_task_input(monkeypatch):
    c = _client(monkeypatch)
    r = c.post("/api/libu/recruit/verdict", json={"task_input": ""})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False


def test_recruit_verdict_returns_engine_output(monkeypatch):
    from src import libu_vet

    monkeypatch.setattr(
        libu_vet,
        "run_libu_verdict",
        lambda task_input, *, archive=True: {
            "verdict": "pass",
            "task_input": task_input,
        },
    )
    c = _client(monkeypatch)
    r = c.post("/api/libu/recruit/verdict", json={"task_input": "招聘一名BMS工程师"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["verdict"] == "pass"
    assert data["task_input"] == "招聘一名BMS工程师"
