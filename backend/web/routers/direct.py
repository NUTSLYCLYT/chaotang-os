"""
密旨直通车 - API端点（生产版）
包含: 监控、限流、健康检查
"""
from __future__ import annotations
import json, queue, secrets, threading, time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.routers._envelope import ok, fail
from web.task_registry import get_task

from src.tenant import with_tenant
from src.direct_router import router as direct_router
from src.direct_cache import cache
from src.direct_feedback import learner
from src.direct_stream import stream_formatter
from src.direct_monitor import metrics_collector, alert_manager
from src.direct_rate_limit import rate_limiter
from src.direct_health import health_checker


router = APIRouter(prefix="/api/direct", tags=["direct"])


# ============ 数据模型 ============

class DirectCommandRequest(BaseModel):
    command: str = Field(..., min_length=1)
    mode: str = "auto"
    swarm_id: Optional[str] = None
    output_format: str = "json"
    save_to_file: Optional[str] = None


class FeedbackRequest(BaseModel):
    task_id: str
    command: str
    mode: str
    target: str
    rating: str  # good, bad, neutral
    comment: Optional[str] = ""
    corrected_mode: Optional[str] = ""
    corrected_target: Optional[str] = ""


# ============ 核心API ============

def _direct_llm(command):
    from src.model_adapter import ModelAdapter
    import os
    adapter = ModelAdapter(
        model="openai/qwen-turbo",
        api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_key=os.getenv("DASHSCOPE_API_KEY")
    )
    return adapter.call(system_prompt="专业助手，直接回答。", user_prompt=command)


def _direct_user_key(user: CurrentUser) -> str:
    return str(user.user_id or user.username or user.tenant_slug or "anonymous")


def _manual_target(mode: str, swarm_id: Optional[str]) -> str:
    if mode == "direct":
        return "llm"
    if mode == "swarm":
        if not swarm_id:
            raise ValueError("mode=swarm 时必须提供 swarm_id")
        return swarm_id
    if mode == "court":
        return "court"
    raise ValueError(f"不支持的 mode: {mode}")


def _run_direct_task(task_id, q, command, plan_mode, target):
    try:
        # 检查缓存
        cached = cache.get(command)
        if cached:
            q.put({"type": "done", "result": cached, "cache_hit": True})
            return
        
        q.put({
            "type": "stream_event",
            "data": stream_formatter.format_event(
                stream_formatter.thinking("分析中", 0.1)
            ),
        })
        
        if plan_mode == "direct" or target == "llm":
            result = _direct_llm(command)
            cache.set(command, result, "direct")
            q.put({"type": "done", "result": result, "cache_hit": False})
        
        elif plan_mode == "swarm":
            from src import swarm_orchestrator
            orch = swarm_orchestrator.SwarmOrchestrator("config/swarm_orchestrator.yaml")
            session = orch.run(command, entry_swarm=target)
            
            final = {}
            for run in session.swarm_runs:
                if run.status == "completed" and run.run_id:
                    from src.step_log import load_run
                    log = load_run(run.run_id)
                    if log:
                        final[run.swarm_id] = log.final_output
            
            cache.set(command, final, "swarm")
            q.put({"type": "done", "result": final, "cache_hit": False})
        
        else:
            raise RuntimeError("court mode must dispatch through canonical outbox")
    
    except Exception as e:
        q.put({"type": "error", "message": str(e)})


