"""Budget reads, writes and rejected operations release SQLite handles immediately."""

import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from app.fusion.budget import PersistentProviderBudget
from app.fusion.task_token_budget import TaskTokenBudgetError
from app.langgraph_runtime.provider_budget import ProviderBudgetExceeded


@pytest.mark.parametrize("operation", ["initialize", "read", "reserve", "exhaust", "mismatch"])
def test_budget_closes_connections_on_success_and_failure(tmp_path, monkeypatch, operation):
    opened = []
    closed = []
    connect = sqlite3.connect

    class Connection(sqlite3.Connection):
        def close(self):
            closed.append(self)
            super().close()

    def tracked(*args, **kwargs):
        connection = connect(*args, **kwargs, factory=Connection)
        opened.append(connection)  # Keep a reference: GC is not the close contract.
        return connection

    monkeypatch.setattr("app.fusion.budget.sqlite3.connect", tracked)
    path = tmp_path / "attempts.sqlite3"
    try:
        budget = PersistentProviderBudget(path, max_attempts=1)
        if operation == "read":
            assert budget.attempts_used == 0
        elif operation in {"reserve", "exhaust"}:
            budget.reserve()
            if operation == "exhaust":
                with pytest.raises(ProviderBudgetExceeded):
                    budget.reserve()
        elif operation == "mismatch":
            with pytest.raises(ValueError, match="immutable"):
                PersistentProviderBudget(path, max_attempts=2)
        assert len(opened) == len(closed)
        for connection in opened:
            with pytest.raises(sqlite3.ProgrammingError, match="closed"):
                connection.execute("SELECT 1")
    finally:
        for connection in opened:
            sqlite3.Connection.close(connection)

    # A fresh handle can read committed counters after all prior handles close.
    with connect(path) as db:
        assert db.execute("SELECT cap, used FROM budget").fetchone() == (
            1,
            1 if operation in {"reserve", "exhaust"} else 0,
        )
    db.close()


def test_fifty_thousand_budget_can_close_after_reopen_and_rejection(tmp_path):
    with TemporaryDirectory(dir=tmp_path) as folder:
        attempts = PersistentProviderBudget(Path(folder) / "budget.sqlite3", max_attempts=3)
        task = attempts.for_task(owner_id="owner", task_id="new")
        assert task.snapshot().limit_tokens == 50000
        task.reserve_tokens(
            attempt_id="one",
            request_id="r1",
            request_sha256="a" * 64,
            input_tokens=49000,
            max_output_tokens=1000,
        )
        with pytest.raises(TaskTokenBudgetError, match="task_token_budget_exhausted"):
            task.reserve_tokens(
                attempt_id="two",
                request_id="r2",
                request_sha256="b" * 64,
                input_tokens=1,
                max_output_tokens=1,
            )
        assert attempts.for_task(owner_id="owner", task_id="new").snapshot().available_tokens == 0
        attempts.for_task(owner_id="owner", task_id="old", max_tokens=20000)
        assert attempts.for_task(owner_id="owner", task_id="old").snapshot().limit_tokens == 20000
    assert not Path(folder).exists()
