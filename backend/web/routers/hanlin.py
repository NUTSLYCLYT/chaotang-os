"""翰林院(2026-07-11 补齐)。

frontend/src/features/hanlin/* 整套 hooks 调用 /api/hanlin/* ——这些路由
在后端从未实现过。经审计确认 src/app 下没有任何真实页面渲染翰林院组件
(孤立、用户点不到),这里按项目"FALLBACK 诚实兜底"惯例给出结构正确、
诚实标注为空的响应，不替这个尚未有产品需求的功能编造奖项/孵化/出海数据。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body

router = APIRouter(prefix="/api/hanlin", tags=["hanlin"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


_EMPTY_SUMMARY: dict[str, Any] = {
    "currentAwardCycle": "未开启",
    "submittedContributions": 0,
    "rankedContributions": 0,
    "activeCandidates": 0,
    "incubatingModules": 0,
    "exportableModules": 0,
    "adoptedContributions": 0,
    "queuedAwards": 0,
    "paidAwards": 0,
    "awardedAmount": 0,
    "rewardPoolRemaining": 0,
    "topContributionId": None,
    "topCandidateId": None,
}


def _truth_ledger_health() -> dict | None:
    """P9 最小真源:翰林院读 truth_ledger 健康度(评测账本=翰林离线 eval 的现有事实源)。
    账本缺失/为空返回 None,调用方保持诚实 FALLBACK。"""
    try:
        from src.truth_ledger import health

        h = health()
        return h if h.get("total_entries") else None
    except Exception:
        return None


@router.get("/overview")
def hanlin_overview() -> dict:
    ledger = _truth_ledger_health()
    return {
        "overview": {
            "summary": _EMPTY_SUMMARY,
            "topContribution": None,
            "topCandidate": None,
            "topModule": None,
            # P9(2026-07-14):第一条真源数据线。奖项/孵化等仍无产品数据,保持空。
            "truthLedger": ledger,
            "sourceLabel": "TRUTH_LEDGER" if ledger else "FALLBACK",
        }
    }


@router.get("/summary")
def hanlin_summary() -> dict:
    return {"summary": _EMPTY_SUMMARY}


@router.get("/contributions")
def hanlin_contributions() -> dict:
    return {"contributions": [], "source": "FALLBACK"}


@router.get("/reviews")
def hanlin_reviews() -> dict:
    return {"reviews": []}


@router.get("/recommendations")
def hanlin_recommendations() -> dict:
    return {"recommendations": []}


@router.get("/experiments")
def hanlin_experiments(limit: int = 50) -> dict:
    """P9:实验列表接真源——truth_ledger 每条确定性判定就是一次翰林离线实验。
    账本为空时维持原诚实空响应。"""
    try:
        from src.truth_ledger import _load

        rows = [r for r in _load() if r.get("deterministic")]
    except Exception:
        # 账本损坏(半行写入/磁盘满)也走诚实 FALLBACK,不 500
        return {"experiments": [], "source": "FALLBACK"}
    if not rows:
        return {"experiments": [], "source": "FALLBACK"}
    rows.sort(key=lambda r: r.get("ts") or "", reverse=True)
    experiments = [
        {
            "id": r.get("hash", "")[:12],
            "name": f"{r.get('swarm', '?')}/{r.get('checker', '?')}",
            "caseId": r.get("case_id", ""),
            "verdict": str(r.get("verdict", "")).upper(),
            "provenance": r.get("provenance", "unknown"),
            "createdAt": r.get("ts", ""),
        }
        for r in rows[: max(1, min(limit, 200))]
    ]
    return {"experiments": experiments, "source": "TRUTH_LEDGER"}


@router.get("/awards")
def hanlin_awards() -> dict:
    return {"awards": [], "currentRewardPeriod": None}


@router.get("/scouting")
def hanlin_scouting() -> dict:
    return {"projects": [], "candidates": []}


@router.get("/incubation")
def hanlin_incubation() -> dict:
    return {"modules": []}


@router.get("/export-offerings")
def hanlin_export_offerings() -> dict:
    return {"offerings": []}


@router.get("/reset-demo")
@router.post("/reset-demo")
def hanlin_reset_demo() -> dict:
    return {"ok": True, "message": "翰林院当前无演示数据可重置。", "sourceLabel": "FALLBACK"}


@router.get("/scouting/{candidate_id}")
def hanlin_scouting_detail(candidate_id: str):
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="candidate_not_found")


@router.post("/scouting/{candidate_id}")
def hanlin_scouting_update(candidate_id: str, body: dict[str, Any] = Body(default_factory=dict)):
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="candidate_not_found")
