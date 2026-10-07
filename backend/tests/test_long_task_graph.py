from __future__ import annotations

import pytest

from app.long_task_graph.graph import (
    DurableGraphRunner,
    GraphDefinition,
    NodeResult,
    build_langgraph,
)
from app.long_task_graph.models import (
    GraphRunStatus,
    NodeAttempt,
    NodeAttemptStatus,
    NodeFailureClass,
)
from app.long_task_graph.persistence import (
    GraphRunNotFound,
    SQLiteGraphStore,
)


def test_checkpoint_is_owner_scoped_and_idempotent(tmp_path) -> None:
    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")
    run = store.create_run("owner-a", graph_version="v1", initial_state={"value": 1})
    first = store.append_checkpoint(
        run.run_id,
        "owner-a",
        node_name="normalize",
        state={"value": 2},
        idempotency_key="run-a-normalize-1",
    )
    replay = store.append_checkpoint(
        run.run_id,
        "owner-a",
        node_name="normalize",
        state={"value": 999},
        idempotency_key="run-a-normalize-1",
    )
    assert replay == first
    assert store.load_run(run.run_id, "owner-a").state == {"value": 2}
    with pytest.raises(GraphRunNotFound):
        store.load_run(run.run_id, "owner-b")


def test_node_attempt_is_typed_and_requires_positive_attempt() -> None:
    attempt = NodeAttempt("run-1", "review", 1, NodeAttemptStatus.RUNNING, "review:1")
    assert attempt.status is NodeAttemptStatus.RUNNING
    with pytest.raises(ValueError, match="positive"):
        NodeAttempt("run-1", "review", 0, NodeAttemptStatus.RUNNING, "review:0")


def test_graph_runs_nodes_and_fan_in_with_durable_events(tmp_path) -> None:
    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")
    definition = GraphDefinition(
        start="start",
        terminal="done",
        nodes={
            "start": lambda state: NodeResult(
                {**state, "branches": ["finance", "risk"]}, next_node="finance"
            ),
            "finance": lambda state: NodeResult({**state, "finance": "ready"}, next_node="risk"),
            "risk": lambda state: NodeResult({**state, "risk": "ready"}, next_node="done"),
            "done": lambda state: NodeResult({**state, "joined": True}, next_node=None),
        },
    )
    run = store.create_run("owner-a", graph_version="v1", initial_state={})
    result = DurableGraphRunner(store, definition).run(run.run_id, "owner-a")
    assert result.status is GraphRunStatus.SUCCEEDED
    assert result.state["joined"] is True
    assert [event.event_type for event in store.list_events(run.run_id, "owner-a")] == [
        "RUN_CREATED",
        "CHECKPOINT",
        "CHECKPOINT",
        "CHECKPOINT",
        "CHECKPOINT",
        "RUN_SUCCEEDED",
    ]


def test_human_interrupt_requires_owner_and_versioned_resume(tmp_path) -> None:
    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")

    def review(state):
        if state.get("_resumed"):
            return NodeResult(state, next_node="done")
        return NodeResult(
            state,
            next_node="done",
            interrupt_payload={"kind": "DECISION_PACKET_REVIEW"},
        )

    definition = GraphDefinition(
        start="review",
        terminal="done",
        nodes={
            "review": review,
            "done": lambda state: NodeResult({**state, "approved": True}),
        },
    )
    run = store.create_run("owner-a", graph_version="v1", initial_state={}, start_node="review")
    waiting = DurableGraphRunner(store, definition).run(run.run_id, "owner-a")
    assert waiting.status is GraphRunStatus.WAITING_HUMAN
    assert waiting.resume_token
    with pytest.raises(GraphRunNotFound):
        store.resume(run.run_id, "owner-b", waiting.resume_token, waiting.revision)
    resumed = store.resume(run.run_id, "owner-a", waiting.resume_token, waiting.revision)
    assert resumed.status is GraphRunStatus.RUNNING
    final = DurableGraphRunner(store, definition).run(run.run_id, "owner-a")
    assert final.status is GraphRunStatus.SUCCEEDED
    assert final.state["approved"] is True


def test_langgraph_adapter_compiles_typed_graph() -> None:
    graph = build_langgraph(
        GraphDefinition(
            start="start",
            terminal="done",
            nodes={
                "start": lambda state: NodeResult(state, next_node="done"),
                "done": lambda state: NodeResult(state),
            },
        )
    )
    assert "start" in graph.get_graph().nodes
    assert "done" in graph.get_graph().nodes


def test_node_failure_is_terminal_and_persisted(tmp_path) -> None:
    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")
    definition = GraphDefinition(
        start="start",
        terminal="done",
        nodes={
            "start": lambda _state: NodeResult(
                {}, failure_class=NodeFailureClass.BLOCKED, failure_reason="MISSING_INPUT"
            ),
            "done": lambda state: NodeResult(state),
        },
    )
    run = store.create_run("owner-a", graph_version="v1", initial_state={})
    result = DurableGraphRunner(store, definition).run(run.run_id, "owner-a")
    assert result.status is GraphRunStatus.FAILED
    assert result.terminal_reason == "MISSING_INPUT"
    assert store.list_events(run.run_id, "owner-a")[-1].event_type == "RUN_FAILED"


def test_node_exception_is_recorded_as_stable_failure(tmp_path) -> None:
    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")

    def explode(_state):
        raise RuntimeError("opaque internal detail")

    definition = GraphDefinition(
        start="start",
        terminal="done",
        nodes={"start": explode, "done": lambda state: NodeResult(state)},
    )
    run = store.create_run("owner-a", graph_version="v1", initial_state={})
    result = DurableGraphRunner(store, definition).run(run.run_id, "owner-a")
    assert result.status is GraphRunStatus.FAILED
    assert result.terminal_reason == "NODE_ERROR"


def test_expired_resume_token_is_rejected(tmp_path) -> None:
    from datetime import timedelta

    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")
    run = store.create_run("owner-a", graph_version="v1", initial_state={})
    waiting = store.interrupt(
        run.run_id,
        "owner-a",
        payload={"kind": "HUMAN_REVIEW"},
        resume_ttl=timedelta(seconds=-1),
    )
    from app.long_task_graph.persistence import GraphResumeRejected

    with pytest.raises(GraphResumeRejected, match="expired"):
        store.resume(run.run_id, "owner-a", waiting.resume_token or "", waiting.revision)


def test_graph_fan_out_fan_in_is_checkpointed_deterministically(tmp_path) -> None:
    store = SQLiteGraphStore(tmp_path / "graph.sqlite3")
    definition = GraphDefinition(
        start="start",
        terminal="done",
        nodes={
            "start": lambda state: NodeResult(state, fan_out=("finance", "risk"), join_node="join"),
            "finance": lambda state: NodeResult({**state, "finance": "ready"}),
            "risk": lambda state: NodeResult({**state, "risk": "ready"}),
            "join": lambda state: NodeResult(
                {**state, "joined": len(state["_fan_in"]) == 2}, next_node="done"
            ),
            "done": lambda state: NodeResult(state),
        },
    )
    run = store.create_run("owner-a", graph_version="v1", initial_state={})
    result = DurableGraphRunner(store, definition).run(run.run_id, "owner-a")
    assert result.status is GraphRunStatus.SUCCEEDED
    assert result.state["joined"] is True
    assert [
        entry.payload["node"]
        for entry in store.list_events(run.run_id, "owner-a")
        if entry.event_type == "CHECKPOINT"
    ] == ["finance", "risk", "join", "done", "done"]
