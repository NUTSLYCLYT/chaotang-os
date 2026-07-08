from __future__ import annotations

import json

from fastapi.testclient import TestClient

from src.chaotang_launch_loop import (
    build_launch_loop_case,
    build_prior_context,
    evaluate_launch_loop_case,
    read_launch_loop_cases,
    recall_prior_cases,
    write_launch_loop_archive,
)
from web.deps import get_current_user
from web.schemas.auth import CurrentUser


def _test_user() -> CurrentUser:
    return CurrentUser(user_id=1, username="ops", role="admin", tenant_slug="default")


def _edict(**overrides):
    base = {
        "run_id": "study-live-session",
        "source_mode": "LIVE_SWARM",
        "title": "确认上书房真链路",
        "summary": "确认上书房到蜂群再到史馆的真实闭环。",
        "evidence": [
            {"label": "用户旨意", "value": "确认上书房真链路", "source": "study_input"},
            {"label": "真实蜂群会话", "value": "study-live-session", "source": "swarm_orchestrator"},
            {
                "label": "史馆复盘入口",
                "value": "/api/swarm/sessions/study-live-session",
                "source": "swarm_replay_artifact",
            },
        ],
        "risks": ["需要保留人工签核边界。"],
        "next_actions": [
            {"type": "dispatch", "label": "交军机处推进", "target": "/command-center", "owner": "command_center"}
        ],
        "quality_gate": {
            "status": "passed",
            "score": 0.86,
            "reasons": ["live_swarm_session_completed"],
            "human_signoff_required": False,
        },
        "run_adapter": {
            "name": "swarm_orchestrator",
            "session_id": "study-live-session",
            "entry_swarm": "ai_ops",
            "replay_artifact": {
                "owner": "shiguan",
                "api_path": "/api/swarm/sessions/study-live-session",
                "path": "/tmp/swarm_sessions/study-live-session.json",
            },
        },
        "created_at": "2026-06-08T00:00:00",
    }
    base.update(overrides)
    return base


def test_build_launch_loop_case_from_live_study_edict():
    case = build_launch_loop_case(
        command="确认上书房真链路",
        edict=_edict(),
        source_id="study-live-session",
    )

    assert case["case_id"].startswith("llc_")
    assert case["source"] == "shangshufang"
    assert case["status"] == "decision_ready"
    assert case["runId"] == "study-live-session"
    assert case["archive"]["owner"] == "shiguan"
    assert case["archive"]["store"].endswith("launch_loop_cases.jsonl")
    assert case["archive"]["replayApiPath"] == "/api/swarm/sessions/study-live-session"
    assert case["archive"]["artifactPath"] == "/tmp/swarm_sessions/study-live-session.json"
    assert case["learning"]["target"] == "chaotang_operating_memory"
    assert case["learning"]["status"] == "ready_for_shiguan_review"
    assert case["nextAction"]["owner"] == "command_center"
    assert case["qualityGate"]["status"] == "passed"


def test_launch_loop_gate_blocks_missing_evidence_and_archive():
    case = build_launch_loop_case(
        command="空证据不准通过",
        edict=_edict(
            evidence=[],
            run_adapter={"name": "swarm_orchestrator", "session_id": "study-live-missing"},
        ),
        source_id="study-live-missing",
    )

    gate = evaluate_launch_loop_case(case)

    assert gate["passed"] is False
    assert "missing_evidence" in gate["reasons"]
    assert "missing_shiguan_archive_path" in gate["reasons"]


def test_write_launch_loop_archive_is_append_only(tmp_path, monkeypatch):
    archive_path = tmp_path / "launch_loop_cases.jsonl"
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(archive_path))

    case = build_launch_loop_case(command="归档一案", edict=_edict(), source_id="study-live-session")
    first = write_launch_loop_archive(case)
    second = write_launch_loop_archive({**case, "case_id": "llc_second"})

    lines = archive_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert first["archivePath"] == str(archive_path)
    assert second["archivePath"] == str(archive_path)
    assert [item["case_id"] for item in read_launch_loop_cases(path=archive_path)] == [
        case["case_id"],
        "llc_second",
    ]


def test_recall_prior_cases_filters_by_source(tmp_path, monkeypatch):
    archive_path = tmp_path / "launch_loop_cases.jsonl"
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(archive_path))

    case_a = build_launch_loop_case(command="案A", edict=_edict(run_id="task-A"), source_id="task-A")
    case_b = build_launch_loop_case(command="案B", edict=_edict(run_id="task-B"), source_id="task-B")
    write_launch_loop_archive(case_a)
    write_launch_loop_archive(case_b)

    recalled = recall_prior_cases("task-A")
    assert [c["sourceId"] for c in recalled] == ["task-A"]
    assert recall_prior_cases("") == []
    assert recall_prior_cases("task-missing") == []


