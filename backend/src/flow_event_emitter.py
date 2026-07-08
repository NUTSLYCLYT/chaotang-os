"""FlowEngine 事件发射器接口。

用于将 FlowEngine 的执行事件推送到 WebSocket Gateway。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Callable


@dataclass
class FlowEvent:
    type: str
    run_id: str
    step_id: str | None = None
    step_index: int | None = None
    agent_name: str | None = None
    timestamp: str | None = None
    payload: dict | None = None

    def to_dict(self) -> dict:
        d = {"type": self.type, "run_id": self.run_id}
        if self.step_id:
            d["step_id"] = self.step_id
        if self.step_index is not None:
            d["step_index"] = self.step_index
        if self.agent_name:
            d["agent_name"] = self.agent_name
        if self.timestamp:
            d["timestamp"] = self.timestamp
        if self.payload:
            d.update(self.payload)
        return d


class FlowEventEmitter:
    def __init__(self, run_id: str, emit_fn: Callable[[FlowEvent], None]):
        self.run_id = run_id
        self.emit_fn = emit_fn
        self._current_step_id: str | None = None
        self._current_step_index: int | None = None
        self._current_agent_name: str | None = None

    def emit(self, event_type: str, payload: dict | None = None) -> None:
        event = FlowEvent(
            type=event_type,
            run_id=self.run_id,
            step_id=self._current_step_id,
            step_index=self._current_step_index,
            agent_name=self._current_agent_name,
            timestamp=datetime.now().astimezone().isoformat(),
            payload=payload,
        )
        self.emit_fn(event)

    def on_flow_start(self, total_steps: int, flow_name: str, step_ids: list[str]) -> None:
        self.emit("run:start", {
            "flow_name": flow_name,
            "total_steps": total_steps,
            "step_ids": step_ids,
        })

    def on_step_start(self, step_index: int, step_id: str, agent_name: str, model: str) -> None:
        self._current_step_id = step_id
        self._current_step_index = step_index
        self._current_agent_name = agent_name
        self.emit("step:start", {
            "model": model,
        })

    def on_step_thinking(self) -> None:
        self.emit("agent:state", {"state": "THINKING"})

    def on_tool_call(self, tool_name: str, args: dict, needs_approval: bool = False) -> None:
        self.emit("tool:call", {
            "tool_name": tool_name,
            "args": args,
            "needs_approval": needs_approval,
        })

    def on_tool_result(self, result: str, status: str = "success") -> None:
        self.emit("tool:result", {
            "status": status,
            "result_preview": result[:500] if result else None,
        })

    def on_waiting_user(self, question: str, options: list[str] | None = None) -> None:
        self.emit("waiting:user", {
            "question": question,
            "options": options,
        })

    def on_agent_message(self, content: str, is_chunk: bool = False) -> None:
        self.emit("agent:message", {
            "content": content,
            "is_chunk": is_chunk,
        })

    def on_step_done(self, step_index: int, total_steps: int, agent_name: str,
                     duration: float, status: str, output_preview: str) -> None:
        self.emit("step:complete", {
            "total_steps": total_steps,
            "duration": duration,
            "status": status,
            "output_preview": output_preview[:300] if output_preview else None,
        })

    def on_flow_complete(self, status: str, quality_score: float | None = None) -> None:
        self.emit("run:complete", {
            "status": status,
            "quality_score": quality_score,
        })

    def on_error(self, error_type: str, message: str, traceback: str | None = None) -> None:
        self.emit("error", {
            "error_type": error_type,
            "message": message,
            "traceback": traceback,
        })
