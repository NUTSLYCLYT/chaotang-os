"""Deterministic fail-closed gates for work-product artifact manifests."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Sequence

from .models import (
    ArtifactGateReceipt,
    ArtifactGateStatus,
    ArtifactManifestItem,
)

_SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


def evaluate_artifact_gate(
    *,
    required_kinds: frozenset[str],
    artifacts: Sequence[ArtifactManifestItem],
) -> ArtifactGateReceipt:
    """Evaluate an artifact manifest against an exact required-kind set."""

    kind_counts = Counter(artifact.kind for artifact in artifacts)
    present_kinds = frozenset(kind_counts)
    missing_kinds = tuple(sorted(required_kinds - present_kinds))
    unexpected_kinds = tuple(sorted(present_kinds - required_kinds))

    reason_codes: list[str] = []
    if any(count > 1 for count in kind_counts.values()):
        reason_codes.append("DUPLICATE_ARTIFACT_KIND")
    if missing_kinds:
        reason_codes.append("MISSING_REQUIRED_ARTIFACT")
    if unexpected_kinds:
        reason_codes.append("UNEXPECTED_ARTIFACT")
    if any(
        not isinstance(artifact.content_digest, str)
        or _SHA256_PATTERN.fullmatch(artifact.content_digest) is None
        for artifact in artifacts
    ):
        reason_codes.append("ARTIFACT_DIGEST_INVALID")
    if any(artifact.traceable is not True for artifact in artifacts):
        reason_codes.append("ARTIFACT_NOT_TRACEABLE")

    return ArtifactGateReceipt(
        status=(
            ArtifactGateStatus.FAILED
            if reason_codes
            else ArtifactGateStatus.PASSED
        ),
        reason_codes=tuple(reason_codes),
        missing_kinds=missing_kinds,
        unexpected_kinds=unexpected_kinds,
    )
