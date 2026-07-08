"""御史核真库 knowledge_vet —— 反幻觉到事实级。

御史原来只查"有没有标来源"(yushi_gate 那一层),这里升级到
**查声明在不在真实数据里**:把一条声明丢进精华知识库做语义检索,
若能检到相关度≥阈值的支撑片段→判"有据";否则判"无据·疑幻觉,待人核"。

定位:这是 truth_ledger 上的一把确定性真尺子(checker="knowledge_vet"),
不读 LLM 自评分,只读知识库里有没有真东西撑住这句话。

用法::

    from src.knowledge_vet import vet_against_knowledge
    r = vet_against_knowledge("本司2025营收152.8万")
    # {"grounded": True, "evidence": "【来源: ...】...", "relevance": 0.71, "decision": "有据"}

检索路径:走 src.knowledge_rag —— 本地 ChromaDB(get_rag().search) 拿数值相关度,
RAGFlow 在线时退回 pre_retrieve 文本并解析其中的相关度百分比。
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# 相关度阈值:≥此值视为"知识库里有东西撑住这句话"。
# 0.35 是混合检索(RRF 融合分 / 向量余弦分)上一个偏保守的支撑线:
# 宁可把弱支撑判"无据·待人核",也不放幻觉过门。
DEFAULT_THRESHOLD = 0.35

DECISION_GROUNDED = "有据"
DECISION_UNGROUNDED = "无据·疑幻觉,待人核"
DECISION_EMPTY = "无据·知识库为空,待人核"
DECISION_ERROR = "无据·检索失败,待人核"

# 解析 _format_search_hits / RAGFlow 文本里的 "(相关度: 71%)"
_RELEVANCE_RE = re.compile(r"相关度[:：]\s*([0-9]+(?:\.[0-9]+)?)%")


def _result(grounded: bool, evidence: str, relevance: float, decision: str) -> dict:
    return {
        "grounded": grounded,
        "evidence": evidence,
        "relevance": round(float(relevance), 4),
        "decision": decision,
    }


def _max_relevance_from_text(text: str) -> float:
    """从 pre_retrieve / search_as_text 的格式化文本里取最高相关度(0~1)。"""
    pcts = [float(m) for m in _RELEVANCE_RE.findall(text)]
    if not pcts:
        return 0.0
    return max(pcts) / 100.0


def _vet_via_local_rag(claim: str, top_k: int) -> tuple[float, str] | None:
    """本地 ChromaDB 路:返回 (最高相关度, 证据文本);知识库为空返回 None。

    直接读 search() 的结构化 score(混合检索 RRF/向量分),比解析文本更可靠。
    """
    from src.knowledge_rag import get_rag

    rag = get_rag()
    if rag.stats().get("total_chunks", 0) == 0:
        return None

    hits = rag.search(claim, top_k=top_k)
    if not hits:
        return 0.0, ""

    top_relevance = max(float(h.get("score", 0.0) or 0.0) for h in hits)
    evidence = "\n\n---\n\n".join(
        f"【来源: {h.get('source', '?')}】(相关度: {float(h.get('score', 0.0) or 0.0):.0%})\n{h.get('content', '')}"
        for h in hits
    )
    return top_relevance, evidence


def _vet_via_ragflow(claim: str, top_k: int, max_tokens: int) -> tuple[float, str]:
    """RAGFlow 在线路:用 pre_retrieve 拿文本,解析其中相关度百分比。"""
    from src.knowledge_rag import pre_retrieve

    text = pre_retrieve(claim, top_k=top_k, max_tokens=max_tokens)
    if not text:
        return 0.0, ""
    return _max_relevance_from_text(text), text


def vet_against_knowledge(
    claim: str,
    threshold: float = DEFAULT_THRESHOLD,
    top_k: int = 3,
    max_tokens: int = 1500,
) -> dict:
    """核真:声明在不在真实知识库里。

    Args:
        claim: 待核查的声明(如"本司2025营收152.8万")。
        threshold: 相关度阈值,≥此值判"有据"(默认 0.35)。
        top_k: 检索 Top-K 片段。
        max_tokens: RAGFlow 文本路的 token 上限。

    Returns:
        {
          "grounded": bool,     # 知识库里有没有东西撑住这句话
          "evidence": str,      # 支撑片段(带来源),无则空串
          "relevance": float,   # 最高相关度(0~1)
          "decision": str,      # "有据" / "无据·..."
        }
    """
    if not claim or not claim.strip():
        return _result(False, "", 0.0, DECISION_ERROR)

    # RAGFlow 在线时它是 pre_retrieve 的实际后端,本地 search() 拿不到它的分,
    # 走文本解析路;否则走本地 ChromaDB 结构化分(更可靠)。
    try:
        from src.knowledge_rag import get_ragflow

        if get_ragflow().is_configured():
            relevance, evidence = _vet_via_ragflow(claim, top_k, max_tokens)
        else:
            local = _vet_via_local_rag(claim, top_k)
            if local is None:
                return _result(False, "", 0.0, DECISION_EMPTY)
            relevance, evidence = local
    except Exception as e:
        logger.error("knowledge_vet 检索失败 claim=%r: %s", claim[:80], e)
        return _result(False, "", 0.0, DECISION_ERROR)

    grounded = relevance >= threshold
    decision = DECISION_GROUNDED if grounded else DECISION_UNGROUNDED
    # 无据时不返回检索到的弱片段,避免把"擦边但不支撑"的内容当证据误导下游。
    return _result(grounded, evidence if grounded else "", relevance, decision)


def _cli() -> int:
    import json
    import sys

    if len(sys.argv) < 2:
        print(
            "用法: python -m src.knowledge_vet '<待核查声明>' [阈值]", file=sys.stderr
        )
        return 2
    claim = sys.argv[1]
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_THRESHOLD
    out = vet_against_knowledge(claim, threshold=threshold)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if out["grounded"] else 1


if __name__ == "__main__":
    raise SystemExit(_cli())
