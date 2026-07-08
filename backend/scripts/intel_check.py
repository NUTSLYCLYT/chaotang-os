#!/usr/bin/env python3
"""锦衣卫情报蜂群·信源核查检查器 v2.0（确定性+可证伪）。

核心可证伪锚：情报无源=谣言。
v2.0 新增三层强化（在 v1 C1-C4 基础上）：
  C5 信源可信度评分  —— 自动识别信源类型并评级（官方公告5>行业媒体4>新闻媒体3>社交2>匿名1）
  C6 交叉验证密度   —— 同一结论有几个独立来源支撑（1个=低密度UNKNOWN，≥2个=PASS）
  C7 时效性检查    —— 30天内信息=高时效，30-90天=中，>90天/无日期=低时效

判定逻辑（C1-C7 综合）：
  - 任一 C1/C2 为 FAIL → 整体 FAIL（无源=谣言，铁律）
  - C5 评分均值 < 2 → 整体降为 UNKNOWN（来源全是低可信源）
  - C6 交叉验证密度低 → 整体 UNKNOWN（孤证不立）
  - 其余全 PASS → 整体 PASS

用法: python scripts/intel_check.py --file 情报奏报.txt [--case-id X] [--verbose]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ── v1 原有正则 ─────────────────────────────────────────────────────────────
CRED = r"高可信|中可信|低可信|可信度|置信|可信级"
SOURCE = r"信源|来源|采集|出处|援引|据.{0,6}报道|官方|工商|司法|环评"
UNCERTAIN = r"传闻|待验证|待查|存疑|未证实|交叉验证|需.{0,4}核实|未经验证"
DIMS = ["融资", "产能", "新品", "人事", "风险", "扩张"]

# ── v2 新增：信源类型权重 ──────────────────────────────────────────────────
SOURCE_TIERS: list[tuple[str, int, str]] = [
    # (regex pattern, score, label)
    (r"官方公告|官网|交易所公告|工商变更|司法披露|环评公示|政府网站", 5, "官方公告"),
    (r"行业媒体|GGII|高工锂电|储能界|CNESA|中关村储能|电池中国|彭博新能源", 4, "行业媒体"),
    (r"新闻报道|财经|证券时报|经济日报|每日经济|澎湃|界面|新浪|36kr|虎嗅", 3, "新闻媒体"),
    (r"微信|微博|知乎|朋友圈|论坛|贴吧|据业内人士|据消息人士|据知情人", 2, "社交/匿名"),
    (r"传闻|小道消息|内部消息|据说|听说", 1, "传言"),
]

# 交叉验证：同一结论出现多个独立信源标志
CROSS_VERIFY = r"交叉验证|多源印证|第三方确认|双重核实|两家.*均|三家.*均|多方.*证实"

# 时效性：提取日期
DATE_PATTERN = r"(20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}[日]?|\d{1,2}月\d{1,2}[日号])"


def _score_sources(text: str) -> tuple[float, list[str]]:
    """识别信源类型，返回（均值评分, 命中类型列表）。"""
    found_scores = []
    found_labels = []
    for pattern, score, label in SOURCE_TIERS:
        n = len(re.findall(pattern, text))
        if n > 0:
            found_scores.extend([score] * n)
            found_labels.append(f"{label}×{n}")
    if not found_scores:
        return 0.0, []
    return sum(found_scores) / len(found_scores), found_labels


def _cross_verify_density(text: str) -> int:
    """估算交叉验证密度：0=无, 1=单源, 2+=多源。"""
    # 明确的交叉验证标注
    if re.search(CROSS_VERIFY, text):
        return 2
    # 计算信源引用次数（不同类型信源同时出现=多源印证）
    tier_hits = sum(1 for p, _, _ in SOURCE_TIERS if re.search(p, text))
    return tier_hits


def _time_freshness(text: str) -> str:
    """检查信息时效性。"""
    from datetime import datetime

    dates = re.findall(DATE_PATTERN, text)
    if not dates:
        return "无日期标注"
    # 尝试解析最新日期
    parsed = []
    for d in dates:
        for fmt in ("%Y年%m月%d日", "%Y年%m月%d号", "%Y-%m-%d", "%Y/%m/%d", "%m月%d日"):
            try:
                parsed.append(datetime.strptime(d.replace("号", "日"), fmt))
                break
            except ValueError:
                continue
    if not parsed:
        return f"有日期标注但无法解析: {dates[:2]}"
    latest = max(parsed)
    now = datetime.now()
    days = (now - latest).days
    if days <= 30:
        return f"高时效（{days}天前，{latest.strftime('%Y-%m-%d')}）"
    if days <= 90:
        return f"中时效（{days}天前，{latest.strftime('%Y-%m-%d')}）⚠️"
    return f"低时效（{days}天前，{latest.strftime('%Y-%m-%d')}）❌ 超90天"


def check(text: str) -> list[dict]:
    out = []

    def add(n, s, d):
        out.append({"check": n, "status": s, "detail": d})

    # ── C1-C4（v1 保留）──────────────────────────────────────────────────────
    n_cred = len(re.findall(CRED, text))
    add("C1可信度分级", "FAIL" if n_cred == 0 else "PASS", f"可信度标注 {n_cred} 处")

    n_src = len(re.findall(SOURCE, text))
    add("C2信源采集", "FAIL" if n_src == 0 else "PASS", f"信源标记 {n_src} 处")

    n_unc = len(re.findall(UNCERTAIN, text))
    add("C3事实传闻区分", "PASS" if n_unc > 0 else ("FAIL" if n_cred < 2 else "UNKNOWN"), f"不确定标注 {n_unc} 处")

    cov = [d for d in DIMS if d in text]
    add("C4任务覆盖", "PASS" if len(cov) >= 3 else "UNKNOWN", f"覆盖维度 {cov}")

    # ── C5：信源可信度评分（v2 新增）────────────────────────────────────────
    avg_score, labels = _score_sources(text)
    if avg_score == 0:
        c5_status = "FAIL"
        c5_detail = "未识别出任何可评级信源（无源=谣言）"
    elif avg_score >= 3.5:
        c5_status = "PASS"
        c5_detail = f"信源均分 {avg_score:.1f}/5：{', '.join(labels)}"
    elif avg_score >= 2.0:
        c5_status = "UNKNOWN"
        c5_detail = f"信源均分 {avg_score:.1f}/5（偏低）：{', '.join(labels)}"
    else:
        c5_status = "FAIL"
        c5_detail = f"信源均分 {avg_score:.1f}/5（主要为社交/传言）：{', '.join(labels)}"
    add("C5信源可信度评分", c5_status, c5_detail)

    # ── C6：交叉验证密度（v2 新增）──────────────────────────────────────────
    density = _cross_verify_density(text)
    if density >= 2:
        c6_status = "PASS"
        c6_detail = f"多源印证（{density} 类独立信源）"
    elif density == 1:
        c6_status = "UNKNOWN"
        c6_detail = "孤证（仅1类信源），建议补充第二信源交叉核实"
    else:
        c6_status = "FAIL"
        c6_detail = "无可识别信源类型，不可验证"
    add("C6交叉验证密度", c6_status, c6_detail)

    # ── C7：时效性（v2 新增）────────────────────────────────────────────────
    freshness = _time_freshness(text)
    if "高时效" in freshness:
        c7_status = "PASS"
    elif "无日期" in freshness:
        c7_status = "UNKNOWN"
    elif "中时效" in freshness:
        c7_status = "UNKNOWN"
    else:
        c7_status = "FAIL"
    add("C7时效性", c7_status, freshness)

    return out


def verdict_of(checks: list[dict]) -> str:
    s = {c["check"]: c["status"] for c in checks}
    # 铁律：无源=谣言
    if s.get("C1可信度分级") == "FAIL" or s.get("C2信源采集") == "FAIL":
        return "FAIL"
    if s.get("C5信源可信度评分") == "FAIL":
        return "FAIL"
    if s.get("C6交叉验证密度") == "FAIL":
        return "FAIL"
    fails = [c for c in checks if c["status"] == "FAIL"]
    if fails:
        return "FAIL"
    unknowns = [c for c in checks if c["status"] == "UNKNOWN"]
    if len(unknowns) >= 3:
        return "UNKNOWN"
    if s.get("C1可信度分级") == "PASS" and s.get("C2信源采集") == "PASS" and s.get("C5信源可信度评分") == "PASS":
        return "PASS"
    return "UNKNOWN"


def main() -> int:
    ap = argparse.ArgumentParser(description="锦衣卫情报·信源核查检查器 v2.0")
    ap.add_argument("--file", required=True)
    ap.add_argument("--case-id")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    text = Path(a.file).read_text(encoding="utf-8")
    ICON = {"PASS": "✅", "FAIL": "❌", "UNKNOWN": "❓"}
    print("=== 锦衣卫情报·信源核查 v2.0 ===")
    results = check(text)
    for c in results:
        print(f"  {ICON[c['status']]} {c['status']:<7} {c['check']}: {c['detail']}")
    v = verdict_of(results)
    print(f"\n  整体判定: {ICON.get(v, '')} {v}")
    if v == "FAIL":
        fails = [c["check"] for c in results if c["status"] == "FAIL"]
        print(f"  ⛔ 失败项: {fails}")
    if a.case_id:
        from src.truth_ledger import record

        ev = "; ".join(f"{c['check']}={c['status']}" for c in results)
        record("jinyiwei_intel", "intel_check", v, case_id=a.case_id, detail=ev, evidence=ev)
        print(f"  → 已写入真值台账: jinyiwei_intel/{a.case_id} = {v}")
    return 0 if v != "FAIL" else 1


if __name__ == "__main__":
    sys.exit(main())
