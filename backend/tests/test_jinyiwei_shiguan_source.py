from __future__ import annotations

import hashlib
import inspect
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceItem,
    EvidenceQuality,
    FreshnessRequirement,
    RequiredFact,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources import (
    EvidenceExtractor,
    EvidenceSource,
    ShiguanSource,
    SourceDocument,
    SourceQuery,
    SourceResult,
)
from app.shiguan.models import (
    Archive,
    ArchiveEvidenceReference,
    ArchiveEvidenceSnapshot,
    Evidence,
    ReviewStatus,
    _snapshot_json,
)
from app.shiguan.recall import RecallContext, RecallMatch

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def _request() -> DataGapRequest:
    return DataGapRequest(
        request_id="req-1",
        requesting_agent="户部",
        question="去年赈灾结论可否作为当前依据？",
        required_facts=(
            RequiredFact(
                key="historical_outcome",
                description="历史办理结论",
                category="ENTITY_REFERENCE",
                data_scope="INTERNAL_BUSINESS",
                subject="赈灾",
            ),
            RequiredFact(
                key="current_stock",
                description="当前库存",
                category="PUBLIC_STATISTIC",
                data_scope="INTERNAL_BUSINESS",
                subject="库存",
            ),
        ),
        decision_context="决定是否需要继续查实时库存",
        freshness=FreshnessRequirement(max_age_seconds=3600),
        timeout_seconds=30,
        source_scope=(SourceType.SHIGUAN,),
    )


def _query(**changes: object) -> SourceQuery:
    values: dict[str, object] = {
        "request": _request(),
        "unresolved_fact_keys": ("historical_outcome",),
        "department": "户部",
        "max_items": 3,
        "deadline_at": "2099-07-20T12:00:00Z",
    }
    values.update(changes)
    return SourceQuery(**values)


def _match(archive_id: str, conclusion: str = "旧案已完成赈济") -> RecallMatch:
    return RecallMatch(
        archive_id=archive_id,
        match_reason="仅部门匹配",
        historical_conclusion=conclusion,
        evidence_labels=["FALLBACK"],
        review_status=ReviewStatus(
            status="PARTIAL", reviewed_at="2025-02-01T00:00:00Z", note="仍待复核"
        ),
        lessons_learned="先核实仓储",
        pitfalls="不可套用旧数",
    )


def _archive(
    archive_id: str,
    *,
    archive_type: str = "MEMORIAL",
    created_at: str = "2025-01-01T00:00:00Z",
    reply_time: str | None = None,
) -> Archive:
    payload: dict[str, object] = {
        "id": archive_id,
        "type": archive_type,
        "title": f"档案 {archive_id}",
        "content": "历史内容",
        "matter_type": "赈灾",
        "department": "户部",
        "created_at": created_at,
        "evidence": [Evidence(source="旧案", reality_label="FALLBACK", note="仅供参考")],
        "review_status": ReviewStatus(
            status="PARTIAL", reviewed_at="2025-02-01T00:00:00Z", note="仍待复核"
        ),
    }
    if archive_type == "REPLY":
        payload.update(
            source_kind="DECREE",
            source_text="旧旨",
            participating_departments=["户部"],
            reply_process="核查后回奏",
            reply_conclusion="旧案已完成赈济",
            reply_time=reply_time or "2025-01-03T00:00:00Z",
            respondent="户部",
        )
    return Archive(**payload)


