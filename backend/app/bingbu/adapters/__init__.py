"""Provider-neutral read-only CRM adapters."""

from app.bingbu.adapters.base import CrmAdapterError, CrmHttpTransport, CrmReadAdapter
from app.bingbu.adapters.twenty import TwentyCrmReadAdapter

__all__ = ["CrmAdapterError", "CrmHttpTransport", "CrmReadAdapter", "TwentyCrmReadAdapter"]
