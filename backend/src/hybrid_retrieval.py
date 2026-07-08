"""Hybrid 混合检索 —— 2026 RAG 共识方案的最小落地核心。

研究结论(2026):纯向量已不够,hybrid(稠密向量 + 稀疏关键词 + RRF 融合 + 重排)精度 +15~30%;
"长上下文取代检索"已破。本模块提供【可独立测试的融合/重排核心】,与具体检索后端解耦。

⚠️ 接线点(你现有零件):
  - 稠密腿 = src.knowledge_rag.KnowledgeRAG(chroma,对知识文档)。
  - 稀疏腿 = 对【同一批文档】的关键词索引。注意:src.memory_store 的 FTS5 索引的是"历史 run 记忆",
    不是知识文档,不能直接当稀疏腿——需对知识文档建一份 FTS5(可复用 memory_store 的 FTS 写法)。
  本模块不替你改 KnowledgeRAG;你把"稠密检索函数"和"稀疏检索函数"传进来即可,融合+重排我包好。

用法:
  hr = HybridRetriever(dense_search=my_dense, sparse_search=my_sparse, rerank=True)
  hits = hr.search("青海 -40℃ 储能 容量衰减", top_k=8)
检索函数签名:  fn(query: str, n: int) -> list[dict]   # 每个 dict 至少含 {"id", "text"}(可含 "score")
"""

from __future__ import annotations

import json
import os
from typing import Callable

Retriever = Callable[[str, int], list[dict]]


def rrf_fuse(result_lists: list[list[dict]], k: int = 60, id_key: str = "id") -> list[dict]:
    """Reciprocal Rank Fusion:把多路检索结果按 1/(k+rank) 累加融合。纯函数、可测、无依赖。
    跨路只看排名不看各自分数量纲,稳健。返回按融合分降序的去重列表(保留首见的完整 dict)。"""
    scores: dict = {}
    payload: dict = {}
    for lst in result_lists:
        for rank, item in enumerate(lst):
            _id = item.get(id_key)
            if _id is None:
                continue
            scores[_id] = scores.get(_id, 0.0) + 1.0 / (k + rank + 1)
            payload.setdefault(_id, item)
    fused = [{**payload[_id], "rrf_score": s} for _id, s in scores.items()]
    fused.sort(key=lambda x: x["rrf_score"], reverse=True)
    return fused


def llm_rerank(query: str, candidates: list[dict], top_n: int = 8) -> list[dict]:
    """用 LiteLLM 网关上的模型做相关性重排(无独立 reranker 模型时的务实方案)。
    失败/无网关 → 原样返回前 top_n(降级不抛错)。"""
    if not candidates:
        return []
    try:
        from openai import OpenAI

        client = OpenAI(
            base_url=os.environ.get("LITELLM_BASE_URL", "http://127.0.0.1:4000/v1"),
            api_key=os.environ.get("LITELLM_PROXY_KEY", "sk-noauth"),
        )
        listing = "\n".join(f"[{i}] {c.get('text', '')[:300]}" for i, c in enumerate(candidates))
        resp = client.chat.completions.create(
            model=os.environ.get("RERANK_MODEL", "openai/glm-5.1"),
            messages=[
                {
                    "role": "system",
                    "content": "你是检索重排器。按与查询的相关度,只输出 JSON 数组,元素为候选编号(最相关在前)。",
                },
                {"role": "user", "content": f"查询:{query}\n\n候选:\n{listing}\n\n只输出如 [3,0,5,...] 的编号数组。"},
            ],
            temperature=0,
        )
        txt = resp.choices[0].message.content or "[]"
        order = json.loads(txt[txt.find("[") : txt.rfind("]") + 1])
        ranked = [candidates[i] for i in order if isinstance(i, int) and 0 <= i < len(candidates)]
        seen = {id(x) for x in ranked}
        ranked += [c for c in candidates if id(c) not in seen]  # 补齐漏掉的
        return ranked[:top_n]
    except Exception:
        return candidates[:top_n]


class HybridRetriever:
    """稠密 + 稀疏 → RRF 融合 →(可选)LLM 重排。后端解耦,只认两个检索函数。"""

    def __init__(self, dense_search: Retriever, sparse_search: Retriever, rerank: bool = True, k: int = 60):
        self.dense_search = dense_search
        self.sparse_search = sparse_search
        self.rerank = rerank
        self.k = k

    def search(self, query: str, top_k: int = 8, fetch: int = 30) -> list[dict]:
        dense = self.dense_search(query, fetch) or []
        sparse = self.sparse_search(query, fetch) or []
        fused = rrf_fuse([dense, sparse], k=self.k)
        if self.rerank:
            return llm_rerank(query, fused[: max(top_k * 3, 20)], top_n=top_k)
        return fused[:top_k]


if __name__ == "__main__":
    # 自测:RRF 融合逻辑(纯函数,无需任何后端/网络)
    dense = [{"id": "A", "text": "a"}, {"id": "B", "text": "b"}, {"id": "C", "text": "c"}]
    sparse = [{"id": "C", "text": "c"}, {"id": "D", "text": "d"}, {"id": "A", "text": "a"}]
    fused = rrf_fuse([dense, sparse])
    order = [x["id"] for x in fused]
    print("融合排序:", order, "| 分数:", {x["id"]: round(x["rrf_score"], 4) for x in fused})
    assert order[0] in ("A", "C"), "两路都命中的 A/C 应排前"
    assert set(order) == {"A", "B", "C", "D"}, "应去重并保留全部 4 个"
    assert order.index("A") < order.index("B"), "A(两路命中)应排在 B(单路)前"
    print("✅ RRF 融合自测通过(两路共识项排前、去重、全保留)")
