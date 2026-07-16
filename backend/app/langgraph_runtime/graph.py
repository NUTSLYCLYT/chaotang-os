"""Minimal deterministic LangGraph graph: START -> normalize -> transform -> END.

This module intentionally stays free of any network, LLM, LangSmith or
persistence dependency. Each node is a pure function that reads the incoming
state and returns a newly built partial-state dict (never mutating the
input's ``list``/``dict`` in place), so that repeated ``invoke()`` calls on
the same compiled graph never leak state between calls.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.langgraph_runtime.state import GraphState


def _normalize(state: GraphState) -> dict:
    """Strip surrounding whitespace and lower-case the input text."""
    normalized = state["input_text"].strip().lower()
    return {"output_text": normalized, "steps": [*state["steps"], "normalize"]}


def _transform(state: GraphState) -> dict:
    """Prefix the normalized text to prove a second, independent node ran."""
    transformed = f"processed:{state['output_text']}"
    return {"output_text": transformed, "steps": [*state["steps"], "transform"]}


def build_minimal_graph() -> CompiledStateGraph:
    """Build and compile the minimal ``START -> normalize -> transform -> END`` graph.

    Returns a compiled, callable graph object. Callers only need
    ``build_minimal_graph().invoke(initial_state)``; they do not need to know
    about the node/edge wiring defined here.
    """
    builder = StateGraph(GraphState)
    builder.add_node("normalize", _normalize)
    builder.add_node("transform", _transform)
    builder.add_edge(START, "normalize")
    builder.add_edge("normalize", "transform")
    builder.add_edge("transform", END)
    return builder.compile()
