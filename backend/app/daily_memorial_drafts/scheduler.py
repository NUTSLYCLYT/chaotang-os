
"""One-shot deployment scheduler orchestration for daily memorial drafts."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from app.auth.storage import list_user_ids_for_scheduled_jobs
from app.daily_memorial_drafts.facts import freeze_controlled_facts
from app.daily_memorial_drafts.models import RunStatus
from app.daily_memorial_drafts.storage import get_or_create_run
from app.daily_memorial_drafts.workflow import Invoker, advance_run


@dataclass(frozen=True, slots=True)
class SchedulerSummary:
    report_date: date
    owners_seen: int
    ready_for_review: int
    skipped_no_facts: int
    retry_wait: int
    failed: int
    model_calls: int


def run_due(
    *,
    report_date: date,
    now: datetime,
    invoker: Invoker,
    db_path: Path | None = None,
) -> SchedulerSummary:
    """Advance every server-owned target once, without sleeping or rescheduling."""

    if not isinstance(report_date, date) or isinstance(report_date, datetime):
        raise TypeError("report_date must be a date")
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")
    if not callable(invoker):
        raise TypeError("invoker must be callable")

    owners = list_user_ids_for_scheduled_jobs(db_path=db_path)
    ready_for_review = 0
    skipped_no_facts = 0
    retry_wait = 0
    failed = 0
    model_calls = 0

    def counted_invoker(stage, unit_key, prompt, response_model):
        nonlocal model_calls
        model_calls += 1
        return invoker(stage, unit_key, prompt, response_model)

    for owner_user_id in owners:
        run = get_or_create_run(
            owner_user_id,
            report_date,
            now=now,
            db_path=db_path,
        )
        facts = freeze_controlled_facts(
            owner_user_id,
            report_date,
            db_path=db_path,
        )
        if not facts:
            skipped_no_facts += 1
            continue
        if run.status in {RunStatus.PENDING, RunStatus.GENERATING}:
            run = advance_run(
                run.id,
                invoker=counted_invoker,
                now=now,
                db_path=db_path,
            )
        if run.status in {RunStatus.READY_FOR_REVIEW, RunStatus.CONFIRMED}:
            ready_for_review += 1
        elif run.status is RunStatus.FAILED:
            failed += 1
        else:
            retry_wait += 1

    return SchedulerSummary(
        report_date=report_date,
        owners_seen=len(owners),
        ready_for_review=ready_for_review,
        skipped_no_facts=skipped_no_facts,
        retry_wait=retry_wait,
        failed=failed,
        model_calls=model_calls,
    )


__all__ = ["SchedulerSummary", "run_due"]
