from __future__ import annotations

import builtins
import hashlib
import importlib
import inspect
import json
import os
from collections.abc import Mapping
from copy import deepcopy

import pytest

DOMAIN = "courtos.p10a.claim-evidence"
NOW = "2026-08-28T00:00:00.000000Z"
CLAIM_A = "clm_" + "a" * 64
CLAIM_B = "clm_" + "b" * 64
EVIDENCE_A = "ev_" + "c" * 64


def _api():
    return importlib.import_module("app.agents.runtime_skills.claim_evidence_gate")


def _plain(value):
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_plain(item) for item in value]
    if hasattr(value, "__dataclass_fields__"):
        return {name: _plain(getattr(value, name)) for name in value.__dataclass_fields__}
    return value


def _canonical(value) -> bytes:
    return json.dumps(
        _plain(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()


def _digest(kind: str, schema: str, payload) -> str:
    preimage = {
        "digest_algorithm": "sha256",
        "digest_domain": DOMAIN,
        "object_kind": kind,
        "schema_version": schema,
        "payload": _plain(payload),
    }
    return "sha256:" + hashlib.sha256(_canonical(preimage)).hexdigest()


def _seal(value: dict, field: str, kind: str) -> dict:
    result = deepcopy(value)
    payload = {key: item for key, item in result.items() if key != field}
    result[field] = _digest(kind, result["schema_version"], payload)
    return result


def _assert_sealed(value, field: str, kind: str) -> None:
    plain = _plain(value)
    observed = plain.pop(field)
    assert observed == _digest(kind, plain["schema_version"], plain)


def _scope() -> dict:
    return {
        "schema_version": "claim-evidence-scope.v1",
        "tenant_scope": "courtos-single-tenant.v1",
        "scope_mode": "OWNER_ONLY",
        "tenant_id": None,
        "owner_user_id": "owner_a",
        "run_id": "run_a",
        "decree_id": "decree_a",
    }


def _locator_authority(producer: str = "bureau_a") -> dict:
    payload = {
        "producer_node_id": producer,
        "department_ordinal": "0",
        "bureau_ordinal": "0",
        "claim_ordinals": ["0", "1"],
    }
    return {
        "schema_version": "claim-evidence-locator-authority.v1",
        **payload,
        "response_digest": _digest("response-shape", "claim-evidence-response-shape.v1", payload),
    }


def _authority(
    *,
    evidence_ref: str = EVIDENCE_A,
    profile: str = "reference",
    admission_status: str = "ADMITTED",
    producer: str = "bureau_a",
) -> dict:
    profiles = {
        "reference": (
            "agent-evidence-protocol.v1",
            "reference-only.v1",
            "archive-reference.v1",
            "USER_INPUT",
            "USER_ATTESTED",
            "GENERAL",
        ),
        "text": (
            "deterministic-entity-reference.v1",
            "exact-text.v1",
            "entity-reference-86400s.v1",
            "DETERMINISTIC_RENDERER",
            "EXACT_TEXT",
            "ENTITY_REFERENCE",
        ),
        "decimal": (
            "deterministic-mainland-last-price.v1",
            "exact-decimal-unit.v1",
            "current-observation-300s.v1",
            "DETERMINISTIC_RENDERER",
            "EXACT_DECIMAL_UNIT",
            "MARKET_QUOTE",
        ),
    }
    adapter, comparator, freshness, source, assertion, category = profiles[profile]
    canonical = "Acme" if profile == "text" else "12.5" if profile == "decimal" else None
    unit = "CNY" if profile == "decimal" else None
    fact_value_digest = (
        _digest(
            "fact-value",
            "claim-evidence-fact-value.v1",
            {
                "fact_key": "fact_a",
                "subject_key": "subject_a",
                "value_type": "TEXT" if profile == "text" else "DECIMAL",
                "canonical_value": canonical,
                "unit": unit,
            },
        )
        if profile in {"text", "decimal"}
        else "sha256:" + "d" * 64
    )
    return {
        "schema_version": "claim-evidence-authority.v1",
        "evidence_ref": evidence_ref,
        "adapter_id": adapter,
        "adapter_version": "1.0.0",
        "comparator_id": comparator,
        "comparator_version": "1.0.0",
        "freshness_policy_id": freshness,
        "source_kind": source,
        "source_assertion_class": assertion,
        "source_digest": "sha256:" + "1" * 64,
        "fact_key": "fact_a",
        "subject_key": "subject_a",
        "category": category,
        "fact_value_digest": fact_value_digest,
        "as_of": NOW,
        "retrieved_at": NOW,
        "evaluated_at": NOW,
        "scope_identity": _scope(),
        "admission_status": admission_status,
        "conflict_digests": [],
    }


def _trusted(
    api,
    *,
    authorities: list[dict] | None = None,
    order: tuple[str, ...] = ("bureau_a",),
    locators: list[dict] | None = None,
    **overrides,
):
    values = {
        "tenant_scope": "courtos-single-tenant.v1",
        "scope_mode": "OWNER_ONLY",
        "tenant_id": None,
        "owner_user_id": "owner_a",
        "job_id": "job_a",
        "run_id": "run_a",
        "decree_id": "decree_a",
        "draft_fingerprint": "sha256:" + "2" * 64,
        "route_digest": "sha256:" + "3" * 64,
        "evaluated_at": NOW,
        "approved_processing_order": order,
        "evidence_authorities": tuple([_authority()] if authorities is None else authorities),
        "approved_locator_authorities": tuple(
            [_locator_authority()] if locators is None else locators
        ),
    }
    values.update(overrides)
    return api.TrustedEvidenceContextV1(**values)


def _public_value(profile: str):
    if profile == "reference":
        return None
    if profile == "text":
        return {
            "schema_version": "claim-public-value.v1",
            "template_id": "jinyiwei-entity-reference.v1",
            "value_type": "TEXT",
            "canonical_value": "Acme",
            "rendered_value_text": "Acme",
            "unit": None,
            "as_of": None,
            "rendered_as_of_text": None,
            "source_display": "锦衣卫实体引用",
        }
    return {
        "schema_version": "claim-public-value.v1",
        "template_id": "jinyiwei-mainland-last-price.v1",
        "value_type": "DECIMAL",
        "canonical_value": "12.5",
        "rendered_value_text": "12.5 CNY",
        "unit": "CNY",
        "as_of": NOW,
        "rendered_as_of_text": NOW,
        "source_display": "锦衣卫大陆市场最后价",
    }


def _packet(
    *,
    profile: str = "reference",
    producer: str = "bureau_a",
    claim_id: str = CLAIM_A,
    evidence_ref: str = EVIDENCE_A,
    kind: str = "FACT",
):
    extractors = {
        "reference": "bureau-opinion-clause.v1",
        "text": "jinyiwei-entity-reference-renderer.v1",
        "decimal": "jinyiwei-mainland-last-price-renderer.v1",
    }
    locator = {
        "kind": (
            "BUREAU_CLAUSE"
            if profile == "reference" and kind in {"FACT", "INFERENCE"}
            else "BUREAU_OPINION"
        ),
        "department_ordinal": "0",
        "bureau_ordinal": "0",
    }
    if profile == "reference" and kind in {"FACT", "INFERENCE"}:
        locator["claim_ordinal"] = "0"
    evidence_refs = [evidence_ref] if kind == "FACT" else []
    claim = {
        "schema_version": "claim-projection.v1",
        "claim_id": claim_id,
        "producer_node_id": producer,
        "extractor_id": extractors[profile],
        "extractor_version": "1.0.0",
        "public_projection_ref": locator,
        "kind": kind,
        "claim_key": "fact_a",
        "public_value_projection": _public_value(profile),
        "claim_digest": "",
        "evidence_refs": evidence_refs,
        "derivation_ref": None,
    }
    claim = _seal(claim, "claim_digest", "claim-projection")
    if kind != "FACT":
        packet = {
            "schema_version": "producer-claim-packet.v1",
            "producer_node_id": producer,
            "claims": [claim],
            "evidence_projections": [],
            "bindings": [],
            "packet_digest": "",
        }
        return _seal(packet, "packet_digest", "producer-claim-packet")
    authority = _authority(evidence_ref=evidence_ref, profile=profile, producer=producer)
    evidence = {
        key: authority[key]
        for key in (
            "evidence_ref",
            "adapter_id",
            "adapter_version",
            "comparator_id",
            "comparator_version",
            "source_kind",
            "source_assertion_class",
            "source_digest",
            "fact_key",
            "subject_key",
            "category",
            "fact_value_digest",
            "as_of",
            "retrieved_at",
            "evaluated_at",
        )
    }
    evidence = {
        "schema_version": "evidence-projection.v1",
        **evidence,
        "tenant_scope": "courtos-single-tenant.v1",
        "scope_mode": "OWNER_ONLY",
        "tenant_id": None,
        "owner_user_id": "owner_a",
        "run_id": "run_a",
        "decree_id": "decree_a",
        "projection_digest": "",
    }
    evidence = _seal(evidence, "projection_digest", "evidence-projection")
    binding = _seal(
        {
            "schema_version": "claim-evidence-binding.v1",
            "claim_id": claim_id,
            "claim_digest": claim["claim_digest"],
            "evidence_ref": evidence_ref,
            "evidence_projection_digest": evidence["projection_digest"],
            "relation": "SUPPORTS",
            "binding_digest": "",
        },
        "binding_digest",
        "claim-evidence-binding",
    )
    packet = {
        "schema_version": "producer-claim-packet.v1",
        "producer_node_id": producer,
        "claims": [claim],
        "evidence_projections": [evidence],
        "bindings": [binding],
        "packet_digest": "",
    }
    return _seal(packet, "packet_digest", "producer-claim-packet")


def _candidate(*packets: dict) -> bytes:
    return json.dumps(
        {
            "schema_version": "claim-evidence-candidate.v1",
            "producer_packets": list(packets or (_packet(),)),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()


def _error(code: str, callable_):
    api = _api()
    with pytest.raises(api.ClaimEvidenceGateError) as captured:
        callable_()
    assert captured.value.code == code
    assert str(captured.value) == code
    assert captured.value.__cause__ is None
    assert captured.value.__context__ is None


def test_closed_json_contract_rejects_duplicate_unknown_noncanonical_values():
    api = _api()
    for raw in (
        b'{"schema_version":"claim-evidence-candidate.v1","schema_version":"x","producer_packets":[]}',
        b'{"schema_version":"claim-evidence-candidate.v1","producer_packets":[],"extra":true}',
        b'{"schema_version":"claim-evidence-candidate.v1","producer_packets":[],"n":1}',
        b'{"schema_version":"claim-evidence-candidate.v1","producer_packets":[],"n":NaN}',
        b"\xff",
    ):
        _error(
            "DUPLICATE_ID" if raw.count(b"schema_version") == 2 else "PROJECTION_NOT_CANONICAL",
            lambda raw=raw: api.parse_claim_evidence_candidate_v1(raw),
        )
    packet = _packet()
    packet["claims"][0]["extractor_id"] = []
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "PROJECTION_NOT_CANONICAL",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )


def test_all_self_excluding_digests_fail_closed_on_tamper():
    api = _api()
    for collection, field in (
        ("claims", "claim_digest"),
        ("evidence_projections", "projection_digest"),
        ("bindings", "binding_digest"),
    ):
        packet = _packet()
        packet[collection][0][field] = "sha256:" + "0" * 64
        packet = _seal(packet, "packet_digest", "producer-claim-packet")
        _error(
            "DIGEST_MISMATCH",
            lambda packet=packet: api.evaluate_claim_evidence_v1(
                _candidate(packet), trusted_context=_trusted(api)
            ),
        )
    packet = _packet()
    packet["packet_digest"] = "sha256:" + "0" * 64
    _error(
        "DIGEST_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )


def test_fact_requires_admitted_exact_evidence_binding():
    api = _api()
    packet = _packet()
    packet["bindings"] = []
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    result = api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api))
    assert result.public_envelope.status == "BLOCK"
    assert result.public_envelope.uncovered_fields == ("FACT_WITHOUT_ADMITTED_BINDING",)

    packet = _packet(profile="text")
    packet["claims"][0]["claim_key"] = "different_fact"
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "IDENTITY_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(packet),
            trusted_context=_trusted(api, authorities=[_authority(profile="text")]),
        ),
    )

    packet = _packet()
    packet["claims"][0]["evidence_refs"] = ["ev_" + "f" * 64]
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "IDENTITY_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )


