"""聚合分析端点 — /api/analytics。

行为与旧 Flask 完全一致：按 days/flow 过滤、日级分组、维度均值、Top issues。
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query

from src.step_log import list_runs, load_run

from web.deps import get_current_user
from web.run_utils import run_summary
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics")
def api_analytics(
    days: int = Query(7, ge=1, le=365),
    flow: str | None = Query(default=None),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    cutoff = datetime.now() - timedelta(days=days)

    filtered: list[tuple[dict[str, Any], datetime]] = []
    for run_id in list_runs():
        try:
            run_log = load_run(run_id)
            if run_log is None:
                continue
            r = run_summary(run_log)
        except Exception:
            continue
        ts = r.get("created_at") or ""
        try:
            run_dt = datetime.fromisoformat(ts).replace(tzinfo=None)
        except Exception:
            run_dt = datetime.now()
        if run_dt < cutoff:
            continue
        if flow and r.get("flow_name") != flow:
            continue
        filtered.append((r, run_dt))

    # 日级分组
    daily: dict[str, dict[str, Any]] = {}
    for r, dt in filtered:
        day = dt.strftime("%m/%d")
        slot = daily.setdefault(
            day,
            {"date": day, "count": 0, "pass_count": 0, "scores": []},
        )
        slot["count"] += 1
        if r.get("run_status") == "pass":
            slot["pass_count"] += 1
        score = r.get("total_score")
        if score is not None:
            slot["scores"].append(float(score))

    # 补零到完整 N 天
    daily_runs = []
    for i in range(days - 1, -1, -1):
        d = (datetime.now() - timedelta(days=i)).strftime("%m/%d")
        entry = daily.get(d, {"date": d, "count": 0, "pass_count": 0, "scores": []})
        scores = entry.get("scores", []) or []
        daily_runs.append({
            "date": d,
            "count": entry["count"],
            "pass_count": entry["pass_count"],
            "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
        })

    grade_dist: dict[str, int] = {}
    dim_sums: dict[str, list[float]] = {}
    flow_stats: dict[str, dict[str, Any]] = {}
    issue_counts: dict[str, int] = {}
    total_tokens = 0
    token_by_flow: dict[str, int] = {}
    total_pass = 0
    scores_all: list[float] = []

    for r, _dt in filtered:
        grade = r.get("grade")
        if grade:
            grade_dist[grade] = grade_dist.get(grade, 0) + 1

        score = r.get("total_score")
        if score is not None:
            scores_all.append(float(score))

        if r.get("run_status") == "pass":
            total_pass += 1

        fname = r.get("flow_name", "unknown") or "unknown"
        fs = flow_stats.setdefault(fname, {"runs": 0, "pass": 0, "scores": []})
        fs["runs"] += 1
        if r.get("run_status") == "pass":
            fs["pass"] += 1
        if score is not None:
            fs["scores"].append(float(score))

        qa = r.get("qa_result") or {}
        if isinstance(qa, dict):
            dim_scores = qa.get("scores") or {}
            if isinstance(dim_scores, dict):
                for dim, val in dim_scores.items():
                    try:
                        dim_sums.setdefault(dim, []).append(float(val))
                    except Exception:
                        pass
            issues = qa.get("issues") or []
            if isinstance(issues, list):
                for issue in issues:
                    dim = None
                    if isinstance(issue, dict):
                        dim = issue.get("dimension")
                    elif isinstance(issue, str):
                        dim = issue
                    if dim:
                        issue_counts[dim] = issue_counts.get(dim, 0) + 1

        run_tokens = r.get("total_tokens") or 0
        total_tokens += int(run_tokens)
        token_by_flow[fname] = token_by_flow.get(fname, 0) + int(run_tokens)

    n = len(filtered)
    avg_score = round(sum(scores_all) / len(scores_all), 2) if scores_all else None
    pass_rate = round(total_pass / n * 100, 1) if n > 0 else 0.0

    dimension_avg = {
        dim: round(sum(vals) / len(vals), 2)
        for dim, vals in dim_sums.items() if vals
    }

    flow_stats_out = {}
    for fname, fs in flow_stats.items():
        sc = fs["scores"]
        flow_stats_out[fname] = {
            "runs": fs["runs"],
            "pass_rate": round(fs["pass"] / fs["runs"] * 100, 1) if fs["runs"] else 0,
            "avg_score": round(sum(sc) / len(sc), 2) if sc else None,
        }

    top_issues = sorted(
        ({"dimension": d, "count": c} for d, c in issue_counts.items()),
        key=lambda x: x["count"],
        reverse=True,
    )[:8]

    return {
        "summary": {
            "total_runs": n,
            "pass_rate": pass_rate,
            "avg_score": avg_score,
            "avg_tokens_per_run": round(total_tokens / n) if n else 0,
        },
        "daily_runs": daily_runs,
        "grade_distribution": grade_dist,
        "dimension_avg": dimension_avg,
        "token_stats": {
            "total": total_tokens,
            "avg_per_run": round(total_tokens / n) if n else 0,
            "by_flow": token_by_flow,
        },
        "flow_stats": flow_stats_out,
        "top_issues": top_issues,
    }
