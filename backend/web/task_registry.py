"""异步任务 + 人工审批 + OpenClaw 交互的共享状态。

所有 router 共用同一份全局状态：
- _task_registry: task_id → {queue, status, run_id, error, monitor 字段...}
- _approval_*: 人工审批门控
- _openclaw_events / _openclaw_inputs: OpenClaw 交互模式（阻塞等用户）
- _openclaw_auto_queues: OpenClaw 自动循环模式（不阻塞，由用户主动 inject）

⚠️ 保留 threading + queue.Queue 设计而不重构为 asyncio：
   FlowEngine / repair_cycle 是同步代码，callback 必须在线程里 .wait() / .get()，
   切到 asyncio.Event 反而需要跨线程信号，复杂度更高。FastAPI StreamingResponse
   接受同步 generator，会自动 wrap 在 threadpool 中执行。
"""

from __future__ import annotations

import queue
import threading
from datetime import datetime
from typing import Any

# ── 任务注册表 ──────────────────────────────────────────

_task_registry: dict[str, dict[str, Any]] = {}
_task_registry_lock = threading.Lock()


def register_task(
    task_id: str,
    *,
    task_input: str = "",
    config: str | None = None,
    monitor: bool = False,
    departments: "list[str] | None" = None,
    decision_task_id: str | None = None,
) -> queue.Queue:
    """创建短生命周期 execution run 记录，返回其事件 queue。

    monitor=True 时附加 /api/tasks 监控字段（仅 /api/runs/async 启用）。
    departments: 与本任务关联的部门 slug 列表(P1-10),供 dept/overview activeTasks 过滤用。
    decision_task_id: 对应的正式 DecisionTask；仅业务兼容适配入口需要。
    """
    q: queue.Queue = queue.Queue()
    base: dict[str, Any] = {
        "queue": q,
        "status": "running",
        "run_id": None,
        "error": None,
        "departments": list(departments) if departments else [],
        "fact_kind": "execution_run",
        "decision_task_id": decision_task_id,
    }
    if monitor:
        base.update(
            {
                "task_input": task_input[:120],
                "config": config,
                "started_at": datetime.now().isoformat(timespec="seconds"),
                "finished_at": None,
                "flow_name": None,
                "total_steps": None,
                "step_names": [],
                "current_step": None,
                "current_step_name": None,
                "completed_steps": 0,
            }
        )
    with _task_registry_lock:
        _task_registry[task_id] = base
    return q


def get_task(task_id: str) -> dict[str, Any] | None:
    with _task_registry_lock:
        return _task_registry.get(task_id)


def task_snapshot() -> dict[str, dict[str, Any]]:
    """深拷贝当前所有任务（去掉 queue），供 /api/tasks 使用。"""
    with _task_registry_lock:
        return {tid: dict(t) for tid, t in _task_registry.items()}


def mark_status(task_id: str, status: str, **fields: Any) -> None:
    """更新任务状态字段，常用于 done/error 时同时更新 run_id / finished_at。"""
    with _task_registry_lock:
        if task_id not in _task_registry:
            return
    run_index_fields = _check_done_run_index(task_id, status, fields)
    with _task_registry_lock:
        task = _task_registry.get(task_id)
        if task is None:
            return
        task["status"] = status
        for k, v in fields.items():
            task[k] = v
        for k, v in run_index_fields.items():
            task[k] = v


def _check_done_run_index(task_id: str, status: str, fields: dict[str, Any]) -> dict[str, Any]:
    """Verify completed tasks point at a queryable run artifact.

    This is deliberately non-blocking: the task terminal state remains done,
    but an index drift becomes visible in task snapshots and production events.
    """
    if status != "done":
        return {}
    if fields.get("run_index_required") is False:
        return {"run_index_status": "not_applicable"}
    run_id = fields.get("run_id")
    if not run_id:
        return {}

    try:
        from src.step_log import load_run

        run_log = load_run(str(run_id))
    except Exception as exc:
        _record_run_index_drift(task_id, str(run_id), f"load_run_error:{exc}")
        return {"run_index_status": "error", "run_index_error": str(exc)}

    if run_log is None:
        _record_run_index_drift(task_id, str(run_id), "load_run_missing")
        return {"run_index_status": "missing", "run_index_error": "load_run_missing"}

    canonical_run_id = getattr(run_log, "run_id", str(run_id))
    return {
        "run_index_status": "ok",
        "canonical_run_id": canonical_run_id,
    }


