"""Contract tests for the only semantic evaluator of Fact Pack V1."""

from __future__ import annotations

import hashlib
import json

import pytest

from app.mingshuo.fact_pack import (
    canonical_fact_pack_bytes,
    evaluate_json_wire,
    evaluate_pack,
    fact_pack_digest,
)


def valid_pack() -> dict:
    return {
        "schemaVersion": "mingshuo.project-fact-pack.v1",
        "tenant": {"id": "tenant-demo", "ownerUserId": "owner-demo"},
        "project": {
            "id": "project-demo",
            "name": "Synthetic",
            "productLines": ["CELL"],
            "markets": ["EU"],
            "languages": ["zh-CN"],
            "status": "READY_FOR_REVIEW",
        },
        "skuCandidates": [
            {
                "id": "sku-one",
                "label": "one",
                "status": "EVIDENCE_BOUND",
                "parameterStatus": "EVIDENCE_BOUND",
            },
            {"id": "sku-two", "label": "two", "status": "RESERVED", "parameterStatus": "MISSING"},
            {
                "id": "sku-three",
                "label": "three",
                "status": "RESERVED",
                "parameterStatus": "MISSING",
            },
        ],
        "sourcePolicy": {
            "finalTruthSource": "COURTOS_SERVER_EVIDENCE_BINDING",
            "imaMode": "READ_ONLY",
            "externalModelMode": "DRAFT_ASSIST_ONLY",
            "knowledgePromotion": "CANDIDATE_ONLY",
        },
        "evidence": [
            {
                "id": "ev-one",
                "sourceClass": "INTERNAL_MEASURED",
                "digest": "sha256:" + "1" * 64,
                "validUntil": "2027-01-01",
                "adoptionStatus": "ADOPTED",
            }
        ],
        "facts": [
            {
                "id": "fact-one",
                "kind": "PARAMETER",
                "subject": "sku-one",
                "value": "synthetic",
                "evidenceRefs": ["ev-one"],
            }
        ],
        "claims": [
            {
                "id": "claim-one",
                "text": "synthetic",
                "evidenceRefs": ["ev-one"],
                "approvalStatus": "DRAFT",
            }
        ],
        "commercial": {
            "priceAuthority": {"status": "APPROVED", "approver": "owner-demo"},
            "quoteStatus": "DRAFT",
        },
        "channels": [{"id": "WEBSITE", "state": "DRAFT", "publicationAuthorized": False}],
        "safety": {"dangerousOperationalInstructionsPresent": False},
        "knowledgeWriteBack": {"status": "CANDIDATE_ONLY"},
        "businessSuccessMeasured": False,
        "productionPromotionAuthorized": False,
    }


def test_valid_pack_is_non_authorizing_and_evidence_bound() -> None:
    result = evaluate_pack(valid_pack(), now="2026-09-05T12:00:00Z")
    assert result["decision"] == "PASS"
    assert result["nonAuthorizing"] is True
    assert result["businessSuccessMeasured"] is False
    assert result["productionPromotionAuthorized"] is False
    assert result["summary"]["coverage"]["claims"] == 1.0


def test_schema_and_wire_inputs_fail_closed() -> None:
    invalid = valid_pack()
    invalid["untrusted"] = "never accepted"
    assert evaluate_pack(invalid, now="2026-09-05")["decision"] == "STOP"
    assert evaluate_json_wire(b'{"x":1,"x":2}', now="2026-09-05")["decision"] == "STOP"
    assert evaluate_json_wire(b"\xff", now="2026-09-05")["decision"] == "STOP"


def test_missing_or_expired_evidence_holds_closed() -> None:
    pack = valid_pack()
    pack["claims"][0]["evidenceRefs"] = ["missing"]
    assert evaluate_pack(pack, now="2026-09-05")["decision"] == "HOLD"
    pack = valid_pack()
    pack["evidence"][0]["validUntil"] = "2026-09-04"
    result = evaluate_pack(pack, now="2026-09-05")
    assert result["decision"] == "HOLD"
    assert result["summary"]["coverage"]["claims"] == 0.0
    assert result["summary"]["coverage"]["evidence"] == 0.0
    pack = valid_pack()
    pack["evidence"][0]["adoptionStatus"] = "REJECTED"
    result = evaluate_pack(pack, now="2026-09-05")
    assert result["decision"] == "HOLD"
    assert result["summary"]["coverage"]["evidence"] == 0.0


def test_duplicate_identifiers_fail_closed() -> None:
    for field in ("evidence", "facts", "claims", "skuCandidates"):
        pack = valid_pack()
        pack[field].append(dict(pack[field][0]))
        assert evaluate_pack(pack, now="2026-09-05")["decision"] == "STOP"