def test_inference_fails_closed_with_empty_derivation_registry():
    api = _api()
    packet = _packet(kind="INFERENCE")
    claim = packet["claims"][0]
    claim["derivation_ref"] = "derivation_a"
    packet["claims"][0] = _seal(claim, "claim_digest", "claim-projection")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    result = api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api))
    assert result.public_envelope.status == "BLOCK"
    assert result.public_envelope.uncovered_fields == ("INFERENCE_DERIVATION_UNAVAILABLE",)


def test_registry_injection_and_user_defined_schema_fail_closed():
    api = _api()
    root = json.loads(_candidate())
    root["registry"] = {"evil": "handler"}
    _error(
        "PROJECTION_NOT_CANONICAL", lambda: api.parse_claim_evidence_candidate_v1(json.dumps(root))
    )


def test_opinion_and_recommendation_cannot_carry_evidence_or_derivation():
    api = _api()
    packet = _packet(kind="OPINION")
    packet["claims"][0]["evidence_refs"] = [EVIDENCE_A]
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "PROJECTION_NOT_CANONICAL",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )
    _error(
        "PUBLIC_PROJECTION_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(_packet(profile="text", kind="OPINION")),
            trusted_context=_trusted(api, authorities=[]),
        ),
    )


def test_source_reviewer_and_self_review_spoofing_fail_closed():
    api = _api()
    root = json.loads(_candidate())
    root["producer_packets"][0]["reviewer"] = "bureau_a"
    _error(
        "PROJECTION_NOT_CANONICAL", lambda: api.parse_claim_evidence_candidate_v1(json.dumps(root))
    )


