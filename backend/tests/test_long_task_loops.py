from datetime import UTC, datetime, timedelta

from app.long_task_graph.loops import LoopStep, run_bounded_loop
from app.long_task_graph.models import LoopPolicy, LoopStopReason


def test_loop_stops_when_step_is_ready() -> None:
    calls = []

    def step(context):
        calls.append(context.iteration)
        return LoopStep(done=context.iteration == 2, tokens_used=10, provider_requests=1)

    result = run_bounded_loop(
        step,
        LoopPolicy(max_iterations=4, max_provider_requests=8, max_tokens=100),
    )
    assert result.stop_reason is LoopStopReason.READY
    assert result.iterations == 2
    assert calls == [1, 2]


def test_loop_enforces_provider_and_token_budgets() -> None:
    result = run_bounded_loop(
        lambda _context: LoopStep(done=False, tokens_used=30, provider_requests=2),
        LoopPolicy(max_iterations=10, max_provider_requests=3, max_tokens=100),
    )
    assert result.stop_reason is LoopStopReason.PROVIDER_BUDGET_EXCEEDED
    assert result.iterations == 2


def test_loop_enforces_deadline_before_next_iteration() -> None:
    now = datetime(2026, 10, 8, tzinfo=UTC)
    result = run_bounded_loop(
        lambda _context: LoopStep(done=False, tokens_used=1, provider_requests=1),
        LoopPolicy(
            max_iterations=10,
            max_provider_requests=10,
            max_tokens=100,
            deadline_at=now + timedelta(seconds=1),
        ),
        clock=lambda: now + timedelta(seconds=2),
    )
    assert result.stop_reason is LoopStopReason.DEADLINE_EXCEEDED
    assert result.iterations == 0
