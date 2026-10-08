from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.bingbu.models import CrmSyncRequest
from app.bingbu.service import BingbuCrmUnavailable, BingbuService
from app.bingbu.storage import BingbuStore
from app.capabilities import get_crm_provider_passport
from app.capabilities.contracts import CrmProviderReview
from app.capabilities.projection import issue_crm_provider_passport


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


def _review(**overrides):
    values = {
        "provider": "twenty",
        "capability_id": "provider.twenty.crm.read.test",
        "review_status": "approved",
        "allowed_actions": ["read"],
        "forbidden_actions": ["external write", "credential access"],
        "evidence_sources": ["official-api-docs", "license-review"],
        "reviewed_by": "honglusi-review-board",
        "reviewed_at": datetime(2026, 10, 1, tzinfo=UTC),
        "expires_at": datetime(2027, 1, 1, tzinfo=UTC),
    }
    values.update(overrides)
    return CrmProviderReview(**values)


def test_passport_issuance_expires_and_revokes_fail_closed():
    assert issue_crm_provider_passport(
        _review(), now=datetime(2026, 10, 9, tzinfo=UTC)
    ) is not None
    assert issue_crm_provider_passport(
        _review(), now=datetime(2027, 1, 1, tzinfo=UTC)
    ) is None
    assert issue_crm_provider_passport(
        _review(review_status="revoked"), now=datetime(2026, 10, 9, tzinfo=UTC)
    ) is None
