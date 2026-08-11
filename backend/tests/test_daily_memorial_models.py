
"""Strict contracts for daily memorial draft persistence and HTTP payloads."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.daily_memorial_drafts.models import (
    ConfirmDailyMemorialRequest,
    ConfirmDailyMemorialResponse,
    DailyMemorialDraft,
    DailyMemorialLatestResponse,
    RunStatus,
    StageKind,
    StageStatus,
)


def _draft_payload(**overrides):
    payload = {
        "id": "draft-1",
        "report_date": date(2026, 8, 4),
        "source_window_start": "2026-08-04T00:00:00+08:00",
        "source_window_end": "2026-08-05T00:00:00+08:00",
        "version": 1,
        "fingerprint": "a" * 64,
        "bureau_result_count": 39,
        "ministry_result_count": 6,
        "content": "有事实引用的待审稿",
        "fact_refs": ["fact-1"],
    }
    payload.update(overrides)
    return payload


def test_daily_memorial_enums_have_only_governed_values():
    assert {item.value for item in RunStatus} == {
        "PENDING",
        "GENERATING",
        "READY_FOR_REVIEW",
        "SKIPPED_NO_FACTS",
        "FAILED",
        "CONFIRMED",
    }
    assert {item.value for item in StageKind} == {"BUREAU", "MINISTRY", "CHANCELLOR"}
    assert {item.value for item in StageStatus} == {
        "PENDING",
        "RUNNING",
        "READY",
        "NO_MATERIAL",
        "RETRY_WAIT",
        "FAILED",
    }


@pytest.mark.parametrize(
    "overrides",
    [
        {"fingerprint": "bad"},
        {"fingerprint": "A" * 64},
        {"bureau_result_count": 38},
        {"ministry_result_count": 5},
        {"fact_refs": ["fact-1", "fact-1"]},
        {"source_window_end": "2026-08-04T00:00:00+08:00"},
    ],
)
def test_daily_draft_requires_exact_counts_sha256_and_coherent_window(overrides):
    with pytest.raises(ValidationError):
        DailyMemorialDraft.model_validate(_draft_payload(**overrides))


def test_daily_responses_enforce_status_specific_shapes():
    draft = DailyMemorialDraft.model_validate(_draft_payload())
    ready = DailyMemorialLatestResponse(status=RunStatus.READY_FOR_REVIEW, draft=draft)
    assert ready.draft == draft

    with pytest.raises(ValidationError):
        DailyMemorialLatestResponse(status=RunStatus.READY_FOR_REVIEW)
    with pytest.raises(ValidationError):
        DailyMemorialLatestResponse(status=RunStatus.PENDING, draft=draft)
    with pytest.raises(ValidationError):
        DailyMemorialLatestResponse(status=RunStatus.CONFIRMED, draft=draft)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("source_window_start", "2026-08-04T00:00:00"),
        ("source_window_start", "2026-08-04T00:00:00+00:00"),
        ("source_window_end", "2026-08-05T00:00:00+09:00"),
    ],
)
def test_daily_draft_rejects_non_shanghai_source_window_timezone(field, value):
    with pytest.raises(ValidationError):
        DailyMemorialDraft.model_validate(_draft_payload(**{field: value}))


def test_daily_draft_accepts_shanghai_equivalent_offset():
    draft = DailyMemorialDraft.model_validate(_draft_payload())

    assert draft.source_window_start.isoformat().endswith("+08:00")
    assert draft.source_window_end.isoformat().endswith("+08:00")


def test_confirmation_contract_requires_current_version_and_sha256():
    request = ConfirmDailyMemorialRequest(version=1, fingerprint="b" * 64)
    response = ConfirmDailyMemorialResponse(
        status=RunStatus.CONFIRMED,
        draft_id="draft-1",
        memorial_id="memorial-1",
    )
    assert request.version == 1
    assert response.status is RunStatus.CONFIRMED

    with pytest.raises(ValidationError):
        ConfirmDailyMemorialRequest(version=0, fingerprint="b" * 64)
    with pytest.raises(ValidationError):
        ConfirmDailyMemorialResponse(
            status=RunStatus.READY_FOR_REVIEW,
            draft_id="draft-1",
            memorial_id="memorial-1",
        )
