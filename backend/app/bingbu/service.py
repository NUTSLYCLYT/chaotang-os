"""Application service for the Bingbu P0 sales decision slice."""

from __future__ import annotations

import base64
import csv
import hashlib
import io
import json
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol
from uuid import uuid4

from app.bingbu.adapters.base import CrmAdapterError, CrmReadAdapter
from app.bingbu.adapters.twenty import TwentyCrmReadAdapter
from app.bingbu.models import (
    ActionDraft,
    ActionDraftRequest,
    ActionState,
    Activity,
    CrmSyncCommitRequest,
    CrmSyncPreview,
    CrmSyncRequest,
    CrmSyncRun,
    DecisionPacket,
    ImportRequest,
    ImportRowError,
    ImportRun,
    ImportStatus,
    Opportunity,
    OpportunityStage,
    Overview,
)
from app.bingbu.storage import BingbuConflictError, BingbuNotFoundError, BingbuStore, get_store
from app.bingbu.validation import parse_opportunity
from app.capabilities import get_crm_provider_passport


class DecisionProvider(Protocol):
    provider_name: str
    model_alias: str

    def recommend(self, opportunity: Opportunity, evidence_gaps: list[str]) -> list[str]: ...


class BingbuInputError(ValueError):
    """A sanitized input error owned by the Bingbu API boundary."""


class BingbuCrmUnavailable(BingbuInputError):
    """A CRM provider is disabled or unavailable; details never leave the server."""


class BingbuCrmConflict(BingbuConflictError):
    """A CRM sync preview does not belong to the current owner."""


class DeterministicDecisionProvider:
    """Default offline provider; production can inject the DeepSeek harness adapter."""

    provider_name = "deepseek-harness"
    model_alias = "injected-fake"

    def recommend(self, opportunity: Opportunity, evidence_gaps: list[str]) -> list[str]:
        if evidence_gaps:
            return ["补齐关键证据后再推进报价", "由责任人安排一次客户确认沟通"]
        if opportunity.stage is OpportunityStage.NEGOTIATION:
            return ["确认合同红线与交付承诺", "在审批后发送最终报价草稿"]
        return ["围绕客户信号安排下一次沟通", "确认决策人和截止时间"]


