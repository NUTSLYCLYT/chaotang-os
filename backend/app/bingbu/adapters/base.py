"""Small provider-agnostic read contracts for CRM facts."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from app.bingbu.models import (
    CrmAccount,
    CrmActivity,
    CrmContact,
    CrmOpportunity,
    CrmPage,
)
from app.capabilities.contracts import CrmProviderPassport


class CrmAdapterError(ValueError):
    """Sanitized, stable error raised by a read-only CRM adapter."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class CrmHttpTransport(Protocol):
    """Injected transport; adapters never construct a network client."""

    def get(self, path: str, params: Mapping[str, str | int]) -> Mapping[str, Any]: ...


class CrmReadAdapter(Protocol):
    provider_name: str
    enabled: bool
    passport: CrmProviderPassport | None

    def read_accounts(self, *, cursor: str | None, limit: int) -> CrmPage[CrmAccount]: ...

    def read_contacts(self, *, cursor: str | None, limit: int) -> CrmPage[CrmContact]: ...

    def read_opportunities(self, *, cursor: str | None, limit: int) -> CrmPage[CrmOpportunity]: ...

    def read_activities(self, *, cursor: str | None, limit: int) -> CrmPage[CrmActivity]: ...
