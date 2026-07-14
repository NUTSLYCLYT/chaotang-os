"""异步运行 + SSE 流式 + 人工审批 + OpenClaw 交互端点 —

  POST /api/runs/async                                — 启动异步运行
  GET  /api/runs/stream/{task_id}                     — SSE 实时推送
  GET  /api/runs/stream/{task_id}/status              — 轮询状态
  POST /api/runs/stream/{task_id}/approve             — 人工审批通过
  POST /api/runs/stream/{task_id}/reject              — 人工审批驳回
  POST /api/runs/stream/{task_id}/openclaw_reply      — OpenClaw 注入消息
  POST /api/runs/stream/{task_id}/openclaw_proceed    — OpenClaw 继续下一步

⚠️ SSE 端点用同步 generator + queue.Queue.get(timeout=)；StreamingResponse
   会自动 wrap 到 threadpool 中，event loop 不会被阻塞。
"""

from __future__ import annotations

import json
import queue
import secrets
import threading
import time
from datetime import datetime
from typing import Generator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from src.tenant import with_tenant
from src.production_events import record_event, task_fingerprint, timed_ms
from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.streaming import (
    OkResponse,
    OpenClawReplyRequest,
    RunAsyncRequest,
    TaskAcceptedResponse,
    TaskStatusResponse,
)
from web.slot_filling import validate_config_path
from web.task_registry import (
    consume_approval,
    consume_openclaw,
    deliver_approval,
    deliver_openclaw_message,
    deliver_openclaw_proceed,
    get_auto_queue,
    get_or_create_auto_queue,
    get_task,
    mark_status,
    register_approval,
    register_openclaw_wait,
    register_task,
    update_monitor,
)

router = APIRouter(prefix="/api", tags=["runs_stream"])


# ── POST /api/runs/async ────────────────────────────────


@router.post("/runs/async", response_model=TaskAcceptedResponse)
def api_run_async(
    body: RunAsyncRequest,
    user: CurrentUser = Depends(get_current_user),
) -> TaskAcceptedResponse:
    """异步启动 Flow 或 Swarm 编排，通过 /api/runs/stream/{task_id} 取进度。"""
    ok, err = validate_config_path(body.config)
    if not ok:
        raise HTTPException(status_code=400, detail=err)

    if body.execution_modes is not None:
        invalid = {k: v for k, v in body.execution_modes.items() if v not in ("A", "B")}
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"execution_modes 值必须是 'A' 或 'B'，无效: {invalid}",
            )

    task_id = secrets.token_hex(8)
    # 蜂群模式预生成编排会话 id：让调用方（如朝堂前端）在接受响应里就拿到
    # session_id，可立即关联 /api/swarm/sessions/{id} 轮询，无需等 done 事件。
    swarm_session_id: str | None = None
    if body.swarm:
        from src.swarm_orchestrator import new_session_id

        swarm_session_id = new_session_id()
    q = register_task(
        task_id,
        task_input=body.task_input,
        config=body.config,
        monitor=True,
    )
    record_event(
        "run_async_requested",
        task_id=task_id,
        config=body.config,
        flow=body.config,
        swarm=str(body.swarm or ""),
        tenant_slug=user.tenant_slug,
        user_role=user.role or "",
        status="running",
        gate_status="pending",
        **task_fingerprint(body.task_input),
    )

    def _run() -> None:
        started = time.monotonic()
        try:
            if body.swarm:
                _run_swarm(
                    task_id,
                    q,
                    body,
                    user=user,
                    started=started,
                    session_id=swarm_session_id,
                )
            else:
                _run_flow(task_id, q, body, user=user, started=started)
        except Exception as e:
            q.put({"type": "error", "message": str(e)})
            record_event(
                "run_async_failed",
                task_id=task_id,
                config=body.config,
                flow=body.config,
                swarm=str(body.swarm or ""),
                tenant_slug=user.tenant_slug,
                user_role=user.role or "",
                status="error",
                gate_status="blocked",
                gate_reason="uncaught_exception",
                latency_ms=timed_ms(started),
                error=str(e),
                **task_fingerprint(body.task_input),
            )
            mark_status(
                task_id,
                "error",
                error=str(e),
                finished_at=datetime.now().isoformat(timespec="seconds"),
            )

    threading.Thread(target=with_tenant(_run), daemon=True).start()
    return TaskAcceptedResponse(
        task_id=task_id, status="running", session_id=swarm_session_id
    )


