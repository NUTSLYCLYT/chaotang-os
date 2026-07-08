"""异步 FlowEngine 包装层：同步回调 → asyncio Queue → SSE。"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import AsyncIterator, Optional

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.flow_engine import FlowEngine
from src.model_adapter import ModelAdapter
from src.step_log import load_run

_executor = ThreadPoolExecutor(max_workers=4)

# run_id 格式校验：YYYYMMDD_HHMMSS_xxxxxx
_RUN_ID_RE = re.compile(r"^\d{8}_\d{6}_[0-9a-f]{6}$")

# 全局 run 状态表：run_id → RunMeta（完成 1 小时后自动清除）
_RUN_TTL_S = 3600
_runs: dict[str, dict] = {}


class RunMeta:
    def __init__(self, run_id: str, flow: str, caller_task_id: Optional[str]):
        self.run_id = run_id
        self.flow = flow
        self.caller_task_id = caller_task_id
        self.status = "queued"
        self.steps: list[dict] = []
        self.error: Optional[str] = None
        self.final_output: Optional[dict] = None
        self.quality_score: Optional[float] = None
        self.quality_grade: Optional[str] = None
        # thread-safe event queue, None = sentinel (done)
        self._q: asyncio.Queue = asyncio.Queue()
        self._loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()

    def _emit(self, event: dict) -> None:
        """从同步线程安全地推事件到异步 Queue。"""
        self._loop.call_soon_threadsafe(self._q.put_nowait, event)

    def emit_flow_start(
        self, total_steps: int, flow_name: str, step_names: list[str]
    ) -> None:
        self.steps = [
            {"step_idx": i, "step_id": "", "agent_name": name, "status": "waiting"}
            for i, name in enumerate(step_names)
        ]
        self._emit(
            {
                "event": "flow_start",
                "total_steps": total_steps,
                "flow_name": flow_name,
                "agents": step_names,
            }
        )

    def emit_step_start(self, step_idx: int, step_id: str, agent_name: str) -> None:
        if step_idx < len(self.steps):
            self.steps[step_idx].update(
                {
                    "step_id": step_id,
                    "agent_name": agent_name,
                    "status": "running",
                    "_start_ms": int(time.time() * 1000),
                }
            )
        self._emit(
            {
                "event": "agent_start",
                "step": step_idx,
                "step_id": step_id,
                "agent": agent_name,
            }
        )

    def emit_token(self, step_idx: int, token: str) -> None:
        self._emit({"event": "token", "step": step_idx, "token": token})

    def emit_step_done(
        self, step_idx: int, output: str, quality_score: Optional[float] = None
    ) -> None:
        dur = 0
        if step_idx < len(self.steps):
            start_ms = self.steps[step_idx].get("_start_ms", int(time.time() * 1000))
            dur = int(time.time() * 1000) - start_ms
            self.steps[step_idx].update(
                {
                    "status": "done",
                    "output": output,
                    "duration_ms": dur,
                    "quality_score": quality_score,
                }
            )
        self._emit(
            {
                "event": "agent_done",
                "step": step_idx,
                "output": output,
                "duration_ms": dur,
                "quality_score": quality_score,
            }
        )

    def emit_complete(self, final_output: dict, score: float, grade: str) -> None:
        self.status = "complete"
        self.final_output = final_output
        self.quality_score = score
        self.quality_grade = grade
        self._emit(
            {
                "event": "flow_done",
                "run_id": self.run_id,
                "final_output": final_output,
                "score": score,
                "grade": grade,
            }
        )
        self._emit(None)  # sentinel
        self._schedule_cleanup()

    def emit_error(self, error: str) -> None:
        self.status = "failed"
        self.error = error
        self._emit({"event": "error", "error": error})
        self._emit(None)  # sentinel
        self._schedule_cleanup()

    def _schedule_cleanup(self) -> None:
        """完成后 1 小时从内存中清除，防止 _runs 无限增长。"""
        run_id = self.run_id

        def _remove():
            _runs.pop(run_id, None)

        self._loop.call_soon_threadsafe(self._loop.call_later, _RUN_TTL_S, _remove)

    async def stream(self) -> AsyncIterator[str]:
        """异步生成 SSE 文本行。"""
        while True:
            event = await self._q.get()
            if event is None:
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def start_flow(
    run_id: str,
    config_path: str,
    task_input: str,
    flow_type: str,
    caller_task_id: Optional[str],
    qa_version: str,
    courtos_callback_url: Optional[str] = None,
) -> RunMeta:
    """提交 Flow 到线程池异步执行，返回 RunMeta（立即返回，不等完成）。"""
    meta = RunMeta(run_id, flow_type, caller_task_id)
    _runs[run_id] = meta
    meta.status = "running"

    loop = asyncio.get_running_loop()

    def _run_sync():
        try:
            engine = FlowEngine(config_path, qa_version=qa_version)
            current_step_idx: list[int] = [0]

            def on_flow_start(total, flow_name, step_names=None):
                names = step_names or [f"Step {i}" for i in range(total)]
                meta.emit_flow_start(total, flow_name, names)

            def on_step_start(step_idx, agent_name, model):
                current_step_idx[0] = step_idx
                meta.emit_step_start(step_idx, agent_name, agent_name)

            def on_token(step_idx, token):
                meta.emit_token(step_idx, token)

            def on_step_done(idx, total, agent_name, elapsed, status, output):
                meta.emit_step_done(idx, output or "")

            # best-of-N 重采样：消除单次 LLM 输出变异。
            # flow yaml 顶层加 `best_of_n: 2`（或 3）开启。默认 1 = 单次。
            best_of_n = max(1, int(engine.config.get("best_of_n", 1)))
            best_log = None
            best_score = -1.0
            for n_idx in range(best_of_n):
                attempt_run_id = run_id if n_idx == 0 else f"{run_id}_n{n_idx + 1}"
                attempt_log = engine.run(
                    task_input,
                    on_flow_start=on_flow_start if n_idx == 0 else None,
                    on_step_start=on_step_start if n_idx == 0 else None,
                    on_token=on_token if n_idx == 0 else None,
                    on_step_done=on_step_done if n_idx == 0 else None,
                    run_id=attempt_run_id,
                )
                qs_attempt = attempt_log.quality_score
                if isinstance(qs_attempt, dict):
                    score_attempt = float(qs_attempt.get("total_score", 0.0))
                else:
                    score_attempt = float(qs_attempt or 0.0)
                if score_attempt > best_score:
                    best_score = score_attempt
                    best_log = attempt_log
            run_log = best_log or attempt_log

            final = run_log.final_output or {}
            qs_raw = run_log.quality_score
            if isinstance(qs_raw, dict):
                qs = float(qs_raw.get("total_score", qs_raw.get("score", 0.0)))
                grade = str(qs_raw.get("grade", "N/A"))
            elif qs_raw is not None:
                qs = float(qs_raw)
                grade = "A" if qs >= 4.0 else "B" if qs >= 3.0 else "C"
            else:
                qs, grade = 0.0, "N/A"
            meta.emit_complete(final, qs, grade)

            # 回调 CourtOS
            if courtos_callback_url:
                _notify_courtos(courtos_callback_url, caller_task_id, run_id, final, qs)

        except BaseException as e:
            meta.emit_error(f"{type(e).__name__}: {e}")
            raise

    loop.run_in_executor(_executor, _run_sync)
    return meta


def _notify_courtos(
    url: str, task_id: str, run_id: str, final_output: dict, score: float
) -> None:
    try:
        import httpx

        httpx.post(
            url,
            json={
                "task_id": task_id,
                "run_id": run_id,
                "status": "complete",
                "score": score,
                "summary": final_output,
            },
            timeout=10,
        )
    except Exception as e:
        logger.warning("_notify_courtos failed %s: %s", url, e)


async def start_rerun(
    run_id: str,
    config_path: str,
    flow_type: str,
    new_run_id: str,
    from_step: int = 0,
    prompt_override: Optional[str] = None,
    step_id: Optional[str] = None,
) -> RunMeta:
    """提交 rerun 到线程池异步执行，返回 RunMeta（立即返回，不等完成）。"""
    meta = RunMeta(new_run_id, flow_type, None)
    _runs[new_run_id] = meta
    meta.status = "running"

    loop = asyncio.get_running_loop()

    def _run_sync():
        try:
            engine = FlowEngine(config_path)
            step_idx_counter: list[int] = [from_step]

            def on_step_done(idx, total, agent_name, elapsed, status, output):
                meta.emit_step_start(idx, agent_name, agent_name)
                meta.emit_step_done(idx, output or "")
                step_idx_counter[0] = idx

            run_log = engine.rerun_from(
                run_id=run_id,
                from_step=from_step,
                prompt_override=prompt_override,
                step_id=step_id,
                on_step_done=on_step_done,
                new_run_id=new_run_id,
            )

            final = run_log.final_output or {}
            qs_raw = run_log.quality_score
            if isinstance(qs_raw, dict):
                qs = float(qs_raw.get("total_score", qs_raw.get("score", 0.0)))
                grade = str(qs_raw.get("grade", "N/A"))
            elif qs_raw is not None:
                qs = float(qs_raw)
                grade = "A" if qs >= 4.0 else "B" if qs >= 3.0 else "C"
            else:
                qs, grade = 0.0, "N/A"
            meta.emit_complete(final, qs, grade)

        except BaseException as e:
            meta.emit_error(f"{type(e).__name__}: {e}")
            raise

    loop.run_in_executor(_executor, _run_sync)
    return meta


def get_run_meta(run_id: str) -> Optional[RunMeta]:
    return _runs.get(run_id)


def _to_float_score(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, dict):
        return float(v.get("total_score", v.get("score", 0.0)))
    return float(v)


def get_run_log(run_id: str) -> Optional[dict]:
    """从文件系统读取完整 run 日志（FlowEngine 已写盘）。"""
    try:
        run_log = load_run(run_id)
        return {
            "run_id": run_id,
            "flow": run_log.flow_name,
            "status": "complete",
            "task_input": run_log.task_input,
            "steps": [
                {
                    "step_idx": i,
                    "step_id": s.step_id,
                    "agent_name": s.agent_name,
                    "status": "done",
                    "output": s.output,
                    "quality_score": _to_float_score(getattr(s, "quality_score", None)),
                }
                for i, s in enumerate(run_log.steps)
            ],
            "final_output": run_log.final_output,
            "quality_score": _to_float_score(run_log.quality_score),
            "quality_grade": (
                getattr(run_log, "quality_grade", None)
                or (
                    run_log.quality_score.get("grade")
                    if isinstance(run_log.quality_score, dict)
                    else None
                )
            ),
        }
    except Exception:
        return None
