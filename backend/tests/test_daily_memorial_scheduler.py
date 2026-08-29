
"""External scheduler orchestration tests for daily memorial drafts."""

from __future__ import annotations

import io
import json
import re
import sqlite3
import subprocess
import sys
import threading
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import httpx
import openai
import pytest

from app.agents.bureaus.profiles import BUREAU_PROFILES
from app.agents.ministries import MINISTRIES
from app.shiguan import db

SHANGHAI = ZoneInfo("Asia/Shanghai")
NOW = datetime(2026, 8, 5, 0, 15, tzinfo=SHANGHAI)
REPORT_DATE = date(2026, 8, 4)


def _create_user(user_id: str, path: Path) -> None:
    conn = db.get_connection(path)
    try:
        tenant_id = f"tenant-{user_id}"
        membership_id = f"membership-{user_id}"
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, f"user-{user_id}", f"{user_id}@example.com", "unused", NOW.isoformat()),
        )
        conn.execute(
            "INSERT INTO tenants (id, kind, created_at) VALUES (?, 'PERSONAL', ?)",
            (tenant_id, NOW.isoformat()),
        )
        conn.execute(
            "INSERT INTO tenant_memberships "
            "(id, user_id, tenant_id, role, created_at, revoked_at) "
            "VALUES (?, ?, ?, 'OWNER', ?, NULL)",
            (membership_id, user_id, tenant_id, NOW.isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


def test_fresh_scheduler_database_is_verified_schema_v6(tmp_path: Path) -> None:
    path = tmp_path / "fresh.sqlite3"
    _create_user("owner-a", path)

    with sqlite3.connect(path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone() == (6,)
        assert connection.execute(
            "SELECT id,status FROM schema_migration_verification"
        ).fetchall() == [(1, "VERIFIED")]


def _create_fact(owner: str, path: Path, *, archive_id: str = "archive-1") -> None:
    conn = db.get_connection(path)
    try:
        conn.execute(
            "INSERT INTO archives "
            "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
            "VALUES (?, 'MEMORIAL', ?, ?, 'daily-test', '丞相', ?, ?)",
            (archive_id, f"title-{archive_id}", f"content-{archive_id}",
             "2026-08-04T12:00:00+08:00", owner),
        )
        conn.commit()
    finally:
        conn.close()


class FakeInvoker:
    def __init__(self, *, fail: bool = False, interrupt_after: int | None = None) -> None:
        self.fail = fail
        self.interrupt_after = interrupt_after
        self.calls: list[tuple[str, str]] = []

    def __call__(self, stage, unit_key, prompt, response_model):
        del response_model
        self.calls.append((stage, unit_key))
        if self.interrupt_after == len(self.calls):
            raise KeyboardInterrupt
        if self.fail:
            raise RuntimeError("private provider response")
        fact_id = re.findall(r"[0-9a-f]{64}", prompt)[0]
        if stage == "BUREAU":
            department, bureau = unit_key.split("/", 1)
            return {
                "status": "NO_MATERIAL",
                "department": department,
                "bureau": bureau,
                "summary": None,
                "decisions_needed": [],
                "fact_refs": [],
            }
        if stage == "MINISTRY":
            return {
                "department": unit_key,
                "bureau_units": [
                    f"{profile.department}/{profile.bureau}"
                    for profile in BUREAU_PROFILES
                    if profile.department == unit_key
                ],
                "summary": f"部级摘要[fact:{fact_id}]。",
                "risks_and_dependencies": [],
                "decisions_needed": [],
                "fact_refs": [fact_id],
            }
        return {
            "report_date": REPORT_DATE.isoformat(),
            "fact_cutoff": "2026-08-05T00:00:00+08:00",
            "ministry_sections": [
                {
                    "department": ministry,
                    "bureau_units": [
                        f"{profile.department}/{profile.bureau}"
                        for profile in BUREAU_PROFILES
                        if profile.department == ministry
                    ],
                    "summary": f"部级摘要[fact:{fact_id}]。",
                    "risks_and_dependencies": [],
                    "decisions_needed": [],
                    "fact_refs": [fact_id],
                }
                for ministry in MINISTRIES
            ],
            "cross_ministry_risks": [],
            "decisions_needed": [],
            "content": f"每日奏报待审总报[fact:{fact_id}]。",
            "fact_refs": [fact_id],
        }


def test_default_report_date_is_previous_shanghai_calendar_day():
    from app.daily_memorial_drafts.__main__ import resolve_schedule_time

    report_date, now = resolve_schedule_time(None, "2026-08-04T16:15:00Z")

    assert report_date == REPORT_DATE
    assert now.isoformat() == "2026-08-05T00:15:00+08:00"
    assert isinstance(now.tzinfo, ZoneInfo)
    assert now.tzinfo.key == "Asia/Shanghai"


@pytest.mark.parametrize("raw", ["2026-8-4", "2026-08-04junk", " 2026-08-04"])
def test_explicit_report_date_is_strict(raw):
    from app.daily_memorial_drafts.__main__ import resolve_schedule_time

    with pytest.raises(ValueError, match="invalid_arguments"):
        resolve_schedule_time(raw, NOW.isoformat())


def test_explicit_now_rejects_naive_datetime():
    from app.daily_memorial_drafts.__main__ import resolve_schedule_time

    with pytest.raises(ValueError, match="invalid_arguments"):
        resolve_schedule_time(None, "2026-08-05T00:15:00")


@pytest.mark.parametrize(
    "raw",
    [
        "20260805T001500+08:00",
        "2026-W32-3T00:15:00+08:00",
        "2026-08-05T00:15:00+08:00:30",
    ],
)
def test_explicit_now_rejects_iso8601_forms_outside_rfc3339(raw):
    from app.daily_memorial_drafts.__main__ import resolve_schedule_time

    with pytest.raises(ValueError, match="invalid_arguments"):
        resolve_schedule_time(None, raw)


def test_explicit_now_accepts_rfc3339_lowercase_separator_and_utc_marker():
    from app.daily_memorial_drafts.__main__ import resolve_schedule_time

    report_date, now = resolve_schedule_time(None, "2026-08-04t16:15:00.125z")

    assert report_date == REPORT_DATE
    assert now.isoformat() == "2026-08-05T00:15:00.125000+08:00"


def test_no_facts_skips_without_model_calls(tmp_path):
    from app.daily_memorial_drafts.scheduler import run_due

    path = tmp_path / "fresh.sqlite3"
    _create_user("owner-b", path)
    _create_user("owner-a", path)
    invoker = FakeInvoker()

    summary = run_due(report_date=REPORT_DATE, now=NOW, invoker=invoker, db_path=path)

    assert summary.owners_seen == 2
    assert summary.skipped_no_facts == 2
    assert summary.model_calls == 0
    assert invoker.calls == []


def test_revoked_personal_owner_is_excluded_before_scheduler_side_effects(tmp_path):
    from app.daily_memorial_drafts.scheduler import run_due

    path = tmp_path / "revoked-owner.sqlite3"
    _create_user("owner-active", path)
    _create_user("owner-revoked", path)
    _create_fact("owner-revoked", path, archive_id="revoked-private-fact")
    connection = db.get_connection(path)
    try:
        connection.execute(
            "UPDATE tenant_memberships SET revoked_at = ? WHERE user_id = ?",
            (NOW.isoformat(), "owner-revoked"),
        )
        connection.commit()
    finally:
        connection.close()

    invoker = FakeInvoker()
    summary = run_due(
        report_date=REPORT_DATE,
        now=NOW,
        invoker=invoker,
        db_path=path,
    )

    assert summary.owners_seen == 1
    assert summary.skipped_no_facts == 1
    assert summary.model_calls == 0
    assert invoker.calls == []
    connection = db.get_connection(path)
    try:
        assert [
            row["owner_user_id"]
            for row in connection.execute(
                "SELECT owner_user_id FROM daily_memorial_runs ORDER BY owner_user_id"
            ).fetchall()
        ] == ["owner-active"]
        assert connection.execute(
            "SELECT COUNT(*) FROM daily_memorial_fact_snapshots"
        ).fetchone()[0] == 0
        assert connection.execute(
            "SELECT COUNT(*) FROM daily_memorial_stage_results"
        ).fetchone()[0] == 0
    finally:
        connection.close()


def test_cross_layer_two_owners_generate_isolated_drafts_and_confirm_once(tmp_path):
    from app.daily_memorial_drafts.models import ConfirmDailyMemorialRequest, RunStatus
    from app.daily_memorial_drafts.scheduler import run_due
    from app.daily_memorial_drafts.storage import (
        DailyMemorialNotFoundError,
        confirm_draft,
        get_latest_run,
    )

    path = tmp_path / "shiguan.sqlite3"
    for owner, archive_id in (("owner-a", "source-a"), ("owner-b", "source-b")):
        _create_user(owner, path)
        _create_fact(owner, path, archive_id=archive_id)

    invoker = FakeInvoker()
    summary = run_due(report_date=REPORT_DATE, now=NOW, invoker=invoker, db_path=path)

    latest_a = get_latest_run("owner-a", db_path=path)
    latest_b = get_latest_run("owner-b", db_path=path)
    assert summary.ready_for_review == 2
    assert summary.model_calls == 2 * (39 + 6 + 1)
    assert latest_a is not None and latest_a.status is RunStatus.READY_FOR_REVIEW
    assert latest_b is not None and latest_b.status is RunStatus.READY_FOR_REVIEW
    assert latest_a.draft is not None and latest_b.draft is not None
    assert latest_a.draft.id != latest_b.draft.id
    assert latest_a.draft.fact_refs != latest_b.draft.fact_refs

    request = ConfirmDailyMemorialRequest(
        version=latest_a.draft.version,
        fingerprint=latest_a.draft.fingerprint,
    )
    with pytest.raises(DailyMemorialNotFoundError):
        confirm_draft(
            latest_a.draft.id,
            request,
            owner_user_id="owner-b",
            now=NOW,
            db_path=path,
        )

    conn = db.get_connection(path)
    try:
        memorials_before = conn.execute(
            "SELECT COUNT(*) FROM archives WHERE type = 'MEMORIAL'"
        ).fetchone()[0]
        replies_before = conn.execute(
            "SELECT COUNT(*) FROM archives WHERE type = 'REPLY'"
        ).fetchone()[0]
    finally:
        conn.close()

    first = confirm_draft(
        latest_a.draft.id,
        request,
        owner_user_id="owner-a",
        now=NOW,
        db_path=path,
    )
    replay = confirm_draft(
        latest_a.draft.id,
        request,
        owner_user_id="owner-a",
        now=NOW,
        db_path=path,
    )

    conn = db.get_connection(path)
    try:
        memorials_after = conn.execute(
            "SELECT COUNT(*) FROM archives WHERE type = 'MEMORIAL'"
        ).fetchone()[0]
        replies_after = conn.execute(
            "SELECT COUNT(*) FROM archives WHERE type = 'REPLY'"
        ).fetchone()[0]
    finally:
        conn.close()
    assert replay == first
    assert memorials_after - memorials_before == 1
    assert replies_after - replies_before == 0


def test_success_is_ready_and_never_recalled(tmp_path):
    from app.daily_memorial_drafts.scheduler import run_due

    path = tmp_path / "fresh.sqlite3"
    _create_user("owner-a", path)
    _create_fact("owner-a", path)
    first = FakeInvoker()

    completed = run_due(report_date=REPORT_DATE, now=NOW, invoker=first, db_path=path)
    replay = FakeInvoker(fail=True)
    repeated = run_due(report_date=REPORT_DATE, now=NOW, invoker=replay, db_path=path)

    assert completed.ready_for_review == 1
    assert completed.model_calls == 46
    assert repeated.ready_for_review == 1
    assert repeated.model_calls == 0
    assert replay.calls == []


def test_finite_retry_uses_persisted_one_five_thirty_policy(tmp_path):
    import app.daily_memorial_drafts.workflow as workflow
    from app.daily_memorial_drafts.scheduler import run_due

    path = tmp_path / "fresh.sqlite3"
    _create_user("owner-a", path)
    _create_fact("owner-a", path)

    assert workflow._BACKOFF == (
        timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30)
    )
    first = run_due(report_date=REPORT_DATE, now=NOW, invoker=FakeInvoker(fail=True), db_path=path)
    early = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(seconds=59),
        invoker=FakeInvoker(fail=True),
        db_path=path,
    )
    second = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=1),
        invoker=FakeInvoker(fail=True),
        db_path=path,
    )
    before_third = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=5, seconds=59),
        invoker=FakeInvoker(fail=True),
        db_path=path,
    )
    third = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=6),
        invoker=FakeInvoker(fail=True),
        db_path=path,
    )
    before_fourth = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=35, seconds=59),
        invoker=FakeInvoker(fail=True),
        db_path=path,
    )
    exhausted = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=36),
        invoker=FakeInvoker(fail=True),
        db_path=path,
    )

    assert (first.retry_wait, first.model_calls) == (1, 1)
    assert (early.retry_wait, early.model_calls) == (1, 0)
    assert (second.retry_wait, second.model_calls) == (1, 1)
    assert (before_third.retry_wait, before_third.model_calls) == (1, 0)
    assert (third.retry_wait, third.model_calls) == (1, 1)
    assert (before_fourth.retry_wait, before_fourth.model_calls) == (1, 0)
    assert (exhausted.failed, exhausted.model_calls) == (1, 1)


