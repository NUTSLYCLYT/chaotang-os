#!/usr/bin/env python3
"""quotation 蜂群·真实成交价评分器 —— 零人工标注、零 LLM 自评的真尺子。

ground truth = 公司真实成交价(eval/quotation_real_golden.jsonl,从合同文件名提取)。
对一份报价输出,抽出报价金额,对照同产品/数量的真实成交价算偏差 → 真·质量分。
市场已经替你打了分(客户付了钱),这把尺子只读现实,不读模型自夸。

评分(偏差越小越高,可证伪):
  |报价-真实|/真实 ≤10%→5 / ≤20%→4 / ≤35%→3 / ≤50%→2 / else→1
判级 PASS(≥4) / WEAK(3) / FAIL(≤2) / UNKNOWN(抽不出报价)。

用法:
  python scripts/quotation_real_score.py --case 0 --file 报价输出.txt
  python scripts/quotation_real_score.py --list          # 列评测集
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))  # 直跑脚本时让 `import src.*` 可用
GOLDEN = ROOT / "eval" / "quotation_real_golden.jsonl"


def load() -> list[dict]:
    return [json.loads(x) for x in GOLDEN.read_text(encoding="utf-8").splitlines() if x.strip()]


def extract_quote_cny(text: str) -> float | None:
    """抽报价总额(元)。优先'总价/报价/合计 X 元/万元',再退而求其次。"""
    m = re.search(r"(总价|报价|合计|总额|总计)[^\d]{0,8}(\d+(?:\.\d+)?)\s*(万元|万|元)", text)
    if m:
        v = float(m.group(2))
        return v * (1e4 if m.group(3) in ("万元", "万") else 1.0)
    # 退: 文本里最大的"元"金额
    cands = [float(n) for n, u in re.findall(r"(\d+(?:\.\d+)?)\s*(万元|元)", text) for _ in [0]]
    nums = []
    for n, u in re.findall(r"(\d+(?:\.\d+)?)\s*(万元|万|元)", text):
        nums.append(float(n) * (1e4 if u in ("万元", "万") else 1.0))
    return max(nums) if nums else None


def score(quote: float, real: float) -> tuple[int, str]:
    dev = abs(quote - real) / real
    s = 5 if dev <= 0.10 else 4 if dev <= 0.20 else 3 if dev <= 0.35 else 2 if dev <= 0.50 else 1
    verdict = "PASS" if s >= 4 else "WEAK" if s == 3 else "FAIL"
    return s, f"报价{quote:.0f} vs 真实{real:.0f},偏差{dev * 100:.0f}% → {s}分 {verdict}"


def main() -> int:
    ap = argparse.ArgumentParser(description="quotation 真实成交价评分器")
    ap.add_argument("--case", type=int)
    ap.add_argument("--file")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--ledger", action="store_true", help="把判定写入真值台账(truth_ledger)")
    a = ap.parse_args()
    cases = load()
    if a.list or a.case is None:
        print(f"=== quotation 真实评测集 {len(cases)} 单 ===")
        for i, c in enumerate(cases):
            print(
                f"  [{i}] 为{c.get('customer') or '某客户'}报价 {c.get('qty', '')}{c['product']}"
                f"{('/' + c['spec']) if c.get('spec') else ''} → 真实 {c['real_amount_cny']}元"
            )
        return 0
    c = cases[a.case]
    sol = Path(a.file).read_text(encoding="utf-8") if a.file else ""
    q = extract_quote_cny(sol)
    print(f"任务: 为{c.get('customer') or '某客户'}报价 {c.get('qty', '')}{c['product']}")
    if q is None:
        print("  ❓ UNKNOWN: 抽不出报价金额")
        if a.ledger:
            from src.truth_ledger import record

            record("quotation", "quotation_real_score", "UNKNOWN", case_id=f"quote_{a.case}", detail="抽不出报价")
        return 0
    s, detail = score(q, float(c["real_amount_cny"]))
    icon = "✅" if s >= 4 else "⚠️" if s == 3 else "❌"
    print(f"  {icon} {detail}")
    if a.ledger:
        from src.truth_ledger import record

        verdict = "PASS" if s >= 4 else "WEAK" if s == 3 else "FAIL"
        record(
            "quotation",
            "quotation_real_score",
            verdict,
            score=s,
            case_id=f"quote_{a.case}",
            detail=detail,
            evidence=detail,
        )
        print(f"→ 已写入真值台账: quotation/quote_{a.case} = {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
