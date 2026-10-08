from datetime import UTC, datetime

from app.bingbu.adapters.twenty import TwentyCrmReadAdapter
from app.bingbu.models import CrmSyncCommitRequest, CrmSyncRequest
from app.bingbu.service import BingbuService
from app.bingbu.storage import BingbuStore


class FakeTransport:
    def __init__(self, updated_at="2026-01-02T00:00:00Z"):
        self.updated_at = updated_at

    def get(self, path, params):
        page_info = {"hasNextPage": False}
        values = {
            "/rest/companies": [{"id": "acct-1", "name": "北辰科技", "updatedAt": self.updated_at}],
            "/rest/people": [],
            "/rest/opportunities": [
                {
                    "id": "opp-1",
                    "companyId": "acct-1",
                    "companyName": "北辰科技",
                    "stage": "discovery",
                    "amount": 100,
                    "nextAction": "确认决策人",
                    "nextActionOwner": "owner-a",
                    "nextActionDueAt": "2030-01-01T00:00:00Z",
                    "updatedAt": self.updated_at,
                }
            ],
            "/rest/activities": [],
        }
        return {"data": {path.rsplit("/", 1)[-1]: values[path], "pageInfo": page_info}}


def _service(updated_at="2026-01-02T00:00:00Z"):
    adapter = TwentyCrmReadAdapter(FakeTransport(updated_at), enabled=True)
    return BingbuService(store=BingbuStore(), crm_adapters={"twenty": adapter})


def test_crm_sync_preview_commit_is_idempotent_and_owner_scoped():
    service = _service()
    preview = service.preview_crm_sync("owner-a", CrmSyncRequest(page_size=10))
    assert preview.can_commit is True
    assert preview.opportunities[0].source_ref == "twenty:opportunity:opp-1"
    run = service.commit_crm_sync("owner-a", CrmSyncCommitRequest(preview_id=preview.id))
    again = service.commit_crm_sync("owner-a", CrmSyncCommitRequest(preview_id=preview.id))
    assert run.id == again.id
    assert run.accepted_count == 1
    assert service.list_opportunities("owner-a")[0].external_id == "opp-1"
    assert service.list_opportunities("owner-b") == []


def test_crm_sync_does_not_overwrite_a_newer_local_source_fact():
    service = _service()
    first = service.preview_crm_sync("owner-a", CrmSyncRequest())
    service.commit_crm_sync("owner-a", CrmSyncCommitRequest(preview_id=first.id))
    newer = service.store.get_opportunity_by_external("owner-a", "twenty", "opp-1")
    assert newer is not None
    newer.source_updated_at = datetime(2026, 2, 1, tzinfo=UTC)
    service.store.upsert_opportunity("owner-a", newer)
    second = service.preview_crm_sync("owner-a", CrmSyncRequest())
    assert second.conflicts[0].code == "STALE_LOCAL_FACT"
    run = service.commit_crm_sync("owner-a", CrmSyncCommitRequest(preview_id=second.id))
    assert run.skipped_count == 1