def _archive_with_adopted_snapshot(
    archive_id: str,
    *,
    quality: EvidenceQuality = EvidenceQuality.PRIMARY,
    evidence_id: str = "adopted-current-stock",
    fact_key: str = "current_stock",
    value: int = 42,
    as_of: str = "2026-07-20T11:30:00Z",
    source_url: str = "https://business.example.test/inventory/42",
    publisher: str = "库存业务系统",
    source_type: str = "PUBLIC_API",
    access_url: str | None = None,
    access_metadata: dict[str, object] | None = None,
) -> Archive:
    archive = _archive(
        archive_id,
        archive_type="REPLY",
        created_at="2026-07-20T11:40:00Z",
        reply_time="2026-07-20T11:45:00Z",
    )
    snapshot = ArchiveEvidenceSnapshot(
        evidence_id=evidence_id,
        fact_key=fact_key,
        category="PUBLIC_STATISTIC",
        data_scope="INTERNAL_BUSINESS",
        subject="库存",
        value=value,
        unit="件",
        as_of=as_of,
        retrieved_at="2026-07-20T11:35:00Z",
        source_url=source_url,
        publisher=publisher,
        source_type=source_type,
        quality=quality.value,
        stance="SUPPORTS",
        excerpt="当前库存为 42 件。",
        content_hash=hashlib.sha256("当前库存为 42 件。".encode()).hexdigest(),
        confidence=0.9,
        access_url=access_url,
        access_metadata=access_metadata,
    )
    reference = ArchiveEvidenceReference(
        pack_id="pack-adopted",
        investigation_id="investigation-adopted",
        snapshot=snapshot,
        ordinal=0,
        evidence_id=snapshot.evidence_id,
        snapshot_hash=hashlib.sha256(_snapshot_json(snapshot).encode()).hexdigest(),
    )
    return archive.model_copy(update={"evidence_references": [reference]})


def _archive_with_three_adopted_snapshots(archive_id: str) -> Archive:
    references = [
        _archive_with_adopted_snapshot(
            f"{archive_id}-{index}",
            evidence_id=evidence_id,
            value=42 + index,
            source_url=f"https://business.example.test/inventory/{evidence_id}",
        ).evidence_references[0]
        for index, evidence_id in enumerate(("same", "other-1", "other-2"))
    ]
    return _archive_with_adopted_snapshot(archive_id).model_copy(
        update={"evidence_references": references}
    )


def test_source_contracts_are_frozen_bounded_and_protocol_conformant() -> None:
    query = _query()
    document = SourceDocument(
        source_type=SourceType.SHIGUAN,
        source_name="shiguan",
        source_url="internal://shiguan/archives/a1",
        publisher="史馆",
        title="旧档",
        retrieved_at="2026-07-20T12:00:00Z",
        as_of="2025-01-01T00:00:00Z",
        text="历史结论，不代表当前实时状态。",
        quality_ceiling=EvidenceQuality.SECONDARY,
        metadata={"review_status": "PARTIAL"},
    )

    class Source:
        def fetch(self, query: SourceQuery) -> SourceResult:
            raise NotImplementedError

    class Extractor:
        def extract(
            self, query: SourceQuery, documents: tuple[SourceDocument, ...]
        ) -> tuple[EvidenceItem, ...]:
            raise NotImplementedError

    assert isinstance(Source(), EvidenceSource)
    assert isinstance(Extractor(), EvidenceExtractor)
    assert not isinstance(document, EvidenceItem)
    with pytest.raises(ValidationError):
        query.max_items = 9
    with pytest.raises(TypeError):
        document.metadata["review_status"] = "ACHIEVED"
    with pytest.raises(ValidationError):
        _query(max_items=0)
    with pytest.raises(ValidationError):
        _query(unresolved_fact_keys=("not_requested",))
    with pytest.raises(ValidationError):
        SourceDocument(
            source_type=SourceType.SHIGUAN,
            source_name="shiguan",
            source_url="http://unsafe.example/archive",
            publisher="史馆",
            title="旧档",
            retrieved_at="2026-07-20T12:00:00Z",
            as_of="2025-01-01T00:00:00Z",
            text="旧案",
            quality_ceiling=EvidenceQuality.SECONDARY,
        )


def test_shiguan_source_maps_matches_without_promoting_historical_data() -> None:
    recall_calls: list[dict[str, object]] = []

    def recall(**kwargs: object) -> RecallContext:
        recall_calls.append(kwargs)
        return RecallContext(available=True, entries=(_match("a1"),))

    source = ShiguanSource(
        recall=recall,
        load_archive=lambda archive_id: _archive(
            archive_id, archive_type="REPLY", reply_time="2025-01-03T00:00:00Z"
        ),
        now=lambda: NOW,
    )
    result = source.fetch(_query(matter_type="赈灾", max_items=2))

    assert recall_calls == [{"matter_type": "赈灾", "department": "户部", "limit": 2}]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert result.attempt.facts_attempted == ("historical_outcome",)
    assert len(result.documents) == 1
    document = result.documents[0]
    assert document.source_url == "internal://shiguan/archives/a1"
    assert document.as_of == "2025-01-03T00:00:00Z"
    assert document.retrieved_at == "2026-07-20T12:00:00Z"
    assert document.quality_ceiling is EvidenceQuality.SECONDARY
    assert "旧案已完成赈济" in document.text
    assert "不代表当前实时状态" in document.text
    assert document.metadata["created_at"] == "2025-01-01T00:00:00Z"
    assert document.metadata["review_status"] == "PARTIAL"
    assert document.metadata["evidence_labels"] == ("FALLBACK",)


