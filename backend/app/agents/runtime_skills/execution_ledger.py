"""Append-only scope bindings for governed RuntimeSkill resources.

This ledger is deliberately not an Evidence or capability registry.  Evidence
content stays in Jinyiwei, accounting artifacts stay in ArtifactStorage, and
skill definitions stay in the downstream RuntimeSkill registry.  The ledger
only proves which immutable resource identity and digest were bound to one
owner-scoped decree execution.
"""

from __future__ import annotations

import json
import re
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "data" / "runtime_bindings.sqlite3"


class ExecutionLedgerError(RuntimeError):
    """Stable redacted storage failure."""


class ResourceBindingConflict(ExecutionLedgerError):
    """An immutable resource identity was replayed with different content."""


class ResourceKind(StrEnum):
    EVIDENCE_PACK = "evidence_pack"
    ACCOUNTING_WORK_PRODUCT = "accounting_work_product"
    CONFIRMATION_RECEIPT = "confirmation_receipt"
    BUREAU_REPORT = "bureau_report"
    MINISTRY_REPORT = "ministry_report"
    COUNCIL_REPORT = "council_report"
    JUNJICHU_CASE_RECEIPT = "junjichu_case_receipt"
    DECISION_ENVELOPE = "decision_envelope"


class _FrozenContract(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class ExecutionScopeBinding(_FrozenContract):
    scope_mode: str = Field(pattern=r"^owner_only$")
    tenant_id: None = None
    owner_user_id: str = Field(min_length=1, max_length=256)
    run_id: str = Field(min_length=1, max_length=256)
    decree_id: str = Field(min_length=1, max_length=256)
    case_id: str | None = Field(default=None, min_length=1, max_length=256)
    draft_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    route_digest: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def bind_decree_to_current_job(self) -> ExecutionScopeBinding:
        if self.decree_id != self.run_id:
            raise ValueError("decree_run_binding_mismatch")
        return self


class RuntimeResourceBinding(_FrozenContract):
    binding_id: str = Field(min_length=1, max_length=256)
    scope: ExecutionScopeBinding
    resource_kind: ResourceKind
    resource_ref: str = Field(min_length=1, max_length=512)
    resource_version: str = Field(min_length=1, max_length=128)
    content_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    parent_binding_ids: tuple[str, ...] = Field(default=(), max_length=128)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("parent_binding_ids")
    @classmethod
    def require_unique_parent_bindings(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(set(value)) != len(value) or any(not item.strip() for item in value):
            raise ValueError("parent_bindings_invalid")
        return value


def _canonical(binding: RuntimeResourceBinding) -> str:
    return json.dumps(
        binding.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _binding_from_row(row: sqlite3.Row) -> RuntimeResourceBinding:
    try:
        binding = RuntimeResourceBinding.model_validate_json(row["canonical_json"])
        stored_at = datetime.fromisoformat(row["created_at"])
        if stored_at.utcoffset() is None:
            raise ValueError("stored binding timestamp must be timezone-aware")
        if (
            _canonical(binding) != row["canonical_json"]
            or binding.binding_id != row["binding_id"]
            or binding.scope.owner_user_id != row["owner_user_id"]
            or binding.scope.run_id != row["run_id"]
            or binding.scope.decree_id != row["decree_id"]
            or binding.scope.case_id != row["case_id"]
            or binding.resource_kind.value != row["resource_kind"]
            or binding.resource_ref != row["resource_ref"]
            or binding.resource_version != row["resource_version"]
            or binding.content_digest != row["content_digest"]
            or binding.created_at.astimezone(UTC) != stored_at.astimezone(UTC)
        ):
            raise ValueError("runtime binding row metadata drift")
    except (KeyError, TypeError, ValueError) as exc:
        raise ExecutionLedgerError("runtime_binding_store_unavailable") from exc
    return binding


class RuntimeBindingLedger:
    """Append-only owner/run-scoped resource binding store."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        try:
            with closing(self._connect()) as connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS runtime_resource_bindings (
                        binding_id TEXT PRIMARY KEY,
                        owner_user_id TEXT NOT NULL,
                        run_id TEXT NOT NULL,
                        decree_id TEXT NOT NULL,
                        case_id TEXT,
                        resource_kind TEXT NOT NULL,
                        resource_ref TEXT NOT NULL,
                        resource_version TEXT NOT NULL,
                        content_digest TEXT NOT NULL,
                        canonical_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        UNIQUE (
                            owner_user_id, run_id, resource_kind,
                            resource_ref, resource_version
                        )
                    );
                    CREATE TRIGGER IF NOT EXISTS runtime_bindings_no_update
                    BEFORE UPDATE ON runtime_resource_bindings
                    BEGIN
                        SELECT RAISE(ABORT, 'runtime bindings are immutable');
                    END;
                    CREATE TRIGGER IF NOT EXISTS runtime_bindings_no_delete
                    BEFORE DELETE ON runtime_resource_bindings
                    BEGIN
                        SELECT RAISE(ABORT, 'runtime bindings are immutable');
                    END;
                    """
                )
                connection.commit()
        except (OSError, sqlite3.Error) as exc:
            raise ExecutionLedgerError("runtime_binding_store_unavailable") from exc

    def append(self, binding: RuntimeResourceBinding) -> RuntimeResourceBinding:
        if not isinstance(binding, RuntimeResourceBinding):
            raise TypeError("binding must be RuntimeResourceBinding")
        canonical = _canonical(binding)
        try:
            with closing(self._connect()) as connection:
                existing = connection.execute(
                    "SELECT * FROM runtime_resource_bindings "
                    "WHERE binding_id = ? OR "
                    "(owner_user_id = ? AND run_id = ? AND resource_kind = ? "
                    "AND resource_ref = ? AND resource_version = ?)",
                    (
                        binding.binding_id,
                        binding.scope.owner_user_id,
                        binding.scope.run_id,
                        binding.resource_kind.value,
                        binding.resource_ref,
                        binding.resource_version,
                    ),
                ).fetchone()
                if existing is not None:
                    persisted = _binding_from_row(existing)
                    if persisted != binding or existing["canonical_json"] != canonical:
                        raise ResourceBindingConflict("runtime_binding_conflict")
                    return persisted
                connection.execute(
                    """
                    INSERT INTO runtime_resource_bindings (
                        binding_id, owner_user_id, run_id, decree_id, case_id,
                        resource_kind, resource_ref, resource_version,
                        content_digest, canonical_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        binding.binding_id,
                        binding.scope.owner_user_id,
                        binding.scope.run_id,
                        binding.scope.decree_id,
                        binding.scope.case_id,
                        binding.resource_kind.value,
                        binding.resource_ref,
                        binding.resource_version,
                        binding.content_digest,
                        canonical,
                        binding.created_at.astimezone(UTC).isoformat(),
                    ),
                )
                connection.commit()
                return binding
        except ResourceBindingConflict:
            raise
        except (OSError, sqlite3.Error) as exc:
            raise ExecutionLedgerError("runtime_binding_store_unavailable") from exc

    def get_for_execution(
        self, binding_id: str, *, owner_user_id: str, run_id: str
    ) -> RuntimeResourceBinding:
        if not binding_id.strip() or not owner_user_id.strip() or not run_id.strip():
            raise ValueError("runtime_binding_lookup_invalid")
        try:
            with closing(self._connect()) as connection:
                row = connection.execute(
                    "SELECT * FROM runtime_resource_bindings "
                    "WHERE binding_id = ? AND owner_user_id = ? AND run_id = ?",
                    (binding_id, owner_user_id, run_id),
                ).fetchone()
        except (OSError, sqlite3.Error) as exc:
            raise ExecutionLedgerError("runtime_binding_store_unavailable") from exc
        if row is None:
            raise ExecutionLedgerError("record_not_found_or_not_authorized")
        binding = _binding_from_row(row)
        if not _SHA256.fullmatch(binding.content_digest):
            raise ExecutionLedgerError("runtime_binding_store_unavailable")
        return binding


__all__ = [
    "DEFAULT_DB_PATH",
    "ExecutionLedgerError",
    "ExecutionScopeBinding",
    "ResourceBindingConflict",
    "ResourceKind",
    "RuntimeBindingLedger",
    "RuntimeResourceBinding",
]
