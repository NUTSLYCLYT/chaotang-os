from datetime import UTC, datetime

from app.jinyiwei.models import (
    EvidenceItem,
    EvidenceQuality,
    EvidenceStance,
    SourceType,
    TrustEvidenceState,
)
from app.jinyiwei.trust import assess_evidence


def _item(
    evidence_id: str,
    *,
    quality: EvidenceQuality = EvidenceQuality.PRIMARY,
    stance: EvidenceStance = EvidenceStance.SUPPORTS,
    as_of: str = "2026-10-08T00:00:00Z",
) -> EvidenceItem:
    return EvidenceItem(
        evidence_id=evidence_id,
        fact_key="fact",
        value={"value": 1},
        as_of=as_of,
        retrieved_at="2026-10-08T00:01:00Z",
        source_url=f"https://example.com/{evidence_id}",
        publisher=evidence_id,
        source_type=SourceType.PUBLIC_WEB,
        license_note="public license",
        quality=quality,
        stance=stance,
        excerpt="A literal excerpt.",
        content_hash="0" * 64,
        confidence=0.9,
    )


def test_trust_is_deterministic_and_verified() -> None:
    now = datetime(2026, 10, 8, 1, tzinfo=UTC)
    first = assess_evidence((_item("one"), _item("two")), now=now)
    second = assess_evidence((_item("one"), _item("two")), now=now)
    assert first == second
    assert first.evidence_state is TrustEvidenceState.VERIFIED
    assert first.decision_allowed is True
    assert first.archive_allowed is True
    assert len(first.assessment_hash) == 64


def test_conflict_is_explicit_and_must_not_infer() -> None:
    now = datetime(2026, 10, 8, 1, tzinfo=UTC)
    result = assess_evidence(
        (
            _item("support"),
            _item(
                "counter", quality=EvidenceQuality.AUTHORITATIVE, stance=EvidenceStance.CONTRADICTS
            ),
        ),
        now=now,
    )
    assert result.evidence_state is TrustEvidenceState.CONFLICTED
    assert result.do_not_infer is True
    assert result.decision_allowed is False
    assert result.counter_evidence_ids == ("counter",)


def test_stale_evidence_is_not_current_decision_input() -> None:
    now = datetime(2026, 10, 8, 1, tzinfo=UTC)
    result = assess_evidence((_item("old", as_of="2026-09-01T00:00:00Z"),), now=now)
    assert result.evidence_state is TrustEvidenceState.STALE
    assert result.archive_allowed is False
