"""Small owner-scoped in-memory store for the P0 offline vertical slice."""

from __future__ import annotations

from collections import defaultdict
from threading import RLock

from app.bingbu.models import (
    ActionDraft,
    CrmSyncPreview,
    CrmSyncRun,
    DecisionPacket,
    ImportRun,
    Opportunity,
)


class BingbuNotFoundError(LookupError):
    """Requested owner-scoped sales object does not exist."""


class BingbuConflictError(ValueError):
    """An idempotency or immutable identity conflict occurred."""


class BingbuStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._opportunities: dict[str, dict[str, Opportunity]] = defaultdict(dict)
        self._imports: dict[str, dict[str, ImportRun]] = defaultdict(dict)
        self._packets: dict[str, dict[str, DecisionPacket]] = defaultdict(dict)
        self._drafts: dict[str, dict[str, ActionDraft]] = defaultdict(dict)
        self._draft_fingerprints: dict[str, dict[str, str]] = defaultdict(dict)
        self._import_fingerprints: dict[str, dict[str, str]] = defaultdict(dict)
        self._crm_previews: dict[str, dict[str, CrmSyncPreview]] = defaultdict(dict)
        self._crm_runs: dict[str, dict[str, CrmSyncRun]] = defaultdict(dict)
        self._crm_preview_runs: dict[str, dict[str, str]] = defaultdict(dict)

    def list_opportunities(self, owner: str) -> list[Opportunity]:
        with self._lock:
            return list(self._opportunities[owner].values())

    def get_opportunity(self, owner: str, opportunity_id: str) -> Opportunity:
        with self._lock:
            try:
                return self._opportunities[owner][opportunity_id]
            except KeyError as exc:
                raise BingbuNotFoundError("opportunity not found") from exc

    def upsert_opportunity(self, owner: str, opportunity: Opportunity) -> Opportunity:
        with self._lock:
            existing = self._opportunities[owner].get(opportunity.id)
            if existing and existing.model_dump(mode="json") != opportunity.model_dump(mode="json"):
                raise BingbuConflictError("opportunity identity conflict")
            self._opportunities[owner][opportunity.id] = opportunity
            return opportunity

    def get_opportunity_by_external(
        self, owner: str, external_source: str, external_id: str
    ) -> Opportunity | None:
        with self._lock:
            return next(
                (
                    item
                    for item in self._opportunities[owner].values()
                    if item.external_source == external_source and item.external_id == external_id
                ),
                None,
            )

    def save_crm_preview(self, owner: str, preview: CrmSyncPreview) -> CrmSyncPreview:
        with self._lock:
            self._crm_previews[owner][preview.id] = preview
            return preview

    def get_crm_preview(self, owner: str, preview_id: str) -> CrmSyncPreview:
        with self._lock:
            try:
                return self._crm_previews[owner][preview_id]
            except KeyError as exc:
                raise BingbuNotFoundError("crm preview not found") from exc

    def save_crm_run(self, owner: str, run: CrmSyncRun) -> CrmSyncRun:
        with self._lock:
            prior_id = self._crm_preview_runs[owner].get(run.preview_id)
            if prior_id:
                return self._crm_runs[owner][prior_id]
            self._crm_preview_runs[owner][run.preview_id] = run.id
            self._crm_runs[owner][run.id] = run
            return run

    def get_crm_run_by_preview(self, owner: str, preview_id: str) -> CrmSyncRun | None:
        with self._lock:
            run_id = self._crm_preview_runs[owner].get(preview_id)
            return self._crm_runs[owner].get(run_id) if run_id else None

    def save_import(self, owner: str, import_run: ImportRun, fingerprint: str) -> ImportRun:
        with self._lock:
            prior = self._import_fingerprints[owner].get(fingerprint)
            if prior and prior != import_run.id:
                return self._imports[owner][prior]
            self._import_fingerprints[owner][fingerprint] = import_run.id
            self._imports[owner][import_run.id] = import_run
            return import_run

    def get_import_by_fingerprint(self, owner: str, fingerprint: str) -> ImportRun | None:
        with self._lock:
            import_id = self._import_fingerprints[owner].get(fingerprint)
            return self._imports[owner].get(import_id) if import_id else None

    def get_import(self, owner: str, import_id: str) -> ImportRun:
        with self._lock:
            try:
                return self._imports[owner][import_id]
            except KeyError as exc:
                raise BingbuNotFoundError("import not found") from exc

    def save_packet(self, owner: str, packet: DecisionPacket) -> DecisionPacket:
        with self._lock:
            self._packets[owner][packet.id] = packet
            return packet

    def get_packet(self, owner: str, packet_id: str) -> DecisionPacket:
        with self._lock:
            try:
                return self._packets[owner][packet_id]
            except KeyError as exc:
                raise BingbuNotFoundError("decision packet not found") from exc

    def list_packets(self, owner: str) -> list[DecisionPacket]:
        with self._lock:
            return list(self._packets[owner].values())

    def save_draft(self, owner: str, draft: ActionDraft) -> ActionDraft:
        with self._lock:
            prior_id = self._draft_fingerprints[owner].get(draft.idempotency_key)
            if prior_id and prior_id != draft.id:
                return self._drafts[owner][prior_id]
            self._draft_fingerprints[owner][draft.idempotency_key] = draft.id
            self._drafts[owner][draft.id] = draft
            return draft

    def get_draft_by_idempotency(self, owner: str, idempotency_key: str) -> ActionDraft | None:
        with self._lock:
            draft_id = self._draft_fingerprints[owner].get(idempotency_key)
            return self._drafts[owner].get(draft_id) if draft_id else None

    def get_draft(self, owner: str, draft_id: str) -> ActionDraft:
        with self._lock:
            try:
                return self._drafts[owner][draft_id]
            except KeyError as exc:
                raise BingbuNotFoundError("action draft not found") from exc


_STORE = BingbuStore()


def get_store() -> BingbuStore:
    return _STORE
