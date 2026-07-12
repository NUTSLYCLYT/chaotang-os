"""锦衣卫情报端点 — 真实采证已接线(Tavily),诚实降级为调用方自带 findings。

src/jinyiwei_agent.gather_intel 是真实、确定性分级的情报可信度门(src/jinyiwei_vet)。
本端点两种采证模式,优先真实:
  ① 调用方传了 findings(claim+sources) → 直接用(离线/自带证据链)。
  ② 未传 findings 且 TAVILY_API_KEY 存在 → src/jinyiwei_search.tavily_search 真实联网检索。
  ③ 都没有 → 诚实空态"未获取到可核情报",不编造(sourceLabel=FALLBACK)。
可信度分级永远走确定性 vet 门,不因采证来源不同而放水。
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, Query

from src import jinyiwei_agent as ja
from src.jinyiwei_search import tavily_search
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/intel", tags=["jinyiwei"])
_logger = logging.getLogger(__name__)


def _persist_brief_items(
    *,
    query: str,
    findings: list,
    doc: dict,
    source_label: str,
    origin_task_id: str | None = None,
) -> None:
    """把 gather_intel 已经算好的每条情报存进共享池，供以后任意任务查询复用。
    最佳努力：持久化失败不影响调用方(/api/intel/brief 或
    /api/intel/evidence/fill-gap)本身的返回(同 court_doc_builder.py 里
    truth_ledger.record() 的既有 best-effort 惯例)。"""
    items = doc.get("items") if isinstance(doc, dict) else None
    if not items:
        return
    try:
        from src.db.engine import SessionLocal
        from src.jinyiwei_evidence_store import upsert_evidence
        from src.tenant import resolve_current_tenant_id

        # 用当前请求真实的租户(get_current_user() 已在请求进入时从 JWT 设好
        # 线程本地租户 slug)，不能用 _get_default_tenant_id() 那种硬查
        # slug='default' 的写法——那个函数不看是谁在调用，会把所有租户的
        # 情报都错误地写进同一个 tenant_id，等同于假装系统是单租户。
        tenant_id = resolve_current_tenant_id()
        db = SessionLocal()
        try:
            for finding, item in zip(findings, items):
                claim = str(finding.get("claim", "")) if isinstance(finding, dict) else ""
                if not claim:
                    continue
                upsert_evidence(
                    db,
                    tenant_id=tenant_id,
                    query=query,
                    claim=claim,
                    sources=item.get("sources"),
                    item=item,
                    source_label=source_label,
                    origin_task_id=origin_task_id,
                )
            db.commit()
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - 情报入库失败不影响调用方本身返回
        _logger.warning("锦衣卫情报写回共享池失败(不影响调用方本身返回)", exc_info=True)


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
        source_label = "CALLER_FINDINGS"
    else:
        source_label = "LIVE_SEARCH"
        try:
            findings = tavily_search(query) or []  # 真实联网;无 key/失败 → 空态
        except Exception:  # noqa: BLE001 - 诚实空态,不编造
            findings = []

    # 两条采证路径统一成同一种"调用方已有 findings"形状——这样路由层自己手上
    # 始终留着未截断的原始 claim 列表，供 gather_intel 返回后按下标跟 vet 过的
    # items 配对存进共享情报池(_finding_to_item 只把 claim 截断进 title 前60字，
    # 不保留完整文本，只能靠路由层自己留一份)。
    search_fn = lambda _q: findings  # noqa: E731

    try:
        doc = ja.gather_intel(query, search_fn=search_fn, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"谍报生成失败: {exc}")
    # gather_intel 空态(采证一无所获)诚实降级标签,不冒充有货
    if not (doc.get("items") if isinstance(doc, dict) else None):
        source_label = "FALLBACK"
    else:
        _persist_brief_items(query=query, findings=findings, doc=doc, source_label=source_label)
    if isinstance(doc, dict):
        doc["sourceLabel"] = source_label
    return ok(doc)


@router.get("/evidence")
def intel_evidence(
    query: str | None = Query(default=None),
    dept: str | None = Query(default=None),
    include_pending: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """查共享情报池——锦衣卫已核实过的情报，跨任务可复用查询。字段命名对齐
    frontend/src/lib/contracts/evidence.ts::EvidenceRecord，方便前端接线时
    接近直通，不需要二次映射。"""
    from src.db.engine import SessionLocal
    from src.jinyiwei_evidence_store import query_evidence
    from src.tenant import resolve_current_tenant_id

    tenant_id = resolve_current_tenant_id()
    db = SessionLocal()
    try:
        rows = query_evidence(
            db,
            tenant_id=tenant_id,
            keyword=query,
            dept=dept,
            include_pending=include_pending,
            limit=limit,
        )
    finally:
        db.close()

    return ok(
        {
            "items": [
                {
                    "evidenceType": "intel",
                    "trust": row["trust"],
                    "deptAffinity": row["dept_affinity"],
                    "insight": f"{row['claim']}({row['grade']})",
                    "sourceLabel": row["source_label"],
                    "originTaskId": row["origin_task_id"],
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                }
                for row in rows
            ]
        }
    )


@router.post("/evidence/fill-gap")
def intel_evidence_fill_gap(
    body: dict[str, Any] = Body(...),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """人工触发的证据缺口填补——锦衣卫共享证据服务阶段3。

    body = {task_id, gap}。只对处于"证据不足"决策阶段、且属于当前请求者
    自己的任务开放(DecisionTask.status == "awaiting_evidence" 且
    DecisionTask.user_id == 当前用户)，不是任意任务都能调用。

    2026-07-12 Codex 停止前审查纠正："new fill-gap endpoint is tenant/user
    blind"——第一版只把 CurrentUser 当鉴权门槛(参数名 `_`，取到手直接丢掉)，
    没有核对 task_id 是不是调用者自己的任务。DecisionTask 表本身没有
    tenant_id 列(这是一个更大的、跨越 shangshufang.py 十几个端点的既有系统性
    缺口，见 harness 记录里的讨论，不在本次改动范围内一起修)，但它有
    user_id 列且在任务创建时(draft_edict 等)真实填了当前用户的身份
    (_user_id(user)，不是恒定的 "anonymous")，所以按 user_id 做归属校验
    是一个对新增端点而言真实、有效的最小修复——不去追平其余十几个既有端点
    同样缺失的整体授权模型，但新写的代码不应该带着明知可以做、却不做的
    同类漏洞上线。

    这是"evidence_gap_detected"从纯计划文档短语变成一个真实、人工触发动作
    的落点——不建自动化监听/自动重审流水线(那是更大的独立工程)，只给正在
    处理"证据不足"决策的人一个"点一下让锦衣卫去查这条缺口"的真实按钮，
    结果同时写回共享池供后续任务复用。
    """
    from src.db.engine import SessionLocal
    from src.db.models import DecisionTask

    task_id = str(body.get("task_id") or "").strip()
    gap = str(body.get("gap") or "").strip()
    if not task_id:
        return fail("task_id 不能为空")
    if not gap:
        return fail("gap 不能为空")

    requester_id = str(user.user_id or user.username or user.tenant_slug or "anonymous")

    db = SessionLocal()
    try:
        task = db.query(DecisionTask).filter_by(id=task_id).first()
        if task is None:
            return fail("task_id 不存在")
        if task.user_id != requester_id:
            return fail("无权操作该任务")
        if task.status != "awaiting_evidence":
            return fail(
                f"任务当前状态是 {task.status}，不是 awaiting_evidence，"
                "不能填补证据缺口"
            )
    finally:
        db.close()

    findings: list = []
    source_label = "LIVE_SEARCH"
    try:
        findings = tavily_search(gap) or []
    except Exception:  # noqa: BLE001 - 诚实空态,不编造
        findings = []
    search_fn = lambda _q: findings  # noqa: E731

    try:
        doc = ja.gather_intel(gap, search_fn=search_fn, archive=True)
    except Exception as exc:  # noqa: BLE001
        return fail(f"证据缺口填补失败: {exc}")
    if not (doc.get("items") if isinstance(doc, dict) else None):
        source_label = "FALLBACK"
    else:
        _persist_brief_items(
            query=gap,
            findings=findings,
            doc=doc,
            source_label=source_label,
            origin_task_id=task_id,
        )
    if isinstance(doc, dict):
        doc["sourceLabel"] = source_label
    return ok(doc)
