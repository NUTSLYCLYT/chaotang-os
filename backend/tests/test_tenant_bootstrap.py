"""每企业 bootstrap 采集器 · 回归门(2026-07-07 · 第5步)。

钉死:部门→六部提议映射、全 provisional 待确认、只加法不减法(缺的六部保留标缺不剪)、unmatched 不静默丢。
用真实企业数据的部门名(财务部/技术部/市场部/采购部/人事/项目部)当样本,不读文件内容。
"""

from src.tenant_bootstrap import ALL_SIX, propose_capability_cards

# 真实企业(铭硕)H 盘 各部门备份 的部门名
REAL_DEPTS = ["财务部", "技术部", "市场部", "采购部", "人事", "项目部", "产品部"]


def test_departments_map_to_six_ministries():
    """真实部门名 → 提议六部码:财务→户部、技术→工部、市场→兵部、人事→吏部。"""
    p = propose_capability_cards(REAL_DEPTS)
    by_folder = {c["source_folder"]: c["ministry_code"] for c in p["cards"]}
    assert by_folder["财务部"] == "hubu"
    assert by_folder["技术部"] == "gongbu"
    assert by_folder["市场部"] == "bingbu"
    assert by_folder["人事"] == "libu_personnel"


def test_all_cards_provisional():
    """所有卡 provisional=True/confirmed=False——建档是提议,人在环确认才算数(会审 CRITICAL)。"""
    p = propose_capability_cards(REAL_DEPTS)
    assert p["cards"], "应有卡产出"
    for c in p["cards"]:
        assert c["provisional"] is True and c["confirmed"] is False


def test_only_addition_missing_ministries_kept():
    """只加法:这家没有的六部(如刑部,无法务部门)保留在 missing 标缺,不移出候选(防日后静默错投)。"""
    p = propose_capability_cards(REAL_DEPTS)
    missing_codes = {m["code"] for m in p["missing_ministries"]}
    # REAL_DEPTS 里没有法务/合规 → 刑部应在 missing,而不是被静默剪掉
    assert "xingbu" in missing_codes
    # 六部全集始终在候选(命中的进 cards,没命中的进 missing),总数守恒
    covered = {c["ministry_code"] for c in p["cards"]} | missing_codes
    assert covered == {code for code, _ in ALL_SIX}


def test_unmatched_folders_not_dropped():
    """没匹配上任何六部的部门 → 进 unmatched 让用户手动归属,不静默丢。"""
    p = propose_capability_cards(["财务部", "某个说不清的神秘部门"])
    assert "某个说不清的神秘部门" in p["unmatched_folders"]


def test_confirm_turns_provisional_active(tmp_path, monkeypatch):
    """人在环确认:bootstrap 提议 → confirm 后 provisional=False/confirmed=True 才 active。"""
    import src.tenant as T

    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    from src.tenant_bootstrap import bootstrap_tenant, confirm_capability_cards

    src_dir = tmp_path / "src_ent"
    for d in ["财务部", "采购部"]:
        (src_dir / d).mkdir(parents=True)
    bootstrap_tenant("ent1", src_dir)
    # 纠正:采购部改归工部(默认提议是兵部),这是业务判断的人在环覆盖
    r = confirm_capability_cards("ent1", overrides={"采购部": "gongbu"})
    active = {c["source_folder"]: c["ministry_code"] for c in r["active_cards"]}
    assert active["财务部"] == "hubu"
    assert active["采购部"] == "gongbu"  # 覆盖生效
    assert all(c["confirmed"] and not c["provisional"] for c in r["active_cards"])
