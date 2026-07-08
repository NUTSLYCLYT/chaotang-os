"""语音获客 API — /api/voice/*

替代旧 web/voice_api.py Flask Blueprint。

模式:
  A: { "transcript": "..." }       → 直接处理文本
  B: { "audio_url": "..." }        → 下载 + RAGflow ASR → 文本
  B 变体: multipart audio file     → 直接 ASR → 文本
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path

import requests as _requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.common import StatusResponse
from web.schemas.voice import (
    VoiceProcessJSONRequest,
    VoiceProcessResponse,
    VoiceSession,
    VoiceSessionsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# RAGflow ASR 配置
_RAGFLOW_BASE = os.environ.get("RAGFLOW_BASE_URL", "http://127.0.0.1:9380")
_RAGFLOW_ASR_URL = f"{_RAGFLOW_BASE}/v1/conversation/sequence2txt"
_RAGFLOW_TOKEN = os.environ.get(
    "RAGFLOW_API_KEY",
    "ragflow-Mf2nRV7Tp3h71LIPdFi80vG29x_tKdz6xxIau1B5uww",
)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


# ── 内部辅助 ────────────────────────────────────────────

def _asr_from_file(audio_bytes: bytes, filename: str = "audio.wav") -> str:
    """调用 RAGflow SenseVoiceSmall 转写音频字节，返回 transcript。"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "wav"
    content_type_map = {
        "mp3": "audio/mpeg", "wav": "audio/wav",
        "m4a": "audio/mp4", "ogg": "audio/ogg",
        "webm": "audio/webm", "flac": "audio/flac",
    }
    content_type = content_type_map.get(ext, "audio/wav")
    try:
        resp = _requests.post(
            _RAGFLOW_ASR_URL,
            headers={"Authorization": f"Bearer {_RAGFLOW_TOKEN}"},
            files={"audio": (filename, audio_bytes, content_type)},
            timeout=120,
        )
        if resp.status_code == 200:
            data = resp.json()
            return (
                data.get("data", {}).get("text")
                or data.get("text")
                or data.get("transcript")
                or ""
            )
        logger.warning("RAGflow ASR returned %d: %s", resp.status_code, resp.text[:200])
        return ""
    except Exception as e:
        logger.error("RAGflow ASR error: %s", e)
        return ""


def _run_voice_flow(
    transcript: str,
    caller_phone: str = "",
    extra_context: dict | None = None,
) -> dict:
    """跑 flow_voice_sales 并提取 wechat 动作。"""
    from src.flow_engine import FlowEngine

    flow_config_path = _PROJECT_ROOT / "config" / "flow_voice_sales.yaml"
    if not flow_config_path.exists():
        return {"error": "flow_voice_sales.yaml 不存在", "status": "error"}

    task_input = transcript
    if caller_phone:
        task_input = f"[来电号码: {caller_phone}]\n\n{transcript}"
    if extra_context:
        for k, v in extra_context.items():
            task_input = f"[{k}: {v}]\n{task_input}"

    t0 = time.time()
    try:
        engine = FlowEngine(str(flow_config_path))
        run_log = engine.run(task_input)
        duration_ms = int((time.time() - t0) * 1000)

        actions = []
        for step in run_log.steps:
            raw_log = (step.metadata or {}).get("tool_calls_log", {})
            calls = (
                raw_log.get("calls", [])
                if isinstance(raw_log, dict)
                else (raw_log if isinstance(raw_log, list) else [])
            )
            for tc in calls:
                tool_name = tc.get("tool_name") or tc.get("tool", "")
                if "wechat" in tool_name.lower() or "add_contact" in tool_name.lower():
                    actions.append({
                        "type": "add_wechat",
                        "tool": tool_name,
                        "params": tc.get("arguments") or tc.get("params", {}),
                        "result": tc.get("result", {}),
                        "draft_id": tc.get("draft_id"),
                        "status": tc.get("status"),
                    })

        output = run_log.final_output
        if not output and run_log.steps:
            output = run_log.steps[-1].output

        return {
            "run_id": run_log.run_id,
            "status": "completed",
            "output": output or {},
            "actions": actions,
            "duration_ms": duration_ms,
        }
    except Exception as e:
        logger.exception("flow_voice_sales 执行失败")
        return {
            "error": str(e),
            "status": "error",
            "duration_ms": int((time.time() - t0) * 1000),
        }


# ── 端点 ────────────────────────────────────────────────

@router.post("/process", response_model=VoiceProcessResponse)
async def api_voice_process(
    request: Request,
    _: CurrentUser = Depends(get_current_user),
) -> VoiceProcessResponse:
    """语音获客主入口，同时支持 JSON 与 multipart。

    - JSON: { transcript | audio_url, caller_phone? }
    - multipart: audio=<file>, caller_phone?=<str>
    """
    content_type = request.headers.get("content-type", "")
    caller_phone = ""
    transcript = ""
    mode = "unknown"

    if "multipart" in content_type:
        form = await request.form()
        audio_file = form.get("audio")
        caller_phone = str(form.get("caller_phone", "") or "")
        if not isinstance(audio_file, UploadFile):
            raise HTTPException(status_code=400, detail="multipart 请求需要 audio 字段")
        audio_bytes = await audio_file.read()
        transcript = _asr_from_file(audio_bytes, audio_file.filename or "audio.wav")
        mode = "file_asr"
        if not transcript:
            raise HTTPException(status_code=502, detail="ASR 转写失败，请检查 RAGflow 服务")
    else:
        body_json = await request.json() if (await request.body()) else {}
        try:
            body = VoiceProcessJSONRequest(**body_json)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        caller_phone = body.caller_phone
        if body.transcript:
            transcript = body.transcript
            mode = "text"
        elif body.audio_url:
            try:
                r = _requests.get(body.audio_url, timeout=30)
                r.raise_for_status()
                fname = body.audio_url.split("/")[-1] or "audio.wav"
                transcript = _asr_from_file(r.content, fname)
                mode = "url_asr"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"下载音频失败: {e}") from e
            if not transcript:
                raise HTTPException(status_code=502, detail="ASR 转写失败")

    if not transcript.strip():
        raise HTTPException(status_code=400, detail="transcript 为空")

    logger.info(
        "voice/process mode=%s caller=%s transcript_len=%d",
        mode, caller_phone or "-", len(transcript),
    )
    result = _run_voice_flow(transcript, caller_phone)
    result["mode"] = mode
    result["caller_phone"] = caller_phone

    # 与旧 Flask 行为对齐：error 时返回 500，但 FastAPI 用 HTTPException 抛
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error") or "voice flow failed")

    return VoiceProcessResponse(**result)


@router.get("/health", response_model=StatusResponse)
def api_voice_health() -> StatusResponse:
    return StatusResponse(status="ok")


@router.get("/sessions", response_model=VoiceSessionsResponse)
def api_voice_sessions(
    _: CurrentUser = Depends(get_current_user),
) -> VoiceSessionsResponse:
    """列出最近的语音获客 run 记录。"""
    from src.step_log import list_runs

    try:
        runs = list_runs()
    except Exception as e:
        return VoiceSessionsResponse(sessions=[], error=str(e))

    voice_runs = [
        r for r in runs if getattr(r, "flow_name", "") == "语音获客销售Flow"
    ]
    sessions = [
        VoiceSession(
            run_id=r.run_id,
            created_at=getattr(r, "created_at", "") or "",
            status=getattr(r, "status", "unknown") or "unknown",
            step_count=len(getattr(r, "steps", []) or []),
        )
        for r in voice_runs[:20]
    ]
    return VoiceSessionsResponse(sessions=sessions)