def _record_run_index_drift(task_id: str, run_id: str, reason: str) -> None:
    try:
        from src.production_events import record_event

        record_event(
            "run_index_drift_detected",
            task_id=task_id,
            run_id=run_id,
            status="warning",
            gate_status="degraded",
            gate_reason=reason,
        )
    except Exception:
        return


def update_monitor(task_id: str, **fields: Any) -> None:
    """更新监控字段（current_step / completed_steps / flow_name 等）。"""
    with _task_registry_lock:
        task = _task_registry.get(task_id)
        if task is None:
            return
        for k, v in fields.items():
            task[k] = v


# ── 人工审批门控 ─────────────────────────────────────────

_approval_events: dict[str, threading.Event] = {}
_approval_results: dict[str, bool] = {}
_approval_lock = threading.Lock()


def register_approval(task_id: str) -> threading.Event:
    """生产者侧：注册一个等待事件，调用方 .wait() 阻塞至用户审批。"""
    evt = threading.Event()
    with _approval_lock:
        _approval_events[task_id] = evt
        _approval_results[task_id] = False
    return evt


def consume_approval(task_id: str) -> bool:
    """生产者侧：.wait() 返回后调用，取出结果并清理状态。"""
    with _approval_lock:
        result = _approval_results.pop(task_id, False)
        _approval_events.pop(task_id, None)
    return result


def deliver_approval(task_id: str, approved: bool) -> bool:
    """消费者侧（HTTP handler）：把审批结果推给等待中的生产者。返回是否找到。"""
    with _approval_lock:
        evt = _approval_events.get(task_id)
        if evt is None:
            return False
        _approval_results[task_id] = approved
        evt.set()
    return True


# ── OpenClaw 交互模式（阻塞等用户）────────────────────────

_openclaw_events: dict[str, threading.Event] = {}
_openclaw_inputs: dict[str, str | None] = {}
_openclaw_lock = threading.Lock()


def register_openclaw_wait(task_id: str) -> threading.Event:
    """生产者侧：交互模式注册等待事件。"""
    evt = threading.Event()
    with _openclaw_lock:
        _openclaw_events[task_id] = evt
        _openclaw_inputs[task_id] = None
    return evt


def consume_openclaw(task_id: str) -> str | None:
    """生产者侧：.wait() 返回后取用户回复（None = 继续 / str = 注入消息）。"""
    with _openclaw_lock:
        user_reply = _openclaw_inputs.pop(task_id, None)
        _openclaw_events.pop(task_id, None)
    return user_reply


def deliver_openclaw_message(task_id: str, message: str) -> bool:
    """消费者侧：注入消息给交互模式的回调。返回是否找到等待者。"""
    with _openclaw_lock:
        evt = _openclaw_events.get(task_id)
        if evt is None:
            return False
        _openclaw_inputs[task_id] = message
        evt.set()
    return True


def deliver_openclaw_proceed(task_id: str) -> bool:
    """消费者侧：用户点'满意继续'，给交互模式回调发 None。"""
    with _openclaw_lock:
        evt = _openclaw_events.get(task_id)
        if evt is None:
            return False
        _openclaw_inputs[task_id] = None
        evt.set()
    return True


# ── OpenClaw 自动循环模式（不阻塞 queue.Queue 模式）──────

_openclaw_auto_queues: dict[str, queue.Queue] = {}
_openclaw_auto_lock = threading.Lock()


def get_or_create_auto_queue(task_id: str) -> queue.Queue:
    """生产者侧：获取或创建自动循环模式的注入 queue。"""
    with _openclaw_auto_lock:
        return _openclaw_auto_queues.setdefault(task_id, queue.Queue())


def get_auto_queue(task_id: str) -> queue.Queue | None:
    """消费者侧：只读取已存在的 auto queue。"""
    with _openclaw_auto_lock:
        return _openclaw_auto_queues.get(task_id)


# governance proceed signals — keyed by task_id
_governance_events: dict[str, threading.Event] = {}


def create_governance_event(task_id: str) -> threading.Event:
    """创建并注册一个 governance proceed event，返回 Event 对象供调用方 .wait()。"""
    ev = threading.Event()
    _governance_events[task_id] = ev
    return ev


def resolve_governance_event(task_id: str) -> bool:
    """释放 governance pause gate。Returns True if event existed."""
    ev = _governance_events.pop(task_id, None)
    if ev:
        ev.set()
        return True
    return False


def get_governance_event(task_id: str) -> threading.Event | None:
    return _governance_events.get(task_id)
