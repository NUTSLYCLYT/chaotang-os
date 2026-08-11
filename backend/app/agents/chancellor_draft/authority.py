"""Process-local, one-time authority for issuing the latest ready draft."""

from __future__ import annotations

import re
from dataclasses import dataclass
from threading import Lock

from app.accounting_reports.models import AccountingRequestKind, ReportPeriod
from app.agents.chancellor_draft.routing import ApprovedRouteSnapshot


@dataclass(frozen=True)
class AccountingAuthorityContext:
    request_kind: AccountingRequestKind
    period: ReportPeriod
    source_fingerprint: str

    def __post_init__(self) -> None:
        if self.request_kind is AccountingRequestKind.NOT_REQUESTED:
            raise ValueError("accounting context requires a requested kind")
        if not re.fullmatch(r"[0-9a-f]{64}", self.source_fingerprint):
            raise ValueError("source_fingerprint must be lowercase hexadecimal")


@dataclass(frozen=True)
class ConsumedDraftAuthority:
    route_snapshot: ApprovedRouteSnapshot
    accounting_context: AccountingAuthorityContext | None


@dataclass(frozen=True)
class _Authority:
    version: int
    fingerprint: str
    decree_text: str
    route_snapshot: ApprovedRouteSnapshot
    accounting_context: AccountingAuthorityContext | None = None


class DraftAuthorityRegistry:
    """Keep at most one current, one-time issue authority per owner."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._by_owner: dict[str, _Authority] = {}
        self._reservation_by_owner: dict[str, str] = {}

    def register(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
        route_snapshot: ApprovedRouteSnapshot,
        accounting_context: AccountingAuthorityContext | None = None,
    ) -> None:
        authority = _Authority(
            version,
            fingerprint,
            decree_text,
            route_snapshot,
            accounting_context,
        )
        with self._lock:
            self._by_owner[owner_user_id] = authority
            self._reservation_by_owner.pop(owner_user_id, None)

    def revoke(self, *, owner_user_id: str) -> bool:
        with self._lock:
            self._reservation_by_owner.pop(owner_user_id, None)
            return self._by_owner.pop(owner_user_id, None) is not None

    def lookup(self, *, owner_user_id: str) -> ConsumedDraftAuthority | None:
        with self._lock:
            authority = self._by_owner.get(owner_user_id)
            if authority is None:
                return None
            return ConsumedDraftAuthority(
                authority.route_snapshot,
                authority.accounting_context,
            )

    def reserve(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
        reservation_id: str,
    ) -> ApprovedRouteSnapshot | None:
        if not reservation_id:
            return None
        with self._lock:
            authority = self._by_owner.get(owner_user_id)
            if authority is None or (
                authority.version != version
                or authority.fingerprint != fingerprint
                or authority.decree_text != decree_text
            ):
                return None
            existing = self._reservation_by_owner.get(owner_user_id)
            if existing is not None and existing != reservation_id:
                return None
            self._reservation_by_owner[owner_user_id] = reservation_id
            return authority.route_snapshot

    def reserve_with_context(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
        reservation_id: str,
    ) -> ConsumedDraftAuthority | None:
        if not reservation_id:
            return None
        with self._lock:
            authority = self._by_owner.get(owner_user_id)
            if authority is None or (
                authority.version != version
                or authority.fingerprint != fingerprint
                or authority.decree_text != decree_text
            ):
                return None
            existing = self._reservation_by_owner.get(owner_user_id)
            if existing is not None and existing != reservation_id:
                return None
            self._reservation_by_owner[owner_user_id] = reservation_id
            return ConsumedDraftAuthority(
                authority.route_snapshot,
                authority.accounting_context,
            )

    def commit_reservation(
        self, *, owner_user_id: str, reservation_id: str
    ) -> bool:
        with self._lock:
            if self._reservation_by_owner.get(owner_user_id) != reservation_id:
                return False
            self._reservation_by_owner.pop(owner_user_id, None)
            return self._by_owner.pop(owner_user_id, None) is not None

    def release_reservation(
        self, *, owner_user_id: str, reservation_id: str
    ) -> bool:
        with self._lock:
            if self._reservation_by_owner.get(owner_user_id) != reservation_id:
                return False
            self._reservation_by_owner.pop(owner_user_id, None)
            return True

    def restore_if_absent(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
        consumed: ConsumedDraftAuthority,
    ) -> bool:
        with self._lock:
            if (
                owner_user_id in self._by_owner
                or owner_user_id in self._reservation_by_owner
            ):
                return False
            self._by_owner[owner_user_id] = _Authority(
                version=version,
                fingerprint=fingerprint,
                decree_text=decree_text,
                route_snapshot=consumed.route_snapshot,
                accounting_context=consumed.accounting_context,
            )
            return True

    def consume(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
    ) -> ApprovedRouteSnapshot | None:
        with self._lock:
            if owner_user_id in self._reservation_by_owner:
                return None
            authority = self._by_owner.get(owner_user_id)
            if authority is None or (
                authority.version != version
                or authority.fingerprint != fingerprint
                or authority.decree_text != decree_text
            ):
                return None
            del self._by_owner[owner_user_id]
            return authority.route_snapshot

    def consume_with_context(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
    ) -> ConsumedDraftAuthority | None:
        with self._lock:
            if owner_user_id in self._reservation_by_owner:
                return None
            authority = self._by_owner.get(owner_user_id)
            if authority is None or (
                authority.version != version
                or authority.fingerprint != fingerprint
                or authority.decree_text != decree_text
            ):
                return None
            del self._by_owner[owner_user_id]
            return ConsumedDraftAuthority(
                authority.route_snapshot,
                authority.accounting_context,
            )


draft_authority_registry = DraftAuthorityRegistry()
