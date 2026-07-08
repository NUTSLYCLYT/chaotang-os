# tests/test_manor_groups.py
from src.manor_groups import load_manor_groups, ManorGroup, groups_for_ministers


def test_load_six_groups():
    groups = load_manor_groups()
    assert len(groups) == 6
    ids = {g.id for g in groups}
    assert ids == {"intel", "content", "finlaw", "rnd", "exec", "review"}
    intel = next(g for g in groups if g.id == "intel")
    assert isinstance(intel, ManorGroup)
    assert "jin_yi_wei" in intel.ministers
    assert intel.subagent_max == 3
    assert intel.runtime == "spawn"


def test_groups_for_ministers_maps_via_membership():
    gids = groups_for_ministers(["hu_bu", "li_bu_rites"])
    assert set(gids) == {"finlaw", "content"}


def test_groups_for_ministers_dedup_and_skip_unknown():
    gids = groups_for_ministers(["hu_bu", "xing_bu", "nobody"])  # 两者都在 finlaw
    assert gids == ["finlaw"]
