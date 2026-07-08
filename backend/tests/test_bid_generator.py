"""tests/test_bid_generator.py — ⑦招标→标书自动生成(三部融合)。

验证 scripts/generate_bid.py 的 grounding+模板拼装:给一个储能招标 brief,
产出的标书必须含真实产品参数 / 成本锚(LCOS) / 合规提醒,
且关键字段非空、含真实数据源里的关键字段(不是凭空编造)。

铁律(可证伪):标书里出现的产品型号必须真实存在于 battery_prices.yaml;
成本锚必须来自 storage_params.yaml 的 cost_cny_per_kwh;
合规标准必须来自 storage_params.yaml 的 mandatory_standards。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.generate_bid import (  # noqa: E402
    BidDraft,
    generate_bid,
    load_compliance_standards,
    load_cost_anchors,
    load_products,
)

STORAGE_BRIEF = (
    "某园区储能电站招标,需求 250kWh 磷酸铁锂储能系统,"
    "工作温度 -25℃ 至 55℃,要求循环寿命≥4000次,通信基站备电用途,需满足国标。"
)


# ---- 数据源加载是真数据(非空、字段齐) ----


def test_load_products_returns_real_specs():
    products = load_products()
    assert products, "产品规格必须非空"
    models = {p["model"] for p in products}
    # battery_prices.yaml 里真实存在的型号
    assert "LFP-25C-280Ah" in models
    # 每个产品必须带规格关键字段
    p = next(x for x in products if x["model"] == "LFP-25C-280Ah")
    assert p.get("cycle_life")
    assert p.get("temp_range")
    assert p.get("price_range")


def test_load_cost_anchors_from_storage_params():
    anchors = load_cost_anchors()
    assert anchors, "成本锚必须非空"
    # storage_params.yaml cost_cny_per_kwh 真实键
    assert "container" in anchors or "utility_4h" in anchors
    # 区间是 [low, high] 数字
    sample = next(iter(anchors.values()))
    assert isinstance(sample, list) and len(sample) == 2
    assert all(isinstance(x, (int, float)) for x in sample)


def test_load_compliance_standards_from_storage_params():
    stds = load_compliance_standards()
    assert stds, "合规标准必须非空"
    # storage_params.yaml mandatory_standards 真实条目
    assert any("GB 44240" in s for s in stds)


# ---- 标书产出:三部融合,各部分非空且含真实数据 ----


def test_generate_bid_returns_draft_with_three_sections():
    draft = generate_bid(STORAGE_BRIEF)
    assert isinstance(draft, BidDraft)
    # ① 产品匹配度
    assert draft.product_match, "①产品匹配度不能为空"
    assert draft.matched_products, "必须匹配到至少一个真实产品"
    # ② 成本/定价锚-LCOS
    assert draft.cost_anchor, "②成本锚不能为空"
    # ③ 合规红线提醒
    assert draft.compliance_notes, "③合规红线不能为空"


def test_generated_bid_grounds_real_product_model():
    """标书匹配出的产品型号必须真实存在于 battery_prices.yaml(防编造)。"""
    real_models = {p["model"] for p in load_products()}
    draft = generate_bid(STORAGE_BRIEF)
    assert draft.matched_products
    for m in draft.matched_products:
        assert m["model"] in real_models, f"标书出现编造型号: {m['model']}"


def test_generated_bid_cost_anchor_is_grounded():
    """成本锚必须引用 storage_params.yaml 的真实区间数字。"""
    draft = generate_bid(STORAGE_BRIEF)
    anchors = load_cost_anchors()
    # 标书成本锚文本里至少出现一个真实区间端点数字
    flat = [str(int(x)) for v in anchors.values() for x in v]
    assert any(num in draft.cost_anchor for num in flat), "成本锚未引用真实区间数字"


def test_generated_bid_compliance_grounds_real_standard():
    draft = generate_bid(STORAGE_BRIEF)
    stds = load_compliance_standards()
    assert any(s in draft.compliance_notes for s in stds), "合规提醒未引用真实国标"


def test_render_markdown_contains_all_sections():
    draft = generate_bid(STORAGE_BRIEF)
    md = draft.render_markdown()
    assert "①" in md and "产品匹配" in md
    assert "②" in md and ("成本" in md or "LCOS" in md)
    assert "③" in md and "合规" in md
    # 渲染出的型号是真实型号
    assert any(p["model"] in md for p in draft.matched_products)


def test_temp_requirement_filters_products():
    """-40℃ 极寒 brief 应匹配到支持 -40℃ 的真实型号(温域过滤生效)。"""
    cold_brief = "极寒户外移动储能,工作温度需达 -40℃,磷酸铁锂方案。"
    draft = generate_bid(cold_brief)
    assert draft.matched_products
    # 至少有一个匹配产品温域覆盖 -40
    assert any("-40" in (m.get("temp_range") or "") for m in draft.matched_products)
