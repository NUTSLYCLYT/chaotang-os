"""运行 CRUD / 详情 / Step / 重跑 / 编辑 / 质量 等端点。

迁自 web/app.py:
  GET  /api/runs
  GET  /api/runs/{run_id}
  GET  /api/runs/{run_id}/steps/{step_index}
  POST /api/run
  PUT  /api/runs/{run_id}/final-output
  GET  /api/runs/{run_id}/quality
  GET  /api/runs/{run_id}/optimize/trigger
  POST /api/runs/{run_id}/rerun

注：/api/run 仍按"半异步"行为执行（后台线程，立即返回 run_id_prefix），
阶段 5 会重构为基于 asyncio.Task 的真正异步任务注册表。
"""

from __future__ import annotations

import json
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from src.tenant import with_tenant
from src.compare import analyze_optimization_opportunity
from src.step_log import list_runs, load_run

from web.deps import get_current_user, validate_run_id
from web.run_utils import (
    FIELD_THRESHOLDS,
    broken_run_summary,
    compute_run_status,
    flow_semaphore,
    parse_run_meta,
    resolve_config_path,
    run_summary,
    signoff_annotation,
)
from web.schemas.auth import CurrentUser
from web.schemas.runs import (
    EditFinalOutputRequest,
    EditFinalOutputResponse,
    RerunRequest,
    RerunResponse,
    RunFlowRequest,
    RunFlowResponse,
)

