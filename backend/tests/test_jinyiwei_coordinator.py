from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from test_jinyiwei_shiguan_source import _archive_with_adopted_snapshot, _match

from app.jinyiwei.coordinator import (
    InvestigationCoordinator,
    InvestigationUnavailableError,
)
from app.jinyiwei.extractor import StructuredEvidenceExtractor
from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceItem,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    FreshnessRequirement,
    RequiredFact,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources import SourceDocument, SourceQuery, SourceResult
from app.jinyiwei.sources.shiguan import ShiguanSource
from app.jinyiwei.storage import get_evidence_pack
from app.shiguan.recall import RecallContext

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def _stock_request(
    request_id: str,
    *,
    facts: tuple[tuple[str, str], ...] = (("current_stock", "库存"),),
) -> DataGapRequest:
    return DataGapRequest(
        request_id=request_id,
        requesting_agent="户部",
        question="当前库存是多少？",
        required_facts=tuple(
            RequiredFact(
                key=key,
                description=subject,
                category="PUBLIC_STATISTIC",
                data_scope="INTERNAL_BUSINESS",
                subject=subject,
            )
            for key, subject in facts
        ),
        decision_context="确定库存",
        freshness=FreshnessRequirement(max_age_seconds=3600),
        timeout_seconds=30,
        source_scope=(
            SourceType.SHIGUAN,
            SourceType.PUBLIC_API,
            SourceType.PUBLIC_WEB,
        ),
    )


def _stock_snapshot_model(prompt: str, *, fact_key: str = "current_stock") -> str:
    payload = json.loads(prompt.split("INPUT_JSON:\n", 1)[1])
    return json.dumps(
        {
            "evidence": [
                {
                    "fact_key": fact_key,
                    "document_id": document["document_id"],
                    "source_url": document["source_url"],
                    "value": 42,
                    "unit": "件",
                    "as_of": document["as_of"],
                    "stance": "SUPPORTS",
                    "excerpt": "当前库存为 42 件。",
                }
                for document in payload["documents"]
            ]
        },
        ensure_ascii=False,
    )


def _request(
    *,
    request_id: str = "req-coordinate",
    facts: tuple[str, ...] = ("population", "area"),
    timeout_seconds: int = 30,
    source_scope: tuple[SourceType, ...] = (
        SourceType.PUBLIC_WEB,
        SourceType.SHIGUAN,
        SourceType.PUBLIC_API,
    ),
    max_age_seconds: int = 3600,
) -> DataGapRequest:
    return DataGapRequest(
        request_id=request_id,
        requesting_agent="hubu",
        question="facts needed",
        required_facts=tuple(
            RequiredFact(
                key=key,
                description=f"description for {key}",
                category="ENTITY_REFERENCE",
                data_scope="EXTERNAL_PUBLIC",
                subject=key,
            )
            for key in facts
        ),
        decision_context="decision",
        freshness=FreshnessRequirement(max_age_seconds=max_age_seconds),
        timeout_seconds=timeout_seconds,
        source_scope=source_scope,
    )


def _item(
    evidence_id: str,
    fact_key: str,
    value: object,
    source_type: SourceType,
    *,
    quality: EvidenceQuality = EvidenceQuality.PRIMARY,
    publisher: str = "archive",
    source_url: str | None = None,
) -> EvidenceItem:
    url = source_url or (
        "internal://archive/item" if source_type is SourceType.SHIGUAN
        else f"https://{source_type.value.lower()}.example/item"
    )
    return EvidenceItem(
        evidence_id=evidence_id,
        fact_key=fact_key,
        value=value,
        as_of="2026-07-20T11:30:00Z",
        retrieved_at="2026-07-20T11:45:00Z",
        source_url=url,
        publisher=publisher,
        source_type=source_type,
        quality=quality,
        stance=EvidenceStance.SUPPORTS,
        excerpt="literal",
        content_hash=hashlib.sha256(evidence_id.encode()).hexdigest(),
        confidence=0.9,
    )


class FakeSource:
    def __init__(
        self,
        source_type: SourceType,
        *,
        status: SourceAttemptStatus = SourceAttemptStatus.SUCCEEDED,
        documents: bool = True,
        error: str | None = None,
        on_fetch: object | None = None,
        source_name: str | None = None,
        facts_attempted: tuple[str, ...] | None = None,
    ) -> None:
        self.source_type = source_type
        self.status = status
        self.has_documents = documents
        self.error = error
        self.on_fetch = on_fetch
        self.source_name = source_name or source_type.value.lower()
        self.facts_attempted = facts_attempted
        self.queries: list[SourceQuery] = []

    def fetch(self, query: SourceQuery) -> SourceResult:
        self.queries.append(query)
        if callable(self.on_fetch):
            self.on_fetch()
        timestamp = "2026-07-20T12:00:00Z"
        documents = ()
        if self.has_documents:
            documents = (
                SourceDocument(
                    source_type=self.source_type,
                    source_name=self.source_name,
                    source_url=(
                        "internal://archive/doc"
                        if self.source_type is SourceType.SHIGUAN
                        else f"https://{self.source_type.value.lower()}.example/doc"
                    ),
                    publisher=self.source_type.value.lower(),
                    title="document",
                    retrieved_at=timestamp,
                    as_of="2026-07-20T11:30:00Z",
                    text="literal",
                    quality_ceiling=EvidenceQuality.PRIMARY,
                ),
            )
        return SourceResult(
            documents=documents,
            attempt=SourceAttempt(
                source_type=self.source_type,
                source_name=self.source_name,
                status=self.status,
                started_at=timestamp,
                completed_at=timestamp,
                error=self.error,
                facts_attempted=(
                    query.unresolved_fact_keys
                    if self.facts_attempted is None
                    else self.facts_attempted
                ),
            ),
        )


