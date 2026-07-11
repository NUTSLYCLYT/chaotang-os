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


@router.get("/overview")
def hanlin_overview() -> dict:
    return {
        "overview": {
            "summary": _EMPTY_SUMMARY,
            "topContribution": None,
            "topCandidate": None,
            "topModule": None,
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
def hanlin_experiments() -> dict:
    return {"experiments": []}


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