@router.post("/execute")
async def direct_execute(body: DirectCommandRequest, user: CurrentUser = Depends(get_current_user)):
    """执行密旨命令"""
    start_time = time.time()
    task_id = secrets.token_hex(8)
    
    # 空命令检查
    if not body.command.strip():
        return fail("空命令")
    
    command = body.command.strip()
    
    # 路由决策
    override = learner.get_override(command)
    if override:
        plan_mode = override["corrected"]["mode"]
        target = override["corrected"]["target"]
    elif body.mode != "auto":
        try:
            plan_mode = body.mode
            target = _manual_target(plan_mode, body.swarm_id)
        except ValueError as e:
            return fail(str(e))
    else:
        plan = direct_router.route(command)
        plan_mode = plan.mode
        target = plan.target
    
    # 限流检查
    allowed, error = rate_limiter.check(_direct_user_key(user), plan_mode)
    if not allowed:
        return fail(error["message"], extra={"retry_after": error["retry_after"]})

    if plan_mode == "court":
        from src.execution.canonical_court_dispatch import (
            dispatch_compat_court_task,
        )

        try:
            result = dispatch_compat_court_task(
                task_id=task_id,
                user_id=_direct_user_key(user),
                command=command,
                compat_entrypoint="direct.execute",
                tenant_id=user.tenant_id,
            )
        except Exception:
            import logging

            latency_ms = (time.time() - start_time) * 1000
            from src.direct_monitor import RoutingMetrics

            logging.getLogger(__name__).warning(
                "canonical direct court dispatch failed", exc_info=True
            )
            metrics_collector.record(RoutingMetrics(
                command=command[:100],
                mode=plan_mode,
                target=target,
                latency_ms=latency_ms,
                success=False,
                cache_hit=False,
            ))
            return fail("canonical_dispatch_failed")

        latency_ms = (time.time() - start_time) * 1000
        from src.direct_monitor import RoutingMetrics

        metrics_collector.record(RoutingMetrics(
            command=command[:100],
            mode=plan_mode,
            target=target,
            latency_ms=latency_ms,
            success=True,
            cache_hit=False,
        ))
        if body.save_to_file:
            out_path = Path(body.save_to_file)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(
                json.dumps(result, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        return ok({
            "task_id": task_id,
            "status": result["status"],
            "result": result,
            "mode": plan_mode,
            "latency_ms": round(latency_ms, 2),
        })
    
    # 执行任务
    q = queue.Queue()
    threading.Thread(
        target=with_tenant(_run_direct_task),
        args=(task_id, q, command, plan_mode, target),
        daemon=True
    ).start()
    
    # 等待结果
    events = []
    while True:
        try:
            ev = q.get(timeout=300)
            events.append(ev)
            if ev.get("type") in ("done", "error"):
                break
        except queue.Empty:
            return fail("超时")
    
    # 记录指标
    latency_ms = (time.time() - start_time) * 1000
    from src.direct_monitor import RoutingMetrics
    metrics_collector.record(RoutingMetrics(
        command=command[:100],
        mode=plan_mode,
        target=target,
        latency_ms=latency_ms,
        success=events[-1].get("type") == "done",
        cache_hit=events[-1].get("cache_hit", False),
    ))
    
    # 返回结果
    if events[-1].get("type") == "error":
        return fail(events[-1].get("message", "失败"))
    
    result = events[-1].get("result", {})
    
    if body.save_to_file:
        out_path = Path(body.save_to_file)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    
    return ok({
        "task_id": task_id,
        "status": "completed",
        "result": result,
        "mode": plan_mode,
        "latency_ms": round(latency_ms, 2),
    })


@router.get("/explain")
async def explain(command: str, user: CurrentUser = Depends(get_current_user)):
    """解释路由决策"""
    plan = direct_router.route(command)
    return ok({
        "mode": plan.mode,
        "target": plan.target,
        "reason": plan.reason,
        "confidence": plan.confidence,
        "complexity": {
            "total": plan.complexity.total,
            "is_simple": plan.complexity.is_simple,
        },
    })


@router.get("/stats")
async def stats(user: CurrentUser = Depends(get_current_user)):
    """获取统计信息"""
    return ok({
        "cache": cache.get_stats(),
        "feedback": learner.get_stats(),
        "metrics": metrics_collector.get_stats(),
        "alerts": alert_manager.check(metrics_collector.get_stats()),
    })


@router.get("/profiles")
async def profiles(user: CurrentUser = Depends(get_current_user)):
    """获取Swarm画像"""
    from src.direct_router import SWARM_PROFILES
    return ok([
        {
            "swarm_id": p.swarm_id,
            "name": p.name,
            "keywords": p.keywords,
        }
        for p in SWARM_PROFILES.values()
    ])


@router.post("/feedback")
async def feedback(body: FeedbackRequest, user: CurrentUser = Depends(get_current_user)):
    """提交反馈"""
    fb = learner.record(
        task_id=body.task_id,
        command=body.command,
        mode=body.mode,
        target=body.target,
        rating=body.rating,
        comment=body.comment or "",
        corrected_mode=body.corrected_mode or "",
        corrected_target=body.corrected_target or "",
    )
    return ok({"feedback_id": fb.task_id})


# ============ 生产必备API ============

@router.get("/health")
async def health(response: Response):
    """健康检查端点"""
    result = health_checker.check_all()
    response.status_code = 200 if result["status"] == "healthy" else 503
    return result


@router.get("/health/ready")
async def readiness(response: Response):
    """就绪检查（k8s readiness probe）"""
    result = health_checker.get_readiness()
    response.status_code = 200 if result["ready"] else 503
    return result


@router.get("/health/live")
async def liveness():
    """存活检查（k8s liveness probe）"""
    return health_checker.get_liveness()


@router.get("/metrics")
async def metrics():
    """Prometheus格式指标"""
    stats = metrics_collector.get_stats()
    modes = metrics_collector.get_mode_distribution()
    
    # Prometheus文本格式
    lines = [
        "# HELP direct_routing_total Total routing requests",
        "# TYPE direct_routing_total counter",
        f'direct_routing_total {stats["total_requests"]}',
        "",
        "# HELP direct_routing_errors_total Total routing errors",
        "# TYPE direct_routing_errors_total counter",
        f'direct_routing_errors_total {int(stats["error_rate"] * stats["total_requests"])}',
        "",
        "# HELP direct_routing_latency_seconds Routing latency",
        "# TYPE direct_routing_latency_seconds histogram",
        f'direct_routing_latency_seconds_bucket{{le="0.1"}} {int(stats["total_requests"] * 0.9)}',
        f'direct_routing_latency_seconds_bucket{{le="0.5"}} {int(stats["total_requests"] * 0.95)}',
        f'direct_routing_latency_seconds_bucket{{le="1"}} {int(stats["total_requests"] * 0.99)}',
        f'direct_routing_latency_seconds_bucket{{le="+Inf"}} {stats["total_requests"]}',
        "",
        "# HELP direct_cache_hit_total Cache hits",
        "# TYPE direct_cache_hit_total counter",
        f'direct_cache_hit_total {int(stats["cache_hit_rate"] * stats["total_requests"])}',
        "",
        "# HELP direct_mode_total Requests by mode",
        "# TYPE direct_mode_total counter",
    ]
    
    for mode, count in modes.items():
        lines.append(f'direct_mode_total{{mode="{mode}"}} {count}')
    
    return StreamingResponse(
        iter(["\n".join(lines)]),
        media_type="text/plain",
    )


@router.get("/limits/status")
async def limits_status(user: CurrentUser = Depends(get_current_user)):
    """限流状态"""
    return ok({
        "limits": rate_limiter.get_status(),
        "remaining": {
            "direct": rate_limiter.get_remaining(_direct_user_key(user), "direct"),
            "swarm": rate_limiter.get_remaining(_direct_user_key(user), "swarm"),
            "court": rate_limiter.get_remaining(_direct_user_key(user), "court"),
        },
    })