class BingbuService:
    def __init__(
        self,
        store: BingbuStore | None = None,
        provider: DecisionProvider | None = None,
        crm_adapters: dict[str, CrmReadAdapter] | None = None,
    ) -> None:
        self.store = store or get_store()
        self.provider = provider or DeterministicDecisionProvider()
        self.crm_adapters = crm_adapters or {"twenty": TwentyCrmReadAdapter()}

    def preview_crm_sync(self, owner: str, request: CrmSyncRequest) -> CrmSyncPreview:
        adapter = self._crm_adapter(request.provider)
        cursors = self._decode_cursor(request.cursor)
        try:
            accounts = adapter.read_accounts(
                cursor=cursors.get("accounts"), limit=request.page_size
            )
            contacts = adapter.read_contacts(
                cursor=cursors.get("contacts"), limit=request.page_size
            )
            opportunities = adapter.read_opportunities(
                cursor=cursors.get("opportunities"), limit=request.page_size
            )
            activities = adapter.read_activities(
                cursor=cursors.get("activities"), limit=request.page_size
            )
        except CrmAdapterError as exc:
            if exc.code in {"CRM_PROVIDER_DISABLED", "CRM_PROVIDER_UNAVAILABLE"}:
                raise BingbuCrmUnavailable(exc.code) from exc
            raise BingbuInputError(exc.code) from exc
        next_cursors = {
            key: value
            for key, value in {
                "accounts": accounts.next_cursor,
                "contacts": contacts.next_cursor,
                "opportunities": opportunities.next_cursor,
                "activities": activities.next_cursor,
            }.items()
            if value
        }
        conflicts = []
        for item in opportunities.items:
            existing = self.store.get_opportunity_by_external(
                owner, adapter.provider_name, item.external_id
            )
            if existing and (
                item.source_updated_at is None
                or existing.source_updated_at is not None
                and existing.source_updated_at >= item.source_updated_at
            ):
                conflicts.append({"external_id": item.external_id, "code": "STALE_LOCAL_FACT"})
        preview = CrmSyncPreview(
            id=f"crm_preview_{uuid4().hex}",
            provider=adapter.provider_name,
            accounts=accounts.items,
            contacts=contacts.items,
            opportunities=opportunities.items,
            activities=activities.items,
            next_cursor=self._encode_cursor(next_cursors) if next_cursors else None,
            conflicts=conflicts,
            can_commit=True,
            fingerprint=self._crm_preview_fingerprint(
                adapter.provider_name,
                accounts.items,
                contacts.items,
                opportunities.items,
                activities.items,
            ),
            created_at=datetime.now(UTC),
        )
        return self.store.save_crm_preview(owner, preview)

    def commit_crm_sync(self, owner: str, request: CrmSyncCommitRequest) -> CrmSyncRun:
        prior = self.store.get_crm_run_by_preview(owner, request.preview_id)
        if prior is not None:
            return prior
        preview = self.store.get_crm_preview(owner, request.preview_id)
        accepted = skipped = rejected = 0
        errors: list[str] = []
        activities_by_opportunity: dict[str, list[Activity]] = {}
        for item in preview.activities:
            if item.opportunity_external_id:
                activities_by_opportunity.setdefault(item.opportunity_external_id, []).append(
                    Activity(
                        id=f"{preview.provider}:{item.external_id}",
                        opportunity_id=f"{preview.provider}:{item.opportunity_external_id}",
                        type=item.type,
                        occurred_at=item.occurred_at,
                        actor=item.actor,
                        summary=item.summary,
                        source_ref=item.source_ref,
                    )
                )
        for item in preview.opportunities:
            existing = self.store.get_opportunity_by_external(
                owner, preview.provider, item.external_id
            )
            if existing and (
                item.source_updated_at is None
                or existing.source_updated_at is not None
                and existing.source_updated_at >= item.source_updated_at
            ):
                skipped += 1
                continue
            try:
                opportunity = Opportunity(
                    id=f"{preview.provider}:{item.external_id}",
                    account_name=item.account_name,
                    contact_name=item.contact_name,
                    owner_user_id=owner,
                    stage=item.stage,
                    amount=item.amount,
                    currency=item.currency,
                    expected_close_date=item.expected_close_date,
                    last_activity_at=item.last_activity_at,
                    next_action=item.next_action,
                    next_action_owner=item.next_action_owner or owner,
                    next_action_due_at=item.next_action_due_at,
                    blocker=item.blocker,
                    health=item.health,
                    source_ref=item.source_ref,
                    external_id=item.external_id,
                    external_source=preview.provider,
                    source_updated_at=item.source_updated_at,
                    activities=activities_by_opportunity.get(item.external_id, []),
                )
                self.store.upsert_opportunity(owner, opportunity)
            except (TypeError, ValueError, KeyError):
                rejected += 1
                errors.append("CRM_OPPORTUNITY_INVALID")
                continue
            accepted += 1
        status = "COMMITTED" if rejected == 0 else "PARTIAL"
        run = CrmSyncRun(
            id=f"crm_sync_{uuid4().hex}",
            preview_id=preview.id,
            provider=preview.provider,
            status=status,
            accepted_count=accepted,
            skipped_count=skipped,
            rejected_count=rejected,
            errors=sorted(set(errors)),
            created_at=datetime.now(UTC),
        )
        return self.store.save_crm_run(owner, run)

    def _crm_adapter(self, provider_name: str) -> CrmReadAdapter:
        adapter = self.crm_adapters.get(provider_name.lower())
        if adapter is None:
            raise BingbuCrmUnavailable("CRM_PROVIDER_UNAVAILABLE")
        passport = getattr(adapter, "passport", None)
        expected = get_crm_provider_passport(adapter.provider_name)
        if expected is None or passport != expected:
            raise BingbuCrmUnavailable("CRM_PROVIDER_NOT_ADMITTED")
        return adapter

    @staticmethod
    def _decode_cursor(cursor: str | None) -> dict[str, str | None]:
        if not cursor:
            return {}
        try:
            decoded = base64.urlsafe_b64decode(cursor.encode("ascii") + b"===").decode("utf-8")
            value = json.loads(decoded)
        except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
            raise BingbuInputError("CRM_INVALID_CURSOR") from exc
        if not isinstance(value, dict) or any(
            key not in {"accounts", "contacts", "opportunities", "activities"}
            or (item is not None and not isinstance(item, str))
            for key, item in value.items()
        ):
            raise BingbuInputError("CRM_INVALID_CURSOR")
        return value

    @staticmethod
    def _encode_cursor(cursors: dict[str, str]) -> str:
        raw = json.dumps(cursors, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

    @staticmethod
    def _crm_preview_fingerprint(provider: str, *collections: list[Any]) -> str:
        payload = {
            "provider": provider,
            "collections": [
                [item.model_dump(mode="json") for item in values] for values in collections
            ],
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    def preview_import(self, owner: str, request: ImportRequest) -> ImportRun:
        rows = self._decode_rows(request)
        errors: list[ImportRowError] = []
        accepted = 0
        for index, row in enumerate(rows, start=2):
            try:
                parse_opportunity(row, owner)
                accepted += 1
            except (TypeError, ValueError, KeyError) as exc:
                field = "row"
                if hasattr(exc, "errors"):
                    error_items = exc.errors()
                    if error_items and error_items[0].get("loc"):
                        field = str(error_items[0]["loc"][0])
                errors.append(ImportRowError(row=index, field=field, message=str(exc)[:500]))
        return ImportRun(
            id=f"imp_{uuid4().hex}",
            source_type=request.source_type.lower(),
            filename=request.filename,
            row_count=len(rows),
            accepted_count=accepted,
            rejected_count=len(errors),
            errors=errors,
            status=ImportStatus.PREVIEWED,
            created_at=datetime.now(UTC),
        )

    def commit_import(
        self,
        owner: str,
        request: ImportRequest,
        preview: ImportRun | None = None,
    ) -> ImportRun:
        fingerprint = hashlib.sha256(request.content.encode("utf-8")).hexdigest()
        prior = self.store.get_import_by_fingerprint(owner, fingerprint)
        if prior is not None:
            return prior
        rows = self._decode_rows(request)
        run = preview or self.preview_import(owner, request)
        for _row_index, row in enumerate(rows, start=2):
            try:
                self.store.upsert_opportunity(owner, parse_opportunity(row, owner))
            except (TypeError, ValueError, KeyError):
                continue
        committed = run.model_copy(
            update={"status": ImportStatus.COMMITTED, "fingerprint": fingerprint}
        )
        return self.store.save_import(owner, committed, fingerprint)

    def overview(self, owner: str) -> Overview:
        opportunities = self.store.list_opportunities(owner)
        amounts: dict[str, float] = {}
        counts: dict[str, int] = {}
        gaps: list[str] = []
        now = datetime.now(UTC)
        stage_aging: list[dict[str, Any]] = []
        for opportunity in opportunities:
            counts[opportunity.stage.value] = counts.get(opportunity.stage.value, 0) + 1
            amounts[opportunity.stage.value] = (
                amounts.get(opportunity.stage.value, 0) + opportunity.amount
            )
            if not opportunity.evidence:
                gaps.append(f"{opportunity.id}: 缺少可引用证据")
            if opportunity.next_action_due_at and opportunity.next_action_due_at < now:
                gaps.append(f"{opportunity.id}: 下一步已逾期")
            if opportunity.last_activity_at:
                stage_aging.append(
                    {
                        "opportunity_id": opportunity.id,
                        "stage": opportunity.stage.value,
                        "days": max(0, (now - opportunity.last_activity_at).days),
                    }
                )
        priority = sorted(
            opportunities,
            key=lambda item: (
                item.health.value == "red",
                bool(item.next_action_due_at and item.next_action_due_at < now),
                item.amount,
            ),
            reverse=True,
        )[:10]
        return Overview(
            period={
                "from": (now - timedelta(days=7)).date().isoformat(),
                "to": now.date().isoformat(),
            },
            funnel={"counts": counts, "amounts": amounts, "stage_aging": stage_aging},
            priority_opportunities=priority,
            evidence_gaps=gaps,
            decision_queue=self.store.list_packets(owner),
            experiments=["验证下一步按时完成率与证据缺口关闭率"],
            freshness={"as_of": now.isoformat(), "stale_after_hours": 72},
        )

    def get_opportunity(self, owner: str, opportunity_id: str) -> Opportunity:
        return self.store.get_opportunity(owner, opportunity_id)

    def list_opportunities(
        self,
        owner: str,
        *,
        stage: OpportunityStage | None = None,
        health: str | None = None,
        limit: int = 50,
    ) -> list[Opportunity]:
        values = self.store.list_opportunities(owner)
        if stage is not None:
            values = [item for item in values if item.stage is stage]
        if health is not None:
            values = [item for item in values if item.health.value == health]
        return sorted(values, key=lambda item: item.amount, reverse=True)[:limit]

    def get_timeline(self, owner: str, opportunity_id: str) -> list[Any]:
        return self.store.get_opportunity(owner, opportunity_id).activities

    def get_packet(self, owner: str, packet_id: str) -> DecisionPacket:
        return self.store.get_packet(owner, packet_id)

    def get_import(self, owner: str, import_id: str) -> ImportRun:
        return self.store.get_import(owner, import_id)

    def create_war_room(
        self, owner: str, opportunity_id: str
    ) -> tuple[DecisionPacket, ActionDraft]:
        opportunity = self.store.get_opportunity(owner, opportunity_id)
        request_id = f"req_{uuid4().hex}"
        trace_id = f"trace_{uuid4().hex}"
        evidence_gaps = []
        if not opportunity.evidence:
            evidence_gaps.append("缺少客户事实证据")
        if not opportunity.next_action:
            evidence_gaps.append("缺少唯一下一步")
        facts = [
            f"商机阶段：{opportunity.stage.value}",
            f"预计金额：{opportunity.amount:g} {opportunity.currency}",
        ]
        packet = DecisionPacket(
            id=f"packet_{uuid4().hex}",
            subject_id=opportunity.id,
            status="degraded" if evidence_gaps else "ready",
            summary=f"{opportunity.account_name} 的销售会审包",
            facts=facts,
            assumptions=["金额与阶段来自最近一次导入的销售事实"],
            recommendations=self.provider.recommend(opportunity, evidence_gaps),
            evidence_gaps=evidence_gaps,
            redlines=["未经审批不得发送报价、改价或承诺交付"],
            next_action=opportunity.next_action or "补齐证据后指定唯一下一步",
            cross_bureau_impacts=["报价司：核对价格与毛利", "合同司：核对合同红线"],
            unresolved_items=evidence_gaps,
            evidence_refs=[item.id for item in opportunity.evidence],
            model_provider=self.provider.provider_name,
            model_alias=self.provider.model_alias,
            request_id=request_id,
            trace_id=trace_id,
            created_at=datetime.now(UTC),
        )
        self.store.save_packet(owner, packet)
        draft = self.create_action_draft(
            owner,
            ActionDraftRequest(
                decision_packet_id=packet.id,
                action_type="customer_follow_up",
                payload={"opportunity_id": opportunity.id, "next_action": packet.next_action},
                idempotency_key=f"bingbu:{owner}:{packet.id}:customer_follow_up",
            ),
        )
        return packet, draft

    def create_action_draft(self, owner: str, request: ActionDraftRequest) -> ActionDraft:
        packet = self.store.get_packet(owner, request.decision_packet_id)
        idempotency_key = request.idempotency_key or (
            f"bingbu:{owner}:{request.decision_packet_id}:{request.action_type}"
        )
        prior = self.store.get_draft_by_idempotency(owner, idempotency_key)
        if prior is not None:
            return prior
        draft = ActionDraft(
            id=f"draft_{uuid4().hex}",
            decision_packet_id=request.decision_packet_id,
            action_type=request.action_type,
            payload=request.payload,
            idempotency_key=idempotency_key,
            request_id=packet.request_id,
            trace_id=packet.trace_id,
            created_at=datetime.now(UTC),
        )
        return self.store.save_draft(owner, draft)

    def approve_action_draft(self, owner: str, draft_id: str) -> ActionDraft:
        draft = self.store.get_draft(owner, draft_id)
        if draft.approval_state is not ActionState.DRAFT:
            return draft
        return self.store.save_draft(
            owner,
            draft.model_copy(
                update={
                    "approval_state": ActionState.APPROVED_PENDING_EXECUTION,
                    "approved_by": owner,
                    "approved_at": datetime.now(UTC),
                }
            ),
        )

    def reject_action_draft(self, owner: str, draft_id: str) -> ActionDraft:
        draft = self.store.get_draft(owner, draft_id)
        if draft.approval_state is not ActionState.DRAFT:
            return draft
        return self.store.save_draft(
            owner, draft.model_copy(update={"approval_state": ActionState.REJECTED})
        )

    @staticmethod
    def _decode_rows(request: ImportRequest) -> list[dict[str, Any]]:
        source = request.source_type.lower()
        if source == "json":
            try:
                payload = json.loads(request.content)
            except json.JSONDecodeError as exc:
                raise BingbuInputError("JSON import is malformed") from exc
            if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
                raise BingbuInputError("JSON import must be an array of objects")
            return payload
        if source != "csv":
            raise BingbuInputError("source_type must be csv or json")
        reader = csv.DictReader(io.StringIO(request.content))
        if not reader.fieldnames:
            raise BingbuInputError("CSV import requires a header row")
        return [dict(row) for row in reader]


_SERVICE = BingbuService()


def get_bingbu_service() -> BingbuService:
    return _SERVICE


__all__ = [
    "BingbuConflictError",
    "BingbuInputError",
    "BingbuNotFoundError",
    "BingbuService",
    "get_bingbu_service",
]
