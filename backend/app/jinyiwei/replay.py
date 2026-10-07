"""Deterministic, offline replay of a persisted evidence pack."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime

from app.jinyiwei.models import EvidencePack, EvidencePackStatus, ReplayDiff
from app.jinyiwei.verification import verify_evidence


def _hash(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    ).hexdigest()


@dataclass(frozen=True, slots=True)
class ReplayResult:
    status: EvidencePackStatus
    result_hash: str
    evidence_snapshot_hash: str
    resolved_facts: tuple[str, ...]
    unresolved_facts: tuple[str, ...]
    conflict_count: int
    evidence_count: int
    original_status: EvidencePackStatus


class ReplayEngine:
    """Recompute only code-owned verification; no network, tools, or model calls."""

    def replay(self, pack: EvidencePack, *, now: datetime | None = None) -> ReplayResult:
        replay_time = now or datetime.fromisoformat(
            pack.investigation_completed_at.replace("Z", "+00:00")
        )
        evidence = tuple(
            item
            for group in (pack.evidence_by_fact, pack.historical_evidence_by_fact)
            for items in group.values()
            for item in items
        )
        verification = verify_evidence(pack.request, evidence, now=replay_time)
        if not verification.unresolved_facts and not verification.conflicts:
            status = EvidencePackStatus.RESOLVED
        elif evidence:
            status = EvidencePackStatus.PARTIAL
        elif pack.source_attempts and pack.source_attempts[-1].status.value == "BLOCKED":
            status = EvidencePackStatus.BLOCKED
        else:
            status = EvidencePackStatus.UNAVAILABLE
        evidence_payload = [
            item.model_dump(mode="json")
            for item in sorted(evidence, key=lambda item: item.evidence_id)
        ]
        evidence_snapshot_hash = _hash(evidence_payload)
        result_payload = {
            "status": status.value,
            "resolved_facts": list(verification.resolved_facts),
            "unresolved_facts": list(verification.unresolved_facts),
            "conflicts": [item.model_dump(mode="json") for item in verification.conflicts],
            "evidence_snapshot_hash": evidence_snapshot_hash,
        }
        return ReplayResult(
            status=status,
            result_hash=_hash(result_payload),
            evidence_snapshot_hash=evidence_snapshot_hash,
            resolved_facts=verification.resolved_facts,
            unresolved_facts=verification.unresolved_facts,
            conflict_count=len(verification.conflicts),
            evidence_count=len(evidence),
            original_status=pack.status,
        )

    def diff(self, original: ReplayResult, replayed: ReplayResult) -> ReplayDiff:
        changed: list[str] = []
        if original.status != replayed.status:
            changed.append("status")
        if original.resolved_facts != replayed.resolved_facts:
            changed.append("resolved_facts")
        if original.unresolved_facts != replayed.unresolved_facts:
            changed.append("unresolved_facts")
        if original.conflict_count != replayed.conflict_count:
            changed.append("conflict_count")
        if original.evidence_count != replayed.evidence_count:
            changed.append("evidence_count")
        return ReplayDiff(
            replay_id="unpersisted",
            original_result_hash=original.result_hash,
            replay_result_hash=replayed.result_hash,
            changed_fields=tuple(changed),
            status_changed=original.status != replayed.status,
            evidence_count_delta=replayed.evidence_count - original.evidence_count,
            conflict_count_delta=replayed.conflict_count - original.conflict_count,
        )


__all__ = ["ReplayEngine", "ReplayResult"]