class FingerprintedMcpSource(FakeSource):
    def __init__(self, fingerprint: str) -> None:
        super().__init__(SourceType.MCP, documents=False)
        self.fingerprint = fingerprint

    def source_configuration_fingerprint(self) -> str:
        return self.fingerprint


class FakeExtractor:
    def __init__(self, evidence: dict[SourceType, tuple[EvidenceItem, ...]]) -> None:
        self.evidence = evidence
        self.calls: list[tuple[SourceQuery, tuple[SourceDocument, ...]]] = []
        self.error_for: SourceType | None = None
        self.on_extract: object | None = None

    def extract(
        self, query: SourceQuery, documents: tuple[SourceDocument, ...]
    ) -> tuple[EvidenceItem, ...]:
        self.calls.append((query, documents))
        source_type = documents[0].source_type
        if callable(self.on_extract):
            self.on_extract()
        if source_type is self.error_for:
            raise RuntimeError("secret extraction details\ntrace")
        return self.evidence.get(source_type, ())


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: int) -> None:
        self.now += timedelta(seconds=seconds)


class ExtractionBudget:
    def __init__(self, claims: list[bool]) -> None:
        self._claims = iter(claims)
        self.count = 0

    def claim(self) -> bool:
        self.count += 1
        return next(self._claims)


def _ids() -> object:
    values = iter(
        (
            "investigation-1",
            "pack-1",
            "investigation-2",
            "pack-2",
            "investigation-3",
            "pack-3",
        )
    )
    return lambda: next(values)


def _coordinator(
    tmp_path: Path,
    *,
    shiguan: FakeSource,
    public_api: FakeSource,
    public_web: FakeSource,
    extractor: FakeExtractor,
    clock: Clock | None = None,
    mcp: FakeSource | None = None,
) -> InvestigationCoordinator:
    return InvestigationCoordinator(
        shiguan=shiguan,
        public_api=public_api,
        public_web=public_web,
        mcp=mcp,
        extractor=extractor,
        clock=clock or Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )


def test_fixed_order_shiguan_short_circuits_network_and_persists(tmp_path: Path) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (
                _item("pop", "population", 10, SourceType.SHIGUAN),
                _item("area", "area", 20, SourceType.SHIGUAN),
            )
        }
    )
    coordinator = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor,
    )

    pack = coordinator.investigate(
        _request(), department="hubu", matter_type="MEMORIAL"
    )

    assert pack.status is EvidencePackStatus.RESOLVED
    assert pack.investigation_plan.source_scope == (
        SourceType.SHIGUAN, SourceType.PUBLIC_API, SourceType.PUBLIC_WEB
    )
    assert len(shiguan.queries) == 1
    assert api.queries == []
    assert web.queries == []
    query = shiguan.queries[0]
    assert query.unresolved_fact_keys == ("population", "area")
    assert query.department == "hubu"
    assert query.matter_type == "MEMORIAL"
    assert query.max_items == 3
    assert get_evidence_pack(pack.pack_id, db_path=tmp_path / "jinyiwei.sqlite3") == pack


def test_fixed_order_uses_mcp_only_after_archive_and_before_public_fallback(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN, documents=False, facts_attempted=())
    mcp = FakeSource(SourceType.MCP)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor(
        {SourceType.MCP: (_item("mcp-pop", "population", 10, SourceType.MCP),)}
    )
    coordinator = InvestigationCoordinator(
        shiguan=shiguan,
        mcp=mcp,
        public_api=api,
        public_web=web,
        extractor=extractor,
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )
    request = _request(
        facts=("population",),
        source_scope=(
            SourceType.PUBLIC_WEB,
            SourceType.MCP,
            SourceType.PUBLIC_API,
            SourceType.SHIGUAN,
        ),
    )

    pack = coordinator.investigate(request, department="hubu", matter_type="MEMORIAL")

    assert pack.investigation_plan.source_scope == (
        SourceType.SHIGUAN,
        SourceType.MCP,
        SourceType.PUBLIC_API,
        SourceType.PUBLIC_WEB,
    )
    assert len(shiguan.queries) == 1
    assert len(mcp.queries) == 1
    assert mcp.queries[0].unresolved_fact_keys == ("population",)
    assert api.queries == []
    assert web.queries == []


