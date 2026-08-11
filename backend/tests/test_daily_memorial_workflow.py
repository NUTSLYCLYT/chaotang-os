
"""Offline TDD coverage for the serial 39-bureau daily stage."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.agents.bureaus.profiles import BUREAU_PROFILES
from app.agents.ministries import MINISTRIES
from app.daily_memorial_drafts.facts import freeze_controlled_facts
from app.daily_memorial_drafts.storage import get_or_create_run
from app.shiguan import db

NOW = datetime(2026, 8, 5, 0, 15, tzinfo=UTC)


@dataclass(frozen=True)
class Call:
    stage: str
    unit_key: str
    prompt: str
    response_model: type


class FakeInvoker:
    def __init__(self, factory):
        self.factory = factory
        self.calls: list[Call] = []

    def __call__(self, stage, unit_key, prompt, response_model):
        self.calls.append(Call(stage, unit_key, prompt, response_model))
        return self.factory(len(self.calls) - 1, unit_key)


def _seed_run(path, *, include_second_fact: bool = False):
    connection = db.get_connection(path)
    try:
        connection.execute(
            "INSERT INTO users (id, username, email, password_hash, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            ("owner-a", "owner-a", "owner-a@example.com", "unused", NOW.isoformat()),
        )
        if include_second_fact:
            connection.execute(
                "INSERT INTO archives "
                "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "archive-2",
                    "MEMORIAL",
                    "另一日报事实",
                    "另一项冻结的受控事实",
                    "daily-test",
                    "丞相",
                    "2026-08-04T10:00:00+08:00",
                    "owner-a",
                ),
            )
        connection.execute(
            "INSERT INTO archives "
            "(id, type, title, content, matter_type, department, created_at, owner_user_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "archive-1",
                "MEMORIAL",
                "日报事实",
                "一项冻结的受控事实",
                "daily-test",
                "丞相",
                "2026-08-04T09:00:00+08:00",
                "owner-a",
            ),
        )
        connection.commit()
    finally:
        connection.close()
    facts = freeze_controlled_facts("owner-a", date(2026, 8, 4), db_path=path)
    run = get_or_create_run("owner-a", date(2026, 8, 4), now=NOW, db_path=path)
    return run, facts[0]


def _ready(unit_key: str, fact_id: str, *, summary: str | None = None):
    department, bureau = unit_key.split("/", 1)
    return {
        "status": "READY",
        "department": department,
        "bureau": bureau,
        "summary": summary or f"冻结材料显示有待关注事项[fact:{fact_id}]。",
        "decisions_needed": ["判断：请用户决定是否继续评估。"],
        "fact_refs": [fact_id],
    }


def _no_material(unit_key: str):
    department, bureau = unit_key.split("/", 1)
    return {
        "status": "NO_MATERIAL",
        "department": department,
        "bureau": bureau,
        "summary": None,
        "decisions_needed": [],
        "fact_refs": [],
    }


def _ministry_ready(department: str, fact_id: str):
    bureau_units = [
        f"{profile.department}/{profile.bureau}"
        for profile in BUREAU_PROFILES
        if profile.department == department
    ]
    return {
        "department": department,
        "bureau_units": bureau_units,
        "summary": f"本部冻结材料摘要[fact:{fact_id}]。",
        "risks_and_dependencies": ["判断：需关注跨司依赖。"],
        "decisions_needed": ["判断：请用户决定优先级。"],
        "fact_refs": [fact_id],
    }


def _chancellor_ready(fact_id: str):
    return {
        "report_date": "2026-08-04",
        "fact_cutoff": "2026-08-05T00:00:00+08:00",
        "ministry_sections": [
            _ministry_ready(department, fact_id) for department in MINISTRIES
        ],
        "cross_ministry_risks": ["判断：需协调跨部依赖。"],
        "decisions_needed": ["判断：请用户决定跨部优先级。"],
        "content": f"每日奏报待审总报[fact:{fact_id}]。",
        "fact_refs": [fact_id],
    }


def _expire_running_at_attempt_cap(path, run_id: str, stage: str, unit_key: str):
    connection = sqlite3.connect(path)
    try:
        changed = connection.execute(
            "UPDATE daily_memorial_stage_results "
            "SET status = 'RUNNING', attempts = 4, updated_at = ? "
            "WHERE run_id = ? AND stage = ? AND unit_key = ?",
            ((NOW - timedelta(minutes=31)).isoformat(), run_id, stage, unit_key),
        ).rowcount
        assert changed == 1
        connection.commit()
    finally:
        connection.close()


def _assert_attempt_cap_failed_atomically(path, run_id: str, stage: str, unit_key: str):
    connection = sqlite3.connect(path)
    try:
        stage_row = connection.execute(
            "SELECT status, attempts, failure_code FROM daily_memorial_stage_results "
            "WHERE run_id = ? AND stage = ? AND unit_key = ?",
            (run_id, stage, unit_key),
        ).fetchone()
        run_row = connection.execute(
            "SELECT status, failure_code FROM daily_memorial_runs WHERE id = ?",
            (run_id,),
        ).fetchone()
    finally:
        connection.close()
    assert stage_row == ("FAILED", 4, "invocation_failed")
    assert run_row == ("FAILED", "invocation_failed")


def test_bureau_contract_is_bounded_strict_and_status_coherent():
    from app.daily_memorial_drafts.workflow import BureauDailyResult, BureauDailyStatus

    assert {item.value for item in BureauDailyStatus} == {"READY", "NO_MATERIAL"}
    valid = _ready("吏部/任免司", "fact-1", summary="x" * 4000)
    assert BureauDailyResult.model_validate(valid).summary == "x" * 4000

    invalid_payloads = [
        {**valid, "unexpected": True},
        {**valid, "summary": "x" * 4001},
        {**valid, "decisions_needed": ["判断：x"] * 21},
        {**valid, "fact_refs": [f"fact-{index}" for index in range(201)]},
        {**valid, "fact_refs": ["fact-1", "fact-1"]},
        {**valid, "summary": ""},
        {**_no_material("吏部/任免司"), "summary": "not empty"},
        {**_no_material("吏部/任免司"), "decisions_needed": ["判断：x"]},
        {**_no_material("吏部/任免司"), "fact_refs": ["fact-1"]},
    ]
    for payload in invalid_payloads:
        with pytest.raises(ValidationError):
            BureauDailyResult.model_validate(payload)


def test_bureau_stage_creates_exactly_39_results_in_profile_order(tmp_path):
    from app.daily_memorial_drafts.workflow import run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id))

    progress = run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    assert progress.ready == 39
    assert progress.no_material == progress.retry_wait == progress.failed == 0
    assert [call.unit_key for call in invoker.calls] == [
        f"{profile.department}/{profile.bureau}" for profile in BUREAU_PROFILES
    ]
    assert {call.stage for call in invoker.calls} == {"BUREAU"}
    connection = sqlite3.connect(path)
    try:
        rows = connection.execute(
            "SELECT unit_key, status FROM daily_memorial_stage_results "
            "WHERE run_id = ? AND stage = 'BUREAU' ORDER BY rowid",
            (run.id,),
        ).fetchall()
    finally:
        connection.close()
    assert rows == [
        (f"{profile.department}/{profile.bureau}", "READY")
        for profile in BUREAU_PROFILES
    ]


def test_prompt_states_closed_fact_and_no_side_effect_rules(tmp_path):
    from app.daily_memorial_drafts.workflow import run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, _fact = _seed_run(path)
    invoker = FakeInvoker(lambda _index, unit_key: _no_material(unit_key))

    run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    prompt = invoker.calls[0].prompt
    assert "只能使用所提供的事实 ID" in prompt
    assert "[fact:<fact_id>]" in prompt
    assert "判断：" in prompt
    for forbidden_action in ("调查", "执行", "批准", "归档", "下旨"):
        assert forbidden_action in prompt


@pytest.mark.parametrize(
    ("result_factory", "failure_code"),
    [
        (
            lambda unit_key, _fact_id: _ready(unit_key, "not-in-snapshot"),
            "unsupported_fact_ref",
        ),
        (
            lambda unit_key, fact_id: _ready(
                unit_key, fact_id, summary="没有逐句引用的事实陈述。"
            ),
            "unsupported_factual_claim",
        ),
        (
            lambda unit_key, fact_id: _ready(
                unit_key, fact_id, summary=f"已调查相关事项[fact:{fact_id}]。"
            ),
            "forbidden_action_claim",
        ),
        (
            lambda _unit_key, fact_id: _ready("户部/预算司", fact_id),
            "unit_identity_mismatch",
        ),
    ],
)
def test_invalid_bureau_output_fails_closed_and_schedules_retry(
    tmp_path, result_factory, failure_code
):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(
        lambda _index, unit_key: result_factory(unit_key, fact.fact_id)
    )

    progress = run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)
    stored = load_stage_result(run.id, "BUREAU", invoker.calls[0].unit_key, db_path=path)

    assert progress.retry_wait == 1
    assert len(invoker.calls) == 1
    assert stored.status.value == "RETRY_WAIT"
    assert stored.failure_code == failure_code
    assert stored.attempts == 1
    assert stored.next_retry_at == NOW + timedelta(minutes=1)
    assert stored.output_json is None


def test_no_material_is_terminal_and_not_recalled_on_rerun(tmp_path):
    from app.daily_memorial_drafts.workflow import run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    first_key = f"{BUREAU_PROFILES[0].department}/{BUREAU_PROFILES[0].bureau}"
    first = FakeInvoker(
        lambda index, unit_key: _no_material(unit_key)
        if index == 0
        else (_ for _ in ()).throw(RuntimeError("offline model unavailable"))
    )

    first_progress = run_bureau_stage(run.id, invoker=first, now=NOW, db_path=path)
    assert first_progress.no_material == 1
    assert first_progress.retry_wait == 1

    early = FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id))
    early_progress = run_bureau_stage(
        run.id, invoker=early, now=NOW + timedelta(seconds=59), db_path=path
    )
    assert early.calls == []
    assert early_progress.no_material == 1
    assert early_progress.retry_wait == 1

    retry = FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id))
    completed = run_bureau_stage(
        run.id, invoker=retry, now=NOW + timedelta(minutes=1), db_path=path
    )
    assert completed.ready == 38
    assert completed.no_material == 1
    assert completed.retry_wait == completed.failed == 0
    assert first_key not in [call.unit_key for call in retry.calls]
    assert len(retry.calls) == 38


def test_duplicate_refs_are_rejected_with_stable_code(tmp_path):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)

    duplicate = FakeInvoker(
        lambda _index, unit_key: {
            **_ready(unit_key, fact.fact_id),
            "fact_refs": [fact.fact_id, fact.fact_id],
        }
    )
    run_bureau_stage(run.id, invoker=duplicate, now=NOW, db_path=path)
    duplicate_result = load_stage_result(
        run.id, "BUREAU", duplicate.calls[0].unit_key, db_path=path
    )
    assert duplicate_result.failure_code == "duplicate_fact_ref"


@pytest.mark.parametrize(
    ("judgment_ref_kind", "failure_code"),
    [
        ("unknown", "unsupported_fact_ref"),
        ("known_but_unlisted", "unsupported_factual_claim"),
    ],
)
def test_judgment_markers_are_checked_against_snapshot_and_fact_refs(
    tmp_path, judgment_ref_kind, failure_code
):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, listed_fact = _seed_run(path, include_second_fact=True)
    connection = sqlite3.connect(path)
    try:
        all_refs = [
            row[0]
            for row in connection.execute(
                "SELECT fact_id FROM daily_memorial_fact_snapshots "
                "WHERE run_id = ? ORDER BY fact_id",
                (run.id,),
            ).fetchall()
        ]
    finally:
        connection.close()
    marker_ref = (
        "not-in-snapshot"
        if judgment_ref_kind == "unknown"
        else next(ref for ref in all_refs if ref != listed_fact.fact_id)
    )
    invoker = FakeInvoker(
        lambda _index, unit_key: {
            **_ready(unit_key, listed_fact.fact_id),
            "decisions_needed": [f"判断：请关注另一材料[fact:{marker_ref}]。"],
        }
    )

    run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)
    stored = load_stage_result(run.id, "BUREAU", invoker.calls[0].unit_key, db_path=path)

    assert stored.failure_code == failure_code


@pytest.mark.parametrize(
    "completed_action",
    ["调查完毕", "执行完成", "批准通过", "归档完毕", "下旨完毕"],
)
def test_completed_action_synonyms_fail_closed(tmp_path, completed_action):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(
        lambda _index, unit_key: _ready(
            unit_key,
            fact.fact_id,
            summary=f"相关事项{completed_action}[fact:{fact.fact_id}]。",
        )
    )

    run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)
    stored = load_stage_result(run.id, "BUREAU", invoker.calls[0].unit_key, db_path=path)

    assert stored.failure_code == "forbidden_action_claim"


@pytest.mark.parametrize(
    "completed_action",
    ["完成了调查", "完成了执行", "完成了审批", "完成了归档", "完成了下旨"],
)
def test_completion_before_action_synonyms_fail_closed(tmp_path, completed_action):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(
        lambda _index, unit_key: _ready(
            unit_key,
            fact.fact_id,
            summary=f"本司{completed_action}[fact:{fact.fact_id}]。",
        )
    )

    run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)
    stored = load_stage_result(run.id, "BUREAU", invoker.calls[0].unit_key, db_path=path)

    assert stored.failure_code == "forbidden_action_claim"


def test_unrelated_negative_clause_does_not_hide_completed_action(tmp_path):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(
        lambda _index, unit_key: _ready(
            unit_key,
            fact.fact_id,
            summary=f"情况未明，调查完毕[fact:{fact.fact_id}]。",
        )
    )

    run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)
    stored = load_stage_result(run.id, "BUREAU", invoker.calls[0].unit_key, db_path=path)

    assert stored.failure_code == "forbidden_action_claim"


def test_negative_action_language_is_not_a_completed_action_claim(tmp_path):
    from app.daily_memorial_drafts.workflow import run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(
        lambda _index, unit_key: {
            **_ready(unit_key, fact.fact_id),
            "decisions_needed": [
                "判断：尚未完成调查；不得完成执行；批准尚未通过；"
                "归档尚未完成；不可完成下旨；没有完成核准；"
                "禁止完成核查；未完成施行。"
            ],
        }
    )

    progress = run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    assert progress.ready == 39


@pytest.mark.parametrize(
    "negated_action",
    ["未能完成调查", "未能完成执行", "未能完成审批", "未能完成归档", "未能完成下旨"],
)
def test_unable_to_complete_action_is_not_a_completed_claim(tmp_path, negated_action):
    from app.daily_memorial_drafts.workflow import run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    invoker = FakeInvoker(
        lambda _index, unit_key: {
            **_ready(unit_key, fact.fact_id),
            "decisions_needed": [f"判断：本司{negated_action}。"],
        }
    )

    progress = run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    assert progress.ready == 39


def test_mutated_response_model_is_strictly_revalidated(tmp_path):
    from app.daily_memorial_drafts.workflow import (
        BureauDailyResult,
        load_stage_result,
        run_bureau_stage,
    )

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)

    def mutated(_index, unit_key):
        result = BureauDailyResult.model_validate(_ready(unit_key, fact.fact_id))
        result.summary = "x" * 5013
        return result

    invoker = FakeInvoker(mutated)

    run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)
    stored = load_stage_result(run.id, "BUREAU", invoker.calls[0].unit_key, db_path=path)

    assert stored.failure_code == "invalid_structured_output"


def test_stale_running_lease_is_reclaimed_but_fresh_lease_is_not(tmp_path, monkeypatch):
    import app.daily_memorial_drafts.workflow as workflow

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    first = FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id))
    original_validate = workflow._validate_output

    with monkeypatch.context() as patcher:
        patcher.setattr(
            workflow,
            "_validate_output",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(KeyboardInterrupt()),
        )
        with pytest.raises(KeyboardInterrupt):
            workflow.run_bureau_stage(run.id, invoker=first, now=NOW, db_path=path)

    fresh = FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id))
    fresh_progress = workflow.run_bureau_stage(
        run.id,
        invoker=fresh,
        now=NOW + timedelta(minutes=29, seconds=59),
        db_path=path,
    )
    assert fresh.calls == []
    assert fresh_progress.running == 1

    monkeypatch.setattr(workflow, "_validate_output", original_validate)
    recovered = FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id))
    recovered_progress = workflow.run_bureau_stage(
        run.id,
        invoker=recovered,
        now=NOW + timedelta(minutes=30),
        db_path=path,
    )

    assert recovered_progress.ready == 39
    assert len(recovered.calls) == 39


def test_expired_bureau_lease_at_attempt_cap_fails_without_fifth_provider_call(
    tmp_path, monkeypatch
):
    import app.daily_memorial_drafts.workflow as workflow

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    unit_key = f"{BUREAU_PROFILES[0].department}/{BUREAU_PROFILES[0].bureau}"
    monkeypatch.setattr(
        workflow,
        "_validate_output",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(KeyboardInterrupt()),
    )
    with pytest.raises(KeyboardInterrupt):
        workflow.run_bureau_stage(
            run.id,
            invoker=FakeInvoker(lambda _index, key: _ready(key, fact.fact_id)),
            now=NOW,
            db_path=path,
        )
    _expire_running_at_attempt_cap(path, run.id, "BUREAU", unit_key)
    invoker = FakeInvoker(lambda _index, key: _ready(key, fact.fact_id))

    workflow.run_bureau_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    assert invoker.calls == []
    _assert_attempt_cap_failed_atomically(path, run.id, "BUREAU", unit_key)


def test_expired_ministry_lease_at_attempt_cap_fails_without_fifth_provider_call(
    tmp_path, monkeypatch
):
    import app.daily_memorial_drafts.workflow as workflow

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    workflow.run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, key: _ready(key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    unit_key = MINISTRIES[0]
    monkeypatch.setattr(
        workflow,
        "_validate_ministry_output",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(KeyboardInterrupt()),
    )
    with pytest.raises(KeyboardInterrupt):
        workflow.run_ministry_stage(
            run.id,
            invoker=FakeInvoker(
                lambda _index, key: _ministry_ready(key, fact.fact_id)
            ),
            now=NOW,
            db_path=path,
        )
    _expire_running_at_attempt_cap(path, run.id, "MINISTRY", unit_key)
    invoker = FakeInvoker(lambda _index, key: _ministry_ready(key, fact.fact_id))

    workflow.run_ministry_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    assert invoker.calls == []
    _assert_attempt_cap_failed_atomically(path, run.id, "MINISTRY", unit_key)


def test_expired_chancellor_lease_at_attempt_cap_fails_without_fifth_provider_call(
    tmp_path, monkeypatch
):
    import app.daily_memorial_drafts.workflow as workflow

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    workflow.run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, key: _ready(key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    workflow.run_ministry_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, key: _ministry_ready(key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    monkeypatch.setattr(
        workflow,
        "_validate_chancellor_output",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(KeyboardInterrupt()),
    )
    with pytest.raises(KeyboardInterrupt):
        workflow.run_chancellor_stage(
            run.id,
            invoker=FakeInvoker(
                lambda _index, _key: _chancellor_ready(fact.fact_id)
            ),
            now=NOW,
            db_path=path,
        )
    _expire_running_at_attempt_cap(path, run.id, "CHANCELLOR", "chancellor")
    invoker = FakeInvoker(lambda _index, _key: _chancellor_ready(fact.fact_id))

    workflow.run_chancellor_stage(run.id, invoker=invoker, now=NOW, db_path=path)

    assert invoker.calls == []
    _assert_attempt_cap_failed_atomically(path, run.id, "CHANCELLOR", "chancellor")


def test_invocation_failures_allow_three_retries_before_fourth_failure(tmp_path):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, _fact = _seed_run(path)
    unit_key = f"{BUREAU_PROFILES[0].department}/{BUREAU_PROFILES[0].bureau}"

    moments = [
        NOW,
        NOW + timedelta(minutes=1),
        NOW + timedelta(minutes=6),
        NOW + timedelta(minutes=36),
    ]
    expected_retries = [
        NOW + timedelta(minutes=1),
        NOW + timedelta(minutes=6),
        NOW + timedelta(minutes=36),
        None,
    ]
    for attempt, (moment, expected_retry) in enumerate(
        zip(moments, expected_retries, strict=True), start=1
    ):
        failing = FakeInvoker(
            lambda _index, _unit_key: (_ for _ in ()).throw(RuntimeError("secret"))
        )
        run_bureau_stage(run.id, invoker=failing, now=moment, db_path=path)
        stored = load_stage_result(run.id, "BUREAU", unit_key, db_path=path)
        assert stored.attempts == attempt
        assert stored.next_retry_at == expected_retry
        assert stored.status.value == ("FAILED" if attempt == 4 else "RETRY_WAIT")

    assert stored.status.value == "FAILED"
    assert stored.attempts == 4
    assert stored.failure_code == "invocation_failed"
    assert stored.next_retry_at is None


def test_ministry_and_chancellor_contracts_are_strict_and_bounded():
    from app.daily_memorial_drafts.models import (
        ChancellorDailyResult,
        MinistryDailyResult,
    )

    ministry = _ministry_ready("吏部", "fact-1")
    assert MinistryDailyResult.model_validate(ministry).department == "吏部"
    with pytest.raises(ValidationError):
        MinistryDailyResult.model_validate({**ministry, "unexpected": True})
    with pytest.raises(ValidationError):
        MinistryDailyResult.model_validate({**ministry, "summary": "x" * 6001})
    with pytest.raises(ValidationError):
        MinistryDailyResult.model_validate({**ministry, "fact_refs": []})

    chancellor = _chancellor_ready("fact-1")
    assert len(ChancellorDailyResult.model_validate(chancellor).ministry_sections) == 6
    with pytest.raises(ValidationError):
        ChancellorDailyResult.model_validate(
            {**chancellor, "ministry_sections": chancellor["ministry_sections"][:-1]}
        )
    with pytest.raises(ValidationError):
        ChancellorDailyResult.model_validate({**chancellor, "content": "x" * 40001})


def test_38_bureau_terminals_block_ministries_without_call(tmp_path):
    from app.daily_memorial_drafts.workflow import run_bureau_stage, run_ministry_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    bureau_invoker = FakeInvoker(
        lambda index, unit_key: _ready(unit_key, fact.fact_id)
        if index < 38
        else (_ for _ in ()).throw(RuntimeError("offline model unavailable"))
    )
    bureau_progress = run_bureau_stage(
        run.id, invoker=bureau_invoker, now=NOW, db_path=path
    )
    ministry_invoker = FakeInvoker(
        lambda _index, unit_key: _ministry_ready(unit_key, fact.fact_id)
    )

    progress = run_ministry_stage(
        run.id, invoker=ministry_invoker, now=NOW, db_path=path
    )

    assert bureau_progress.terminal == 38
    assert progress.terminal == 0
    assert ministry_invoker.calls == []


def test_39_bureaus_permit_six_ministries_in_fixed_order_with_own_inputs(tmp_path):
    from app.daily_memorial_drafts.workflow import run_bureau_stage, run_ministry_stage

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    ministry_invoker = FakeInvoker(
        lambda _index, unit_key: _ministry_ready(unit_key, fact.fact_id)
    )

    progress = run_ministry_stage(
        run.id, invoker=ministry_invoker, now=NOW, db_path=path
    )

    assert progress.ready == 6
    assert [call.unit_key for call in ministry_invoker.calls] == list(MINISTRIES)
    for call in ministry_invoker.calls:
        own_units = [
            f"{profile.department}/{profile.bureau}"
            for profile in BUREAU_PROFILES
            if profile.department == call.unit_key
        ]
        foreign_unit = next(
            f"{profile.department}/{profile.bureau}"
            for profile in BUREAU_PROFILES
            if profile.department != call.unit_key
        )
        assert all(unit in call.prompt for unit in own_units)
        assert foreign_unit not in call.prompt
        assert "只能使用所提供的事实 ID" in call.prompt
        assert "不得声称已经调查、执行、批准、归档或下旨" in call.prompt


def test_fewer_than_six_ministries_block_chancellor_without_call(tmp_path):
    from app.daily_memorial_drafts.workflow import (
        run_bureau_stage,
        run_chancellor_stage,
        run_ministry_stage,
    )

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    ministries = FakeInvoker(
        lambda index, unit_key: _ministry_ready(unit_key, fact.fact_id)
        if index < 5
        else (_ for _ in ()).throw(RuntimeError("offline model unavailable"))
    )
    progress = run_ministry_stage(run.id, invoker=ministries, now=NOW, db_path=path)
    chancellor = FakeInvoker(lambda _index, _unit_key: _chancellor_ready(fact.fact_id))

    unchanged = run_chancellor_stage(
        run.id, invoker=chancellor, now=NOW, db_path=path
    )

    assert progress.terminal == 5
    assert chancellor.calls == []
    assert unchanged.status.value == "GENERATING"


def test_six_ministries_create_one_canonical_version_one_draft_and_replay(tmp_path):
    from app.daily_memorial_drafts.workflow import advance_run

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)

    def factory(_index, unit_key):
        if "/" in unit_key:
            return _ready(unit_key, fact.fact_id)
        if unit_key in MINISTRIES:
            return _ministry_ready(unit_key, fact.fact_id)
        return _chancellor_ready(fact.fact_id)

    invoker = FakeInvoker(factory)
    completed = advance_run(run.id, invoker=invoker, now=NOW, db_path=path)

    assert completed.status.value == "READY_FOR_REVIEW"
    assert completed.version == 1
    assert completed.content == f"每日奏报待审总报[fact:{fact.fact_id}]。"
    assert completed.fact_refs == (fact.fact_id,)
    assert completed.fingerprint is not None
    assert len(completed.fingerprint) == 64
    assert completed.fingerprint == completed.fingerprint.lower()
    assert len(invoker.calls) == 46
    assert [call.stage for call in invoker.calls] == [
        *("BUREAU" for _ in range(39)),
        *("MINISTRY" for _ in range(6)),
        "CHANCELLOR",
    ]

    replay = FakeInvoker(lambda *_args: (_ for _ in ()).throw(AssertionError("recalled")))
    replayed = advance_run(run.id, invoker=replay, now=NOW, db_path=path)
    assert replayed == completed
    assert replay.calls == []
    connection = sqlite3.connect(path)
    try:
        rows = connection.execute(
            "SELECT unit_key, status FROM daily_memorial_stage_results "
            "WHERE run_id = ? AND stage = 'CHANCELLOR'",
            (run.id,),
        ).fetchall()
    finally:
        connection.close()
    assert rows == [("chancellor", "READY")]


@pytest.mark.parametrize("invalid_kind", ["foreign_ref", "wrong_roster_order"])
def test_chancellor_foreign_refs_and_wrong_roster_order_fail_closed(
    tmp_path, invalid_kind
):
    from app.daily_memorial_drafts.workflow import advance_run, load_stage_result

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)

    def factory(_index, unit_key):
        if "/" in unit_key:
            return _ready(unit_key, fact.fact_id)
        if unit_key in MINISTRIES:
            return _ministry_ready(unit_key, fact.fact_id)
        result = _chancellor_ready(fact.fact_id)
        if invalid_kind == "foreign_ref":
            result["fact_refs"] = ["foreign-fact"]
        else:
            result["ministry_sections"] = list(reversed(result["ministry_sections"]))
        return result

    failed = advance_run(
        run.id, invoker=FakeInvoker(factory), now=NOW, db_path=path
    )
    stored = load_stage_result(run.id, "CHANCELLOR", "chancellor", db_path=path)

    assert failed.status.value == "GENERATING"
    assert stored.status.value == "RETRY_WAIT"
    assert stored.failure_code in {"unsupported_fact_ref", "unit_identity_mismatch"}
    assert failed.version == 0
    assert failed.fingerprint is None
    assert failed.content is None


def test_chancellor_draft_adapter_fingerprint_ignores_display_key_order():
    from app.daily_memorial_drafts.models import ChancellorDailyResult
    from app.daily_memorial_drafts.workflow import adapt_chancellor_result_to_draft

    normal = _chancellor_ready("fact-1")
    reordered = {key: normal[key] for key in reversed(tuple(normal))}
    first = adapt_chancellor_result_to_draft(
        ChancellorDailyResult.model_validate(normal),
        input_fingerprints=("a" * 64, "b" * 64),
    )
    second = adapt_chancellor_result_to_draft(
        ChancellorDailyResult.model_validate(reordered),
        input_fingerprints=("a" * 64, "b" * 64),
    )

    assert first == second
    assert len(first.fingerprint) == 64


def test_stale_failed_run_blocks_chancellor_without_call(tmp_path):
    from app.daily_memorial_drafts.workflow import (
        run_bureau_stage,
        run_chancellor_stage,
        run_ministry_stage,
    )

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    run_ministry_stage(
        run.id,
        invoker=FakeInvoker(
            lambda _index, unit_key: _ministry_ready(unit_key, fact.fact_id)
        ),
        now=NOW,
        db_path=path,
    )
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE daily_memorial_runs SET status = 'FAILED', failure_code = 'stale' "
            "WHERE id = ?",
            (run.id,),
        )
        connection.commit()
    finally:
        connection.close()
    chancellor = FakeInvoker(lambda _index, _unit_key: _chancellor_ready(fact.fact_id))

    stale = run_chancellor_stage(
        run.id, invoker=chancellor, now=NOW, db_path=path
    )

    assert stale.status.value == "FAILED"
    assert chancellor.calls == []
    connection = sqlite3.connect(path)
    try:
        count = connection.execute(
            "SELECT COUNT(*) FROM daily_memorial_stage_results "
            "WHERE run_id = ? AND stage = 'CHANCELLOR'",
            (run.id,),
        ).fetchone()[0]
    finally:
        connection.close()
    assert count == 0


def _set_run_status(path, run_id: str, status: str, failure_code: str | None = None):
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "UPDATE daily_memorial_runs SET status = ?, failure_code = ? WHERE id = ?",
            (status, failure_code, run_id),
        )
        connection.commit()
    finally:
        connection.close()


@pytest.mark.parametrize("entrypoint", ["advance", "ministry"])
def test_failed_run_after_39_bureaus_blocks_ministry_entrypoints_without_call(
    tmp_path, entrypoint
):
    from app.daily_memorial_drafts.workflow import (
        advance_run,
        run_bureau_stage,
        run_ministry_stage,
    )

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    _set_run_status(path, run.id, "FAILED", "preexisting_failure")
    invoker = FakeInvoker(
        lambda _index, unit_key: _ministry_ready(unit_key, fact.fact_id)
    )

    if entrypoint == "advance":
        result = advance_run(run.id, invoker=invoker, now=NOW, db_path=path)
    else:
        progress = run_ministry_stage(
            run.id, invoker=invoker, now=NOW, db_path=path
        )
        result = None

    assert invoker.calls == []
    if result is not None:
        assert result.status.value == "FAILED"
        assert result.failure_code == "preexisting_failure"
    else:
        assert progress.terminal == 0


def test_aggregate_claim_rechecks_generating_status_after_precheck(
    tmp_path, monkeypatch
):
    import app.daily_memorial_drafts.workflow as workflow

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    workflow.run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    original_claim = workflow._claim_aggregate_unit
    flipped = False

    def flip_then_claim(*args, **kwargs):
        nonlocal flipped
        if not flipped:
            flipped = True
            _set_run_status(path, run.id, "FAILED", "concurrent_failure")
        return original_claim(*args, **kwargs)

    monkeypatch.setattr(workflow, "_claim_aggregate_unit", flip_then_claim)
    invoker = FakeInvoker(
        lambda _index, unit_key: _ministry_ready(unit_key, fact.fact_id)
    )

    progress = workflow.run_ministry_stage(
        run.id, invoker=invoker, now=NOW, db_path=path
    )

    assert flipped is True
    assert invoker.calls == []
    assert progress.running == 0
    connection = sqlite3.connect(path)
    try:
        status = connection.execute(
            "SELECT status FROM daily_memorial_runs WHERE id = ?", (run.id,)
        ).fetchone()[0]
    finally:
        connection.close()
    assert status == "FAILED"


def test_bureau_exhaustion_atomically_fails_run_and_keeps_checkpoints(tmp_path):
    from app.daily_memorial_drafts.workflow import load_stage_result, run_bureau_stage

    path = tmp_path / "shiguan.sqlite3"
    run, _fact = _seed_run(path)
    unit_key = f"{BUREAU_PROFILES[0].department}/{BUREAU_PROFILES[0].bureau}"
    for moment in (
        NOW,
        NOW + timedelta(minutes=1),
        NOW + timedelta(minutes=6),
        NOW + timedelta(minutes=36),
    ):
        run_bureau_stage(
            run.id,
            invoker=FakeInvoker(
                lambda _index, _unit_key: (_ for _ in ()).throw(RuntimeError("x"))
            ),
            now=moment,
            db_path=path,
        )

    stored = load_stage_result(run.id, "BUREAU", unit_key, db_path=path)
    connection = sqlite3.connect(path)
    try:
        run_row = connection.execute(
            "SELECT status, failure_code FROM daily_memorial_runs WHERE id = ?",
            (run.id,),
        ).fetchone()
    finally:
        connection.close()
    assert stored.status.value == "FAILED"
    assert run_row == ("FAILED", "invocation_failed")


def test_ministry_exhaustion_atomically_fails_run_and_keeps_bureaus(tmp_path):
    from app.daily_memorial_drafts.workflow import (
        load_stage_result,
        run_bureau_stage,
        run_ministry_stage,
    )

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    for moment in (
        NOW,
        NOW + timedelta(minutes=1),
        NOW + timedelta(minutes=6),
        NOW + timedelta(minutes=36),
    ):
        run_ministry_stage(
            run.id,
            invoker=FakeInvoker(
                lambda _index, _unit_key: (_ for _ in ()).throw(RuntimeError("x"))
            ),
            now=moment,
            db_path=path,
        )

    stored = load_stage_result(run.id, "MINISTRY", MINISTRIES[0], db_path=path)
    connection = sqlite3.connect(path)
    try:
        run_row = connection.execute(
            "SELECT status, failure_code FROM daily_memorial_runs WHERE id = ?",
            (run.id,),
        ).fetchone()
        bureau_ready = connection.execute(
            "SELECT COUNT(*) FROM daily_memorial_stage_results "
            "WHERE run_id = ? AND stage = 'BUREAU' AND status = 'READY'",
            (run.id,),
        ).fetchone()[0]
    finally:
        connection.close()
    assert stored.status.value == "FAILED"
    assert stored.attempts == 4
    assert run_row == ("FAILED", "invocation_failed")
    assert bureau_ready == 39


def test_chancellor_exhaustion_atomically_fails_run_and_keeps_ministries(tmp_path):
    from app.daily_memorial_drafts.workflow import (
        load_stage_result,
        run_bureau_stage,
        run_chancellor_stage,
        run_ministry_stage,
    )

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)
    run_bureau_stage(
        run.id,
        invoker=FakeInvoker(lambda _index, unit_key: _ready(unit_key, fact.fact_id)),
        now=NOW,
        db_path=path,
    )
    run_ministry_stage(
        run.id,
        invoker=FakeInvoker(
            lambda _index, unit_key: _ministry_ready(unit_key, fact.fact_id)
        ),
        now=NOW,
        db_path=path,
    )
    for moment in (
        NOW,
        NOW + timedelta(minutes=1),
        NOW + timedelta(minutes=6),
        NOW + timedelta(minutes=36),
    ):
        run_chancellor_stage(
            run.id,
            invoker=FakeInvoker(
                lambda _index, _unit_key: (_ for _ in ()).throw(RuntimeError("x"))
            ),
            now=moment,
            db_path=path,
        )

    stored = load_stage_result(run.id, "CHANCELLOR", "chancellor", db_path=path)
    connection = sqlite3.connect(path)
    try:
        run_row = connection.execute(
            "SELECT status, failure_code FROM daily_memorial_runs WHERE id = ?",
            (run.id,),
        ).fetchone()
        ministry_ready = connection.execute(
            "SELECT COUNT(*) FROM daily_memorial_stage_results "
            "WHERE run_id = ? AND stage = 'MINISTRY' AND status = 'READY'",
            (run.id,),
        ).fetchone()[0]
    finally:
        connection.close()
    assert stored.status.value == "FAILED"
    assert stored.attempts == 4
    assert run_row == ("FAILED", "invocation_failed")
    assert ministry_ready == 6


@pytest.mark.parametrize(
    ("column", "mutated_value"),
    [
        ("report_date", "2026-08-03"),
        ("source_window_start", "2026-08-03T00:00:00+08:00"),
        ("source_window_end", "2026-08-06T00:00:00+08:00"),
    ],
)
def test_chancellor_finalization_rejects_mutated_run_identity(
    tmp_path, column, mutated_value
):
    from app.daily_memorial_drafts.workflow import advance_run

    path = tmp_path / "shiguan.sqlite3"
    run, fact = _seed_run(path)

    def factory(_index, unit_key):
        if "/" in unit_key:
            return _ready(unit_key, fact.fact_id)
        if unit_key in MINISTRIES:
            return _ministry_ready(unit_key, fact.fact_id)
        connection = sqlite3.connect(path)
        try:
            connection.execute(
                f"UPDATE daily_memorial_runs SET {column} = ? WHERE id = ?",
                (mutated_value, run.id),
            )
            connection.commit()
        finally:
            connection.close()
        return _chancellor_ready(fact.fact_id)

    result = advance_run(
        run.id, invoker=FakeInvoker(factory), now=NOW, db_path=path
    )

    assert result.status.value == "GENERATING"
    assert result.version == 0
    assert result.fingerprint is None
    assert result.content is None
