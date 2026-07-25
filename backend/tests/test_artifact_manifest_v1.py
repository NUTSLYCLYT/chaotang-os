"""R0-W06 Task 2 RED contract tests for the sealed artifact manifest."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest


def _base(**overrides):
    value = {
        "manifest_id": "manifest-task-2-v1",
        "task_id": "task-2",
        "final_memorial_id": "memorial-2",
        "final_memorial_version": 1,
        "delivery_formula_version": "w06-v1",
        "tenant_id": 7,
        "delivery_revision": 1,
        "idempotency_key_hash": "c" * 64,
        "payload_hash": "d" * 64,
        "artifacts": [
            {
                "artifact_id": "artifact-pdf",
                "kind": "PDF",
                "mime_type": "application/pdf",
                "byte_size": 10,
                "content_hash": "e" * 64,
                "lineage_hash": "f" * 64,
                "status": "STORED",
            },
            {
                "artifact_id": "artifact-docx",
                "kind": "DOCX",
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "byte_size": 20,
                "content_hash": "1" * 64,
                "lineage_hash": "2" * 64,
                "status": "STORED",
            },
            {
                "artifact_id": "artifact-json",
                "kind": "JSON",
                "mime_type": "application/json",
                "byte_size": 30,
                "content_hash": "3" * 64,
                "lineage_hash": "4" * 64,
                "status": "STORED",
            },
        ],
        "overall_status": "READY",
    }
    value.update(overrides)
    return value


def test_ready_manifest_seals_exact_pdf_docx_json_membership() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    manifest = ArtifactManifestV1(**_base())
    assert {item.kind for item in manifest.artifacts} == {"PDF", "DOCX", "JSON"}

    duplicate = _base()["artifacts"] + [_base()["artifacts"][2]]
    missing = _base()["artifacts"][:2]
    extra = [
        *_base()["artifacts"],
        {
            **_base()["artifacts"][2],
            "artifact_id": "artifact-extra",
            "kind": "TXT",
            "mime_type": "text/plain",
        },
    ]
    for artifacts in (duplicate, missing, extra):
        with pytest.raises(ValueError):
            ArtifactManifestV1(**_base(artifacts=artifacts))


def test_ready_requires_every_artifact_to_be_stored() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    artifacts = _base()["artifacts"]
    artifacts[0] = {**artifacts[0], "status": "UNAVAILABLE", "incomplete_reason": "renderer_failed"}
    with pytest.raises(ValueError):
        ArtifactManifestV1(**_base(artifacts=artifacts))


def test_partial_manifest_exposes_only_hashed_resume_identity() -> None:
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )

    artifacts = _base()["artifacts"]
    artifacts[0] = {
        **artifacts[0],
        "status": "UNAVAILABLE",
        "incomplete_reason": "renderer_failed",
    }
    partial = ArtifactManifestV1(
        **_base(
            artifacts=artifacts,
            overall_status="PARTIAL",
            resume_token_hash="5" * 64,
            resume_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
    )

    assert partial.overall_status == "PARTIAL"
    assert partial.artifact("PDF").incomplete_reason == "renderer_failed"
    assert partial.resume_token_expires_at is not None
    assert canonical_manifest_hash(partial) == canonical_manifest_hash(partial.model_copy())


@pytest.mark.parametrize(
    "overrides",
    [
        {"resume_token_hash": None},
        {"resume_token_expires_at": None},
    ],
)
def test_partial_requires_complete_resume_metadata(overrides) -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    artifacts = _base()["artifacts"]
    artifacts[0] = {
        **artifacts[0],
        "status": "UNAVAILABLE",
        "incomplete_reason": "renderer_failed",
    }
    payload = _base(
        artifacts=artifacts,
        overall_status="PARTIAL",
        resume_token_hash="5" * 64,
        resume_token_expires_at=datetime(2026, 7, 25, 1, tzinfo=timezone.utc),
    )
    payload.update(overrides)
    with pytest.raises(ValueError):
        ArtifactManifestV1(**payload)


def test_manifest_rejects_naive_artifact_expiry() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    artifacts = _base()["artifacts"]
    artifacts[0] = {**artifacts[0], "expires_at": datetime(2026, 7, 25, 1)}
    with pytest.raises(ValueError):
        ArtifactManifestV1(**_base(artifacts=artifacts))


def test_partial_rejects_naive_resume_expiry() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    artifacts = _base()["artifacts"]
    artifacts[0] = {
        **artifacts[0],
        "status": "UNAVAILABLE",
        "incomplete_reason": "renderer_failed",
    }
    with pytest.raises(ValueError):
        ArtifactManifestV1(
            **_base(
                artifacts=artifacts,
                overall_status="PARTIAL",
                resume_token_hash="5" * 64,
                resume_token_expires_at=datetime(2026, 7, 25, 1),
            )
        )


def test_canonical_hash_normalizes_equivalent_aware_datetimes_to_utc() -> None:
    from src.contracts.artifact_manifest import (
        ArtifactManifestV1,
        canonical_manifest_hash,
    )

    def partial_at(instant: datetime) -> ArtifactManifestV1:
        artifacts = _base()["artifacts"]
        artifacts[0] = {
            **artifacts[0],
            "status": "UNAVAILABLE",
            "incomplete_reason": "renderer_failed",
        }
        artifacts[1] = {**artifacts[1], "expires_at": instant}
        return ArtifactManifestV1(
            **_base(
                artifacts=artifacts,
                overall_status="PARTIAL",
                resume_token_hash="5" * 64,
                resume_token_expires_at=instant,
            )
        )

    utc_manifest = partial_at(datetime(2026, 7, 25, 1, tzinfo=timezone.utc))
    offset_manifest = partial_at(
        datetime(2026, 7, 25, 9, tzinfo=timezone(timedelta(hours=8)))
    )

    assert utc_manifest.resume_token_expires_at.tzinfo == timezone.utc
    assert offset_manifest.resume_token_expires_at.tzinfo == timezone.utc
    assert canonical_manifest_hash(utc_manifest) == canonical_manifest_hash(offset_manifest)


@pytest.mark.parametrize("tenant_id", [0, -1])
def test_manifest_requires_a_positive_tenant_id(tenant_id: int) -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    with pytest.raises(ValueError):
        ArtifactManifestV1(**_base(tenant_id=tenant_id))


def test_partial_requires_stored_and_unavailable_items() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    all_stored = _base()["artifacts"]
    all_unavailable = [
        {**artifact, "status": "UNAVAILABLE", "incomplete_reason": "renderer_failed"}
        for artifact in _base()["artifacts"]
    ]
    for artifacts in (all_stored, all_unavailable):
        with pytest.raises(ValueError):
            ArtifactManifestV1(**_base(artifacts=artifacts, overall_status="PARTIAL"))


def test_unavailable_artifact_requires_an_incomplete_reason() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    artifacts = _base()["artifacts"]
    artifacts[0] = {**artifacts[0], "status": "UNAVAILABLE"}
    with pytest.raises(ValueError):
        ArtifactManifestV1(**_base(artifacts=artifacts, overall_status="PARTIAL"))


def test_ready_manifest_rejects_resume_metadata() -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    with pytest.raises(ValueError):
        ArtifactManifestV1(
            **_base(resume_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=30))
        )


@pytest.mark.parametrize("field", ["resume_token", "idempotency_key"])
def test_manifest_rejects_raw_secret_identity_fields(field: str) -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    with pytest.raises(ValueError):
        ArtifactManifestV1(**_base(**{field: "raw-secret"}))


@pytest.mark.parametrize(
    ("overrides", "expected_field"),
    [
        ({"idempotency_key_hash": "C" * 64}, "idempotency_key_hash"),
        ({"payload_hash": "D" * 64}, "payload_hash"),
        ({"resume_token_hash": "E" * 64}, "resume_token_hash"),
        (
            {
                "artifacts": [
                    {**_base()["artifacts"][0], "content_hash": "F" * 64},
                    *_base()["artifacts"][1:],
                ]
            },
            "content_hash",
        ),
    ],
)
def test_manifest_rejects_non_lowercase_sha256_digests(overrides, expected_field: str) -> None:
    from src.contracts.artifact_manifest import ArtifactManifestV1

    with pytest.raises(ValueError, match=expected_field):
        ArtifactManifestV1(**_base(**overrides))
