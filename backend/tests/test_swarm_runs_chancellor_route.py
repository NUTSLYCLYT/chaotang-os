"""军机处派蜂群接口(create_swarm_run)现在会先查丞相路由：direct 任务短路，
不再永远全量蜂群。见 backend/web/routers/swarm_runs.py 的
_resolve_chancellor_route/_direct_swarm_short_circuit。"""

from fastapi.testclient import TestClient

from web.main import app


def _draft_and_confirm_direct_task(client: TestClient) -> tuple[str, str]:
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "请礼部整理一份客户拜访纪要。"},
    )
    task_id = draft_response.json()["data"]["task_id"]
    confirm_response = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )
    confirm_data = confirm_response.json()["data"]
    assert confirm_data["route"]["mode"] == "direct"
    return task_id, confirm_data["review_id"]


def test_direct_route_short_circuits_swarm_dispatch(isolated_session_local):
    client = TestClient(app)
    task_id, review_id = _draft_and_confirm_direct_task(client)

    response = client.post(
        "/api/swarm-runs",
        json={"task_id": task_id, "review_id": review_id, "mode": "standard"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert data["swarm_run"]["status"] == "direct_completed"
    assert data["swarm_run"]["task_id"] == task_id
    assert data["route"]["mode"] == "direct"
    assert data["route"]["targetDepartment"] == "礼部"
    assert data["direct_receipt"]["title"] == "上书房简单任务单回执"
    assert data["direct_receipt"]["target_agent"] == "libu_communication_agent"
    assert data["brief"] is not None

    detail = client.get(f"/api/swarm-runs/{data['swarm_run']['id']}").json()["data"]
    assert detail["swarm_run"]["status"] == "direct_completed"
    assert detail["task_runs"] == []


def test_live_swarm_mode_forces_full_dispatch_even_for_direct_route(isolated_session_local):
    client = TestClient(app)
    task_id, review_id = _draft_and_confirm_direct_task(client)

    response = client.post(
        "/api/swarm-runs",
        json={"task_id": task_id, "review_id": review_id, "mode": "live_swarm"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["swarm_run"]["mode"] == "live_swarm"
    assert data["swarm_run"]["status"] != "direct_completed"
    assert "direct_receipt" not in data


def test_cluster_route_unaffected_by_chancellor_route_resolution(isolated_session_local):
    """回归：非 direct 任务(集群路由)不应该被新短路逻辑影响，行为与之前一致。"""
    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断100MWh冷库储能项目是否推进。"},
    )
    task_id = draft_response.json()["data"]["task_id"]
    confirm_response = client.post(
        "/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True}
    )
    confirm_data = confirm_response.json()["data"]
    assert confirm_data["route"]["mode"] == "cluster"
    review_id = confirm_data["review_id"]

    response = client.post(
        "/api/swarm-runs",
        json={"task_id": task_id, "review_id": review_id, "mode": "standard"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["swarm_run"]["status"] != "direct_completed"
    assert "direct_receipt" not in data
