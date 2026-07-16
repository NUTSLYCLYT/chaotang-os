"""Explicit state type for the minimal LangGraph runtime example."""

from __future__ import annotations

from typing import TypedDict


class GraphState(TypedDict):
    """State shared across the minimal deterministic graph.

    Attributes:
        input_text: Raw input text supplied by the caller.
        steps: Ordered list of node names that have run, for traceability.
        output_text: Latest transformed text produced by the graph.
    """

    input_text: str
    steps: list[str]
    output_text: str
