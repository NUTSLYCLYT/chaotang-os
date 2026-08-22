"""Closed runtime SQLite registry and deterministic schema observation.

This module is the single fact source shared by readiness, backup and release
evidence.  It contains no production paths and accepts no environment or
caller supplied registry extensions.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REGISTRY_SCHEMA_VERSION = "chaotang.runtime-data-registry.v2"
SCHEMA_CONTRACT_VERSION = "chaotang.sqlite-schema-contract.v1"


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
    schema_contract_digest: str
    artifact_root: str | None = None

    @property
    def max_user_version(self) -> int:
        """Compatibility name for the exact (not ranged) schema version."""

        return self.user_version

    def as_contract(self) -> dict[str, Any]:
        return {
            "artifactRoot": self.artifact_root,
            "name": self.name,
            "relativePath": self.relative_path,
            "requiredTables": list(self.required_tables),
            "requiredTriggers": list(self.required_triggers),
            "schemaContractDigest": self.schema_contract_digest,
            "userVersion": self.user_version,
        }


def observe_schema_contract_connection(
    connection: sqlite3.Connection,
) -> dict[str, Any]:
    """Project a caller-owned, already opened SQLite connection."""

    previous_factory = connection.row_factory
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


# Digests are literal observations of the accepted ext-dev storage schemas.
# They are deliberately not derived from writable source modules at runtime.
RUNTIME_DATA_ENTRIES = (
    RuntimeDataEntry(
        "decree_jobs.sqlite3",
        "decree_jobs.sqlite3",
        0,
        ("decree_job_idempotency_keys", "decree_jobs"),
        (),
        "sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d",
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
        "sha256:16a0978427dae6005f9040ac25d38e07526eedca25abd8b6f622eecaf7ea75aa",
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
        "sha256:1fede14376500aae9c4fc3df8a1c625c1d7d3a224cc416cd126fa674b0130574",
    ),
    RuntimeDataEntry(
        "qintianjian.sqlite3",
        "qintianjian.sqlite3",
        0,
        ("forecasts", "reviews"),
        (),
        "sha256:b8773991e0bff936235f0b82f9daca1aea7bcc6e9a25ae7689af9ddddce01c01",
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
        "sha256:e4828afc1e1bc909d2fd1e726ec14333bdbf7aae6c3f37e22ed9e1dcf7f38e07",
        "report_artifacts",
    ),
    RuntimeDataEntry(
        "runtime_bindings.sqlite3",
        "runtime_bindings.sqlite3",
        0,
        ("runtime_resource_bindings",),
        ("runtime_bindings_no_delete", "runtime_bindings_no_update"),
        "sha256:46f9467f83f08b48e0f82c167c77d716ca527288e06dd7cdccebf8812e23b09b",
    ),
    RuntimeDataEntry(
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
        "sha256:be55daeb1f9fa9602915351b8b26831103557a54bfa628a4c3bac70e14da8493",
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
        observed = observe_schema_contract(path)
    except (OSError, sqlite3.Error, ValueError):
        return False
    return (
        observed["userVersion"] == entry.user_version
        and tuple(item["name"] for item in observed["tables"]) == entry.required_tables
        and tuple(item["name"] for item in observed["triggers"]) == entry.required_triggers
        and _digest(observed) == entry.schema_contract_digest
    )


__all__ = [
    "REGISTRY_SCHEMA_VERSION",
    "RUNTIME_DATA_ENTRIES",
    "RUNTIME_DATA_REGISTRY",
    "RUNTIME_DATA_REGISTRY_DIGEST",
    "RuntimeDataEntry",
    "observe_schema_contract",
    "observe_schema_contract_connection",
    "registry_document",
    "schema_contract_digest",
    "schema_contract_digest_connection",
    "validate_registered_schema",
]
