"""src/capability_scoring.py — 能力评分公共层(大神 eval + 司 profile 共用,防两套逻辑漂移)。

飞轮复用第三次:大神 eval 和司 profile 都在"聚合信号→雷达+置信",算法同构,抽这里一处。
接 eval_validity 纪律:
  - 小样本不给权威(deming:2个案子的满分雷达会骗人)→ sample_confidence 标"仅供参考"
  - 禁假空态:样本不足 → scored=False,不打假分
"""
from __future__ import annotations

MIN_SCORED = 3        # <此 → 样本太薄,不足以评能力(禁假:不打分)
SMALL_SAMPLE_MIN = 5  # [MIN_SCORED, 此) → 打分但标"仅供参考,勿当权威"(deming 小样本护栏)


def sample_confidence(n: int) -> dict:
    """样本量 → 置信档 + 人话说明。接 eval_validity:小样本别当权威。"""
    if n <= 0:
        return {"level": "无", "note": "无样本"}
    if n < MIN_SCORED:
        return {"level": "不足", "note": f"样本仅 {n},不足以评能力(禁假:不给权威分)"}
    if n < SMALL_SAMPLE_MIN:
        return {"level": "参考", "note": f"样本 {n} 偏小,能力仅供参考,勿当权威(deming 小样本护栏)"}
    return {"level": "足", "note": f"样本 {n},可作参考"}


def rates_to_radar(pairs: list[tuple[str, float]]) -> list[dict]:
    """[(轴名, 率0..1)] → [{axis, score0..10}] 供前端雷达图。"""
    return [{"axis": a, "score": round(max(0.0, min(1.0, r)) * 10, 1)} for a, r in pairs]


def score_from_records(records: list[dict]) -> dict:
    """经手记录 → 能力块。records:[{grounded, verdict, reworked}]。

    返回 {scored, metrics, radar, sample, confidence[, note]}。
    样本 < MIN_SCORED → scored=False 诚实空态,不编造能力分。
    """
    n = len(records)
    conf = sample_confidence(n)
    if n < MIN_SCORED:
        return {"scored": False, "metrics": {}, "radar": [], "sample": n,
                "confidence": conf, "note": conf["note"]}
    grounded = sum(1 for r in records if r.get("grounded"))
    passed = sum(1 for r in records if r.get("verdict") in ("PASS", "准奏", "green"))
    reworked = sum(1 for r in records if r.get("reworked"))
    metrics = {
        "grounding_rate": round(grounded / n, 3),
        "pass_rate": round(passed / n, 3),
        "rework_rate": round(reworked / n, 3),
    }
    radar = rates_to_radar([("接地率", grounded / n), ("结论通过", passed / n), ("少返工", 1 - reworked / n)])
    return {"scored": True, "metrics": metrics, "radar": radar, "sample": n, "confidence": conf}
