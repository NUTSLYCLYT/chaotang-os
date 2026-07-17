"""Unit tests for ``app.shiguan.models`` -- the five-archive-type contract.

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


def _minimal_decision_fields() -> dict:
    return {
        "participating_departments": ["吏部", "户部"],
        "decision_process": "军机处会审后丞相汇总",
        "decision_conclusion": "批准所奏",
        "decision_time": "2026-07-17T10:00:00+00:00",
        "responsible_owner": "丞相",
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
            type="KNOWLEDGE",
            title="t",
            content="c",
            matter_type="m",
            department="d",
            lessons_learned="  记得留痕  ",
            pitfalls="   ",
        )
        assert archive.lessons_learned == "记得留痕"
        assert archive.pitfalls is None


class TestDecisionOnlyFields:
    def test_decision_with_all_required_fields_succeeds(self):
        archive = ArchiveCreate(
            type="DECISION",
            title="决策",
            content="内容",
            matter_type="赈灾",
            department="军机处",
            **_minimal_decision_fields(),
        )
        assert archive.participating_departments == ["吏部", "户部"]
        assert archive.decision_process == "军机处会审后丞相汇总"
        assert archive.responsible_owner == "丞相"

    @pytest.mark.parametrize(
        "missing_field",
        [
            "participating_departments",
            "decision_process",
            "decision_conclusion",
            "decision_time",
            "responsible_owner",
        ],
    )
    def test_decision_missing_required_field_rejected(self, missing_field):
        fields = _minimal_decision_fields()
        fields[missing_field] = None
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="DECISION",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_empty_participating_departments_rejected(self):
        fields = _minimal_decision_fields()
        fields["participating_departments"] = []
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="DECISION",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_duplicate_participating_departments_rejected(self):
        fields = _minimal_decision_fields()
        fields["participating_departments"] = ["吏部", "吏部"]
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="DECISION",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_blank_participating_department_rejected(self):
        fields = _minimal_decision_fields()
        fields["participating_departments"] = ["吏部", "   "]
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="DECISION",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_decision_time_must_be_parseable(self):
        fields = _minimal_decision_fields()
        fields["decision_time"] = "not-a-real-timestamp"
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type="DECISION",
                title="决策",
                content="内容",
                matter_type="赈灾",
                department="军机处",
                **fields,
            )

    def test_participating_departments_stripped(self):
        fields = _minimal_decision_fields()
        fields["participating_departments"] = ["  吏部  ", " 户部"]
        archive = ArchiveCreate(
            type="DECISION",
            title="决策",
            content="内容",
            matter_type="赈灾",
            department="军机处",
            **fields,
        )
        assert archive.participating_departments == ["吏部", "户部"]

    @pytest.mark.parametrize(
        "archive_type", ["MEMORIAL", "TASK_RESULT", "KNOWLEDGE", "PUBLICITY"]
    )
    def test_non_decision_types_reject_decision_only_fields(self, archive_type):
        with pytest.raises(ValidationError):
            ArchiveCreate(
                type=archive_type,
                title="t",
                content="c",
                matter_type="m",
                department="d",
                responsible_owner="丞相",
            )

    @pytest.mark.parametrize(
        "archive_type", ["MEMORIAL", "TASK_RESULT", "KNOWLEDGE", "PUBLICITY"]
    )
    def test_non_decision_types_without_decision_fields_succeed(self, archive_type):
        archive = ArchiveCreate(
            type=archive_type,
            title="t",
            content="c",
            matter_type="m",
            department="d",
        )
        assert archive.participating_departments is None
        assert archive.decision_time is None


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
            type="PUBLICITY",
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