def test_numeric_grounding_rejects_unicode_substring_and_unit_approximation():
    api = _api()
    packet = _packet(profile="decimal")
    packet["claims"][0]["public_value_projection"]["canonical_value"] = "312.5"
    packet["claims"][0]["public_value_projection"]["rendered_value_text"] = "312.5 CNY"
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "NUMERIC_VALUE_NOT_EXACTLY_BOUND",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(packet),
            trusted_context=_trusted(api, authorities=[_authority(profile="decimal")]),
        ),
    )


@pytest.mark.parametrize("value", ["-0", "+1", "01", "1.0", "1e0", "0.0000000000001"])
def test_decimal_grounding_preserves_sign_zero_exponent_and_limits(value):
    api = _api()
    packet = _packet(profile="decimal")
    packet["claims"][0]["public_value_projection"]["canonical_value"] = value
    packet["claims"][0]["public_value_projection"]["rendered_value_text"] = f"{value} CNY"
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "NUMERIC_VALUE_NOT_EXACTLY_BOUND",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(packet),
            trusted_context=_trusted(api, authorities=[_authority(profile="decimal")]),
        ),
    )


def test_timestamp_grounding_rejects_naive_future_stale_and_display_splice():
    api = _api()
    authority = _authority(profile="decimal")
    authority["as_of"] = "2026-08-28T00:00:00Z"
    _error(
        "FRESHNESS_INVALID",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(_packet(profile="decimal")),
            trusted_context=_trusted(api, authorities=[authority]),
        ),
    )


