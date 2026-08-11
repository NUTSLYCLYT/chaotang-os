"""Isolated SQLite connection and schema management for Jinyiwei."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

from pydantic import ValidationError

from app.jinyiwei.models import DataGapRequest

_BACKEND_DATA_PATH = Path(__file__).resolve().parents[2] / "data"
DEFAULT_DB_PATH = _BACKEND_DATA_PATH / "jinyiwei.sqlite3"
SHIGUAN_DB_PATH = _BACKEND_DATA_PATH / "shiguan.sqlite3"
_BUSY_TIMEOUT_MS = 5_000

_V4_REQUIRED_SCHEMA_COLUMNS = {
    "data_gap_requests": {
        "request_id", "fingerprint", "requesting_agent", "question",
        "decision_context", "freshness_json", "existing_evidence_ids_json",
        "timeout_seconds", "source_scope_json", "canonical_json",
    },
    "requested_fact_slots": {
        "request_id", "ordinal", "fact_key", "description", "category",
        "data_scope", "subject", "jurisdiction", "expected_unit", "expected_shape",
    },
    "investigations": {
        "investigation_id", "request_id", "status", "plan_json",
        "resolved_facts_json", "unresolved_facts_json", "conflicts_json",
        "do_not_infer_json", "started_at", "completed_at",
    },
    "source_attempts": {
        "investigation_id", "ordinal", "source_type", "source_name", "status",
        "started_at", "completed_at", "error", "facts_attempted_json",
        "call_audits_json",
    },
    "evidence_items": {
        "evidence_id", "fact_key", "value_json", "unit", "as_of", "retrieved_at",
        "source_url", "publisher", "source_type", "quality", "stance", "excerpt",
        "content_hash", "confidence", "model_json",
    },
    "evidence_packs": {
        "pack_id", "investigation_id", "canonical_json", "content_hash",
    },
    "pack_items": {"pack_id", "evidence_id", "fact_key", "ordinal"},
    "cache_entries": {
        "fingerprint", "pack_id", "cached_at", "expires_at", "hit_count", "last_hit_at",
    },
    "evidence_adoptions": {
        "evidence_id", "reply_id", "status", "created_at", "updated_at", "confirmed_at",
    },
    "adoption_batches": {
        "reply_id", "evidence_ids_json", "batch_fingerprint", "created_at", "updated_at",
    },
}

_REQUIRED_SCHEMA_COLUMNS = {
    **_V4_REQUIRED_SCHEMA_COLUMNS,
    "data_gap_requests": _V4_REQUIRED_SCHEMA_COLUMNS["data_gap_requests"]
    | {"owner_user_id"},
    "cache_entries": _V4_REQUIRED_SCHEMA_COLUMNS["cache_entries"]
    | {"owner_user_id"},
    "evidence_adoptions": _V4_REQUIRED_SCHEMA_COLUMNS["evidence_adoptions"]
    | {"owner_user_id"},
    "adoption_batches": _V4_REQUIRED_SCHEMA_COLUMNS["adoption_batches"]
    | {"owner_user_id"},
}

_V2_REQUIRED_SCHEMA_COLUMNS = {
    "data_gap_requests": {
        "request_id", "fingerprint", "requesting_agent", "question",
        "decision_context", "freshness_json", "existing_evidence_ids_json",
        "timeout_seconds", "source_scope_json", "canonical_json",
    },
    "requested_fact_slots": {
        "request_id", "ordinal", "fact_key", "description", "category",
        "data_scope", "subject", "jurisdiction", "expected_unit", "expected_shape",
    },
    "investigations": {
        "investigation_id", "request_id", "status", "plan_json",
        "resolved_facts_json", "unresolved_facts_json", "conflicts_json",
        "do_not_infer_json", "started_at", "completed_at",
    },
    "source_attempts": {
        "investigation_id", "ordinal", "source_type", "source_name", "status",
        "started_at", "completed_at", "error", "facts_attempted_json",
    },
    "evidence_items": {
        "evidence_id", "fact_key", "value_json", "unit", "as_of", "retrieved_at",
        "source_url", "publisher", "source_type", "quality", "stance", "excerpt",
        "content_hash", "confidence", "model_json",
    },
    "evidence_packs": {
        "pack_id", "investigation_id", "canonical_json", "content_hash",
    },
    "pack_items": {"pack_id", "evidence_id", "fact_key", "ordinal"},
    "cache_entries": {
        "fingerprint", "pack_id", "cached_at", "expires_at", "hit_count", "last_hit_at",
    },
    "evidence_adoptions": {
        "evidence_id", "reply_id", "status", "created_at", "updated_at", "confirmed_at",
    },
}

_V2_ADDITIONAL_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS investigations (
        investigation_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        status TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        resolved_facts_json TEXT NOT NULL,
        unresolved_facts_json TEXT NOT NULL,
        conflicts_json TEXT NOT NULL,
        do_not_infer_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES data_gap_requests(request_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS source_attempts (
        investigation_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        error TEXT,
        facts_attempted_json TEXT NOT NULL,
        PRIMARY KEY (investigation_id, ordinal),
        FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence_items (
        evidence_id TEXT PRIMARY KEY,
        fact_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        unit TEXT,
        as_of TEXT NOT NULL,
        retrieved_at TEXT NOT NULL,
        source_url TEXT NOT NULL,
        publisher TEXT NOT NULL,
        source_type TEXT NOT NULL,
        quality TEXT NOT NULL,
        stance TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        confidence REAL NOT NULL,
        model_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence_packs (
        pack_id TEXT PRIMARY KEY,
        investigation_id TEXT NOT NULL UNIQUE,
        canonical_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pack_items (
        pack_id TEXT NOT NULL,
        evidence_id TEXT NOT NULL,
        fact_key TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        PRIMARY KEY (pack_id, fact_key, ordinal),
        UNIQUE (pack_id, evidence_id),
        FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id),
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cache_entries (
        fingerprint TEXT PRIMARY KEY,
        pack_id TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_hit_at TEXT,
        FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence_adoptions (
        evidence_id TEXT NOT NULL,
        reply_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        PRIMARY KEY (evidence_id, reply_id),
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id)
    )
    """,
)

