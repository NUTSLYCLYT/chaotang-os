from fastapi.testclient import TestClient

from web.main import app


def test_draft_edict_preserves_question_and_flags_risk(isolated_session_local):
    client = TestClient(app)

    response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断100MWh冷库储能项目是否推进。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    draft = data["draft_edict"]
    assert draft["original_question"] == "判断100MWh冷库储能项目是否推进。"
    assert "军机处" in draft["refined_edict"]
    assert "户部" in draft["recommended_departments"]
    assert "工部" in draft["recommended_departments"]
    assert "刑部" in draft["recommended_departments"]
    assert "证据不足" in draft["risk_flags"]
    assert "设备报价" in draft["unknown_gaps"]
    assert draft["source_label"] == "FALLBACK"
    assert data["eval_result"]["passed"] is True


def test_confirm_edict_creates_review_status(isolated_session_local):
    # 刑部/户部真实引擎已由 tests/conftest.py 的 _no_network_real_department_engines
    # 自动patch成空结果,这里不需要重复mock,直接走安全默认值即可。

    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "这个合同能不能直接签？"},
    )
    task_id = draft_response.json()["data"]["task_id"]

    confirm_response = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )

    assert confirm_response.status_code == 200
    confirm_data = confirm_response.json()["data"]
    assert confirm_data["status"] == "awaiting_decision"
    assert confirm_data["routing_plan"]["ministry_candidates"] == ["刑部"]
    assert confirm_data["memorial"]["title"] == "军机处会审回奏"
    assert confirm_data["memorial"]["verdict"] == "需人工复核"
    assert confirm_data["memorial"]["decision_options"]

    status_response = client.get(f"/api/shangshufang/tasks/{task_id}/status")
    assert status_response.status_code == 200
    status_data = status_response.json()["data"]
    assert status_data["task"]["status"] == "awaiting_decision"
    assert status_data["review"]["review_status"] == "awaiting_decision"
    assert status_data["review"]["memorial"]["source_label"] == "FALLBACK"
    assert status_data["review"]["ministry_outputs"][0]["department"] == "刑部"
    memorial = status_data["review"]["memorial"]
    assert memorial["ministry_outputs"][0]["swarm_id"] == "xingbu_legal_risk_swarm"
    assert memorial["ministry_outputs"][0]["ability_basis"]
    assert memorial["formatted_memorial"]["section_order"] == [
        "圣裁",
        "分奏",
        "证据",
        "风险",
        "后令",
        "质门",
        "来源",
    ]
    assert "【分奏】" in memorial["formatted_memorial"]["text"]
    assert "刑部奏" in memorial["formatted_memorial"]["text"]


def test_archive_decision_writes_shiguan_record(isolated_session_local):
    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断100MWh冷库储能项目是否推进。"},
    )
    task_id = draft_response.json()["data"]["task_id"]
    client.post(
        "/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True}
    )

    decision_response = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "archive",
            "reason": "先归档当前会审结果",
            "human_confirmed": True,
        },
    )

    assert decision_response.status_code == 200
    decision_data = decision_response.json()["data"]
    assert decision_data["status"] == "archived"

    status_response = client.get(f"/api/shangshufang/tasks/{task_id}/status")
    assert status_response.json()["data"]["task"]["status"] == "archived"


def test_draft_edict_with_attachment_marks_user_evidence(isolated_session_local):
    client = TestClient(app)

    response = client.post(
        "/api/shangshufang/draft-edict",
        json={
            "raw_question": "判断这个合同能不能签。",
            "attachments": [
                {"name": "合同草案.pdf", "size": 120_000, "type": "application/pdf"},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    draft = data["draft_edict"]
    assert draft["source_label"] == "MIXED"
    assert any("用户已上传补证附件 1 份" in item for item in draft["known_facts"])
    assert any("合同草案.pdf" in item for item in draft["known_facts"])