def test_keyboard_interrupt_recovers_only_interrupted_unit_after_lease(tmp_path):
    from app.daily_memorial_drafts.scheduler import run_due

    path = tmp_path / "fresh.sqlite3"
    _create_user("owner-a", path)
    _create_fact("owner-a", path)
    interrupted = FakeInvoker(interrupt_after=5)

    with pytest.raises(KeyboardInterrupt):
        run_due(report_date=REPORT_DATE, now=NOW, invoker=interrupted, db_path=path)

    fresh_lease = FakeInvoker()
    waiting = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=29, seconds=59),
        invoker=fresh_lease,
        db_path=path,
    )
    recovered = FakeInvoker()
    finished = run_due(
        report_date=REPORT_DATE,
        now=NOW + timedelta(minutes=30),
        invoker=recovered,
        db_path=path,
    )

    assert waiting.retry_wait == 1
    assert fresh_lease.calls == []
    assert all(call not in recovered.calls for call in interrupted.calls[:4])
    assert recovered.calls[0] == interrupted.calls[4]
    assert len(recovered.calls) == 42
    assert finished.ready_for_review == 1


def test_two_callers_do_not_execute_same_live_lease(tmp_path):
    from app.daily_memorial_drafts.scheduler import run_due

    path = tmp_path / "fresh.sqlite3"
    _create_user("owner-a", path)
    _create_fact("owner-a", path)
    entered = threading.Event()
    release = threading.Event()
    first_calls: list[tuple[str, str]] = []

    def blocking(stage, unit_key, prompt, response_model):
        first_calls.append((stage, unit_key))
        entered.set()
        assert release.wait(5)
        return FakeInvoker()(stage, unit_key, prompt, response_model)

    first_result: list[object] = []
    thread = threading.Thread(
        target=lambda: first_result.append(
            run_due(report_date=REPORT_DATE, now=NOW, invoker=blocking, db_path=path)
        )
    )
    thread.start()
    assert entered.wait(5)
    second = FakeInvoker()
    concurrent = run_due(report_date=REPORT_DATE, now=NOW, invoker=second, db_path=path)
    release.set()
    thread.join(10)

    assert not thread.is_alive()
    assert concurrent.retry_wait == 1
    assert second.calls == []
    assert first_calls[0] == (
        "BUREAU",
        f"{BUREAU_PROFILES[0].department}/{BUREAU_PROFILES[0].bureau}",
    )
    assert first_result[0].ready_for_review == 1


