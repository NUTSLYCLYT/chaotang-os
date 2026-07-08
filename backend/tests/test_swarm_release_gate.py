from __future__ import annotations

import json


def test_swarm_sessions_derive_release_gate_from_run_qa(isolated_swarm_sessions_dir):
    from fastapi.testclient import TestClient
    from web.main import app

    tmp_path = isolated_swarm_sessions_dir

    (tmp_path / "20260607_qa_fail.json").write_text(
        json.dumps(
            {
                "session_id": "20260607_qa_fail",
                "task_input": "本司样本上线前法律风险闸门",
                "status": "completed",
                "start_time": "2026-06-07T10:00:00+08:00",
                "end_time": "2026-06-07T10:00:41+08:00",
                "swarm_runs": [
                    {
                        "swarm_id": "legal_review",
                        "run_id": "legal-run-qa-fail",
                        "status": "completed",
                        "qa_result": {
                            "qa_result": "fail",
                            "issues": [{"severity": "critical", "problem": "缺少发布门禁"}],
                        },
                    }
                ],
                "events": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (tmp_path / "20260607_qa_pass.json").write_text(
        json.dumps(
            {
                "session_id": "20260607_qa_pass",
                "task_input": "普通内部研判",
                "status": "completed",
                "start_time": "2026-06-07T11:00:00+08:00",
                "end_time": "2026-06-07T11:00:12+08:00",
                "swarm_runs": [
                    {
                        "swarm_id": "internal_review",
                        "run_id": "internal-run-qa-pass",
                        "status": "completed",
                        "qa_result": {"qa_result": "pass", "issues": []},
                    }
                ],
                "events": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with TestClient(app) as client:
        response = client.get("/api/swarm/sessions")

    assert response.status_code == 200
    by_id = {item["session_id"]: item for item in response.json()}
    assert by_id["20260607_qa_fail"]["release_gate"] == "blocked"
    assert by_id["20260607_qa_pass"]["release_gate"] == "clear"


def test_swarm_session_detail_includes_release_gate(isolated_swarm_sessions_dir):
    from fastapi.testclient import TestClient
    from web.main import app

    tmp_path = isolated_swarm_sessions_dir
    (tmp_path / "20260607_detail.json").write_text(
        json.dumps(
            {
                "session_id": "20260607_detail",
                "task_input": "对外发布材料复核",
                "status": "completed",
                "start_time": "2026-06-07T12:00:00+08:00",
                "end_time": "2026-06-07T12:00:20+08:00",
                "swarm_runs": [
                    {
                        "swarm_id": "legal_review",
                        "run_id": "legal-run-blocked",
                        "status": "completed",
                        "qa_result": {"qa_result": "fail", "issues": ["缺少审签"]},
                    }
                ],
                "events": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with TestClient(app) as client:
        response = client.get("/api/swarm/sessions/20260607_detail")

    assert response.status_code == 200
    assert response.json()["release_gate"] == "blocked"


def test_crashed_session_with_no_runs_is_unknown_not_clear(isolated_swarm_sessions_dir):
    """顶尖高手会审顺手扫出的同款洞:orchestrator 在任何 run 落盘前就崩了,
    swarm_runs=[] 但 session status=failed——不该显示 release_gate=clear
    (冒充"已审过没问题"),没有 run 记录就没法宣称"清白"。
    """
    from fastapi.testclient import TestClient
    from web.main import app

    tmp_path = isolated_swarm_sessions_dir
    (tmp_path / "20260607_crashed.json").write_text(
        json.dumps(
            {
                "session_id": "20260607_crashed",
                "task_input": "orchestrator 初始化就崩了",
                "status": "failed",
                "start_time": "2026-06-07T13:00:00+08:00",
                "end_time": "2026-06-07T13:00:01+08:00",
                "swarm_runs": [],
                "events": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with TestClient(app) as client:
        list_resp = client.get("/api/swarm/sessions")
        detail_resp = client.get("/api/swarm/sessions/20260607_crashed")

    by_id = {item["session_id"]: item for item in list_resp.json()}
    assert by_id["20260607_crashed"]["release_gate"] == "unknown"
    assert detail_resp.json()["release_gate"] == "unknown"
