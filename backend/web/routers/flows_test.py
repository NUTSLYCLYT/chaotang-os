"""单步测试端点 — POST /api/flows/test_step

只运行一个 step，返回 task_id 给前端订阅 SSE 进度。复用 task_registry。
"""
from __future__ import annotations

import copy
import queue
import secrets
import threading
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException

from src.tenant import with_tenant
from src.step_log import load_run

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.streaming import TaskAcceptedResponse, TestStepRequest
from web.slot_filling import validate_config_path
from web.task_registry import mark_status, register_task

router = APIRouter(prefix="/api/flows", tags=["flows_test"])


@router.post("/test_step", response_model=TaskAcceptedResponse)
def api_test_step(
    body: TestStepRequest,
    _: CurrentUser = Depends(get_current_user),
) -> TaskAcceptedResponse:
    # 路径安全 + 存在性校验
    ok, err = validate_config_path(body.config)
    if not ok:
        raise HTTPException(status_code=400, detail=err)
    if not Path(body.config).exists():
        raise HTTPException(
            status_code=400,
            detail=f"config 文件不存在: {body.config}",
        )

    step_id = body.step_id.strip()
    test_input = body.test_input.strip()
    if not step_id:
        raise HTTPException(status_code=400, detail="step_id 不能为空")
    if not test_input:
        raise HTTPException(status_code=400, detail="test_input 不能为空")

    context_run_id = (body.context_run_id or "").strip() or None

    # 加载完整 config 并定位 step
    with open(body.config, encoding="utf-8") as f:
        full_config = yaml.safe_load(f) or {}
    all_steps = full_config.get("steps", []) or []
    target_step = next((s for s in all_steps if s.get("id") == step_id), None)
    if target_step is None:
        raise HTTPException(
            status_code=400,
            detail=f"step_id '{step_id}' 不存在于 {body.config}",
        )

    # 构建只跑一步的 config
    step_copy = copy.deepcopy(target_step)
    step_copy.pop("depends_on", None)
    step_copy.pop("openclaw_auto_loop", None)
    step_copy.pop("openclaw_interactive", None)
    if step_copy.get("openclaw_timeout", 0) > 300:
        step_copy["openclaw_timeout"] = 300

    single_step_config = {
        "flow_name": f"test:{step_id}",
        "output_fields": [],
        "steps": [step_copy],
    }
    for key in (
        "default_model", "model", "default_api_base", "api_base",
        "default_api_key_env", "api_key_env",
        "default_temperature", "default_max_tokens",
    ):
        if key in full_config:
            single_step_config[key] = full_config[key]

    # 可选：注入已有 run 的前置步骤上下文
    context_extra: dict = {}
    if context_run_id:
        ctx_run = load_run(context_run_id)
        if ctx_run is None:
            raise HTTPException(
                status_code=404,
                detail=f"context_run_id '{context_run_id}' 不存在",
            )
        prior_outputs = []
        for step_log in ctx_run.steps:
            if step_log.step_id == step_id:
                break
            if step_log.output:
                prior_outputs.append(
                    f"[{step_log.step_id}] {step_log.agent_name}:\n{step_log.output}"
                )
        if prior_outputs:
            context_extra["conversation_history"] = "\n\n".join(prior_outputs)

    task_id = secrets.token_hex(8)
    q = register_task(task_id)

    def _run() -> None:
        try:
            from src.flow_engine import FlowEngine
            engine = FlowEngine.from_dict(single_step_config)

            def on_step_done(i, total, name, elapsed, status, output=""):
                q.put({
                    "type": "step", "step": i, "total": total, "name": name,
                    "elapsed": round(elapsed, 1), "status": status,
                    "output": output[:4000] if output else "",
                })

            def on_token(step_idx, token):
                q.put({"type": "token", "step": step_idx, "content": token})

            _oc_turn = [1]
            _oc_done_signal = step_copy.get("openclaw_done_signal", "") or ""

            def on_openclaw_turn(step_idx, step_name, output):
                if _oc_done_signal and _oc_done_signal in (output or ""):
                    return None
                q.put({"type": "openclaw_turn", "turn": _oc_turn[0]})
                _oc_turn[0] += 1
                return ""

            run_log = engine.run(
                test_input,
                on_step_done=on_step_done,
                on_token=on_token,
                on_openclaw_turn=on_openclaw_turn,
                context_extra=context_extra if context_extra else None,
            )
            mark_status(task_id, "done", run_id=run_log.run_id)
            q.put({"type": "done", "run_id": run_log.run_id})
        except Exception as e:
            q.put({"type": "error", "message": str(e)})
            mark_status(task_id, "error", error=str(e))

    threading.Thread(target=with_tenant(_run), daemon=True).start()
    return TaskAcceptedResponse(task_id=task_id, status="running")