def test_real_shiguan_primary_snapshot_short_circuits_external_sources(
    tmp_path: Path,
) -> None:
    shiguan = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("adopted", "库存已核定"),)
        ),
        load_archive=lambda archive_id: _archive_with_adopted_snapshot(archive_id),
        now=lambda: NOW,
    )
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)

    coordinator = InvestigationCoordinator(
        shiguan=shiguan,
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(model=_stock_snapshot_model),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )
    request = _stock_request("req-real-shiguan")

    pack = coordinator.investigate(request, department="户部", matter_type="赈灾")

    assert pack.status is EvidencePackStatus.RESOLVED
    assert pack.resolved_facts == ("current_stock",)
    assert api.queries == []
    assert web.queries == []


def test_real_shiguan_fact_lock_rejects_model_remap_to_other_slot(
    tmp_path: Path,
) -> None:
    shiguan = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("adopted", "库存已核定"),)
        ),
        load_archive=lambda archive_id: _archive_with_adopted_snapshot(archive_id),
        now=lambda: NOW,
    )
    api = FakeSource(SourceType.PUBLIC_API, documents=False)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    coordinator = InvestigationCoordinator(
        shiguan=shiguan,
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(
            model=lambda prompt: _stock_snapshot_model(prompt, fact_key="stock_value")
        ),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        _stock_request(
            "req-fact-lock",
            facts=(("current_stock", "库存"), ("stock_value", "库存价值")),
        ),
        department="户部",
        matter_type="赈灾",
    )

    assert pack.resolved_facts == ()
    assert pack.source_attempts[0].error == "extraction_failed"
    assert len(api.queries) == 1
    assert api.queries[0].unresolved_fact_keys == ("current_stock", "stock_value")


def test_two_independent_authoritative_snapshots_resolve_with_original_provenance(
    tmp_path: Path,
) -> None:
    archives = {
        "a1": _archive_with_adopted_snapshot(
            "a1",
            quality=EvidenceQuality.AUTHORITATIVE,
            evidence_id="authority-a",
            source_url="https://authority-a.example.test/inventory",
            publisher="权威机构甲",
        ),
        "a2": _archive_with_adopted_snapshot(
            "a2",
            quality=EvidenceQuality.AUTHORITATIVE,
            evidence_id="authority-b",
            source_url="https://authority-b.example.test/inventory",
            publisher="权威机构乙",
        ),
    }
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    coordinator = InvestigationCoordinator(
        shiguan=ShiguanSource(
            recall=lambda **_: RecallContext(
                available=True, entries=(_match("a1"), _match("a2"))
            ),
            load_archive=archives.__getitem__,
            now=lambda: NOW,
        ),
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(model=_stock_snapshot_model),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        _stock_request("req-two-authorities"),
        department="户部",
        matter_type="赈灾",
    )

    assert pack.status is EvidencePackStatus.RESOLVED
    items = pack.evidence_by_fact["current_stock"]
    assert {item.publisher for item in items} == {"权威机构甲", "权威机构乙"}
    assert {item.source_url for item in items} == {
        "https://authority-a.example.test/inventory",
        "https://authority-b.example.test/inventory",
    }
    assert all(item.source_type is SourceType.SHIGUAN for item in items)
    assert all(item.access_url.startswith("internal://shiguan/evidence/") for item in items)
    with pytest.raises(TypeError):
        items[0].access_metadata["archive_id"] = "forged"
    assert get_evidence_pack(
        pack.pack_id, db_path=tmp_path / "jinyiwei.sqlite3"
    ) == pack
    assert api.queries == []
    assert web.queries == []


def test_single_authoritative_snapshot_remains_unresolved(
    tmp_path: Path,
) -> None:
    api = FakeSource(SourceType.PUBLIC_API, documents=False)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    coordinator = InvestigationCoordinator(
        shiguan=ShiguanSource(
            recall=lambda **_: RecallContext(
                available=True, entries=(_match("single-authority"),)
            ),
            load_archive=lambda archive_id: _archive_with_adopted_snapshot(
                archive_id, quality=EvidenceQuality.AUTHORITATIVE
            ),
            now=lambda: NOW,
        ),
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(model=_stock_snapshot_model),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        _stock_request("req-single-authority"),
        department="户部",
        matter_type="赈灾",
    )

    assert pack.resolved_facts == ()
    assert len(api.queries) == 1


def test_identical_adopted_id_across_archives_is_extracted_once(
    tmp_path: Path,
) -> None:
    archives = {
        key: _archive_with_adopted_snapshot(key) for key in ("a1", "a2")
    }
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    coordinator = InvestigationCoordinator(
        shiguan=ShiguanSource(
            recall=lambda **_: RecallContext(
                available=True, entries=(_match("a1"), _match("a2"))
            ),
            load_archive=archives.__getitem__,
            now=lambda: NOW,
        ),
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(model=_stock_snapshot_model),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        _stock_request("req-duplicate-identical"),
        department="户部",
        matter_type="赈灾",
    )

    assert pack.status is EvidencePackStatus.RESOLVED
    assert len(pack.evidence_by_fact["current_stock"]) == 1
    assert api.queries == []