def _run_swarm(
    task_id: str,
    q: queue.Queue,
    body: RunAsyncRequest,
    *,
    user: CurrentUser,
    started: float,
    session_id: str | None = None,
) -> None:
    from src import honesty_envelope as he
    from src import qintianjian_lens as qtj
    from src.orchestration_plan import (
        bindings_closure,
        build_plan,
        merge_bindings_with_overlay,
        plan_run_kwargs,
        record_routing_decision,
    )
    from src.securities_redline import route_with_redline_precheck
    from src.swarm_orchestrator import PROJECT_ROOT, SwarmOrchestrator

    orch = SwarmOrchestrator(str(PROJECT_ROOT / "config" / "swarm_orchestrator.yaml"))

    def on_swarm_start(sid, name):
        q.put({"type": "swarm_start", "swarm_id": sid, "name": name})
        update_monitor(task_id, flow_name=name, current_step_name=f"[swarm] {name}")

    def on_swarm_done(sid, name, run_log):
        run_id = run_log.run_id if run_log else None
        score = (
            run_log.quality_score.get("total_score")
            if run_log and run_log.quality_score
            else None
        )
        q.put(
            {
                "type": "swarm_done",
                "swarm_id": sid,
                "name": name,
                "run_id": run_id,
                "quality_score": score,
            }
        )

    def on_step_done(i, total, name, elapsed, status, output=""):
        q.put(
            {
                "type": "step",
                "step": i,
                "total": total,
                "name": name,
                "elapsed": round(elapsed, 1),
                "status": status,
                "output": output[:4000] if output else "",
            }
        )
        update_monitor(
            task_id,
            completed_steps=i + 1,
            total_steps=total,
            current_step=i,
            current_step_name=name,
        )

    # 入口蜂群：显式字符串须存在于注册表（错字 fail-fast）；swarm=true 走三层计划
    # （第1步 orchestration_plan：丞相 decide → 尚书 pick → 喂唯一编排器），绝不静默
    # 落到注册表第一个蜂群。route/pick 的诚实信封在此产生（第3步：真实请求路径落点）。
    if isinstance(body.swarm, str):
        if body.swarm not in orch.swarms:
            raise ValueError(
                f"入口蜂群 '{body.swarm}' 未注册，可用: {sorted(orch.swarms)}"
            )
        run_kwargs: dict = {"entry_swarm": body.swarm}
        tier_envelopes = he.envelope_explicit(body.swarm)
        lens_plan: dict = {"entry_swarms": [body.swarm]}
        # routing_truth 对照组:人显式推翻/绕过路由的频率也是校准尺子的原料;
        # 对照臂(会审Deming):同时记下丞相本来会怎么选,否则"人推翻路由率"无从算。
        try:
            cf = build_plan(body.task_input, set(orch.swarms))
            counterfactual = {"mode": cf["mode"], "entry_swarms": cf["entry_swarms"]}
        except Exception:
            counterfactual = None
        record_routing_decision(
            {"mode": "explicit", "entry_swarms": [body.swarm]},
            body.task_input,
            chosen_by="user",
            task_id=task_id,
            counterfactual=counterfactual,
        )
        q.put({"type": "route", "swarm": body.swarm, "reason": "explicit"})
    else:
        # 证券红线仍在**入口**一次（第0步b），三层计划内部不重跑（防分解旁路）。
        routed = route_with_redline_precheck(body.task_input, orch.swarms)
        # 证券红线无合规落点 → 拒绝,不下放给 orch.run 默认兜底(会审 MEDIUM:防 fail-open)
        if routed.get("needs_compliance"):
            q.put(
                {
                    "type": "error",
                    "reason": "证券/投资类问题需合规或人工裁决,无合规落点,已拒绝派单",
                }
            )
            return
        if routed.get("redline") == "securities_advice" and routed.get("swarm"):
            # 红线已定合规落点:钉死单入口,不进三层分解(junjichu 窄集不跑红线,防旁路;
            # 收敛后 loop 更常召集 junjichu,该钉死是 PR1 的合并前置条件)
            plan = {
                "mode": "direct",
                "entry_swarms": [routed["swarm"]],
                "abstained": [],
                "ministries": [],
                "reason": routed.get("reason", ""),
                "qintianjian_trigger": None,
            }
        else:
            plan = build_plan(body.task_input, set(orch.swarms))
        # routing_truth 账本:攒真实路由决定,供校准军机处阈值(拍脑袋值的尺子原料)
        record_routing_decision(plan, body.task_input, task_id=task_id)
        tier_envelopes = [he.envelope_route(plan), he.envelope_pick(plan)]
        lens_plan = plan
        try:
            run_kwargs = plan_run_kwargs(plan)
        except ValueError:
            # 全员弃权：诚实拒跑并把三句收口带给用户,不猜蜂群冒充选对
            q.put(
                {
                    "type": "error",
                    "reason": "各部尚书均无自信命中,已拒绝派单;请补充任务说明",
                    "honesty": he.bubble(tier_envelopes),
                }
            )
            return
        q.put(
            {
                "type": "route",
                "mode": plan["mode"],
                "swarm": (plan["entry_swarms"] or [None])[0],
                "entry_swarms": plan["entry_swarms"],
                "reason": plan["reason"],
            }
        )
    # 第4步·钦天监横切镜片(丞相调一次,非第四层):结构否决(decision_guard 登记的
    # 不可逆蜂群)不可被显式人选旁路;veto 不拦跑,只强制签字轴(蜂群照跑出建议,不许自动生效)。
    # 2026-07-08 喂真数据:热度信号←真实账本(truth_ledger/史馆引用),敞口←密旨原文确定性
    # 探测;采集失败退回全未知(镜片按保守 warm),绝不因油箱层故障断主链路。
    from src import qintianjian_signals as qsig

    try:
        sig = qsig.collect_cycle_signals()
        exp = qsig.detect_exposure(body.task_input)
    except Exception:
        sig = {"signals": None, "provenance": {}}
        exp = {"exposure": None, "provenance": {}}
    # 结构否决看绑定闭包(会审Schneier):不可逆蜂群在自动链第几跳都拉签字轴
    try:
        effective = merge_bindings_with_overlay(list(orch.bindings), set(orch.swarms))
        lens_plan = {
            **lens_plan,
            "reachable_swarms": bindings_closure(
                list(lens_plan.get("entry_swarms") or []), effective
            ),
        }
    except Exception:
        pass  # 闭包算不出退化为只看入口(镜片自身兜底)
    lens = qtj.qintianjian_lens(
        lens_plan, signals=sig["signals"], exposure=exp["exposure"]
    )
    lens["data_provenance"] = {**sig["provenance"], **exp["provenance"]}
    # 可证伪触发器落账,pending_triggers() 可催问核销——不再只存在于流事件文本里。
    # 会审(Deming):恒定模板句不落账(每单必现=没人看的墙纸),只落随单变化的触发器。
    _template = ("若签字人补齐对冲", "若新增不可逆付款")
    qsig.log_triggers(
        task_id,
        [
            t
            for t in (lens.get("falsifiable_triggers") or [])
            if not any(t.startswith(x) for x in _template)
        ],
    )
    q.put(
        {
            "type": "qintianjian",
            "verdict": lens["verdict"],
            "veto_reasons": lens.get("veto_reasons") or [],
            "heat": {
                "tier": (lens.get("heat") or {}).get("tier"),
                "score": (lens.get("heat") or {}).get("score"),
            },
            "reason": (lens.get("ruin") or {}).get("reason", ""),
        }
    )  # 会审(张小龙):旋钮/provenance等内部件不外泄用户流,明细留在后端账本
    tier_envelopes.append(qtj.lens_envelope(lens))
    # 三层信封+钦天监横切层先给流,让前端在执行期间就能渲染"凭什么信"
    q.put({"type": "honesty_tiers", "tiers": tier_envelopes})
    # 丞相·天才下一步(2026-07-08 接线:此前建成即死代码,生产零调用):基于史馆真旧案
    # 召回给建议,带引用+outcome prior;无旧案诚实弃权。引用留痕进回执飞轮。fail-open。
    try:
        from src.chancellor_router import genius_next_step

        q.put(
            {
                "type": "genius_next_step",
                "steps": genius_next_step(
                    body.task_input, lens_plan.get("ministries"), task_ref=task_id
                ),
            }
        )
    except Exception:
        pass
    session = orch.run(
        body.task_input,
        session_id=session_id,
        on_swarm_start=on_swarm_start,
        on_swarm_done=on_swarm_done,
        on_step_done=on_step_done,
        **run_kwargs,
    )
    blocked = any(
        getattr(run, "status", "") == "failed"
        or (
            isinstance(getattr(run, "qa_result", None), dict)
            and getattr(run, "qa_result", {}).get("qa_result") == "fail"
        )
        for run in getattr(session, "swarm_runs", [])
    )
    record_event(
        "swarm_run_completed",
        task_id=task_id,
        session_id=session.session_id,
        run_id=session.session_id,
        swarm=str(body.swarm or ""),
        config="config/swarm_orchestrator.yaml",
        tenant_slug=user.tenant_slug,
        user_role=user.role or "",
        status="done",
        gate_status="blocked" if blocked else "clear",
        gate_reason="qa_or_swarm_failed" if blocked else "",
        latency_ms=timed_ms(started),
        **task_fingerprint(body.task_input),
    )
    mark_status(
        task_id,
        "done",
        run_id=session.session_id,
        run_index_required=False,
        finished_at=datetime.now().isoformat(timespec="seconds"),
    )
    # 第3步·御史诚实线收口:三层(route/pick/execution)worst-of 冒泡,三句普通人语言。
    # 灯轴/签字轴两轴独立;draft 租户地板在 bubble 内生效(线程已带租户上下文)。
    final = he.bubble([*tier_envelopes, he.envelope_execution(session=session)])
    q.put({"type": "honesty", **final})
    q.put({"type": "done", "session_id": session.session_id})


