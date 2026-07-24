"""Deterministic evidence status for immutable secure-ingest versions."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING

from src.contracts.evidence_packet import EvidenceStatus
from src.secure_ingest.storage import read_artifact_bytes_at_path

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from src.db.models import SecureIngestArtifact


def classify_evidence_artifact(
    db: Session,
    artifact: SecureIngestArtifact,
) -> EvidenceStatus:
    """Classify one accepted artifact without guessing which version is true.

    A missing or digest-drifted body is stale. A selected version with a later
    accepted same-name version is stale. The newest of multiple distinct
    versions remains conflicted until an explicit supersession decision exists.
    """

    if artifact.status != "ACCEPTED":
        return "STALE"
    try:
        raw_bytes = read_artifact_bytes_at_path(artifact.storage_path)
    except OSError:
        return "STALE"
    if hashlib.sha256(raw_bytes).hexdigest() != artifact.digest_sha256:
        return "STALE"

    from src.db.models import SecureIngestArtifact

    siblings = (
        db.query(SecureIngestArtifact)
        .filter_by(
            tenant_id=artifact.tenant_id,
            user_id=artifact.user_id,
            mission_contract_id=artifact.mission_contract_id,
            original_filename=artifact.original_filename,
            status="ACCEPTED",
        )
        .all()
    )
    selected_order = (artifact.created_at, artifact.id)
    distinct_versions = [
        sibling
        for sibling in siblings
        if sibling.id != artifact.id
        and sibling.digest_sha256 != artifact.digest_sha256
    ]
    if any(
        (sibling.created_at, sibling.id) > selected_order
        for sibling in distinct_versions
    ):
        return "STALE"
    if distinct_versions:
        return "CONFLICTED"
    return "GROUNDED"
