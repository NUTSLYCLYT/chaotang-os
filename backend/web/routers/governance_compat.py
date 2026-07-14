"""Small backend-owned compatibility routes for governance and scribe UIs."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Response
from fastapi.responses import StreamingResponse

from src import governance_compat_store

router = APIRouter(tags=["governance-compat"])

_ACTOR = "liubu"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_event(bill_id: str, event_type: str, actor: str, reason: str) -> dict[str, Any]:
    return {
        "id": f"evt-{secrets.token_hex(6)}",
        "billId": bill_id,
        "type": event_type,
        "actor": actor,
        "ts": _now_iso(),
        "reason": reason,
    }


def _new_bill(command: str) -> dict[str, Any]:
    bill_id = f"bill-{secrets.token_hex(6)}"
    created_at = _now_iso()
    bill = {
        "id": bill_id,
        "title": command[:30] or "未命名案卷",
        "command": command,
        "state": "drafted",
        "draft": f"中书草拟：{command}",
        "events": [_new_event(bill_id, "create", "zhongshu", "兼容端点起草")],
        "createdAt": created_at,
        "lastTransitionAt": created_at,
        "revisionCount": 0,
        "sourceLabel": "FALLBACK",
    }
    return governance_compat_store.save_bill(bill, actor="zhongshu")


@router.get("/api/governance/bills")
def governance_bills() -> dict:
    bills = governance_compat_store.list_bills()
    return {"bills": bills, "count": len(bills), "sourceLabel": "FALLBACK"}


@router.post("/api/governance/bills")
def governance_create_bill(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    command = str(body.get("command") or "").strip()
    bill = _new_bill(command)
    bill.setdefault("sourceLabel", "FALLBACK")
    return bill


@router.get("/api/governance/whoami")
def governance_whoami() -> dict:
    return {"actor": _ACTOR, "sourceLabel": "FALLBACK"}


@router.post("/api/governance/whoami")
def governance_set_actor(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    global _ACTOR
    actor = str(body.get("actor") or "liubu")
    _ACTOR = actor
    return {"actor": _ACTOR, "sourceLabel": "FALLBACK"}


@router.get("/api/governance/audit/summary")
def governance_audit_summary() -> dict:
    bills = governance_compat_store.list_bills()
    total_frames = sum(len(bill.get("events", [])) for bill in bills)
    return {
        "totalBills": len(bills),
        "okCount": len(bills),
        "tamperedCount": 0,
        "totalFrames": total_frames,
        "tampered": [],
        "sourceLabel": "FALLBACK",
    }


@router.post("/api/governance/bills/{bill_id}/transition")
def governance_transition_bill(
    bill_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
):
    bill = governance_compat_store.get_bill(bill_id)
    if not bill:
        return Response(
            json.dumps({"error": "bill_not_found"}, ensure_ascii=False),
            status_code=404,
            media_type="application/json",
        )
    event_type = str(body.get("type") or "submit_to_review")
    actor = str(body.get("actor") or _ACTOR)
    reason = str(body.get("reason") or "兼容端点转移")
    state_by_event = {
        "submit_to_review": "under_review",
        "approve": "approved",
        "reject_for_revision": "revising",
        "reject_final": "rejected",
        "shelve": "shelved",
        "resubmit": "under_review",
        "dispatch": "executing",
        "mark_completed": "completed",
        "mark_failed": "failed",
        "archive": "archived",
    }
    bill["state"] = state_by_event.get(event_type, bill["state"])
    bill["lastTransitionAt"] = _now_iso()
    bill["events"].insert(0, _new_event(bill_id, event_type, actor, reason))
    bill["sourceLabel"] = "FALLBACK"
    if event_type == "reject_for_revision":
        bill["revisionCount"] = int(bill.get("revisionCount") or 0) + 1
    return governance_compat_store.save_bill(bill, actor=actor)


@router.get("/api/governance/bills/{bill_id}/audit")
def governance_bill_audit(bill_id: str) -> dict:
    bill = governance_compat_store.get_bill(bill_id)
    return {
        "ok": bill is not None,
        "totalChecked": len(bill.get("events", [])) if bill else 0,
        "firstTamperedAt": -1,
        "reason": None if bill else "bill_not_found",
        "sourceLabel": "FALLBACK",
    }


@router.post("/api/governance/deliberate")
def governance_deliberate(
    response: Response,
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict:
    response.headers["X-Upstream"] = "fallback"
    command = str(body.get("command") or "").strip()
    started = datetime.now(timezone.utc)
    return {
        "sessionId": f"gov-{secrets.token_hex(6)}",
        "timestamp": started.isoformat(),
        "originalCommand": command,
        "zhongshu": {
            "draft": f"中书草拟：{command}",
            "benefits": ["目标已登记", "可进入审议", "保留审计"],
            "concerns": ["未接实时 LLM", "需人工复核", "sourceLabel=FALLBACK"],
            "affectedDepts": ["六部"],
            "citations": [],
        },
        "menxia": {
            "verdict": "再议",
            "reasoning": "兼容端点不伪装实时三省 LLM，建议转入正式后端审议链。",
            "violatedConstitutions": [],
            "precedents": [],
            "suggestedEdits": ["补充事实源", "确认责任部门"],
        },
        "finalVerdict": "再议",
        "totalMs": 0,
    }


@router.post("/api/chat")
def compat_chat(body: dict[str, Any] = Body(default_factory=dict)) -> StreamingResponse:
    message = str(body.get("message") or "").strip()

    def events():
        token = f"太医院兼容问询已收到：{message[:120]}。本回答仅供参考，不构成诊疗建议。"
        yield f"data: {json.dumps({'token': token, 'sourceLabel': 'FALLBACK'}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/api/scribe/annals")
def scribe_annals(body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    period = str(body.get("period") or "unknown")
    events = body.get("events") if isinstance(body.get("events"), list) else []
    return {
        "id": f"annal-{secrets.token_hex(6)}",
        "period": period,
        "chapterMd": f"## {period} 纪事\n\n本期共有 {len(events)} 件事可入史。兼容端点未调用实时 LLM。",
        "sourceEventIds": [str(item.get("id")) for item in events if isinstance(item, dict) and item.get("id")],
        "keyLessons": ["保留事实源标签", "未接实时 LLM 时不伪装"],
        "generatedAt": _now_iso(),
        "readByRuler": False,
        "sourceLabel": "FALLBACK",
    }


@router.get("/api/scribe/lessons")
def scribe_lessons() -> dict:
    return {"lessons": [], "sourceLabel": "FALLBACK"}


@router.post("/api/court/shiguan/analyze")
def shiguan_analyze() -> dict:
    return {
        "analysis": "史馆兼容分析：当前未接实时 LLM，返回诚实空态。",
        "citations": [],
        "generatedAt": _now_iso(),
        "sourceLabel": "FALLBACK",
    }


@router.get("/api/court/shiguan/stats")
def shiguan_stats() -> dict:
    return {
        "totalTasks": 0,
        "totalCases": 0,
        "successRate": 0,
        "sourceLabel": "FALLBACK",
    }


@router.get("/api/court/shiguan/archives")
def shiguan_archives(limit: int = 80) -> dict:
    return {
        "success": True,
        "data": {
            "archives": [],
            "total": 0,
            "limit": limit,
            "sourceLabel": "FALLBACK",
        },
        "error": None,
    }


@router.get("/api/court/shiguan/archives/{archive_id}")
def shiguan_archive_detail(archive_id: str) -> dict:
    return {
        "success": True,
        "data": {
            "archive": {
                "id": archive_id,
                "title": "史馆兼容空案卷",
                "type": "fallback",
                "summary": "正式案卷详情接口已接通；当前后端未找到对应真实案卷。",
                "decisionChain": [],
                "evidence": [],
                "lessons": [],
                "retrospectiveStatus": "pending",
                "sourceLabel": "FALLBACK",
            },
            "sourceLabel": "FALLBACK",
        },
        "error": None,
    }


@router.get("/api/court/shiguan/archives/{archive_id}/similar")
def shiguan_archive_similar(archive_id: str, limit: int = 5) -> dict:
    return {
        "success": True,
        "data": {
            "archiveId": archive_id,
            "similar": [],
            "limit": limit,
            "sourceLabel": "FALLBACK",
        },
        "error": None,
    }


@router.post("/api/court/shiguan/archives/{archive_id}/verdict")
def shiguan_archive_verdict(archive_id: str) -> dict:
    return {
        "success": True,
        "data": {
            "archiveId": archive_id,
            "verdict": "仅作兼容空态；未生成真实史馆判词。",
            "reusableLessons": [],
            "blockedReasons": ["missing_live_archive_detail"],
            "sourceLabel": "FALLBACK",
        },
        "error": None,
    }


@router.get("/api/court/shiguan/release-gates")
def shiguan_release_gates() -> dict:
    return {
        "success": True,
        "data": {"sourceLabel": "FALLBACK", "gates": [], "blocking": []},
        "error": None,
    }


@router.post("/api/shiguan/archives/{archive_id}/retrospective")
def shiguan_retrospective(archive_id: str, body: dict[str, Any] = Body(default_factory=dict)) -> dict:
    return {
        "success": True,
        "data": {
            "archiveId": archive_id,
            "retrospectiveStatus": body.get("retrospective_status") or "pending",
            "sourceLabel": "FALLBACK",
        },
        "error": None,
    }


@router.get("/api/court/shiguan/promo-archive")
def shiguan_promo_archive() -> dict:
    return {
        "success": True,
        "data": {
            "source": "fallback",
            "sourceLabel": "FALLBACK",
            "archivedTotal": 0,
            "curatedCount": 0,
            "bulkArchiveCount": 0,
            "byCategory": {},
            "curated": [],
            "items": [],
        },
        "error": None,
    }


@router.get("/api/court/true-chain-health")
def true_chain_health() -> dict:
    from src.db.engine import SessionLocal
    from src.true_chain_health import evaluate_true_chain_health

    db = SessionLocal()
    try:
        data = evaluate_true_chain_health(db)
        data["generatedAt"] = _now_iso()
        return {"success": True, "data": data, "error": None}
    finally:
        db.close()


@router.post("/api/manor/stream")
def manor_stream(body: dict[str, Any] = Body(default_factory=dict)) -> StreamingResponse:
    request_id = f"manor-{secrets.token_hex(6)}"
    domain = str(body.get("domain") or "unknown")

    def events():
        yield f"event: open\ndata: {json.dumps({'request_id': request_id, 'domain': domain, 'sourceLabel': 'FALLBACK'}, ensure_ascii=False)}\n\n"
        yield (
            "event: fallback\n"
            f"data: {json.dumps({'reason': 'live_manor_stream_not_wired', 'message': '后端兼容流已接通，但未执行实时庄园分析。', 'sourceLabel': 'FALLBACK'}, ensure_ascii=False)}\n\n"
        )
        yield f"event: eof\ndata: {json.dumps({'frames': 2, 'sourceLabel': 'FALLBACK'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
