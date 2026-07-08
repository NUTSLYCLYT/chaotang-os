"""能力评分公共层测试:样本置信护栏 + 率→雷达 + 记录→能力块。"""
from src import capability_scoring as cap


def test_sample_confidence_bands():
    assert cap.sample_confidence(0)["level"] == "无"
    assert cap.sample_confidence(2)["level"] == "不足"    # < MIN_SCORED
    assert cap.sample_confidence(4)["level"] == "参考"    # 小样本护栏(deming)
    assert cap.sample_confidence(9)["level"] == "足"


def test_rates_to_radar_clamps_and_scales():
    radar = cap.rates_to_radar([("a", 0.5), ("b", 1.2), ("c", -0.1)])
    scores = {d["axis"]: d["score"] for d in radar}
    assert scores["a"] == 5.0
    assert scores["b"] == 10.0    # >1 截到 10
    assert scores["c"] == 0.0     # <0 截到 0


def test_score_from_records_thin_sample_not_scored():
    doc = cap.score_from_records([{"verdict": "PASS", "grounded": True}] * 2)
    assert doc["scored"] is False        # 2 < MIN_SCORED → 禁假不打分
    assert doc["sample"] == 2


def test_score_from_records_computes_rates():
    recs = [{"verdict": "PASS", "grounded": True},
            {"verdict": "驳回", "grounded": True, "reworked": True},
            {"verdict": "PASS", "grounded": False}]
    doc = cap.score_from_records(recs)
    assert doc["scored"] is True and doc["sample"] == 3
    assert doc["metrics"]["grounding_rate"] == round(2 / 3, 3)
    assert doc["confidence"]["level"] == "参考"   # 3 在小样本带
    assert len(doc["radar"]) == 3
