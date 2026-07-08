from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def test_task_protocol_preview_returns_human_hint(monkeypatch):
    client = _client(monkeypatch)

    response = client.post("/api/task-protocol/preview", json={"task": "上线自动执行客户报价流程"})

    assert response.status_code == 200
    body = response.json()
    assert body["hint"] == "这件事风险较高，建议先问 3 个关键问题。"
    assert body["recommended_action"] == "continue"
    assert body["mode"] == "开钦天监"
    assert body["signoff_required"] is True


def test_task_protocol_preview_for_direct_work(monkeypatch):
    client = _client(monkeypatch)

    response = client.post("/api/task-protocol/preview", json={"task": "修复 OPC 评分脚本并提交"})

    assert response.status_code == 200
    assert response.json()["hint"] == "这件事可以直接进入执行，我会边做边验证。"
