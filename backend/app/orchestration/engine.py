from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.orchestration.contracts import (
    EngineKind,
    ExecutionPlan,
    ExecutionResumeGuard,
    ExecutionTrace,
    OrchestrationRequest,
    ResumeRequest,
)


@runtime_checkable
class OrchestrationEngine(Protocol):
    """Framework-neutral port implemented by one orchestration adapter."""

    @property
    def kind(self) -> EngineKind: ...

    @property
    def version(self) -> str: ...

    def plan(self, request: OrchestrationRequest) -> ExecutionPlan: ...

    def execute(
        self,
        request: OrchestrationRequest,
        plan: ExecutionPlan,
    ) -> ExecutionTrace: ...

    def resume(self, request: ResumeRequest) -> ExecutionResumeGuard: ...