_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS data_gap_requests (
        request_id TEXT PRIMARY KEY,
        owner_user_id TEXT,
        fingerprint TEXT NOT NULL,
        requesting_agent TEXT NOT NULL,
        question TEXT NOT NULL,
        decision_context TEXT NOT NULL,
        freshness_json TEXT NOT NULL,
        existing_evidence_ids_json TEXT NOT NULL,
        timeout_seconds INTEGER NOT NULL,
        source_scope_json TEXT NOT NULL,
        canonical_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS requested_fact_slots (
        request_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        fact_key TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        data_scope TEXT NOT NULL,
        subject TEXT NOT NULL,
        jurisdiction TEXT,
        expected_unit TEXT,
        expected_shape TEXT,
        PRIMARY KEY (request_id, ordinal),
        UNIQUE (request_id, fact_key),
        FOREIGN KEY (request_id) REFERENCES data_gap_requests(request_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS investigations (
        investigation_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        status TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        resolved_facts_json TEXT NOT NULL,
        unresolved_facts_json TEXT NOT NULL,
        conflicts_json TEXT NOT NULL,
        do_not_infer_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES data_gap_requests(request_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS source_attempts (
        investigation_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        error TEXT,
        facts_attempted_json TEXT NOT NULL,
        call_audits_json TEXT NOT NULL,
        PRIMARY KEY (investigation_id, ordinal),
        FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence_items (
        evidence_id TEXT PRIMARY KEY,
        fact_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        unit TEXT,
        as_of TEXT NOT NULL,
        retrieved_at TEXT NOT NULL,
        source_url TEXT NOT NULL,
        publisher TEXT NOT NULL,
        source_type TEXT NOT NULL,
        quality TEXT NOT NULL,
        stance TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        confidence REAL NOT NULL,
        model_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence_packs (
        pack_id TEXT PRIMARY KEY,
        investigation_id TEXT NOT NULL UNIQUE,
        canonical_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pack_items (
        pack_id TEXT NOT NULL,
        evidence_id TEXT NOT NULL,
        fact_key TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        PRIMARY KEY (pack_id, fact_key, ordinal),
        UNIQUE (pack_id, evidence_id),
        FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id),
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cache_entries (
        owner_user_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        pack_id TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_hit_at TEXT,
        PRIMARY KEY (owner_user_id, fingerprint),
        FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS evidence_adoptions (
        owner_user_id TEXT,
        evidence_id TEXT NOT NULL,
        reply_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        PRIMARY KEY (owner_user_id, evidence_id, reply_id),
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS adoption_batches (
        owner_user_id TEXT,
        reply_id TEXT NOT NULL,
        evidence_ids_json TEXT NOT NULL,
        batch_fingerprint TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_user_id, reply_id)
    )
    """,
)


class ForbiddenDatabasePathError(RuntimeError):
    """The configured path points at another domain's runtime database."""


def _validated_target(path: Path | None) -> Path:
    target = path if path is not None else DEFAULT_DB_PATH
    resolved = target.resolve(strict=False)
    if resolved == SHIGUAN_DB_PATH.resolve(strict=False):
        raise ForbiddenDatabasePathError("Jinyiwei cannot use the Shiguan database")
    return resolved


def _configure(connection: sqlite3.Connection) -> None:
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(f"PRAGMA busy_timeout = {_BUSY_TIMEOUT_MS}")


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in connection.execute(f"PRAGMA table_info({table})")}


def _migrate_v1_to_v2(connection: sqlite3.Connection) -> None:
    legacy_columns = _table_columns(connection, "requested_fact_slots")
    expected_legacy_columns = {
        "request_id",
        "ordinal",
        "fact_key",
        "description",
        "expected_unit",
        "expected_shape",
    }
    if legacy_columns != expected_legacy_columns:
        raise sqlite3.DatabaseError("invalid legacy fact slot")

    connection.execute(
        """
        CREATE TABLE requested_fact_slots_v2 (
            request_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            fact_key TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            data_scope TEXT NOT NULL,
            subject TEXT NOT NULL,
            jurisdiction TEXT,
            expected_unit TEXT,
            expected_shape TEXT,
            PRIMARY KEY (request_id, ordinal),
            UNIQUE (request_id, fact_key),
            FOREIGN KEY (request_id) REFERENCES data_gap_requests(request_id)
        )
        """
    )
    try:
        request_rows = connection.execute(
            "SELECT * FROM data_gap_requests ORDER BY request_id"
        ).fetchall()
        for request_row in request_rows:
            request = DataGapRequest.model_validate_json(request_row["canonical_json"])
            expected_request_columns = {
                "request_id": request.request_id,
                "fingerprint": request.request_fingerprint,
                "requesting_agent": request.requesting_agent,
                "question": request.question,
                "decision_context": request.decision_context,
                "freshness_json": request.freshness.model_dump(mode="json"),
                "existing_evidence_ids_json": list(request.existing_evidence_ids),
                "timeout_seconds": request.timeout_seconds,
                "source_scope_json": [source.value for source in request.source_scope],
            }
            for column, expected in expected_request_columns.items():
                actual = (
                    json.loads(request_row[column])
                    if column.endswith("_json")
                    else request_row[column]
                )
                if actual != expected:
                    raise ValueError("request columns mismatch")
            legacy_rows = connection.execute(
                "SELECT ordinal, fact_key, description, expected_unit, expected_shape "
                "FROM requested_fact_slots WHERE request_id = ? ORDER BY ordinal",
                (request.request_id,),
            ).fetchall()
            expected_rows = [
                (
                    ordinal,
                    fact.key,
                    fact.description,
                    fact.expected_unit,
                    fact.expected_shape,
                )
                for ordinal, fact in enumerate(request.required_facts)
            ]
            if [tuple(row) for row in legacy_rows] != expected_rows:
                raise ValueError("fact slot mismatch")
            for ordinal, fact in enumerate(request.required_facts):
                connection.execute(
                    """
                    INSERT INTO requested_fact_slots_v2 (
                        request_id, ordinal, fact_key, description, category,
                        data_scope, subject, jurisdiction, expected_unit, expected_shape
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        request.request_id,
                        ordinal,
                        fact.key,
                        fact.description,
                        fact.category.value,
                        fact.data_scope.value,
                        fact.subject,
                        fact.jurisdiction,
                        fact.expected_unit,
                        fact.expected_shape,
                    ),
                )
        orphan_count = connection.execute(
            """
            SELECT COUNT(*) FROM requested_fact_slots AS f
            LEFT JOIN data_gap_requests AS r ON r.request_id = f.request_id
            WHERE r.request_id IS NULL
            """
        ).fetchone()[0]
        if orphan_count:
            raise ValueError("orphan fact slot")
    except (
        ValidationError,
        ValueError,
        TypeError,
        KeyError,
    ) as exc:
        raise sqlite3.DatabaseError("invalid legacy fact slot") from exc

    connection.execute("DROP TABLE requested_fact_slots")
    connection.execute("ALTER TABLE requested_fact_slots_v2 RENAME TO requested_fact_slots")
    for statement in _V2_ADDITIONAL_SCHEMA:
        connection.execute(statement)


def _assert_v2_schema(connection: sqlite3.Connection) -> None:
    for table, expected_columns in _V2_REQUIRED_SCHEMA_COLUMNS.items():
        if _table_columns(connection, table) != expected_columns:
            raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")

    fact_info = {
        row["name"]: row
        for row in connection.execute("PRAGMA table_info(requested_fact_slots)")
    }
    required_not_null = {
        "request_id", "ordinal", "fact_key", "description", "category",
        "data_scope", "subject",
    }
    if any(fact_info[column]["notnull"] != 1 for column in required_not_null):
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")
    if fact_info["request_id"]["pk"] != 1 or fact_info["ordinal"]["pk"] != 2:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")

    unique_indexes = []
    for index in connection.execute("PRAGMA index_list(requested_fact_slots)"):
        if index["unique"]:
            unique_indexes.append(
                tuple(
                    row["name"]
                    for row in connection.execute(f"PRAGMA index_info({index['name']})")
                )
            )
    if ("request_id", "fact_key") not in unique_indexes:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")
    foreign_keys = {
        (row["from"], row["table"], row["to"])
        for row in connection.execute("PRAGMA foreign_key_list(requested_fact_slots)")
    }
    if ("request_id", "data_gap_requests", "request_id") not in foreign_keys:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")


def _assert_v3_schema(connection: sqlite3.Connection) -> None:
    _assert_v2_schema(connection)
    if (
        _table_columns(connection, "adoption_batches")
        != _V4_REQUIRED_SCHEMA_COLUMNS["adoption_batches"]
    ):
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v3")


def _assert_v4_schema(connection: sqlite3.Connection) -> None:
    for table, expected_columns in _V4_REQUIRED_SCHEMA_COLUMNS.items():
        if _table_columns(connection, table) != expected_columns:
            raise sqlite3.DatabaseError("invalid Jinyiwei schema v4")
    audit_info = {
        row["name"]: row
        for row in connection.execute("PRAGMA table_info(source_attempts)")
    }
    if audit_info["call_audits_json"]["notnull"] != 1:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v4")


def _migrate_v3_to_v4(connection: sqlite3.Connection) -> None:
    _assert_v3_schema(connection)
    legacy_columns = _V4_REQUIRED_SCHEMA_COLUMNS["source_attempts"] - {
        "call_audits_json"
    }
    actual_columns = _table_columns(connection, "source_attempts")
    if actual_columns == _V4_REQUIRED_SCHEMA_COLUMNS["source_attempts"]:
        rows = connection.execute(
            "SELECT call_audits_json FROM source_attempts"
        ).fetchall()
        try:
            if any(json.loads(row["call_audits_json"]) != [] for row in rows):
                raise ValueError("unexpected v3 call audit")
        except (TypeError, json.JSONDecodeError, ValueError) as exc:
            raise sqlite3.DatabaseError("invalid Jinyiwei schema v3") from exc
        return
    if actual_columns != legacy_columns:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v3")
    connection.execute(
        "ALTER TABLE source_attempts "
        "ADD COLUMN call_audits_json TEXT NOT NULL DEFAULT '[]'"
    )


def _migrate_v2_to_v3(connection: sqlite3.Connection) -> None:
    if not _table_columns(connection, "adoption_batches"):
        connection.execute(
            """
            CREATE TABLE adoption_batches (
                reply_id TEXT PRIMARY KEY,
                evidence_ids_json TEXT NOT NULL,
                batch_fingerprint TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
    if (
        _table_columns(connection, "adoption_batches")
        != _V4_REQUIRED_SCHEMA_COLUMNS["adoption_batches"]
    ):
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")
    if connection.execute("SELECT COUNT(*) FROM adoption_batches").fetchone()[0]:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2")
    reply_rows = connection.execute(
        "SELECT DISTINCT reply_id FROM evidence_adoptions ORDER BY reply_id ASC"
    ).fetchall()
    try:
        for reply_row in reply_rows:
            reply_id = reply_row["reply_id"]
            adoption_rows = connection.execute(
                "SELECT evidence_id, created_at, updated_at "
                "FROM evidence_adoptions WHERE reply_id = ? "
                "ORDER BY evidence_id ASC",
                (reply_id,),
            ).fetchall()
            evidence_ids = [row["evidence_id"] for row in adoption_rows]
            identities = []
            for evidence_id in evidence_ids:
                evidence_row = connection.execute(
                    "SELECT model_json FROM evidence_items WHERE evidence_id = ?",
                    (evidence_id,),
                ).fetchone()
                if evidence_row is None:
                    raise ValueError("adoption evidence missing")
                item_json = json.loads(evidence_row["model_json"])
                identity = json.dumps(
                    {
                        key: value
                        for key, value in item_json.items()
                        if key != "retrieved_at"
                    },
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                )
                identities.append(
                    {"evidence_id": evidence_id, "identity": identity}
                )
            canonical_identities = json.dumps(
                identities,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
            connection.execute(
                "INSERT INTO adoption_batches "
                "(reply_id, evidence_ids_json, batch_fingerprint, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    reply_id,
                    json.dumps(
                        evidence_ids,
                        ensure_ascii=False,
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                    hashlib.sha256(canonical_identities.encode()).hexdigest(),
                    min(row["created_at"] for row in adoption_rows),
                    max(row["updated_at"] for row in adoption_rows),
                ),
            )
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v2") from exc


def _migrate_v4_to_v5(connection: sqlite3.Connection) -> None:
    _assert_v4_schema(connection)
    connection.execute("ALTER TABLE data_gap_requests ADD COLUMN owner_user_id TEXT")
    connection.execute(
        "CREATE INDEX data_gap_requests_owner_idx "
        "ON data_gap_requests(owner_user_id)"
    )
    connection.execute(
        """
        CREATE TABLE cache_entries_v5 (
            owner_user_id TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            pack_id TEXT NOT NULL,
            cached_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            hit_count INTEGER NOT NULL DEFAULT 0,
            last_hit_at TEXT,
            PRIMARY KEY (owner_user_id, fingerprint),
            FOREIGN KEY (pack_id) REFERENCES evidence_packs(pack_id)
        )
        """
    )
    connection.execute("DROP TABLE cache_entries")
    connection.execute("ALTER TABLE cache_entries_v5 RENAME TO cache_entries")
    connection.execute(
        """
        CREATE TABLE evidence_adoptions_v5 (
            owner_user_id TEXT,
            evidence_id TEXT NOT NULL,
            reply_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            confirmed_at TEXT,
            PRIMARY KEY (owner_user_id, evidence_id, reply_id),
            FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id)
        )
        """
    )
    connection.execute(
        "INSERT INTO evidence_adoptions_v5 "
        "(owner_user_id, evidence_id, reply_id, status, created_at, updated_at, confirmed_at) "
        "SELECT NULL, evidence_id, reply_id, status, created_at, updated_at, confirmed_at "
        "FROM evidence_adoptions"
    )
    connection.execute("DROP TABLE evidence_adoptions")
    connection.execute(
        "ALTER TABLE evidence_adoptions_v5 RENAME TO evidence_adoptions"
    )
    connection.execute(
        """
        CREATE TABLE adoption_batches_v5 (
            owner_user_id TEXT,
            reply_id TEXT NOT NULL,
            evidence_ids_json TEXT NOT NULL,
            batch_fingerprint TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (owner_user_id, reply_id)
        )
        """
    )
    connection.execute(
        "INSERT INTO adoption_batches_v5 "
        "(owner_user_id, reply_id, evidence_ids_json, batch_fingerprint, created_at, updated_at) "
        "SELECT NULL, reply_id, evidence_ids_json, batch_fingerprint, created_at, updated_at "
        "FROM adoption_batches"
    )
    connection.execute("DROP TABLE adoption_batches")
    connection.execute("ALTER TABLE adoption_batches_v5 RENAME TO adoption_batches")


def _assert_v5_schema(connection: sqlite3.Connection) -> None:
    for table, expected_columns in _REQUIRED_SCHEMA_COLUMNS.items():
        if _table_columns(connection, table) != expected_columns:
            raise sqlite3.DatabaseError("invalid Jinyiwei schema v5")
    request_info = {
        row["name"]: row
        for row in connection.execute("PRAGMA table_info(data_gap_requests)")
    }
    cache_info = {
        row["name"]: row
        for row in connection.execute("PRAGMA table_info(cache_entries)")
    }
    adoption_info = {
        row["name"]: row
        for row in connection.execute("PRAGMA table_info(evidence_adoptions)")
    }
    batch_info = {
        row["name"]: row
        for row in connection.execute("PRAGMA table_info(adoption_batches)")
    }
    if request_info["owner_user_id"]["notnull"] != 0:
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v5")
    if (
        cache_info["owner_user_id"]["notnull"] != 1
        or cache_info["owner_user_id"]["pk"] != 1
        or cache_info["fingerprint"]["pk"] != 2
    ):
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v5")
    if (
        adoption_info["owner_user_id"]["notnull"] != 0
        or adoption_info["owner_user_id"]["pk"] != 1
        or adoption_info["evidence_id"]["pk"] != 2
        or adoption_info["reply_id"]["pk"] != 3
        or batch_info["owner_user_id"]["notnull"] != 0
        or batch_info["owner_user_id"]["pk"] != 1
        or batch_info["reply_id"]["pk"] != 2
    ):
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v5")
    request_indexes = {
        row["name"]: row
        for row in connection.execute("PRAGMA index_list(data_gap_requests)")
    }
    owner_index = request_indexes.get("data_gap_requests_owner_idx")
    owner_index_columns = (
        tuple(
            column["name"]
            for column in connection.execute(
                "PRAGMA index_info(data_gap_requests_owner_idx)"
            )
        )
        if owner_index is not None
        else ()
    )
    if (
        owner_index is None
        or owner_index["unique"] != 0
        or owner_index["partial"] != 0
        or owner_index_columns != ("owner_user_id",)
    ):
        raise sqlite3.DatabaseError("invalid Jinyiwei schema v5")


def initialize_database(path: Path | None = None) -> None:
    """Create or atomically migrate the schema to v5; repeated calls are safe."""
    target = _validated_target(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target)
    try:
        _configure(connection)
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, 1, 2, 3, 4, 5):
            raise sqlite3.DatabaseError("unsupported Jinyiwei schema version")
        if version == 0:
            for statement in _SCHEMA:
                connection.execute(statement)
        if version == 1:
            _migrate_v1_to_v2(connection)
        if version in (1, 2):
            _assert_v2_schema(connection)
            _migrate_v2_to_v3(connection)
        if version in (1, 2, 3):
            _migrate_v3_to_v4(connection)
        if version in (1, 2, 3, 4):
            _migrate_v4_to_v5(connection)
        connection.execute(
            "CREATE INDEX IF NOT EXISTS data_gap_requests_owner_idx "
            "ON data_gap_requests(owner_user_id)"
        )
        _assert_v5_schema(connection)
        connection.execute("PRAGMA user_version = 5")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def get_connection(path: Path | None = None) -> sqlite3.Connection:
    """Return a newly opened, configured connection owned by the caller."""
    target = _validated_target(path)
    initialize_database(target)
    connection = sqlite3.connect(target)
    _configure(connection)
    return connection
