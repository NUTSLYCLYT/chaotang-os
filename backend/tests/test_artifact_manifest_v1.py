"""R0-W06-1 RED contract tests for ArtifactManifestV1."""

from __future__ import annotations

import pytest


def _base(**overrides):
    value = {
        "manifest_id": "manifest-task-1-v2",
        "task_id": "task-1",
        "final_memorial_id": "memorial-1",
        "final_memorial_version": 2,
        "delivery_formula_version": "w06-v1",
        "artifacts": [
            {
                "artifact_id": "artifact-json-1",
                "kind": "JSON",
                "mime_type": "application/json",
                "byte_size": 12,
                "content_hash": "a" * 64,
                "lineage_hash": "b" * 64,
                "status": "READY",
            }
        ],
        "overall_status": "READY",
    }
    value.update(overrides)
    return value


def test_manifest_requires_lineage_hash_and_delivery_identity() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    manifest = ArtifactManifestV1(**_base())
    assert manifest.task_id == "task-1"
    assert manifest.artifacts[0].lineage_hash == "b" * 64


def test_manifest_rejects_missing_or_invalid_lineage_hash() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    for lineage_hash in (None, "not-a-sha256"):
        with pytest.raises(ValueError):
            ArtifactManifestV1(
                **_base(
                    artifacts=[
                        {
                            **_base()["artifacts"][0],
                            "lineage_hash": lineage_hash,
                        }
                    ]
                )
            )


def test_partial_requires_ready_and_unavailable_mix() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    with pytest.raises(ValueError):
        ArtifactManifestV1(
            **_base(
                overall_status="PARTIAL",
                artifacts=[{**_base()["artifacts"][0], "status": "UNAVAILABLE"}],
            )
        )


def test_under_review_requires_at_least_one_non_ready_artifact() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    with pytest.raises(ValueError):
        ArtifactManifestV1(**_base(overall_status="UNDER_REVIEW"))