def test_conflicting_adopted_id_fails_shiguan_closed_then_continues(
    tmp_path: Path,
) -> None:
    archives = {
        "a1": _archive_with_adopted_snapshot("a1", value=42),
        "a2": _archive_with_adopted_snapshot("a2", value=43),
    }
    api = FakeSource(SourceType.PUBLIC_API, documents=False)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    coordinator = InvestigationCoordinator(
        shiguan=ShiguanSource(
            recall=lambda **_: RecallContext(
                available=True, entries=(_match("a1"), _match("a2"))
            ),
            load_archive=archives.__getitem__,
            now=lambda: NOW,
        ),
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(model=_stock_snapshot_model),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        _stock_request("req-duplicate-conflict"),
        department="户部",
        matter_type="赈灾",
    )

    assert pack.resolved_facts == ()
    assert pack.source_attempts[0].status is SourceAttemptStatus.FAILED
    assert pack.source_attempts[0].error == "shiguan_adopted_evidence_conflict"
    assert len(api.queries) == 1


def test_stale_adopted_snapshot_remains_historical_using_locked_as_of(
    tmp_path: Path,
) -> None:
    api = FakeSource(SourceType.PUBLIC_API, documents=False)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    coordinator = InvestigationCoordinator(
        shiguan=ShiguanSource(
            recall=lambda **_: RecallContext(
                available=True, entries=(_match("stale"),)
            ),
            load_archive=lambda archive_id: _archive_with_adopted_snapshot(
                archive_id,
                as_of="2026-07-20T10:00:00Z",
            ),
            now=lambda: NOW,
        ),
        public_api=api,
        public_web=web,
        extractor=StructuredEvidenceExtractor(model=_stock_snapshot_model),
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        _stock_request("req-stale-adopted"),
        department="户部",
        matter_type="赈灾",
    )

    assert pack.resolved_facts == ()
    assert tuple(pack.historical_evidence_by_fact) == ("current_stock",)
    historical = pack.historical_evidence_by_fact["current_stock"][0]
    assert historical.as_of == "2026-07-20T10:00:00Z"
    assert historical.access_metadata["archive_id"] == "stale"
    assert len(api.queries) == 1


def test_real_shiguan_legacy_archive_does_not_resolve_current_fact(
    tmp_path: Path,
) -> None:
    from test_jinyiwei_shiguan_source import _archive

    shiguan = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("legacy", "当前库存为 42 件。"),)
        ),
        load_archive=lambda archive_id: _archive(
            archive_id,
            archive_type="REPLY",
            created_at="2026-07-20T11:40:00Z",
            reply_time="2026-07-20T11:45:00Z",
        ),
        now=lambda: NOW,
    )
    api = FakeSource(SourceType.PUBLIC_API, documents=False)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (
                _item(
                    "legacy-secondary",
                    "current_stock",
                    42,
                    SourceType.SHIGUAN,
                    quality=EvidenceQuality.SECONDARY,
                ),
            )
        }
    )
    coordinator = InvestigationCoordinator(
        shiguan=shiguan,
        public_api=api,
        public_web=web,
        extractor=extractor,
        clock=Clock(),
        id_factory=_ids(),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )
    request = _request(
        request_id="req-real-legacy",
        facts=("current_stock",),
        source_scope=(
            SourceType.SHIGUAN,
            SourceType.PUBLIC_API,
            SourceType.PUBLIC_WEB,
        ),
    )

    pack = coordinator.investigate(request, department="户部", matter_type="赈灾")

    assert pack.resolved_facts == ()
    assert pack.unresolved_facts == ("current_stock",)
    assert len(api.queries) == 1
    assert len(web.queries) == 1


