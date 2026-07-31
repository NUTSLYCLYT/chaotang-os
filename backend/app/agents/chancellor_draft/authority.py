"""Process-local, one-time authority for issuing the latest ready draft."""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock

from app.agents.chancellor_draft.routing import ApprovedRouteSnapshot


@dataclass(frozen=True)
class _Authority:
    version: int
    fingerprint: str
    decree_text: str
    route_snapshot: ApprovedRouteSnapshot


class DraftAuthorityRegistry:
    """Keep at most one current, one-time issue authority per owner."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._by_owner: dict[str, _Authority] = {}

    def register(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
        route_snapshot: ApprovedRouteSnapshot,
    ) -> None:
        authority = _Authority(version, fingerprint, decree_text, route_snapshot)
        with self._lock:
            self._by_owner[owner_user_id] = authority

    def revoke(self, *, owner_user_id: str) -> None:
        with self._lock:
            self._by_owner.pop(owner_user_id, None)

    def consume(
        self,
        *,
        owner_user_id: str,
        version: int,
        fingerprint: str,
        decree_text: str,
    ) -> ApprovedRouteSnapshot | None:
        with self._lock:
            authority = self._by_owner.get(owner_user_id)
            if authority is None or (
                authority.version != version
                or authority.fingerprint != fingerprint
                or authority.decree_text != decree_text
            ):
                return None
            del self._by_owner[owner_user_id]
            return authority.route_snapshot


draft_authority_registry = DraftAuthorityRegistry()
