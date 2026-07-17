"""Public interface for the Chancellor (丞相) LangGraph agent.

This is a dedicated, business-specific graph independent of
``app.langgraph_runtime`` -- it does not modify or reuse
``app.langgraph_runtime.graph``/``state.py``, and it does not call
``build_deepseek_graph()`` directly. It only reuses the read-only
configuration/client helpers ``load_deepseek_provider_config`` and
``build_deepseek_chat_model`` from ``app.langgraph_runtime``.
"""

from app.agents.chancellor.graph import (
    ChancellorGraphInvocationError,
    ChancellorGraphState,
    build_chancellor_graph,
)
from app.agents.chancellor.prompts import CHANCELLOR_IDENTITY, CHANCELLOR_SYSTEM_PROMPT

__all__ = [
    "CHANCELLOR_IDENTITY",
    "CHANCELLOR_SYSTEM_PROMPT",
    "ChancellorGraphInvocationError",
    "ChancellorGraphState",
    "build_chancellor_graph",
]
