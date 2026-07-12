"""Read-only true-chain readiness derived from persisted runtime evidence."""

from __future__ import annotations

from typing import Any


_REAL_SOURCE_LABELS = ("LIVE_ENGINE", "LIVE_SWARM")


def evaluate_true_chain_health(db) -> dict[str, Any]:
    from src.db.models import SwarmRun, SwarmTaskRun

    recent_real_task = (
        db.query(SwarmTaskRun)
        .filter(
            SwarmTaskRun.status == "completed",
            SwarmTaskRun.source_label.in_(_REAL_SOURCE_LABELS),
        )
        .order_by(SwarmTaskRun.finished_at.desc())
        .first()
    )
    run = None
    if recent_real_task is not None:
        run = db.query(SwarmRun).filter_by(id=recent_real_task.swarm_run_id).first()

    swarm_ready = bool(
        run is not None
        and run.finished_at
        and run.status in {"completed", "quality_blocked"}
    )
    source_label = recent_real_task.source_label if swarm_ready else "FALLBACK"
    checks = [
        {
            "key": "backend",
            "label": "Backend API",
            "state": "ready",
            "requiredForLive": True,
            "detail": "健康探针由当前后端进程实时生成。",
        },
        {
            "key": "database",
            "label": "Runtime database",
            "state": "ready",
            "requiredForLive": True,
            "detail": "运行证据数据库查询成功。",
        },
        {
            "key": "swarm_run",
            "label": "Real swarm execution",
            "state": "ready" if swarm_ready else "missing",
            "requiredForLive": True,
            "detail": (
                f"最近真实执行证据：{run.id} ({source_label})。"
                if swarm_ready
                else "尚无已完成的 LIVE_ENGINE/LIVE_SWARM 运行证据。"
            ),
        },
    ]
    return {
        "status": "ready" if swarm_ready else "degraded",
        "sourceLabel": source_label,
        "checks": checks,
        "liveReady": {
            "backend": True,
            "swarmRun": swarm_ready,
            "requiredDependencies": swarm_ready,
        },
        "summary": "真实执行链已留痕。" if swarm_ready else "等待真实蜂群执行证据。",
        "recommendation": None if swarm_ready else "完成至少一次真实部门执行后重新检查。",
    }
