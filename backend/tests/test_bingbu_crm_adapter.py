from datetime import UTC, datetime

import pytest

from app.bingbu.adapters.base import CrmAdapterError
from app.bingbu.adapters.twenty import TwentyCrmReadAdapter


class FakeTransport:
    def __init__(self, payloads):
        self.payloads = payloads
        self.calls = []

    def get(self, path, params):
        self.calls.append((path, params))
        return self.payloads[path]


def _transport():
    return FakeTransport(
        {
            "/rest/companies": {
                "data": {
                    "companies": [
                        {"id": "acct-1", "name": "北辰科技", "updatedAt": "2026-01-01T00:00:00Z"}
                    ],
                    "pageInfo": {"hasNextPage": True, "endCursor": "acct-next"},
                }
            },
            "/rest/people": {
                "data": {
                    "people": [
                        {
                            "id": "contact-1",
                            "name": {"firstName": "李", "lastName": "四"},
                            "companyId": "acct-1",
                        }
                    ],
                    "pageInfo": {"hasNextPage": False},
                }
            },
            "/rest/opportunities": {
                "data": {
                    "opportunities": [
                        {
                            "id": "opp-1",
                            "companyId": "acct-1",
                            "companyName": "北辰科技",
                            "stage": "discovery",
                            "amount": 100,
                            "updatedAt": "2026-01-02T00:00:00Z",
                        }
                    ],
                    "pageInfo": {"hasNextPage": False},
                }
            },
            "/rest/activities": {
                "data": {
                    "activities": [
                        {
                            "id": "act-1",
                            "opportunityId": "opp-1",
                            "type": "call",
                            "occurredAt": "2026-01-03T00:00:00Z",
                            "actor": "owner",
                            "summary": "确认需求",
                        }
                    ],
                    "pageInfo": {"hasNextPage": False},
                }
            },
        }
    )


def test_twenty_maps_all_read_models_and_keeps_cursor_without_network():
    transport = _transport()
    adapter = TwentyCrmReadAdapter(transport, enabled=True)

    accounts = adapter.read_accounts(cursor=None, limit=10)
    contacts = adapter.read_contacts(cursor=None, limit=10)
    opportunities = adapter.read_opportunities(cursor=None, limit=10)
    activities = adapter.read_activities(cursor=None, limit=10)

    assert accounts.items[0].external_id == "acct-1"
    assert accounts.items[0].source_updated_at == datetime(2026, 1, 1, tzinfo=UTC)
    assert accounts.next_cursor == "acct-next"
    assert contacts.items[0].name == "李 四"
    assert opportunities.items[0].source_ref == "twenty:opportunity:opp-1"
    assert activities.items[0].opportunity_external_id == "opp-1"
    assert transport.calls[0] == ("/rest/companies", {"limit": 10})


def test_twenty_is_disabled_by_default_and_rejects_malformed_pages():
    with pytest.raises(CrmAdapterError, match="CRM_PROVIDER_DISABLED"):
        TwentyCrmReadAdapter().read_accounts(cursor=None, limit=10)

    transport = FakeTransport(
        {"/rest/companies": {"data": {"companies": [], "pageInfo": {"hasNextPage": True}}}}
    )
    with pytest.raises(CrmAdapterError, match="CRM_INVALID_CURSOR"):
        TwentyCrmReadAdapter(transport, enabled=True).read_accounts(cursor=None, limit=10)
