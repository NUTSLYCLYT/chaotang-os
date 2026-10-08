from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.decree_jobs.models import DecreeJob
from app.decree_jobs.storage import DecreeJobStore

from .graph import DurableGraphRunner, GraphDefinition
from .models import GraphRunSnapshot, GraphRunStatus
from .persistence import GraphRunNotFound, SQLiteGraphStore

if TYPE_CHECKING:
    from app.decree_jobs.worker import DecreeJobControl


@dataclass(frozen=True)
class DecreeJobGraphAdapter:
    """Bridge one decree-job lease to one durable graph run.

    The adapter deliberately does not start a second worker or lease loop. The
    caller's :class:`DecreeJobControl` remains the authority for cancellation,
    deadline and lease-loss checks.
    """

    jobs: DecreeJobStore
    definition: GraphDefinition | None
    graph_version: str

    def __post_init__(self) -> None:
        if not self.graph_version.strip():
            raise ValueError("graph_version is required")

    @property
    def graph_store(self) -> SQLiteGraphStore:
        return SQLiteGraphStore(self.jobs.db_path)

    @staticmethod
    def run_id(job: DecreeJob) -> str:
        return f"decree-job:{job.job_id}"

    def ensure_run(
        self, job: DecreeJob, *, initial_state: dict[str, object] | None = None
    ) -> GraphRunSnapshot:
        if self.definition is None:
            raise ValueError("graph definition is required")
        store = self.graph_store
        run_id = self.run_id(job)
        try:
            return store.load_run(run_id, job.owner_user_id)
        except GraphRunNotFound:
            try:
                return store.create_run(
                    job.owner_user_id,
                    graph_version=self.graph_version,
                    initial_state=initial_state or {},
                    start_node=self.definition.start,
                    run_id=run_id,
                )
            except sqlite3.IntegrityError:
                # Another worker won the create race; reload the owner-scoped
                # run instead of creating a second execution lineage.
                return store.load_run(run_id, job.owner_user_id)

    def advance(
        self,
        job: DecreeJob,
        control: DecreeJobControl,
        *,
        initial_state: dict[str, object] | None = None,
    ) -> GraphRunSnapshot:
        control.raise_if_cancelled()
        if self.definition is None:
            raise ValueError("graph definition is required")
        snapshot = self.ensure_run(job, initial_state=initial_state)
        if snapshot.status in {
            GraphRunStatus.SUCCEEDED,
            GraphRunStatus.FAILED,
            GraphRunStatus.CANCELLED,
            GraphRunStatus.WAITING_HUMAN,
        }:
            return snapshot
        result = DurableGraphRunner(self.graph_store, self.definition).run(
            snapshot.run_id, job.owner_user_id
        )
        control.raise_if_cancelled()
        return result

    def resume(self, job: DecreeJob, resume_token: str, expected_revision: int) -> GraphRunSnapshot:
        if not resume_token.strip():
            raise ValueError("resume_token is required")
        return self.graph_store.resume(
            self.run_id(job),
            job.owner_user_id,
            resume_token,
            expected_revision,
        )

    def summary(self, job: DecreeJob) -> GraphRunSnapshot:
        return self.graph_store.load_run(self.run_id(job), job.owner_user_id)
