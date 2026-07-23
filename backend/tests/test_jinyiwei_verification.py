from __future__ import annotations

import hashlib
from datetime import UTC, datetime

import app.jinyiwei.verification as verification
from app.jinyiwei.models import (
    DataGapRequest,
    EvidenceItem,
    EvidenceQuality,
    EvidenceStance,
    FreshnessRequirement,
    RequiredFact,
    SourceType,
)
from app.jinyiwei.verification import verify_evidence

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def _request(
    *,
    facts: tuple[str, ...] = ("population", "area"),
    freshness: FreshnessRequirement | None = None,
) -> DataGapRequest:
    return DataGapRequest(
        request_id="req-verify",
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
        freshness=freshness or FreshnessRequirement(max_age_seconds=3600),
        timeout_seconds=30,
        source_scope=(
            SourceType.PUBLIC_WEB,
            SourceType.SHIGUAN,
            SourceType.PUBLIC_API,
        ),
    )


def _evidence(
    evidence_id: str,
    fact_key: str,
    value: object,
    *,
    quality: EvidenceQuality = EvidenceQuality.PRIMARY,
    stance: EvidenceStance = EvidenceStance.SUPPORTS,
    source_type: SourceType = SourceType.SHIGUAN,
    publisher: str = "publisher-a",
    source_url: str = "internal://archive/item-a",
    as_of: str = "2026-07-20T11:30:00Z",
) -> EvidenceItem:
    return EvidenceItem(
        evidence_id=evidence_id,
        fact_key=fact_key,
        value=value,
        as_of=as_of,
        retrieved_at="2026-07-20T11:45:00Z",
        source_url=source_url,
        publisher=publisher,
        source_type=source_type,
        quality=quality,
        stance=stance,
        excerpt="literal evidence",
        content_hash=hashlib.sha256(evidence_id.encode()).hexdigest(),
        confidence=0.9,
    )


def test_primary_and_two_independent_authoritative_items_resolve() -> None:
    request = _request()
    candidates = (
        _evidence("area-b", "area", 16_410, quality=EvidenceQuality.AUTHORITATIVE,
                  source_type=SourceType.PUBLIC_API, publisher="agency-b",
                  source_url="https://b.example/facts"),
        _evidence("population-primary", "population", 21_800_000),
        _evidence("area-a", "area", 16_410, quality=EvidenceQuality.AUTHORITATIVE,
                  source_type=SourceType.PUBLIC_API, publisher="agency-a",
                  source_url="https://a.example/facts"),
    )

    result = verify_evidence(request, candidates, now=NOW)

    assert result.resolved_facts == ("population", "area")
    assert result.unresolved_facts == ()
    assert result.conflicts == ()
    assert result.do_not_infer == ()
    assert tuple(result.evidence_by_fact) == ("population", "area")


def test_authoritative_items_require_distinct_publishers_and_origins() -> None:
    request = _request(facts=("population",))
    same_publisher = (
        _evidence("a", "population", 10, quality=EvidenceQuality.AUTHORITATIVE,
                  source_type=SourceType.PUBLIC_API, publisher="agency",
                  source_url="https://a.example/one"),
        _evidence("b", "population", 10, quality=EvidenceQuality.AUTHORITATIVE,
                  source_type=SourceType.PUBLIC_API, publisher="agency",
                  source_url="https://b.example/two"),
    )
    same_origin = (
        same_publisher[0],
        _evidence("c", "population", 10, quality=EvidenceQuality.AUTHORITATIVE,
                  source_type=SourceType.PUBLIC_API, publisher="other",
                  source_url="https://a.example/two"),
    )

    for candidates in (same_publisher, same_origin):
        result = verify_evidence(request, candidates, now=NOW)
        assert result.resolved_facts == ()
        assert result.unresolved_facts == ("population",)
        assert result.conflicts == ()
        assert result.do_not_infer == (
            "population: insufficient fresh independent credible evidence; do not infer",
        )


