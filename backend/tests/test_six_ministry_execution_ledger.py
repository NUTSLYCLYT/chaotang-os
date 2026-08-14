from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime

import pytest

from app.agents.runtime_skills.execution_ledger import (
    ExecutionLedgerError,
    ExecutionScopeBinding,
    ResourceBindingConflict,
    ResourceKind,
    RuntimeBindingLedger,
    RuntimeResourceBinding,
)


def _binding(**updates: object) -> RuntimeResourceBinding:
    values: dict[str, object] = {
        "binding_id": "binding:report-1",
        "scope": ExecutionScopeBinding(
            scope_mode="owner_only",
            tenant_id=None,
            owner_user_id="owner-a",
            run_id="job-1",
            decree_id="job-1",
            case_id="case-1",
            draft_fingerprint="a" * 64,
            route_digest="b" * 64,
        ),
        "resource_kind": ResourceKind.MINISTRY_REPORT,
        "resource_ref": "ministry-report:1",
        "resource_version": "1.0.0",
        "content_digest": "c" * 64,
        "parent_binding_ids": ("binding:bureau-1",),
        "created_at": datetime(2026, 8, 14, tzinfo=UTC),
    }
    values.update(updates)
    return RuntimeResourceBinding(**values)


def test_append_and_owner_run_scoped_reload(tmp_path) -> None:
    ledger = RuntimeBindingLedger(tmp_path / "bindings.sqlite3")
    expected = _binding()

    assert ledger.append(expected) == expected
    assert ledger.append(expected) == expected
    assert (
        ledger.get_for_execution(
            expected.binding_id, owner_user_id="owner-a", run_id="job-1"
        )
        == expected
    )


@pytest.mark.parametrize(
    ("owner", "run"), (("owner-b", "job-1"), ("owner-a", "job-2"))
)
def test_cross_scope_lookup_is_indistinguishable_from_absent(tmp_path, owner, run) -> None:
    ledger = RuntimeBindingLedger(tmp_path / "bindings.sqlite3")
    ledger.append(_binding())

    with pytest.raises(
        ExecutionLedgerError, match="record_not_found_or_not_authorized"
    ):
        ledger.get_for_execution("binding:report-1", owner_user_id=owner, run_id=run)


def test_immutable_identity_rejects_changed_digest(tmp_path) -> None:
    ledger = RuntimeBindingLedger(tmp_path / "bindings.sqlite3")
    original = _binding()
    ledger.append(original)

    with pytest.raises(ResourceBindingConflict, match="runtime_binding_conflict"):
        ledger.append(original.model_copy(update={"content_digest": "d" * 64}))


def test_database_triggers_reject_update_and_delete(tmp_path) -> None:
    path = tmp_path / "bindings.sqlite3"
    ledger = RuntimeBindingLedger(path)
    ledger.append(_binding())
    connection = sqlite3.connect(path)
    try:
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            connection.execute(
                "UPDATE runtime_resource_bindings SET content_digest = ?",
                ("d" * 64,),
            )
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            connection.execute("DELETE FROM runtime_resource_bindings")
    finally:
        connection.close()


@pytest.mark.parametrize(
    ("column", "value"),
    (
        ("owner_user_id", "owner-b"),
        ("run_id", "job-2"),
        ("decree_id", "job-2"),
        ("content_digest", "d" * 64),
    ),
)
def test_reload_fails_closed_when_row_metadata_drifts_from_canonical_binding(
    tmp_path, column, value
) -> None:
    path = tmp_path / "bindings.sqlite3"
    ledger = RuntimeBindingLedger(path)
    expected = _binding()
    ledger.append(expected)

    connection = sqlite3.connect(path)
    try:
        connection.execute("DROP TRIGGER runtime_bindings_no_update")
        connection.execute(
            f"UPDATE runtime_resource_bindings SET {column} = ? WHERE binding_id = ?",
            (value, expected.binding_id),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(
        ExecutionLedgerError, match="runtime_binding_store_unavailable"
    ):
        ledger.get_for_execution(
            expected.binding_id,
            owner_user_id="owner-a" if column != "owner_user_id" else "owner-b",
            run_id="job-1" if column != "run_id" else "job-2",
        )


def test_reload_fails_closed_when_canonical_scope_drifts_from_index_columns(
    tmp_path,
) -> None:
    path = tmp_path / "bindings.sqlite3"
    ledger = RuntimeBindingLedger(path)
    expected = _binding()
    ledger.append(expected)
    forged = expected.model_copy(
        update={
            "scope": expected.scope.model_copy(update={"owner_user_id": "owner-b"})
        }
    )

    connection = sqlite3.connect(path)
    try:
        connection.execute("DROP TRIGGER runtime_bindings_no_update")
        connection.execute(
            "UPDATE runtime_resource_bindings SET canonical_json = ? WHERE binding_id = ?",
            (
                json.dumps(
                    forged.model_dump(mode="json"),
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                ),
                expected.binding_id,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    with pytest.raises(
        ExecutionLedgerError, match="runtime_binding_store_unavailable"
    ):
        ledger.get_for_execution(
            expected.binding_id, owner_user_id="owner-a", run_id="job-1"
        )


def test_scope_is_owner_only_and_decree_is_current_job() -> None:
    with pytest.raises(ValueError):
        ExecutionScopeBinding(
            scope_mode="tenant",
            tenant_id="tenant-a",
            owner_user_id="owner-a",
            run_id="job-1",
            decree_id="job-1",
            draft_fingerprint="a" * 64,
            route_digest="b" * 64,
        )
    with pytest.raises(ValueError, match="decree_run_binding_mismatch"):
        ExecutionScopeBinding(
            scope_mode="owner_only",
            tenant_id=None,
            owner_user_id="owner-a",
            run_id="job-1",
            decree_id="job-2",
            draft_fingerprint="a" * 64,
            route_digest="b" * 64,
        )


def test_unknown_fields_fail_closed() -> None:
    with pytest.raises(ValueError):
        RuntimeResourceBinding.model_validate(
            {**_binding().model_dump(mode="python"), "verified": True}
        )
