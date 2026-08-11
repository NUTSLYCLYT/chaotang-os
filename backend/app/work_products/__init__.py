"""Shared work-product contracts and deterministic digest helpers."""

from .digest import semantic_digest
from .gates import evaluate_artifact_gate
from .models import (
    ArtifactGateReceipt,
    ArtifactGateStatus,
    ArtifactManifestItem,
    ArtifactState,
    ConfirmationReceipt,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
)

__all__ = [
    "ArtifactGateReceipt",
    "ArtifactGateStatus",
    "ArtifactManifestItem",
    "ArtifactState",
    "ConfirmationReceipt",
    "ConfirmationStatus",
    "WorkProductEnvelope",
    "WorkProductStatus",
    "evaluate_artifact_gate",
    "semantic_digest",
]
