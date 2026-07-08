"""检索快照工具 — 把带 RAG 的蜂群 input 钉成可复现常量。

会审地基结论（2026-06-08 大神评审）：9 个 knowledge_pre_retrieval 蜂群的真实 input
= task + 当时命中的库片段。golden case 只锁 task → 同一句话不同时刻命中不同库 → input
不可复现 → 质量分 before/after delta 里 RAG 漂移与真实退化纠缠、无法归因。

本模块提供单一真相的快照规范化 + sha256 完整性校验，被三处复用：
  - scripts/freeze_retrieval_snapshots.py  捕获快照写回 golden case
  - scripts/eval_ci.py                     L2 评测时注入冻结快照（run(context_override=...)）
  - scripts/validate_flows.py              CI 门：带检索的蜂群每条 case 必须 snapshot-pinned 且 hash 自洽

哈希语义：sha256 锁的是"快照内容自洽"（存的 hash == 存的内容的 hash），是零成本确定性校验，
证明快照未被手改/损坏。它**不**与实时检索比对——实时检索非确定且烧钱，不适合做 CI 门。
"""

from __future__ import annotations

import hashlib
import json

# 快照里参与哈希的检索源键（顺序固定，保证规范化可复现）
SNAPSHOT_CONTENT_KEYS = ("rag_docs", "ima_docs", "knowledge")


def is_retrieval_swarm(flow_config: dict) -> bool:
    """判定一个 flow 是否带"每次运行会动态检索"的输入源（→ input 不可复现风险）。

    三类：① knowledge_pre_retrieval.enabled（RAG 预检索）
         ② ima_pre_retrieval.enabled（IMA 知识库预检索）
         ③ 动态电芯注入（knowledge_inject.file 以 cell_library.json 结尾，按 task 筛子集）
    任一为真 → 该蜂群的 golden case 必须 snapshot-pin，否则质量分量的是漂移的风。
    """
    if not isinstance(flow_config, dict):
        return False
    if (flow_config.get("knowledge_pre_retrieval") or {}).get("enabled"):
        return True
    if (flow_config.get("ima_pre_retrieval") or {}).get("enabled"):
        return True
    # 动态电芯注入：必须与 flow_engine.py 的判定同源——dynamic 默认 True
    # （engine: str(file).endswith("cell_library.json") and _ki.get("dynamic", True)）。
    ki = flow_config.get("knowledge_inject") or {}
    if str(ki.get("file", "")).endswith("cell_library.json") and ki.get("dynamic", True):
        return True
    return False


def canonical_payload(snapshot: dict) -> str:
    """把快照的检索内容键规范化为确定性字符串（用于哈希）。

    只取 SNAPSHOT_CONTENT_KEYS，缺键视为空串，键序固定 → 同样内容永远同样字符串。
    """
    payload = {k: str(snapshot.get(k, "") or "") for k in SNAPSHOT_CONTENT_KEYS}
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def compute_sha256(snapshot: dict) -> str:
    """计算快照检索内容的 sha256。"""
    return hashlib.sha256(canonical_payload(snapshot).encode("utf-8")).hexdigest()


def build_snapshot(rag_docs: str = "", ima_docs: str = "", knowledge: str = "", frozen_at: str = "") -> dict:
    """从检索结果构造一个带 sha256 的快照 dict（写回 golden case 用）。"""
    snap = {
        "rag_docs": rag_docs or "",
        "ima_docs": ima_docs or "",
        "knowledge": knowledge or "",
        "empty": not (rag_docs or ima_docs or knowledge),
    }
    if frozen_at:
        snap["frozen_at"] = frozen_at
    snap["sha256"] = compute_sha256(snap)
    return snap


def context_override_from(snapshot: dict | None) -> dict | None:
    """从 golden case 的 retrieved_snapshot 提取 run(context_override=...) 所需的键。

    只回传非空的检索源键；snapshot 为 None 时返回 None（→ 走实时检索，向后兼容）。
    注意：即便某键为空串也回传，因为"冻结的空"也是可复现状态（短路实时检索）。
    """
    if not snapshot:
        return None
    return {k: str(snapshot.get(k, "") or "") for k in SNAPSHOT_CONTENT_KEYS if k in snapshot}


def verify_integrity(snapshot: dict | None) -> tuple[bool, str]:
    """校验快照自洽：存在 sha256 且与内容哈希一致。

    返回 (ok, reason)。reason 在 ok=False 时说明原因，供 CI 门打印。
    """
    if not snapshot:
        return False, "缺 retrieved_snapshot"
    stored = snapshot.get("sha256")
    if not stored:
        return False, "快照缺 sha256 字段"
    actual = compute_sha256(snapshot)
    if stored != actual:
        return False, f"sha256 对不上（存={stored[:12]}… 实算={actual[:12]}…，疑被手改/损坏）"
    return True, "ok"
