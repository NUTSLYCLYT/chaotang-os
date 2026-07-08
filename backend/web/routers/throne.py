"""朝堂 OS 前端聚合端点 —

  GET  /api/throne/overview                        — 11 群臣 + 今日奏折 + 风险 + 经营摘要
  GET  /api/throne/memorials                       — 奏折列表（Memorial 形态）
  GET  /api/throne/runs/{run_id}                   — 单条奏折详情
  POST /api/throne/runs/{run_id}/transfer          — 转交给另一部门
  POST /api/throne/runs/{run_id}/digest            — 派生会议纪要并落档

⚠️ Memorial 内部用 60s 内存缓存（_CT_MEMORIAL_CACHE），与旧 Flask 行为一致。
"""

from __future__ import annotations

import json
import os
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from src.chaotang_api import (
    MINISTER_DEFS,
    aggregate_ministers,
    aggregate_risks,
    enrich_memorial,
    filter_runs_query,
)
from src import chaotang_store
from src.step_log import list_runs, load_run

from web.deps import get_current_user, validate_run_id
from web.run_utils import run_summary, signoff_annotation
from web.schemas.auth import CurrentUser
from web.schemas.throne import (
    DigestResponse,
    MemorialsListResponse,
    OverviewResponse,
    TransferRequest,
    TransferResponse,
)