def test_later_sources_receive_only_unresolved_facts_and_same_deadline(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (_item("pop", "population", 10, SourceType.SHIGUAN),),
            SourceType.PUBLIC_API: (_item("area", "area", 20, SourceType.PUBLIC_API),),
        }
    )
    pack = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor,
    ).investigate(_request(), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.RESOLVED
    assert shiguan.queries[0].unresolved_fact_keys == ("population", "area")
    assert api.queries[0].unresolved_fact_keys == ("area",)
    assert web.queries == []
    assert shiguan.queries[0].deadline_at == api.queries[0].deadline_at


def test_extraction_failure_discards_candidates_and_continues(tmp_path: Path) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    extractor = FakeExtractor(
        {SourceType.PUBLIC_API: (_item("pop", "population", 10, SourceType.PUBLIC_API),)}
    )
    extractor.error_for = SourceType.SHIGUAN
    pack = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor,
    ).investigate(_request(facts=("population",)), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.RESOLVED
    assert pack.source_attempts[0].status is SourceAttemptStatus.FAILED
    assert pack.source_attempts[0].error == "extraction_failed"
    assert tuple(item.evidence_id for item in pack.evidence_by_fact["population"]) == (
        "pop",
    )


def test_extractor_budget_is_claimed_before_call_and_stops_later_sources(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor({})
    budget = ExtractionBudget([False])

    pack = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=api,
        public_web=web,
        extractor=extractor,
    ).investigate(
        _request(facts=("population",)),
        department="hubu",
        matter_type="REPLY",
        extraction_budget=budget,
    )

    assert budget.count == 1
    assert extractor.calls == []
    assert api.queries == []
    assert web.queries == []
    assert pack.status is EvidencePackStatus.BLOCKED
    assert pack.source_attempts[0].status is SourceAttemptStatus.BLOCKED
    assert pack.source_attempts[0].error == "extractor_budget_exhausted"


def test_deadline_discards_over_deadline_source_and_stops_later_calls(
    tmp_path: Path,
) -> None:
    clock = Clock()
    shiguan = FakeSource(SourceType.SHIGUAN, on_fetch=lambda: clock.advance(31))
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor(
        {SourceType.SHIGUAN: (_item("late", "population", 10, SourceType.SHIGUAN),)}
    )
    pack = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor, clock=clock,
    ).investigate(_request(facts=("population",)), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.BLOCKED
    assert pack.evidence_by_fact["population"] == ()
    assert pack.source_attempts[0].status is SourceAttemptStatus.BLOCKED
    assert pack.source_attempts[0].error == "deadline_exceeded"
    assert extractor.calls == []
    assert api.queries == []
    assert web.queries == []


def test_deadline_after_extraction_discards_candidates_and_records_real_source(
    tmp_path: Path,
) -> None:
    clock = Clock()
    shiguan = FakeSource(
        SourceType.SHIGUAN, source_name="shiguan-recall-v1"
    )
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor(
        {SourceType.SHIGUAN: (_item("late", "population", 10, SourceType.SHIGUAN),)}
    )
    extractor.on_extract = lambda: clock.advance(30)

    pack = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor, clock=clock,
    ).investigate(_request(facts=("population",)), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.BLOCKED
    assert pack.evidence_by_fact["population"] == ()
    assert pack.source_attempts[0].source_name == "shiguan-recall-v1"
    assert pack.source_attempts[0].status is SourceAttemptStatus.BLOCKED
    assert api.queries == []
    assert web.queries == []


def test_empty_and_failed_sources_are_unavailable(tmp_path: Path) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(
        SourceType.PUBLIC_API, status=SourceAttemptStatus.FAILED,
        documents=False, error="public_api_unavailable"
    )
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    pack = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=FakeExtractor({}),
    ).investigate(_request(facts=("population",)), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.UNAVAILABLE
    assert len(pack.source_attempts) == 3
    assert pack.unresolved_facts == ("population",)


def test_expired_market_quote_is_unresolved_and_not_inferable(tmp_path: Path) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    pack = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor(
            {
                SourceType.SHIGUAN: (
                    _item("quote", "quote", 320, SourceType.SHIGUAN).model_copy(
                        update={"as_of": "2026-07-20T11:50:00Z"}
                    ),
                )
            }
        ),
    ).investigate(
        _request(
            facts=("quote",),
            source_scope=(SourceType.SHIGUAN,),
            max_age_seconds=300,
        ),
        department="hubu",
        matter_type="MEMORIAL",
    )

    assert pack.status is EvidencePackStatus.PARTIAL
    assert pack.unresolved_facts == ("quote",)
    assert pack.evidence_by_fact["quote"] == ()
    assert tuple(
        item.evidence_id for item in pack.historical_evidence_by_fact["quote"]
    ) == ("quote",)
    assert pack.do_not_infer == ("fact_stale:quote",)


def test_stale_archive_is_history_and_only_its_fact_reaches_external_source(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    stale_population = _item(
        "old-population", "population", 9, SourceType.SHIGUAN
    ).model_copy(update={"as_of": "2026-07-20T10:00:00Z"})
    current_area = _item("current-area", "area", 20, SourceType.SHIGUAN)
    current_population = _item(
        "current-population", "population", 10, SourceType.PUBLIC_API
    )
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (stale_population, current_area),
            SourceType.PUBLIC_API: (current_population,),
        }
    )

    pack = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=api,
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=extractor,
    ).investigate(_request(), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.RESOLVED
    assert api.queries[0].unresolved_fact_keys == ("population",)
    assert tuple(pack.historical_evidence_by_fact) == ("population", "area")
    assert pack.historical_evidence_by_fact["population"] == (stale_population,)
    assert pack.historical_evidence_by_fact["area"] == ()
    assert pack.evidence_by_fact["population"] == (current_population,)
    assert pack.evidence_by_fact["area"] == (current_area,)


def test_stale_external_evidence_is_rejected_not_preserved_as_history(
    tmp_path: Path,
) -> None:
    stale_external = _item(
        "old-public", "population", 9, SourceType.PUBLIC_API
    ).model_copy(update={"as_of": "2026-07-20T10:00:00Z"})
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN, documents=False),
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB, documents=False),
        extractor=FakeExtractor({SourceType.PUBLIC_API: (stale_external,)}),
    ).investigate(
        _request(
            facts=("population",),
            source_scope=(SourceType.PUBLIC_API,),
        ),
        department="hubu",
        matter_type="REPLY",
    )

    assert pack.status is EvidencePackStatus.UNAVAILABLE
    assert pack.evidence_by_fact["population"] == ()
    assert pack.historical_evidence_by_fact["population"] == ()
    assert pack.do_not_infer == ("fact_stale:population",)