def test_shiguan_source_restores_adopted_snapshot_quality_and_source_metadata() -> None:
    source = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("a1", "库存已核定"),)
        ),
        load_archive=lambda archive_id: _archive_with_adopted_snapshot(
            archive_id, quality=EvidenceQuality.AUTHORITATIVE
        ),
        now=lambda: NOW,
    )

    result = source.fetch(_query(unresolved_fact_keys=("current_stock",)))

    assert len(result.documents) == 1
    document = result.documents[0]
    assert document.quality_ceiling is EvidenceQuality.AUTHORITATIVE
    assert document.as_of == "2026-07-20T11:30:00Z"
    assert document.text == "当前库存为 42 件。"
    assert document.metadata["adopted_evidence_id"] == "adopted-current-stock"
    assert document.metadata["original_source_type"] == "PUBLIC_API"
    assert document.metadata["original_source_url"] == (
        "https://business.example.test/inventory/42"
    )
    assert document.metadata["original_publisher"] == "库存业务系统"
    assert document.locked_fact_key == "current_stock"
    assert document.locked_fact_category == "PUBLIC_STATISTIC"
    assert document.locked_subject == "库存"
    assert document.adopted_evidence is not None
    assert document.adopted_evidence.evidence_id == "adopted-current-stock"


def test_shiguan_source_faithfully_restores_original_mcp_provenance() -> None:
    access_metadata = {
        "mcp_server_id": "market-data",
        "mcp_tool_name": "data_quote",
        "approval_version": "2026-07-22",
        "mapping_version": "quote-v1",
        "response_hash": "a" * 64,
        "mapping": {"value_path": "data.price"},
    }
    result = ShiguanSource(
        recall=lambda **_: RecallContext(available=True, entries=(_match("a1"),)),
        load_archive=lambda archive_id: _archive_with_adopted_snapshot(
            archive_id,
            source_type="MCP",
            source_url="https://stock.example.test/quote/002594",
            publisher="行情提供方",
            access_url="https://stock.example.test/quote/002594",
            access_metadata=access_metadata,
        ),
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",)))

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    document = result.documents[0]
    assert document.adopted_evidence is not None
    assert document.adopted_evidence.source_type is SourceType.MCP
    assert document.adopted_evidence.source_url == (
        "https://stock.example.test/quote/002594"
    )
    assert document.adopted_evidence.publisher == "行情提供方"
    assert document.adopted_evidence.access_metadata == access_metadata
    assert document.metadata["original_access_metadata"] == access_metadata
    with pytest.raises(TypeError):
        document.metadata["original_access_metadata"]["mapping"][
            "value_path"
        ] = "forged"


def test_shiguan_source_keeps_secondary_snapshot_and_legacy_archive_conservative() -> None:
    secondary = ShiguanSource(
        recall=lambda **_: RecallContext(available=True, entries=(_match("a1"),)),
        load_archive=lambda archive_id: _archive_with_adopted_snapshot(
            archive_id, quality=EvidenceQuality.SECONDARY
        ),
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",)))
    legacy = ShiguanSource(
        recall=lambda **_: RecallContext(available=True, entries=(_match("a2"),)),
        load_archive=lambda archive_id: _archive(
            archive_id,
            archive_type="REPLY",
            created_at="2026-07-20T11:40:00Z",
            reply_time="2026-07-20T11:45:00Z",
        ),
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",)))

    assert secondary.documents[0].quality_ceiling is EvidenceQuality.SECONDARY
    assert legacy.documents[0].quality_ceiling is EvidenceQuality.SECONDARY
    assert "adopted_evidence_id" not in legacy.documents[0].metadata


def test_shiguan_source_deduplicates_identical_adopted_evidence_across_archives() -> None:
    archives = {
        key: _archive_with_adopted_snapshot(key) for key in ("a1", "a2")
    }
    result = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("a1"), _match("a2"))
        ),
        load_archive=archives.__getitem__,
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",)))

    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert len(result.documents) == 1
    assert result.documents[0].metadata["adopted_evidence_id"] == (
        "adopted-current-stock"
    )


def test_shiguan_source_rejects_conflicting_content_for_same_adopted_id() -> None:
    archives = {
        "a1": _archive_with_adopted_snapshot("a1", value=42),
        "a2": _archive_with_adopted_snapshot("a2", value=43),
    }
    result = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("a1"), _match("a2"))
        ),
        load_archive=archives.__getitem__,
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",)))

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "shiguan_adopted_evidence_conflict"


