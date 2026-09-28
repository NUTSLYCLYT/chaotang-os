"""Durable reservation cap shared by consultation, jobs and Harness children."""

import sqlite3
from contextlib import closing, contextmanager
from pathlib import Path

from app.langgraph_runtime.provider_budget import ProviderBudgetExceeded


class PersistentProviderBudget:
    def __init__(self, path: Path, *, max_attempts: int):
        if type(max_attempts) is not int or not 0 < max_attempts <= 100:
            raise ValueError("fusion budget must be between 1 and 100")
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.max_attempts = max_attempts
        with self._connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS budget (id INTEGER PRIMARY KEY CHECK(id=1), "
                "cap INTEGER NOT NULL, used INTEGER NOT NULL)"
            )
            db.execute("INSERT OR IGNORE INTO budget VALUES (1, ?, 0)", (max_attempts,))
            if db.execute("SELECT cap FROM budget WHERE id=1").fetchone()[0] != max_attempts:
                raise ValueError("existing budget cap is immutable")

    @contextmanager
    def _connect(self):
        with closing(sqlite3.connect(self.path, timeout=15)) as db, db:
            yield db

    @property
    def attempts_used(self):
        with self._connect() as db:
            return db.execute("SELECT used FROM budget WHERE id=1").fetchone()[0]

    def reserve(self):
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            changed = db.execute("UPDATE budget SET used=used+1 WHERE id=1 AND used<cap").rowcount
            if not changed:
                used = db.execute("SELECT used FROM budget WHERE id=1").fetchone()[0]
                raise ProviderBudgetExceeded(attempts_used=used, max_attempts=self.max_attempts)

    def for_task(self, *, owner_id: str, task_id: str, max_tokens: int | None = None):
        """Use the existing budget database for task-scoped token reservations.

        New tasks use the current default; omitted limits reopen the stored cap.
        Explicit limits may never change an existing task's committed cap.
        Internal API only: callers must use authenticated, approved job identity.
        This ledger does not grant model access or supply a provider tokenizer.
        """
        from app.fusion.task_token_budget import TaskTokenBudget

        return TaskTokenBudget(
            self.path,
            owner_id=owner_id,
            task_id=task_id,
            max_tokens=max_tokens,
        )

    def for_decree_job(self, store, *, owner_id: str, job_id: str, max_tokens: int | None = None):
        """Bind accounting to the owned retry root in the existing job store.

        Internal callers must still validate execution authority and an active
        attempt. A job binding or token ledger alone cannot permit model calls.
        """
        root_id = store.resolve_budget_root(job_id, owner_id)
        return self.for_task(owner_id=owner_id, task_id=root_id, max_tokens=max_tokens)
