"""Business-facing LangGraph agents.

This package is independent of ``app.langgraph_runtime``: agents defined
here are dedicated, business-specific graphs (e.g. the Chancellor agent in
``app.agents.chancellor``), not the general-purpose runtime foundation or
DeepSeek demo graph. Nothing in ``app.langgraph_runtime.graph``/``state.py``
is modified or reused here, and this package does not call
``build_deepseek_graph()`` directly -- only the read-only configuration/
client helpers (``load_deepseek_provider_config``, ``build_deepseek_chat_model``)
are reused.
"""

from __future__ import annotations
