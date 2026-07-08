# tests/test_chaotang_router_basic.py
from fastapi.testclient import TestClient


def _client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


def test_overview_envelope_and_agentcode(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/throne/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    ministers = body["data"]["ministers"]
    assert len(ministers) == 11
    assert all("agentCode" in m for m in ministers)
    assert {m["agentCode"] for m in ministers} >= {"prime_minister", "hu_bu"}


def test_manor_groups_endpoint(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/manor/groups")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 6
    assert {g["id"] for g in data} == {"intel", "content", "finlaw", "rnd", "exec", "review"}


def test_system_status(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/system/status")
    assert r.status_code == 200
    assert r.json()["data"]["overall"] in ("ok", "degraded", "down")


def test_department_system_exposes_six_ministries_and_advisor_rules(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/chaotang/department-system")

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["summary"]["sixMinistryCount"] == 6
    assert data["summary"]["geniusReadyCount"] == 6
    assert "topAdvisorDesign" in data
    ministries = {item["code"]: item for item in data["sixMinistries"]}
    assert set(ministries) == {"gongbu", "hubu", "libu_personnel", "libu", "bingbu", "xingbu"}
    assert {"haolong", "opc", "quotation", "storage_aftercare"}.issubset(
        set(ministries["bingbu"]["callsSwarms"])
    )
    assert len(ministries["gongbu"]["advisorLenses"]) >= 2
    assert ministries["libu"]["geniusDesign"]


def test_department_system_route_suggests_ministry_and_swarms(monkeypatch):
    c = _client(monkeypatch)
    r = c.post(
        "/api/chaotang/department-system/route",
        json={"task": "客户售后故障升级，需要销售跟进并沉淀真实反馈"},
    )

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["primaryDepartment"]["code"] == "bingbu"
    assert "storage_aftercare" in data["primaryDepartment"]["callsSwarms"]
    assert data["primeMinisterNextStep"]["owner"] == "bingbu"
    assert data["qintianjianTrigger"]["signal"]
    assert data["yushiGateHint"]


def test_department_system_route_keeps_cross_department_candidates(monkeypatch):
    c = _client(monkeypatch)
    r = c.post(
        "/api/chaotang/department-system/route",
        json={"task": "客户要求报价和ROI测算，同时准备对外话术"},
    )

    assert r.status_code == 200
    data = r.json()["data"]
    candidate_codes = {item["code"] for item in data["candidateDepartments"]}
    assert "hubu" in candidate_codes
    assert "libu" in candidate_codes


def test_department_system_route_rejects_empty_task(monkeypatch):
    c = _client(monkeypatch)
    r = c.post("/api/chaotang/department-system/route", json={"task": ""})

    assert r.status_code == 200
    assert r.json()["success"] is False
    assert "task 不能为空" in r.json()["error"]
