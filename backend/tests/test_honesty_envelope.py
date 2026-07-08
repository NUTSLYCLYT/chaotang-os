"""御史诚实线 · 回归门(2026-07-07 · 三层递归架构第3步)。

钉死:三层各产一次信封、灯轴/签字轴两轴独立、worst-of 冒泡、收口三句非空、
draft 租户 top_light 地板防 day-1 自信绿(default 豁免)。
"""

from types import SimpleNamespace

import src.tenant as T
from src import honesty_envelope as he

# ── 三层信封 ─────────────────────────────────────────────────────────


def test_route_matched_green_unmatched_yellow():
    green = he.envelope_route({"ministries": [{"name": "户部"}], "reason": "命中报价"})
    assert green["light"] == "green" and "户部" in green["basis"]
    yellow = he.envelope_route({"ministries": [], "reason": ""})
    assert yellow["light"] == "yellow"
    for e in (green, yellow):
        assert e["needs_sign"] is False and e["uncertainty"]


def test_pick_abstain_degrades_honestly():
    assert (
        he.envelope_pick({"entry_swarms": ["a"], "abstained": []})["light"] == "green"
    )
    partial = he.envelope_pick(
        {"entry_swarms": ["a"], "abstained": [{"reason": "刑部无自信命中"}]}
    )
    assert partial["light"] == "yellow" and "弃权" in partial["uncertainty"]
    assert he.envelope_pick({"entry_swarms": [], "abstained": []})["light"] == "red"


def test_execution_from_session_states():
    def run(status, score):
        return SimpleNamespace(swarm_id="s", status=status, quality_score=score)

    assert (
        he.envelope_execution(session=SimpleNamespace(swarm_runs=[]))["light"] == "red"
    )
    assert (
        he.envelope_execution(
            session=SimpleNamespace(swarm_runs=[run("failed", None)])
        )["light"]
        == "red"
    )
    assert (
        he.envelope_execution(
            session=SimpleNamespace(swarm_runs=[run("completed", None)])
        )["light"]
        == "yellow"
    ), "没质量分的产出只能当草稿"
    assert (
        he.envelope_execution(
            session=SimpleNamespace(swarm_runs=[run("completed", 4.2)])
        )["light"]
        == "green"
    )


def test_two_axes_are_independent():
    """灯轴/签字轴分开:同为红灯,刑部不可逆→要签,兵部可逆→不签(签不从灯推导)。"""
    xingbu_red = {
        "dept": "xingbu",
        "light": "red",
        "headline": "触合同红线",
        "items": [{"level": "red", "title": "违约金50%超红线"}],
    }
    bingbu_red = {
        "dept": "bingbu",
        "light": "red",
        "headline": "评分算错",
        "items": [{"level": "red", "title": "评分算错"}],
    }
    e1 = he.envelope_execution(court_doc=xingbu_red)
    e2 = he.envelope_execution(court_doc=bingbu_red)
    assert e1["light"] == e2["light"] == "red"
    assert e1["needs_sign"] is True and e2["needs_sign"] is False


def test_black_maps_to_red_on_light_axis():
    doc = {"dept": "yushi", "light": "black", "headline": "高危拦截", "items": []}
    assert he.envelope_execution(court_doc=doc)["light"] == "red"


# ── 冒泡 + 收口三句 ──────────────────────────────────────────────────


def _tiers(*lights, needs_sign=False):
    return [
        he._env(
            f"t{i}", li, f"依据{i}", f"不确定{i}", needs_sign=(needs_sign and i == 0)
        )
        for i, li in enumerate(lights)
    ]


def test_bubble_worst_of_and_three_lines():
    out = he.bubble(_tiers("green", "yellow", "green"))
    assert out["top_light"] == "yellow"
    tl = out["three_lines"]
    assert tl["why_trust"] and tl["decide_one_thing"] and tl["unsure"]
    assert he.bubble(_tiers("green", "red", "yellow"))["top_light"] == "red"


def test_bubble_sign_axis_bubbles_independently():
    out = he.bubble(_tiers("green", "green", "green", needs_sign=True))
    assert out["needs_sign"] is True
    assert (
        "人" in out["three_lines"]["decide_one_thing"]
        or "签" in out["three_lines"]["decide_one_thing"]
    )
    assert out["top_light"] in ("green", "yellow"), "签字轴不该把灯轴染红"


# ── draft 租户地板 ────────────────────────────────────────────────────


def test_draft_tenant_floor_blocks_day1_green(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("t_new"):
        out = he.bubble(_tiers("green", "green", "green"))
    assert out["top_light"] == "yellow" and out["tenant_floored"] is True
    assert "day-1" in out["three_lines"]["unsure"]


def test_confirmed_tenant_keeps_green(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("t_ok"):
        p = T.get_tenant_data_dir("bootstrap") / "capability_cards.json"
        p.write_text('{"confirmed": true, "cards": []}', encoding="utf-8")
        out = he.bubble(_tiers("green", "green", "green"))
    assert out["top_light"] == "green" and out["tenant_floored"] is False


def test_default_tenant_exempt_from_floor(tmp_path, monkeypatch):
    """default 是多租户之前的存量主租户,不存在 day-1,不地板(否则主产品全线变黄)。"""
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("default"):
        out = he.bubble(_tiers("green", "green", "green"))
    assert out["top_light"] == "green"


def test_floor_never_upgrades_red():
    """地板只压绿,不抬红:红灯租户不因 draft 变黄(地板是天花板不是电梯)。"""
    out = he.bubble(_tiers("red", "green", "green"))
    assert out["top_light"] == "red"
