"""pack_rd_report 冒烟回归 — 无 LLM、无文件系统依赖、秒级。

守住"flow_pack_rd 完整产出聚合给前端"这条新链路:
- step_id(不是渲染后的中文 agent_name)匹配 sizing/cost 确定性闸
- 综合灯色:任一闸 FAIL → red;任一 UNKNOWN/缺失 → yellow;都通过 → green
- run 不存在 / steps 缺失均诚实降级,不抛异常
"""

from src.pack_rd_report import _aggregate_pack_report, build_pack_report


class _Step:
    def __init__(self, step_id, output="", raw_response=None):
        self.step_id = step_id
        self.output = output
        self.raw_response = raw_response or {}


class _RunLog:
    def __init__(self, steps):
        self.steps = steps


def test_both_gates_pass_green():
    steps = [
        _Step(
            "sizing_validation",
            raw_response={
                "sizing_gate_verdict": {
                    "seriesTruth": "PASS",
                    "parallelTruth": "PASS",
                    "extracted": True,
                }
            },
        ),
        _Step(
            "cost_validation",
            raw_response={"cost_gate_verdict": {"green": True, "extracted": True}},
        ),
        _Step("expert_review_gate", output="五维度评审通过"),
        _Step("pack_rd_leader", output="需求规格……"),
    ]
    r = _aggregate_pack_report(_RunLog(steps), "t1")
    assert r["found"] is True
    assert r["light"] == "green"
    assert r["deterministic_gated"] is True
    assert r["sections"]["pack_rd_leader"] == "需求规格……"
    assert r["narrative"]["expert_review_gate"] == "五维度评审通过"
    assert r["missing_steps"] == {
        "gates": [],
        "narrative": ["pack_summary_expert", "executive_summary"],
    }


def test_cost_gate_fail_forces_red_even_if_sizing_pass():
    # 真实案例形状(2026-07-01 真跑):sizing 都过,但 cost 门抓到造价异常 → 总灯必须 red
    steps = [
        _Step(
            "sizing_validation",
            raw_response={
                "sizing_gate_verdict": {
                    "seriesTruth": "PASS",
                    "parallelTruth": "PASS",
                    "extracted": True,
                }
            },
        ),
        _Step(
            "cost_validation",
            raw_response={
                "cost_gate_verdict": {
                    "green": False,
                    "extracted": True,
                    "priceTruth": "FAIL",
                }
            },
        ),
    ]
    r = _aggregate_pack_report(_RunLog(steps), "t2")
    assert r["light"] == "red"
    assert r["deterministic_gated"] is True  # 两道闸都真跑了,只是判定不通过


def test_missing_gates_stays_yellow_not_fake_green():
    # 真实案例形状(2026-06-22 旧run):sizing/cost 门还没接进这条 flow,禁假绿
    steps = [_Step("pack_rd_leader", output="……")]
    r = _aggregate_pack_report(_RunLog(steps), "t3")
    assert r["light"] == "yellow"
    assert r["deterministic_gated"] is False
    assert r["missing_steps"]["gates"] == ["sizing_validation", "cost_validation"]


def test_run_not_found_no_crash():
    r = build_pack_report("this-run-does-not-exist-anywhere")
    assert r["found"] is False
    assert r["source_label"] == "NOT_FOUND"


def test_gate_step_present_but_verdict_key_missing_treated_as_absent():
    # 闸步骤跑了但 raw_response 里没有预期字段(比如上游改了格式)→ 不崩,视同缺失
    steps = [_Step("sizing_validation", raw_response={"unexpected": 1})]
    r = _aggregate_pack_report(_RunLog(steps), "t4")
    assert r["sizing_gate_verdict"] is None
    assert r["light"] == "yellow"


# ── HTTP 端点级:GET /api/swarm/sessions/{id}/pack-report ──────────────────
def _fake_user():
    class _U:
        tenant_slug = "default"
        role = "admin"

    return _U()


def test_endpoint_session_not_found_404(monkeypatch):
    from fastapi import HTTPException
    import web.routers.swarm as swarm_router

    monkeypatch.setattr(swarm_router, "load_session", lambda sid: None)
    try:
        swarm_router.api_swarm_pack_report("nope", user=_fake_user())
        assert False, "应抛 404"
    except HTTPException as e:
        assert e.status_code == 404


def test_endpoint_session_without_pack_rd_run(monkeypatch):
    import web.routers.swarm as swarm_router

    monkeypatch.setattr(
        swarm_router,
        "load_session",
        lambda sid: {"swarm_runs": [{"swarm_id": "finance", "run_id": "r1"}]},
    )
    r = swarm_router.api_swarm_pack_report("s1", user=_fake_user())
    assert r["found"] is False
    assert r["source_label"] == "NOT_APPLICABLE"


def test_endpoint_finds_pack_rd_run_and_delegates(monkeypatch):
    import web.routers.swarm as swarm_router

    monkeypatch.setattr(
        swarm_router,
        "load_session",
        lambda sid: {
            "swarm_runs": [
                {"swarm_id": "battery_stage_gate", "run_id": ""},
                {"swarm_id": "pack_rd", "run_id": "run-xyz"},
            ]
        },
    )
    captured = {}

    def _fake_build(run_id):
        captured["run_id"] = run_id
        return {"found": True, "run_id": run_id}

    monkeypatch.setattr("src.pack_rd_report.build_pack_report", _fake_build)
    r = swarm_router.api_swarm_pack_report("s2", user=_fake_user())
    assert captured["run_id"] == "run-xyz"
    assert r["session_id"] == "s2"
    assert r["found"] is True
