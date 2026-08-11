
"""Persistence contract tests for owner/date daily memorial runs."""

import json
import sqlite3
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.daily_memorial_drafts.models import RunStatus
from app.shiguan import db

NOW = datetime(2026, 8, 5, 0, 15, tzinfo=UTC)


def _get_or_create_run(*args, **kwargs):
    from app.daily_memorial_drafts.storage import get_or_create_run

    return get_or_create_run(*args, **kwargs)


def _create_user(user_id: str, *, db_path) -> None:
    conn = db.get_connection(db_path)
    try:
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                user_id,
                f"user-{user_id}",
                f"{user_id}@example.com",
                "not-used-by-storage-tests",
                NOW.isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()

def test_get_or_create_run_is_unique_by_owner_and_date(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _create_user("owner-a", db_path=path)

    first = _get_or_create_run("owner-a", date(2026, 8, 4), now=NOW, db_path=path)
    second = _get_or_create_run("owner-a", date(2026, 8, 4), now=NOW, db_path=path)

    assert second == first
    assert first.owner_user_id == "owner-a"
    assert first.report_date == date(2026, 8, 4)
    assert first.status is RunStatus.PENDING
    assert first.source_window_start.isoformat() == "2026-08-04T00:00:00+08:00"
    assert first.source_window_end.isoformat() == "2026-08-05T00:00:00+08:00"


def test_report_window_uses_the_exact_iana_shanghai_zone():
    from app.daily_memorial_drafts.storage import report_window

    start, end = report_window(date(1988, 6, 1))

    assert isinstance(start.tzinfo, ZoneInfo)
    assert start.tzinfo.key == "Asia/Shanghai"
    assert end.tzinfo is start.tzinfo


def test_get_or_create_run_separates_owner_and_report_date(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _create_user("owner-a", db_path=path)
    _create_user("owner-b", db_path=path)

    first = _get_or_create_run("owner-a", date(2026, 8, 4), now=NOW, db_path=path)
    other_owner = _get_or_create_run("owner-b", date(2026, 8, 4), now=NOW, db_path=path)
    other_date = _get_or_create_run("owner-a", date(2026, 8, 3), now=NOW, db_path=path)

    assert len({first.id, other_owner.id, other_date.id}) == 3


def test_get_or_create_run_rejects_noncanonical_owner_id(tmp_path):
    with pytest.raises(ValueError, match="owner_user_id must be canonical"):
        _get_or_create_run(
            " owner-a",
            date(2026, 8, 4),
            now=NOW,
            db_path=tmp_path / "shiguan.sqlite3",
        )


def test_scheduled_user_enumeration_is_sorted_and_internal(tmp_path):
    from app.auth.storage import list_user_ids_for_scheduled_jobs

    path = tmp_path / "shiguan.sqlite3"
    for user_id in ("owner-c", "owner-a", "owner-b"):
        _create_user(user_id, db_path=path)

    assert list_user_ids_for_scheduled_jobs(db_path=path) == (
        "owner-a",
        "owner-b",
        "owner-c",
    )

    import app.auth as auth_package

    assert not hasattr(auth_package, "list_user_ids_for_scheduled_jobs")


CONTENT = "每日奏报待审总报原文字节快照。"


def _seed_run(
    path,
    owner: str,
    *,
    status: str = "READY_FOR_REVIEW",
    content: str = CONTENT,
):
    from app.agents.ministries import MINISTRIES
    from app.daily_memorial_drafts.models import (
        ChancellorDailyResult,
        MinistryDailyResult,
        StageKind,
    )
    from app.daily_memorial_drafts.workflow import (
        _aggregate_fingerprint,
        _canonical_json,
        _load_run_and_facts,
        _ordered_terminal_rows,
        adapt_chancellor_result_to_draft,
    )
    _create_user(owner, db_path=path)
    run = _get_or_create_run(owner, date(2026, 8, 4), now=NOW, db_path=path)
    conn = db.get_connection(path)
    try:
        for fact_id in ("fact-1", "fact-2"):
            conn.execute(
                "INSERT INTO daily_memorial_fact_snapshots "
                "(id, run_id, fact_id, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)",
                (
                    f"snapshot-{run.id}-{fact_id}",
                    run.id,
                    fact_id,
                    _canonical_json(
                        {"archive_id": f"archive-{fact_id}", "evidence_ordinal": None}
                    ),
                    NOW.isoformat(),
                ),
            )
        for index in range(39):
            conn.execute(
                "INSERT INTO daily_memorial_stage_results "
                "(id, run_id, stage, unit_key, status, created_at, updated_at) "
                "VALUES (?, ?, 'BUREAU', ?, 'READY', ?, ?)",
                (
                    f"bureau-{run.id}-{index}",
                    run.id,
                    f"bureau-{index}",
                    NOW.isoformat(),
                    NOW.isoformat(),
                ),
            )
        input_fingerprints = tuple(f"{index + 1:064x}" for index in range(6))
        ministry_results = tuple(
            MinistryDailyResult(
                department=department,
                bureau_units=[f"{department}/测试司"],
                summary=f"{department}摘要[fact:fact-1]。",
                risks_and_dependencies=[],
                decisions_needed=[],
                fact_refs=["fact-1"],
            )
            for department in MINISTRIES
        )
        chancellor_result = ChancellorDailyResult(
            report_date=date(2026, 8, 4),
            fact_cutoff="2026-08-05T00:00:00+08:00",
            ministry_sections=list(ministry_results),
            cross_ministry_risks=[],
            decisions_needed=[],
            content=CONTENT,
            fact_refs=["fact-1"],
        )
        draft = adapt_chancellor_result_to_draft(
            chancellor_result,
            input_fingerprints=input_fingerprints,
        )
        for index, (department, ministry_result) in enumerate(
            zip(MINISTRIES, ministry_results, strict=True)
        ):
            conn.execute(
                "INSERT INTO daily_memorial_stage_results "
                "(id, run_id, stage, unit_key, status, input_fingerprint, output_json, "
                "created_at, updated_at) VALUES (?, ?, 'MINISTRY', ?, 'READY', ?, ?, ?, ?)",
                (
                    f"ministry-{run.id}-{index}",
                    run.id,
                    department,
                    input_fingerprints[index],
                    _canonical_json(ministry_result.model_dump(mode="json")),
                    NOW.isoformat(),
                    NOW.isoformat(),
                ),
            )
        run_row, facts = _load_run_and_facts(conn, run.id)
        ministry_rows = _ordered_terminal_rows(
            conn, run.id, StageKind.MINISTRY, MINISTRIES
        )
        assert ministry_rows is not None
        chancellor_input_fingerprint = _aggregate_fingerprint(
            StageKind.CHANCELLOR,
            "chancellor",
            run_row,
            facts,
            ministry_rows,
        )
        conn.execute(
            "INSERT INTO daily_memorial_stage_results "
            "(id, run_id, stage, unit_key, status, input_fingerprint, output_json, "
            "fact_refs_json, created_at, updated_at) "
            "VALUES (?, ?, 'CHANCELLOR', 'chancellor', 'READY', ?, ?, ?, ?, ?)",
            (
                f"chancellor-{run.id}",
                run.id,
                chancellor_input_fingerprint,
                _canonical_json(chancellor_result.model_dump(mode="json")),
                _canonical_json(chancellor_result.fact_refs),
                NOW.isoformat(),
                NOW.isoformat(),
            ),
        )
        conn.execute(
            "UPDATE daily_memorial_runs SET status = ?, version = 1, fingerprint = ?, "
            "content = ?, fact_refs_json = ?, updated_at = ? WHERE id = ?",
            (
                status,
                draft.fingerprint,
                content,
                _canonical_json(draft.fact_refs),
                NOW.isoformat(),
                run.id,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return run


def _confirm(path, run_id: str, owner: str, *, version: int = 1, fingerprint=None):
    from app.daily_memorial_drafts.models import ConfirmDailyMemorialRequest
    from app.daily_memorial_drafts.storage import confirm_draft

    if fingerprint is None:
        conn = db.get_connection(path)
        try:
            fingerprint = conn.execute(
                "SELECT fingerprint FROM daily_memorial_runs WHERE id = ?", (run_id,)
            ).fetchone()[0]
        finally:
            conn.close()
    return confirm_draft(
        run_id,
        ConfirmDailyMemorialRequest(version=version, fingerprint=fingerprint),
        owner_user_id=owner,
        now=NOW,
        db_path=path,
    )


def test_latest_is_owner_scoped_and_returns_reviewable_snapshot(tmp_path):
    from app.daily_memorial_drafts.storage import get_latest_run

    path = tmp_path / "shiguan.sqlite3"
    _seed_run(path, "owner-a")
    _seed_run(path, "owner-b", status="PENDING")

    latest = get_latest_run("owner-a", db_path=path)

    assert latest.status is RunStatus.READY_FOR_REVIEW
    assert latest.draft is not None
    assert latest.draft.content == CONTENT
    assert latest.draft.bureau_result_count == 39
    assert latest.draft.ministry_result_count == 6
    assert get_latest_run("owner-missing", db_path=path) is None


def test_confirm_ready_draft_creates_exactly_one_memorial_and_replay_is_idempotent(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")

    first = _confirm(path, run.id, "owner-a")
    replay = _confirm(path, run.id, "owner-a")

    assert replay == first
    conn = db.get_connection(path)
    try:
        rows = conn.execute("SELECT * FROM archives").fetchall()
        stored_run = conn.execute(
            "SELECT status, confirmed_memorial_id, confirmed_at "
            "FROM daily_memorial_runs WHERE id = ?",
            (run.id,),
        ).fetchone()
    finally:
        conn.close()
    assert len(rows) == 1
    assert rows[0]["type"] == "MEMORIAL"
    assert rows[0]["title"] == "每日奏报（2026-08-04）"
    assert rows[0]["content"] == CONTENT
    assert rows[0]["matter_type"] == "每日奏报"
    assert rows[0]["department"] == "丞相"
    assert rows[0]["source_kind"] is None
    assert rows[0]["source_text"] is None
    assert stored_run["status"] == "CONFIRMED"
    assert stored_run["confirmed_memorial_id"] == first.memorial_id
    assert stored_run["confirmed_at"] == NOW.isoformat()


@pytest.mark.parametrize(
    ("version", "fingerprint"),
    [(2, None), (1, "b" * 64)],
)
def test_stale_confirmation_rolls_back_without_archive(tmp_path, version, fingerprint):
    from app.daily_memorial_drafts.storage import DailyMemorialConflictError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    with pytest.raises(DailyMemorialConflictError):
        _confirm(path, run.id, "owner-a", version=version, fingerprint=fingerprint)
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
        assert conn.execute(
            "SELECT status FROM daily_memorial_runs WHERE id = ?", (run.id,)
        ).fetchone()[0] == "READY_FOR_REVIEW"
    finally:
        conn.close()


@pytest.mark.parametrize("status", ["PENDING", "GENERATING", "SKIPPED_NO_FACTS", "FAILED"])
def test_not_ready_draft_conflicts_without_archive(tmp_path, status):
    from app.daily_memorial_drafts.storage import DailyMemorialConflictError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a", status=status)
    with pytest.raises(DailyMemorialConflictError):
        _confirm(path, run.id, "owner-a")
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
    finally:
        conn.close()


def test_cross_owner_confirmation_is_indistinguishable_from_missing(tmp_path):
    from app.daily_memorial_drafts.storage import DailyMemorialNotFoundError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    _create_user("owner-b", db_path=path)
    with pytest.raises(DailyMemorialNotFoundError):
        _confirm(path, run.id, "owner-b")


def test_invalid_stored_content_or_fact_refs_fail_closed(tmp_path):
    from app.daily_memorial_drafts.storage import DailyMemorialConflictError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a", content="   ")
    with pytest.raises(DailyMemorialConflictError):
        _confirm(path, run.id, "owner-a")
    conn = db.get_connection(path)
    try:
        conn.execute(
            "UPDATE daily_memorial_runs SET content = ?, fact_refs_json = ? WHERE id = ?",
            (CONTENT, json.dumps(["missing-fact"]), run.id),
        )
        conn.commit()
    finally:
        conn.close()
    with pytest.raises(DailyMemorialConflictError):
        _confirm(path, run.id, "owner-a")


def test_archive_insert_exception_rolls_back_run_and_archive(tmp_path, monkeypatch):
    from app.shiguan import storage as shiguan_storage
    from app.shiguan.errors import ShiguanStorageError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    original = shiguan_storage.insert_archive_in_transaction

    def insert_then_fail(*args, **kwargs):
        original(*args, **kwargs)
        raise sqlite3.OperationalError("private SQL detail")

    monkeypatch.setattr(shiguan_storage, "insert_archive_in_transaction", insert_then_fail)
    with pytest.raises(ShiguanStorageError, match="每日奏报确认暂时不可用"):
        _confirm(path, run.id, "owner-a")
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
        assert conn.execute(
            "SELECT status FROM daily_memorial_runs WHERE id = ?", (run.id,)
        ).fetchone()[0] == "READY_FOR_REVIEW"
    finally:
        conn.close()


def test_conditional_update_failure_rolls_back_insert(tmp_path, monkeypatch):
    from app.daily_memorial_drafts import storage as memorial_storage
    from app.shiguan import storage as shiguan_storage

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    original = shiguan_storage.insert_archive_in_transaction

    def insert_then_make_stale(conn, *args, **kwargs):
        archive = original(conn, *args, **kwargs)
        conn.execute("UPDATE daily_memorial_runs SET version = 2 WHERE id = ?", (run.id,))
        return archive

    monkeypatch.setattr(shiguan_storage, "insert_archive_in_transaction", insert_then_make_stale)
    with pytest.raises(memorial_storage.DailyMemorialConflictError):
        _confirm(path, run.id, "owner-a")
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
        row = conn.execute(
            "SELECT status, version FROM daily_memorial_runs WHERE id = ?", (run.id,)
        ).fetchone()
    finally:
        conn.close()
    assert tuple(row) == ("READY_FOR_REVIEW", 1)


def test_update_exception_rolls_back_insert_and_run(tmp_path):
    from app.shiguan.errors import ShiguanStorageError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    conn = db.get_connection(path)
    try:
        conn.execute(
            "CREATE TRIGGER reject_daily_confirmation BEFORE UPDATE ON daily_memorial_runs "
            "WHEN NEW.status = 'CONFIRMED' BEGIN SELECT RAISE(ABORT, 'private update detail'); END"
        )
        conn.commit()
    finally:
        conn.close()
    with pytest.raises(ShiguanStorageError, match="每日奏报确认暂时不可用"):
        _confirm(path, run.id, "owner-a")
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
        assert conn.execute(
            "SELECT status FROM daily_memorial_runs WHERE id = ?", (run.id,)
        ).fetchone()[0] == "READY_FOR_REVIEW"
    finally:
        conn.close()


@pytest.mark.parametrize("drift", ["content", "fact_refs"])
def test_confirmation_rejects_run_projection_drift_from_chancellor_checkpoint(
    tmp_path, drift
):
    from app.daily_memorial_drafts.storage import DailyMemorialConflictError, get_latest_run

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    latest = get_latest_run("owner-a", db_path=path)
    assert latest is not None and latest.draft is not None
    conn = db.get_connection(path)
    try:
        if drift == "content":
            conn.execute(
                "UPDATE daily_memorial_runs SET content = ? WHERE id = ?",
                ("漂移后的正文", run.id),
            )
        else:
            conn.execute(
                "UPDATE daily_memorial_runs SET fact_refs_json = ? WHERE id = ?",
                (json.dumps(["fact-2"]), run.id),
            )
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(DailyMemorialConflictError):
        _confirm(
            path,
            run.id,
            "owner-a",
            version=latest.draft.version,
            fingerprint=latest.draft.fingerprint,
        )
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
    finally:
        conn.close()


def test_confirmation_rejects_content_that_archive_model_would_transform(tmp_path):
    from app.daily_memorial_drafts.storage import DailyMemorialConflictError

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a", content="  exact stored bytes\r\n")

    with pytest.raises(DailyMemorialConflictError):
        _confirm(path, run.id, "owner-a")
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
    finally:
        conn.close()


@pytest.mark.parametrize(
    "drift",
    ["chancellor_input_fingerprint", "fact_snapshot", "ministry_output"],
)
def test_confirmation_rejects_aggregate_input_drift(tmp_path, drift):
    from app.daily_memorial_drafts.storage import DailyMemorialConflictError, get_latest_run

    path = tmp_path / "shiguan.sqlite3"
    run = _seed_run(path, "owner-a")
    latest = get_latest_run("owner-a", db_path=path)
    assert latest is not None and latest.draft is not None
    conn = db.get_connection(path)
    try:
        if drift == "chancellor_input_fingerprint":
            conn.execute(
                "UPDATE daily_memorial_stage_results SET input_fingerprint = ? "
                "WHERE run_id = ? AND stage = 'CHANCELLOR'",
                ("f" * 64, run.id),
            )
        elif drift == "fact_snapshot":
            conn.execute(
                "UPDATE daily_memorial_fact_snapshots SET snapshot_json = ? "
                "WHERE run_id = ? AND fact_id = 'fact-1'",
                (
                    json.dumps(
                        {"archive_id": "drifted-archive", "evidence_ordinal": None},
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                    run.id,
                ),
            )
        else:
            conn.execute(
                "UPDATE daily_memorial_stage_results SET output_json = ? "
                "WHERE run_id = ? AND stage = 'MINISTRY' AND unit_key = '吏部'",
                (json.dumps({"drifted": True}), run.id),
            )
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(DailyMemorialConflictError):
        _confirm(
            path,
            run.id,
            "owner-a",
            version=latest.draft.version,
            fingerprint=latest.draft.fingerprint,
        )
    conn = db.get_connection(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM archives").fetchone()[0] == 0
    finally:
        conn.close()
