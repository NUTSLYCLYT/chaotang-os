import json
from pathlib import Path

from fastapi.testclient import TestClient

from harness.chaotang_ui_user_skills.scripts.run_user_skill_harness import (
    build_report as build_user_skill_report,
)
from web.main import app

ROOT = Path(__file__).resolve().parents[1]


def read_page() -> str:
    return (ROOT / "web" / "chaotang_ui.html").read_text(encoding="utf-8")


def test_chaotang_ui_page_contains_core_surfaces():
    html = read_page()

    assert "大殿首页" in html
    assert "军机处执行" in html
    assert "朝堂战报" in html
    assert "御史审查" in html
    assert "史馆归档" in html


def test_chaotang_ui_page_contains_signature_trio():
    html = read_page()

    assert "朝堂气象：稳" in html
    assert "圣裁" in html
    assert "钦天监伴读" in html
    assert "召唤钦天监" in html
    assert "六部调度" in html
    assert "部门契约" in html
    assert "蜂群脉冲" in html
    assert "人格原型" in html
    assert "天才设计四件套" in html
    assert "朝堂实时战报流" in html
    assert "大神会审面板" in html
    assert "史馆记忆回放" in html
    assert "钦天监预测沙盘" in html
    assert "称号进度" in html
    assert "部门等级" in html
    assert "历史圣旨" in html
    assert "大神评估" in html
    assert "用户评估" in html
    assert "用户建议" in html
    assert "御览深度" in html
    assert "企业家" in html
    assert "AI 爱好者" in html
    assert "AI 极客" in html
    assert "小白" not in html
    assert "资深爱好者" not in html
    assert "极客专家" not in html
    assert ">玩家<" not in html


def test_chaotang_ui_page_uses_launch_ready_information_architecture():
    html = read_page()

    assert 'class="hero-grid primary-signals"' in html
    assert 'class="signal-drawer advanced-surface"' in html
    assert 'data-side-card="next"' in html
    assert 'data-side-card="pulse"' in html
    assert 'data-side-card="genius"' in html
    assert ".side-secondary{display:none}" in html
    assert ".side-secondary.visible{display:block}" in html
    assert ".side{display:none}" in html
    assert "mode-senior_hobbyist" in html
    assert "mode-geek_expert" in html
    assert 'data-depth="senior_hobbyist"' in html
    assert 'data-depth="geek_expert"' in html
    assert "modeSuggestion" in html
    assert "钦天监建议确认" in html
    assert "确认切换" in html
    assert "暂不切换" in html
    assert "suggestUserMode('senior_hobbyist'" in html
    assert "suggestUserMode('geek_expert'" in html
    assert "confirmUserModeSuggestion" in html
    assert "dismissUserModeSuggestion" in html
    assert "首调 ${escapeHtml(item.firstSwarm" in html
    assert "card.setAttribute('aria-label'" in html


def test_chaotang_ui_page_preserves_commercial_fairness():
    html = read_page()

    assert "启动御史深审" in html or "启动深审" in html
    assert "不影响评分、称号或御史通过" in html
    assert "购买圣君" not in html
    assert "立刻购买" not in html
    assert "fake_countdown" not in html


def test_chaotang_ui_user_skill_harness_covers_all_boards():
    report = build_user_skill_report()

    assert report["passed"] is True
    assert report["summary"]["boards_passed"] == 5
    assert report["summary"]["segments_passed"] == 3
    assert report["summary"]["skills_passed"] == 3
    assert report["summary"]["suggestion_confirmation_ready"] is True
    assert report["summary"]["suggestion_issues"] == 0
    assert {item["board"] for item in report["board_results"]} == {
        "home",
        "work",
        "report",
        "yushi",
        "shiguan",
    }


def test_legacy_index_links_to_chaotang_experience():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

    assert 'href="/chaotang-ui"' in html
    assert "朝堂体验" in html


def test_chaotang_ui_route_serves_html():
    client = TestClient(app)
    response = client.get("/chaotang-ui")

    assert response.status_code == 200
    assert "朝堂 OS - 大殿体验" in response.text
    assert "开始朝议" in response.text