def test_category_mismatch_preserves_empty_source_attribution_and_unavailability(
    tmp_path: Path,
) -> None:
    api = FakeSource(
        SourceType.PUBLIC_API, documents=False, facts_attempted=()
    )
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN, documents=False, facts_attempted=()),
        public_api=api,
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor({}),
    ).investigate(
        _request(facts=("quote",), source_scope=(SourceType.PUBLIC_API,)),
        department="hubu",
        matter_type="MEMORIAL",
    )

    assert pack.status is EvidencePackStatus.UNAVAILABLE
    assert pack.source_attempts[0].facts_attempted == ()
    assert pack.do_not_infer == ("fact_unavailable:quote",)


def test_documents_with_no_attempted_fact_cannot_resolve_evidence(tmp_path: Path) -> None:
    public_api = FakeSource(
        SourceType.PUBLIC_API, documents=True, facts_attempted=()
    )
    extractor = FakeExtractor(
        {
            SourceType.PUBLIC_API: (
                _item("quote", "quote", 320, SourceType.PUBLIC_API),
            )
        }
    )
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN, documents=False),
        public_api=public_api,
        public_web=FakeSource(SourceType.PUBLIC_WEB, documents=False),
        extractor=extractor,
    ).investigate(
        _request(facts=("quote",), source_scope=(SourceType.PUBLIC_API,)),
        department="hubu",
        matter_type="MEMORIAL",
    )

    assert pack.status is EvidencePackStatus.UNAVAILABLE
    assert pack.resolved_facts == ()
    assert pack.evidence_by_fact["quote"] == ()
    assert extractor.calls == []


def test_coordinator_persists_only_allowlisted_source_error_codes(tmp_path: Path) -> None:
    raw_error = "https://private.example/search?token=secret&query=decree"
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN, documents=False),
        public_api=FakeSource(
            SourceType.PUBLIC_API,
            documents=False,
            status=SourceAttemptStatus.FAILED,
            error=raw_error,
        ),
        public_web=FakeSource(SourceType.PUBLIC_WEB, documents=False),
        extractor=FakeExtractor({}),
    ).investigate(
        _request(facts=("quote",), source_scope=(SourceType.PUBLIC_API,)),
        department="hubu",
        matter_type="MEMORIAL",
    )

    stored = get_evidence_pack(pack.pack_id, db_path=tmp_path / "jinyiwei.sqlite3")
    assert pack.source_attempts[0].error == "source_unavailable"
    assert stored is not None
    assert stored.source_attempts[0].error == "source_unavailable"
    assert raw_error not in stored.source_attempts[0].error


def test_conflicting_quote_uses_stable_do_not_infer_limitation(tmp_path: Path) -> None:
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN),
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor(
            {
                SourceType.SHIGUAN: (
                    _item("quote-a", "quote", 320, SourceType.SHIGUAN),
                    _item(
                        "quote-b",
                        "quote",
                        321,
                        SourceType.SHIGUAN,
                        publisher="archive-two",
                    ),
                )
            }
        ),
    ).investigate(
        _request(facts=("quote",), source_scope=(SourceType.SHIGUAN,)),
        department="hubu",
        matter_type="MEMORIAL",
    )

    assert pack.status is EvidencePackStatus.PARTIAL
    assert pack.unresolved_facts == ("quote",)
    assert pack.do_not_infer == ("fact_conflicted:quote",)


def test_fresh_archive_short_circuits_whole_pack_cache_and_expiry_rechecks(
    tmp_path: Path,
) -> None:
    clock = Clock()
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (
                _item("pop", "population", 10, SourceType.SHIGUAN).model_copy(
                    update={"as_of": "2026-07-20T11:59:55Z"}
                ),
            )
        }
    )
    coordinator = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor, clock=clock,
    )
    request = _request(facts=("population",), max_age_seconds=10)
    first = coordinator.investigate(request, department="hubu", matter_type="REPLY")
    assert first.cache.hit is False
    assert len(shiguan.queries) == 1

    hit = coordinator.investigate(request, department="hubu", matter_type="REPLY")
    assert hit.cache.hit is False
    assert hit.pack_id != first.pack_id
    assert len(shiguan.queries) == 2
    assert len(extractor.calls) == 2

    clock.advance(11)
    extractor.evidence[SourceType.SHIGUAN] = (
        extractor.evidence[SourceType.SHIGUAN][0].model_copy(
            update={"retrieved_at": "2026-07-20T12:00:10Z"}
        ),
    )
    expired = coordinator.investigate(request, department="hubu", matter_type="REPLY")
    assert expired.cache.hit is False
    assert expired.pack_id != first.pack_id
    assert expired.status is EvidencePackStatus.PARTIAL
    assert expired.evidence_by_fact["population"] == ()
    assert expired.do_not_infer == ("fact_stale:population",)
    assert len(shiguan.queries) == 3


