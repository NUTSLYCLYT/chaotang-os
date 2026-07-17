"""Business HTTP API routers.

This package is independent of ``app.langgraph_runtime`` and
``app.agents``: it is the thin HTTP contract layer that wires a business
LangGraph agent (e.g. ``app.agents.chancellor``) to a versioned FastAPI
route. Routers defined here are included onto the shared ``app`` instance
from ``app.main`` via ``app.include_router(...)``; ``GET /health`` and the
``app.health`` module are not touched by anything in this package.
"""

from __future__ import annotations
