
"""Controlled, immutable daily memorial fact snapshot tests."""

import hashlib
import json
from datetime import UTC, date, datetime

import pytest

from app.daily_memorial_drafts.models import RunStatus
from app.shiguan import db

NOW = datetime(2026, 8, 5, 0, 15, tzinfo=UTC)


def _facts_module():
    from app.daily_memorial_drafts import facts

    return facts


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


def _create_archive_for(
    owner_user_id: str,
    created_at: str,
    *,
    db_path,
    archive_id: str,
    archive_type: str = "MEMORIAL",
) -> None:
    conn = db.get_connection(db_path)
    try:
        conn.execute(
            "INSERT INTO archives "
            "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                archive_id,
                archive_type,
                f"title-{archive_id}",
                f"content-{archive_id}",
                "daily-test",
                "丞相",
                created_at,
                owner_user_id,
            ),
        )
        conn.execute(
            "INSERT INTO archive_evidence (archive_id, source, reality_label, note) "
            "VALUES (?, ?, ?, ?)",
            (archive_id, "史馆", "事实", f"note-{archive_id}"),
        )
        conn.commit()
    finally:
        conn.close()


def _add_immutable_reference(*, archive_id: str, db_path) -> None:
    snapshot_json = json.dumps(
        {"evidence_id": "evidence-1", "excerpt": "frozen evidence"},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    conn = db.get_connection(db_path)
    try:
        conn.execute(
            "INSERT INTO archive_evidence_references "
            "(archive_id, ordinal, evidence_id, pack_id, investigation_id, "
            "snapshot_json, snapshot_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                archive_id,
                0,
                "evidence-1",
                "pack-1",
                "investigation-1",
                snapshot_json,
                hashlib.sha256(snapshot_json.encode()).hexdigest(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def test_report_window_is_exact_shanghai_calendar_day():
    start, end = _facts_module().report_window(date(2026, 8, 4))

    assert start.isoformat() == "2026-08-04T00:00:00+08:00"
    assert end.isoformat() == "2026-08-05T00:00:00+08:00"


def test_controlled_fact_id_uses_the_governed_canonical_identity():
    raw = "\0".join(("owner-a", "archive-1", "0", "payload-hash"))
    assert _facts_module().controlled_fact_id(
        "owner-a", "archive-1", 0, "payload-hash"
    ) == hashlib.sha256(raw.encode("utf-8")).hexdigest()


def test_fact_snapshot_is_owner_scoped_windowed_and_frozen(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _create_user("owner-a", db_path=path)
    _create_user("owner-b", db_path=path)
    _create_archive_for(
        "owner-a", "2026-08-04T02:00:00+08:00", db_path=path, archive_id="kept"
    )
    _add_immutable_reference(archive_id="kept", db_path=path)
    _create_archive_for(
        "owner-b", "2026-08-04T03:00:00+08:00", db_path=path, archive_id="other-owner"
    )
    _create_archive_for(
        "owner-a", "2026-08-05T00:00:00+08:00", db_path=path, archive_id="end-boundary"
    )
    _create_archive_for(
        "owner-a",
        "2026-08-04T05:00:00+08:00",
        db_path=path,
        archive_id="unsupported-type",
        archive_type="NOTE",
    )

    first = _facts_module().freeze_controlled_facts(
        "owner-a", date(2026, 8, 4), db_path=path
    )
    _create_archive_for(
        "owner-a", "2026-08-04T04:00:00+08:00", db_path=path, archive_id="late"
    )
    second = _facts_module().freeze_controlled_facts(
        "owner-a", date(2026, 8, 4), db_path=path
    )

    assert second == first
    assert len(first) == 2
    assert {fact.archive_id for fact in first} == {"kept"}
    assert {fact.evidence_ordinal for fact in first} == {None, 0}
    assert all(fact.owner_user_id == "owner-a" for fact in first)
    assert all(fact.report_date == date(2026, 8, 4) for fact in first)
    assert all("other-owner" not in fact.snapshot_json for fact in first)
    for fact in first:
        snapshot = json.loads(fact.snapshot_json)
        assert snapshot["source_window_start"] == "2026-08-04T00:00:00+08:00"
        assert snapshot["source_window_end"] == "2026-08-05T00:00:00+08:00"

    run = _get_or_create_run("owner-a", date(2026, 8, 4), now=NOW, db_path=path)
    assert run.fact_refs == tuple(fact.fact_id for fact in first)


def test_no_fact_freeze_is_terminal_and_never_rescans(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _create_user("owner-a", db_path=path)

    assert (
        _facts_module().freeze_controlled_facts(
            "owner-a", date(2026, 8, 4), db_path=path
        )
        == ()
    )
    skipped = _get_or_create_run("owner-a", date(2026, 8, 4), now=NOW, db_path=path)
    assert skipped.status is RunStatus.SKIPPED_NO_FACTS

    _create_archive_for(
        "owner-a", "2026-08-04T02:00:00+08:00", db_path=path, archive_id="too-late"
    )

    assert (
        _facts_module().freeze_controlled_facts(
            "owner-a", date(2026, 8, 4), db_path=path
        )
        == ()
    )


def test_fact_freeze_rejects_noncanonical_owner_id(tmp_path):
    path = tmp_path / "shiguan.sqlite3"
    _create_user("owner-a", db_path=path)
    _create_archive_for(
        "owner-a", "2026-08-04T02:00:00+08:00", db_path=path, archive_id="kept"
    )

    with pytest.raises(ValueError, match="owner_user_id must be canonical"):
        _facts_module().freeze_controlled_facts(
            " owner-a", date(2026, 8, 4), db_path=path
        )
