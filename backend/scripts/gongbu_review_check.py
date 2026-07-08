"""工部代码审查确定性检查器（Deming：证明工部能抓真 bug，而非泛泛夸）。

机制：harness/gongbu_review/golden_cases.json 里每个 case 植入已知缺陷 + must_catch_keywords。
把 case.snippet 喂给工部审查 → 拿审查输出文本 → check_review 判定是否抓到(关键词命中 >= min_hits)。
所有 critical 缺陷抓到才 PASS。判定确定性(纯字符串匹配,不靠 LLM 自评),写 truth_ledger。

用法：
  # 离线自检(检查器逻辑):
  python -m pytest tests/test_gongbu_review_check.py
  # 真链路(代理健康时):跑工部审 golden snippet → 把输出喂 check_review → 记 truth_ledger
"""

from __future__ import annotations

import json
from pathlib import Path

_GOLDEN = Path(__file__).resolve().parent.parent / "harness" / "gongbu_review" / "golden_cases.json"


def load_cases(path: Path | None = None) -> list[dict]:
    data = json.loads((path or _GOLDEN).read_text(encoding="utf-8"))
    return data.get("cases", [])


def check_review(review_text: str, case: dict) -> dict:
    """判定一次工部审查是否抓到 case 的植入缺陷。

    返回 {verdict(PASS/FAIL), catch_rate, caught[], missed[]}。
    caught: 某缺陷的 must_catch_keywords 命中数 >= min_hits。
    PASS 条件：所有 critical 缺陷都 caught。
    """
    text = (review_text or "").lower()
    caught, missed = [], []
    for d in case.get("planted_defects", []):
        kws = d.get("must_catch_keywords", [])
        min_hits = int(d.get("min_hits", 2))
        hits = sum(1 for kw in kws if kw.lower() in text)
        rec = {"id": d["id"], "severity": d.get("severity", "medium"), "hits": hits, "min_hits": min_hits}
        (caught if hits >= min_hits else missed).append(rec)

    total = len(caught) + len(missed)
    catch_rate = round(len(caught) / total, 3) if total else 0.0
    critical_missed = [m for m in missed if m["severity"] == "critical"]
    verdict = "PASS" if total and not critical_missed else "FAIL"
    return {"verdict": verdict, "catch_rate": catch_rate, "caught": caught, "missed": missed}


def record_to_ledger(case_id: str, result: dict, *, provenance: str = "unknown") -> None:
    """把判定写入真值台账(回归门可读)。"""
    from src.truth_ledger import record

    record(
        "gongbu_review",
        "gongbu_review_check",
        result["verdict"],
        score=result["catch_rate"],
        case_id=case_id,
        detail=f"caught={[c['id'] for c in result['caught']]} missed={[m['id'] for m in result['missed']]}",
        evidence=json.dumps(result, ensure_ascii=False)[:500],
        provenance=provenance,
    )
