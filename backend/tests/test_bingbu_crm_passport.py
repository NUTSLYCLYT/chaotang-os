from __future__ import annotations

import pytest

from app.bingbu.models import CrmSyncRequest
from app.bingbu.service import BingbuCrmUnavailable, BingbuService
from app.bingbu.storage import BingbuStore
from app.capabilities import get_crm_provider_passport


class UnregisteredReadAdapter:
    provider_name = "twenty"
    enabled = True
    passport = None

    def read_accounts(self, *, cursor, limit):  # pragma: no cover - must fail before call
        raise AssertionError("unregistered adapter must not be called")

    read_contacts = read_accounts
    read_opportunities = read_accounts
    read_activities = read_accounts


def test_passport_is_honglusi_read_only_and_has_no_secret_fields():
    passport = get_crm_provider_passport("twenty")
    assert passport is not None
    assert passport.source == "honglusi"
    assert passport.admission == "approved_read_only"
    assert passport.allowed_actions == ["read"]
    assert passport.credential_boundary == "injected_transport_only"
    assert not {"token", "secret", "password", "api_key"} & set(
        type(passport).model_fields
    )


def test_bingbu_rejects_adapter_without_honglusi_passport():
    service = BingbuService(
        store=BingbuStore(), crm_adapters={"twenty": UnregisteredReadAdapter()}
    )
    with pytest.raises(BingbuCrmUnavailable, match="CRM_PROVIDER_NOT_ADMITTED"):
        service.preview_crm_sync("owner-a", CrmSyncRequest())
