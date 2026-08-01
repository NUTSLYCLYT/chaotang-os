from collections.abc import Callable
from typing import Protocol

from .agent import ChancellorRuntimeError


class InvokableGraph(Protocol):
    def invoke(self, payload: dict[str, object]) -> dict[str, object]: ...


class GraphSkillHandler:
    def __init__(self, graph_factory: Callable[[], InvokableGraph]) -> None:
        self._graph_factory = graph_factory

    def __call__(self, payload: dict[str, object]) -> dict[str, object]:
        result = self._graph_factory().invoke(payload)
        if not isinstance(result, dict):
            raise ChancellorRuntimeError("skill_result_invalid")
        return result
