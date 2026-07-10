from fastapi.testclient import TestClient

from web.main import app


def test_chancellor_chat_streams_single_agent_reply(isolated_session_local):
    client = TestClient(app)

    with client.stream(
        "POST",
        "/api/shangshufang/chancellor-chat",
        json={"message": "这个项目先怎么判断？"},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "data:" in body
    assert "chancellor" in body
    assert "丞相" in body


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
    assert data["route"]["mode"] == "cluster"
    assert data["route"]["decidedBy"] == "chancellor"
    assert data["route"]["swarmRequired"] is True
    assert data["eval_result"]["passed"] is True


def test_chancellor_routes_simple_task_to_direct_agent(isolated_session_local):
    client = TestClient(app)

    response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "请礼部整理一份客户拜访纪要。"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    route = data["route"]
    assert route["mode"] == "direct"
    assert route["decidedBy"] == "chancellor"
    assert route["targetDepartment"] == "礼部"
    assert route["targetAgent"] == "libu_communication_agent"
    assert route["swarmRequired"] is False
    assert data["draft_edict"]["route"]["mode"] == "direct"


def test_confirm_direct_task_creates_simple_receipt_without_swarm(isolated_session_local):
    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "请礼部整理一份客户拜访纪要。"},
    )
    task_id = draft_response.json()["data"]["task_id"]

    confirm_response = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )

    assert confirm_response.status_code == 200
    confirm_data = confirm_response.json()["data"]
    assert confirm_data["status"] == "direct_completed"
    assert confirm_data["route"]["mode"] == "direct"
    assert confirm_data["routing_plan"]["swarm_required"] is False
    assert confirm_data["routing_plan"]["ministry_candidates"] == ["礼部"]
    assert confirm_data["memorial"]["title"] == "上书房简单任务单回执"
    assert confirm_data["memorial"]["target_agent"] == "libu_communication_agent"

    deepen = client.post(f"/api/shangshufang/tasks/{task_id}/swarm-deepen")
    assert deepen.status_code == 200
    deepen_data = deepen.json()["data"]
    assert deepen_data["status"] == "direct_completed"
    assert deepen_data["swarm_trace_summary"]["status"] == "skipped_direct_route"
    assert deepen_data["swarm_trace_summary"]["mode"] == "not_required"

    status_response = client.get(f"/api/shangshufang/tasks/{task_id}/status")
    assert status_response.status_code == 200
    status_data = status_response.json()["data"]
    assert status_data["task"]["status"] == "direct_completed"
    assert status_data["review"]["review_status"] == "direct_completed"


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
    assert confirm_data["status"] == "edict_recorded"
    assert confirm_data["decree_record"]["status"] == "edict_recorded"
    assert confirm_data["routing_plan"]["ministry_candidates"] == ["刑部"]
    assert confirm_data["memorial"]["title"] == "军机处会审回奏"
    assert confirm_data["memorial"]["verdict"] == "需人工复核"
    assert confirm_data["memorial"]["decision_options"]

    status_response = client.get(f"/api/shangshufang/tasks/{task_id}/status")
    assert status_response.status_code == 200
    status_data = status_response.json()["data"]
    assert status_data["task"]["status"] == "edict_recorded"
    assert status_data["review"]["review_status"] == "edict_recorded"
    assert status_data["review"]["memorial"]["source_label"] == "FALLBACK"
    assert status_data["review"]["ministry_outputs"][0]["department"] == "刑部"
    memorial = status_data["review"]["memorial"]
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


def test_frontend_decision_actions_are_accepted(isolated_session_local):
    client = TestClient(app)
    expected_status = {
        "adopt": "archived",
        "followup": "awaiting_evidence",
        "recheck": "reviewing",
        "reject": "rejected",
    }

    for action, expected in expected_status.items():
        draft_response = client.post(
            "/api/shangshufang/draft-edict",
            json={"raw_question": f"判断这个预算案是否推进：{action}"},
        )
        task_id = draft_response.json()["data"]["task_id"]
        client.post(
            "/api/shangshufang/confirm-edict",
            json={"task_id": task_id, "confirmed": True},
        )

        decision_response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={"action": action, "reason": f"test {action}", "human_confirmed": True},
        )

        assert decision_response.status_code == 200
        payload = decision_response.json()
        assert payload["success"] is True
        assert payload["data"]["status"] == expected
        if action == "adopt":
            assert payload["data"]["archive_record"]["archive_id"]