def test_tenant_isolation_in_recall_and_read(tmp_path, monkeypatch):
    """铁律1：行级租户隔离 —— 一个租户读不到另一个租户的真案。"""
    archive_path = tmp_path / "launch_loop_cases.jsonl"
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(archive_path))

    a = build_launch_loop_case(
        command="同案", edict=_edict(run_id="shared-task"), source_id="shared-task", tenant_slug="tenant-a"
    )
    b = build_launch_loop_case(
        command="同案", edict=_edict(run_id="shared-task"), source_id="shared-task", tenant_slug="tenant-b"
    )
    write_launch_loop_archive(a)
    write_launch_loop_archive(b)

    # 同 taskId 不同租户 → case_id 不同，且 recall 不串租户。
    assert a["case_id"] != b["case_id"]
    a_recall = recall_prior_cases("shared-task", tenant_slug="tenant-a")
    assert [c["tenantSlug"] for c in a_recall] == ["tenant-a"]
    assert all(c["tenantSlug"] == "tenant-b" for c in read_launch_loop_cases(tenant_slug="tenant-b"))
    # 不传租户 = 不过滤（库函数保留灵活性，路由侧始终传租户）。
    assert len(read_launch_loop_cases()) == 2


def test_find_by_idempotency_key_is_tenant_scoped(tmp_path, monkeypatch):
    """find_by_idempotency_key 命中本租户已记录的 key，且不跨租户。"""
    from src.chaotang_launch_loop import find_by_idempotency_key

    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(tmp_path / "launch_loop_cases.jsonl"))
    case = build_launch_loop_case(
        command="幂等案", edict=_edict(), source_id="idem-task", tenant_slug="t1", idempotency_key="K-1"
    )
    write_launch_loop_archive(case)

    hit = find_by_idempotency_key("t1", "K-1")
    assert hit is not None and hit["case_id"] == case["case_id"]
    assert find_by_idempotency_key("t2", "K-1") is None  # 别的租户拿不到
    assert find_by_idempotency_key("t1", "") is None  # 空 key 不命中


def test_prior_context_closes_loop_and_changes_next_output(tmp_path, monkeypatch):
    """飞轮问1：上一次的分数被读回来，证明能改变下一次输出。"""
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(tmp_path / "launch_loop_cases.jsonl"))

    # 第一轮：低分。
    low = _edict(
        quality_gate={"status": "needs_review", "score": 0.50, "reasons": ["r"], "human_signoff_required": True}
    )
    first = build_launch_loop_case(command="同一真案", edict=low, source_id="loop-1")
    assert first["attempt"] == 1
    assert first["prior"]["scoreDelta"] is None
    assert first["learning"]["goldenCandidate"] is False
    write_launch_loop_archive(first)

    # 第二轮：高分 + 读回上一轮 → attempt 递增、scoreDelta>0、goldenCandidate 翻真。
    high = _edict(quality_gate={"status": "passed", "score": 0.80, "reasons": ["ok"], "human_signoff_required": False})
    prior_ctx = build_prior_context(recall_prior_cases("loop-1"))
    second = build_launch_loop_case(command="同一真案", edict=high, source_id="loop-1", prior_context=prior_ctx)

    assert second["attempt"] == 2
    assert second["prior"]["priorRuns"] == 1
    assert second["prior"]["lastScore"] == 0.50
    assert second["prior"]["scoreDelta"] == 0.30
    assert second["prior"]["improving"] is True
    assert second["learning"]["goldenCandidate"] is True  # 复利信号：质量优于上一次

    # 反向：第三轮退步 → goldenCandidate 不再为真。
    worse = _edict(
        quality_gate={"status": "needs_review", "score": 0.40, "reasons": ["down"], "human_signoff_required": True}
    )
    write_launch_loop_archive(second)
    ctx3 = build_prior_context(recall_prior_cases("loop-1"))
    third = build_launch_loop_case(command="同一真案", edict=worse, source_id="loop-1", prior_context=ctx3)
    assert third["attempt"] == 3
    assert third["prior"]["improving"] is False
    assert third["learning"]["goldenCandidate"] is False


def test_missing_quality_gate_is_not_decision_ready():
    """铁律2：缺门不得静默变成 decision_ready。"""
    edict = _edict()
    edict.pop("quality_gate")
    case = build_launch_loop_case(command="缺门真案", edict=edict, source_id="no-gate")

    assert case["qualityGate"]["status"] == "missing"
    assert case["status"] == "drafted"  # 不是 decision_ready
    gate = evaluate_launch_loop_case(case)
    assert gate["passed"] is False
    assert "missing_quality_gate" in gate["reasons"]
    # 理由集去重：同一缺陷只出现一次。
    assert len(gate["reasons"]) == len(set(gate["reasons"]))