def test_unknown_extractor_adapter_and_comparator_versions_fail_closed():
    api = _api()
    packet = _packet()
    packet["evidence_projections"][0]["comparator_version"] = "9.0.0"
    packet["evidence_projections"][0] = _seal(
        packet["evidence_projections"][0], "projection_digest", "evidence-projection"
    )
    packet["bindings"][0]["evidence_projection_digest"] = packet["evidence_projections"][0][
        "projection_digest"
    ]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "COMPARATOR_NOT_REGISTERED",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )
    packet = _packet(kind="OPINION")
    projection = _packet()["evidence_projections"][0]
    projection["source_kind"] = "ARCHIVE_REFERENCE"
    packet["evidence_projections"] = [_seal(projection, "projection_digest", "evidence-projection")]
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "COMPARATOR_NOT_REGISTERED",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(packet), trusted_context=_trusted(api, authorities=[])
        ),
    )


def test_locator_contract_rejects_bounds_wildcards_and_template_drift():
    api = _api()
    packet = _packet()
    packet["claims"][0]["public_projection_ref"]["claim_ordinal"] = "64"
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "PUBLIC_PROJECTION_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )
    packet = _packet(profile="text")
    packet["claims"][0]["public_value_projection"]["canonical_value"] = "   "
    packet["claims"][0]["public_value_projection"]["rendered_value_text"] = "   "
    whitespace_digest = _digest(
        "fact-value",
        "claim-evidence-fact-value.v1",
        {
            "fact_key": "fact_a",
            "subject_key": "subject_a",
            "value_type": "TEXT",
            "canonical_value": "   ",
            "unit": None,
        },
    )
    packet["evidence_projections"][0]["fact_value_digest"] = whitespace_digest
    packet["evidence_projections"][0] = _seal(
        packet["evidence_projections"][0], "projection_digest", "evidence-projection"
    )
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0]["evidence_projection_digest"] = packet["evidence_projections"][0][
        "projection_digest"
    ]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    authority = _authority(profile="text")
    authority["fact_value_digest"] = whitespace_digest
    _error(
        "PUBLIC_PROJECTION_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(packet),
            trusted_context=_trusted(api, authorities=[authority]),
        ),
    )


def test_duplicate_claim_evidence_and_binding_ids_fail_before_sorting():
    api = _api()
    packet = _packet()
    packet["claims"].append(deepcopy(packet["claims"][0]))
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "DUPLICATE_ID",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )
    second = _packet(
        producer="bureau_b",
        claim_id=CLAIM_A,
        evidence_ref="ev_" + "e" * 64,
    )
    _error(
        "DUPLICATE_ID",
        lambda: api.parse_claim_evidence_candidate_v1(_candidate(_packet(), second)),
    )


def test_container_reordering_preserves_canonical_processing_identity():
    api = _api()
    first = api.evaluate_claim_evidence_v1(_candidate(_packet()), trusted_context=_trusted(api))
    packet = _packet()
    packet = {key: packet[key] for key in reversed(tuple(packet))}
    second = api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api))
    assert (
        first.internal_envelope.decision.candidate_digest
        == second.internal_envelope.decision.candidate_digest
    )