def test_partial_pack_is_not_cached_and_rechecks_recovered_sources(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API, documents=False)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (
                _item("old-population", "population", 9, SourceType.SHIGUAN).model_copy(
                    update={"as_of": "2026-07-20T10:00:00Z"}
                ),
            )
        }
    )
    coordinator = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=api,
        public_web=FakeSource(SourceType.PUBLIC_WEB, documents=False),
        extractor=extractor,
    )
    request = _request(
        facts=("population",),
        source_scope=(SourceType.SHIGUAN, SourceType.PUBLIC_API),
    )

    first = coordinator.investigate(
        request, department="hubu", matter_type="REPLY"
    )
    api.has_documents = True
    extractor.evidence[SourceType.PUBLIC_API] = (
        _item("recovered-population", "population", 10, SourceType.PUBLIC_API),
    )
    second = coordinator.investigate(
        request, department="hubu", matter_type="REPLY"
    )

    assert first.status is EvidencePackStatus.PARTIAL
    assert first.cache.cache_key is None
    assert second.status is EvidencePackStatus.RESOLVED
    assert second.cache.hit is False
    assert len(shiguan.queries) == 2
    assert len(api.queries) == 2


def test_archive_resolution_precedes_resolved_pack_cache_lookup(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN, documents=False)
    api = FakeSource(SourceType.PUBLIC_API)
    extractor = FakeExtractor(
        {
            SourceType.PUBLIC_API: (
                _item("api-population", "population", 10, SourceType.PUBLIC_API),
            )
        }
    )
    coordinator = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=api,
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=extractor,
    )
    request = _request(
        facts=("population",),
        source_scope=(SourceType.SHIGUAN, SourceType.PUBLIC_API),
    )

    coordinator.investigate(request, department="hubu", matter_type="REPLY")
    cached = coordinator.investigate(
        request, department="hubu", matter_type="REPLY"
    )

    assert cached.cache.hit is True
    assert len(shiguan.queries) == 2
    assert len(api.queries) == 1


def test_mcp_cache_hits_only_when_source_configuration_is_unchanged(
    tmp_path: Path,
) -> None:
    request = _request(
        facts=("population",),
        source_scope=(SourceType.SHIGUAN, SourceType.MCP),
    )
    shiguan = FakeSource(SourceType.SHIGUAN, documents=False)
    extractor = FakeExtractor(
        {
            SourceType.MCP: (
                _item("pop", "population", 10, SourceType.MCP),
            )
        }
    )
    mcp = FingerprintedMcpSource("config-a")
    mcp.has_documents = True
    coordinator = _coordinator(
        tmp_path,
        shiguan=shiguan,
        mcp=mcp,
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=extractor,
    )
    first = coordinator.investigate(
        request, department="hubu", matter_type="REPLY"
    )

    hit = coordinator.investigate(request, department="hubu", matter_type="REPLY")
    mcp.fingerprint = "config-b"
    miss = coordinator.investigate(request, department="hubu", matter_type="REPLY")

    assert first.cache.hit is False
    assert hit.cache.hit is True
    assert hit.pack_id == first.pack_id
    assert miss.cache.hit is False
    assert miss.pack_id != first.pack_id
    assert miss.cache.cache_key != first.cache.cache_key
    assert len(shiguan.queries) == 3
    assert len(mcp.queries) == 2


def test_non_mcp_cache_key_remains_the_request_fingerprint(tmp_path: Path) -> None:
    request = _request(
        facts=("population",),
        source_scope=(SourceType.SHIGUAN,),
    )
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN),
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor(
            {
                SourceType.SHIGUAN: (
                    _item("pop", "population", 10, SourceType.SHIGUAN),
                )
            }
        ),
    ).investigate(request, department="hubu", matter_type="REPLY")

    assert pack.cache.cache_key == request.request_fingerprint


def test_duplicate_id_conflict_never_overwrites_prior_content(tmp_path: Path) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    api = FakeSource(SourceType.PUBLIC_API)
    web = FakeSource(SourceType.PUBLIC_WEB, documents=False)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (
                _item("same", "population", 10, SourceType.SHIGUAN,
                      quality=EvidenceQuality.SECONDARY),
            ),
            SourceType.PUBLIC_API: (
                _item("same", "population", 99, SourceType.PUBLIC_API),
            ),
        }
    )
    pack = _coordinator(
        tmp_path, shiguan=shiguan, public_api=api, public_web=web,
        extractor=extractor,
    ).investigate(_request(facts=("population",)), department="hubu", matter_type="REPLY")

    assert pack.status is EvidencePackStatus.PARTIAL
    assert pack.evidence_by_fact["population"][0].value == 10
    assert pack.source_attempts[1].status is SourceAttemptStatus.FAILED
    assert pack.source_attempts[1].error == "duplicate_evidence_id_conflict"


