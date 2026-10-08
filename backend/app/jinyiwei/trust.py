"""Deterministic and explainable trust grading for Jinyiwei evidence."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, datetime, timedelta

from app.jinyiwei.models import (
    EvidenceItem,
    EvidenceQuality,
    EvidenceStance,
    TrustAssessment,
    TrustEvidenceState,
)

_QUALITY_SCORE = {
    EvidenceQuality.PRIMARY: 1.0,
    EvidenceQuality.AUTHORITATIVE: 0.85,
    EvidenceQuality.SECONDARY: 0.6,
    EvidenceQuality.UNVERIFIED: 0.25,
}
_DIMENSIONS = (
    "source_authority",
    "source_independence",
    "freshness",
    "original_integrity",
    "cross_source_agreement",
    "entity_match",
    "license_integrity",
    "counter_evidence",
    "model_inference",
)


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _hash_assessment(payload: Mapping[str, object]) -> str:
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    ).hexdigest()


def assess_evidence(
    evidence: Sequence[EvidenceItem] | Iterable[EvidenceItem],
    *,
    now: datetime,
    stale_after: timedelta = timedelta(days=7),
    unresolved_questions: Sequence[str] = (),
) -> TrustAssessment:
    """Grade evidence without network, model calls, or hidden confidence changes."""

    items = tuple(evidence)
    if not items:
        state = TrustEvidenceState.UNAVAILABLE
        quality = EvidenceQuality.UNVERIFIED
        scores = {name: 0.0 for name in _DIMENSIONS}
        lower = upper = 0.0
        decision_allowed = archive_allowed = False
        do_not_infer = True
        conclusion = "没有可核验证据"
        basis = "证据集合为空，系统不得推断。"
        supporting: tuple[str, ...] = ()
        counter: tuple[str, ...] = ()
    else:
        qualities = tuple(item.quality for item in items)
        quality = min(qualities, key=lambda value: _QUALITY_SCORE[value])
        support = tuple(item for item in items if item.stance is EvidenceStance.SUPPORTS)
        contradict = tuple(item for item in items if item.stance is EvidenceStance.CONTRADICTS)
        independent_publishers = len({item.publisher for item in items})
        stale = any(now - _parse_time(item.as_of) > stale_after for item in items)
        conflicted = bool(support and contradict)
        if conflicted:
            state = TrustEvidenceState.CONFLICTED
        elif stale:
            state = TrustEvidenceState.STALE
        elif all(
            item.quality in {EvidenceQuality.PRIMARY, EvidenceQuality.AUTHORITATIVE}
            for item in items
        ):
            state = TrustEvidenceState.VERIFIED
        elif len(items) > 1:
            state = TrustEvidenceState.MIXED
        else:
            state = TrustEvidenceState.PROBABLE
        authority = sum(_QUALITY_SCORE[item.quality] for item in items) / len(items)
        agreement = 0.0 if conflicted else min(1.0, 0.55 + 0.15 * min(independent_publishers, 3))
        max_age_seconds = max((now - _parse_time(item.as_of)).total_seconds() for item in items)
        freshness = (
            0.0
            if stale
            else min(
                1.0,
                max(
                    0.0,
                    1.0 - max(max_age_seconds, 0) / stale_after.total_seconds(),
                ),
            )
        )
        license_integrity = 1.0 if all(item.license_note for item in items) else 0.4
        scores = {
            "source_authority": round(authority, 6),
            "source_independence": round(min(1.0, independent_publishers / 2), 6),
            "freshness": round(freshness, 6),
            "original_integrity": round(
                sum(1.0 if item.excerpt.strip() and item.content_hash else 0.0 for item in items)
                / len(items),
                6,
            ),
            "cross_source_agreement": round(agreement, 6),
            "entity_match": 1.0,
            "license_integrity": round(license_integrity, 6),
            "counter_evidence": 0.0 if conflicted else 1.0,
            "model_inference": 1.0,
        }
        raw = sum(scores.values()) / len(scores)
        spread = 0.18 if conflicted or stale else 0.1
        lower = round(max(0.0, raw - spread), 6)
        upper = round(min(1.0, raw + spread), 6)
        decision_allowed = (
            state in {TrustEvidenceState.VERIFIED, TrustEvidenceState.PROBABLE} and lower >= 0.5
        )
        archive_allowed = (
            state is TrustEvidenceState.VERIFIED and license_integrity == 1.0 and lower >= 0.65
        )
        do_not_infer = state in {
            TrustEvidenceState.CONFLICTED,
            TrustEvidenceState.STALE,
            TrustEvidenceState.UNAVAILABLE,
        }
        conclusion = {
            TrustEvidenceState.VERIFIED: "多来源一手或权威证据一致",
            TrustEvidenceState.PROBABLE: "证据可支持判断，但仍需持续核验",
            TrustEvidenceState.MIXED: "证据来源质量混合",
            TrustEvidenceState.CONFLICTED: "支持证据与反向证据并存",
            TrustEvidenceState.STALE: "证据已超过时效窗口",
        }[state]
        basis = f"{len(items)} 条证据、{independent_publishers} 个独立发布者；按固定维度规则计算。"
        supporting = tuple(item.evidence_id for item in support)
        counter = tuple(item.evidence_id for item in contradict)

    payload = {
        "source_level": quality,
        "evidence_state": state,
        "confidence_lower": lower,
        "confidence_upper": upper,
        "dimension_scores": scores,
        "conclusion": conclusion,
        "assessment_basis": basis,
        "supporting_evidence_ids": supporting,
        "counter_evidence_ids": counter,
        "unresolved_questions": tuple(unresolved_questions),
        "decision_allowed": decision_allowed,
        "archive_allowed": archive_allowed,
        "do_not_infer": do_not_infer,
    }
    return TrustAssessment(**payload, assessment_hash=_hash_assessment(payload))
