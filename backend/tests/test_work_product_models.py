import json
from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import MAX_EMAX, MIN_ETINY, Decimal
from enum import StrEnum

import pytest
from pydantic import ValidationError

import app.work_products as work_products
from app.work_products import (
    ArtifactGateReceipt,
    ArtifactManifestItem,
    ConfirmationReceipt,
    ConfirmationStatus,
    WorkProductEnvelope,
    WorkProductStatus,
    semantic_digest,
)


def make_envelope(
    *,
    work_status: WorkProductStatus = WorkProductStatus.NEEDS_REVIEW,
    confirmation_status: ConfirmationStatus = ConfirmationStatus.PENDING,
    artifact_state: str = "PENDING",
    facts: tuple[Mapping[str, object], ...] | None = None,
) -> WorkProductEnvelope:
    created_at = datetime(2026, 8, 5, tzinfo=UTC)
    manifest = (
        ArtifactManifestItem(
            kind="management_report_xlsx",
            ref="reports/management.xlsx",
            content_digest="a" * 64,
            traceable=True,
        ),
    )
    return WorkProductEnvelope(
        work_product_id="wp-1",
        version=1,
        owner_user_id="owner-1",
        run_id="run-1",
        reply_id=None,
        capability_id="accounting-report",
        work_status=work_status,
        confirmation_status=confirmation_status,
        artifact_state=artifact_state,
        decision="Human review is required.",
        facts=facts or ({"fact_id": "fact-1", "amount": "10.00"},),
        assumptions=("Ledger is complete.",),
        recommendations=("Review the workbook.",),
        evidence_used=("source-1",),
        missing_evidence=(),
        conflicts=(),
        risk_register=("Manual confirmation remains pending.",),
        artifact_manifest=manifest,
        artifact_gate=ArtifactGateReceipt(
            status="PASSED",
            reason_codes=(),
            missing_kinds=(),
            unexpected_kinds=(),
        ),
        content_digest="b" * 64,
        created_at=created_at,
    )


def test_work_product_axes_are_independent() -> None:
    envelope = make_envelope(
        work_status=WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION,
        confirmation_status=ConfirmationStatus.PENDING,
        artifact_state="PUBLISHED",
    )

    assert envelope.work_status is WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION
    assert envelope.confirmation_status is ConfirmationStatus.PENDING
    assert envelope.artifact_state is work_products.ArtifactState.PUBLISHED
    assert "review_status" not in type(envelope).model_fields


def test_status_enums_have_exact_contract_values() -> None:
    assert {status.value for status in WorkProductStatus} == {
        "NEEDS_DATA",
        "NEEDS_REVIEW",
        "BLOCKED",
        "READY_FOR_HUMAN_CONFIRMATION",
        "REVISION_REQUIRED",
    }
    assert {status.value for status in ConfirmationStatus} == {
        "PENDING",
        "CONFIRMED",
        "REVISION_REQUIRED",
        "ESCALATED",
    }


def test_artifact_state_has_exact_contract_values() -> None:
    assert {state.value for state in work_products.ArtifactState} == {
        "PENDING",
        "PUBLISHED",
        "ABORTED",
    }


@pytest.mark.parametrize(
    "overrides",
    [
        {"work_status": ConfirmationStatus.CONFIRMED.value},
        {
            "confirmation_status": (
                WorkProductStatus.READY_FOR_HUMAN_CONFIRMATION.value
            )
        },
        {"artifact_state": ConfirmationStatus.CONFIRMED.value},
    ],
)
def test_state_axes_reject_values_from_other_axes(overrides: dict[str, str]) -> None:
    with pytest.raises(ValidationError):
        make_envelope(**overrides)


def test_review_status_cannot_be_injected_into_work_product_envelope() -> None:
    payload = make_envelope().model_dump()
    payload["review_status"] = "ACHIEVED"

    with pytest.raises(ValidationError):
        WorkProductEnvelope.model_validate(payload)


@pytest.mark.parametrize(
    "model",
    [
        make_envelope(),
        make_envelope().artifact_manifest[0],
        make_envelope().artifact_gate,
        ConfirmationReceipt(
            work_product_id="wp-1",
            version=1,
            sequence=1,
            decision=ConfirmationStatus.CONFIRMED,
            actor_ref="user:reviewer-1",
            structured_reason="Accepted after review.",
            created_at=datetime(2026, 8, 5, tzinfo=UTC),
        ),
    ],
)
def test_contract_models_are_frozen(model: object) -> None:
    with pytest.raises(ValidationError):
        model.__setattr__(next(iter(model.__class__.model_fields)), "changed")


