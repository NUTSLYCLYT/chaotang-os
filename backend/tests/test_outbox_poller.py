"""The reliable outbox has an in-process recovery trigger in production."""

from __future__ import annotations

from threading import Event


def test_poller_runs_immediately_and_stops_cleanly() -> None:
    from src.execution.decree_dispatcher import OutboxPoller

    called = Event()
    poller = OutboxPoller(interval_seconds=60, poll_once=called.set)

    poller.start()
    assert called.wait(timeout=2)
    poller.stop(timeout=2)

    assert not poller.is_alive()


def test_test_schema_mode_disables_background_poller(monkeypatch) -> None:
    from src.execution.decree_dispatcher import start_outbox_poller

    monkeypatch.setenv("FENGQUN_SCHEMA_MODE", "test")

    assert start_outbox_poller() is None
