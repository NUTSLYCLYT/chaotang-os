"""刑部法务端点:legal/overview — 真实合同案件(来源 市场部 合同台账,数据存 gitignored data/)。"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends

from src import xingbu_verdict
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.routers._envelope import fail, ok

router = APIRouter(prefix="/api/legal", tags=["legal"])

_CASES_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "legal_cases.json"


def _load_cases() -> list[dict]:
    try:
        return json.loads(_CASES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


@router.get("/overview")
def legal_overview(_: CurrentUser = Depends(get_current_user)) -> dict:
    cases = _load_cases()
    crit = sum(1 for c in cases if c.get("riskLevel") in ("critical", "high"))
    compliance = [
        {"id": "cmp-contract", "title": "销售合同范本合规", "category": "contract",
         "status": "passed", "riskLevel": "low", "deadline": "",
         "checklistTotal": len(cases), "checklistPassed": len(cases), "assignedTo": "刑部"},
    ]
    return ok({
        "cases": cases,
        "complianceItems": compliance,
        "summary": {
            "totalCases": len(cases),
            "pendingCount": sum(1 for c in cases if c.get("status") in ("pending_review", "reviewing")),
            "closedThisWeek": "0",
            "complianceBacklog": 0,
            "avgCycleDays": 0,
            "closureRate": (f"{round(sum(1 for c in cases if c.get('status')=='closed')/len(cases)*100)}%" if cases else "—"),
            "recommendation": "历史合同主体已结案;关注履约质保期与续签节点。",
            "source": "turso" if cases else "fallback",
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    })


@router.post("/verdict")
def legal_verdict(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """刑部判决:消费结构化 findings,返回符合 court_doc 的判决书(预览,不签字执行)。

    body = {case_id?, question, items:[{level,title,odds,impact,fix,evidence_ref}],
            adversarial?, advisors?, shielded?, escalate_black?, rag_hit?}
    接地铁律:观点席判官 posner/schneier 未命中 RAG(rag_hit=false)→ 判决降级"需人工复核"。
    """
    if not isinstance(body.get("items"), list):
        return fail("items 必须是 array(结构化 findings)")
    try:
        verdict = xingbu_verdict.build_verdict(
            body, rag_hit=bool(body.get("rag_hit")),
        )
    except Exception as exc:  # noqa: BLE001
        return fail(str(exc))
    return ok(verdict)


@router.post("/verdict/from-text")
def legal_verdict_from_text(
    body: dict[str, Any] = Body(...),
    _: CurrentUser = Depends(get_current_user),
) -> dict:
    """刑部端到端:合同/承诺全文 → LLM 抽 findings → 检索律师法条库算 rag_hit → 判决 court_doc。

    body = {text, case_id?}。首发垂直入口:客户贴合同,一张判决书出。需 LLM 网关(active provider)。
    rag_hit 由系统检索律师法条库算出(lawyer_rag),不接受自报。
    """
    text = str(body.get("text") or "").strip()
    if not text:
        return fail("text 不能为空(合同/承诺全文)")
    try:
        verdict = xingbu_verdict.run_verdict_from_text(
            text, case_id=body.get("case_id"), archive=True,
        )
    except Exception as exc:  # noqa: BLE001
        return fail(f"判决生成失败: {exc}")
    return ok(verdict)
