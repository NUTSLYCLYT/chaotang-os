"""The single semantic evaluator for MingshuoProjectFactPackV1.

This module deliberately has no network, persistence, model, authority or API
integration.  It projects a bounded non-authorizing decision only.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_VERSION = "mingshuo.project-fact-pack.v1"
RESULT_SCHEMA_VERSION = "mingshuo.fact-pack.validation.v1"
MAX_INPUT_BYTES = 1_048_576
MAX_DEPTH = 64
MAX_NODES = 32_768
ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "docs/contracts/mingshuo-project-fact-pack.schema.json"
SCHEMA_BYTES: bytes | None = None


def _pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def _limits(value: Any, depth: int = 0, nodes: list[int] | None = None) -> None:
    if depth > MAX_DEPTH:
        raise ValueError("INPUT_DEPTH_LIMIT")
    nodes = nodes or [0]
    nodes[0] += 1
    if nodes[0] > MAX_NODES:
        raise ValueError("INPUT_NODE_LIMIT")
    if isinstance(value, dict):
        for item in value.values():
            _limits(item, depth + 1, nodes)
    elif isinstance(value, list):
        for item in value:
            _limits(item, depth + 1, nodes)


def _parse_wire(raw: bytes) -> Any:
    if len(raw) > MAX_INPUT_BYTES:
        raise ValueError("INPUT_BYTES_LIMIT")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise ValueError("JSON_WIRE_INVALID") from error
    _limits(value)
    return value


def _today(now: str | None) -> str | None:
    if not isinstance(now, str):
        return None
    try:
        if len(now) == 10:
            return date.fromisoformat(now).isoformat()
        if not now.endswith("Z"):
            return None
        parsed = datetime.fromisoformat(now[:-1] + "+00:00")
        offset = parsed.utcoffset()
        return (
            parsed.date().isoformat()
            if offset is not None and offset.total_seconds() == 0
            else None
        )
    except ValueError:
        return None


def _sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def _result(
    decision: str,
    errors: set[str],
    holds: set[str],
    blocks: set[str],
    pack: dict[str, Any] | None = None,
    today: str | None = None,
) -> dict[str, Any]:
    stopped = decision == "STOP" or pack is None
    facts = [] if stopped else pack.get("facts", [])
    claims = [] if stopped else pack.get("claims", [])
    evidence = [] if stopped else pack.get("evidence", [])
    eligible = {
        item.get("id")
        for item in evidence
        if item.get("adoptionStatus") == "ADOPTED"
        and (today is None or item.get("validUntil", "") >= today)
    }
    covered = sum(
        1
        for claim in claims
        if claim.get("evidenceRefs") and all(ref in eligible for ref in claim["evidenceRefs"])
    )
    return {
        "schemaVersion": RESULT_SCHEMA_VERSION,
        "decision": decision,
        "nonAuthorizing": True,
        "errors": sorted(errors)[:128],
        "holdReasons": sorted(holds)[:128],
        "blockReasons": sorted(blocks)[:128],
        "evidenceDigest": None if stopped else _sha(evidence),
        "factDigest": None if stopped else _sha(facts),
        "claimDigest": None if stopped else _sha(claims),
        "summary": {
            "schemaVersion": "mingshuo.fact-pack.summary.v1",
            "decision": decision,
            "counts": {
                "facts": len(facts),
                "claims": len(claims),
                "evidence": len(evidence),
                "errors": len(errors),
                "holds": len(holds),
                "blocks": len(blocks),
            },
            "coverage": {
                "evidence": len(eligible) / len(evidence) if evidence else 0.0,
                "claims": covered / len(claims) if claims else 0.0,
            },
        },
        "businessSuccessMeasured": False,
        "productionPromotionAuthorized": False,
    }


def _schema_errors(pack: dict[str, Any]) -> set[str]:
    try:
        raw = SCHEMA_BYTES if SCHEMA_BYTES is not None else SCHEMA_PATH.read_bytes()
        schema = json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs)
        if "$ref" in json.dumps(schema, sort_keys=True):
            return {"LOCAL_SCHEMA_REF_FORBIDDEN"}
        return (
            {"SCHEMA_INVALID"}
            if list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(pack))
            else set()
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return {"LOCAL_SCHEMA_INVALID"}


def evaluate_pack(pack: Any, *, now: str | None) -> dict[str, Any]:
    if not isinstance(pack, dict):
        return _result("STOP", {"PACKET_NOT_JSON_OBJECT"}, set(), set())
    today = _today(now)
    if today is None:
        return _result("STOP", {"VALIDATION_CLOCK_INVALID"}, set(), set())
    errors = _schema_errors(pack)
    if pack.get("schemaVersion") != SCHEMA_VERSION:
        errors.add("SCHEMA_VERSION_INVALID")
    if errors:
        return _result("STOP", errors, set(), set())
    evidence = pack["evidence"]
    ids = {item["id"] for item in evidence}
    if len(ids) != len(evidence):
        return _result("STOP", {"EVIDENCE_ID_DUPLICATE"}, set(), set())
    fact_ids = {item["id"] for item in pack["facts"]}
    claim_ids = {item["id"] for item in pack["claims"]}
    sku_ids = {item["id"] for item in pack["skuCandidates"]}
    if (
        len(fact_ids) != len(pack["facts"])
        or len(claim_ids) != len(pack["claims"])
        or len(sku_ids) != len(pack["skuCandidates"])
    ):
        return _result("STOP", {"FACT_PACK_ID_DUPLICATE"}, set(), set())
    eligible = {
        item["id"]
        for item in evidence
        if item["adoptionStatus"] == "ADOPTED" and item["validUntil"] >= today
    }
    holds: set[str] = set()
    blocks: set[str] = set()
    if any(item["validUntil"] < today for item in evidence):
        holds.add("EVIDENCE_EXPIRED")
    for label, values in (("FACT", pack["facts"]), ("CLAIM", pack["claims"])):
        if not values:
            holds.add(f"{label}S_MISSING")
        for value in values:
            refs = value["evidenceRefs"]
            if not refs:
                holds.add(f"{label}_EVIDENCE_MISSING")
            elif any(ref not in ids for ref in refs):
                holds.add(f"{label}_EVIDENCE_UNRESOLVED")
            elif any(ref not in eligible for ref in refs):
                holds.add(f"{label}_EVIDENCE_INELIGIBLE")
    if pack["sourcePolicy"]["finalTruthSource"] != "COURTOS_SERVER_EVIDENCE_BINDING":
        blocks.add("SECOND_TRUTH_SOURCE_FORBIDDEN")
    if pack["knowledgeWriteBack"]["status"] == "ACTIVE":
        blocks.add("KNOWLEDGE_AUTO_PROMOTION_FORBIDDEN")
    needs_price = pack["commercial"]["quoteStatus"] != "NOT_REQUESTED" or any(
        item["kind"] == "PRICE" for item in pack["facts"]
    )
    authority = pack["commercial"]["priceAuthority"]
    if needs_price and not (
        authority["status"] == "APPROVED"
        and isinstance(authority["approver"], str)
        and authority["approver"].strip()
    ):
        blocks.add("PRICE_AUTHORITY_MISSING")
    if any(
        item["publicationAuthorized"] or item["state"] == "PUBLISHED" for item in pack["channels"]
    ):
        blocks.add("EXTERNAL_PUBLICATION_NOT_AUTHORIZED")
    if pack["safety"]["dangerousOperationalInstructionsPresent"]:
        blocks.add("DANGEROUS_OPERATIONAL_INSTRUCTIONS_FORBIDDEN")
    if pack["businessSuccessMeasured"] is not False:
        blocks.add("BUSINESS_SUCCESS_CLAIM_FORBIDDEN")
    if pack["productionPromotionAuthorized"] is not False:
        blocks.add("PRODUCTION_PROMOTION_FORBIDDEN")
    return _result(
        "BLOCK" if blocks else "HOLD" if holds else "PASS",
        set(),
        holds,
        blocks,
        pack,
        today,
    )


def evaluate_json_wire(raw: bytes, *, now: str | None) -> dict[str, Any]:
    try:
        return evaluate_pack(_parse_wire(raw), now=now)
    except ValueError as error:
        return _result("STOP", {str(error)}, set(), set())