def test_output_budget_does_not_hide_later_adopted_id_conflict() -> None:
    archives = {
        "full": _archive_with_three_adopted_snapshots("full"),
        "later": _archive_with_adopted_snapshot(
            "later", evidence_id="same", value=999
        ),
    }
    loaded: list[str] = []

    def load(archive_id: str) -> Archive:
        loaded.append(archive_id)
        return archives[archive_id]

    result = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("full"), _match("later"))
        ),
        load_archive=load,
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",), max_items=3))

    assert loaded == ["full", "later"]
    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "shiguan_adopted_evidence_conflict"


def test_output_budget_scans_later_new_ids_but_still_emits_strict_limit() -> None:
    archives = {
        "full": _archive_with_three_adopted_snapshots("full"),
        "later": _archive_with_adopted_snapshot(
            "later", evidence_id="new-later", value=100
        ),
    }
    loaded: list[str] = []

    def load(archive_id: str) -> Archive:
        loaded.append(archive_id)
        return archives[archive_id]

    result = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("full"), _match("later"))
        ),
        load_archive=load,
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",), max_items=3))

    assert loaded == ["full", "later"]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert [doc.adopted_evidence.evidence_id for doc in result.documents] == [
        "same",
        "other-1",
        "other-2",
    ]


def test_output_budget_scans_later_identical_duplicate_without_error() -> None:
    archives = {
        "full": _archive_with_three_adopted_snapshots("full"),
        "later": _archive_with_adopted_snapshot(
            "later",
            evidence_id="same",
            value=42,
            source_url="https://business.example.test/inventory/same",
        ),
    }
    loaded: list[str] = []

    def load(archive_id: str) -> Archive:
        loaded.append(archive_id)
        return archives[archive_id]

    result = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("full"), _match("later"))
        ),
        load_archive=load,
        now=lambda: NOW,
    ).fetch(_query(unresolved_fact_keys=("current_stock",), max_items=3))

    assert loaded == ["full", "later"]
    assert result.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert len(result.documents) == 3


def test_shiguan_source_preserves_recall_order_deduplicates_and_applies_item_budget() -> None:
    loaded: list[str] = []

    def load(archive_id: str) -> Archive:
        loaded.append(archive_id)
        return _archive(archive_id)

    source = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True,
            entries=(_match("b"), _match("a"), _match("b"), _match("c")),
        ),
        load_archive=load,
        now=lambda: NOW,
    )
    result = source.fetch(_query(max_items=2))

    assert loaded == ["b", "a"]
    assert [document.source_url for document in result.documents] == [
        "internal://shiguan/archives/b",
        "internal://shiguan/archives/a",
    ]
    assert [document.as_of for document in result.documents] == [
        "2025-01-01T00:00:00Z",
        "2025-01-01T00:00:00Z",
    ]


