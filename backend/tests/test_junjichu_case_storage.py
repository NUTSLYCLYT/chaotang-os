from __future__ import annotations

from pathlib import Path

import pytest

from app.junjichu_cases import models, storage


def _multi_input() -> models.JunjichuCaseOpenInput:
    return models.JunjichuCaseOpenInput(
        decree_text="请会审跨部事务",
        route_type="multi",
        departments=["户部", "工部"],
        processing_path=["上书房", "丞相（首次分流）", "军机处（召集）"],
    )


def test_list_cases_is_scoped_to_owner(tmp_path: Path) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(_multi_input(), owner_user_id="owner-a", db_path=db_path)

    assert storage.list_cases(owner_user_id="owner-b", db_path=db_path) == []
    assert storage.list_cases(owner_user_id="owner-a", db_path=db_path)[0].id == case.id
    assert storage.get_case(case.id, owner_user_id="owner-b", db_path=db_path) is None


def test_open_case_rejects_single_route(tmp_path: Path) -> None:
    single = models.JunjichuCaseOpenInput(
        decree_text="请户部办理",
        route_type="single",
        departments=["户部"],
        processing_path=["上书房", "丞相（首次分流）"],
    )

    with pytest.raises(ValueError, match="multi"):
        storage.open_case(single, owner_user_id="owner-a", db_path=tmp_path / "cases.sqlite3")


def test_case_lifecycle_rejects_status_rollback_and_reply_before_archive(tmp_path: Path) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(_multi_input(), owner_user_id="owner-a", db_path=db_path)

    with pytest.raises(ValueError, match="ARCHIVED"):
        storage.record_checkpoint(
            case.id,
            owner_user_id="owner-a",
            status="MINISTRY_REVIEWING",
            reply_id="reply-1",
            db_path=db_path,
        )

    reviewing = storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="COUNCIL_REVIEWING",
        processing_path=["上书房", "军机处（会审）"],
        completed_ministry_opinions=[{"department": "户部", "opinion": "已议"}],
        db_path=db_path,
    )
    assert reviewing.status == "COUNCIL_REVIEWING"

    with pytest.raises(ValueError, match="rollback"):
        storage.record_checkpoint(
            case.id,
            owner_user_id="owner-a",
            status="MINISTRY_REVIEWING",
            db_path=db_path,
        )

    archived = storage.archive_case(
        case.id,
        owner_user_id="owner-a",
        reply_id="reply-1",
        db_path=db_path,
    )
    assert archived.status == "ARCHIVED"
    assert archived.reply_id == "reply-1"


def test_failed_case_stores_only_fixed_sanitized_reason(tmp_path: Path) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(_multi_input(), owner_user_id="owner-a", db_path=db_path)

    failed = storage.fail_case(
        case.id,
        owner_user_id="owner-a",
        reason="model output included token=secret-value",
        db_path=db_path,
    )

    assert failed.status == "FAILED"
    assert failed.failure_reason == "processing_failed"
    assert storage.get_case(case.id, owner_user_id="owner-a", db_path=db_path) == failed
