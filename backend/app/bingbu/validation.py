"""Deterministic validation for imported sales facts."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from app.bingbu.models import Opportunity, OpportunityStage

REQUIRED_FIELDS = ("id", "account_name", "owner_user_id", "stage", "amount", "source_ref")


def _datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value))


def parse_opportunity(raw: dict[str, Any], owner_user_id: str) -> Opportunity:
    values = dict(raw)
    values["owner_user_id"] = owner_user_id
    missing = [field for field in REQUIRED_FIELDS if values.get(field) in (None, "")]
    if missing:
        raise ValueError(f"missing required fields: {', '.join(missing)}")
    values["stage"] = OpportunityStage(str(values["stage"]).strip().lower())
    values["amount"] = float(values["amount"])
    values["expected_close_date"] = _date(values.get("expected_close_date"))
    for key in ("last_activity_at", "next_action_due_at"):
        values[key] = _datetime(values.get(key))
    values["evidence"] = values.get("evidence") or []
    values["activities"] = values.get("activities") or []
    return Opportunity.model_validate(values)