def test_cli_emits_exact_sorted_sanitized_json_and_exit_codes(tmp_path, monkeypatch):
    import app.daily_memorial_drafts.__main__ as cli
    from app.daily_memorial_drafts.scheduler import SchedulerSummary

    path = tmp_path / "operator-db.sqlite3"
    stdout = io.StringIO()
    monkeypatch.setattr(
        cli,
        "run_due",
        lambda **_kwargs: SchedulerSummary(REPORT_DATE, 2, 1, 0, 1, 0, 7),
    )

    exit_code = cli.main(
        [
            "run-due",
            "--report-date",
            REPORT_DATE.isoformat(),
            "--now",
            NOW.isoformat(),
            "--database",
            str(path),
        ],
        stdout=stdout,
        invoker_factory=lambda: (_ for _ in ()).throw(AssertionError("unused")),
    )

    expected = {
        "failed": 0,
        "model_calls": 7,
        "owners_seen": 2,
        "ready_for_review": 1,
        "report_date": REPORT_DATE.isoformat(),
        "retry_wait": 1,
        "skipped_no_facts": 0,
    }
    assert exit_code == 0
    assert stdout.getvalue() == json.dumps(expected, separators=(",", ":"), sort_keys=True) + "\n"
    assert str(path) not in stdout.getvalue()

    monkeypatch.setattr(
        cli,
        "run_due",
        lambda **_kwargs: SchedulerSummary(REPORT_DATE, 1, 0, 0, 0, 1, 3),
    )
    assert cli.main(["run-due", "--database", str(path)], stdout=io.StringIO()) == 1


