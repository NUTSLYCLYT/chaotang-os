"""Tests for ``app.shiguan.storage`` (CRUD, review status, statistics) and
``app.shiguan.archive_decree`` (automatic MEMORIAL+DECISION archival).

``archive_decree.py``'s tests live here (rather than in a dedicated file)
because ``backend/tests/test_shiguan_archive_decree.py`` is out of this
module's allowed test-file list -- module 1's allowed paths only cover
``test_shiguan_models.py``, ``test_shiguan_storage.py``,
``test_shiguan_validation.py`` and ``conftest.py``. Since
``archive_chancellor_decree`` is purely a thin orchestration layer over
``storage.create_archive``, its tests fit naturally alongside the storage
tests it exercises.
"""

from __future__ import annotations

import types
import uuid

import pytest

from app.shiguan import archive_decree, db, storage
from app.shiguan.errors import ArchiveNotFoundError, ArchiveValidationError, ShiguanStorageError


def _memorial_payload(**overrides) -> dict:
    payload = {
        "type": "MEMORIAL",
        "title": "奏折标题",
        "content": "奏折正文",
        "matter_type": "赈灾",
        "department": "户部",
    }
    payload.update(overrides)
    return payload


def _decision_payload(**overrides) -> dict:
    payload = {
        "type": "DECISION",
        "title": "决策标题",
        "content": "决策内容",
        "matter_type": "赈灾",
        "department": "军机处",
        "participating_departments": ["吏部", "户部"],
        "decision_process": "军机处会审后丞相汇总",
        "decision_conclusion": "批准所奏",
        "decision_time": "2026-07-17T10:00:00+00:00",
        "responsible_owner": "丞相",
    }
    payload.update(overrides)
    return payload


