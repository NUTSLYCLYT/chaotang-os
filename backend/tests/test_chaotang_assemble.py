# tests/test_chaotang_assemble.py
import yaml
from src import chaotang_orchestrator as orch


def _plan(**kw):
    base = {
        "rawCommand": "评估项目",
        "intent": "评估",
        "taskType": "analysis",
        "ministers": ["hu_bu", "xing_bu"],
        "groups": ["finlaw"],
    }
    base.update(kw)
    return base


def test_assemble_writes_dag_with_council_group_aggregate(tmp_path):
    path = orch.assemble_flow(_plan(), task_id="t1", out_dir=tmp_path)
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    ids = [s["id"] for s in cfg["steps"]]
    assert "council_hu_bu" in ids and "council_xing_bu" in ids
    assert "group_finlaw_dispatch" in ids and "group_finlaw" in ids
    assert "aggregate" in ids
    assert cfg["steps"][0]["id"] == "decree"
    assert next(s for s in cfg["steps"] if s["id"] == "council_hu_bu")[
        "depends_on"
    ] == ["decree"]
    spawn_step = next(s for s in cfg["steps"] if s["id"] == "group_finlaw")
    assert spawn_step["step_type"] == "spawn"
    assert spawn_step["model"] == orch._CHEAP_MODEL
    council = next(s for s in cfg["steps"] if s["id"] == "council_hu_bu")
    assert council["model"] == orch._STRONG_MODEL
    agg = next(s for s in cfg["steps"] if s["id"] == "aggregate")
    assert set(agg["depends_on"]) == {"group_finlaw"}


def test_council_all_enables_all_six_groups(tmp_path):
    path = orch.assemble_flow(
        _plan(groups=["intel", "content", "finlaw", "rnd", "exec", "review"]),
        task_id="t2",
        out_dir=tmp_path,
    )
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    spawn_ids = [s["id"] for s in cfg["steps"] if s.get("step_type") == "spawn"]
    assert len(spawn_ids) == 6


def test_assemble_injects_real_engine_grounding_for_registered_minister(
    tmp_path, monkeypatch
):
    import src.bingbu_battlecard as bb

    monkeypatch.setattr(
        bb,
        "run_bingbu_battlecard",
        lambda task_input, **kw: {
            "doc_type": "brief",
            "dept": "bingbu",
            "case_id": "BB-x",
            "light": "yellow",
            "headline": "可推进 —— 但先看 1 处再跟进",
            "shielded": "为你挡了什么",
            "items": [
                {
                    "level": "yellow",
                    "title": "线索评分:偏好高",
                    "fix": "未经复核",
                    "evidence_ref": "x",
                }
            ],
            "adversarial": None,
            "actions": [],
            "provenance": {
                "advisors": [],
                "archive_id": None,
                "gate": "pending",
                "rag_grounded": False,
                "deterministic_gated": False,
                "grounding": "none",
            },
            "source_label": "LIVE_SWARM",
            "signed": False,
            "seal": {"stamp": "令旗印", "color": "赤橙", "sealed_archive": None},
        },
    )
    path = orch.assemble_flow(
        _plan(ministers=["hu_bu", "bing_bu"], rawCommand="要不要跟进这次渠道谈判"),
        task_id="t_ground",
        out_dir=tmp_path,
    )
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    council_bing_bu = next(s for s in cfg["steps"] if s["id"] == "council_bing_bu")
    assert "真实引擎参考" in council_bing_bu["prompt_inline"]
    council_hu_bu = next(s for s in cfg["steps"] if s["id"] == "council_hu_bu")
    assert (
        "真实引擎参考" not in council_hu_bu["prompt_inline"]
    )  # 户部未注册,维持现状纯人设prompt


def test_assemble_grounding_failure_does_not_break_assembly(tmp_path, monkeypatch):
    import src.bingbu_battlecard as bb

    def _boom(task_input, **kw):
        raise RuntimeError("flow engine down")

    monkeypatch.setattr(bb, "run_bingbu_battlecard", _boom)
    path = orch.assemble_flow(
        _plan(ministers=["bing_bu"], rawCommand="要不要跟进这次渠道谈判"),
        task_id="t_ground_fail",
        out_dir=tmp_path,
    )
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    council_bing_bu = next(s for s in cfg["steps"] if s["id"] == "council_bing_bu")
    assert (
        "真实引擎参考" not in council_bing_bu["prompt_inline"]
    )  # 引擎失败,维持现状不阻断装配


def test_assemble_cross_references_jinyiwei_intel_to_other_ministers(
    tmp_path, monkeypatch
):
    """L3(丞相会审)版本的部门互引:锦衣卫(如在会审名单里)真实情报要拼进其余
    大臣的 prompt——跟 L4(上书房 _run_departments_cross_referenced)同款设计。"""
    import src.jinyiwei_agent as ja
    import src.xingbu_verdict as xv

    monkeypatch.setattr(
        ja,
        "gather_intel",
        lambda query, *, search_fn=None, archive=True: {
            "doc_type": "brief",
            "dept": "jinyiwei",
            "case_id": "JYW-x",
            "light": "green",
            "headline": "情报可信",
            "items": [
                {
                    "level": "green",
                    "title": "客户资金链正常",
                    "fix": None,
                    "evidence_ref": "x",
                }
            ],
            "adversarial": None,
            "actions": [],
            "provenance": {
                "advisors": [],
                "archive_id": "JYW-x",
                "gate": "pending",
                "rag_grounded": False,
                "deterministic_gated": True,
                "grounding": "deterministic",
            },
            "source_label": "LIVE_ENGINE",
            "signed": False,
            "seal": {
                "stamp": "绣春刀印",
                "color": "玄黑暗红",
                "sealed_archive": "JYW-x",
            },
        },
    )
    monkeypatch.setattr(
        xv, "run_verdict_from_text", lambda raw_text, **kw: {"items": []}
    )

    path = orch.assemble_flow(
        _plan(
            ministers=["jin_yi_wei", "xing_bu"],
            rawCommand="核实客户破产传闻,能不能签合同",
        ),
        task_id="t_cross",
        out_dir=tmp_path,
    )
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    council_jyw = next(s for s in cfg["steps"] if s["id"] == "council_jin_yi_wei")
    council_xb = next(s for s in cfg["steps"] if s["id"] == "council_xing_bu")
    assert "真实引擎参考" in council_jyw["prompt_inline"]
    assert "锦衣卫已核实情报" in council_xb["prompt_inline"]
    assert "客户资金链正常" in council_xb["prompt_inline"]


def test_subagent_max_caps_spawn_workers(tmp_path):
    path = orch.assemble_flow(
        _plan(), task_id="t3", out_dir=tmp_path, max_subagents_per_group=2
    )
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    spawn = next(s for s in cfg["steps"] if s["id"] == "group_finlaw")
    assert spawn["spawn_max_workers"] == 2
