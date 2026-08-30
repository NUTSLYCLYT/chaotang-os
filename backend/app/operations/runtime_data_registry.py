"""Closed runtime SQLite registry and deterministic schema observation.

This module is the single fact source shared by readiness, backup and release
evidence.  It contains no production paths and accepts no environment or
caller supplied registry extensions.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

REGISTRY_SCHEMA_VERSION = "chaotang.runtime-data-registry.v3"
SCHEMA_CONTRACT_VERSION = "chaotang.sqlite-schema-contract.v1"
_VERIFICATION_TIMESTAMP_PATTERN = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"
)
_DECREE_JOB_SCHEMA_CONTRACT_DIGESTS = (
    "sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d",
    "sha256:5372895aff08d4b39a19c4100b1b30ec8eaf7a9e597960425fee13c52552f5e3",
)


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _digest(value: Any) -> str:
    return f"sha256:{hashlib.sha256(_canonical_bytes(value)).hexdigest()}"


def _canonical_sql(value: object) -> str | None:
    if value is None:
        return None
    return str(value).replace("\r\n", "\n").strip(" \t\r\n")


@dataclass(frozen=True)
class RuntimeDataEntry:
    name: str
    relative_path: str
    user_version: int
    required_tables: tuple[str, ...]
    required_triggers: tuple[str, ...]
    schema_contract_digests: tuple[str, ...]
    artifact_root: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.schema_contract_digests, tuple):
            raise ValueError("schema contract digests must be a tuple")
        if not self.schema_contract_digests:
            raise ValueError("schema contract digests must be nonempty")
        if len(self.schema_contract_digests) != len(set(self.schema_contract_digests)):
            raise ValueError("schema contract digests must be unique")
        if not all(
            re.fullmatch(r"sha256:[0-9a-f]{64}", digest)
            for digest in self.schema_contract_digests
        ):
            raise ValueError("schema contract digests must be canonical sha256 values")
        if (
            self.name == "decree_jobs.sqlite3"
            and self.schema_contract_digests != _DECREE_JOB_SCHEMA_CONTRACT_DIGESTS
        ):
            raise ValueError("decree job schema contract digests are closed and ordered")

    @property
    def max_user_version(self) -> int:
        """Compatibility name for the exact (not ranged) schema version."""

        return self.user_version

    @property
    def schema_contract_digest(self) -> str:
        """Preserve singleton callers without inventing a multi-digest default."""

        if len(self.schema_contract_digests) != 1:
            raise ValueError("multiple schema contract digests have no singular default")
        return self.schema_contract_digests[0]

    def as_contract(self) -> dict[str, Any]:
        return {
            "artifactRoot": self.artifact_root,
            "name": self.name,
            "relativePath": self.relative_path,
            "requiredTables": list(self.required_tables),
            "requiredTriggers": list(self.required_triggers),
            "schemaContractDigests": list(self.schema_contract_digests),
            "userVersion": self.user_version,
        }


def observe_schema_contract_connection(
    connection: sqlite3.Connection,
) -> dict[str, Any]:
    """Project a caller-owned, already opened SQLite connection."""

    previous_factory = connection.row_factory
    connection.row_factory = None
    try:
        previous_query_only = int(
            connection.execute("PRAGMA query_only").fetchone()[0]
        )
    except Exception:
        connection.row_factory = previous_factory
        raise
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only = ON")
        user_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        master = connection.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE type IN ('table','index','trigger') ORDER BY type,name"
        ).fetchall()
        table_rows = [row for row in master if row["type"] == "table"]
        trigger_rows = [row for row in master if row["type"] == "trigger"]
        index_rows = [row for row in master if row["type"] == "index"]

        tables = [
            {"name": str(row["name"]), "sql": _canonical_sql(row["sql"])}
            for row in table_rows
            if not str(row["name"]).startswith("sqlite_")
        ]
        triggers = [
            {
                "name": str(row["name"]),
                "sql": _canonical_sql(row["sql"]),
                "table": str(row["tbl_name"]),
            }
            for row in trigger_rows
        ]
        indexes: list[dict[str, Any]] = []
        for row in index_rows:
            name = str(row["name"])
            table = str(row["tbl_name"])
            index_list = {
                str(item[1]): item
                for item in connection.execute(f"PRAGMA index_list({json.dumps(table)})").fetchall()
            }
            detail = index_list.get(name)
            indexes.append(
                {
                    "columns": [
                        str(item[2])
                        for item in connection.execute(
                            f"PRAGMA index_info({json.dumps(name)})"
                        ).fetchall()
                    ],
                    "name": name,
                    "origin": str(detail[3]) if detail is not None else "",
                    "partial": bool(detail[4]) if detail is not None else False,
                    "sql": _canonical_sql(row["sql"]),
                    "table": table,
                    "unique": bool(detail[2]) if detail is not None else False,
                }
            )

        columns: list[dict[str, Any]] = []
        foreign_keys: list[dict[str, Any]] = []
        for table in tables:
            name = table["name"]
            for row in connection.execute(f"PRAGMA table_info({json.dumps(name)})").fetchall():
                columns.append(
                    {
                        "cid": int(row[0]),
                        "default": row[4],
                        "name": str(row[1]),
                        "notNull": bool(row[3]),
                        "primaryKeyOrdinal": int(row[5]),
                        "table": name,
                        "type": str(row[2]),
                    }
                )
            for row in connection.execute(
                f"PRAGMA foreign_key_list({json.dumps(name)})"
            ).fetchall():
                foreign_keys.append(
                    {
                        "from": str(row[3]),
                        "id": int(row[0]),
                        "match": str(row[7]),
                        "onDelete": str(row[6]),
                        "onUpdate": str(row[5]),
                        "sequence": int(row[1]),
                        "table": name,
                        "targetColumn": str(row[4]),
                        "targetTable": str(row[2]),
                    }
                )
        return {
            "columns": columns,
            "foreignKeys": foreign_keys,
            "indexes": indexes,
            "schemaVersion": SCHEMA_CONTRACT_VERSION,
            "tables": tables,
            "triggers": triggers,
            "userVersion": user_version,
        }
    finally:
        connection.row_factory = previous_factory
        connection.execute(f"PRAGMA query_only = {previous_query_only}")


def observe_schema_contract(path: Path) -> dict[str, Any]:
    """Return the complete deterministic SQLite schema projection for ``path``."""

    resolved = Path(path).resolve(strict=True)
    connection = sqlite3.connect(f"{resolved.as_uri()}?mode=ro", uri=True)
    try:
        return observe_schema_contract_connection(connection)
    finally:
        connection.close()


def schema_contract_digest(path: Path) -> str:
    return _digest(observe_schema_contract(path))


def schema_contract_digest_connection(connection: sqlite3.Connection) -> str:
    return _digest(observe_schema_contract_connection(connection))


def is_verified_migration_state(rows: Sequence[Sequence[object]]) -> bool:
    """Return whether rows encode the one canonical verified-v6 state."""

    if len(rows) != 1 or tuple(rows[0][:2]) != (1, "VERIFIED"):
        return False
    verified_at = rows[0][2]
    if not isinstance(verified_at, str) or not _VERIFICATION_TIMESTAMP_PATTERN.fullmatch(
        verified_at
    ):
        return False
    try:
        datetime.strptime(verified_at, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        return False
    return True


# Digests are literal observations of the accepted ext-dev storage schemas.
# They are deliberately not derived from writable source modules at runtime.
SHIGUAN_V5_PREDECESSOR = RuntimeDataEntry(
    "shiguan.sqlite3",
    "shiguan.sqlite3",
    5,
    (
        "archive_decisions",
        "archive_evidence",
        "archive_evidence_references",
        "archive_relations",
        "archive_review_status",
        "archives",
        "auth_sessions",
        "daily_memorial_fact_snapshots",
        "daily_memorial_runs",
        "daily_memorial_stage_results",
        "users",
    ),
    (),
    ("sha256:be55daeb1f9fa9602915351b8b26831103557a54bfa628a4c3bac70e14da8493",),
)

# The explicit v1→v2→v3→v4→v5 migration chain preserves the original
# archives table's physical SQL while producing the same validated logical
# columns and relations. This second literal contract is the only additional
# accepted v5 predecessor; arbitrary schema drift remains rejected.
SHIGUAN_V5_HISTORICAL_PREDECESSOR = RuntimeDataEntry(
    "shiguan.sqlite3",
    "shiguan.sqlite3",
    5,
    SHIGUAN_V5_PREDECESSOR.required_tables,
    (),
    ("sha256:b99c42f729b16d6134d71cd77a894270fef79f192466e651407df5941fc8ab02",),
)
SHIGUAN_V5_DIRECT_AUTH_HISTORICAL_PREDECESSOR = RuntimeDataEntry(
    "shiguan.sqlite3",
    "shiguan.sqlite3",
    5,
    SHIGUAN_V5_PREDECESSOR.required_tables,
    (),
    ("sha256:5e94f8c4540705e1bce67e012af857691aa6d9bb3b4e7ce77e332dc1ece5077f",),
)
SHIGUAN_V5_EVOLVED_AUTH_HISTORICAL_PREDECESSOR = RuntimeDataEntry(
    "shiguan.sqlite3",
    "shiguan.sqlite3",
    5,
    SHIGUAN_V5_PREDECESSOR.required_tables,
    (),
    ("sha256:0fba339d71e9e0eea0c5605a4b9b2fb49f919c9d7504242660cf6a83eb1c2b8e",),
)
SHIGUAN_V5_PREDECESSORS = (
    SHIGUAN_V5_PREDECESSOR,
    SHIGUAN_V5_HISTORICAL_PREDECESSOR,
    SHIGUAN_V5_DIRECT_AUTH_HISTORICAL_PREDECESSOR,
    SHIGUAN_V5_EVOLVED_AUTH_HISTORICAL_PREDECESSOR,
)


RUNTIME_DATA_ENTRIES = (
    RuntimeDataEntry(
        "decree_jobs.sqlite3",
        "decree_jobs.sqlite3",
        0,
        ("decree_job_idempotency_keys", "decree_jobs"),
        (),
        _DECREE_JOB_SCHEMA_CONTRACT_DIGESTS,
    ),
    RuntimeDataEntry(
        "jinyiwei.sqlite3",
        "jinyiwei.sqlite3",
        5,
        (
            "adoption_batches",
            "cache_entries",
            "data_gap_requests",
            "evidence_adoptions",
            "evidence_items",
            "evidence_packs",
            "investigations",
            "pack_items",
            "requested_fact_slots",
            "source_attempts",
        ),
        (),
        ("sha256:16a0978427dae6005f9040ac25d38e07526eedca25abd8b6f622eecaf7ea75aa",),
    ),
    RuntimeDataEntry(
        "junjichu_cases.sqlite3",
        "junjichu_cases.sqlite3",
        0,
        ("junjichu_cases", "junjichu_runtime_reports"),
        (
            "junjichu_case_execution_binding_immutable",
            "junjichu_case_terminal_immutable",
            "junjichu_runtime_reports_no_delete",
            "junjichu_runtime_reports_no_update",
        ),
        ("sha256:1fede14376500aae9c4fc3df8a1c625c1d7d3a224cc416cd126fa674b0130574",),
    ),
    RuntimeDataEntry(
        "qintianjian.sqlite3",
        "qintianjian.sqlite3",
        0,
        ("forecasts", "reviews"),
        (),
        ("sha256:b8773991e0bff936235f0b82f9daca1aea7bcc6e9a25ae7689af9ddddce01c01",),
    ),
    RuntimeDataEntry(
        "report_artifacts.sqlite3",
        "report_artifacts.sqlite3",
        0,
        ("confirmation_receipts", "report_artifacts", "work_product_artifacts", "work_products"),
        (
            "confirmation_receipts_apply_decision",
            "confirmation_receipts_guard_insert",
            "confirmation_receipts_no_delete",
            "confirmation_receipts_no_update",
            "work_product_artifacts_no_delete",
            "work_product_artifacts_no_update",
            "work_products_guard_update",
            "work_products_no_delete",
        ),
        ("sha256:e4828afc1e1bc909d2fd1e726ec14333bdbf7aae6c3f37e22ed9e1dcf7f38e07",),
        "report_artifacts",
    ),
    RuntimeDataEntry(
        "runtime_bindings.sqlite3",
        "runtime_bindings.sqlite3",
        0,
        ("runtime_resource_bindings",),
        ("runtime_bindings_no_delete", "runtime_bindings_no_update"),
        ("sha256:46f9467f83f08b48e0f82c167c77d716ca527288e06dd7cdccebf8812e23b09b",),
    ),
    RuntimeDataEntry(
        "shiguan.sqlite3",
        "shiguan.sqlite3",
        6,
        (
            "archive_decisions",
            "archive_evidence",
            "archive_evidence_references",
            "archive_relations",
            "archive_review_status",
            "archives",
            "auth_sessions",
            "daily_memorial_fact_snapshots",
            "daily_memorial_runs",
            "daily_memorial_stage_results",
            "schema_migration_verification",
            "tenant_memberships",
            "tenants",
            "users",
        ),
        (
            "auth_sessions_guard_insert",
            "auth_sessions_guard_update",
            "schema_migration_verification_guard_insert",
            "schema_migration_verification_guard_update",
            "schema_migration_verification_no_delete",
            "tenant_memberships_guard_insert",
            "tenant_memberships_guard_update",
            "tenant_memberships_no_delete",
            "tenants_guard_insert",
            "tenants_guard_update",
            "tenants_no_delete",
        ),
        ("sha256:6c8cf1368bae53cd0c80b10ca5e2a82603c2b47dd43dd38f550622fffec4ccc7",),
    ),
)


def registry_document() -> dict[str, Any]:
    payload = {
        "entries": [entry.as_contract() for entry in RUNTIME_DATA_ENTRIES],
        "schemaVersion": REGISTRY_SCHEMA_VERSION,
    }
    return {**payload, "registryDigest": _digest(payload)}


RUNTIME_DATA_REGISTRY = registry_document()
RUNTIME_DATA_REGISTRY_DIGEST = str(RUNTIME_DATA_REGISTRY["registryDigest"])


def validate_registered_schema(path: Path, entry: RuntimeDataEntry) -> bool:
    try:
        resolved = Path(path).resolve(strict=True)
        connection = sqlite3.connect(f"{resolved.as_uri()}?mode=ro", uri=True)
    except (OSError, sqlite3.Error, ValueError):
        return False
    try:
        return validate_registered_schema_connection(connection, entry)
    finally:
        connection.close()


def validate_registered_schema_connection(
    connection: sqlite3.Connection,
    entry: RuntimeDataEntry,
) -> bool:
    """Validate structure and current-runtime semantic state on a caller-owned connection."""

    return validated_registered_schema_digest_connection(connection, entry) is not None


def validated_registered_schema_digest_connection(
    connection: sqlite3.Connection,
    entry: RuntimeDataEntry,
) -> str | None:
    """Return the actual accepted digest observed on this connection, or fail closed."""

    try:
        observed = observe_schema_contract_connection(connection)
        actual_digest = _digest(observed)
        if not (
            observed["userVersion"] == entry.user_version
            and tuple(item["name"] for item in observed["tables"]) == entry.required_tables
            and tuple(item["name"] for item in observed["triggers"])
            == entry.required_triggers
            and actual_digest in entry.schema_contract_digests
        ):
            return None
        if entry.name == "shiguan.sqlite3" and entry.user_version >= 6:
            previous_factory = connection.row_factory
            connection.row_factory = None
            try:
                rows = connection.execute(
                    "SELECT id,status,verified_at FROM schema_migration_verification"
                ).fetchall()
            finally:
                connection.row_factory = previous_factory
            if not is_verified_migration_state(rows):
                return None
        return actual_digest
    except (OSError, sqlite3.Error, TypeError, ValueError):
        return None


__all__ = [
    "REGISTRY_SCHEMA_VERSION",
    "RUNTIME_DATA_ENTRIES",
    "RUNTIME_DATA_REGISTRY",
    "RUNTIME_DATA_REGISTRY_DIGEST",
    "SHIGUAN_V5_HISTORICAL_PREDECESSOR",
    "SHIGUAN_V5_DIRECT_AUTH_HISTORICAL_PREDECESSOR",
    "SHIGUAN_V5_EVOLVED_AUTH_HISTORICAL_PREDECESSOR",
    "SHIGUAN_V5_PREDECESSOR",
    "SHIGUAN_V5_PREDECESSORS",
    "RuntimeDataEntry",
    "observe_schema_contract",
    "observe_schema_contract_connection",
    "is_verified_migration_state",
    "registry_document",
    "schema_contract_digest",
    "schema_contract_digest_connection",
    "validate_registered_schema",
    "validate_registered_schema_connection",
    "validated_registered_schema_digest_connection",
]