def test_chaotang_ui_font_asset_served():
    client = TestClient(app)
    response = client.get("/assets/fonts/NotoSansSC-Chaotang.ttf")

    assert response.status_code == 200
    assert response.headers["content-type"] in {
        "font/ttf",
        "application/octet-stream",
    }
    assert len(response.content) > 100_000


def test_chaotang_ui_state_uses_harness_artifacts():
    client = TestClient(app)
    response = client.get("/chaotang-ui/state")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    state = data["data"]
    assert state["weather"]["label"].startswith("朝堂气象")
    assert state["battle_report"]["grade"]
    assert state["battle_report"]["score"] >= 0
    assert state["battle_report"]["merit"]["gongji"] >= 0
    assert (
        state["commercial_offer"]["principle"]
        == "付费增强能力，不影响评分、称号、御史通过或史馆事实。"
    )
    assert state["yushi"]["decision"] in {"allow", "allow_with_conditions", "block"}
    assert "uiux" in state["sources"]
    assert "merit" in state["sources"]


def test_chaotang_ui_department_system_is_public_dashboard_contract():
    client = TestClient(app)
    response = client.get("/chaotang-ui/department-system")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert (
        data["dashboardSummary"]["routeEndpoint"]
        == "/api/chaotang/department-system/route"
    )
    assert data["dashboardSummary"]["readiness"]["sixMinistriesReady"] == 6
    playbook = {item["code"]: item for item in data["routingPlaybook"]}
    assert playbook["bingbu"]["firstSwarm"] == "haolong"
    assert "storage_aftercare" in playbook["bingbu"]["callsSwarms"]
    prototypes = {item["code"]: item for item in data["personaPrototypes"]}
    assert prototypes["bingbu"]["skillPath"].endswith("/SKILL.md")
    assert prototypes["bingbu"]["historicalPrototype"]
    assert len(data["executionVisualization"]["stages"]) >= 6
    assert [item["module"] for item in data["geniusExperienceModules"]] == [
        "live_war_report",
        "advisor_review_panel",
        "memory_replay",
        "forecast_sandbox",
    ]


