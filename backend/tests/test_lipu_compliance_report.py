"""lipu_compliance_report 冒烟回归 — mock FlowEngine/build_lipu_verdict,无 LLM,秒级。

核心断言:review_opinion(LLM 软意见)绝不能影响 light 红绿灯——那只能由
lipu_vet 的确定性素材回链判定决定,跟工部质量司四闸同一条设计铁律。
"""

from unittest.mock import patch

from src.lipu_compliance_report import build_lipu_compliance_report


class _Step:
    def __init__(self, step_id, output=""):
        self.step_id = step_id
        self.output = output


class _RunLog:
    def __init__(self, steps, final_output=""):
        self.steps = steps
        self.final_output = final_output


def test_review_opinion_never_overrides_hard_gate_light():
    # lipu_vet 硬闸判 red,即使 lipu_review 软意见写得"看起来很棒" -> light 必须仍是 red
    fake_run_log = _RunLog(
        steps=[_Step("lipu_review", "这篇稿子写得非常好,建议直接发布,质量优秀")],
        final_output="成稿正文……",
    )
    fake_doc = {
        "light": "red",
        "headline": "暂缓发出 —— 检出编造",
        "items": [{"level": "red"}],
    }

    with (
        patch("src.flow_engine.FlowEngine") as MockEngine,
        patch("src.lipu_vet.build_lipu_verdict", return_value=fake_doc),
    ):
        MockEngine.return_value.run.return_value = fake_run_log
        r = build_lipu_compliance_report("测试任务")

    assert r["light"] == "red"  # 硬闸说了算,软意见不能拉绿
    assert r["deterministic_gated"] is True
    assert r["review_opinion"]["text"] == "这篇稿子写得非常好,建议直接发布,质量优秀"
    assert r["review_opinion"]["source_label"] == "LLM_ONLY"


def test_dict_final_output_does_not_crash_vet_publication():
    # 真实 bug(2026-07-07 /verify 真实调用发现):QA 输出的 final_output 字段有时
    # 是分段 dict(非字符串),build_lipu_verdict 内部 vet_publication 用正则扫描,
    # 传 dict 会 TypeError 崩溃。之前的 mock 测试全用字符串 final_output,测不出来。
    fake_run_log = _RunLog(
        steps=[_Step("lipu_review", "意见")],
        final_output={"title": "标题", "body": "正文素材:1500次"},
    )
    fake_doc = {"light": "green", "headline": "可发", "items": []}

    with (
        patch("src.flow_engine.FlowEngine") as MockEngine,
        patch("src.lipu_vet.build_lipu_verdict", return_value=fake_doc) as mock_verdict,
    ):
        MockEngine.return_value.run.return_value = fake_run_log
        r = build_lipu_compliance_report("测试任务")

    assert r["light"] == "green"
    draft_arg = mock_verdict.call_args[0][0]
    assert isinstance(draft_arg, str)  # dict 必须先拍平成字符串,不能直传
    assert "标题" in draft_arg and "1500次" in draft_arg


def test_missing_review_step_reports_gap_honestly():
    fake_run_log = _RunLog(steps=[_Step("lipu_compose", "成稿")], final_output="成稿")
    fake_doc = {"light": "green", "headline": "可发", "items": []}

    with (
        patch("src.flow_engine.FlowEngine") as MockEngine,
        patch("src.lipu_vet.build_lipu_verdict", return_value=fake_doc),
    ):
        MockEngine.return_value.run.return_value = fake_run_log
        r = build_lipu_compliance_report("测试任务")

    assert r["review_opinion"] is None
    assert "lipu_review(合规软意见)未产出" in r["missing_coverage"]


def test_xhs_monitor_gap_always_disclosed():
    fake_run_log = _RunLog(steps=[_Step("lipu_review", "意见")], final_output="成稿")
    fake_doc = {"light": "yellow", "headline": "可发草稿", "items": []}

    with (
        patch("src.flow_engine.FlowEngine") as MockEngine,
        patch("src.lipu_vet.build_lipu_verdict", return_value=fake_doc),
    ):
        MockEngine.return_value.run.return_value = fake_run_log
        r = build_lipu_compliance_report("测试任务")  # 未传 project_id

    assert r["xhs_monitor_opinion"] is None
    assert any("未传 project_id" in m for m in r["missing_coverage"])


def test_xhs_monitor_third_source_joins_when_project_id_resolves():
    # 核心断言:project_id 关联到已完成的 xiaohongshu 会话时,第三源真正接入,
    # 但 light 依然只由 lipu_vet 硬闸决定(舆情软意见再吓人也不能拉红/拉绿)。
    fake_run_log = _RunLog(steps=[_Step("lipu_review", "意见")], final_output="成稿")
    fake_doc = {"light": "green", "headline": "可发", "items": []}
    fake_sessions = [
        {
            "swarm_runs": [
                {
                    "swarm_id": "xiaohongshu",
                    "run_id": "xhs-run-1",
                    "status": "completed",
                    "end_time": "2026-07-07T00:00:00",
                }
            ]
        }
    ]

    with (
        patch("src.flow_engine.FlowEngine") as MockEngine,
        patch("src.lipu_vet.build_lipu_verdict", return_value=fake_doc),
        patch(
            "src.swarm_orchestrator.list_sessions_by_project",
            return_value=fake_sessions,
        ),
        patch(
            "src.lipu_compliance_report._extract_step_output",
            return_value="舆情监测发现负面评论增多,建议关注",
        ),
    ):
        MockEngine.return_value.run.return_value = fake_run_log
        r = build_lipu_compliance_report("测试任务", project_id="proj-123")

    assert r["light"] == "green"  # 硬闸依然说了算
    assert r["xhs_monitor_opinion"]["text"] == "舆情监测发现负面评论增多,建议关注"
    assert r["xhs_monitor_opinion"]["source_label"] == "ENGINE_BACKED"
    assert r["xhs_monitor_opinion"]["run_id"] == "xhs-run-1"
    assert not any("xhs_monitor" in m for m in r["missing_coverage"])


def test_xhs_monitor_project_id_given_but_no_completed_session():
    fake_run_log = _RunLog(steps=[_Step("lipu_review", "意见")], final_output="成稿")
    fake_doc = {"light": "yellow", "headline": "可发草稿", "items": []}

    with (
        patch("src.flow_engine.FlowEngine") as MockEngine,
        patch("src.lipu_vet.build_lipu_verdict", return_value=fake_doc),
        patch("src.swarm_orchestrator.list_sessions_by_project", return_value=[]),
    ):
        MockEngine.return_value.run.return_value = fake_run_log
        r = build_lipu_compliance_report("测试任务", project_id="proj-empty")

    assert r["xhs_monitor_opinion"] is None
    assert any("未找到已完成的 xiaohongshu 会话" in m for m in r["missing_coverage"])
