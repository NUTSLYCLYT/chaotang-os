#!/usr/bin/env python3
"""RAG 检索质量【尺子】—— Karpathy 全场死磕的第一前提:先能测,再改。

"测不出 recall@k 之前,GraphRAG/agentic 都是 demo 不是工程。" 本脚本给你 baseline,
让"假向量→真向量→加真双路 hybrid"每一步的涨跌用数字说话,而非拍脑袋。

指标:recall@k(标准答案有几个进了前 k)、hit@k(前 k 里至少命中一个)、MRR(首个命中的倒数排名)。
注意:recall 只需"标准答案 doc 是否进前 k",不需要 LLM,纯客观、零成本、可反复跑。

gold 集(scripts/golden_cases/rag_gold.json,由懂业务的人标 30-50 条):
  [{"query": "真实电芯问题", "relevant": ["命中算对的 doc 标识(source/file/id 子串)", ...]}]
  ⚠️ relevant 是领域真值,AI 不能代标。

用法:
  python scripts/rag_eval.py            # 用 KnowledgeRAG.search 跑 gold,出 baseline
  python scripts/rag_eval.py --selftest # 仅自测指标算法(合成数据,无需后端)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
GOLD = ROOT / "scripts" / "golden_cases" / "rag_gold.json"


def _hit(doc_ident: str, relevant: list[str]) -> bool:
    s = str(doc_ident)
    return any(str(r) and str(r) in s for r in relevant)


def evaluate(search_fn, gold: list[dict], k: int = 5) -> dict:
    """search_fn(query, k) -> list[str](按相关度排序的 doc 标识)。返回聚合指标。"""
    recalls, hits, rrs, per = [], [], [], []
    for case in gold:
        q, rel = case["query"], case.get("relevant", [])
        ranked = search_fn(q, k)[:k]
        n_hit = sum(1 for d in ranked if _hit(d, rel))
        recall = n_hit / len(rel) if rel else 0.0
        hit = 1.0 if n_hit > 0 else 0.0
        rr = 0.0
        for i, d in enumerate(ranked):
            if _hit(d, rel):
                rr = 1.0 / (i + 1)
                break
        recalls.append(recall)
        hits.append(hit)
        rrs.append(rr)
        per.append({"query": q[:40], "recall@k": round(recall, 2), "hit": int(hit), "rr": round(rr, 2)})
    n = len(gold) or 1
    return {
        "n": len(gold),
        "k": k,
        f"recall@{k}": round(sum(recalls) / n, 3),
        f"hit@{k}": round(sum(hits) / n, 3),
        "MRR": round(sum(rrs) / n, 3),
        "per_query": per,
    }


def _knowledge_search(query: str, k: int) -> list[str]:
    """适配 KnowledgeRAG.search → 返回 doc 标识(source/file)列表。"""
    from src.knowledge_rag import KnowledgeRAG

    rag = KnowledgeRAG()
    res = rag.search(query, top_k=k)
    out = []
    for r in res if isinstance(res, list) else res.get("results", []):
        out.append(str(r.get("source") or r.get("file") or r.get("id") or r))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="RAG 检索质量尺子(recall@k/MRR)")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("-k", type=int, default=5)
    args = ap.parse_args()

    if args.selftest:
        # 合成:gold 2 条,假 search_fn,验指标算法
        gold = [
            {"query": "q1", "relevant": ["docA"]},
            {"query": "q2", "relevant": ["docX", "docY"]},
        ]

        def fake(q, k):
            return {"q1": ["docZ", "docA", "docB"], "q2": ["docX", "docW", "docY"]}[q][:k]

        m = evaluate(fake, gold, k=3)
        print(json.dumps(m, ensure_ascii=False, indent=2))
        # q1: docA 在第2位 → recall=1/1=1, rr=1/2=0.5;q2: docX(1)+docY(3) → recall=2/2=1, rr=1/1=1
        assert m["recall@3"] == 1.0, m
        assert m["MRR"] == round((0.5 + 1.0) / 2, 3), m
        print("✅ 指标算法自测通过(recall@k / hit@k / MRR)")
        return 0

    if not GOLD.exists():
        print(
            f"❌ 缺 gold 集: {GOLD}\n   先标 30-50 条 (query, relevant) —— 领域真值,AI 不能代标(格式见本脚本 docstring)。"
        )
        print("   有了 gold,先跑一次拿 baseline;再设真 embedding/接真双路 hybrid,重跑看涨跌。")
        return 1

    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    print(f"RAG 尺子:{len(gold)} 条 gold,k={args.k}\n")
    m = evaluate(_knowledge_search, gold, k=args.k)
    print(f"baseline → recall@{args.k}={m[f'recall@{args.k}']}  hit@{args.k}={m[f'hit@{args.k}']}  MRR={m['MRR']}")
    print("\n(把这个数记下来。改 embedding/hybrid 后重跑,只认 recall 涨了没。)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
