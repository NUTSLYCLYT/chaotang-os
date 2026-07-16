"""Public interface for the LangGraph runtime foundation module.

Only ``build_minimal_graph`` and ``GraphState`` are exported. Callers do not
need to know about the internal node functions or graph wiring.
"""

from app.langgraph_runtime.graph import build_minimal_graph
from app.langgraph_runtime.state import GraphState

__all__ = ["GraphState", "build_minimal_graph"]
