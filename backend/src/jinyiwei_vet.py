#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""锦衣卫 vet — 情报入蜂群前的可信度把关(钦天监 A2 接线)。

把锦衣卫的可信度核查接成 truth_ledger 的一个确定性 check(与 ima_grounding_check 并列):
  入库 → PASS(过闸,可入知识库)
  待核 → UNKNOWN(不自动过闸,需人核;治 AI 硬声明/单源未证实)
  拒   → FAIL(不入库)
确定性、零 LLM。逻辑与 ~/.claude/skills/锦衣卫 一致,此处为后端自包含副本。
"""

from __future__ import annotations

PRIMARY_KW = (
    "官网",
    "官方",
    "公告",
    "年报",
    "季报",
    "定期报告",
    "招股",
    "招标公告",
    "中标公告",
    "政府",
    "gov",
    "原始",
    "白皮书",
    "专利公开",
    "交易所",
)
SECONDARY_KW = ("媒体", "资讯", "报道", "公众号", "转载", "援引", "据悉", "快讯", "号")
HARD_CLAIM_KW = (
    "认证",
    "gb/t",
    "专利号",
    "%",
    "％",
    "万元",
    "亿元",
    "通过测试",
    "全球领先",
    "行业第一",
    "唯一",
    "最",
    "首个",
)


def _tier(name: str) -> str:
    n = (name or "").lower()
    if any(k in n for k in PRIMARY_KW):
        return "一手"
    if any(k in n for k in SECONDARY_KW):
        return "二手"
    return "未知"


def vet_intel(claim: str, sources) -> dict:
    """核查一条情报 → {grade, distinct_sources, primary, hard_claim, decision, reason}。"""
    names, tiers = set(), []
    for s in sources or []:
        if isinstance(s, dict):
            nm = s.get("name", "")
            tiers.append(s.get("tier") or _tier(nm))
        else:
            nm = str(s)
            tiers.append(_tier(nm))
        if nm:
            names.add(nm)

    n = len(names)
    has_primary = "一手" in tiers
    corroborated = n >= 2
    hard = any(k in (claim or "").lower() for k in HARD_CLAIM_KW)

    if has_primary:
        grade = "一手"
    elif corroborated and all(t in ("二手", "未知") for t in tiers):
        grade = "二手(多源印证)"
    elif tiers and all(t == "二手" for t in tiers):
        grade = "二手(单源)"
    else:
        grade = "未证实"

    if hard and not has_primary:
        decision, reason = (
            "待核",
            "含硬声明(认证/数字/绝对化)且非一手 → 必须人工核实再入库",
        )
    elif has_primary:
        decision, reason = "入库", "一手来源,可直接采信"
    elif grade == "二手(多源印证)":
        decision, reason = "入库", f"{n}源印证,可入库(标二手)"
    elif grade == "二手(单源)":
        decision, reason = "待核", "二手单源,缺印证 → 待补证"
    else:
        decision, reason = "拒", "未证实/单源低可信 → 不入库"
    return {
        "grade": grade,
        "distinct_sources": n,
        "primary": has_primary,
        "hard_claim": hard,
        "decision": decision,
        "reason": reason,
    }


# 决策 → truth_ledger verdict:入库=PASS / 拒=FAIL / 待核=UNKNOWN(不自动过闸,需人核)
_VERDICT = {"入库": "PASS", "拒": "FAIL", "待核": "UNKNOWN"}


def verdict_of(decision: str) -> str:
    return _VERDICT.get(decision, "UNKNOWN")


def vet_and_record(
    claim: str, sources, *, swarm: str = "ima", case_id: str = ""
) -> dict:
    """核查并写入真值台账(把关入库)。返回 vet 结果(含 verdict)。"""
    r = vet_intel(claim, sources)
    v = verdict_of(r["decision"])
    if case_id:
        from src.truth_ledger import record

        record(
            swarm,
            "jinyiwei_vet",
            v,
            case_id=case_id,
            detail=f"{r['grade']}/{r['decision']}: {r['reason']}",
            evidence=r["reason"],
        )
    return {**r, "verdict": v}


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) > 1:
        print(
            json.dumps(
                vet_intel(sys.argv[1], sys.argv[2:]), ensure_ascii=False, indent=2
            )
        )
    else:
        print("用法: jinyiwei_vet.py '<情报声明>' <来源1> <来源2> ...")
