"""Optional process-wide fail-closed budget for real provider attempts."""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from threading import Lock
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.observability.taxonomy import AuditEvent


class AttemptBudget(Protocol):
    def reserve(self) -> None: ...


class ProviderBudgetExceeded(RuntimeError):
    """Raised before a provider request when the configured budget is spent."""

    def __init__(self, *, attempts_used: int, max_attempts: int) -> None:
        super().__init__("Provider attempt budget exhausted.")
        self.safe_metadata = {
            "attempts_used": attempts_used,
            "max_attempts": max_attempts,
        }

    def to_audit_event(self, *, job_id: str | None = None) -> AuditEvent:
        """Canonical HV-44 audit event for this fail-closed rejection.

        ``safe_metadata`` keeps its exact key set; this method only adds a
        sanitized, self-describing view so callers no longer have to re-derive
        the failure vocabulary from string literals.
        """
        from app.observability.taxonomy import build_budget_exhausted_event

        return build_budget_exhausted_event(
            attempts_used=self.safe_metadata["attempts_used"],
            max_attempts=self.safe_metadata["max_attempts"],
            job_id=job_id,
        )


class ProviderAttemptBudget:
    """Lock-protected reservation counter shared by all provider clients."""

    def __init__(self, *, max_attempts: int) -> None:
        if type(max_attempts) is not int or max_attempts <= 0:
            raise ValueError("max_attempts must be a positive integer")
        self._max_attempts = max_attempts
        self._attempts_used = 0
        self._lock = Lock()

    @property
    def max_attempts(self) -> int:
        return self._max_attempts

    @property
    def attempts_used(self) -> int:
        with self._lock:
            return self._attempts_used

    def reserve(self) -> None:
        """Atomically reserve one attempt or fail before network I/O."""
        with self._lock:
            if self._attempts_used >= self._max_attempts:
                raise ProviderBudgetExceeded(
                    attempts_used=self._attempts_used,
                    max_attempts=self._max_attempts,
                )
            self._attempts_used += 1


_CONFIGURATION_LOCK = Lock()
_PROCESS_BUDGET: ProviderAttemptBudget | None = None
_CONTEXT_BUDGET: ContextVar[AttemptBudget | None] = ContextVar(
    "provider_attempt_budget", default=None
)
_TASK_TOKEN_BUDGET: ContextVar[object | None] = ContextVar(
    "task_token_budget", default=None
)


class _CombinedAttemptBudget:
    def __init__(self, process: AttemptBudget, contextual: AttemptBudget) -> None:
        self._process = process
        self._contextual = contextual

    def reserve(self) -> None:
        self._process.reserve()
        self._contextual.reserve()


def configure_provider_attempt_budget(
    max_attempts: int | None,
) -> ProviderAttemptBudget | None:
    """Configure the process budget without resetting a matching counter."""
    global _PROCESS_BUDGET
    with _CONFIGURATION_LOCK:
        if (
            (_PROCESS_BUDGET is None and max_attempts is None)
            or (
                _PROCESS_BUDGET is not None
                and max_attempts == _PROCESS_BUDGET.max_attempts
            )
        ):
            return _PROCESS_BUDGET
        _PROCESS_BUDGET = (
            None
            if max_attempts is None
            else ProviderAttemptBudget(max_attempts=max_attempts)
        )
        return _PROCESS_BUDGET


def configure_provider_attempt_budget_from_environment() -> ProviderAttemptBudget | None:
    """Apply the process budget environment once without resetting a matching counter."""
    raw_value = os.environ.get("CHAOTANG_PROVIDER_ATTEMPT_BUDGET")
    if raw_value is None:
        max_attempts = None
    else:
        try:
            max_attempts = int(raw_value)
        except ValueError as exc:
            raise RuntimeError("Invalid provider attempt budget configuration.") from exc
        if max_attempts <= 0:
            raise RuntimeError("Invalid provider attempt budget configuration.")

    return configure_provider_attempt_budget(max_attempts)


def get_provider_attempt_budget() -> AttemptBudget | None:
    """Return the contextual budget combined with the process hard cap."""
    contextual = _CONTEXT_BUDGET.get()
    with _CONFIGURATION_LOCK:
        process = _PROCESS_BUDGET
    if contextual is None:
        return process
    if process is None or process is contextual:
        return contextual
    return _CombinedAttemptBudget(process, contextual)


@contextmanager
def use_provider_attempt_budget(budget: AttemptBudget) -> Iterator[None]:
    token = _CONTEXT_BUDGET.set(budget)
    try:
        yield
    finally:
        _CONTEXT_BUDGET.reset(token)


def get_task_token_budget():
    """Return the task-scoped token ledger bound to the current execution.

    The context is intentionally untyped at runtime to keep this low-level
    module independent from ``app.fusion``.  Only the execution worker may
    install a ledger; direct model construction and offline tests remain
    unchanged and therefore cannot accidentally spend a product budget.
    """

    return _TASK_TOKEN_BUDGET.get()


@contextmanager
def use_task_token_budget(budget) -> Iterator[None]:
    """Bind one durable token ledger to all provider calls in this task."""

    token = _TASK_TOKEN_BUDGET.set(budget)
    try:
        yield
    finally:
        _TASK_TOKEN_BUDGET.reset(token)
