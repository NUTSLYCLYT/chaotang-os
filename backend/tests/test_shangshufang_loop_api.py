from fastapi.testclient import TestClient

from web.main import app


def test_specialist_jinyiwei_keywords_remain_routable():
    from src.shangshufang_loop import infer_departments

    assert "锦衣卫" in infer_departments("这条情报的信源可信度存疑，需要查证是不是谣言")


def _formalize_task_for_decision(session_local, task_id: str) -> str:
    """Seed the new quality/provenance boundary for legacy decision API tests."""
    from src.db.models import CourtReview
    from src.formal_memorial import formalize_memorial

    db = session_local()
    review = (
        db.query(CourtReview)
        .filter_by(task_id=task_id)
        .order_by(CourtReview.created_at.desc())
        .first()
    )
    assert review is not None
    review_id = review.id
    formal = formalize_memorial(
        db,
        task_id=task_id,
        review_id=review_id,
        swarm_result={
            "swarm_run": {
                "id": f"test_run_{task_id}",
                "task_id": task_id,
                "review_id": review_id,
                "source_label": "LIVE_SWARM",
            },
            "quality_result": {
                "id": f"test_quality_{task_id}",
                "passed": True,
                "blocking_reasons": [],
            },
        },
    )
    content_hash = formal.content_hash
    db.commit()
    db.close()
    return content_hash


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
    assert '"agent": "chancellor"' in body


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


def test_confirm_direct_task_creates_simple_receipt_without_swarm(
    isolated_session_local,
):
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


def test_confirm_edict_vetoed_route_returns_full_contract_and_honest_status(
    isolated_session_local,
):
    """门下省封驳时,响应契约(route/routing_plan/memorial)必须齐全,
    task.status 必须诚实反映"被拦住,等人工确认",不能是 executing/未变。"""
    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "我要去美国看世界杯决赛"},
    )
    task_id = draft_response.json()["data"]["task_id"]

    confirm_response = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )

    assert confirm_response.status_code == 200
    confirm_data = confirm_response.json()["data"]
    assert confirm_data["status"] == "menxia_veto_pending"
    # 前端(unified-loop.ts 等)无条件解引用 result.memorial.* / result.route.*，
    # 这几个字段必须存在，不能只返回 route_decision。
    assert confirm_data["route"]["mode"] in ("direct", "cluster")
    assert confirm_data["routing_plan"]["ministry_candidates"]
    assert confirm_data["memorial"]["verdict"] == "已封驳"
    assert confirm_data["memorial"]["quality_gate"]["human_signoff_required"] is True
    # 2026-07-18 审计发现:前端 explicitGate() 只读 quality_gate.passed(布尔)，
    # 不读 quality_gate.status(字符串)——漏填 passed 会让 junjichu 页面
    # LIVE 模式下的 isBlocked 判断永远不触发，绕过封驳文案。
    assert confirm_data["memorial"]["quality_gate"]["passed"] is False
    assert confirm_data["memorial"]["quality_gate"]["blocking_issues"]
    assert confirm_data["review_id"]
    # 2026-07-18:memorial title 曾经硬编码"军机处会审回奏"——封驳发生在任何
    # 部门会审之前，那个 title 编造了一段没发生过的会审过程。
    assert confirm_data["memorial"]["title"] == "门下省封驳纪要"
    assert "军机处" not in confirm_data["memorial"]["title"]
    assert confirm_data["memorial"]["decision_options"] == []
    # 2026-07-18 审计发现:这个响应体挨个漏过 decision_options/evidence_gaps/
    # next_best_action/source_label/quality_gate.passed/blocking_issues/
    # conflict_summary[].departments 六轮——不再逐个手写断言(下次漏别的字段
    # 还是测不出来),改用镜像前端契约的统一校验器，缺哪个字段都会显式报出来。
    from src.shangshufang_memorial_contract import find_memorial_contract_violations

    violations = find_memorial_contract_violations(confirm_data["memorial"])
    assert not violations, f"memorial 违反前端必填契约: {violations}"

    status_response = client.get(f"/api/shangshufang/tasks/{task_id}/status")
    assert status_response.status_code == 200
    status_data = status_response.json()["data"]
    assert status_data["task"]["status"] == "menxia_veto_pending"
    assert status_data["review"]["review_status"] == "menxia_veto_pending"


