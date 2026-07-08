"""锦衣卫情报端点 — 真实采证已接线(Tavily),诚实降级为调用方自带 findings。

src/jinyiwei_agent.gather_intel 是真实、确定性分级的情报可信度门(src/jinyiwei_vet)。
本端点两种采证模式,优先真实:
  ① 调用方传了 findings(claim+sources) → 直接用(离线/自带证据链)。
  ② 未传 findings 且 TAVILY_API_KEY 存在 → src/jinyiwei_search.tavily_search 真实联网检索。
  ③ 都没有 → 诚实空态"未获取到可核情报",不编造(sourceLabel=FALLBACK)。
可信度分级永远走确定性 vet 门,不因采证来源不同而放水。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from src import jinyiwei_agent as ja
from src.jinyiwei_search import tavily_search
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/intel", tags=["jinyiwei"])


@router.post("/brief")
def intel_brief(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """谍报简报:采证(自带 findings 或 Tavily 真检索) → 确定性可信度分级 → court_doc。

    body = {query, findings?: [{claim, sources:[...]}]}
    findings 缺省时用 Tavily 真实检索(需 TAVILY_API_KEY);无 key → 诚实空态,不编造。
    返回体附 sourceLabel: LIVE_SEARCH | CALLER_FINDINGS | FALLBACK。
    """
    query = str(body.get("query") or "").strip()
    if not query:
        return fail("query 不能为空")
    findings = body.get("findings")
    if findings is not None and not isinstance(findings, list):
        return fail("findings 必须是 array(调用方已检索到的 claim/sources 列表)")

    if findings:
        search_fn = lambda _q: findings  # noqa: E731  调用方自带证据链
        source_label = "CALLER_FINDINGS"
    else:
        search_fn = tavily_search        # 真实联网;无 key/失败 → 返回 [],gather_intel 诚实空态
        source_label = "LIVE_SEARCH"

    try:
        doc = ja.gather_intel(query, search_fn=search_fn, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"谍报生成失败: {exc}")
    # gather_intel 空态(采证一无所获)诚实降级标签,不冒充有货
    if not (doc.get("items") if isinstance(doc, dict) else None):
        source_label = "FALLBACK"
    if isinstance(doc, dict):
        doc["sourceLabel"] = source_label
    return ok(doc)
