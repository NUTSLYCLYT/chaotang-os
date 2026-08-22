from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import jsonschema
import pytest

from app.agents.runtime_skills.family_runtime import load_capability_family_bindings
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

_ROOT = Path(__file__).resolve().parents[2]
_REPORT = _ROOT / "docs/migrations/2026-08-14-six-ministry-runtime-readiness.json"
_MATRIX = _ROOT / "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json"
_SCHEMA = _ROOT / "docs/contracts/six-ministry-runtime-readiness.schema.json"
_HARNESS = _ROOT / "scripts/check_harness.mjs"
_HISTORICAL_REVIEWED_FINGERPRINT = (
    "sha256:a6c2de2ca7f15069a6d997ce2cccb9498ddd4dd1269d539c192993e85a265190"
)
_CURRENT_CONTENT_FINGERPRINT = (
    "sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69"
)
_CURRENT_CONTENT_EXCLUSIONS = (
    "backend/app/accounting_reports/storage.py",
    "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
    "backend/tests/test_six_ministry_readiness_report.py",
    "scripts/check_harness.mjs",
)
_SUCCESSOR_CONTENT_PATHS = (
    "backend/app/accounting_reports/storage.py",
    "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
)
_SUCCESSOR_CONTENT_FINGERPRINTS = (
    "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    "sha256:d98fbc113e5d620eea902ed132a6c4d638023f5e4d55d0ce5162f3ab621648d9",
)
_HISTORICAL_REVIEW_STATUS = "approved-with-notes"
_HISTORICAL_FILE_COUNT = 69
_CURRENT_FILE_COUNT = 65


def _content_fingerprint(root: Path, files: tuple[str, ...] | list[str]) -> str:
    digest = hashlib.sha256()
    for relative_path in files:
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update((root / relative_path).read_bytes())
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def _assert_historical_review_identity(reviews: dict[str, object]) -> None:
    assert reviews["status"] == _HISTORICAL_REVIEW_STATUS
    assert reviews["reviewedImplementationFingerprint"] == (
        _HISTORICAL_REVIEWED_FINGERPRINT
    )


def _read_harness_json_constant(source: str, name: str) -> object:
    match = re.search(
        rf"^const {re.escape(name)} = (?P<literal>.+);$",
        source,
        flags=re.MULTILINE,
    )
    assert match is not None
    return json.loads(match.group("literal"))


def _read_harness_exclusions(source: str) -> tuple[str, ...]:
    match = re.search(
        r"^const SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS = Object\.freeze\(\[\n"
        r"(?P<items>(?:  \"[^\"\n]+\",\n)+)"
        r"\]\);$",
        source,
        flags=re.MULTILINE,
    )
    assert match is not None
    return tuple(
        json.loads(line.strip().removesuffix(","))
        for line in match.group("items").splitlines()
    )


@pytest.mark.parametrize(
    "review_drift",
    [
        {"status": "changes-requested", "reviewedImplementationFingerprint": None},
        {"status": "approved"},
        {"status": "approved-with-notes", "reviewedImplementationFingerprint": None},
    ],
)
def test_historical_review_identity_fails_closed_on_provenance_drift(
    review_drift: dict[str, object],
) -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    reviews = {**report["validationEvidence"]["independentReviews"], **review_drift}

    with pytest.raises(AssertionError):
        _assert_historical_review_identity(reviews)


def test_readiness_report_satisfies_a_closed_json_schema() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    schema = json.loads(_SCHEMA.read_text(encoding="utf-8"))

    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.validate(report, schema, cls=jsonschema.Draft202012Validator)


def test_readiness_report_covers_every_family_and_is_honest_about_authority() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    matrix = json.loads(_MATRIX.read_text(encoding="utf-8"))
    family_rows = report["capabilityFamilies"]

    assert report["schemaVersion"] == "2.0.0"
    assert report["sourceCommit"] == "939186f0331d9784bc8c4ceee393aeb197230ed0"
    assert len(family_rows) == matrix["summary"]["familyCount"] == 23
    assert {item["familyId"] for item in family_rows} == {
        item["id"] for item in matrix["families"]
    }
    assert all(item["externalSideEffectsObserved"] is False for item in family_rows)
    assert all(item["productionPromotionAuthorized"] is False for item in family_rows)
    assert report["summary"] == {
        "sourceAssets": 1777,
        "families": 23,
        "activeFamilies": 22,
        "retiredFamilies": 1,
        "runtimeSkillDefinitionsCovered": 46,
        "businessSuccessMeasuredFamilies": 0,
        "serverOwnedResolverBindings": 6,
        "externalSideEffectsObserved": False,
        "productionPromotionAuthorized": False,
    }