def test_confirm_edict_retry_on_vetoed_task_is_idempotent(isolated_session_local):
    """重复点击/网络重试确认同一个已封驳任务不能崩:CourtReview.id 由 task.id
    确定性生成,menxia_veto_pending 不进 _TERMINAL_CONFIRMED_STATUSES 的话，
    重试会绕开幂等短路、二次 INSERT 撞 court_reviews.id 唯一约束
    (2026-07-18 实测复现:sqlite3.IntegrityError)。"""
    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "我要去美国看世界杯决赛"},
    )
    task_id = draft_response.json()["data"]["task_id"]

    first = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )
    assert first.json()["success"] is True
    assert first.json()["data"]["status"] == "menxia_veto_pending"

    retry = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )
    assert retry.json()["success"] is True, retry.json()
    assert retry.json()["data"]["status"] == "menxia_veto_pending"
    assert retry.json()["data"]["review_id"] == first.json()["data"]["review_id"]


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


def test_confirm_edict_twice_is_idempotent_and_does_not_redispatch(
    isolated_session_local,
):
    """独立审查发现(2026-07-10)的 HIGH 修复缺一条 HTTP 层回归：同一 task_id 重复
    调用 confirm-edict(重复点击/浏览器重试)不应该重复写 ChancellorRouteDecision，
    也不应该产生第二个 CourtReview，第二次调用要原样返回第一次的结果。"""
    from src.db.models import ChancellorRouteDecision, CourtReview

    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "这个合同能不能直接签？"},
    )
    task_id = draft_response.json()["data"]["task_id"]

    first = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )
    assert first.status_code == 200
    first_data = first.json()["data"]
    assert first_data["status"] == "edict_recorded"

    second = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )
    assert second.status_code == 200
    second_data = second.json()["data"]
    assert "幂等" in second_data["message"]
    assert second_data["review_id"] == first_data["review_id"]
    assert (
        second_data["route_decision"]["decision_id"]
        == first_data["route_decision"]["decision_id"]
    )

    db = isolated_session_local()
    try:
        decision_count = (
            db.query(ChancellorRouteDecision).filter_by(task_id=task_id).count()
        )
        review_count = db.query(CourtReview).filter_by(task_id=task_id).count()
    finally:
        db.close()
    assert decision_count == 1
    assert review_count == 1


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
    content_hash = _formalize_task_for_decision(isolated_session_local, task_id)

    decision_response = client.post(
        f"/api/shangshufang/tasks/{task_id}/decision",
        json={
            "action": "archive",
            "reason": "先归档当前会审结果",
            "human_confirmed": True,
            "expected_final_memorial_content_hash": content_hash,
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
        content_hash = None
        if action == "adopt":
            content_hash = _formalize_task_for_decision(
                isolated_session_local, task_id
            )

        decision_response = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": action,
                "reason": f"test {action}",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )

        assert decision_response.status_code == 200
        payload = decision_response.json()
        assert payload["success"] is True
        assert payload["data"]["status"] == expected
        if action == "adopt":
            assert payload["data"]["archive_record"]["archive_id"]


def test_archive_preserves_original_decision_action_alias(isolated_session_local):
    """2026-07-12 Codex 停止前审查纠正:状态转移收口(apply_task_decision)第一版
    要求调用方先把 "approve"/"archive"/"adopt" 这类别名归一化成 canonical
    "adopt" 再传入，导致 ShiguanArchive.emperor_decision_json 里存的 action
    恒为 "adopt"，丢失了"陛下当时具体点的是哪个按钮"这个史馆归档信息。这里
    直接查数据库验证:提交 "approve" 和 "archive" 两个不同别名，归档记录里
    存的 action 必须原样保留，不能都被抹平成 "adopt"。"""
    import json as _json_mod

    from src.db.models import ShiguanArchive

    client = TestClient(app)

    for action in ("approve", "archive", "adopt"):
        draft = client.post(
            "/api/shangshufang/draft-edict",
            json={"raw_question": f"判断这个方案是否推进：{action}"},
        ).json()["data"]
        task_id = draft["task_id"]
        client.post(
            "/api/shangshufang/confirm-edict",
            json={"task_id": task_id, "confirmed": True},
        )
        content_hash = _formalize_task_for_decision(
            isolated_session_local, task_id
        )
        resp = client.post(
            f"/api/shangshufang/tasks/{task_id}/decision",
            json={
                "action": action,
                "reason": "test",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "archived"

        db = isolated_session_local()
        try:
            archive = db.query(ShiguanArchive).filter_by(task_id=task_id).first()
        finally:
            db.close()
        assert archive is not None, f"task {task_id} 没有生成史馆归档记录"
        stored_action = _json_mod.loads(archive.emperor_decision_json)["action"]
        assert stored_action == action, (
            f"提交的 action={action!r}，但史馆归档记录里存的是 {stored_action!r}"
            "——原始动作别名被归一化抹平了"
        )


def test_task_decision_and_brief_decision_advance_agree(isolated_session_local):
    """2026-07-12 收口:shangshufang_task_decision(/tasks/{id}/decision)和
    shangshufang_brief_decision_advance(/briefs/{id}/decision/advance)此前各自
    独立实现 adopt/request_evidence/recheck/reject 四类裁决的状态转移，现在都
    改为调用共享的 apply_task_decision。这里用参数化断言证明两个入口对等价
    动作产生完全一致的 task.status，而不是分别断言两次可能悄悄不一致的
    期望值——这正是本次收口要防止再发生的那类漂移。"""
    client = TestClient(app)

    cases = [
        ("adopt", "issue_decree", "archived"),
        ("followup", "request_more_evidence", "awaiting_evidence"),
        ("recheck", "request_review", "reviewing"),
        ("reject", "reject", "rejected"),
    ]

    for task_action, brief_decision, expected_status in cases:
        # 入口一:/tasks/{id}/decision
        draft_a = client.post(
            "/api/shangshufang/draft-edict",
            json={"raw_question": f"判断预算案A是否推进：{task_action}"},
        ).json()["data"]
        task_id_a = draft_a["task_id"]
        client.post(
            "/api/shangshufang/confirm-edict",
            json={"task_id": task_id_a, "confirmed": True},
        )
        content_hash_a = None
        if task_action == "adopt":
            content_hash_a = _formalize_task_for_decision(
                isolated_session_local, task_id_a
            )
        resp_a = client.post(
            f"/api/shangshufang/tasks/{task_id_a}/decision",
            json={
                "action": task_action,
                "reason": "test",
                "human_confirmed": True,
                "expected_final_memorial_content_hash": content_hash_a,
            },
        )
        assert resp_a.status_code == 200
        status_a = resp_a.json()["data"]["status"]

        # 入口二:/briefs/{id}/decision/advance
        draft_b = client.post(
            "/api/shangshufang/draft-edict",
            json={"raw_question": f"判断预算案B是否推进：{task_action}"},
        ).json()["data"]
        task_id_b = draft_b["task_id"]
        client.post(
            "/api/shangshufang/confirm-edict",
            json={"task_id": task_id_b, "confirmed": True},
        )
        content_hash_b = None
        if task_action == "adopt":
            content_hash_b = _formalize_task_for_decision(
                isolated_session_local, task_id_b
            )
        status_response = client.get(f"/api/shangshufang/tasks/{task_id_b}/status")
        brief_id = status_response.json()["data"]["review"]["review_id"]
        resp_b = client.post(
            f"/api/shangshufang/briefs/{brief_id}/decision/advance",
            json={
                "decision": brief_decision,
                "reason": "test",
                "manualConfirmation": True,
                "expectedFinalMemorialContentHash": content_hash_b,
            },
        )
        assert resp_b.status_code == 200
        status_b = resp_b.json()["data"]["status"]

        assert status_a == expected_status, (
            f"/tasks/{{id}}/decision action={task_action} 产生了 {status_a}，"
            f"期望 {expected_status}"
        )
        assert status_b == expected_status, (
            f"/briefs/{{id}}/decision/advance decision={brief_decision} 产生了 "
            f"{status_b}，期望 {expected_status}"
        )
        assert status_a == status_b, (
            f"两个入口对等价动作({task_action} vs {brief_decision})产生了不同状态: "
            f"{status_a} vs {status_b}"
        )


def test_brief_adjudication_cannot_bypass_current_memorial_hash(
    isolated_session_local,
):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断兼容入口是否可以绕过版本裁决门"},
    ).json()["data"]
    task_id = draft["task_id"]
    client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": task_id, "confirmed": True},
    )
    _formalize_task_for_decision(isolated_session_local, task_id)
    status = client.get(
        f"/api/shangshufang/tasks/{task_id}/status"
    ).json()["data"]
    brief_id = status["review"]["review_id"]

    response = client.post(
        f"/api/shangshufang/briefs/{brief_id}/decision/advance",
        json={
            "decision": "issue_decree",
            "reason": "缺少精确版本",
            "manualConfirmation": True,
        },
    ).json()

    assert response["success"] is False
    assert "content hash" in response["error"]


def test_home_reads_pending_confirm_decision_and_evidence(isolated_session_local):
    client = TestClient(app)
    draft = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断这个 PACK 项目是否推进。"},
    ).json()["data"]
    confirmed_task = draft["task_id"]
    client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": confirmed_task, "confirmed": True},
    )
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
    client.post(
        "/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True}
    )

    deepen = client.post(f"/api/shangshufang/tasks/{task_id}/swarm-deepen")
    assert deepen.status_code == 200
    assert deepen.json()["success"] is True
    assert deepen.json()["data"]["task_id"] == task_id