def test_home_reads_pending_confirm_decision_and_evidence(isolated_session_local):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断这个 PACK 项目是否推进。"},
    ).json()["data"]
    confirmed_task = draft["task_id"]
    client.post("/api/shangshufang/confirm-edict", json={"task_id": confirmed_task, "confirmed": True})
    client.post(
        f"/api/shangshufang/tasks/{confirmed_task}/decision",
        json={"action": "followup", "reason": "请补证"},
    )
    pending_confirm = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断这个合同能不能签。"},
    ).json()["data"]["task_id"]

    response = client.get("/api/shangshufang/home")

    assert response.status_code == 200
    data = response.json()["data"]
    pending_ids = {item["task_id"] for item in data["pending_decisions"]}
    evidence_ids = {item["task_id"] for item in data["pending_evidence_tasks"]}
    assert pending_confirm in pending_ids
    assert confirmed_task in evidence_ids


def test_swarm_deepen_endpoint(isolated_session_local):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断这个内部流程是否推进。"},
    ).json()["data"]
    task_id = draft["task_id"]
    client.post("/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True})

    deepen = client.post(f"/api/shangshufang/tasks/{task_id}/swarm-deepen")
    assert deepen.status_code == 200
    assert deepen.json()["success"] is True
    assert deepen.json()["data"]["task_id"] == task_id


def test_pack_swarm_loop_endpoint(isolated_session_local):
    client = TestClient(app)
    pack = client.post(
        "/api/shangshufang/pack-swarm-loop",
        json={"command": "请 PACK 蜂群协同评估储能电池包建设方案", "mode": "order", "source_urls": []},
    )
    assert pack.status_code == 200
    pack_data = pack.json()["data"]
    assert pack_data["schema_version"] == "PackSwarmLoopV1"
    assert pack_data["task_id"]


def test_polish_im_and_edict_return_endpoints(isolated_session_local):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "记录一个内部复命测试任务。"},
    ).json()["data"]
    task_id = draft["task_id"]
    client.post("/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True})

    polish = client.post(
        "/api/shangshufang/polish-edict",
        json={"raw_question": "判断这个项目是否推进", "mode": "order"},
    )
    assert polish.status_code == 200
    polished = polish.json()["data"]["polished_edict"]
    assert polished
    assert "军机处" not in polished
    assert "会审" not in polished

    im = client.post(
        "/api/shangshufang/im",
        json={"message": {"role": "user", "label": "陛下", "text": "测试消息", "mode": "order"}},
    )
    assert im.status_code == 200
    messages = client.get("/api/shangshufang/im?mode=order").json()["data"]["messages"]
    assert any(item["text"] == "测试消息" for item in messages)

    returned = client.post(
        "/api/shangshufang/edict-return",
        json={"taskId": task_id, "sessionId": "session_test", "mode": "order", "command": "测试", "edictView": {}, "finalOutputs": []},
    )
    assert returned.status_code == 200
    assert returned.json()["success"] is True


def test_finance_intel_status_and_budget_endpoints(isolated_session_local):
    client = TestClient(app)

    finance = client.post(
        "/api/shangshufang/finance-intel-loop/complete",
        json={
            "ticker": "AAPL",
            "market": "US",
            "question": "Evaluate whether AAPL valuation is reasonable using public SEC sources only.",
            "edictMode": "public",
            "executionType": "create_watchlist",
        },
    )
    assert finance.status_code == 200
    finance_data = finance.json()["data"]
    assert finance_data["taskId"]
    assert finance_data["briefId"]
    assert finance_data["sourceUrls"]

    case = client.get(f"/api/shangshufang/finance-intel-loop/cases/{finance_data['taskId']}")
    assert case.status_code == 200
    assert case.json()["data"]["taskId"] == finance_data["taskId"]

    status = client.post(
        "/api/shangshufang/finance-status-memorial",
        json={"command": "给我看当前财务状况", "mode": "order"},
    )
    assert status.status_code == 200
    assert status.json()["data"]["view"]["title"] == "户部财务状况回奏"

    budget = client.post(
        "/api/shangshufang/research-budget-loop",
        json={
            "sacredEdict": "研发部申请 CNY 600000 预算",
            "department": "研发部",
            "owner": "研发负责人",
            "budgetPeriod": "2026 Q3",
            "purpose": "AI 工具链",
            "requestedAmount": 600000,
            "currency": "CNY",
            "lineItems": [{"id": "cloud", "title": "云算力", "amount": 600000, "currency": "CNY"}],
            "evidenceRefs": [{"id": "quote", "label": "报价"}],
        },
    )
    assert budget.status_code == 200
    budget_data = budget.json()["data"]
    assert budget_data["taskId"]
    assert budget_data["decisionBrief"]["id"]

    advanced = client.post(
        f"/api/shangshufang/briefs/{budget_data['decisionBrief']['id']}/decision/advance",
        json={"decision": "request_more_evidence", "reason": "补证", "manualConfirmation": False},
    )
    assert advanced.status_code == 200
    assert advanced.json()["data"]["status"] == "awaiting_evidence"


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