def test_schema_contract_rejects_closed_shape_type_enum_and_dates() -> None:
    mutations = [
        lambda p: p["tenant"].update({"unknown": True}),
        lambda p: p["tenant"].update({"id": ""}),
        lambda p: p["project"].update({"productLines": ["NOT_A_PRODUCT"]}),
        lambda p: p["project"].update({"markets": []}),
        lambda p: p["evidence"][0].update({"validUntil": "2027-02-29"}),
        lambda p: p["evidence"][0].update({"digest": "sha256:bad"}),
        lambda p: p["claims"][0].update({"text": "x" * 501}),
        lambda p: p["channels"][0].update({"publicationAuthorized": "false"}),
        lambda p: p["facts"][0].update({"evidenceRefs": ["ev-one"], "extra": "no"}),
        lambda p: p["commercial"].update({"quoteStatus": "INVALID"}),
    ]
    for mutate in mutations:
        pack = valid_pack()
        mutate(pack)
        assert evaluate_pack(pack, now="2026-09-05")["decision"] == "STOP"


def test_wire_limits_depth_nodes_utf8_and_duplicate_keys_fail_closed() -> None:
    assert evaluate_json_wire(b'{"a":1,"a":2}', now="2026-09-05")["decision"] == "STOP"
    assert evaluate_json_wire(b"\xff", now="2026-09-05")["decision"] == "STOP"
    assert (
        evaluate_json_wire((b"[" * 66) + (b"0" + b"]" * 66), now="2026-09-05")["decision"] == "STOP"
    )
    assert evaluate_json_wire(b"[" + b"0," * 33_000 + b"0]", now="2026-09-05")["decision"] == "STOP"


def test_block_policy_price_publication_knowledge_and_danger() -> None:
    cases = [
        (
            lambda p: p["commercial"].update(
                {"priceAuthority": {"status": "MISSING", "approver": None}}
            ),
            "PRICE_AUTHORITY_MISSING",
        ),
        (
            lambda p: p["channels"][0].update({"publicationAuthorized": True}),
            "EXTERNAL_PUBLICATION_NOT_AUTHORIZED",
        ),
        (
            lambda p: p["knowledgeWriteBack"].update({"status": "ACTIVE"}),
            "KNOWLEDGE_AUTO_PROMOTION_FORBIDDEN",
        ),
        (
            lambda p: p["safety"].update({"dangerousOperationalInstructionsPresent": True}),
            "DANGEROUS_OPERATIONAL_INSTRUCTIONS_FORBIDDEN",
        ),
    ]
    for mutate, reason in cases:
        pack = valid_pack()
        mutate(pack)
        result = evaluate_pack(pack, now="2026-09-05")
        assert result["decision"] == "BLOCK"
        assert reason in result["blockReasons"]


def test_not_requested_price_fact_still_requires_authority_and_invalid_clock_stops() -> None:
    pack = valid_pack()
    pack["commercial"] = {
        "priceAuthority": {"status": "MISSING", "approver": None},
        "quoteStatus": "NOT_REQUESTED",
    }
    pack["facts"][0]["kind"] = "PRICE"
    assert "PRICE_AUTHORITY_MISSING" in evaluate_pack(pack, now="2026-09-05")["blockReasons"]
    assert evaluate_pack(valid_pack(), now="2026-09-05T12:00:00+08:00")["decision"] == "STOP"


def test_authority_and_structured_safety_block_closed() -> None:
    pack = valid_pack()
    pack["commercial"]["priceAuthority"] = {"status": "MISSING", "approver": None}
    assert "PRICE_AUTHORITY_MISSING" in evaluate_pack(pack, now="2026-09-05")["blockReasons"]
    pack = valid_pack()
    pack["safety"]["dangerousOperationalInstructionsPresent"] = True
    assert (
        "DANGEROUS_OPERATIONAL_INSTRUCTIONS_FORBIDDEN"
        in evaluate_pack(pack, now="2026-09-05")["blockReasons"]
    )


def test_result_is_redacted_and_deterministic() -> None:
    pack = valid_pack()
    first = evaluate_json_wire(json.dumps(pack).encode(), now="2026-09-05T12:00:00Z")
    second = evaluate_json_wire(json.dumps(pack).encode(), now="2026-09-05T12:00:00Z")
    assert first == second
    assert "Synthetic" not in json.dumps(first)


def test_full_pack_canonical_bytes_and_digest_are_single_deterministic_identity() -> None:
    pack = valid_pack()
    reordered = {key: pack[key] for key in reversed(pack)}
    expected = json.dumps(
        pack,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    assert canonical_fact_pack_bytes(pack) == expected
    assert canonical_fact_pack_bytes(reordered) == expected
    assert fact_pack_digest(pack) == "sha256:" + hashlib.sha256(expected).hexdigest()


def test_full_pack_canonical_identity_rejects_non_json_numbers() -> None:
    pack = valid_pack()
    pack["facts"][0]["value"] = float("nan")
    with pytest.raises(ValueError):
        canonical_fact_pack_bytes(pack)