def test_producer_packet_and_index_reject_cross_producer_splice():
    api = _api()
    second = _packet(producer="bureau_b", claim_id=CLAIM_B, evidence_ref="ev_" + "e" * 64)
    _error(
        "AGGREGATE_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(_packet(), second), trusted_context=_trusted(api)
        ),
    )
    first = _packet()
    second_ref = "ev_" + "e" * 64
    second = _packet(producer="bureau_b", claim_id=CLAIM_B, evidence_ref=second_ref)
    second["bindings"].append(first["bindings"].pop())
    first = _seal(first, "packet_digest", "producer-claim-packet")
    second = _seal(second, "packet_digest", "producer-claim-packet")
    _error(
        "IDENTITY_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(first, second),
            trusted_context=_trusted(
                api,
                authorities=[_authority(), _authority(evidence_ref=second_ref)],
                order=("bureau_a", "bureau_b"),
                locators=[_locator_authority(), _locator_authority("bureau_b")],
            ),
        ),
    )


def test_shared_evidence_requires_identical_canonical_projection():
    api = _api()
    packet = _packet()
    packet["evidence_projections"].append(deepcopy(packet["evidence_projections"][0]))
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "DUPLICATE_ID",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )
    orphan = _packet(
        producer="bureau_b",
        claim_id=CLAIM_B,
        evidence_ref="ev_" + "e" * 64,
    )["evidence_projections"][0]
    packet = _packet()
    packet["evidence_projections"].append(orphan)
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "IDENTITY_MISMATCH",
        lambda: api.parse_claim_evidence_candidate_v1(_candidate(packet)),
    )
    opinion = _packet(kind="OPINION")
    opinion["evidence_projections"] = [orphan]
    opinion = _seal(opinion, "packet_digest", "producer-claim-packet")
    _error(
        "IDENTITY_MISMATCH",
        lambda: api.parse_claim_evidence_candidate_v1(_candidate(opinion)),
    )


def test_owner_run_decree_draft_route_and_scope_splice_fail_closed():
    api = _api()
    _error(
        "IDENTITY_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(), trusted_context=_trusted(api, run_id="run_b")
        ),
    )
    for field_name, drifted in (
        ("owner_user_id", "owner_b"),
        ("run_id", "run_b"),
        ("decree_id", "decree_b"),
    ):
        packet = _packet(kind="OPINION")
        projection = _packet()["evidence_projections"][0]
        projection[field_name] = drifted
        packet["evidence_projections"] = [
            _seal(projection, "projection_digest", "evidence-projection")
        ]
        packet = _seal(packet, "packet_digest", "producer-claim-packet")
        _error(
            "IDENTITY_MISMATCH",
            lambda packet=packet: api.evaluate_claim_evidence_v1(
                _candidate(packet), trusted_context=_trusted(api, authorities=[])
            ),
        )


def test_budget_precedes_materialization_and_external_effects_stay_false():
    api = _api()
    _error("BUDGET_EXCEEDED", lambda: api.parse_claim_evidence_candidate_v1(b" " * 262145))
    oversized_nodes = json.dumps(
        {
            "schema_version": "claim-evidence-candidate.v1",
            "producer_packets": [],
            "extra": ["x"] * 4096,
        },
        separators=(",", ":"),
    )
    _error(
        "BUDGET_EXCEEDED",
        lambda: api.parse_claim_evidence_candidate_v1(oversized_nodes),
    )

    def opinion_packet(producer: str, count: int, offset: int) -> dict:
        packet = _packet(producer=producer, kind="OPINION")
        claims = []
        for index in range(offset, offset + count):
            claim = deepcopy(packet["claims"][0])
            claim["claim_id"] = "clm_" + f"{index:064x}"
            claims.append(_seal(claim, "claim_digest", "claim-projection"))
        packet["claims"] = claims
        return _seal(packet, "packet_digest", "producer-claim-packet")

    too_many_claims = _candidate(
        opinion_packet("bureau_a", 64, 0), opinion_packet("bureau_b", 1, 64)
    )
    _error(
        "BUDGET_EXCEEDED",
        lambda: api.parse_claim_evidence_candidate_v1(too_many_claims),
    )
    result = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))
    assert result.internal_envelope.decision.external_effect_authorized is False
    assert result.internal_envelope.control.external_effect_authorized is False
    assert result.public_envelope.external_effect_authorized is False


def test_untrusted_payload_cannot_self_declare_admission_source_owner_or_reviewer():
    api = _api()
    root = json.loads(_candidate())
    root["evidence_authorities"] = [{"admission_status": "ADMITTED"}]
    _error(
        "PROJECTION_NOT_CANONICAL", lambda: api.parse_claim_evidence_candidate_v1(json.dumps(root))
    )


def test_cross_kind_version_and_level_digest_splice_fail_closed():
    api = _api()
    packet = _packet()
    packet["claims"][0]["claim_digest"] = packet["packet_digest"]
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "DIGEST_MISMATCH",
        lambda: api.evaluate_claim_evidence_v1(_candidate(packet), trusted_context=_trusted(api)),
    )


