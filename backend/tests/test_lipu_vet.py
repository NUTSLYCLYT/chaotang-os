"""tests/test_lipu_vet.py — 礼部发布反幻觉复核:确定性口径(素材回链/编造/绝对化)。

全部离线、不打网络:知识库兜底走 monkeypatch,验四类硬声明判定 + court_doc 形状。
"""

from __future__ import annotations

import src.lipu_vet as lv

SOURCE = "18650电芯-40℃下0.2C容量保持率≥90%;入选《先进技术成果转化名录》;每年减少140吨二氧化碳。"


def _levels(items):
    return [it["level"] for it in items]


def test_all_claims_grounded_in_source_are_green():
    draft = "本司18650电芯在-40℃下容量保持率≥90%,入选《先进技术成果转化名录》,每年减少140吨二氧化碳。"
    items = lv.vet_publication(draft, SOURCE)
    assert items and all(it["level"] == "green" for it in items), _levels(items)


def test_fabricated_certification_is_red(monkeypatch):
    # 知识库也查不到 → 编造资质判 red
    monkeypatch.setattr(lv, "_knowledge_fallback", lambda claim: "unavailable")
    items = lv.vet_publication("本司通过《国家超低温电池认证》。", SOURCE)
    assert any(it["level"] == "red" and "编造" in it["title"] for it in items), items


def test_bare_number_out_of_source_is_yellow(monkeypatch):
    monkeypatch.setattr(lv, "_knowledge_fallback", lambda claim: "unavailable")
    items = lv.vet_publication("容量保持率高达99.9%。", SOURCE)
    assert any(
        it["level"] == "yellow" and "99.9%" in it["title"] for it in items
    ), items


def test_superlative_is_red_regardless_of_source():
    items = lv.vet_publication("本司技术全球第一,遥遥领先。", SOURCE)
    reds = [it for it in items if it["level"] == "red"]
    assert len(reds) >= 2, items


def test_knowledge_fallback_grounded_downgrades_to_yellow(monkeypatch):
    # 素材外但知识库有据 → yellow(补出处),不当编造红灯
    monkeypatch.setattr(lv, "_knowledge_fallback", lambda claim: "grounded")
    items = lv.vet_publication("循环寿命达3000次。", SOURCE)
    assert any(
        it["level"] == "yellow" and "知识库有据" in it["title"] for it in items
    ), items


def test_build_lipu_verdict_court_doc_shape():
    doc = lv.build_lipu_verdict(
        "容量保持率≥90%,入选《先进技术成果转化名录》。", SOURCE, archive=False
    )
    assert doc["dept"] == "libu"  # 礼部命名空间
    assert doc["seal"]["stamp"] == "礼器印"
    assert doc["light"] in ("green", "yellow", "red", "black")
    assert doc["items"]


def test_extract_hard_claims_dedups():
    claims = lv.extract_hard_claims("≥90% 和 ≥90% 重复;还有 140吨。")
    frags = [c[1] for c in claims]
    assert len(frags) == len(set(lv._norm(f) for f in frags))