def test_facts_are_recursively_immutable_and_json_serializable() -> None:
    envelope = make_envelope(
        facts=(
            {
                "fact_id": "fact-1",
                "details": {"amounts": ["10.00", "20.00"]},
            },
        )
    )

    with pytest.raises(TypeError):
        envelope.facts[0]["fact_id"] = "changed"
    with pytest.raises(TypeError):
        envelope.facts[0]["details"]["amounts"][0] = "changed"

    json.dumps(envelope.model_dump(mode="json"))


class DigestEnum(StrEnum):
    VALUE = "VALUE"


class MutableFactValue:
    def __init__(self) -> None:
        self.value = "mutable"


@pytest.mark.parametrize(
    "unsupported",
    [
        {"a"},
        bytearray(b"a"),
        MutableFactValue(),
        1.25,
        Decimal("NaN"),
    ],
    ids=["set", "bytearray", "custom-mutable", "float", "non-finite-decimal"],
)
def test_facts_reject_values_outside_canonical_digest_contract(
    unsupported: object,
) -> None:
    with pytest.raises(ValidationError, match="semantic value"):
        make_envelope(facts=({"value": unsupported},))


def test_facts_accept_and_digest_all_supported_semantic_value_types() -> None:
    envelope = make_envelope(
        facts=(
            {
                "fact_id": "fact-1",
                "amount": Decimal("10.50"),
                "status": DigestEnum.VALUE,
                "nested": {"values": [1, True, None, "text"]},
            },
        )
    )

    json.dumps(envelope.model_dump(mode="json"))
    assert len(semantic_digest(envelope.model_dump())) == 64


def test_decimal_canonicalization_cannot_collide_with_user_mapping() -> None:
    decimal_payload = {"value": Decimal("10.50")}
    equivalent_decimal_payload = {"value": Decimal("10.500")}
    lookalike_mapping_payload = {"value": {"$decimal": "10.5"}}

    assert semantic_digest(decimal_payload) == semantic_digest(equivalent_decimal_payload)
    assert semantic_digest(decimal_payload) != semantic_digest(lookalike_mapping_payload)


def test_decimal_canonicalization_preserves_precision_beyond_context() -> None:
    ending_891 = Decimal("0.123456789012345678901234567891")
    ending_892 = Decimal("0.123456789012345678901234567892")

    assert semantic_digest({"value": ending_891}) != semantic_digest(
        {"value": ending_892}
    )


def test_decimal_wire_contract_round_trips_with_one_digest() -> None:
    envelope = make_envelope(facts=({"amount": Decimal("10.50")},))

    python_dump = envelope.model_dump()
    json_dump = envelope.model_dump(mode="json")
    json_round_trip = json.loads(json.dumps(json_dump))
    expected_wire = {"$work_product_decimal": [0, "105", -1]}

    assert python_dump["facts"][0]["amount"] == expected_wire
    assert json_dump["facts"][0]["amount"] == expected_wire
    assert semantic_digest(python_dump) == semantic_digest(json_dump)
    assert semantic_digest(python_dump) == semantic_digest(json_round_trip)

    reloaded = WorkProductEnvelope.model_validate(json_round_trip)
    assert reloaded.facts[0]["amount"] == Decimal("10.5")


@pytest.mark.parametrize(
    "reserved_value",
    [
        {"$work_product_decimal": "10.5"},
        {"$work_product_decimal": [0, "1050", -2]},
        {"$work_product_decimal": [0, "105", -1], "other": "ambiguous"},
    ],
    ids=["wrong-shape", "non-canonical", "mixed-keys"],
)
def test_decimal_wire_contract_rejects_malformed_or_ambiguous_tags(
    reserved_value: object,
) -> None:
    with pytest.raises(ValidationError, match="Decimal wire"):
        make_envelope(facts=({"amount": reserved_value},))


@pytest.mark.parametrize("exponent", [10**100, -(10**100)], ids=["huge-positive", "huge-negative"])
def test_decimal_wire_exponent_overflow_fails_closed(exponent: int) -> None:
    wire = {"$work_product_decimal": [0, "1", exponent]}

    with pytest.raises(ValueError, match="Decimal wire exponent"):
        semantic_digest({"value": wire})
    with pytest.raises(ValidationError, match="Decimal wire exponent"):
        make_envelope(facts=({"amount": wire},))


@pytest.mark.parametrize("exponent", [MIN_ETINY, MAX_EMAX])
def test_decimal_wire_accepts_runtime_exponent_boundaries(exponent: int) -> None:
    wire = {"$work_product_decimal": [0, "1", exponent]}

    assert len(semantic_digest({"value": wire})) == 64
    envelope = make_envelope(facts=({"amount": wire},))
    assert envelope.facts[0]["amount"] == Decimal((0, (1,), exponent))