def _run_flow(
    task_id: str,
    q: queue.Queue,
    body: RunAsyncRequest,
    *,
    user: CurrentUser,
    started: float,
) -> None:
    from src.flow_engine import FlowEngine

    engine = FlowEngine(
        body.config,
        qa_version=body.qa_version,
        execution_modes=body.execution_modes,
    )

    # Token 缓冲（每 8 个 token 或 50ms flush）
    _tok_buf: list[str] = []
    _tok_meta: dict = {"last_flush": None, "last_step": -1}

    def _flush_tokens(step_idx: int | None = None) -> None:
        if _tok_buf:
            tgt = step_idx if step_idx is not None else _tok_meta["last_step"]
            q.put({"type": "token", "step": tgt, "content": "".join(_tok_buf)})
            _tok_buf.clear()

    def on_step_done(i, total, name, elapsed, status, output=""):
        _flush_tokens()
        update_monitor(task_id, completed_steps=i + 1)
        q.put(
            {
                "type": "step",
                "step": i,
                "total": total,
                "name": name,
                "elapsed": round(elapsed, 1),
                "status": status,
                "output": output[:4000] if output else "",
            }
        )

    def on_token(step_idx, token):
        import time as _t

        now = _t.monotonic()
        if _tok_meta["last_step"] != step_idx:
            _flush_tokens()
            _tok_meta["last_step"] = step_idx
            _tok_meta["last_flush"] = now
        _tok_buf.append(token)
        last = _tok_meta["last_flush"]
        if len(_tok_buf) >= 8 or (last is not None and (now - last) > 0.05):
            _flush_tokens(step_idx)
            _tok_meta["last_flush"] = now

    def on_step_metrics(step_idx, metrics):
        q.put({"type": "step_metrics", "step": step_idx, **metrics})

    def on_approval_required(step_idx, step_name, context):
        steps = context.get("steps", [])
        prev_output = steps[-1]["output"] if steps else ""
        evt = register_approval(task_id)
        q.put(
            {
                "type": "approval_required",
                "step": step_idx,
                "step_name": step_name,
                "preview": prev_output[:3000],
                "task_id": task_id,
            }
        )
        evt.wait(timeout=600)
        return consume_approval(task_id)

    def on_openclaw_turn(step_idx, step_name, current_output):
        step_cfg = (
            engine.step_configs[step_idx] if step_idx < len(engine.step_configs) else {}
        )
        is_auto = step_cfg.get("openclaw_auto_loop", False)
        q.put(
            {
                "type": "openclaw_turn",
                "auto_mode": is_auto,
                "step": step_idx,
                "step_name": step_name,
                "output": current_output[:6000],
                "task_id": task_id,
            }
        )
        if is_auto:
            uq = get_or_create_auto_queue(task_id)
            try:
                return uq.get_nowait()
            except queue.Empty:
                return ""
        else:
            evt = register_openclaw_wait(task_id)
            evt.wait(timeout=600)
            return consume_openclaw(task_id)

    def on_step_save(step_idx, save_status):
        q.put({"type": "step_save", "step": step_idx, "save_status": save_status})

    def on_guard_event(step_idx, event_type, message):
        q.put(
            {
                "type": "guard_event",
                "step": step_idx,
                "event_type": event_type,
                "message": message,
            }
        )

    def on_flow_start(total_steps, flow_name, step_names):
        q.put(
            {
                "type": "flow_start",
                "total": total_steps,
                "flow": flow_name,
                "steps": step_names,
            }
        )
        update_monitor(
            task_id,
            flow_name=flow_name,
            total_steps=total_steps,
            step_names=step_names,
        )

    def on_step_start(step_idx, step_name, model):
        q.put(
            {
                "type": "step_start",
                "step": step_idx,
                "name": step_name,
                "model": model,
            }
        )
        update_monitor(
            task_id,
            current_step=step_idx,
            current_step_name=step_name,
        )

    run_log = engine.run(
        body.task_input,
        on_step_done=on_step_done,
        on_token=on_token,
        on_step_metrics=on_step_metrics,
        on_approval_required=on_approval_required,
        on_openclaw_turn=on_openclaw_turn,
        on_step_save=on_step_save,
        on_guard_event=on_guard_event,
        on_step_start=on_step_start,
        on_flow_start=on_flow_start,
    )
    qa = run_log.qa_result if isinstance(run_log.qa_result, dict) else {}
    blocked = (
        run_log.run_status in {"error", "budget_exceeded"}
        or qa.get("qa_result") == "fail"
        or qa.get("pass") is False
    )
    record_event(
        "flow_run_completed",
        task_id=task_id,
        run_id=run_log.run_id,
        flow=getattr(engine, "flow_name", body.config),
        config=body.config,
        model=getattr(engine, "model", "") or getattr(engine, "default_model", ""),
        tenant_slug=user.tenant_slug,
        user_role=user.role or "",
        status="done",
        gate_status="blocked" if blocked else "clear",
        gate_reason="qa_or_flow_failed" if blocked else "",
        latency_ms=timed_ms(started),
        quality_score=run_log.quality_score,
        **task_fingerprint(body.task_input),
    )
    mark_status(
        task_id,
        "done",
        run_id=run_log.run_id,
        finished_at=datetime.now().isoformat(timespec="seconds"),
    )
    q.put({"type": "done", "run_id": run_log.run_id})


