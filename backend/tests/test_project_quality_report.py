"""project_quality_report 冒烟回归 — 无 LLM、mock 依赖、秒级。

守住"质量司四闸聚合"的核心设计边界:红绿灯只由 sizing/cost 两道确定性闸
决定,DFM/FMEA 是 LLM 文本,禁止参与红绿灯判定,只能作为 ENGINE_BACKED
附加信息展示。
"""

from unittest.mock import patch

from src.project_quality_report import build_project_quality_report


def _session(swarm_id, run_id, status="completed", end_time="2026-07-06T10:00:00"):
    return {
        "swarm_runs": [
            {
                "swarm_id": swarm_id,
                "run_id": run_id,
                "status": status,
                "end_time": end_time,
            }
        ]
    }


def test_no_sessions_found_returns_not_found():
    with patch("src.swarm_orchestrator.list_sessions_by_project", return_value=[]):
        r = build_project_quality_report("proj-x")
    assert r["found"] is False
    assert r["source_label"] == "NOT_FOUND"


def test_dfm_and_fmea_never_drive_light_color():
    # 核心断言:sizing/cost 都缺失(pack_rd 没跑)→ light 必须仍是 yellow,
    # 即使 DFM/FMEA 文本都存在且看起来"很完整"——因为它们是 LLM 文本,不是
    # 确定性判定,不能被拿来冒充红绿灯依据。
    sessions = [
        _session("hardware_design", "hw-run-1"),
        _session("process_manufacturing", "pm-run-1"),
    ]
    with (
        patch("src.swarm_orchestrator.list_sessions_by_project", return_value=sessions),
        patch(
            "src.project_quality_report._extract_step_output",
            side_effect=lambda run_id, step_id: f"详实的 {step_id} 结论(run={run_id})",
        ),
    ):
        r = build_project_quality_report("proj-y")

    assert (
        r["light"] == "yellow"
    )  # 没有 sizing/cost,不能因为 DFM/FMEA 存在就显得"更通过"
    assert r["deterministic_gated"] is False
    assert r["dfm_review"]["source_label"] == "ENGINE_BACKED"
    assert r["process_fmea"]["source_label"] == "ENGINE_BACKED"
    assert "pack_rd(sizing/cost 确定性闸未覆盖)" in r["missing_coverage"]


def test_sizing_cost_present_drives_light_dfm_fmea_are_additive():
    sessions = [_session("pack_rd", "pr-run-1")]
    fake_pack_report = {
        "sizing_gate_verdict": {
            "seriesTruth": "PASS",
            "parallelTruth": "PASS",
            "extracted": True,
        },
        "cost_gate_verdict": {"green": True, "extracted": True},
    }
    with (
        patch("src.swarm_orchestrator.list_sessions_by_project", return_value=sessions),
        patch("src.pack_rd_report.build_pack_report", return_value=fake_pack_report),
    ):
        r = build_project_quality_report("proj-z")

    assert r["light"] == "green"
    assert r["deterministic_gated"] is True
    assert r["dfm_review"] is None  # 没跑 hardware_design,诚实为 None,不是空字符串
    assert "hardware_design(DFM 评审未覆盖)" in r["missing_coverage"]


def test_picks_latest_completed_run_when_reran():
    # 同一项目跑了两次 hardware_design(比如设计改了重做),取最新那次。
    sessions = [
        _session("hardware_design", "hw-old", end_time="2026-07-01T00:00:00"),
        _session("hardware_design", "hw-new", end_time="2026-07-06T00:00:00"),
    ]
    captured = {}

    def _fake_extract(run_id, step_id):
        captured["run_id"] = run_id
        return "DFM 结论"

    with (
        patch("src.swarm_orchestrator.list_sessions_by_project", return_value=sessions),
        patch(
            "src.project_quality_report._extract_step_output", side_effect=_fake_extract
        ),
    ):
        build_project_quality_report("proj-rerun")

    assert captured["run_id"] == "hw-new"


def test_incomplete_run_status_ignored():
    sessions = [_session("hardware_design", "hw-1", status="running")]
    with patch(
        "src.swarm_orchestrator.list_sessions_by_project", return_value=sessions
    ):
        r = build_project_quality_report("proj-incomplete")
    assert r["dfm_review"] is None
    assert "hardware_design(DFM 评审未覆盖)" in r["missing_coverage"]
