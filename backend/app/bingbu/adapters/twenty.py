"""Twenty read-only adapter using an injected HTTP transport."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, date, datetime
from typing import Any

from app.bingbu.adapters.base import CrmAdapterError, CrmHttpTransport
from app.bingbu.models import (
    CrmAccount,
    CrmActivity,
    CrmContact,
    CrmOpportunity,
    CrmPage,
    Health,
    OpportunityStage,
)
from app.capabilities import get_crm_provider_passport
from app.capabilities.contracts import CrmProviderPassport

_DEFAULT_PASSPORT = object()


def _text(value: Any, code: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CrmAdapterError(code)
    return value.strip()


def _optional_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise CrmAdapterError("CRM_INVALID_TIMESTAMP")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise CrmAdapterError("CRM_INVALID_TIMESTAMP") from exc
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise CrmAdapterError("CRM_INVALID_DATE")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise CrmAdapterError("CRM_INVALID_DATE") from exc


def _number(value: Any) -> float:
    if isinstance(value, bool):
        raise CrmAdapterError("CRM_INVALID_AMOUNT")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise CrmAdapterError("CRM_INVALID_AMOUNT") from exc
    if result < 0:
        raise CrmAdapterError("CRM_INVALID_AMOUNT")
    return result


def _nested(value: Any, *keys: str) -> Any:
    current = value
    for key in keys:
        if not isinstance(current, Mapping):
            return None
        current = current.get(key)
    return current


class TwentyCrmReadAdapter:
    """Maps Twenty REST-shaped payloads without importing a Twenty SDK."""

    provider_name = "twenty"

    def __init__(
        self,
        transport: CrmHttpTransport | None = None,
        *,
        enabled: bool = False,
        passport: CrmProviderPassport | None | object = _DEFAULT_PASSPORT,
    ) -> None:
        self.transport = transport
        self.enabled = enabled
        self.passport = (
            get_crm_provider_passport(self.provider_name)
            if passport is _DEFAULT_PASSPORT
            else passport
        )

    def _page(
        self, collection: str, *, cursor: str | None, limit: int
    ) -> tuple[list[Mapping[str, Any]], str | None]:
        if self.passport is None or self.passport.provider != self.provider_name:
            raise CrmAdapterError("CRM_PROVIDER_NOT_ADMITTED")
        if not self.enabled or self.transport is None:
            raise CrmAdapterError("CRM_PROVIDER_DISABLED")
        try:
            payload = self.transport.get(
                f"/rest/{collection}",
                {"after": cursor, "limit": limit} if cursor else {"limit": limit},
            )
        except Exception as exc:  # transport details never cross the API boundary
            raise CrmAdapterError("CRM_PROVIDER_UNAVAILABLE") from exc
        if not isinstance(payload, Mapping):
            raise CrmAdapterError("CRM_INVALID_RESPONSE")
        raw = payload.get("data", payload)
        if isinstance(raw, Mapping):
            items = raw[collection] if collection in raw else raw.get("items")
            page_info = (
                raw["pageInfo"]
                if "pageInfo" in raw
                else raw.get("page_info") or payload.get("pageInfo")
            )
        else:
            items = raw
            page_info = payload.get("pageInfo") or payload.get("page_info")
        if not isinstance(items, list) or not isinstance(page_info, (Mapping, type(None))):
            raise CrmAdapterError("CRM_INVALID_RESPONSE")
        next_cursor = None
        if isinstance(page_info, Mapping) and page_info.get("hasNextPage"):
            next_cursor = _optional_text(page_info.get("endCursor") or page_info.get("nextCursor"))
            if next_cursor is None:
                raise CrmAdapterError("CRM_INVALID_CURSOR")
        return [item for item in items if isinstance(item, Mapping)], next_cursor

    def read_accounts(self, *, cursor: str | None, limit: int) -> CrmPage[CrmAccount]:
        items, next_cursor = self._page("companies", cursor=cursor, limit=limit)
        return CrmPage(items=[self._account(item) for item in items], next_cursor=next_cursor)

    def read_contacts(self, *, cursor: str | None, limit: int) -> CrmPage[CrmContact]:
        items, next_cursor = self._page("people", cursor=cursor, limit=limit)
        return CrmPage(items=[self._contact(item) for item in items], next_cursor=next_cursor)

    def read_opportunities(self, *, cursor: str | None, limit: int) -> CrmPage[CrmOpportunity]:
        items, next_cursor = self._page("opportunities", cursor=cursor, limit=limit)
        return CrmPage(items=[self._opportunity(item) for item in items], next_cursor=next_cursor)

    def read_activities(self, *, cursor: str | None, limit: int) -> CrmPage[CrmActivity]:
        items, next_cursor = self._page("activities", cursor=cursor, limit=limit)
        return CrmPage(items=[self._activity(item) for item in items], next_cursor=next_cursor)

    @staticmethod
    def _account(item: Mapping[str, Any]) -> CrmAccount:
        external_id = _text(item.get("id"), "CRM_MISSING_EXTERNAL_ID")
        return CrmAccount(
            external_id=external_id,
            name=_text(item.get("name") or item.get("companyName"), "CRM_MISSING_ACCOUNT_NAME"),
            source_ref=f"twenty:company:{external_id}",
            source_updated_at=_datetime(item.get("updatedAt")),
        )

    @staticmethod
    def _contact(item: Mapping[str, Any]) -> CrmContact:
        external_id = _text(item.get("id"), "CRM_MISSING_EXTERNAL_ID")
        name = _optional_text(item.get("name")) or " ".join(
            part
            for part in (
                _optional_text(_nested(item, "name", "firstName")),
                _optional_text(_nested(item, "name", "lastName")),
            )
            if part
        )
        return CrmContact(
            external_id=external_id,
            account_external_id=_optional_text(
                item.get("companyId") or _nested(item, "company", "id")
            ),
            name=_text(name, "CRM_MISSING_CONTACT_NAME"),
            email=_optional_text(item.get("email")),
            source_ref=f"twenty:person:{external_id}",
            source_updated_at=_datetime(item.get("updatedAt")),
        )

    @staticmethod
    def _opportunity(item: Mapping[str, Any]) -> CrmOpportunity:
        external_id = _text(item.get("id"), "CRM_MISSING_EXTERNAL_ID")
        raw_stage = _text(item.get("stage") or item.get("status"), "CRM_MISSING_STAGE").lower()
        try:
            stage = OpportunityStage(raw_stage)
        except ValueError as exc:
            raise CrmAdapterError("CRM_INVALID_STAGE") from exc
        amount = item.get("amount")
        if isinstance(amount, Mapping):
            amount = amount.get("amount")
        account_id = _text(
            item.get("companyId") or item.get("accountId") or _nested(item, "company", "id"),
            "CRM_MISSING_ACCOUNT_ID",
        )
        account_name = _text(
            item.get("companyName") or _nested(item, "company", "name") or item.get("account_name"),
            "CRM_MISSING_ACCOUNT_NAME",
        )
        return CrmOpportunity(
            external_id=external_id,
            account_external_id=account_id,
            account_name=account_name,
            contact_external_id=_optional_text(item.get("personId") or item.get("contactId")),
            contact_name=_optional_text(item.get("contactName")),
            stage=stage,
            amount=_number(amount),
            currency=(_optional_text(item.get("currency")) or "CNY").upper(),
            expected_close_date=_date(item.get("closeDate") or item.get("expectedCloseDate")),
            last_activity_at=_datetime(item.get("lastActivityAt")),
            next_action=_optional_text(item.get("nextAction")),
            next_action_owner=_optional_text(item.get("nextActionOwner")),
            next_action_due_at=_datetime(item.get("nextActionDueAt")),
            blocker=_optional_text(item.get("blocker")),
            health=Health((_optional_text(item.get("health")) or "unknown").lower()),
            source_ref=f"twenty:opportunity:{external_id}",
            source_updated_at=_datetime(item.get("updatedAt")),
        )

    @staticmethod
    def _activity(item: Mapping[str, Any]) -> CrmActivity:
        external_id = _text(item.get("id"), "CRM_MISSING_EXTERNAL_ID")
        return CrmActivity(
            external_id=external_id,
            opportunity_external_id=_optional_text(item.get("opportunityId")),
            account_external_id=_optional_text(item.get("companyId") or item.get("accountId")),
            type=_text(item.get("type") or item.get("activityType"), "CRM_MISSING_ACTIVITY_TYPE"),
            occurred_at=_datetime(item.get("occurredAt") or item.get("createdAt"))
            or datetime.now(UTC),
            actor=_text(item.get("actor") or item.get("createdBy"), "CRM_MISSING_ACTIVITY_ACTOR"),
            summary=_text(
                item.get("summary") or item.get("body") or item.get("title"),
                "CRM_MISSING_ACTIVITY_SUMMARY",
            ),
            source_ref=f"twenty:activity:{external_id}",
            source_updated_at=_datetime(item.get("updatedAt")),
        )
