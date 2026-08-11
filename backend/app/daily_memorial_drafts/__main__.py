
"""Redacted one-shot CLI for deployment-owned daily memorial scheduling."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable, Sequence
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, TextIO
from zoneinfo import ZoneInfo

from app.daily_memorial_drafts.scheduler import SchedulerSummary, run_due
from app.daily_memorial_drafts.workflow import ConfigurationUnavailable
from app.langgraph_runtime.provider_budget import (
    configure_provider_attempt_budget_from_environment,
)

configure_provider_attempt_budget_from_environment()

_SHANGHAI = ZoneInfo("Asia/Shanghai")
_DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}\Z")
_RFC3339_PATTERN = re.compile(
    r"\d{4}-\d{2}-\d{2}[Tt]"
    r"(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d"
    r"(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)\Z"
)


class _InvalidArguments(ValueError):
    pass


class _RedactedArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        del message
        raise _InvalidArguments("invalid_arguments")


def _parser() -> argparse.ArgumentParser:
    parser = _RedactedArgumentParser(
        prog="python -m app.daily_memorial_drafts",
        add_help=False,
    )
    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
        parser_class=_RedactedArgumentParser,
    )
    run_parser = subparsers.add_parser(
        "run-due",
        add_help=False,
    )
    run_parser.add_argument("--report-date")
    run_parser.add_argument("--now")
    run_parser.add_argument("--database")
    return parser


def resolve_schedule_time(
    report_date_text: str | None,
    now_text: str | None,
) -> tuple[date, datetime]:
    """Resolve strict operator inputs into the fixed Shanghai business zone."""

    try:
        if now_text is None:
            now = datetime.now(_SHANGHAI)
        else:
            if _RFC3339_PATTERN.fullmatch(now_text) is None:
                raise ValueError
            normalized_now = now_text.replace("t", "T")
            if normalized_now.endswith(("Z", "z")):
                normalized_now = normalized_now[:-1] + "+00:00"
            parsed_now = datetime.fromisoformat(normalized_now)
            if parsed_now.tzinfo is None or parsed_now.utcoffset() is None:
                raise ValueError
            now = parsed_now.astimezone(_SHANGHAI)
        if report_date_text is None:
            report_date = now.date() - timedelta(days=1)
        else:
            if _DATE_PATTERN.fullmatch(report_date_text) is None:
                raise ValueError
            report_date = date.fromisoformat(report_date_text)
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid_arguments") from exc
    return report_date, now


def _production_invoker_factory() -> Callable[..., Any]:
    from app.langgraph_runtime.deepseek_client import build_deepseek_chat_model
    from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config
    from app.langgraph_runtime.provider_budget import get_provider_attempt_budget

    config = load_deepseek_provider_config()
    model = build_deepseek_chat_model(
        config,
        json_output=True,
        attempt_budget=get_provider_attempt_budget(),
        max_provider_attempts=1,
    )

    def invoke(stage, unit_key, prompt, response_model):
        del stage, unit_key, response_model
        response = model(
            [
                {
                    "role": "system",
                    "content": "Return exactly one strict JSON object and no other text.",
                },
                {"role": "user", "content": prompt},
            ]
        )
        return json.loads(response)

    return invoke


def _lazy_invoker(factory: Callable[[], Callable[..., Any]]) -> Callable[..., Any]:
    selected: Callable[..., Any] | None = None

    def invoke(*args, **kwargs):
        nonlocal selected
        if selected is None:
            try:
                selected = factory()
            except Exception:
                raise ConfigurationUnavailable from None
        return selected(*args, **kwargs)

    return invoke


def _emit_summary(stream: TextIO, summary: SchedulerSummary) -> None:
    payload = {
        "report_date": summary.report_date.isoformat(),
        "owners_seen": summary.owners_seen,
        "ready_for_review": summary.ready_for_review,
        "skipped_no_facts": summary.skipped_no_facts,
        "retry_wait": summary.retry_wait,
        "failed": summary.failed,
        "model_calls": summary.model_calls,
    }
    stream.write(
        json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n"
    )


def main(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
    invoker_factory: Callable[[], Callable[..., Any]] | None = None,
) -> int:
    output = sys.stdout if stdout is None else stdout
    errors = sys.stderr if stderr is None else stderr
    try:
        args = _parser().parse_args(argv)
        if args.command != "run-due":
            raise _InvalidArguments("invalid_arguments")
        report_date, now = resolve_schedule_time(args.report_date, args.now)
        database = None if args.database is None else Path(args.database)
    except (_InvalidArguments, ValueError):
        errors.write("invalid_arguments\n")
        return 2

    factory = _production_invoker_factory if invoker_factory is None else invoker_factory
    try:
        summary = run_due(
            report_date=report_date,
            now=now,
            invoker=_lazy_invoker(factory),
            db_path=database,
        )
    except KeyboardInterrupt:
        raise
    except Exception:
        errors.write("scheduler_failed\n")
        return 1
    _emit_summary(output, summary)
    return 1 if summary.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