def test_conflicting_duplicate_ids_within_one_batch_merge_nothing(
    tmp_path: Path,
) -> None:
    shiguan = FakeSource(SourceType.SHIGUAN)
    extractor = FakeExtractor(
        {
            SourceType.SHIGUAN: (
                _item("same", "population", 10, SourceType.SHIGUAN),
                _item("same", "population", 99, SourceType.SHIGUAN),
            )
        }
    )
    pack = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=FakeSource(SourceType.PUBLIC_API, documents=False),
        public_web=FakeSource(SourceType.PUBLIC_WEB, documents=False),
        extractor=extractor,
    ).investigate(
        _request(facts=("population",), source_scope=(SourceType.SHIGUAN,)),
        department="hubu",
        matter_type="REPLY",
    )

    assert pack.status is EvidencePackStatus.UNAVAILABLE
    assert pack.resolved_facts == ()
    assert pack.evidence_by_fact["population"] == ()
    assert pack.source_attempts[0].status is SourceAttemptStatus.FAILED
    assert pack.source_attempts[0].error == "duplicate_evidence_id_conflict"


def test_source_exception_at_deadline_blocks_current_source_and_stops(
    tmp_path: Path,
) -> None:
    clock = Clock()

    def cross_deadline() -> None:
        clock.advance(30)
        raise RuntimeError("source secret\ntrace")

    shiguan = FakeSource(SourceType.SHIGUAN, on_fetch=cross_deadline)
    api = FakeSource(SourceType.PUBLIC_API)
    pack = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=api,
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor({}),
        clock=clock,
    ).investigate(
        _request(facts=("population",)), department="hubu", matter_type="REPLY"
    )

    assert pack.status is EvidencePackStatus.BLOCKED
    assert len(pack.source_attempts) == 1
    assert pack.source_attempts[0].source_type is SourceType.SHIGUAN
    assert pack.source_attempts[0].status is SourceAttemptStatus.BLOCKED
    assert pack.source_attempts[0].error == "deadline_exceeded"
    assert api.queries == []


def test_extraction_exception_at_deadline_blocks_current_source_and_stops(
    tmp_path: Path,
) -> None:
    clock = Clock()
    extractor = FakeExtractor({})
    extractor.error_for = SourceType.SHIGUAN
    extractor.on_extract = lambda: clock.advance(30)
    api = FakeSource(SourceType.PUBLIC_API)
    pack = _coordinator(
        tmp_path,
        shiguan=FakeSource(SourceType.SHIGUAN, source_name="shiguan-recall-v1"),
        public_api=api,
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=extractor,
        clock=clock,
    ).investigate(
        _request(facts=("population",)), department="hubu", matter_type="REPLY"
    )

    assert pack.status is EvidencePackStatus.BLOCKED
    assert len(pack.source_attempts) == 1
    assert pack.source_attempts[0].source_type is SourceType.SHIGUAN
    assert pack.source_attempts[0].source_name == "shiguan-recall-v1"
    assert pack.source_attempts[0].status is SourceAttemptStatus.BLOCKED
    assert api.queries == []


def test_storage_failure_raises_typed_unavailable_without_source_work(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.jinyiwei import coordinator as module

    shiguan = FakeSource(SourceType.SHIGUAN)
    coordinator = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor({}),
    )

    def fail(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("database secret\ntrace")

    monkeypatch.setattr(module, "store_data_gap_request", fail)
    with pytest.raises(
        InvestigationUnavailableError, match="investigation_persistence_unavailable"
    ):
        coordinator.investigate(
            _request(facts=("population",)), department="hubu", matter_type="REPLY"
        )
    assert shiguan.queries == []


def test_cache_operational_failure_is_typed_after_archive_resolution(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.jinyiwei import coordinator as module
    from app.jinyiwei.storage import JinyiweiStorageError

    shiguan = FakeSource(SourceType.SHIGUAN)
    coordinator = _coordinator(
        tmp_path,
        shiguan=shiguan,
        public_api=FakeSource(SourceType.PUBLIC_API),
        public_web=FakeSource(SourceType.PUBLIC_WEB),
        extractor=FakeExtractor({}),
    )

    def fail(*_args: object, **_kwargs: object) -> None:
        raise JinyiweiStorageError("operational details")

    monkeypatch.setattr(module, "lookup_cached_pack", fail)
    with pytest.raises(
        InvestigationUnavailableError, match="investigation_persistence_unavailable"
    ):
        coordinator.investigate(
            _request(facts=("population",)), department="hubu", matter_type="REPLY"
        )
    assert len(shiguan.queries) == 1