def test_pack_swarm_loop_endpoint(isolated_session_local):
    client = TestClient(app)
    pack = client.post(
        "/api/shangshufang/pack-swarm-loop",
        json={
            "command": "请 PACK 蜂群协同评估储能电池包建设方案",
            "mode": "order",
            "source_urls": [],
        },
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
    client.post(
        "/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True}
    )

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
        json={
            "message": {
                "role": "user",
                "label": "陛下",
                "text": "测试消息",
                "mode": "order",
            }
        },
    )
    assert im.status_code == 200
    messages = client.get("/api/shangshufang/im?mode=order").json()["data"]["messages"]
    assert any(item["text"] == "测试消息" for item in messages)

    returned = client.post(
        "/api/shangshufang/edict-return",
        json={
            "taskId": task_id,
            "sessionId": "session_test",
            "mode": "order",
            "command": "测试",
            "edictView": {},
            "finalOutputs": [],
        },
    )
    assert returned.status_code == 200
    assert returned.json()["success"] is True


def test_finance_intel_status_and_budget_endpoints(isolated_session_local, monkeypatch):
    import web.routers.shangshufang as shangshufang_router

    monkeypatch.setattr(
        shangshufang_router,
        "gather_sec_evidence",
        lambda ticker: {
            "sourceUrls": [
                "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
                "https://data.sec.gov/submissions/CIK0000320193.json",
            ],
            "verified": True,
            "cik": "0000320193",
        },
    )
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

    case = client.get(
        f"/api/shangshufang/finance-intel-loop/cases/{finance_data['taskId']}"
    )
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
            "lineItems": [
                {"id": "cloud", "title": "云算力", "amount": 600000, "currency": "CNY"}
            ],
            "evidenceRefs": [{"id": "quote", "label": "报价"}],
        },
    )
    assert budget.status_code == 200
    budget_data = budget.json()["data"]
    assert budget_data["taskId"]
    assert budget_data["decisionBrief"]["id"]

    advanced = client.post(
        f"/api/shangshufang/briefs/{budget_data['decisionBrief']['id']}/decision/advance",
        json={
            "decision": "request_more_evidence",
            "reason": "补证",
            "manualConfirmation": False,
        },
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