def test_decimal_min_etiny_serializes_digests_and_round_trips() -> None:
    value = Decimal((0, (1,), MIN_ETINY))
    envelope = make_envelope(facts=({"amount": value},))
    json_payload = json.loads(envelope.model_dump_json())

    assert json_payload["facts"][0]["amount"] == {
        "$work_product_decimal": [0, "1", MIN_ETINY]
    }
    assert semantic_digest(envelope.model_dump()) == semantic_digest(json_payload)
    assert WorkProductEnvelope.model_validate(json_payload).facts[0]["amount"] == value


def test_decimal_wire_below_min_etiny_fails_closed() -> None:
    wire = {"$work_product_decimal": [0, "1", MIN_ETINY - 1]}

    with pytest.raises(ValueError, match="Decimal wire exponent"):
        semantic_digest({"value": wire})
    with pytest.raises(ValidationError, match="Decimal wire exponent"):
        make_envelope(facts=({"amount": wire},))


def test_semantic_digest_is_stable_for_non_semantic_changes() -> None:
    first = {
        "work_product_id": "random-1",
        "created_at": "2026-08-05T00:00:00Z",
        "updated_at": "2026-08-05T00:01:00Z",
        "file_path": "run-1/report.xlsx",
        "confirmation_receipt": {"status": "PENDING"},
        "decision": "review",
        "status": DigestEnum.VALUE,
        "facts": [{"amount": "10.00", "fact_id": "fact-1"}],
    }
    second = {
        "facts": [{"fact_id": "fact-1", "amount": "10.00"}],
        "status": "VALUE",
        "decision": "review",
        "confirmation_receipt": {"status": "CONFIRMED"},
        "file_path": "run-2/renamed.xlsx",
        "updated_at": "2030-01-01T00:00:00Z",
        "created_at": "2030-01-01T00:00:00Z",
        "work_product_id": "random-2",
    }

    assert semantic_digest(first) == semantic_digest(second)


def test_envelope_digest_excludes_random_ids_but_keeps_stable_ids() -> None:
    baseline = make_envelope()
    changed_random_ids = baseline.model_copy(
        update={
            "work_product_id": "wp-random-2",
            "run_id": "run-random-2",
            "reply_id": "reply-random-2",
        }
    )
    changed_fact_id = make_envelope(
        facts=({"fact_id": "fact-2", "amount": "10.00"},)
    )
    changed_capability_id = baseline.model_copy(
        update={"capability_id": "different-capability"}
    )

    baseline_digest = semantic_digest(baseline.model_dump(mode="json"))
    assert baseline_digest == semantic_digest(changed_random_ids.model_dump(mode="json"))
    assert baseline_digest != semantic_digest(changed_fact_id.model_dump(mode="json"))
    assert baseline_digest != semantic_digest(changed_capability_id.model_dump(mode="json"))


def test_envelope_model_dump_digest_excludes_generation_metadata_and_self() -> None:
    baseline = make_envelope()
    later = datetime(2030, 1, 1, tzinfo=UTC)
    changed_generation_metadata = baseline.model_copy(
        update={
            "created_at": later,
            "content_digest": "c" * 64,
        }
    )
    changed_business_field = baseline.model_copy(update={"decision": "Block delivery."})

    baseline_digest = semantic_digest(baseline.model_dump())
    assert baseline_digest == semantic_digest(changed_generation_metadata.model_dump())
    assert baseline_digest != semantic_digest(changed_business_field.model_dump())


def test_envelope_digest_tracks_manifest_content_digest_not_self_digest() -> None:
    baseline = make_envelope()
    changed_self_digest = baseline.model_copy(update={"content_digest": "c" * 64})
    changed_manifest_digest = baseline.model_copy(
        update={
            "artifact_manifest": (
                baseline.artifact_manifest[0].model_copy(
                    update={"content_digest": "d" * 64}
                ),
            )
        }
    )

    baseline_digest = semantic_digest(baseline.model_dump())
    assert baseline_digest == semantic_digest(changed_self_digest.model_dump())
    assert baseline_digest != semantic_digest(changed_manifest_digest.model_dump())


def test_semantic_digest_tracks_business_fields_and_list_order() -> None:
    baseline = {"decision": "review", "evidence_used": ["source-1", "source-2"]}

    assert semantic_digest(baseline) != semantic_digest(
        {"decision": "block", "evidence_used": ["source-1", "source-2"]}
    )
    assert semantic_digest(baseline) != semantic_digest(
        {"decision": "review", "evidence_used": ["source-2", "source-1"]}
    )