def test_cli_rejects_owner_without_echoing_value(capsys):
    from app.daily_memorial_drafts.__main__ import main

    exit_code = main(["run-due", "--owner", "private-owner"])
    captured = capsys.readouterr()

    assert exit_code == 2
    assert "private-owner" not in captured.out + captured.err


def test_cli_configuration_failure_is_checkpointed_for_retry_without_leaking(tmp_path):
    from app.daily_memorial_drafts.__main__ import main

    path = tmp_path / "configured.sqlite3"
    _create_user("owner-a", path)
    _create_fact("owner-a", path)
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = main(
        [
            "run-due",
            "--report-date",
            REPORT_DATE.isoformat(),
            "--now",
            NOW.isoformat(),
            "--database",
            str(path),
        ],
        stdout=stdout,
        stderr=stderr,
        invoker_factory=lambda: (_ for _ in ()).throw(
            ValueError("private-config-value")
        ),
    )

    assert exit_code == 0
    assert json.loads(stdout.getvalue())["retry_wait"] == 1
    assert stderr.getvalue() == ""
    assert "private-config-value" not in stdout.getvalue() + stderr.getvalue()
    connection = sqlite3.connect(path)
    try:
        stage_row = connection.execute(
            "SELECT status, attempts, failure_code, next_retry_at "
            "FROM daily_memorial_stage_results WHERE stage = 'BUREAU' "
            "ORDER BY rowid LIMIT 1"
        ).fetchone()
    finally:
        connection.close()
    assert stage_row == (
        "RETRY_WAIT",
        1,
        "configuration_unavailable",
        (NOW + timedelta(minutes=1)).isoformat(),
    )


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_cli_production_invoker_makes_one_provider_call_per_persisted_attempt(
    mock_openai_class, tmp_path, monkeypatch
):
    from app.daily_memorial_drafts.__main__ import main

    path = tmp_path / "single-attempt.sqlite3"
    _create_user("owner-a", path)
    _create_fact("owner-a", path)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "offline-fake-key")
    client = MagicMock()
    mock_openai_class.return_value = client
    client.chat.completions.create.side_effect = openai.APITimeoutError(
        request=httpx.Request("POST", "https://api.deepseek.com/chat/completions")
    )
    moments = (
        NOW,
        NOW + timedelta(minutes=1),
        NOW + timedelta(minutes=6),
        NOW + timedelta(minutes=36),
    )
    exit_codes: list[int] = []
    model_calls: list[int] = []

    for moment in moments:
        stdout = io.StringIO()
        exit_codes.append(
            main(
                [
                    "run-due",
                    "--report-date",
                    REPORT_DATE.isoformat(),
                    "--now",
                    moment.isoformat(),
                    "--database",
                    str(path),
                ],
                stdout=stdout,
                stderr=io.StringIO(),
            )
        )
        model_calls.append(json.loads(stdout.getvalue())["model_calls"])

    assert exit_codes == [0, 0, 0, 1]
    assert model_calls == [1, 1, 1, 1]
    assert client.chat.completions.create.call_count == 4
    assert mock_openai_class.call_count == 4
    for call in mock_openai_class.call_args_list:
        assert call.kwargs["max_retries"] == 0