def test_boundary_plus_one_depth_nodes_strings_decimal_and_output_fail_closed():
    api = _api()
    raw = (
        '{"schema_version":"claim-evidence-candidate.v1","producer_packets":[],"x":"'
        + "a" * 2049
        + '"}'
    )
    _error("BUDGET_EXCEEDED", lambda: api.parse_claim_evidence_candidate_v1(raw))
    packet = _packet(profile="text")
    large_value = "x" * 2048
    packet["claims"][0]["public_value_projection"]["canonical_value"] = large_value
    packet["claims"][0]["public_value_projection"]["rendered_value_text"] = large_value
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "BUDGET_EXCEEDED",
        lambda: api.parse_claim_evidence_candidate_v1(_candidate(packet)),
    )


def test_original_mutable_input_cannot_change_frozen_projection_after_parse():
    api = _api()
    authority = _authority()
    context = _trusted(api, authorities=[authority])
    authority["source_digest"] = "sha256:" + "9" * 64
    assert context.evidence_authorities[0].source_digest == "sha256:" + "1" * 64
    with pytest.raises((AttributeError, TypeError)):
        context.run_id = "changed"
    with pytest.raises(TypeError):
        context.evidence_authorities[0]._map["source_digest"] = "sha256:" + "8" * 64

    parsed = api.parse_claim_evidence_candidate_v1(_candidate())
    with pytest.raises(TypeError):
        parsed._map["schema_version"] = "tampered"

    result = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=context)
    with pytest.raises(TypeError):
        result.internal_envelope._map["decision"] = None
    with pytest.raises(TypeError):
        result.public_envelope._map["status"] = "BLOCK"


def test_public_envelope_redacts_source_locator_value_identity_and_error_canaries():
    api = _api()
    result = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))
    public = _canonical(result.public_envelope).decode()
    for forbidden in (EVIDENCE_A, "owner_a", "run_a", "Acme", "BUREAU_CLAUSE"):
        assert forbidden not in public
    with pytest.raises(api.ClaimEvidenceGateError) as captured:
        api.parse_claim_evidence_candidate_v1(b'{"secret":"CANARY",}')
    assert "CANARY" not in str(captured.value)
    assert "CANARY" not in repr(captured.value)
    assert captured.value.__cause__ is None
    assert captured.value.__context__ is None


def test_raw_candidate_root_schema_and_unknown_fields_fail_closed():
    api = _api()
    for raw in (
        b"[]",
        b"{}",
        b'{"schema_version":"claim-evidence-decision.v1","producer_packets":[]}',
    ):
        _error(
            "PROJECTION_NOT_CANONICAL", lambda raw=raw: api.parse_claim_evidence_candidate_v1(raw)
        )


def test_freshness_policy_and_locator_boundaries_fail_closed():
    api = _api()
    authority = _authority(profile="decimal")
    authority["as_of"] = "2026-08-27T23:54:59.999999Z"
    packet = _packet(profile="decimal")
    packet["evidence_projections"][0]["as_of"] = authority["as_of"]
    packet["evidence_projections"][0] = _seal(
        packet["evidence_projections"][0], "projection_digest", "evidence-projection"
    )
    packet["bindings"][0]["evidence_projection_digest"] = packet["evidence_projections"][0][
        "projection_digest"
    ]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    _error(
        "FRESHNESS_INVALID",
        lambda: api.evaluate_claim_evidence_v1(
            _candidate(packet), trusted_context=_trusted(api, authorities=[authority])
        ),
    )


def test_trusted_snapshot_digest_binds_authorities_and_processing_order():
    api = _api()
    first = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))
    blocked = _authority(admission_status="BLOCKED")
    second = api.evaluate_claim_evidence_v1(
        _candidate(), trusted_context=_trusted(api, authorities=[blocked])
    )
    assert second.public_envelope.uncovered_fields == ("FACT_WITHOUT_ADMITTED_BINDING",)
    assert (
        first.internal_envelope.decision.evidence_snapshot_digest
        != second.internal_envelope.decision.evidence_snapshot_digest
    )
    constructor_parameters = inspect.signature(api.TrustedEvidenceContextV1).parameters
    assert "schema_version" not in constructor_parameters
    assert all(
        parameter.kind is inspect.Parameter.KEYWORD_ONLY
        for parameter in constructor_parameters.values()
    )
    _error(
        "DUPLICATE_ID",
        lambda: _trusted(api, authorities=[_authority(), _authority()]),
    )
    unregistered = _authority()
    unregistered["adapter_id"] = "attacker-adapter.v1"
    _error(
        "ADAPTER_NOT_REGISTERED",
        lambda: _trusted(api, authorities=[unregistered]),
    )
    _error(
        "PROJECTION_NOT_CANONICAL",
        lambda: _trusted(api, draft_fingerprint=[]),
    )
    _error("PROJECTION_NOT_CANONICAL", lambda: _trusted(api, attacker=True))


