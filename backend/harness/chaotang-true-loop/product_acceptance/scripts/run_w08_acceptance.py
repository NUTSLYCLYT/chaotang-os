from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


HARNESS_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = HARNESS_ROOT / "golden_cases" / "w08_contracts.json"
REQUIRED_ARTIFACT_KINDS = {"PDF", "DOCX", "JSON"}
REQUIRED_LINEAGE_FIELDS = {
    "mission_contract_id",
    "evidence_packet_ids",
    "risk_item_ids",
    "final_memorial_id",
    "artifact_manifest_id",
    "archive_id",
}
REQUIRED_BROWSER_STEPS = {
    "upload_contract",
    "parse_mission_contract",
    "review_risks",
    "supplement_evidence",
    "decide_risk",
    "generate_contract_review_pack",
    "download_artifacts",
    "reopen_audit",
}


def load_payload(path: Path = DEFAULT_CASES) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    payload = load_payload(path)
    cases = payload.get("cases")
    if not isinstance(cases, list):
        raise ValueError("W08 golden case file must contain a cases list")
    return cases


def _require(condition: bool, reason: str, failures: list[str]) -> None:
    if not condition:
        failures.append(reason)


def validate_case(case: dict[str, Any]) -> dict[str, Any]:
    failures: list[str] = []

    _require(bool(case.get("case_id")), "missing case_id", failures)
    _require(
        case.get("redaction") == "synthetic_no_customer_secret",
        "golden contract must be synthetic or redacted",
        failures,
    )
    _require(case.get("contract_language") == "zh-CN", "contract language must be zh-CN", failures)
    _require(
        case.get("contract_type") in {"procurement", "sales", "service"},
        "contract type must be manufacturing/B2B supported",
        failures,
    )

    upload = case.get("upload") or {}
    _require(upload.get("surface") == "/shangshufang", "upload surface must be /shangshufang", failures)
    _require(upload.get("source_label") == "LIVE", "upload source label must be LIVE", failures)
    _require(
        len(str(upload.get("text_digest", ""))) == 64,
        "upload text digest must be sha256",
        failures,
    )

    mission = case.get("mission_contract") or {}
    _require(mission.get("required") is True, "MissionContract is required", failures)
    _require(mission.get("jurisdiction") == "CN_MAINLAND", "jurisdiction must be CN_MAINLAND", failures)
    _require(mission.get("legal_question") == "contract_risk_screening", "legal question must be contract_risk_screening", failures)

    evidence = case.get("evidence_packet") or {}
    _require(evidence.get("required") is True, "EvidencePacket is required", failures)
    _require(evidence.get("requires_original_anchor") is True, "EvidencePacket must require original anchors", failures)

    risks = case.get("expected_risks") or []
    _require(len(risks) >= 1, "at least one expected risk is required", failures)
    risk_families = {str(risk.get("risk_family")) for risk in risks}
    _require(bool({"payment", "delivery", "acceptance", "liability"} & risk_families), "expected risks must cover manufacturing/B2B clauses", failures)

    review_pack = case.get("contract_review_pack") or {}
    artifact_kinds = set(review_pack.get("artifact_kinds") or [])
    _require(
        REQUIRED_ARTIFACT_KINDS.issubset(artifact_kinds),
        "ContractReviewPack must require PDF, DOCX, and JSON artifacts",
        failures,
    )
    lineage_fields = set(review_pack.get("lineage_fields") or [])
    _require(
        REQUIRED_LINEAGE_FIELDS.issubset(lineage_fields),
        "ContractReviewPack lineage must bind mission, evidence, risk, final, manifest, and archive",
        failures,
    )

    browser_flow = case.get("browser_flow") or {}
    _require(browser_flow.get("backend") == "real", "browser flow must use real backend", failures)
    _require(browser_flow.get("mocking") == "forbidden", "browser flow must forbid mocks", failures)
    _require(
        {"/shangshufang", "/shiguan"}.issubset(set(browser_flow.get("frontend_surfaces") or [])),
        "browser flow must use /shangshufang and /shiguan",
        failures,
    )
    _require(
        REQUIRED_BROWSER_STEPS.issubset(set(browser_flow.get("canonical_steps") or [])),
        "browser flow must cover upload, parse, review, supplement, decide, delivery, download, and replay",
        failures,
    )

    download = case.get("download") or {}
    _require(download.get("authorized") is True, "download must be authorized", failures)
    _require(download.get("requires_artifact_hashes") is True, "download must require artifact hashes", failures)
    _require(download.get("requires_expiry") is True, "download must require expiry", failures)

    replay = case.get("audit_replay") or {}
    _require(replay.get("surface") == "/shiguan", "audit replay surface must be /shiguan", failures)
    _require(replay.get("same_lineage_required") is True, "audit replay must require same lineage", failures)
    _require(replay.get("read_only") is True, "audit replay must be read-only", failures)

    return {
        "case_id": case.get("case_id", ""),
        "passed": not failures,
        "failures": failures,
    }


def validate_payload(payload: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    _require(payload.get("mode") == "RUNNABLE_MINIMUM", "mode must be RUNNABLE_MINIMUM", failures)
    targets = payload.get("targets") or {}
    _require(targets.get("golden_contracts_final") == 36, "final W08 target must be 36 golden contracts", failures)
    _require(targets.get("real_backend_browser_runs_final") == 10, "final W08 target must be 10 browser runs", failures)
    _require(targets.get("non_developer_users_final") == 5, "final W08 target must be five non-developer users", failures)
    _require(targets.get("non_developer_users_success_minimum") == 4, "final W08 target must require four user successes", failures)
    return failures


def run(path: Path = DEFAULT_CASES) -> dict[str, Any]:
    payload = load_payload(path)
    cases = payload.get("cases") or []
    records = [validate_case(case) for case in cases]
    payload_failures = validate_payload(payload)
    passed = not payload_failures and bool(records) and all(record["passed"] for record in records)
    return {
        "harness": "chaotang_product_acceptance",
        "mode": payload.get("mode"),
        "targets": payload.get("targets"),
        "cases": len(records),
        "passed": passed,
        "failures": payload_failures,
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate W08 product acceptance golden contracts")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    args = parser.parse_args()
    result = run(args.cases)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
