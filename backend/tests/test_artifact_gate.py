from __future__ import annotations

import pytest

from app.work_products import (
    ArtifactGateStatus,
    ArtifactManifestItem,
    evaluate_artifact_gate,
)

REQUIRED = frozenset(
    {
        "management_report_xlsx",
        "work_product_envelope",
        "quality_report",
        "confirmation_request",
        "content_digest",
    }
)


def _artifact(
    kind: str,
    *,
    content_digest: str = "a" * 64,
    traceable: bool = True,
) -> ArtifactManifestItem:
    return ArtifactManifestItem(
        kind=kind,
        ref=f"artifact://{kind}",
        content_digest=content_digest,
        traceable=traceable,
    )


def _valid_manifest() -> tuple[ArtifactManifestItem, ...]:
    return tuple(_artifact(kind) for kind in sorted(REQUIRED))


def _unchecked_artifact(
    kind: str,
    *,
    content_digest: str,
    traceable: bool = True,
) -> ArtifactManifestItem:
    return ArtifactManifestItem.model_construct(
        kind=kind,
        ref=f"artifact://{kind}",
        content_digest=content_digest,
        traceable=traceable,
    )


def test_gate_passes_only_the_exact_valid_traceable_bundle() -> None:
    receipt = evaluate_artifact_gate(
        required_kinds=REQUIRED,
        artifacts=_valid_manifest(),
    )

    assert receipt.status is ArtifactGateStatus.PASSED
    assert receipt.reason_codes == ()
    assert receipt.missing_kinds == ()
    assert receipt.unexpected_kinds == ()


def test_gate_reports_missing_required_artifacts_in_sorted_order() -> None:
    artifacts = tuple(
        artifact
        for artifact in _valid_manifest()
        if artifact.kind not in {"quality_report", "confirmation_request"}
    )

    receipt = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)

    assert receipt.status is ArtifactGateStatus.FAILED
    assert receipt.reason_codes == ("MISSING_REQUIRED_ARTIFACT",)
    assert receipt.missing_kinds == ("confirmation_request", "quality_report")
    assert receipt.unexpected_kinds == ()


def test_gate_reports_unexpected_artifacts_in_sorted_order() -> None:
    artifacts = (*_valid_manifest(), _artifact("zeta"), _artifact("alpha"))

    receipt = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)

    assert receipt.status is ArtifactGateStatus.FAILED
    assert receipt.reason_codes == ("UNEXPECTED_ARTIFACT",)
    assert receipt.missing_kinds == ()
    assert receipt.unexpected_kinds == ("alpha", "zeta")


def test_gate_rejects_duplicate_artifact_kinds() -> None:
    artifacts = (*_valid_manifest(), _artifact("quality_report"))

    receipt = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)

    assert receipt.status is ArtifactGateStatus.FAILED
    assert receipt.reason_codes == ("DUPLICATE_ARTIFACT_KIND",)


@pytest.mark.parametrize(
    "invalid_digest",
    [
        "a" * 63,
        "a" * 65,
        "A" * 64,
        "g" * 64,
    ],
)
def test_gate_independently_rejects_non_sha256_digests(invalid_digest: str) -> None:
    artifacts = list(_valid_manifest())
    artifacts[0] = _unchecked_artifact(
        artifacts[0].kind,
        content_digest=invalid_digest,
    )

    receipt = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)

    assert receipt.status is ArtifactGateStatus.FAILED
    assert receipt.reason_codes == ("ARTIFACT_DIGEST_INVALID",)


def test_gate_rejects_an_untraceable_artifact() -> None:
    artifacts = list(_valid_manifest())
    artifacts[0] = _artifact(artifacts[0].kind, traceable=False)

    receipt = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)

    assert receipt.status is ArtifactGateStatus.FAILED
    assert receipt.reason_codes == ("ARTIFACT_NOT_TRACEABLE",)


def test_gate_orders_combined_reasons_by_the_frozen_contract() -> None:
    artifacts = [
        _unchecked_artifact(
            "quality_report",
            content_digest="not-a-sha256",
            traceable=False,
        ),
        _artifact("quality_report"),
        _artifact("unexpected"),
    ]

    receipt = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)

    assert receipt.status is ArtifactGateStatus.FAILED
    assert receipt.reason_codes == (
        "DUPLICATE_ARTIFACT_KIND",
        "MISSING_REQUIRED_ARTIFACT",
        "UNEXPECTED_ARTIFACT",
        "ARTIFACT_DIGEST_INVALID",
        "ARTIFACT_NOT_TRACEABLE",
    )
    assert receipt.missing_kinds == (
        "confirmation_request",
        "content_digest",
        "management_report_xlsx",
        "work_product_envelope",
    )
    assert receipt.unexpected_kinds == ("unexpected",)


def test_gate_receipt_is_independent_of_artifact_input_order() -> None:
    artifacts = _valid_manifest()

    forward = evaluate_artifact_gate(required_kinds=REQUIRED, artifacts=artifacts)
    reverse = evaluate_artifact_gate(
        required_kinds=REQUIRED,
        artifacts=tuple(reversed(artifacts)),
    )

    assert forward == reverse