router = APIRouter(prefix="/api/throne", tags=["throne"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# 60s 内存缓存 — Memorial 列表的构建很贵（每个 run 都要 load_run + enrich）
_CT_MEMORIAL_CACHE: dict[str, Any] = {"data": [], "expires_at": 0.0}


def _build_memorial_list() -> list[dict[str, Any]]:
    """加载所有 run 并翻译为 Memorial 列表。"""
    now = time.time()
    if _CT_MEMORIAL_CACHE.get("expires_at", 0) > now:
        return _CT_MEMORIAL_CACHE["data"]

    items: list[dict[str, Any]] = []
    for run_id in list_runs():
        try:
            run_log = load_run(run_id)
            if run_log is None:
                continue
            summary = run_summary(run_log)
            summary["final_output"] = run_log.final_output
            mem = enrich_memorial(summary)
            # 批阅后持久状态覆盖 run 派生状态(approve→archived, reject→rejected)
            persisted = chaotang_store.get_memorial_status(run_id)
            if persisted:
                mem = {**mem, "status": persisted}
            items.append(mem)
        except Exception:
            continue
    items.sort(key=lambda m: m.get("createdAt") or "", reverse=True)

    _CT_MEMORIAL_CACHE["data"] = items
    _CT_MEMORIAL_CACHE["expires_at"] = now + 60
    return items


# ── 静态路由优先 ────────────────────────────────────────


@router.get("/overview", response_model=OverviewResponse)
def api_throne_overview(
    _: CurrentUser = Depends(get_current_user),
) -> OverviewResponse:
    """朝堂大殿首屏聚合数据。"""
    try:
        memorials = _build_memorial_list()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    today_memorials = memorials[:5]

    from web.task_registry import task_snapshot

    _running_depts = [
        dept
        for t in task_snapshot().values()
        if t.get("status") == "running"
        for dept in (t.get("departments") or [])
    ]
    ministers = aggregate_ministers(memorials, _running_depts)
    risks = aggregate_risks(memorials, limit=5)

    try:
        from src.tool_router import list_drafts

        drafts = list_drafts() or []
        pending_approvals = sum(1 for d in drafts if d.get("status") == "pending")
    except Exception:
        pending_approvals = 0

    scored = [
        m.get("qualityScore") for m in memorials if m.get("qualityScore") is not None
    ]
    avg_quality = round(sum(scored) / len(scored), 2) if scored else 0.0
    approved = sum(1 for m in memorials if m.get("status") == "approved")
    pass_rate = round(approved / len(memorials), 3) if memorials else 0.0

    sys_status_overall = "ok"
    litellm_status = "up"
    try:
        litellm_base = os.getenv("LITELLM_BASE", "http://127.0.0.1:4000")
        litellm_key = os.getenv("LITELLM_API_KEY", "")
        req = urllib.request.Request(
            f"{litellm_base}/v1/models",
            headers={"Authorization": f"Bearer {litellm_key}"},
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        litellm_status = "down"
        sys_status_overall = "degraded"

    return OverviewResponse(
        ministers=ministers,
        memorialsToday=today_memorials,
        risks=risks,
        metrics={
            "revenue": None,
            "cashflow": None,
            "activeProjects": sum(1 for m in memorials if m.get("status") == "running"),
            "pendingApprovals": pending_approvals,
            "riskCount": len(risks),
            "opportunityCount": sum(
                1 for m in memorials if m.get("priority") == "high"
            ),
            "avgQualityScore": avg_quality,
            "passRate": pass_rate,
            "asOf": datetime.now().isoformat(timespec="seconds"),
        },
        systemStatus={
            "overall": sys_status_overall,
            "litellm": litellm_status,
            "knowledge": "ok",
        },
        generatedAt=datetime.now().isoformat(timespec="seconds"),
    )


@router.get("/memorials", response_model=MemorialsListResponse)
def api_throne_memorials(
    request: Request,
    _: CurrentUser = Depends(get_current_user),
) -> MemorialsListResponse:
    """奏折列表 — 支持 status/dept/priority/q/limit/offset 过滤。"""
    try:
        memorials = _build_memorial_list()
        params = dict(request.query_params)
        total, items = filter_runs_query(memorials, params)
        return MemorialsListResponse(total=total, items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ── 动态路由（{run_id} 必须在 /overview /memorials 之后）


@router.get("/runs/{run_id}")
def api_throne_run_detail(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    summary = run_summary(run_log)
    summary["final_output"] = run_log.final_output
    memorial = enrich_memorial(summary)

    steps = []
    for s in run_log.steps:
        qs = s.quality_score if s.quality_score else None
        steps.append(
            {
                "stepIndex": s.step_index,
                "agentName": s.agent_name,
                "status": s.status,
                "output": (s.output or "")[:1500],
                "durationSeconds": s.duration_seconds or 0.0,
                "qualityScore": qs.get("total_score") if qs else None,
            }
        )

    qa_payload = None
    if run_log.qa_result:
        qs = run_log.qa_result.get("quality_score") or {}
        qa_payload = {
            "passFail": run_log.qa_result.get("qa_result"),
            "totalScore": qs.get("total_score"),
            "scores": qs.get("scores") or {},
            "issues": run_log.qa_result.get("issues") or [],
        }

    return {
        **memorial,
        "fullContent": run_log.final_output or {},
        "steps": steps,
        "qaResult": qa_payload,
        # 皇帝单屏读全文 → 必须看得到不可逆决策是否签字(非阻断标注)。
        "signoff": signoff_annotation(run_log),
    }


@router.post(
    "/runs/{run_id}/transfer",
    response_model=TransferResponse,
    status_code=201,
)
def api_throne_transfer(
    body: TransferRequest,
    request: Request,
    run_id: str = Depends(validate_run_id),
    user: CurrentUser = Depends(get_current_user),
) -> TransferResponse:
    """把奏折转交给另一部门。"""
    valid_depts = {m["department"] for m in MINISTER_DEFS}
    target = body.target_department.strip()
    if target not in valid_depts:
        raise HTTPException(
            status_code=400,
            detail="target_department 必须是 11 部门之一",
        )

    run_log = load_run(run_id)
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    transfer_dir = _PROJECT_ROOT / "data" / "default" / "transfers"
    transfer_dir.mkdir(parents=True, exist_ok=True)
    transfer_id = f"transfer_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
    operator = user.username or "anonymous"
    record = {
        "transfer_id": transfer_id,
        "source_run_id": run_id,
        "source_flow": run_log.flow_name or "",
        "target_department": target,
        "reason": body.reason.strip() or "陛下指示转交",
        "operator": operator,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "task_input_excerpt": (run_log.task_input or "")[:200],
    }
    (transfer_dir / f"{transfer_id}.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 清缓存让前端立即看到新转交
    _CT_MEMORIAL_CACHE["expires_at"] = 0.0

    return TransferResponse(status="transferred", **record)


@router.post(
    "/runs/{run_id}/digest",
    response_model=DigestResponse,
)
def api_throne_digest(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> DigestResponse:
    """从 final_output 派生会议纪要并落档到 case archive。"""
    run_log = load_run(run_id)
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    fo = run_log.final_output or {}
    first_line = (run_log.task_input or "").strip().splitlines()[0:1]
    title = first_line[0][:80] if first_line else "未命名"
    parts = [
        f"# 奏折纪要：{title}",
        f"\n_本纪要由 run {run_id} 派生于 "
        f"{datetime.now().isoformat(timespec='seconds')}_\n",
    ]

    for k, v in fo.items():
        text = str(v or "").strip()
        if not text:
            continue
        parts.append(f"## {k}\n\n{text}\n")

    if run_log.qa_result:
        qa = run_log.qa_result
        qs = qa.get("quality_score") or {}
        parts.append(f"\n## 质量评分\n\n- 总分：{qs.get('total_score', '—')}/5")
        parts.append(f"- pass/fail：{qa.get('qa_result', '—')}\n")

    digest_text = "\n".join(parts)

    archive_id: str | None = None
    try:
        from src import case_archive

        archive_payload = {
            "case_id": f"digest_{run_id}",
            "source_run_id": run_id,
            "title": title,
            "summary": digest_text[:500],
            "content": digest_text,
            "tags": ["纪要", "自动派生"],
            "created_at": datetime.now().isoformat(timespec="seconds"),
        }
        if hasattr(case_archive, "save_pending"):
            archive_id = case_archive.save_pending(archive_payload)
        else:
            pending_dir = (
                _PROJECT_ROOT / "data" / "default" / "case_archive" / "pending"
            )
            pending_dir.mkdir(parents=True, exist_ok=True)
            archive_id = archive_payload["case_id"]
            (pending_dir / f"{archive_id}.json").write_text(
                json.dumps(archive_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
    except Exception:
        archive_id = None

    return DigestResponse(
        run_id=run_id,
        digest=digest_text,
        archive_id=archive_id,
        status="generated",
    )
