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


def test_fresh_legacy_case_accepts_explicit_empty_path_but_rejects_blank_nodes(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    legacy = models.JunjichuCaseOpenInput(
        decree_text="legacy multi route",
        route_type="multi",
        departments=["户部", "工部"],
        processing_path=[],
    )

    opened = storage.open_case(
        legacy, owner_user_id="owner-a", db_path=db_path
    )
    assert opened.processing_path == []
    with pytest.raises(ValueError, match="processing_path"):
        models.JunjichuCaseOpenInput(
            decree_text="invalid path",
            route_type="multi",
            departments=["户部", "工部"],
            processing_path=["   "],
        )


def test_bound_case_open_is_idempotent_and_rejects_same_run_substitution(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    bound = _multi_input().model_copy(
        update={
            "run_id": "run-unique",
            "decree_id": "run-unique",
            "draft_fingerprint": "a" * 64,
            "route_digest": "b" * 64,
        }
    )
    first = storage.open_case(bound, owner_user_id="owner-a", db_path=db_path)
    replay = storage.open_case(bound, owner_user_id="owner-a", db_path=db_path)

    assert replay.id == first.id
    assert len(storage.list_cases(owner_user_id="owner-a", db_path=db_path)) == 1

    with pytest.raises(ValueError, match="binding conflict"):
        storage.open_case(
            bound.model_copy(update={"decree_text": "替换后的另一案"}),
            owner_user_id="owner-a",
            db_path=db_path,
        )
    with pytest.raises(ValueError, match="processing path"):
        storage.open_case(
            bound.model_copy(update={"processing_path": []}),
            owner_user_id="owner-a",
            db_path=db_path,
        )
    storage.record_checkpoint(
        first.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        council_verdict="已完成会审",
        db_path=db_path,
    )
    storage.archive_case(
        first.id,
        owner_user_id="owner-a",
        reply_id="reply-run-unique",
        db_path=db_path,
    )
    with pytest.raises(ValueError, match="terminal"):
        storage.open_case(bound, owner_user_id="owner-a", db_path=db_path)


@pytest.mark.parametrize(
    "changes",
    [
        {"processing_path": ["上书房", "伪造终点"]},
        {"completed_ministry_opinions": [{"department": "刑部"}]},
        {"council_verdict": "替换后的裁决"},
        {"processing_path": []},
        {"completed_ministry_opinions": []},
    ],
)
def test_finalizing_checkpoint_replay_rejects_mutation_and_empty_prefixes(
    tmp_path: Path, changes: dict[str, object]
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _multi_input(), owner_user_id="owner-a", db_path=db_path
    )
    opinions = [{"department": "户部", "opinion": "已议"}]
    final_path = ["上书房", "军机处（会审）", "丞相（最终汇总）"]
    case = storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        processing_path=final_path,
        completed_ministry_opinions=opinions,
        council_verdict="军机处完成会审",
        db_path=db_path,
    )

    with pytest.raises(ValueError, match="empty|conflict"):
        storage.record_checkpoint(
            case.id,
            owner_user_id="owner-a",
            status="CHANCELLOR_FINALIZING",
            db_path=db_path,
            **changes,
        )

    unchanged = storage.get_case(
        case.id, owner_user_id="owner-a", db_path=db_path
    )
    assert unchanged == case


def test_forward_checkpoint_empty_lists_preserve_persisted_case_evidence(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    case = storage.open_case(
        _multi_input(), owner_user_id="owner-a", db_path=db_path
    )
    opinions = [{"department": "户部", "opinion": "已议"}]
    council_path = ["上书房", "军机处（会审）"]
    reviewing = storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="COUNCIL_REVIEWING",
        processing_path=council_path,
        completed_ministry_opinions=opinions,
        council_verdict="军机处完成会审",
        db_path=db_path,
    )

    finalizing = storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        processing_path=[],
        completed_ministry_opinions=[],
        db_path=db_path,
    )

    assert finalizing.status == "CHANCELLOR_FINALIZING"
    assert finalizing.processing_path == reviewing.processing_path
    assert finalizing.completed_ministry_opinions == reviewing.completed_ministry_opinions
    assert finalizing.council_verdict == reviewing.council_verdict


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
        council_verdict="军机处完成会审",
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

    storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
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

    replayed = storage.archive_case(
        case.id,
        owner_user_id="owner-a",
        reply_id="reply-1",
        db_path=db_path,
    )
    assert replayed == archived

    with pytest.raises(ValueError, match="terminal"):
        storage.archive_case(
            case.id,
            owner_user_id="owner-a",
            reply_id="reply-conflict",
            db_path=db_path,
        )


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


def test_archive_rejects_mismatched_execution_binding_before_mutation(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "cases.sqlite3"
    bound_input = _multi_input().model_copy(
        update={
            "run_id": "run-a",
            "decree_id": "run-a",
            "draft_fingerprint": "a" * 64,
            "route_digest": "b" * 64,
        }
    )
    case = storage.open_case(
        bound_input, owner_user_id="owner-a", db_path=db_path
    )
    case = storage.record_checkpoint(
        case.id,
        owner_user_id="owner-a",
        status="CHANCELLOR_FINALIZING",
        council_verdict="已会审",
        db_path=db_path,
    )

    with pytest.raises(ValueError, match="binding mismatch"):
        storage.archive_case(
            case.id,
            owner_user_id="owner-a",
            reply_id="reply-wrong",
            expected_run_id="run-a",
            expected_decree_id="run-a",
            expected_draft_fingerprint="c" * 64,
            expected_route_digest="b" * 64,
            expected_departments=("户部", "工部"),
            db_path=db_path,
        )

    unchanged = storage.get_case(
        case.id, owner_user_id="owner-a", db_path=db_path
    )
    assert unchanged is not None
    assert unchanged.status == "CHANCELLOR_FINALIZING"
    assert unchanged.reply_id is None
