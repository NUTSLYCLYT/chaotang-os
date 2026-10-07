from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send, interrupt

from .models import GraphRunSnapshot, GraphRunStatus, NodeFailureClass
from .persistence import SQLiteGraphStore


class GraphState(TypedDict, total=False):
    data: dict[str, Any]
    current_node: str | None
    fan_out: list[str]


@dataclass(frozen=True)
class NodeResult:
    state: dict[str, Any]
    next_node: str | None = None
    interrupt_payload: dict[str, Any] | None = None
    fan_out: tuple[str, ...] = ()
    join_node: str | None = None
    failure_class: NodeFailureClass | None = None
    failure_reason: str | None = None


NodeHandler = Callable[[dict[str, Any]], NodeResult]


@dataclass(frozen=True)
class GraphDefinition:
    start: str
    terminal: str
    nodes: dict[str, NodeHandler]

    def __post_init__(self) -> None:
        if self.start not in self.nodes or self.terminal not in self.nodes:
            raise ValueError("graph start and terminal must be defined nodes")
        if not self.nodes:
            raise ValueError("graph must contain nodes")


class DurableGraphRunner:
    def __init__(self, store: SQLiteGraphStore, definition: GraphDefinition) -> None:
        self.store = store
        self.definition = definition

    def run(self, run_id: str, owner_user_id: str) -> GraphRunSnapshot:
        snapshot = self.store.load_run(run_id, owner_user_id)
        if snapshot.status in {
            GraphRunStatus.SUCCEEDED,
            GraphRunStatus.FAILED,
            GraphRunStatus.CANCELLED,
            GraphRunStatus.WAITING_HUMAN,
        }:
            return snapshot
        current = snapshot.current_node
        state = deepcopy(snapshot.state)
        while current:
            handler = self.definition.nodes.get(current)
            if handler is None:
                raise ValueError(f"unknown graph node: {current}")
            try:
                outcome = handler(deepcopy(state))
            except Exception:
                return self.store.mark_failed(run_id, owner_user_id, reason="NODE_ERROR")
            if outcome.failure_class is not None:
                return self.store.mark_failed(
                    run_id,
                    owner_user_id,
                    reason=outcome.failure_reason or outcome.failure_class.value,
                )
            if outcome.interrupt_payload is not None:
                return self.store.interrupt(
                    run_id, owner_user_id, payload=outcome.interrupt_payload
                )
            state = deepcopy(outcome.state)
            if outcome.fan_out:
                if not outcome.join_node or outcome.join_node not in self.definition.nodes:
                    raise ValueError("fan-out requires a known join node")
                branch_states = []
                for branch in outcome.fan_out:
                    branch_handler = self.definition.nodes.get(branch)
                    if branch_handler is None:
                        raise ValueError(f"unknown fan-out node: {branch}")
                    try:
                        branch_outcome = branch_handler(deepcopy(state))
                    except Exception:
                        return self.store.mark_failed(run_id, owner_user_id, reason="NODE_ERROR")
                    if branch_outcome.failure_class is not None:
                        return self.store.mark_failed(
                            run_id,
                            owner_user_id,
                            reason=branch_outcome.failure_reason
                            or branch_outcome.failure_class.value,
                        )
                    if branch_outcome.interrupt_payload is not None or branch_outcome.fan_out:
                        raise ValueError("fan-out branches must be deterministic leaf nodes")
                    branch_states.append(
                        {"branch": branch, "state": deepcopy(branch_outcome.state)}
                    )
                    snapshot = self.store.append_checkpoint(
                        run_id,
                        owner_user_id,
                        node_name=branch,
                        state=branch_outcome.state,
                        idempotency_key=f"{run_id}:{snapshot.revision}:{current}:{branch}",
                    )
                state = {**state, "_fan_in": branch_states}
                snapshot = self.store.append_checkpoint(
                    run_id,
                    owner_user_id,
                    node_name=outcome.join_node,
                    state=state,
                    idempotency_key=f"{run_id}:{snapshot.revision}:{current}:join",
                )
                current = outcome.join_node
                continue
            next_node = outcome.next_node
            snapshot = self.store.append_checkpoint(
                run_id,
                owner_user_id,
                node_name=next_node or self.definition.terminal,
                state=state,
                idempotency_key=f"{run_id}:{snapshot.revision}:{current}",
            )
            if next_node is None:
                return self.store.mark_succeeded(run_id, owner_user_id)
            current = next_node
        return snapshot


def build_langgraph(definition: GraphDefinition):
    builder = StateGraph(GraphState)

    def wrapper(name: str):
        def run(state: GraphState) -> dict[str, Any]:
            outcome = definition.nodes[name](deepcopy(state.get("data", {})))
            if outcome.interrupt_payload is not None:
                interrupt(outcome.interrupt_payload)
            return {
                "data": deepcopy(outcome.state),
                "current_node": outcome.next_node,
                "fan_out": list(outcome.fan_out),
            }

        return run

    for name in definition.nodes:
        builder.add_node(name, wrapper(name))
    builder.add_edge(START, definition.start)
    for name in definition.nodes:
        mapping = {target: target for target in definition.nodes}
        mapping["__end__"] = END

        def route(state: GraphState):
            fan_out = state.get("fan_out") or []
            if fan_out:
                return [
                    Send(
                        target,
                        {"data": state.get("data", {}), "current_node": target, "fan_out": []},
                    )
                    for target in fan_out
                ]
            return state.get("current_node") or "__end__"

        builder.add_conditional_edges(name, route, mapping)
    return builder.compile()