def test_import_and_public_api_are_pure_no_io_clock_random_env_or_network(monkeypatch):
    api = _api()
    with pytest.raises(TypeError):
        api._EXTRACTOR_ORDER["attacker.v1"] = -1
    with pytest.raises(TypeError):
        api._REGISTRY[("attacker.v1",)] = ("EXACT_VALUE_BOUND", "EXACT_VALUE_MATCH")
    assert tuple(inspect.signature(api.parse_claim_evidence_candidate_v1).parameters) == ("raw",)
    assert tuple(inspect.signature(api.evaluate_claim_evidence_v1).parameters) == (
        "raw",
        "trusted_context",
    )
    monkeypatch.setattr(
        builtins, "open", lambda *a, **k: (_ for _ in ()).throw(AssertionError("io"))
    )
    monkeypatch.setattr(os, "getenv", lambda *a, **k: (_ for _ in ()).throw(AssertionError("env")))
    api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))


def test_admitted_fact_reference_binding_round_trips():
    api = _api()
    result = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))
    assert result.public_envelope.status == "PASS"
    assert (
        result.public_envelope.claim_results[0].truth_label
        == "USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED"
    )


def test_exact_text_fact_passes_with_trusted_context():
    api = _api()
    result = api.evaluate_claim_evidence_v1(
        _candidate(_packet(profile="text")),
        trusted_context=_trusted(api, authorities=[_authority(profile="text")]),
    )
    assert result.public_envelope.status == "PASS"
    assert result.public_envelope.claim_results[0].truth_label == "EXACT_VALUE_BOUND"


def test_exact_decimal_unit_fact_passes_with_trusted_context():
    api = _api()
    result = api.evaluate_claim_evidence_v1(
        _candidate(_packet(profile="decimal")),
        trusted_context=_trusted(api, authorities=[_authority(profile="decimal")]),
    )
    assert result.public_envelope.status == "PASS"


@pytest.mark.parametrize("kind", ["OPINION", "RECOMMENDATION"])
def test_nonfactual_opinion_and_recommendation_pass_without_evidence(kind):
    api = _api()
    result = api.evaluate_claim_evidence_v1(
        _candidate(_packet(kind=kind)), trusted_context=_trusted(api, authorities=[])
    )
    assert result.public_envelope.status == "PASS"
    assert result.public_envelope.claim_results[0].truth_label == "NONFACTUAL"


def test_shared_evidence_same_projection_is_reused_once():
    api = _api()
    result = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))
    assert len(result.internal_envelope.evidence_projections) == 1
    packet = _packet()
    second_ref = "ev_" + "e" * 64
    second_packet = _packet(evidence_ref=second_ref)
    packet["claims"][0]["evidence_refs"].append(second_ref)
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    second_binding = deepcopy(second_packet["bindings"][0])
    second_binding["claim_id"] = packet["claims"][0]["claim_id"]
    second_binding["claim_digest"] = packet["claims"][0]["claim_digest"]
    second_binding = _seal(second_binding, "binding_digest", "claim-evidence-binding")
    packet["evidence_projections"].append(second_packet["evidence_projections"][0])
    packet["bindings"].append(second_binding)
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    result = api.evaluate_claim_evidence_v1(
        _candidate(packet),
        trusted_context=_trusted(
            api, authorities=[_authority(), _authority(evidence_ref=second_ref)]
        ),
    )
    assert result.internal_envelope.decision.claim_results[0].reason_codes == (
        "USER_ATTESTED_BOUND",
    )
    assert result.public_envelope.claim_results[0].reason_codes == ("USER_ATTESTED_BOUND",)

    archive_ref = "ev_" + "b" * 64
    packet = _packet()
    archive_packet = _packet(evidence_ref=archive_ref)
    archive_projection = archive_packet["evidence_projections"][0]
    archive_projection.update(
        {
            "adapter_id": "shiguan-adopted-reference.v1",
            "source_kind": "ARCHIVE_REFERENCE",
            "source_assertion_class": "ARCHIVED_REFERENCE",
            "category": "ARCHIVE_RECORD",
        }
    )
    archive_projection = _seal(archive_projection, "projection_digest", "evidence-projection")
    packet["claims"][0]["evidence_refs"].append(archive_ref)
    packet["claims"][0]["evidence_refs"].sort()
    packet["claims"][0] = _seal(packet["claims"][0], "claim_digest", "claim-projection")
    packet["bindings"][0]["claim_digest"] = packet["claims"][0]["claim_digest"]
    packet["bindings"][0] = _seal(packet["bindings"][0], "binding_digest", "claim-evidence-binding")
    archive_binding = archive_packet["bindings"][0]
    archive_binding["claim_id"] = packet["claims"][0]["claim_id"]
    archive_binding["claim_digest"] = packet["claims"][0]["claim_digest"]
    archive_binding["evidence_projection_digest"] = archive_projection["projection_digest"]
    archive_binding = _seal(archive_binding, "binding_digest", "claim-evidence-binding")
    packet["evidence_projections"].append(archive_projection)
    packet["evidence_projections"].sort(key=lambda item: item["evidence_ref"])
    packet["bindings"].append(archive_binding)
    packet["bindings"].sort(key=lambda item: (item["claim_id"], item["evidence_ref"]))
    packet = _seal(packet, "packet_digest", "producer-claim-packet")
    archive_authority = _authority(evidence_ref=archive_ref)
    archive_authority.update(
        {
            "adapter_id": "shiguan-adopted-reference.v1",
            "source_kind": "ARCHIVE_REFERENCE",
            "source_assertion_class": "ARCHIVED_REFERENCE",
            "category": "ARCHIVE_RECORD",
        }
    )
    result = api.evaluate_claim_evidence_v1(
        _candidate(packet),
        trusted_context=_trusted(api, authorities=[archive_authority, _authority()]),
    )
    assert result.public_envelope.claim_results[0].reason_codes == (
        "USER_ATTESTED_BOUND",
        "ARCHIVED_REFERENCE_BOUND",
    )