class TestCreateAndGetArchive:
    def test_create_then_get_roundtrip(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        created = storage.create_archive(_memorial_payload(), db_path=db_path)

        assert isinstance(created.id, str) and len(created.id) == 32
        assert created.created_at

        fetched = storage.get_archive(created.id, db_path=db_path)
        assert fetched.id == created.id
        assert fetched.title == "奏折标题"
        assert fetched.related_archive_ids == []
        assert fetched.evidence == []
        assert fetched.review_status is None

    def test_create_with_evidence_and_optional_fields_persists(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        payload = _memorial_payload(
            evidence=[
                {"source": "official-report", "reality_label": "LIVE"},
                {"source": "demo-script", "reality_label": "FALLBACK", "note": "演示数据"},
            ],
            lessons_learned="按流程复核证据来源",
            pitfalls="不要把宣传材料当作 LIVE 证据",
        )
        created = storage.create_archive(payload, db_path=db_path)
        fetched = storage.get_archive(created.id, db_path=db_path)

        assert [e.source for e in fetched.evidence] == ["official-report", "demo-script"]
        assert fetched.evidence[1].note == "演示数据"
        assert fetched.lessons_learned == "按流程复核证据来源"
        assert fetched.pitfalls == "不要把宣传材料当作 LIVE 证据"

    def test_create_decision_archive_with_related_memorial(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        memorial = storage.create_archive(_memorial_payload(), db_path=db_path)
        decision = storage.create_archive(
            _decision_payload(related_archive_ids=[memorial.id]), db_path=db_path
        )

        assert decision.related_archive_ids == [memorial.id]
        assert decision.participating_departments == ["吏部", "户部"]
        assert decision.decision_conclusion == "批准所奏"

        # The memorial itself is untouched by the decision's relation.
        refetched_memorial = storage.get_archive(memorial.id, db_path=db_path)
        assert refetched_memorial.related_archive_ids == []

    def test_create_rejects_nonexistent_related_archive_id(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        payload = _memorial_payload(related_archive_ids=["does-not-exist"])
        with pytest.raises(ArchiveValidationError):
            storage.create_archive(payload, db_path=db_path)

    def test_create_rejects_invalid_payload(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        payload = _memorial_payload(title="   ")
        with pytest.raises(ArchiveValidationError):
            storage.create_archive(payload, db_path=db_path)

    def test_create_server_generates_id_client_cannot_override(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        payload = _memorial_payload()
        payload["id"] = "client-supplied-id"
        with pytest.raises(ArchiveValidationError):
            storage.create_archive(payload, db_path=db_path)

    def test_get_archive_not_found_raises(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        with pytest.raises(ArchiveNotFoundError):
            storage.get_archive(uuid.uuid4().hex, db_path=db_path)


class TestReconnectAfterClose:
    def test_reading_after_reconnecting_to_same_file_returns_persisted_data(self, tmp_path):
        """Proxy for "survives an application process restart": every
        ``storage`` call already opens and closes its own short-lived
        connection, so calling ``get_archive`` in a fresh call after
        ``create_archive`` has already returned is a faithful in-process
        analogue of "close the connection, then reconnect to the same
        file". This test additionally opens/closes a fully independent
        ``db.get_connection`` in between to make that reconnection
        explicit.
        """

        db_path = tmp_path / "restart.sqlite3"
        created = storage.create_archive(_memorial_payload(), db_path=db_path)

        # Open an independent connection to the same file, confirm the row
        # is visible, then close it -- simulating "a fresh process
        # reconnects to the same on-disk database file".
        conn = db.get_connection(db_path)
        try:
            row = conn.execute("SELECT id FROM archives WHERE id = ?", (created.id,)).fetchone()
            assert row is not None
        finally:
            conn.close()

        # And the public storage API, using a brand new connection under
        # the hood, still reads the same data back.
        fetched = storage.get_archive(created.id, db_path=db_path)
        assert fetched.id == created.id
        assert fetched.title == created.title


class TestListArchives:
    def test_empty_database_returns_empty_list(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        assert storage.list_archives(db_path=db_path) == []

    def test_filters_by_type_matter_type_and_department(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        storage.create_archive(
            _memorial_payload(matter_type="赈灾", department="户部"), db_path=db_path
        )
        storage.create_archive(
            _memorial_payload(matter_type="边防", department="兵部"), db_path=db_path
        )
        memorial_for_decision = storage.create_archive(
            _memorial_payload(matter_type="赈灾", department="户部"), db_path=db_path
        )
        storage.create_archive(
            _decision_payload(
                matter_type="赈灾",
                department="军机处",
                related_archive_ids=[memorial_for_decision.id],
            ),
            db_path=db_path,
        )

        by_type = storage.list_archives(type="DECISION", db_path=db_path)
        assert len(by_type) == 1
        assert by_type[0].type == "DECISION"

        by_matter_type = storage.list_archives(matter_type="赈灾", db_path=db_path)
        assert len(by_matter_type) == 3

        by_department = storage.list_archives(department="兵部", db_path=db_path)
        assert len(by_department) == 1
        assert by_department[0].department == "兵部"

        no_match = storage.list_archives(matter_type="不存在的事项", db_path=db_path)
        assert no_match == []

    def test_deterministic_ordering_created_at_desc_id_asc(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        for _ in range(5):
            storage.create_archive(_memorial_payload(), db_path=db_path)

        archives = storage.list_archives(db_path=db_path)
        assert len(archives) == 5

        for earlier, later in zip(archives, archives[1:], strict=False):
            if earlier.created_at == later.created_at:
                assert earlier.id <= later.id
            else:
                assert earlier.created_at >= later.created_at

    def test_limit_is_respected(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        for _ in range(3):
            storage.create_archive(_memorial_payload(), db_path=db_path)

        assert len(storage.list_archives(limit=2, db_path=db_path)) == 2

    @pytest.mark.parametrize("bad_limit", [0, -1])
    def test_invalid_limit_raises_archive_validation_error(self, tmp_path, bad_limit):
        db_path = tmp_path / "shiguan.sqlite3"
        with pytest.raises(ArchiveValidationError):
            storage.list_archives(limit=bad_limit, db_path=db_path)

    def test_separate_db_files_do_not_pollute_each_other(self, tmp_path):
        db_path_a = tmp_path / "a.sqlite3"
        db_path_b = tmp_path / "b.sqlite3"
        storage.create_archive(_memorial_payload(), db_path=db_path_a)

        assert len(storage.list_archives(db_path=db_path_a)) == 1
        assert storage.list_archives(db_path=db_path_b) == []


class TestUpsertReviewStatus:
    def test_upsert_then_get_reflects_status(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        created = storage.create_archive(_memorial_payload(), db_path=db_path)

        storage.upsert_review_status(
            created.id, "ACHIEVED", "2026-07-17T11:00:00+00:00", note="按期完成", db_path=db_path
        )
        fetched = storage.get_archive(created.id, db_path=db_path)
        assert fetched.review_status.status == "ACHIEVED"
        assert fetched.review_status.note == "按期完成"

    def test_repeated_upsert_keeps_only_latest_status(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        created = storage.create_archive(_memorial_payload(), db_path=db_path)

        storage.upsert_review_status(
            created.id, "OBSERVING", "2026-07-17T09:00:00+00:00", db_path=db_path
        )
        storage.upsert_review_status(
            created.id, "PARTIAL", "2026-07-17T10:00:00+00:00", note="进展中", db_path=db_path
        )
        storage.upsert_review_status(
            created.id, "ACHIEVED", "2026-07-17T11:00:00+00:00", note="已完成", db_path=db_path
        )

        fetched = storage.get_archive(created.id, db_path=db_path)
        assert fetched.review_status.status == "ACHIEVED"
        assert fetched.review_status.reviewed_at == "2026-07-17T11:00:00+00:00"
        assert fetched.review_status.note == "已完成"

        conn = db.get_connection(db_path)
        try:
            (row_count,) = conn.execute(
                "SELECT COUNT(*) FROM archive_review_status WHERE archive_id = ?", (created.id,)
            ).fetchone()
        finally:
            conn.close()
        assert row_count == 1

    def test_upsert_on_missing_archive_raises_not_found(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        with pytest.raises(ArchiveNotFoundError):
            storage.upsert_review_status(
                uuid.uuid4().hex, "ACHIEVED", "2026-07-17T11:00:00+00:00", db_path=db_path
            )

    def test_upsert_rejects_invalid_status(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        created = storage.create_archive(_memorial_payload(), db_path=db_path)
        with pytest.raises(ArchiveValidationError):
            storage.upsert_review_status(
                created.id, "DONE", "2026-07-17T11:00:00+00:00", db_path=db_path
            )


class TestGetStatistics:
    def test_empty_database_has_null_success_rate(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        stats = storage.get_statistics(db_path=db_path)
        assert stats.total == 0
        assert stats.achieved == 0
        assert stats.pending_review == 0
        assert stats.success_rate is None

    def test_only_observing_status_has_null_success_rate(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        created = storage.create_archive(_memorial_payload(), db_path=db_path)
        storage.upsert_review_status(
            created.id, "OBSERVING", "2026-07-17T11:00:00+00:00", db_path=db_path
        )
        stats = storage.get_statistics(db_path=db_path)
        assert stats.observing == 1
        assert stats.pending_review == 0
        assert stats.success_rate is None

    def test_success_rate_computed_over_achieved_not_achieved_partial(self, tmp_path):
        db_path = tmp_path / "shiguan.sqlite3"
        statuses = ["ACHIEVED", "ACHIEVED", "NOT_ACHIEVED", "PARTIAL", "OBSERVING"]
        archive_ids = []
        for status in statuses:
            created = storage.create_archive(_memorial_payload(), db_path=db_path)
            storage.upsert_review_status(
                created.id, status, "2026-07-17T11:00:00+00:00", db_path=db_path
            )
            archive_ids.append(created.id)
        # One additional archive with no review status at all.
        storage.create_archive(_memorial_payload(), db_path=db_path)

        stats = storage.get_statistics(db_path=db_path)
        assert stats.total == 6
        assert stats.achieved == 2
        assert stats.not_achieved == 1
        assert stats.partial == 1
        assert stats.observing == 1
        assert stats.pending_review == 1
        assert stats.success_rate == pytest.approx(2 / 4)


class TestArchiveChancellorDecree:
    def _fake_response(self, **overrides) -> types.SimpleNamespace:
        defaults = dict(
            departments=["吏部", "户部"],
            processing_path=["吏部-文选司", "户部-度支司", "军机处", "丞相"],
            rationale="事涉多部门协同",
            council_verdict="军机处会审：予以批准",
            final_verdict="丞相最终裁决：批准所奏",
        )
        defaults.update(overrides)
        return types.SimpleNamespace(**defaults)

    def test_successful_archival_writes_linked_memorial_and_decision(self, tmp_path, monkeypatch):
        isolated_db_path = tmp_path / "decree-archive.sqlite3"
        monkeypatch.setattr(db, "_DEFAULT_DB_PATH", isolated_db_path)

        archive_decree.archive_chancellor_decree("请赈济灾民", self._fake_response())

        memorials = storage.list_archives(type="MEMORIAL", db_path=isolated_db_path)
        decisions = storage.list_archives(type="DECISION", db_path=isolated_db_path)
        assert len(memorials) == 1
        assert len(decisions) == 1

        memorial = memorials[0]
        decision = decisions[0]
        assert memorial.content == "请赈济灾民"
        assert decision.related_archive_ids == [memorial.id]
        assert decision.participating_departments == ["吏部", "户部"]
        assert decision.decision_conclusion == "丞相最终裁决：批准所奏"
        assert decision.responsible_owner == "丞相"

    def test_accepts_dict_shaped_response(self, tmp_path, monkeypatch):
        isolated_db_path = tmp_path / "decree-archive.sqlite3"
        monkeypatch.setattr(db, "_DEFAULT_DB_PATH", isolated_db_path)

        response = {
            "departments": ["兵部"],
            "processing_path": ["兵部-武选司", "丞相"],
            "rationale": "单部门事项",
            "council_verdict": None,
            "final_verdict": "批准",
        }
        archive_decree.archive_chancellor_decree("请调兵防边", response)

        decisions = storage.list_archives(type="DECISION", db_path=isolated_db_path)
        assert len(decisions) == 1
        assert decisions[0].participating_departments == ["兵部"]

    def test_never_raises_when_storage_fails(self, tmp_path, monkeypatch):
        isolated_db_path = tmp_path / "decree-archive.sqlite3"
        monkeypatch.setattr(db, "_DEFAULT_DB_PATH", isolated_db_path)

        def _boom(*args, **kwargs):
            raise ShiguanStorageError("史馆写入失败，请稍后再试")

        monkeypatch.setattr(archive_decree.storage, "create_linked_archive_pair", _boom)

        # Must not raise.
        result = archive_decree.archive_chancellor_decree("请赈济灾民", self._fake_response())
        assert result.archived is False

    def test_never_raises_on_malformed_response(self, tmp_path, monkeypatch):
        isolated_db_path = tmp_path / "decree-archive.sqlite3"
        monkeypatch.setattr(db, "_DEFAULT_DB_PATH", isolated_db_path)

        # A response object missing every expected attribute.
        result = archive_decree.archive_chancellor_decree("请赈济灾民", object())
        assert result.archived is False
        assert storage.list_archives(db_path=isolated_db_path) == []