def test_shiguan_source_distinguishes_empty_unavailable_and_missing_context() -> None:
    empty = ShiguanSource(
        recall=lambda **_: RecallContext(available=True),
        load_archive=lambda archive_id: _archive(archive_id),
        now=lambda: NOW,
    ).fetch(_query())
    unavailable = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=False, reason="details that must not escape\nsecret"
        ),
        load_archive=lambda archive_id: _archive(archive_id),
        now=lambda: NOW,
    ).fetch(_query())
    missing_context = ShiguanSource(
        recall=lambda **_: pytest.fail("recall must not run without explicit context"),
        load_archive=lambda archive_id: _archive(archive_id),
        now=lambda: NOW,
    ).fetch(_query(department=None, matter_type=None))

    assert empty.documents == ()
    assert empty.attempt.status is SourceAttemptStatus.SUCCEEDED
    assert empty.attempt.error is None
    assert unavailable.documents == ()
    assert unavailable.attempt.status is SourceAttemptStatus.FAILED
    assert unavailable.attempt.error == "shiguan_unavailable"
    assert missing_context.documents == ()
    assert missing_context.attempt.status is SourceAttemptStatus.SKIPPED
    assert missing_context.attempt.error == "query_context_missing"


@pytest.mark.parametrize("failure_stage", ["recall", "archive"])
def test_shiguan_source_fails_closed_and_sanitizes_exceptions(failure_stage: str) -> None:
    def recall(**_: object) -> RecallContext:
        if failure_stage == "recall":
            raise RuntimeError("database path C:\\secret\ncredential")
        return RecallContext(available=True, entries=(_match("a1"),))

    def load(archive_id: str) -> Archive:
        if failure_stage == "archive":
            raise RuntimeError(f"could not load {archive_id}: token=secret")
        return _archive(archive_id)

    result = ShiguanSource(recall=recall, load_archive=load, now=lambda: NOW).fetch(_query())

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.FAILED
    assert result.attempt.error == "shiguan_unavailable"


def test_shiguan_source_blocks_expired_deadline_without_recall() -> None:
    result = ShiguanSource(
        recall=lambda **_: pytest.fail("recall must not run after deadline"),
        load_archive=lambda archive_id: _archive(archive_id),
        now=lambda: NOW,
    ).fetch(_query(deadline_at="2026-07-20T11:59:59Z"))

    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.BLOCKED
    assert result.attempt.error == "deadline_exceeded"


def test_shiguan_source_blocks_when_recall_crosses_deadline_without_loading() -> None:
    current = [datetime(2026, 7, 20, 11, 59, 58, tzinfo=UTC)]
    loaded: list[str] = []

    def recall(**_: object) -> RecallContext:
        current[0] = datetime(2026, 7, 20, 12, 0, 1, tzinfo=UTC)
        return RecallContext(available=True, entries=(_match("a"),))

    def load(archive_id: str) -> Archive:
        loaded.append(archive_id)
        return _archive(archive_id)

    result = ShiguanSource(
        recall=recall, load_archive=load, now=lambda: current[0]
    ).fetch(_query(deadline_at="2026-07-20T12:00:00Z"))

    assert loaded == []
    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.BLOCKED
    assert result.attempt.error == "deadline_exceeded"


def test_shiguan_source_blocks_when_archive_load_crosses_deadline_and_stops() -> None:
    current = [datetime(2026, 7, 20, 11, 59, 58, tzinfo=UTC)]
    loaded: list[str] = []

    def load(archive_id: str) -> Archive:
        loaded.append(archive_id)
        if archive_id == "b":
            current[0] = datetime(2026, 7, 20, 12, 0, 1, tzinfo=UTC)
        return _archive(archive_id)

    result = ShiguanSource(
        recall=lambda **_: RecallContext(
            available=True, entries=(_match("a"), _match("b"), _match("c"))
        ),
        load_archive=load,
        now=lambda: current[0],
    ).fetch(_query(deadline_at="2026-07-20T12:00:00Z"))

    assert loaded == ["a", "b"]
    assert result.documents == ()
    assert result.attempt.status is SourceAttemptStatus.BLOCKED
    assert result.attempt.error == "deadline_exceeded"


def test_shiguan_source_uses_only_public_recall_and_storage_ports() -> None:
    import app.jinyiwei.sources.shiguan as shiguan_source

    source = inspect.getsource(shiguan_source)
    assert "app.shiguan.recall" in source
    assert "app.shiguan.storage" in source
    assert "sqlite" not in source
    assert "app.shiguan.db" not in source
    assert "list_archives" not in source