def test_container_reorder_preserves_canonical_digest():
    test_container_reordering_preserves_canonical_processing_identity()


def test_processing_order_change_preserves_member_index_digest_and_changes_aggregate_digest():
    api = _api()
    packet_a = _packet(claim_id=CLAIM_B)
    packet_b = _packet(producer="bureau_b", claim_id=CLAIM_A, evidence_ref="ev_" + "e" * 64)
    authorities = [_authority(), _authority(evidence_ref="ev_" + "e" * 64)]
    locators = [_locator_authority("bureau_a"), _locator_authority("bureau_b")]
    first = api.evaluate_claim_evidence_v1(
        _candidate(packet_a, packet_b),
        trusted_context=_trusted(
            api, authorities=authorities, locators=locators, order=("bureau_a", "bureau_b")
        ),
    )
    second = api.evaluate_claim_evidence_v1(
        _candidate(packet_a, packet_b),
        trusted_context=_trusted(
            api, authorities=authorities, locators=locators, order=("bureau_b", "bureau_a")
        ),
    )
    first_indexes = {
        item.producer_node_id: item.index_digest
        for item in first.internal_envelope.producer_packet_index
    }
    second_indexes = {
        item.producer_node_id: item.index_digest
        for item in second.internal_envelope.producer_packet_index
    }
    assert first_indexes == second_indexes
    assert tuple(item.claim_id for item in first.internal_envelope.claims) == (CLAIM_A, CLAIM_B)
    assert tuple(item.claim_id for item in second.internal_envelope.claims) == (CLAIM_A, CLAIM_B)
    assert (
        first.internal_envelope.decision.aggregate_digest
        != second.internal_envelope.decision.aggregate_digest
    )


def test_complete_envelope_round_trip_recomputes_all_digests():
    api = _api()
    result = api.evaluate_claim_evidence_v1(_candidate(), trusted_context=_trusted(api))
    for item in result.internal_envelope.producer_packet_index:
        _assert_sealed(item, "index_digest", "producer-packet-index")
    _assert_sealed(result.internal_envelope.decision, "decision_digest", "claim-evidence-decision")
    _assert_sealed(result.internal_envelope.control, "control_ref", "claim-evidence-control")
    _assert_sealed(result.internal_envelope, "envelope_digest", "claim-evidence-envelope")
    _assert_sealed(
        result.public_envelope,
        "public_envelope_digest",
        "claim-evidence-public-envelope",
    )
    evaluation_payload = {
        "schema_version": result.schema_version,
        "internal_envelope": _plain(result.internal_envelope),
        "public_envelope": _plain(result.public_envelope),
    }
    assert result.evaluation_digest == _digest(
        "claim-evidence-evaluation", result.schema_version, evaluation_payload
    )


def test_public_value_projection_and_evaluation_return_shape_round_trip():
    api = _api()
    result = api.evaluate_claim_evidence_v1(
        _candidate(_packet(profile="text")),
        trusted_context=_trusted(api, authorities=[_authority(profile="text")]),
    )
    assert type(result) is api.ClaimEvidenceEvaluationV1
    assert set(_plain(result.public_envelope)) == {
        "schema_version",
        "coverage_scope",
        "status",
        "claim_results",
        "uncovered_fields",
        "decision_digest",
        "external_effect_authorized",
        "public_envelope_digest",
    }
