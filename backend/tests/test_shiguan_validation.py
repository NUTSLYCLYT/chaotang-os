"""Unit tests for ``app.shiguan.validation`` -- the storage-facing checks.

Covers translation of ``pydantic.ValidationError`` into the domain's own
``ArchiveValidationError`` (sanitized, field-referencing messages) and the
one check that needs a live database connection: confirming
``related_archive_ids`` reference archives that actually exist.
"""

from __future__ import annotations

import pytest

from app.shiguan import db, storage, validation
from app.shiguan.errors import ArchiveValidationError
from app.shiguan.models import ArchiveCreate, ReviewStatus


def _valid_memorial_payload() -> dict:
    return {
        "type": "MEMORIAL",
        "title": "奏折标题",
        "content": "奏折正文",
        "matter_type": "赈灾",
        "department": "户部",
    }


class TestValidateArchiveCreate:
    def test_valid_payload_returns_archive_create(self):
        result = validation.validate_archive_create(_valid_memorial_payload())
        assert isinstance(result, ArchiveCreate)
        assert result.title == "奏折标题"

    def test_missing_required_field_raises_archive_validation_error(self):
        payload = _valid_memorial_payload()
        del payload["title"]
        with pytest.raises(ArchiveValidationError) as excinfo:
            validation.validate_archive_create(payload)
        assert "title" in str(excinfo.value)

    def test_blank_required_field_raises_archive_validation_error(self):
        payload = _valid_memorial_payload()
        payload["department"] = "   "
        with pytest.raises(ArchiveValidationError):
            validation.validate_archive_create(payload)

    def test_unknown_archive_type_raises_archive_validation_error(self):
        payload = _valid_memorial_payload()
        payload["type"] = "NOT_A_TYPE"
        with pytest.raises(ArchiveValidationError):
            validation.validate_archive_create(payload)

    def test_error_message_does_not_leak_traceback_or_paths(self):
        payload = _valid_memorial_payload()
        del payload["content"]
        with pytest.raises(ArchiveValidationError) as excinfo:
            validation.validate_archive_create(payload)
        message = str(excinfo.value)
        assert "Traceback" not in message
        assert "site-packages" not in message
        assert ".py" not in message

    def test_incomplete_reply_payload_raises_archive_validation_error(self):
        payload = {
            "type": "REPLY",
            "title": "回奏",
            "content": "内容",
            "matter_type": "赈灾",
            "department": "军机处",
            "participating_departments": ["吏部"],
            # source and reply-only fields are incomplete.
        }
        with pytest.raises(ArchiveValidationError):
            validation.validate_archive_create(payload)


class TestValidateRelatedArchiveIds:
    def test_all_ids_exist_passes(self, tmp_path):
        db_path = tmp_path / "related.sqlite3"
        first = storage.create_archive(_valid_memorial_payload(), db_path=db_path)
        second = storage.create_archive(_valid_memorial_payload(), db_path=db_path)

        conn = db.get_connection(db_path)
        try:
            validation.validate_related_archive_ids(conn, [first.id, second.id])
        finally:
            conn.close()

    def test_empty_list_passes(self, tmp_path):
        db_path = tmp_path / "related-empty.sqlite3"
        conn = db.get_connection(db_path)
        try:
            validation.validate_related_archive_ids(conn, [])
        finally:
            conn.close()

    def test_missing_id_raises_archive_validation_error(self, tmp_path):
        db_path = tmp_path / "related-missing.sqlite3"
        conn = db.get_connection(db_path)
        try:
            with pytest.raises(ArchiveValidationError) as excinfo:
                validation.validate_related_archive_ids(conn, ["does-not-exist"])
        finally:
            conn.close()
        assert "does-not-exist" in str(excinfo.value)


class TestValidateReviewStatusUpdate:
    def test_valid_payload_returns_review_status(self):
        result = validation.validate_review_status_update(
            {"status": "ACHIEVED", "reviewed_at": "2026-07-17T09:00:00+00:00", "note": None}
        )
        assert isinstance(result, ReviewStatus)
        assert result.status == "ACHIEVED"

    def test_unknown_status_raises_archive_validation_error(self):
        with pytest.raises(ArchiveValidationError):
            validation.validate_review_status_update(
                {"status": "DONE", "reviewed_at": "2026-07-17T09:00:00+00:00", "note": None}
            )

    def test_unparseable_reviewed_at_raises_archive_validation_error(self):
        with pytest.raises(ArchiveValidationError):
            validation.validate_review_status_update(
                {"status": "ACHIEVED", "reviewed_at": "not-a-timestamp", "note": None}
            )

    def test_note_is_optional(self):
        result = validation.validate_review_status_update(
            {"status": "OBSERVING", "reviewed_at": "2026-07-17T09:00:00+00:00"}
        )
        assert result.note is None
