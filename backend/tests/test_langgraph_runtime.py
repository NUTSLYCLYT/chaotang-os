"""Tests for the minimal LangGraph runtime foundation (``app.langgraph_runtime``).

These tests exercise the real, installed LangGraph package end to end (real
``StateGraph.compile()``, real ``CompiledStateGraph.invoke()`` and real
``.get_graph()`` introspection). Nothing about LangGraph itself is mocked or
stubbed: mocking it out would only prove the test harness works, not that the
runtime module actually integrates with LangGraph.

The test process also does not set any LangSmith/model-provider environment
variables (``LANGCHAIN_TRACING_V2``, ``LANGSMITH_API_KEY``, ``OPENAI_API_KEY``,
etc.) and never performs network I/O, so a passing run here is itself evidence
that the graph is usable in a no-network/no-key/no-LLM/no-database environment.
"""

from __future__ import annotations

import os
from importlib.metadata import version

from langgraph.graph.state import CompiledStateGraph

from app.langgraph_runtime import GraphState, build_minimal_graph


def test_no_langsmith_or_model_provider_env_vars_are_set():
    """Guard the "no network/keys/LLM" claim made by the other assertions here.

    If a developer's shell happened to export LangSmith tracing or a model
    provider API key, the other tests in this module could still pass while
    silently no longer proving what they claim to prove. Failing loudly here
    makes that assumption explicit and checked, rather than just asserted in
    a comment.
    """
    tracing_and_key_vars = [
        "LANGCHAIN_TRACING_V2",
        "LANGCHAIN_API_KEY",
        "LANGSMITH_API_KEY",
        "LANGSMITH_TRACING",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
    ]
    present = [name for name in tracing_and_key_vars if os.environ.get(name)]
    assert present == []


def test_langgraph_version_is_visible_and_non_empty():
    """AC1: developers can confirm the actually installed LangGraph version."""
    installed_version = version("langgraph")
    assert isinstance(installed_version, str)
    assert installed_version != ""
    # Sanity-check it looks like a dotted version number, not an empty/garbage
    # string that would still pass a bare truthiness check.
    assert installed_version[0].isdigit()
    assert installed_version.count(".") >= 1


def test_build_minimal_graph_returns_a_real_compiled_state_graph():
    """AC2/AC4: the factory returns LangGraph's own compiled graph type.

    Uses ``isinstance`` against LangGraph's real ``CompiledStateGraph`` class
    (not a duck-typed check), so this fails if ``build_minimal_graph`` ever
    stops using the official ``StateGraph``/``compile()`` API.
    """
    graph = build_minimal_graph()
    assert isinstance(graph, CompiledStateGraph)


def test_compiled_graph_structure_matches_expected_linear_topology():
    """AC2: the compiled graph is a real multi-node LangGraph graph.

    Inspects LangGraph's own ``get_graph().nodes`` (not an internal
    implementation detail of this module), proving the graph really was built
    with ``START``/``END``/``add_node``/``add_edge`` and compiled by
    LangGraph itself, rather than e.g. a plain Python function that merely
    mimics the public interface.
    """
    graph = build_minimal_graph()
    node_ids = set(graph.get_graph().nodes)
    assert node_ids == {"__start__", "normalize", "transform", "__end__"}


def test_invoke_with_deterministic_input_returns_exact_expected_state():
    """AC3: a deterministic input produces a precisely assertable final state."""
    graph = build_minimal_graph()
    initial_state: GraphState = {
        "input_text": "  Hello World  ",
        "steps": [],
        "output_text": "",
    }

    result = graph.invoke(initial_state)

    assert result["output_text"] == "processed:hello world"
    assert result["steps"] == ["normalize", "transform"]
    assert result["input_text"] == "  Hello World  "


def test_repeated_invocations_on_same_compiled_graph_do_not_leak_state():
    """AC4: repeated calls on one compiled graph do not cross-contaminate.

    Runs two different inputs through the *same* compiled graph object and
    checks both that the two results are independently correct and that the
    ``steps`` list of the first result was not mutated by the second call.
    """
    graph = build_minimal_graph()

    first_result = graph.invoke({"input_text": "  First Run  ", "steps": [], "output_text": ""})
    second_result = graph.invoke({"input_text": "Second Run", "steps": [], "output_text": ""})

    assert first_result["output_text"] == "processed:first run"
    assert first_result["steps"] == ["normalize", "transform"]

    assert second_result["output_text"] == "processed:second run"
    assert second_result["steps"] == ["normalize", "transform"]

    # The two calls must not share the same mutable ``steps`` list instance;
    # otherwise a later invocation could silently corrupt an earlier caller's
    # already-returned result.
    assert first_result["steps"] is not second_result["steps"]
    # First result must still reflect its own run after the second call ran.
    assert first_result["output_text"] == "processed:first run"


def test_node_functions_do_not_mutate_the_caller_supplied_steps_list():
    """AC4: node functions must not mutate the input's mutable ``steps`` list.

    Keeps a reference to the exact ``list`` object passed in as
    ``initial_state["steps"]`` and asserts it is untouched after ``invoke()``
    returns, proving each node builds a new list (``[*state["steps"], ...]``)
    instead of appending in place. In-place mutation of shared input
    collections is exactly the kind of bug that would make state "leak"
    between callers who happen to reuse or alias a list.
    """
    graph = build_minimal_graph()
    caller_owned_steps: list[str] = []
    initial_state: GraphState = {
        "input_text": "mutation check",
        "steps": caller_owned_steps,
        "output_text": "",
    }

    result = graph.invoke(initial_state)

    assert caller_owned_steps == []
    assert result["steps"] == ["normalize", "transform"]
    assert result["steps"] is not caller_owned_steps