router = APIRouter(prefix="/api", tags=["runs"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_run_threads: dict[str, threading.Thread] = {}


# ── 列表 ───────────────────────────────────────────────


@router.get("/runs", response_model=list[dict[str, Any]])
def api_runs(_: CurrentUser = Depends(get_current_user)) -> list[dict[str, Any]]:
    """列出全部 run 摘要 — 损坏文件不会让请求失败，返回错误占位。"""
    runs: list[dict[str, Any]] = []
    for run_id in list_runs():
        try:
            run_log = load_run(run_id)
            if run_log is None:
                continue
            runs.append(run_summary(run_log))
        except Exception:
            runs.append(broken_run_summary(run_id))
    return runs


# ── 单 run 详情 ────────────────────────────────────────


@router.get("/runs/{run_id}")
def api_run_detail(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    meta = parse_run_meta(run_log)
    steps = []
    for s in run_log.steps:
        # system_prompt / rendered_context / raw_response 在 Raw tab 单独取
        steps.append(
            {
                "step_index": s.step_index,
                "step_id": s.step_id,
                "agent_name": s.agent_name,
                "timestamp": s.timestamp,
                "model": s.model,
                "status": s.status,
                "source": s.source,
                "prompt_version": s.prompt_version,
                "quality_score": s.quality_score,
                "duration_seconds": s.duration_seconds,
                "input": s.input,
                "output": s.output,
                "output_length": len(s.output),
            }
        )

    return {
        "run_id": run_log.run_id,
        "run_type": meta["run_type"],
        "run_status": compute_run_status(run_log),
        "source_run_id": meta["source_run_id"],
        "from_step": meta["from_step"],
        "prompt_versions": meta["prompt_versions"],
        "quality_score": meta["quality_score"],
        "task_input": run_log.task_input,
        "flow_name": run_log.flow_name,
        "steps": steps,
        "final_output": run_log.final_output,
        "qa_result": run_log.qa_result,
        "field_thresholds": FIELD_THRESHOLDS,
        # 不可逆决策签字状态(非阻断标注),与 /report 一致。
        "signoff": signoff_annotation(run_log),
    }


# ── 报告视图（前端最小闭环 GET /api/runs/{run_id}/report）──


@router.get("/runs/{run_id}/report")
def api_run_report(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """最终报告视图：把奏折正文 final_output + QA 门禁 qa_result 打包给前端展示。

    纯读取，复用 load_run；不新增副作用，不改既有 /runs/{run_id} 详情端点。
    source_label 待核实 s.source 真实取值后单独补，不在此处猜测。
    """
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    meta = parse_run_meta(run_log)
    return {
        "run_id": run_log.run_id,
        "run_status": compute_run_status(run_log),
        "task_input": run_log.task_input,
        "flow_name": run_log.flow_name,
        "final_output": run_log.final_output,
        "qa_result": run_log.qa_result,
        "quality_score": meta["quality_score"],
        "step_count": len(run_log.steps),
        # 不可逆决策签字状态(非阻断标注):前端据此显示"未签字·不得执行",不改变端点行为。
        "signoff": signoff_annotation(run_log),
    }


# ── Step 详情（含 prompt/context/raw）────────────────────


@router.get("/runs/{run_id}/steps/{step_index}")
def api_step_detail(
    step_index: int,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")
    if step_index < 0 or step_index >= len(run_log.steps):
        raise HTTPException(
            status_code=404,
            detail=f"Step {step_index} 不存在 (共 {len(run_log.steps)} 步)",
        )

    s = run_log.steps[step_index]
    return {
        "step_index": s.step_index,
        "step_id": s.step_id,
        "agent_name": s.agent_name,
        "timestamp": s.timestamp,
        "model": s.model,
        "status": s.status,
        "source": s.source,
        "prompt_version": s.prompt_version,
        "quality_score": s.quality_score,
        "system_prompt": s.system_prompt,
        "rendered_context": s.rendered_context,
        "input": s.input,
        "output": s.output,
        "output_length": len(s.output),
        "raw_response": s.raw_response,
    }


# ── 启动 Flow（半异步：返回 prefix，后台跑）─────────────


@router.post(
    "/run",
    response_model=RunFlowResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def api_run_flow(
    body: RunFlowRequest,
    _: CurrentUser = Depends(get_current_user),
) -> RunFlowResponse:
    config_path = body.config.strip()
    if not Path(config_path).is_absolute():
        config_path = str(_PROJECT_ROOT / config_path)
    if not Path(config_path).exists():
        raise HTTPException(status_code=404, detail=f"配置文件不存在: {config_path}")

    from src.flow_engine import FlowEngine

    run_id_prefix = datetime.now().strftime("%Y%m%d_%H%M%S")
    if not flow_semaphore.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="系统繁忙，请稍后重试（并发数已满）",
        )

    try:
        engine = FlowEngine(config_path, provider=body.provider)
    except Exception:
        flow_semaphore.release()
        raise

    task_input = body.task_input.strip()

    def _run() -> None:
        try:
            engine.run(task_input)
        except Exception:
            import traceback

            traceback.print_exc()
        finally:
            flow_semaphore.release()

    t = threading.Thread(target=with_tenant(_run), daemon=True)
    try:
        t.start()
    except Exception:
        flow_semaphore.release()
        raise
    _run_threads[run_id_prefix] = t

    return RunFlowResponse(
        status="accepted",
        run_id_prefix=run_id_prefix,
        config=body.config,
        task_input=task_input,
    )


# ── 手动编辑 final_output（Human-in-the-loop）──────────


@router.put(
    "/runs/{run_id}/final-output",
    response_model=EditFinalOutputResponse,
)
def api_edit_final_output(
    body: EditFinalOutputRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> EditFinalOutputResponse:
    run_log = load_run(run_id)
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    from src.step_log import RUNS_DIR, save_final_output

    run_dir = RUNS_DIR / run_id
    backup_path = run_dir / "final_output_before_edit.json"
    orig_path = run_dir / "final_output.json"
    if orig_path.exists() and not backup_path.exists():
        shutil.copy2(orig_path, backup_path)

    save_final_output(run_id, body.final_output, run_log.qa_result)

    meta_path = run_dir / "run_meta.json"
    meta = (
        json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    )
    edits = meta.get("manual_edits", []) or []
    edits.append(
        {
            "timestamp": datetime.now().isoformat(),
            "edit_note": body.edit_note,
            "fields_changed": list(body.final_output.keys()),
        }
    )
    meta["manual_edits"] = edits
    meta["has_manual_edit"] = True
    meta_path.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return EditFinalOutputResponse(
        status="saved",
        run_id=run_id,
        fields_saved=len(body.final_output),
        backup=backup_path.name,
    )


# ── 质量详情 ────────────────────────────────────────────


@router.get("/runs/{run_id}/quality")
def api_run_quality(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    return {
        "run_id": run_id,
        "analysis": analyze_optimization_opportunity(run_log),
        "quality_score": run_log.quality_score,
        "prompt_versions": run_log.prompt_versions,
    }


@router.get("/runs/{run_id}/optimize/trigger")
def api_optimize_trigger(
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")
    return analyze_optimization_opportunity(run_log)


# ── 重跑 ────────────────────────────────────────────────


@router.post("/runs/{run_id}/rerun", response_model=RerunResponse)
def api_rerun(
    body: RerunRequest,
    run_id: str = Depends(validate_run_id),
    _: CurrentUser = Depends(get_current_user),
) -> RerunResponse:
    try:
        run_log = load_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载失败: {e!s}") from e
    if run_log is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} 不存在")

    config_path = resolve_config_path(run_id)
    try:
        from src.flow_engine import FlowEngine

        engine = FlowEngine(config_path)
        new_run_log = engine.rerun_from(
            run_id=run_id,
            from_step=body.from_step,
            step_id=body.step_id,
            step_overrides=body.step_overrides,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重跑失败: {e!s}") from e

    return RerunResponse(
        original_run_id=run_id,
        new_run_id=new_run_log.run_id,
        from_step=body.from_step,
        step_id=body.step_id,
    )
