"""web/routers/scribe.py — 史官教训库:从真实复盘聚合旧案 lessons。

2026-07-10 接线:此前 /api/scribe/lessons 无任何后端路由,前端 UnifiedMemoryPanel
永远读空(见 docs/shiguan-jinyiwei-wiring-plan-2026-07-09.md P4 复审)。这里不新建
存储 —— 已批准奏折 + 其 chaotang_store.save_retrospective 记的 lessons 就是
"旧案教训"本身,直接聚合返回,不编造 patterns/tags(后端没有对应数据源,诚实留空)。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src import chaotang_store
from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/scribe", tags=["scribe"])


@router.get("/lessons")
def scribe_lessons(_: CurrentUser = Depends(get_current_user)) -> dict:
    """聚合已批准奏折的真实复盘 lessons。跳过 synthetic(系统合成兜底)和空 lessons。"""
    from web.routers.throne import _build_memorial_list

    memorials = [
        m
        for m in _build_memorial_list()
        if m.get("status") in ("approved", "archived", "done")
    ]

    entries = []
    for m in memorials:
        task_id = m.get("id")
        if not task_id:
            continue
        rec = chaotang_store.get_retrospective(task_id)
        if not rec or rec.get("synthetic") or not rec.get("lessons"):
            continue
        entries.append(
            {
                "billId": task_id,
                "billTitle": m.get("title", ""),
                "extractedAt": rec.get("authoredAt", ""),
                "lessons": [
                    {"id": f"{task_id}-{i}", "text": text, "severity": "note"}
                    for i, text in enumerate(rec["lessons"])
                ],
                # patterns/tags 后端无对应数据源,诚实留空,不编造
                "patterns": [],
                "tags": [],
                "summary": rec.get("playbook") or "",
            }
        )

    entries.sort(key=lambda e: e["extractedAt"], reverse=True)
    return ok({"lessons": entries})


def _light_and_gate(status: str) -> tuple[str, str]:
    if status in ("approved", "archived", "done"):
        return "green", "passed"
    if status in ("rejected", "failed"):
        return "red", "blocked"
    return "yellow", "pending"


@router.get("/archive-docs")
def scribe_archive_docs(_: CurrentUser = Depends(get_current_user)) -> dict:
    """史馆卷宗卡(CourtDoc)真实数据源。前端 court-doc.ts 的 MOCK_COURT_DOCS 手填样例
    对应的真实端点 —— 复用 scribe_lessons() 同款"已批准奏折 + 真实复盘"聚合,只是
    重塑成 CourtDoc 契约。诚实映射,不编造：没有真实证据链就填 evidenceRef=null
    (触发前端既有"待考"渲染分支),没有真实 grounding 就填 'none',advisors 留空
    (archive-card.tsx 从不渲染这个字段，真填了也没意义)。"""
    from web.routers.throne import _build_memorial_list

    memorials = [
        m
        for m in _build_memorial_list()
        if m.get("status") in ("approved", "archived", "done", "rejected", "failed")
    ]

    docs = []
    for m in memorials:
        task_id = m.get("id")
        if not task_id:
            continue
        rec = chaotang_store.get_retrospective(task_id)
        if not rec or rec.get("synthetic") or not rec.get("lessons"):
            continue
        status = str(m.get("status") or "")
        light, gate = _light_and_gate(status)
        signed = status in ("approved", "archived", "done")
        docs.append(
            {
                "caseId": task_id,
                "light": light,
                "headline": m.get("title", ""),
                "shielded": None,
                "items": [
                    {
                        "level": "yellow",
                        "title": text,
                        "odds": None,
                        "impact": None,
                        "fix": None,
                        "evidenceRef": None,
                    }
                    for text in rec["lessons"]
                ],
                "actions": ["open_annals", "trace_evidence", "export_amulet"],
                "provenance": {"advisors": [], "grounding": "none", "gate": gate},
                "sourceLabel": "LIVE",
                "signed": signed,
                "sealedArchive": task_id if status == "archived" else None,
            }
        )

    docs.sort(key=lambda d: d["caseId"], reverse=True)
    return ok({"docs": docs})
