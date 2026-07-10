from fastapi.testclient import TestClient

from web.main import app


def test_shiguan_stats_contract_is_stable():
    response = TestClient(app).get("/api/court/shiguan/stats")

    assert response.status_code == 200
    body = response.json()
    assert "totalTasks" in body
    assert "totalCases" in body
    assert "successRate" in body


def test_shiguan_archive_contract_can_be_normalized():
    response = TestClient(app).get("/api/chaotang/archive?limit=5")

    assert response.status_code == 200
    body = response.json()
    assert body.get("success", True) is True
    data = body.get("data", body)
    assert isinstance(data, (dict, list))


def test_shiguan_promo_archive_contract_has_curated_array():
    response = TestClient(app).get("/api/court/shiguan/promo-archive")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert isinstance(data["curated"], list)
    assert isinstance(data["curatedCount"], int)
    assert "source" in data
    assert "sourceLabel" in data


def test_shiguan_formal_archive_contracts_exist():
    client = TestClient(app)

    listed = client.get("/api/court/shiguan/archives?limit=3")
    assert listed.status_code == 200
    listed_body = listed.json()
    assert listed_body["success"] is True
    assert listed_body["data"]["archives"] == []
    assert listed_body["data"]["sourceLabel"] == "FALLBACK"

    detail = client.get("/api/court/shiguan/archives/archive-1")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["success"] is True
    assert detail_body["data"]["archive"]["id"] == "archive-1"
    assert detail_body["data"]["archive"]["sourceLabel"] == "FALLBACK"

    similar = client.get("/api/court/shiguan/archives/archive-1/similar")
    assert similar.status_code == 200
    assert similar.json()["data"]["similar"] == []

    verdict = client.post("/api/court/shiguan/archives/archive-1/verdict")
    assert verdict.status_code == 200
    assert verdict.json()["data"]["sourceLabel"] == "FALLBACK"


def test_scribe_lessons_contract_has_lessons_list():
    response = TestClient(app).get("/api/scribe/lessons")

    assert response.status_code == 200
    body = response.json()
    lessons = body.get("data", {}).get("lessons", body.get("lessons"))
    assert isinstance(lessons, list)


def test_shiguan_retrospective_contract_returns_archive_status():
    response = TestClient(app).post(
        "/api/shiguan/archives/archive-contract-1/retrospective",
        json={"retrospective_status": "达成"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["archiveId"] == "archive-contract-1"
    assert body["data"]["retrospectiveStatus"] == "达成"
    assert "sourceLabel" in body["data"]