@patch("app.langgraph_runtime.deepseek_client.openai.OpenAI")
def test_cli_production_invoker_honors_exhausted_process_budget_before_network(
    mock_openai_class, monkeypatch
):
    from app.daily_memorial_drafts.__main__ import _production_invoker_factory
    from app.daily_memorial_drafts.workflow import BureauDailyResult
    from app.langgraph_runtime.deepseek_client import DeepSeekModelInvocationError
    from app.langgraph_runtime.provider_budget import (
        ProviderBudgetExceeded,
        configure_provider_attempt_budget,
    )

    monkeypatch.setenv("DEEPSEEK_API_KEY", "offline-fake-key")
    budget = configure_provider_attempt_budget(1)
    assert budget is not None
    budget.reserve()
    client = MagicMock()
    mock_openai_class.return_value = client

    invoker = _production_invoker_factory()
    with pytest.raises(DeepSeekModelInvocationError) as raised:
        invoker("BUREAU", "吏部/考功司", "bounded prompt", BureauDailyResult)

    assert isinstance(raised.value.__cause__, ProviderBudgetExceeded)
    client.chat.completions.create.assert_not_called()
    configure_provider_attempt_budget(None)


def test_cli_smoke_fresh_v6_database_has_no_users_or_model_call(tmp_path):
    path = tmp_path / "never-created-before.sqlite3"
    assert not path.exists()

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.daily_memorial_drafts",
            "run-due",
            "--report-date",
            REPORT_DATE.isoformat(),
            "--now",
            NOW.isoformat(),
            "--database",
            str(path),
        ],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0
    assert completed.stderr == ""
    assert json.loads(completed.stdout) == {
        "failed": 0,
        "model_calls": 0,
        "owners_seen": 0,
        "ready_for_review": 0,
        "report_date": REPORT_DATE.isoformat(),
        "retry_wait": 0,
        "skipped_no_facts": 0,
    }
    conn = sqlite3.connect(path)
    try:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 6
        assert conn.execute(
            "SELECT id,status FROM schema_migration_verification"
        ).fetchall() == [(1, "VERIFIED")]
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    finally:
        conn.close()
