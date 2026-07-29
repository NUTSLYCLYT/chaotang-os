from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path
from typing import Any


HARNESS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[5]
DEFAULT_CASES = HARNESS_ROOT / "golden_cases" / "w08_contracts.json"
DEFAULT_USER_ACCEPTANCE_RECORDS_DIR = HARNESS_ROOT / "user_acceptance" / "records"
BROWSER_FLOW_EVIDENCE = [
    ("feat-r0-w08-browser-flow-batch1-20260728", 1),
    ("feat-r0-w08-browser-flow-batch2-20260728", 3),
    ("feat-r0-w08-browser-flow-batch3-20260728", 3),
    ("feat-r0-w08-browser-flow-batch4-20260728", 3),
]
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
REQUIRED_USER_STEPS = {
    "upload_contract",
    "parse_mission_contract",
    "review_risks",
    "supplement_evidence",
    "decide_risk",
    "generate_contract_review_pack",
    "download_artifacts",
    "reopen_shiguan_audit",
}
REQUIRED_USER_SURFACES = {"/shangshufang", "/shiguan"}
MANUFACTURING_B2B_RISK_FAMILIES = {
    "acceptance",
    "compliance",
    "confidentiality",
    "delivery",
    "dispute",
    "ip",
    "liability",
    "payment",
    "termination",
    "warranty",
}
USER_ACCEPTANCE_SCHEMA_VERSION = "w08-user-acceptance.v1"
USER_ACCEPTANCE_MODE = "FINAL_USER_ACCEPTANCE"
USER_ACCEPTANCE_TARGET = 5
USER_ACCEPTANCE_SUCCESS_MINIMUM = 4
FIRST_VALUE_SECONDS_TARGET = 180
FIXTURE_PREFIX = "fixture-"
TASK_PROMPT_REF = "participant_task_card.zh-CN.md"
UTC_ISO8601_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def coverage_for(cases: list[dict[str, Any]]) -> dict[str, Any]:
    case_ids = [str(case.get("case_id") or "") for case in cases]
    categories = sorted({str(case.get("category") or "") for case in cases})
    risk_families = sorted({
        str(risk.get("risk_family") or "")
        for case in cases
        for risk in (case.get("expected_risks") or [])
    })
    return {
        "case_ids_unique": len(case_ids) == len(set(case_ids)),
        "categories": categories,
        "risk_families": risk_families,
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
    _require(bool(MANUFACTURING_B2B_RISK_FAMILIES & risk_families), "expected risks must cover manufacturing/B2B clauses", failures)

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
    cases = payload.get("cases") or []
    coverage = coverage_for(cases)
    _require(coverage["case_ids_unique"] is True, "case_id values must be unique", failures)
    return failures


def _looks_like_fixture_value(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(FIXTURE_PREFIX)


def _validate_user_record(record: dict[str, Any], *, allow_fixture: bool = False) -> list[str]:
    failures: list[str] = []
    participant_id = str(record.get("participant_id") or "<missing participant_id>")
    if not allow_fixture:
        _require(not _looks_like_fixture_value(participant_id), f"{participant_id} participant_id cannot use fixture prefix", failures)
    _require(record.get("target_profile") == "manufacturing_contract_operator", f"{participant_id} target_profile must be manufacturing_contract_operator", failures)
    _require(record.get("involved_in_development") is False, f"{participant_id} must not be involved in development", failures)
    _require(
        record.get("unassisted") is True and record.get("engineer_guidance") is False,
        f"{participant_id} must complete without engineer guidance",
        failures,
    )
    _require(record.get("feedback_deidentified") is True, f"{participant_id} feedback must be deidentified", failures)
    _require(
        set(record.get("surfaces_used") or []) == REQUIRED_USER_SURFACES,
        f"{participant_id} surfaces_used must be exactly /shangshufang and /shiguan",
        failures,
    )

    if record.get("completion_success") is True:
        steps = set(record.get("completed_steps") or [])
        _require(
            REQUIRED_USER_STEPS.issubset(steps),
            f"{participant_id} must complete upload, parse, review, supplement, decide, delivery, download, and replay",
            failures,
        )
        first_value_seconds = record.get("first_value_seconds")
        _require(
            isinstance(first_value_seconds, (int, float)) and first_value_seconds > 0,
            f"{participant_id} first_value_seconds must be positive",
            failures,
        )
        evidence = record.get("evidence") or {}
        for field in (
            "contract_review_pack_id",
            "artifact_manifest_id",
            "archive_receipt_id",
            "browser_evidence_ref",
        ):
            _require(bool(evidence.get(field)), f"{participant_id} evidence must include {field}", failures)
            if not allow_fixture:
                _require(
                    not _looks_like_fixture_value(evidence.get(field)),
                    f"{participant_id} evidence {field} cannot use fixture prefix",
                    failures,
                )

    return failures


def validate_user_acceptance_payload(payload: dict[str, Any], *, allow_fixture: bool = False) -> dict[str, Any]:
    failures: list[str] = []
    _require(payload.get("schemaVersion") == USER_ACCEPTANCE_SCHEMA_VERSION, f"schemaVersion must be {USER_ACCEPTANCE_SCHEMA_VERSION}", failures)
    _require(payload.get("mode") == USER_ACCEPTANCE_MODE, f"mode must be {USER_ACCEPTANCE_MODE}", failures)
    _require(payload.get("task_prompt_ref") == TASK_PROMPT_REF, f"task_prompt_ref must be {TASK_PROMPT_REF}", failures)
    if not allow_fixture:
        _require(payload.get("fixture") is not True, "fixture payload cannot be final user acceptance evidence", failures)

    records = payload.get("records") or []
    _require(isinstance(records, list), "records must be a list", failures)
    if not isinstance(records, list):
        records = []
    _require(len(records) == USER_ACCEPTANCE_TARGET, "user acceptance requires five participant records", failures)

    participant_ids = [str(record.get("participant_id") or "") for record in records]
    _require(all(participant_ids), "every participant record requires participant_id", failures)
    _require(len(participant_ids) == len(set(participant_ids)), "participant_id values must be unique", failures)

    record_failures = [
        failure
        for record in records
        for failure in _validate_user_record(record, allow_fixture=allow_fixture)
    ]
    failures.extend(record_failures)

    successes = [
        record
        for record in records
        if record.get("completion_success") is True and not _validate_user_record(record, allow_fixture=allow_fixture)
    ]
    _require(len(successes) >= USER_ACCEPTANCE_SUCCESS_MINIMUM, "user acceptance requires at least four successful completions", failures)

    first_value_seconds = [
        float(record["first_value_seconds"])
        for record in successes
        if isinstance(record.get("first_value_seconds"), (int, float))
    ]
    median_first_value = statistics.median(first_value_seconds) if first_value_seconds else None
    _require(
        median_first_value is not None and median_first_value <= FIRST_VALUE_SECONDS_TARGET,
        "successful users must reach median first value within 180 seconds",
        failures,
    )

    return {
        "harness": "chaotang_product_acceptance",
        "mode": payload.get("mode"),
        "records": len(records),
        "successes": len(successes),
        "median_first_value_seconds": median_first_value,
        "passed": not failures,
        "failures": failures,
    }


def run_user_acceptance(path: Path) -> dict[str, Any]:
    payload = load_payload(path)
    result = validate_user_acceptance_payload(payload)
    result["evidencePath"] = str(path)
    return result


def validate_closeout_approval(payload: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    approval = payload.get("approval") or {}
    _require(isinstance(approval, dict), "approval must be an object for W08 closeout", failures)
    if not isinstance(approval, dict):
        approval = {}
    _require(approval.get("status") == "APPROVED", "approval.status must be APPROVED for W08 closeout", failures)
    _require(bool(approval.get("owner")), "approval.owner is required for W08 closeout", failures)
    _require(bool(approval.get("approved_at")), "approval.approved_at is required for W08 closeout", failures)
    if approval.get("approved_at"):
        _require(
            isinstance(approval.get("approved_at"), str) and bool(UTC_ISO8601_PATTERN.match(approval["approved_at"])),
            "approval.approved_at must be a UTC ISO-8601 timestamp ending with Z",
            failures,
        )
    _require(bool(approval.get("evidence_review_id")), "approval.evidence_review_id is required for W08 closeout", failures)
    return failures


def run_closeout_user_acceptance(path: Path) -> dict[str, Any]:
    payload = load_payload(path)
    result = validate_user_acceptance_payload(payload)
    approval_failures = validate_closeout_approval(payload)
    result["failures"].extend(approval_failures)
    result["passed"] = result["passed"] and not approval_failures
    result["evidencePath"] = str(path)
    return result


def discover_user_acceptance_path(records_dir: Path = DEFAULT_USER_ACCEPTANCE_RECORDS_DIR) -> dict[str, Any]:
    if not records_dir.exists():
        return {
            "passed": False,
            "records": 0,
            "successes": 0,
            "failures": ["one approved user acceptance JSON file is required under records/"],
        }

    candidates = sorted(path for path in records_dir.glob("*.json") if path.is_file())
    if len(candidates) != 1:
        return {
            "passed": False,
            "records": 0,
            "successes": 0,
            "failures": ["records/ must contain exactly one approved user acceptance JSON file"],
            "candidatePaths": [str(path) for path in candidates],
        }

    return run_closeout_user_acceptance(candidates[0])


def validate_closeout_user_acceptance_path(path: Path, records_dir: Path = DEFAULT_USER_ACCEPTANCE_RECORDS_DIR) -> dict[str, Any]:
    try:
        path.resolve().relative_to(records_dir.resolve())
    except ValueError:
        return {
            "passed": False,
            "records": 0,
            "successes": 0,
            "failures": ["explicit user acceptance path must be inside records/"],
            "evidencePath": str(path),
        }
    return run_closeout_user_acceptance(path)


def validate_browser_flow_evidence(repo_root: Path = REPO_ROOT) -> dict[str, Any]:
    failures: list[str] = []
    records: list[dict[str, Any]] = []

    for change_id, expected_flows in BROWSER_FLOW_EVIDENCE:
        change_root = repo_root / ".harness" / "changes" / change_id
        summary_path = change_root / "summary.md"
        ci_path = change_root / "ci_result" / "ci_summary.md"
        if not summary_path.exists() or not ci_path.exists():
            failures.append(f"{change_id} evidence files are missing")
            records.append({"change_id": change_id, "flows": 0, "passed": False})
            continue

        summary = summary_path.read_text(encoding="utf-8")
        ci_summary = ci_path.read_text(encoding="utf-8")
        passed = (
            "VERIFIED_PARTIAL" in summary
            and "real backend browser flow" in summary
            and "Playwright" in ci_summary
            and "passed" in ci_summary
        )
        if not passed:
            failures.append(f"{change_id} does not contain verified browser flow evidence")
        records.append({"change_id": change_id, "flows": expected_flows if passed else 0, "passed": passed})

    flows = sum(record["flows"] for record in records)
    _require(flows == 10, "W08 closeout requires exactly 10 verified browser flows", failures)
    return {
        "passed": not failures,
        "flows": flows,
        "records": records,
        "failures": failures,
    }


def run_closeout_preflight(
    *,
    cases_path: Path = DEFAULT_CASES,
    user_acceptance_path: Path | None = None,
    records_dir: Path = DEFAULT_USER_ACCEPTANCE_RECORDS_DIR,
    repo_root: Path = REPO_ROOT,
) -> dict[str, Any]:
    golden = run(cases_path)
    browser = validate_browser_flow_evidence(repo_root)
    if user_acceptance_path is None:
        user = discover_user_acceptance_path(records_dir)
    else:
        user = validate_closeout_user_acceptance_path(user_acceptance_path, records_dir)

    gates = {
        "golden_contracts": {
            "passed": golden["passed"],
            "cases": golden["cases"],
            "failures": golden["failures"],
        },
        "browser_flows": browser,
        "user_acceptance": user,
    }
    failures = [
        failure
        for gate in gates.values()
        for failure in gate.get("failures", [])
    ]
    passed = all(gate["passed"] for gate in gates.values())
    return {
        "harness": "chaotang_product_acceptance",
        "mode": "W08_CLOSEOUT_PREFLIGHT",
        "decision": "READY_FOR_CLOSEOUT" if passed else "BLOCKED",
        "passed": passed,
        "gates": gates,
        "failures": failures,
        "nonGoals": [
            "production deployment",
            "database migration",
            "listener 3050 operation",
        ],
    }


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
        "coverage": coverage_for(cases),
        "passed": passed,
        "failures": payload_failures,
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate W08 product acceptance golden contracts")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--user-acceptance", type=Path)
    parser.add_argument("--closeout-preflight", action="store_true")
    args = parser.parse_args()
    if args.closeout_preflight:
        result = run_closeout_preflight(cases_path=args.cases, user_acceptance_path=args.user_acceptance)
    elif args.user_acceptance:
        result = run_user_acceptance(args.user_acceptance)
    else:
        result = run(args.cases)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