def test_chaotang_ui_memorial_routes_user_task():
    client = TestClient(app)
    response = client.post(
        "/chaotang-ui/memorial",
        json={"task": "帮我审查商业模式页面风险，并生成可复用战报。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    memorial = payload["data"]["memorial"]
    route = payload["data"]["route"]
    assert memorial["status"] == "routed"
    assert memorial["task"].startswith("帮我审查")
    assert route["primaryDepartment"]["code"] == "xingbu"
    assert route["qintianjianTrigger"]["signal"]
    assert payload["data"]["work_order"]["next_action"] == route["nextAction"]
    modules = payload["data"]["genius_experience_modules"]
    assert [item["module"] for item in modules] == [
        "live_war_report",
        "advisor_review_panel",
        "memory_replay",
        "forecast_sandbox",
    ]
    assert modules[0]["events"][0]["actor"] == "qintianjian"
    assert {item["stance"] for item in modules[1]["advisors"]} >= {
        "赞成",
        "反对",
        "漏洞",
        "天才建议",
    }
    preview = payload["data"]["battle_report_preview"]
    assert preview["yushi_verdict"]
    assert preview["merit"] == {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0}
    assert "不推荐付费增强" in preview["commercial_offer"]


def test_chaotang_ui_memorial_rejects_empty_task():
    client = TestClient(app)
    response = client.post("/chaotang-ui/memorial", json={"task": "  "})

    assert response.status_code == 200
    assert response.json() == {"success": False, "error": "task 不能为空"}


def test_chaotang_ui_yushi_review_allows_route_archive_without_merit():
    client = TestClient(app)
    memorial = client.post(
        "/chaotang-ui/memorial",
        json={"task": "帮我审查商业模式页面风险，并生成可复用战报。"},
    ).json()["data"]

    response = client.post(
        "/chaotang-ui/yushi-review",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "evidence": memorial["work_order"]["evidence"],
            "yushi_gate_hint": memorial["work_order"]["yushi_gate_hint"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    review = payload["data"]["yushi_review"]
    assert review["decision"] == "allow_with_conditions"
    assert review["archive_ready"] is True
    assert review["merit_awardable"] is False
    assert "未执行蜂群，不发放功业" in review["verdict"]
    assert payload["data"]["battle_report_update"]["grade"] == "御史准归档"
    assert payload["data"]["battle_report_update"]["title"].startswith("刑部路由")


def test_chaotang_ui_yushi_review_blocks_missing_evidence():
    client = TestClient(app)
    response = client.post(
        "/chaotang-ui/yushi-review",
        json={
            "memorial_id": "memorial-empty",
            "task": "审查风险",
            "department": "xingbu",
            "evidence": [],
            "yushi_gate_hint": "red/black 风险不可绕过御史",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    review = payload["data"]["yushi_review"]
    assert review["decision"] == "block"
    assert review["archive_ready"] is False
    assert review["next_action"] == "回到军机处补证据"


def test_chaotang_ui_shiguan_archive_records_reviewed_route_without_merit():
    client = TestClient(app)
    memorial = client.post(
        "/chaotang-ui/memorial",
        json={"task": "帮我审查商业模式页面风险，并生成可复用战报。"},
    ).json()["data"]
    review = client.post(
        "/chaotang-ui/yushi-review",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "evidence": memorial["work_order"]["evidence"],
            "yushi_gate_hint": memorial["work_order"]["yushi_gate_hint"],
        },
    ).json()["data"]["yushi_review"]

    response = client.post(
        "/chaotang-ui/shiguan-archive",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "yushi_review_id": review["review_id"],
            "archive_ready": review["archive_ready"],
            "merit_awardable": review["merit_awardable"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    archive = payload["data"]["archive"]
    assert archive["status"] == "archived"
    assert archive["archive_id"].startswith("shiguan-")
    assert archive["record_type"] == "route_record"
    assert archive["merit_awardable"] is False
    assert "不发功业" in archive["learning"]
    assert payload["data"]["battle_report_update"]["grade"] == "史馆已归档"


def test_chaotang_ui_shiguan_archive_blocks_unreviewed_route():
    client = TestClient(app)
    response = client.post(
        "/chaotang-ui/shiguan-archive",
        json={
            "memorial_id": "memorial-blocked",
            "task": "审查风险",
            "department": "xingbu",
            "yushi_review_id": "yushi-blocked",
            "archive_ready": False,
            "merit_awardable": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"] == "御史未准归档，不能进入史馆"


def test_chaotang_ui_swarm_execute_creates_outcome_record_requiring_second_review():
    client = TestClient(app)
    memorial = client.post(
        "/chaotang-ui/memorial",
        json={"task": "帮我审查商业模式页面风险，并生成可复用战报。"},
    ).json()["data"]
    review = client.post(
        "/chaotang-ui/yushi-review",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "evidence": memorial["work_order"]["evidence"],
            "yushi_gate_hint": memorial["work_order"]["yushi_gate_hint"],
        },
    ).json()["data"]["yushi_review"]
    archive = client.post(
        "/chaotang-ui/shiguan-archive",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "yushi_review_id": review["review_id"],
            "archive_ready": review["archive_ready"],
            "merit_awardable": review["merit_awardable"],
        },
    ).json()["data"]["archive"]

    response = client.post(
        "/chaotang-ui/swarm-execute",
        json={
            "archive_id": archive["archive_id"],
            "task": archive["task"],
            "department": archive["department"],
            "archive_status": archive["status"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    outcome = payload["data"]["outcome"]
    assert outcome["status"] == "executed_simulated"
    assert outcome["record_type"] == "outcome_record"
    assert len(outcome["execution_trace"]) >= 6
    assert [item["module"] for item in outcome["genius_experience_modules"]] == [
        "live_war_report",
        "advisor_review_panel",
        "memory_replay",
        "forecast_sandbox",
    ]
    assert outcome["genius_experience_modules"][2]["memory_cards"]
    assert outcome["genius_experience_modules"][3]["scenarios"]
    assert outcome["execution_trace"][0]["stage"] == "route"
    assert outcome["execution_trace"][-1]["visible_status"]
    assert outcome["yushi_second_review_required"] is True
    assert outcome["merit_awardable"] is False
    assert len(outcome["evidence"]) >= 3
    assert payload["data"]["battle_report_update"]["grade"] == "成果待二审"


def test_chaotang_ui_swarm_execute_blocks_unarchived_route():
    client = TestClient(app)
    response = client.post(
        "/chaotang-ui/swarm-execute",
        json={
            "archive_id": "shiguan-not-ready",
            "task": "审查风险",
            "department": "xingbu",
            "archive_status": "pending",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": False, "error": "史馆未归档，不能执行蜂群"}


def test_chaotang_ui_yushi_second_review_awards_merit_for_executed_outcome():
    client = TestClient(app)
    memorial = client.post(
        "/chaotang-ui/memorial",
        json={"task": "帮我审查商业模式页面风险，并生成可复用战报。"},
    ).json()["data"]
    review = client.post(
        "/chaotang-ui/yushi-review",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "evidence": memorial["work_order"]["evidence"],
            "yushi_gate_hint": memorial["work_order"]["yushi_gate_hint"],
        },
    ).json()["data"]["yushi_review"]
    archive = client.post(
        "/chaotang-ui/shiguan-archive",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "yushi_review_id": review["review_id"],
            "archive_ready": review["archive_ready"],
            "merit_awardable": review["merit_awardable"],
        },
    ).json()["data"]["archive"]
    outcome = client.post(
        "/chaotang-ui/swarm-execute",
        json={
            "archive_id": archive["archive_id"],
            "task": archive["task"],
            "department": archive["department"],
            "archive_status": archive["status"],
        },
    ).json()["data"]["outcome"]

    response = client.post(
        "/chaotang-ui/yushi-second-review",
        json={
            "outcome_id": outcome["outcome_id"],
            "archive_id": outcome["archive_id"],
            "task": outcome["task"],
            "department": outcome["department"],
            "status": outcome["status"],
            "evidence": outcome["evidence"],
            "findings": outcome["findings"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    second_review = payload["data"]["second_review"]
    assert second_review["decision"] == "allow_merit"
    assert second_review["merit_awardable"] is True
    assert second_review["title_awardable"] is False
    assert payload["data"]["battle_report_update"]["grade"] == "圣裁"
    assert payload["data"]["battle_report_update"]["merit"]["gongji"] > 0
    assert "称号仍需功业系统" in second_review["verdict"]


def test_chaotang_ui_yushi_second_review_blocks_unexecuted_outcome():
    client = TestClient(app)
    response = client.post(
        "/chaotang-ui/yushi-second-review",
        json={
            "outcome_id": "outcome-blocked",
            "archive_id": "shiguan-ready",
            "task": "审查风险",
            "department": "xingbu",
            "status": "pending",
            "evidence": [],
            "findings": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    second_review = payload["data"]["second_review"]
    assert second_review["decision"] == "block"
    assert second_review["merit_awardable"] is False
    assert second_review["next_action"] == "回到蜂群执行补证据"


def test_chaotang_ui_second_review_persists_merit_ledger(monkeypatch, tmp_path):
    ledger = tmp_path / "chaotang_ui_ledger.jsonl"
    monkeypatch.setenv("FENGQUN_CHAOTANG_UI_LEDGER", str(ledger))
    client = TestClient(app)
    memorial = client.post(
        "/chaotang-ui/memorial",
        json={"task": "帮我审查商业模式页面风险，并生成可复用战报。"},
    ).json()["data"]
    review = client.post(
        "/chaotang-ui/yushi-review",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "evidence": memorial["work_order"]["evidence"],
            "yushi_gate_hint": memorial["work_order"]["yushi_gate_hint"],
        },
    ).json()["data"]["yushi_review"]
    archive = client.post(
        "/chaotang-ui/shiguan-archive",
        json={
            "memorial_id": memorial["memorial"]["id"],
            "task": memorial["memorial"]["task"],
            "department": memorial["work_order"]["department"],
            "yushi_review_id": review["review_id"],
            "archive_ready": review["archive_ready"],
            "merit_awardable": review["merit_awardable"],
        },
    ).json()["data"]["archive"]
    outcome = client.post(
        "/chaotang-ui/swarm-execute",
        json={
            "archive_id": archive["archive_id"],
            "task": archive["task"],
            "department": archive["department"],
            "archive_status": archive["status"],
        },
    ).json()["data"]["outcome"]

    response = client.post(
        "/chaotang-ui/yushi-second-review",
        json={
            "outcome_id": outcome["outcome_id"],
            "archive_id": outcome["archive_id"],
            "task": outcome["task"],
            "department": outcome["department"],
            "status": outcome["status"],
            "evidence": outcome["evidence"],
            "findings": outcome["findings"],
        },
    )

    assert response.status_code == 200
    assert ledger.exists()
    state = client.get("/chaotang-ui/state").json()["data"]
    assert state["runtime_ledger"]["event_count"] == 1
    assert state["runtime_ledger"]["total_merit"]["gongji"] == 42
    assert state["runtime_ledger"]["latest"]["grade"] == "圣裁"
    account = state["runtime_ledger"]["account_summary"]
    assert account["title"] == "勤政之主"
    assert account["next_title"] == "中兴之主"
    assert account["title_progress"]["remaining"] == 78
    assert account["department_levels"][0]["name"] == "刑部"
    assert account["department_levels"][0]["level"] == 2
    assert account["latest_reports"][0]["grade"] == "圣裁"
    evaluation = state["experience_evaluation"]
    assert evaluation["grade"] in {"A", "A-", "B+", "B"}
    assert evaluation["advisor_panel"][0]["advisor"] == "产品大神"
    assert evaluation["user_segments"][0]["segment"] == "企业家"
    assert evaluation["user_segments"][1]["segment"] == "AI 爱好者"
    assert evaluation["user_segments"][2]["segment"] == "AI 极客"
    assert "二审" in evaluation["quality_gates"][1]


def test_chaotang_ui_state_builds_account_summary_from_runtime_ledger(
    monkeypatch, tmp_path
):
    ledger = tmp_path / "chaotang_ui_ledger.jsonl"
    events = [
        {
            "event_type": "chaotang_ui_merit_awarded",
            "department": "gongbu",
            "department_name": "工部",
            "task": "打磨首页 UI",
            "score": 93,
            "grade": "圣裁",
            "merit": {"gongji": 80, "mingcha": 20, "jinglue": 45, "weiwang": 8},
            "recorded_at": "2026-06-07T10:00:00+00:00",
        },
        {
            "event_type": "chaotang_ui_merit_awarded",
            "department": "xingbu",
            "department_name": "刑部",
            "task": "复核商业增强边界",
            "score": 91,
            "grade": "圣裁",
            "merit": {"gongji": 42, "mingcha": 18, "jinglue": 24, "weiwang": 6},
            "recorded_at": "2026-06-07T11:00:00+00:00",
        },
    ]
    ledger.write_text(
        "\n".join(json.dumps(event, ensure_ascii=False) for event in events),
        encoding="utf-8",
    )
    monkeypatch.setenv("FENGQUN_CHAOTANG_UI_LEDGER", str(ledger))

    # hermetic 隔离:体验评分会读真实 harness/yushi_global_gate/artifacts/latest.json,
    # 其 red/black(环境态)会扣分,污染本测试对「健康 ledger → 评分逻辑」的断言。
    # 仅把 yushi 环境态红黑归零,其余 artifact 仍走真实读取,保持其它断言不变。
    import web.main as _wm

    _orig_artifact = _wm._read_json_artifact
    monkeypatch.setattr(
        _wm,
        "_read_json_artifact",
        lambda p: (
            {"summary": {"green": 2, "yellow": 0, "red": 0, "black": 0}}
            if "yushi_global_gate" in p
            else _orig_artifact(p)
        ),
    )

    client = TestClient(app)
    state = client.get("/chaotang-ui/state").json()["data"]

    summary = state["runtime_ledger"]["account_summary"]
    assert state["runtime_ledger"]["event_count"] == 2
    assert state["runtime_ledger"]["total_merit"]["gongji"] == 122
    assert summary["title"] == "中兴之主"
    assert summary["next_title"] == "圣君"
    assert summary["title_progress"]["remaining"] == 178
    assert summary["department_levels"][0]["name"] == "工部"
    assert summary["department_levels"][0]["level"] == 3
    assert summary["latest_reports"][0]["department_name"] == "刑部"
    assert summary["latest_reports"][1]["department_name"] == "工部"
    evaluation = state["experience_evaluation"]
    assert evaluation["score"] >= 70
    assert evaluation["next_best_action"]
    assert evaluation["advisor_panel"][1]["advisor"] == "美工大神"
    assert {item["segment"] for item in evaluation["user_segments"]} == {
        "企业家",
        "AI 爱好者",
        "AI 极客",
    }