@pytest.mark.parametrize("value", [1.0, float("nan"), float("inf"), float("-inf")])
def test_semantic_digest_rejects_floats(value: float) -> None:
    with pytest.raises(TypeError, match="float"):
        semantic_digest({"value": value})


@pytest.mark.parametrize("path", ["C:\\reports\\report.xlsx", "/reports/report.xlsx"])
def test_semantic_digest_rejects_absolute_file_paths(path: str) -> None:
    with pytest.raises(ValueError, match="absolute file_path"):
        semantic_digest({"file_path": path, "decision": "review"})


def test_downstream_manifest_contract_has_exact_fields() -> None:
    item = ArtifactManifestItem(
        kind="management_report_xlsx",
        ref="reports/management.xlsx",
        content_digest="a" * 64,
        traceable=True,
    )

    assert set(type(item).model_fields) == {
        "kind",
        "ref",
        "content_digest",
        "traceable",
    }


def test_downstream_gate_receipt_contract_has_exact_status_and_sets() -> None:
    receipt = ArtifactGateReceipt(
        status="FAILED",
        reason_codes=("MISSING_REQUIRED_ARTIFACT",),
        missing_kinds=("quality_report",),
        unexpected_kinds=(),
    )

    assert receipt.status == "FAILED"
    assert receipt.missing_kinds == ("quality_report",)
    assert {status.value for status in work_products.ArtifactGateStatus} == {
        "PASSED",
        "FAILED",
    }


def test_downstream_confirmation_receipt_is_append_only_contract() -> None:
    created_at = datetime(2026, 8, 5, tzinfo=UTC)
    receipt = ConfirmationReceipt(
        work_product_id="wp-1",
        version=1,
        sequence=1,
        decision="CONFIRMED",
        actor_ref="user:owner-1",
        structured_reason="Amounts, sources, and reconciliations were reviewed.",
        created_at=created_at,
    )

    assert receipt.decision is ConfirmationStatus.CONFIRMED
    assert receipt.sequence == 1
    with pytest.raises(ValidationError):
        ConfirmationReceipt(
            work_product_id="wp-1",
            version=1,
            sequence=2,
            decision="PENDING",
            actor_ref="user:owner-1",
            structured_reason="Awaiting review.",
            created_at=created_at,
        )
    with pytest.raises(ValidationError):
        ConfirmationReceipt(
            work_product_id="wp-1",
            version=1,
            sequence=2,
            decision="ESCALATED",
            actor_ref="user:owner-1",
            structured_reason="",
            created_at=created_at,
        )


def test_downstream_envelope_owns_artifact_state_without_embedded_receipt() -> None:
    assert "artifact_state" in WorkProductEnvelope.model_fields
    assert "confirmation_receipt" not in WorkProductEnvelope.model_fields


def test_manifest_ref_is_non_semantic_even_when_absolute_or_random() -> None:
    first = {
        "decision": "review",
        "artifact_manifest": [
            {
                "kind": "management_report_xlsx",
                "ref": "C:\\private\\run-1\\management.xlsx",
                "content_digest": "a" * 64,
                "traceable": True,
            }
        ],
    }
    second = {
        "decision": "review",
        "artifact_manifest": [
            {
                "kind": "management_report_xlsx",
                "ref": "reports/random-run-2.xlsx",
                "content_digest": "a" * 64,
                "traceable": True,
            }
        ],
    }

    assert semantic_digest(first) == semantic_digest(second)


@pytest.mark.parametrize(
    ("first", "second"),
    [
        (
            {"facts": [{"fact_id": "fact-1", "ref": "source-a"}]},
            {"facts": [{"fact_id": "fact-1", "ref": "source-b"}]},
        ),
        (
            {"evidence": [{"ref": "source-a"}]},
            {"evidence": [{"ref": "source-b"}]},
        ),
        (
            {"ordinary": {"nested": {"ref": "source-a"}}},
            {"ordinary": {"nested": {"ref": "source-b"}}},
        ),
    ],
    ids=["facts", "evidence", "ordinary-nested-mapping"],
)
def test_non_manifest_ref_is_semantic(
    first: Mapping[str, object], second: Mapping[str, object]
) -> None:
    assert semantic_digest(first) != semantic_digest(second)


def test_real_envelope_python_and_json_round_trip_share_digest() -> None:
    envelope = make_envelope(facts=({"amount": Decimal("10.50")},))
    python_dump = envelope.model_dump()
    json_dump = json.loads(envelope.model_dump_json())

    assert semantic_digest(python_dump) == semantic_digest(json_dump)
    assert WorkProductEnvelope.model_validate(json_dump) == envelope