# ── GET /api/runs/stream/{task_id} —— SSE ───────────────


@router.get("/runs/stream/{task_id}")
def api_stream_run(
    task_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """SSE 实时推送 — 客户端用 EventSource 接。

    生成器是同步 generator，FastAPI 自动 wrap 到 threadpool 中，queue.get(timeout=)
    阻塞调用不会卡死 event loop。
    """
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task 不存在")

    q: queue.Queue = task["queue"]
    heartbeat_interval = 8  # 秒 — 弱网下心跳更频，防代理超时断连

    def generate() -> Generator[str, None, None]:
        while True:
            try:
                event = q.get(timeout=heartbeat_interval)
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("type") in ("done", "error"):
                    break
            except queue.Empty:
                yield 'data: {"type": "heartbeat"}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── 状态轮询 ───────────────────────────────────────────


@router.get(
    "/runs/stream/{task_id}/status",
    response_model=TaskStatusResponse,
)
def api_task_status(
    task_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> TaskStatusResponse:
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task 不存在")
    return TaskStatusResponse(
        task_id=task_id,
        status=task["status"],
        run_id=task.get("run_id"),
        error=task.get("error"),
    )


# ── 人工审批 ───────────────────────────────────────────


@router.post(
    "/runs/stream/{task_id}/approve",
    response_model=OkResponse,
)
def api_approve_step(
    task_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> OkResponse:
    if not deliver_approval(task_id, True):
        raise HTTPException(status_code=404, detail="无待审批任务")
    return OkResponse(ok=True)


@router.post(
    "/runs/stream/{task_id}/reject",
    response_model=OkResponse,
)
def api_reject_step(
    task_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> OkResponse:
    if not deliver_approval(task_id, False):
        raise HTTPException(status_code=404, detail="无待审批任务")
    return OkResponse(ok=True)


# ── OpenClaw 交互 / 自动循环 ──────────────────────────


@router.post(
    "/runs/stream/{task_id}/openclaw_reply",
    response_model=OkResponse,
)
def api_openclaw_reply(
    task_id: str,
    body: OpenClawReplyRequest,
    _: CurrentUser = Depends(get_current_user),
) -> OkResponse:
    """注入消息：交互模式走 Event 通知，自动循环模式入队。"""
    if deliver_openclaw_message(task_id, body.message):
        return OkResponse(ok=True)
    uq = get_auto_queue(task_id)
    if uq is not None:
        uq.put(body.message)
        return OkResponse(ok=True)
    raise HTTPException(status_code=404, detail="无待交互的 OpenClaw 任务")


@router.post(
    "/runs/stream/{task_id}/openclaw_proceed",
    response_model=OkResponse,
)
def api_openclaw_proceed(
    task_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> OkResponse:
    """用户点'满意继续'：交互模式发 None，自动循环模式入队 None 作停止信号。"""
    if deliver_openclaw_proceed(task_id):
        return OkResponse(ok=True)
    uq = get_auto_queue(task_id)
    if uq is not None:
        uq.put(None)
        return OkResponse(ok=True)
    raise HTTPException(status_code=404, detail="无待交互的 OpenClaw 任务")
