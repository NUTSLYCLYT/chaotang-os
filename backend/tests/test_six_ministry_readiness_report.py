from __future__ import annotations

import hashlib
import json
from pathlib import Path

import jsonschema

from app.agents.runtime_skills.family_runtime import load_capability_family_bindings
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

_ROOT = Path(__file__).resolve().parents[2]
_REPORT = _ROOT / "docs/migrations/2026-08-14-six-ministry-runtime-readiness.json"
_MATRIX = _ROOT / "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json"
_SCHEMA = _ROOT / "docs/contracts/six-ministry-runtime-readiness.schema.json"


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
    digest = hashlib.sha256()

    assert implementation["files"] == sorted(implementation["files"])
    for relative_path in implementation["files"]:
        path = _ROOT / relative_path
        assert path.is_file()
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")

    current = f"sha256:{digest.hexdigest()}"
    assert implementation["fingerprint"] == current
    assert report["validationEvidence"]["implementationFingerprint"] == current
    reviews = report["validationEvidence"]["independentReviews"]
    if reviews["status"] in {"approved", "approved-with-notes"}:
        assert reviews["reviewedImplementationFingerprint"] == current


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