def test_stale_items_fail_both_freshness_constraints() -> None:
    request = _request(
        facts=("population",),
        freshness=FreshnessRequirement(
            max_age_seconds=3600, not_before="2026-07-20T11:15:00Z"
        ),
    )
    too_old_for_age = _evidence(
        "old-age", "population", 10, as_of="2026-07-20T10:59:59Z"
    )
    too_old_for_floor = _evidence(
        "old-floor", "population", 10, as_of="2026-07-20T11:10:00Z"
    )

    result = verify_evidence(request, (too_old_for_age, too_old_for_floor), now=NOW)

    assert result.resolved_facts == ()
    assert result.unresolved_facts == ("population",)
    assert result.evidence_by_fact["population"] == (
        too_old_for_age,
        too_old_for_floor,
    )


def test_archive_resolution_separates_stale_history_from_current_evidence() -> None:
    request = _request(facts=("population", "area"))
    stale_population = _evidence(
        "old-population",
        "population",
        9,
        as_of="2026-07-20T10:59:59Z",
    )
    current_area = _evidence("current-area", "area", 20)

    resolution = verification.resolve_archive_evidence(
        request,
        (stale_population, current_area),
        now=NOW,
    )

    assert resolution.current == (current_area,)
    assert resolution.historical == (stale_population,)
    assert resolution.unresolved_fact_keys == ("population",)


def test_value_and_stance_conflicts_are_scoped_and_prevent_resolution() -> None:
    request = _request()
    population_a = _evidence("pop-a", "population", {"count": 10})
    population_b = _evidence(
        "pop-b", "population", {"count": 11},
        quality=EvidenceQuality.AUTHORITATIVE,
        source_type=SourceType.PUBLIC_API,
        publisher="agency-b", source_url="https://b.example/fact",
    )
    area_support = _evidence("area-support", "area", 20)
    area_contradicts = _evidence(
        "area-against", "area", 20, stance=EvidenceStance.CONTRADICTS,
        quality=EvidenceQuality.AUTHORITATIVE,
        source_type=SourceType.PUBLIC_API,
        publisher="agency-c", source_url="https://c.example/fact",
    )

    result = verify_evidence(
        request,
        (area_contradicts, population_b, area_support, population_a),
        now=NOW,
    )

    assert result.resolved_facts == ()
    assert result.unresolved_facts == ("population", "area")
    assert tuple(conflict.fact_key for conflict in result.conflicts) == (
        "population", "area"
    )
    assert result.conflicts[0].evidence_ids == ("pop-a", "pop-b")
    assert result.conflicts[1].evidence_ids == ("area-support", "area-against")
    for conflict in result.conflicts:
        assert set(conflict.evidence_ids) <= {
            item.evidence_id for item in result.evidence_by_fact[conflict.fact_key]
        }
    assert result.do_not_infer == (
        "population: credible evidence conflicts; do not infer",
        "area: credible evidence conflicts; do not infer",
    )


def test_output_order_is_request_then_fixed_source_and_evidence_order() -> None:
    request = _request()
    candidates = (
        _evidence("z-web", "population", 1, quality=EvidenceQuality.SECONDARY,
                  source_type=SourceType.PUBLIC_WEB, publisher="web",
                  source_url="https://web.example/z"),
        _evidence("b-api", "population", 1, quality=EvidenceQuality.SECONDARY,
                  source_type=SourceType.PUBLIC_API, publisher="api",
                  source_url="https://api.example/b"),
        _evidence("a-api", "population", 1, quality=EvidenceQuality.SECONDARY,
                  source_type=SourceType.PUBLIC_API, publisher="api",
                  source_url="https://api.example/a"),
    )

    first = verify_evidence(request, candidates, now=NOW)
    second = verify_evidence(request, tuple(reversed(candidates)), now=NOW)

    assert first == second
    assert tuple(item.evidence_id for item in first.evidence_by_fact["population"]) == (
        "a-api", "b-api", "z-web"
    )
    assert first.evidence_by_fact["area"] == ()
