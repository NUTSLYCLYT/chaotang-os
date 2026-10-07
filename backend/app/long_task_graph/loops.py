from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from .models import LoopPolicy, LoopStopReason


@dataclass(frozen=True)
class LoopContext:
    iteration: int
    provider_requests: int
    tokens: int


@dataclass(frozen=True)
class LoopStep:
    done: bool
    tokens_used: int = 0
    provider_requests: int = 0
    stop_reason: LoopStopReason | None = None

    def __post_init__(self) -> None:
        if self.tokens_used < 0 or self.provider_requests < 0:
            raise ValueError("loop usage cannot be negative")


@dataclass(frozen=True)
class LoopResult:
    stop_reason: LoopStopReason
    iterations: int
    provider_requests: int
    tokens: int


def run_bounded_loop(
    step: Callable[[LoopContext], LoopStep],
    policy: LoopPolicy,
    *,
    clock: Callable[[], datetime] | None = None,
) -> LoopResult:
    now = clock or (lambda: datetime.now(UTC))
    iterations = provider_requests = tokens = 0
    while iterations < policy.max_iterations:
        if policy.deadline_at is not None and now() >= policy.deadline_at:
            return LoopResult(
                LoopStopReason.DEADLINE_EXCEEDED, iterations, provider_requests, tokens
            )
        if provider_requests >= policy.max_provider_requests:
            return LoopResult(
                LoopStopReason.PROVIDER_BUDGET_EXCEEDED, iterations, provider_requests, tokens
            )
        if tokens >= policy.max_tokens:
            return LoopResult(
                LoopStopReason.TOKEN_BUDGET_EXCEEDED, iterations, provider_requests, tokens
            )
        iterations += 1
        step_result = step(LoopContext(iterations, provider_requests, tokens))
        provider_requests += step_result.provider_requests
        tokens += step_result.tokens_used
        if provider_requests > policy.max_provider_requests:
            return LoopResult(
                LoopStopReason.PROVIDER_BUDGET_EXCEEDED, iterations, provider_requests, tokens
            )
        if tokens > policy.max_tokens:
            return LoopResult(
                LoopStopReason.TOKEN_BUDGET_EXCEEDED, iterations, provider_requests, tokens
            )
        if step_result.done:
            return LoopResult(LoopStopReason.READY, iterations, provider_requests, tokens)
        if step_result.stop_reason is not None:
            return LoopResult(step_result.stop_reason, iterations, provider_requests, tokens)
    return LoopResult(LoopStopReason.MAX_ITERATIONS, iterations, provider_requests, tokens)
