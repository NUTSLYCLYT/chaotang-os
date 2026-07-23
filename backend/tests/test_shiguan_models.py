"""Unit tests for ``app.shiguan.models`` -- the two-document-type contract.

These tests exercise the Pydantic layer directly (``pydantic.ValidationError``
is the expected failure mode here), independent of storage/sqlite.
``app.shiguan.validation`` (tested separately in
``test_shiguan_validation.py``) is the layer that translates these into the
domain's own ``ArchiveValidationError``.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.shiguan.models import Archive, ArchiveCreate, Evidence, ReviewStatus


def _minimal_reply_fields() -> dict:
    return {
        "source_kind": "DECREE",
        "source_text": "请赈济灾民",
        "participating_departments": ["吏部", "户部"],
        "reply_process": "军机处会审后丞相汇总",
        "reply_conclusion": "批准所奏",
        "reply_time": "2026-07-17T10:00:00+00:00",
        "respondent": "丞相",
    }


class TestArchiveCreateBaseFields:
    def test_valid_memorial_archive(self):
        archive = ArchiveCreate(
            type="MEMORIAL",
            title="  为民请命  ",
            content="  奏折正文  ",
            matter_type="  赈灾  ",
            department="  户部  ",
        )
        assert archive.title == "为民请命"
        assert archive.content == "奏折正文"
        assert archive.matter_type == "赈灾"
        assert archive.department == "户部"
        assert archive.related_archive_ids == []
        assert archive.evidence == []
        assert archive.lessons_learned is None
        assert archive.pitfalls is None

    @pytest.mark.parametrize("field", ["title", "content", "matter_type", "department"])
    def test_empty_or_whitespace_required_text_rejected(self, field):
        payload = {
            "type": "MEMORIAL",
            "title": "title",
            "content": "content",
            "matter_type": "matter",
            "department": "dept",
        }
        payload[field] = "   "
        with pytest.raises(ValidationError):
            ArchiveCreate(**payload)

    def test_unknown_archive_type_rejected(self):
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="UNKNOWN",
                title="t",
                content="c",
                matter_type="m",
                department="d",
            )

    def test_extra_field_forbidden(self):
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                unexpected="nope",
            )

    def test_client_cannot_set_id_or_created_at(self):
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                id="attempted-override",
            )
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                created_at="2026-01-01T00:00:00+00:00",
            )

    def test_related_archive_ids_rejects_blank_entries(self):
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                related_archive_ids=["real-id", "   "],
            )

    def test_optional_lessons_and_pitfalls_normalized(self):
        archive = ArchiveCreate(
            type="MEMORIAL",
            title="t",
            content="c",
            matter_type="m",
            department="d",
            lessons_learned="  记得留痕  ",
            pitfalls="   ",
        )
        assert archive.lessons_learned == "记得留痕"
        assert archive.pitfalls is None


class TestReplyOnlyFields:
    def test_reply_with_all_required_fields_succeeds(self):
        archive = ArchiveCreate(
            type="REPLY",
            title="回奏",
            content="内容",
            matter_type="赈灾",
            department="军机处",
            **_minimal_reply_fields(),
        )
        assert archive.participating_departments == ["吏部", "户部"]
        assert archive.reply_process == "军机处会审后丞相汇总"
        assert archive.respondent == "丞相"

    @pytest.mark.parametrize(
        "missing_field",
        [
            "participating_departments",
            "source_kind",
            "source_text",
            "reply_process",
            "reply_conclusion",
            "reply_time",
            "respondent",
        ],
    )
    def test_reply_missing_required_field_rejected(self, missing_field):
        fields = _minimal_reply_fields()
        fields[missing_field] = None
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="REPLY",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_empty_participating_departments_rejected(self):
        fields = _minimal_reply_fields()
        fields["participating_departments"] = []
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="REPLY",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_duplicate_participating_departments_rejected(self):
        fields = _minimal_reply_fields()
        fields["participating_departments"] = ["吏部", "吏部"]
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="REPLY",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_blank_participating_department_rejected(self):
        fields = _minimal_reply_fields()
        fields["participating_departments"] = ["吏部", "   "]
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="REPLY",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_reply_time_must_be_parseable(self):
        fields = _minimal_reply_fields()
        fields["reply_time"] = "not-a-real-timestamp"
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="REPLY",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_participating_departments_stripped(self):
        fields = _minimal_reply_fields()
        fields["participating_departments"] = ["  吏部  ", " 户部"]
        archive = ArchiveCreate(
            type="REPLY",
            title="决策",
            content="内容",
            matter_type="赈灾",
            department="军机处",
            **fields,
        )
        assert archive.participating_departments == ["吏部", "户部"]

    @pytest.mark.parametrize(
        "field_name",
        [
            "source_kind",
            "source_text",
            "participating_departments",
            "reply_process",
            "reply_conclusion",
            "reply_time",
            "respondent",
        ],
    )
    def test_memorial_rejects_reply_only_fields(self, field_name):
        values = {
            "source_kind": "DECREE",
            "source_text": "旨意",
            "participating_departments": ["户部"],
            "reply_process": "办理",
            "reply_conclusion": "准奏",
            "reply_time": "2026-07-17T10:00:00+00:00",
            "respondent": "丞相",
        }
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                **{field_name: values[field_name]},
            )

    def test_memorial_without_reply_fields_succeeds(self):
        archive = ArchiveCreate(
            type="MEMORIAL",
            title="t",
            content="c",
            matter_type="m",
            department="d",
        )
        assert archive.participating_departments is None
        assert archive.reply_time is None

    @pytest.mark.parametrize("source_kind", ["DECREE", "MEMORIAL"])
    def test_reply_accepts_supported_source_kinds(self, source_kind):
        archive = ArchiveCreate(
            type="REPLY", title="回奏", content="内容", matter_type="事项", department="丞相府",
            **_minimal_reply_fields() | {"source_kind": source_kind},
        )
        assert archive.source_kind == source_kind


class TestEvidence:
    @pytest.mark.parametrize("label", ["LIVE", "MIXED", "FALLBACK"])
    def test_valid_reality_labels_accepted(self, label):
        evidence = Evidence(source="内部会议纪要", reality_label=label)
        assert evidence.reality_label == label
        assert evidence.note is None

    def test_unknown_reality_label_rejected(self):
        with pytest.raises(ValidationError):
            Evidence(source="s", reality_label="TRUSTED")

    def test_blank_source_rejected(self):
        with pytest.raises(ValidationError):
            Evidence(source="   ", reality_label="LIVE")

    def test_extra_field_forbidden(self):
        with pytest.raises(ValidationError):
            Evidence(source="s", reality_label="LIVE", extra_field="nope")

    def test_note_whitespace_normalized_to_none(self):
        evidence = Evidence(source="s", reality_label="LIVE", note="   ")
        assert evidence.note is None

    def test_evidence_list_on_archive_persists_structure(self):
        archive = ArchiveCreate(
            type="MEMORIAL",
            title="t",
            content="c",
            matter_type="m",
            department="d",
            evidence=[
                Evidence(source="official-report", reality_label="LIVE"),
                Evidence(source="demo-script", reality_label="FALLBACK", note="演示数据"),
            ],
        )
        assert len(archive.evidence) == 2
        assert archive.evidence[1].note == "演示数据"


class TestReviewStatus:
    @pytest.mark.parametrize(
        "status", ["ACHIEVED", "NOT_ACHIEVED", "PARTIAL", "OBSERVING"]
    )
    def test_valid_statuses_accepted(self, status):
        review = ReviewStatus(status=status, reviewed_at="2026-07-17T12:00:00+00:00")
        assert review.status == status

    def test_unknown_status_rejected(self):
        with pytest.raises(ValidationError):
            ReviewStatus(status="DONE", reviewed_at="2026-07-17T12:00:00+00:00")

    def test_reviewed_at_must_be_parseable(self):
        with pytest.raises(ValidationError):
            ReviewStatus(status="ACHIEVED", reviewed_at="not-a-timestamp")

    def test_reviewed_at_accepts_trailing_z(self):
        review = ReviewStatus(status="ACHIEVED", reviewed_at="2026-07-17T12:00:00Z")
        assert review.reviewed_at == "2026-07-17T12:00:00Z"

    def test_extra_field_forbidden(self):
        with pytest.raises(ValidationError):
            ReviewStatus(
                status="ACHIEVED",
                reviewed_at="2026-07-17T12:00:00+00:00",
                unexpected=True,
            )


class TestArchiveOutputModel:
    def test_full_archive_requires_id_and_created_at(self):
        archive = Archive(
            id="abc123",
            type="MEMORIAL",
            title="t",
            content="c",
            matter_type="m",
            department="d",
            created_at="2026-07-17T09:00:00+00:00",
        )
        assert archive.id == "abc123"
        assert archive.review_status is None

    def test_blank_id_rejected(self):
        with pytest.raises(ValidationError):
            Archive(
                id="   ",
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                created_at="2026-07-17T09:00:00+00:00",
            )

    def test_unparseable_created_at_rejected(self):
        with pytest.raises(ValidationError):
            Archive(
                id="abc123",
                type="MEMORIAL",
                title="t",
                content="c",
                matter_type="m",
                department="d",
                created_at="not-a-timestamp",
            )

    def test_archive_with_review_status(self):
        archive = Archive(
            id="abc123",
            type="MEMORIAL",
            title="t",
            content="c",
            matter_type="m",
            department="d",
            created_at="2026-07-17T09:00:00+00:00",
            review_status=ReviewStatus(status="OBSERVING", reviewed_at="2026-07-17T10:00:00+00:00"),
        )
        assert archive.review_status.status == "OBSERVING"
