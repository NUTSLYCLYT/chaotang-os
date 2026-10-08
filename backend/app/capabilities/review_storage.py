"""SQLite persistence for Honglusi CRM provider reviews."""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from .contracts import CrmProviderReview

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "honglusi.sqlite3"
_configured_db_path: Path | None = None


def configure_review_db(path: Path | None) -> None:
    global _configured_db_path
    _configured_db_path = path


def _connection() -> sqlite3.Connection:
    target = _configured_db_path or _DEFAULT_DB_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target)
    connection.row_factory = sqlite3.Row
    connection.execute(
        "CREATE TABLE IF NOT EXISTS crm_provider_reviews ("
        "provider TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL"
        ")"
    )
    connection.commit()
    return connection


def _default_twenty_review() -> CrmProviderReview:
    return CrmProviderReview(
        provider="twenty",
        capability_id="provider.twenty.crm.read.v1",
        review_status="approved",
        allowed_actions=["read"],
        forbidden_actions=[
            "external write",
            "credential access or export",
            "unapproved endpoint access",
            "cross-tenant data reuse",
        ],
        evidence_sources=[
            "docs/product/tasks/2026-10-09-twenty-provider-pre-review.md",
            "backend/app/bingbu/adapters/twenty.py",
        ],
        reviewed_by="honglusi-review-board",
        reviewed_at=datetime(2026, 10, 1, tzinfo=UTC),
        expires_at=datetime(2027, 1, 1, tzinfo=UTC),
    )


def get_crm_provider_review(provider: str) -> CrmProviderReview | None:
    normalized = provider.strip().lower()
    with _connection() as connection:
        row = connection.execute(
            "SELECT payload_json FROM crm_provider_reviews WHERE provider = ?", (normalized,)
        ).fetchone()
        if row is None and normalized == "twenty":
            review = _default_twenty_review()
            connection.execute(
                "INSERT INTO crm_provider_reviews(provider, payload_json, updated_at) "
                "VALUES (?, ?, ?)",
                (normalized, review.model_dump_json(), datetime.now(UTC).isoformat()),
            )
            connection.commit()
            return review
    if row is None:
        return None
    try:
        return CrmProviderReview.model_validate(json.loads(row["payload_json"]))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def upsert_crm_provider_review(review: CrmProviderReview) -> CrmProviderReview:
    with _connection() as connection:
        connection.execute(
            "INSERT INTO crm_provider_reviews(provider, payload_json, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(provider) DO UPDATE SET payload_json=excluded.payload_json, "
            "updated_at=excluded.updated_at",
            (review.provider.lower(), review.model_dump_json(), datetime.now(UTC).isoformat()),
        )
        connection.commit()
    return review


def revoke_crm_provider_review(provider: str) -> CrmProviderReview | None:
    review = get_crm_provider_review(provider)
    if review is None:
        return None
    return upsert_crm_provider_review(review.model_copy(update={"review_status": "revoked"}))
