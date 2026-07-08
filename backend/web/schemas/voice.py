"""语音获客接口 schema。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class VoiceProcessJSONRequest(BaseModel):
    """JSON 模式入参（模式 A: transcript / 模式 B: audio_url）。"""
    transcript: str | None = None
    audio_url: str | None = None
    caller_phone: str = ""

    @model_validator(mode="after")
    def _xor_check(self):
        if not self.transcript and not self.audio_url:
            raise ValueError("transcript 或 audio_url 必须提供其一")
        return self


class VoiceAction(BaseModel):
    type: str
    tool: str = ""
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | list[Any] | str = Field(default_factory=dict)
    draft_id: str | None = None
    status: str | None = None


class VoiceProcessResponse(BaseModel):
    run_id: str = ""
    status: str
    output: dict[str, Any] = Field(default_factory=dict)
    actions: list[VoiceAction] = Field(default_factory=list)
    duration_ms: int = 0
    mode: str = ""
    caller_phone: str = ""
    error: str | None = None


class VoiceSession(BaseModel):
    run_id: str
    created_at: str = ""
    status: str = "unknown"
    step_count: int = 0


class VoiceSessionsResponse(BaseModel):
    sessions: list[VoiceSession]
    error: str | None = None