def test_readiness_evidence_is_bound_to_current_implementation() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    implementation = report["implementationEvidence"]
    files = implementation["files"]

    assert files == sorted(files)
    assert len(files) == len(set(files)) == _HISTORICAL_FILE_COUNT
    assert all(files.count(relative_path) == 1 for relative_path in _CURRENT_CONTENT_EXCLUSIONS)

    current_content_files = [
        relative_path
        for relative_path in files
        if relative_path not in _CURRENT_CONTENT_EXCLUSIONS
    ]
    assert len(current_content_files) == _CURRENT_FILE_COUNT

    for relative_path in files:
        path = _ROOT / relative_path
        assert path.is_file()
    current = _content_fingerprint(_ROOT, current_content_files)
    assert current == _CURRENT_CONTENT_FINGERPRINT
    assert _content_fingerprint(_ROOT, _SUCCESSOR_CONTENT_PATHS) in (
        _SUCCESSOR_CONTENT_FINGERPRINTS
    )
    assert implementation["fingerprint"] == _HISTORICAL_REVIEWED_FINGERPRINT
    assert (
        report["validationEvidence"]["implementationFingerprint"]
        == _HISTORICAL_REVIEWED_FINGERPRINT
    )
    reviews = report["validationEvidence"]["independentReviews"]
    _assert_historical_review_identity(reviews)


def test_python_and_harness_validators_share_the_exact_content_policy() -> None:
    source = _HARNESS.read_text(encoding="utf-8")

    assert _read_harness_exclusions(source) == _CURRENT_CONTENT_EXCLUSIONS
    assert tuple(
        _read_harness_json_constant(source, "SIX_MINISTRY_SUCCESSOR_CONTENT_PATHS")
    ) == _SUCCESSOR_CONTENT_PATHS
    assert tuple(
        _read_harness_json_constant(
            source, "SIX_MINISTRY_SUCCESSOR_CONTENT_FINGERPRINTS"
        )
    ) == _SUCCESSOR_CONTENT_FINGERPRINTS
    assert (
        _read_harness_json_constant(source, "SIX_MINISTRY_REVIEW_STATUS")
        == _HISTORICAL_REVIEW_STATUS
    )
    assert (
        _read_harness_json_constant(
            source, "SIX_MINISTRY_REVIEWED_IMPLEMENTATION_FINGERPRINT"
        )
        == _HISTORICAL_REVIEWED_FINGERPRINT
    )
    assert (
        _read_harness_json_constant(source, "SIX_MINISTRY_HISTORICAL_FILE_COUNT")
        == _HISTORICAL_FILE_COUNT
    )
    assert (
        _read_harness_json_constant(source, "SIX_MINISTRY_RUNTIME_CONTENT_FILE_COUNT")
        == _CURRENT_FILE_COUNT
    )
    assert (
        _read_harness_json_constant(
            source, "SIX_MINISTRY_RUNTIME_CONTENT_FINGERPRINT"
        )
        == _CURRENT_CONTENT_FINGERPRINT
    )


def test_successor_pair_rejects_partial_or_third_state_drift(tmp_path: Path) -> None:
    for relative_path in _SUCCESSOR_CONTENT_PATHS:
        target = tmp_path / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((_ROOT / relative_path).read_bytes())

    assert _content_fingerprint(tmp_path, _SUCCESSOR_CONTENT_PATHS) in (
        _SUCCESSOR_CONTENT_FINGERPRINTS
    )
    drifted = tmp_path / _SUCCESSOR_CONTENT_PATHS[0]
    drifted.write_bytes(drifted.read_bytes() + b"\n# successor drift\n")
    assert _content_fingerprint(tmp_path, _SUCCESSOR_CONTENT_PATHS) not in (
        _SUCCESSOR_CONTENT_FINGERPRINTS
    )


def test_readiness_lists_only_the_six_server_owned_resolver_boundaries() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))

    assert [item["resolverId"] for item in report["resolverBindings"]] == [
        "current-user-owner",
        "committed-decree-authority",
        "owner-scoped-jinyiwei-evidence",
        "owner-run-accounting-work-product",
        "owner-run-junjichu-report-receipt",
        "owner-scoped-shiguan-reply",
    ]


def test_active_readiness_rows_match_generated_runtime_projection_exactly() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    active_rows = {
        item["familyId"]: item
        for item in report["capabilityFamilies"]
        if item["runtimeStatus"] != "retired"
    }
    bindings = {item.family_id: item for item in load_capability_family_bindings()}
    registry_ids = {
        skill.skill_id for skill in build_default_downstream_skill_registry().skills
    }

    assert set(active_rows) == set(bindings)
    assert {
        skill_id
        for item in active_rows.values()
        for skill_id in item["runtimeSkillIds"]
    } == registry_ids
    for family_id, binding in bindings.items():
        row = active_rows[family_id]
        assert tuple(row["runtimeSkillIds"]) == binding.runtime_skill_ids
        assert row["sourceAssetCount"] == binding.source_asset_count
        assert row["runtimeStatus"] == "degraded-until-authority-evidence"
        assert row["businessSuccessMeasured"] is False
        assert row["contractShapeExercised"] is True
        assert row["missingProductionDependencies"]
