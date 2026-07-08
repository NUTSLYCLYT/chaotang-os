"""fengqun-runtime FastAPI service — :8082"""

from __future__ import annotations

import logging
import os
import sys
import uuid

from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from service.models import RerunRequest, RunRequest, RunStarted, RunStatus, StepInfo
from service.optimizer import optimize
from service.router import resolve_flow
from service.runner import (
    _RUN_ID_RE,
    get_run_log,
    get_run_meta,
    start_flow,
    start_rerun,
)

from src.model_adapter import ModelAdapter

# API 文档默认关闭(fail-safe,与 web/main.py 同口径);FENGQUN_ENABLE_DOCS=true 才开放。
_DOCS_ENABLED = os.environ.get("FENGQUN_ENABLE_DOCS", "false").lower() in (
    "true",
    "1",
    "yes",
)

app = FastAPI(
    title="fengqun-runtime",
    version="1.0.0",
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)

_origins_raw = os.environ.get(
    "FENGQUN_ALLOWED_ORIGINS",
    "http://localhost:3100,http://127.0.0.1:3100,http://localhost:4000,http://127.0.0.1:4000",
)
_ALLOWED_ORIGINS = [o.strip() for o in _origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bearer token 认证（从 env 读，未设置则跳过）
_API_KEY = os.environ.get("FENGQUN_API_KEY", "")
_COURTOS_CALLBACK = os.environ.get("COURTOS_CALLBACK_URL", "")

_logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _on_startup() -> None:
    if not _API_KEY:
        _logger.warning(
            "[fengqun-runtime] FENGQUN_API_KEY not set — all endpoints accessible without authentication"
        )


# 默认 ModelAdapter（用于 Prompt 优化器）
_default_adapter = None


def _get_adapter() -> ModelAdapter:
    global _default_adapter
    if _default_adapter is None:
        from src.provider import get_provider_config

        cfg = get_provider_config("litellm_proxy")
        _default_adapter = ModelAdapter(
            model=cfg["default_model"],
            api_base=cfg["api_base"],
            api_key=os.environ.get(cfg["api_key_env"], ""),
        )
    return _default_adapter


def _auth(authorization: Optional[str]) -> None:
    if not _API_KEY:
        return
    if authorization != f"Bearer {_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _validate_run_id(run_id: str) -> None:
    if not _RUN_ID_RE.match(run_id):
        raise HTTPException(status_code=400, detail="invalid run_id format")


def _config_path(filename: str) -> str:
    base = os.path.dirname(os.path.dirname(__file__))
    return os.path.join(base, "config", filename)


# ── Routes ─────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "service": "fengqun-runtime"}


@app.post("/flows/run", response_model=RunStarted)
async def run_flow(
    req: RunRequest,
    authorization: Optional[str] = Header(None),
):
    _auth(authorization)

    flow_type, config_file = resolve_flow(req.type, req.input)
    config_path = _config_path(config_file)

    if not os.path.exists(config_path):
        raise HTTPException(
            status_code=400, detail=f"flow config not found: {config_file}"
        )

    # Step 0: Prompt 优化
    task_input = req.input
    optimized_input: Optional[str] = None
    if req.optimize_prompt:
        try:
            optimized_input = optimize(req.input, _get_adapter())
            task_input = optimized_input
        except Exception:
            pass  # 优化失败静默降级，用原始输入

    run_id = datetime_run_id()

    meta = await start_flow(
        run_id=run_id,
        config_path=config_path,
        task_input=task_input,
        flow_type=flow_type,
        caller_task_id=req.caller_task_id,
        qa_version=req.qa_version,
        courtos_callback_url=_COURTOS_CALLBACK or None,
    )

    return RunStarted(
        run_id=run_id,
        status="queued",
        flow=flow_type,
        optimized_input=optimized_input,
        stream_url=f"/flows/runs/{run_id}/stream",
    )


@app.get("/flows/runs/{run_id}/stream")
async def stream_run(
    run_id: str,
    authorization: Optional[str] = Header(None),
):
    _auth(authorization)
    _validate_run_id(run_id)
    meta = get_run_meta(run_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="run not found")

    return StreamingResponse(
        meta.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/flows/runs/{run_id}", response_model=RunStatus)
def get_run(
    run_id: str,
    authorization: Optional[str] = Header(None),
):
    _auth(authorization)
    _validate_run_id(run_id)

    # 先查内存（运行中）
    meta = get_run_meta(run_id)
    if meta:
        return RunStatus(
            run_id=run_id,
            status=meta.status,
            flow=meta.flow,
            steps=[
                StepInfo(**{k: v for k, v in s.items() if k != "_start_ms"})
                for s in meta.steps
            ],
            final_output=meta.final_output,
            quality_score=meta.quality_score,
            quality_grade=meta.quality_grade,
            error=meta.error,
        )

    # 再查文件系统（已完成）
    log = get_run_log(run_id)
    if log:
        return RunStatus(
            run_id=run_id,
            status=log["status"],
            flow=log["flow"],
            steps=[StepInfo(**s) for s in log["steps"]],
            final_output=log.get("final_output"),
            quality_score=log.get("quality_score"),
            quality_grade=log.get("quality_grade"),
        )

    raise HTTPException(status_code=404, detail="run not found")


@app.post("/flows/runs/{run_id}/rerun", response_model=RunStarted)
async def rerun(
    run_id: str,
    req: RerunRequest,
    authorization: Optional[str] = Header(None),
):
    _auth(authorization)
    _validate_run_id(run_id)

    log = get_run_log(run_id)
    if not log:
        raise HTTPException(status_code=404, detail="original run not found")

    flow_type = log["flow"]
    _, config_file = resolve_flow(flow_type, "")
    config_path = _config_path(config_file)

    new_run_id = datetime_run_id()

    await start_rerun(
        run_id=run_id,
        config_path=config_path,
        flow_type=flow_type,
        new_run_id=new_run_id,
        from_step=req.from_step,
        prompt_override=req.prompt_override,
        step_id=req.step_id,
    )

    return RunStarted(
        run_id=new_run_id,
        status="queued",
        flow=flow_type,
        stream_url=f"/flows/runs/{new_run_id}/stream",
    )


@app.get("/quality/{run_id}")
def get_quality(
    run_id: str,
    authorization: Optional[str] = Header(None),
):
    _auth(authorization)
    log = get_run_log(run_id)
    if not log:
        raise HTTPException(status_code=404, detail="run not found")
    return {
        "run_id": run_id,
        "score": log.get("quality_score"),
        "grade": log.get("quality_grade"),
        "steps": [
            {
                "step_idx": s["step_idx"],
                "agent": s["agent_name"],
                "quality_score": s.get("quality_score"),
            }
            for s in log.get("steps", [])
        ],
    }


# ── Helpers ─────────────────────────────────────────────────────────────────


def datetime_run_id() -> str:
    from datetime import datetime

    return datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("service.main:app", host="0.0.0.0", port=8082, reload=False)