def test_study_run_returns_launch_loop_case_and_writes_events(tmp_path, monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(tmp_path / "launch_loop_cases.jsonl"))
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "production_events.jsonl"))

    import web.routers.throne as throne_mod
    from src.production_events import recent_events
    from web.main import app

    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [
            {
                "id": "run_loop_001",
                "title": "确认上书房真链路",
                "sourceDepartment": "ops",
                "agentCode": "junji",
                "priority": "high",
                "riskLevel": "medium",
                "status": "pending",
                "summary": "把上书房、后端蜂群、史馆归档串成一条真链路。",
                "createdAt": "2026-06-08T00:00:00",
                "suggestedAction": "交军机处推进并由史馆归档。",
                "qualityScore": 4.4,
            }
        ],
    )
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    app.dependency_overrides[get_current_user] = _test_user
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/chaotang/study/run",
                json={"command": "确认上书房真链路", "mode": "dry_run", "taskId": "run_loop_001"},
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    data = response.json()["data"]
    case = data["launchLoopCase"]
    assert case["title"] == "确认上书房真链路"
    assert case["archive"]["owner"] == "shiguan"
    assert data["launchLoopGate"]["passed"] is True

    archived = (tmp_path / "launch_loop_cases.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(archived) == 1
    assert json.loads(archived[0])["case_id"] == case["case_id"]

    event_types = [event["event_type"] for event in recent_events(path=tmp_path / "production_events.jsonl")]
    assert "launch_loop_case_created" in event_types
    assert case["attempt"] == 1


def test_study_run_loop_closes_across_two_runs(tmp_path, monkeypatch):
    """端到端闭环：同一 taskId 第二次 study/run 读回第一次，attempt 递增。"""
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(tmp_path / "launch_loop_cases.jsonl"))
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "production_events.jsonl"))

    import web.routers.throne as throne_mod
    from src.production_events import recent_events
    from web.main import app

    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [
            {
                "id": "run_loop_002",
                "title": "确认上书房真链路",
                "sourceDepartment": "ops",
                "agentCode": "junji",
                "priority": "high",
                "riskLevel": "medium",
                "status": "pending",
                "summary": "把上书房、后端蜂群、史馆归档串成一条真链路。",
                "createdAt": "2026-06-08T00:00:00",
                "suggestedAction": "交军机处推进并由史馆归档。",
                "qualityScore": 4.4,
            }
        ],
    )
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    payload = {"command": "确认上书房真链路", "mode": "dry_run", "taskId": "run_loop_002"}
    app.dependency_overrides[get_current_user] = _test_user
    try:
        with TestClient(app) as client:
            first = client.post("/api/chaotang/study/run", json=payload).json()["data"]
            second = client.post("/api/chaotang/study/run", json=payload).json()["data"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert first["launchLoopCase"]["attempt"] == 1
    assert second["launchLoopCase"]["attempt"] == 2
    assert second["launchLoopCase"]["prior"]["priorRuns"] == 1
    assert second["launchLoopCase"]["prior"]["lastScore"] is not None

    events = [
        e
        for e in recent_events(path=tmp_path / "production_events.jsonl")
        if e["event_type"] == "launch_loop_case_created"
    ]
    assert [e["attempt"] for e in events] == [1, 2]


def test_study_run_idempotency_key_records_once(tmp_path, monkeypatch):
    """铁律2：带 idempotencyKey 的重放只记一次，不重复写库/发事件，不递增 attempt。"""
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    monkeypatch.setenv("CHAOTANG_LAUNCH_LOOP_ARCHIVE", str(tmp_path / "launch_loop_cases.jsonl"))
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "production_events.jsonl"))

    import web.routers.throne as throne_mod
    from src.production_events import recent_events
    from web.main import app

    monkeypatch.setattr(
        throne_mod,
        "_build_memorial_list",
        lambda: [
            {
                "id": "run_loop_003",
                "title": "确认上书房真链路",
                "sourceDepartment": "ops",
                "agentCode": "junji",
                "priority": "high",
                "riskLevel": "medium",
                "status": "pending",
                "summary": "把上书房、后端蜂群、史馆归档串成一条真链路。",
                "createdAt": "2026-06-08T00:00:00",
                "suggestedAction": "交军机处推进并由史馆归档。",
                "qualityScore": 4.4,
            }
        ],
    )
    throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

    payload = {
        "command": "确认上书房真链路",
        "mode": "dry_run",
        "taskId": "run_loop_003",
        "idempotencyKey": "idem-xyz",
    }
    app.dependency_overrides[get_current_user] = _test_user
    try:
        with TestClient(app) as client:
            first = client.post("/api/chaotang/study/run", json=payload).json()["data"]
            second = client.post("/api/chaotang/study/run", json=payload).json()["data"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert "idempotentReplay" not in first
    assert second.get("idempotentReplay") is True
    assert first["launchLoopCase"]["case_id"] == second["launchLoopCase"]["case_id"]
    assert first["launchLoopCase"]["attempt"] == 1
    assert second["launchLoopCase"]["attempt"] == 1  # 重放不递增
    assert first["launchLoopCase"]["tenantSlug"] == "default"

    archived = (tmp_path / "launch_loop_cases.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(archived) == 1  # 只写一行
    events = [
        e
        for e in recent_events(path=tmp_path / "production_events.jsonl")
        if e["event_type"] == "launch_loop_case_created"
    ]
    assert len(events) == 1  # 只发一次事件
