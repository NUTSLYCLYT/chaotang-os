"""真实请求路径 _run_swarm 的诚实线接线 · 回归门(第3步)。

钉死:route/pick 在 handler 产生并进流(honesty_tiers)、收口 honesty 事件带三句+两轴、
显式 swarm 折叠为人选信封、全弃权诚实拒跑不硬选。假编排器隔离 LLM,只测接线。
"""

import queue
from types import SimpleNamespace

import pytest

import web.routers.runs_stream as rs
from web.schemas.auth import CurrentUser
from web.schemas.streaming import RunAsyncRequest


class _FakeOrch:
    """假编排器:注册表用真蜂群名(路由是真的),run 不跑 LLM。"""

    def __init__(self, *a, **k):
        self.swarms = {"quotation": None, "legal": None, "finance": None, "opc": None}

    def run(self, task_input, **kwargs):
        self.run_kwargs = kwargs
        return SimpleNamespace(
            session_id="sess-test",
            swarm_runs=[
                SimpleNamespace(
                    swarm_id="quotation",
                    status="completed",
                    quality_score=4.0,
                    qa_result=None,
                )
            ],
        )


@pytest.fixture()
def wired(monkeypatch, tmp_path):
    import src.tenant as T

    # 隔离数据根:routing_truth/触发器账本落 tmp,不污染真 data/(2026-07-08 接线后必须)
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    monkeypatch.setattr("src.swarm_orchestrator.SwarmOrchestrator", _FakeOrch)
    for fn in ("record_event", "mark_status", "update_monitor"):
        monkeypatch.setattr(rs, fn, lambda *a, **k: None)
    return None


def _drain(q):
    out = []
    while not q.empty():
        out.append(q.get_nowait())
    return out


def _run(task_input, swarm=None):
    q = queue.Queue()
    rs._run_swarm(
        "tid",
        q,
        RunAsyncRequest(task_input=task_input, swarm=swarm if swarm else True),
        user=CurrentUser(tenant_slug="default"),
        started=0.0,
    )
    return _drain(q)


def test_routed_run_emits_tiers_and_final_honesty(wired):
    events = _run("帮我算这批储能柜的报价")
    types = [e["type"] for e in events]
    assert "honesty_tiers" in types, "route/pick 信封须在执行前进流"
    final = next(e for e in events if e["type"] == "honesty")
    assert {"top_light", "needs_sign", "three_lines"} <= set(final)
    tl = final["three_lines"]
    assert tl["why_trust"] and tl["decide_one_thing"] and tl["unsure"]
    tiers = next(e for e in events if e["type"] == "honesty_tiers")["tiers"]
    assert [t["tier"] for t in tiers] == ["route", "pick", "qintianjian"]
    assert len(final["tiers"]) == 4, "收口须含 execution 层(三层+钦天监横切)"


def test_explicit_swarm_collapses_to_human_pick(wired):
    events = _run("随便什么任务", swarm="opc")
    tiers = next(e for e in events if e["type"] == "honesty_tiers")["tiers"]
    assert all(
        "显式" in t["basis"] or "人选" in t["basis"]
        for t in tiers
        if t["tier"] in ("route", "pick")
    )


def test_explicit_irreversible_swarm_cannot_bypass_lens(wired):
    """显式点选不可逆蜂群(quotation):钦天监结构否决照样生效,签字轴冒泡到收口。"""
    events = _run("随便什么任务", swarm="quotation")
    lens = next(e for e in events if e["type"] == "qintianjian")
    assert lens["verdict"] == "veto"
    final = next(e for e in events if e["type"] == "honesty")
    assert final["needs_sign"] is True, "veto 必须冒泡为强制人签"
    assert final["top_light"] == "red"
    assert [e["type"] for e in events].count("done") == 1, "veto 不拦跑,蜂群照常出建议"


def test_all_abstain_refuses_with_honesty(wired, monkeypatch):
    """全员弃权:拒跑 + error 事件带诚实收口,绝不硬选蜂群。"""
    monkeypatch.setattr(
        "src.orchestration_plan.build_plan",
        lambda *a, **k: {
            "mode": "junjichu",
            "entry_swarms": [],
            "abstained": [{"ministry": "hubu", "reason": "无自信命中"}],
            "ministries": [{"name": "户部"}],
            "reason": "跨域",
        },
    )
    # runs_stream 函数内 from ... import build_plan,需 patch 其源模块符号后重载引用:
    # 直接 patch rs 内的延迟导入目标(orchestration_plan 模块属性)即可生效。
    events = _run("完全无关的火星任务")
    err = [e for e in events if e["type"] == "error"]
    assert err and "拒绝派单" in err[0]["reason"]
    assert err[0].get("honesty", {}).get("top_light") == "red"
    assert not [e for e in events if e["type"] == "done"], "拒跑后不得发 done"


def test_genius_next_step_emitted_and_failopen(wired, monkeypatch):
    """丞相天才下一步进流(死代码复活的钉子);召回层炸了不许打断下旨。"""
    events = _run("帮我算这批储能柜的报价")
    genius = [e for e in events if e["type"] == "genius_next_step"]
    assert len(genius) == 1 and isinstance(genius[0]["steps"], list)
    assert genius[0]["steps"], "至少有诚实弃权项,不许空"

    monkeypatch.setattr(
        "src.chancellor_router.genius_next_step",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("rag down")),
    )
    events2 = _run("帮我算这批储能柜的报价")
    assert [e["type"] for e in events2].count("done") == 1, "召回故障不打断下旨"
