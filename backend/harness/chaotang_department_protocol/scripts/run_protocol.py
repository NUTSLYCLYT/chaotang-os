from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.chaotang_department_router import route_department_task

DEFAULT_DEPARTMENTS = ROOT / "departments.yaml"
DEFAULT_CASES = ROOT / "golden_cases" / "department_outputs.json"
DEFAULT_ROUTE_CASES = ROOT / "golden_cases" / "department_routes.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
DEFAULT_LEDGER = ROOT / "artifacts" / "ledger.jsonl"
YUSHI_GATE = PROJECT_ROOT / "harness" / "yushi_global_gate" / "scripts" / "run_gate.py"
PRIME_MINISTER_REQUIRED = {"owner", "route", "due", "blocker"}
QINTIANJIAN_REQUIRED = {"signal", "threshold", "watch_window", "decision_change"}
SIX_MINISTRY_GENIUS_REQUIRED = {"advisor_lenses", "genius_design", "function_upgrades", "harness_gate"}


@dataclass(frozen=True)
class ProtocolResult:
    case_id: str
    valid: bool
    missing_fields: list[str]
    department: str
    output_type: str
    risk_level: str | None
    decision: str | None
    next_department: str | None
    next_action: str
    yushi_card: dict[str, Any] | None
    passed: bool


@dataclass(frozen=True)
class RouteResult:
    case_id: str
    task: str
    primary_department: str
    expected_primary_department: str
    candidate_departments: list[str]
    expected_candidate_departments: list[str]
    required_swarms: list[str]
    missing_swarms: list[str]
    has_prime_minister_step: bool
    has_qintianjian_trigger: bool
    passed: bool


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def load_config(path: Path = DEFAULT_DEPARTMENTS) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_route_cases(path: Path = DEFAULT_ROUTE_CASES) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def load_yushi_gate():
    spec = importlib.util.spec_from_file_location("yushi_global_gate_runner", YUSHI_GATE)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot load yushi global gate")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def validate_payload(payload: dict[str, Any], config: dict[str, Any]) -> list[str]:
    missing = [field for field in config["contract_required_fields"] if field not in payload]
    department = payload.get("department")
    if department and department not in config["departments"]:
        missing.append("known_department")
    prime_step = payload.get("prime_minister_next_step")
    if isinstance(prime_step, dict):
        for field in sorted(PRIME_MINISTER_REQUIRED - set(prime_step)):
            missing.append(f"prime_minister_next_step.{field}")
    elif "prime_minister_next_step" in payload:
        missing.append("prime_minister_next_step.shape")
    trigger = payload.get("qintianjian_trigger")
    if isinstance(trigger, dict):
        for field in sorted(QINTIANJIAN_REQUIRED - set(trigger)):
            missing.append(f"qintianjian_trigger.{field}")
    elif "qintianjian_trigger" in payload:
        missing.append("qintianjian_trigger.shape")
    return missing


def route_next_department(payload: dict[str, Any], risk_level: str, config: dict[str, Any]) -> str:
    department = payload.get("department")
    matrix = config["departments"].get(department, {}).get("next", {})
    route = matrix.get(risk_level, "yushi")
    if route == "source_department":
        return str(department)
    return str(route)


def validate_six_ministry_genius_design(config: dict[str, Any]) -> dict[str, list[str]]:
    issues: dict[str, list[str]] = {}
    for ministry, spec in config.get("six_ministries", {}).items():
        missing = [field for field in sorted(SIX_MINISTRY_GENIUS_REQUIRED) if not spec.get(field)]
        if len(spec.get("advisor_lenses", [])) < 2:
            missing.append("advisor_lenses.min_2")
        if missing:
            issues[ministry] = missing
    return issues


def evaluate_case(case: dict[str, Any], config: dict[str, Any], yushi_gate: Any | None = None) -> ProtocolResult:
    yushi_gate = yushi_gate or load_yushi_gate()
    payload = case.get("payload", case)
    case_id = str(case.get("case_id", payload.get("run_id", "manual")))
    missing = validate_payload(payload, config)
    if missing:
        expected = case.get("expect", {})
        passed = expected.get("valid") is False
        return ProtocolResult(
            case_id=case_id,
            valid=False,
            missing_fields=missing,
            department=str(payload.get("department", "unknown")),
            output_type=str(payload.get("output_type", "unknown")),
            risk_level=None,
            decision=None,
            next_department=None,
            next_action=str(payload.get("next_action", "")),
            yushi_card=None,
            passed=passed,
        )

    card = yushi_gate.evaluate_payload(payload)
    next_department = route_next_department(payload, card.risk_level, config)
    expected = case.get("expect", {})
    passed = True
    if expected:
        checks = {
            "valid": True,
            "risk_level": card.risk_level,
            "decision": card.decision,
            "next_department": next_department,
        }
        passed = all(checks.get(key) == value for key, value in expected.items())
    return ProtocolResult(
        case_id=case_id,
        valid=True,
        missing_fields=[],
        department=str(payload["department"]),
        output_type=str(payload["output_type"]),
        risk_level=card.risk_level,
        decision=card.decision,
        next_department=next_department,
        next_action=str(payload["next_action"]),
        yushi_card=asdict(card),
        passed=passed,
    )


def evaluate_route_case(case: dict[str, Any], config: dict[str, Any]) -> RouteResult:
    result = route_department_task(str(case["task"]), config)
    expected = case.get("expect", {})
    primary_department = result["primaryDepartment"]["code"]
    expected_primary = str(expected.get("primary_department", ""))
    candidate_departments = [item["code"] for item in result["candidateDepartments"]]
    expected_candidates = list(expected.get("candidate_departments", []))
    required_swarms = list(expected.get("required_swarms", []))
    primary_swarms = set(result["primaryDepartment"].get("callsSwarms", []))
    missing_swarms = [swarm for swarm in required_swarms if swarm not in primary_swarms]
    has_prime = all(
        result.get("primeMinisterNextStep", {}).get(field)
        for field in ("owner", "route", "due", "blocker")
    )
    has_qintianjian = all(
        result.get("qintianjianTrigger", {}).get(field)
        for field in ("signal", "threshold", "watch_window", "decision_change")
    )
    passed = (
        primary_department == expected_primary
        and set(expected_candidates).issubset(set(candidate_departments))
        and not missing_swarms
        and has_prime
        and has_qintianjian
    )
    return RouteResult(
        case_id=str(case.get("case_id", "manual")),
        task=str(case["task"]),
        primary_department=primary_department,
        expected_primary_department=expected_primary,
        candidate_departments=candidate_departments,
        expected_candidate_departments=expected_candidates,
        required_swarms=required_swarms,
        missing_swarms=missing_swarms,
        has_prime_minister_step=has_prime,
        has_qintianjian_trigger=has_qintianjian,
        passed=passed,
    )


def build_report(
    cases: list[dict[str, Any]],
    config: dict[str, Any] | None = None,
    route_cases: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    config = config or load_config()
    yushi_gate = load_yushi_gate()
    results = [evaluate_case(case, config, yushi_gate) for case in cases]
    route_cases = route_cases if route_cases is not None else load_route_cases()
    route_results = [evaluate_route_case(case, config) for case in route_cases]
    genius_issues = validate_six_ministry_genius_design(config)
    return {
        "generated_at": utc_now(),
        "harness": "chaotang_department_protocol",
        "passed": all(result.passed for result in results) and all(result.passed for result in route_results),
        "summary": {
            "valid": sum(1 for result in results if result.valid),
            "invalid": sum(1 for result in results if not result.valid),
            "global_next_step_ready": sum(
                1
                for case in cases
                if not validate_payload(case.get("payload", case), config)
                and case.get("payload", case).get("prime_minister_next_step")
                and case.get("payload", case).get("qintianjian_trigger")
            ),
            "six_ministries_genius_ready": len(config.get("six_ministries", {})) - len(genius_issues),
            "route_cases": len(route_results),
            "route_cases_passed": sum(1 for result in route_results if result.passed),
            "green": sum(1 for result in results if result.risk_level == "green"),
            "yellow": sum(1 for result in results if result.risk_level == "yellow"),
            "red": sum(1 for result in results if result.risk_level == "red"),
            "black": sum(1 for result in results if result.risk_level == "black"),
        },
        "six_ministries_genius_issues": genius_issues,
        "results": [asdict(result) for result in results],
        "route_results": [asdict(result) for result in route_results],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 朝堂部门协同协议报告",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- harness: `{report['harness']}`",
        f"- passed: `{report['passed']}`",
        "",
        "## Summary",
        "",
    ]
    for key, value in report["summary"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Routes", "", "| Case | Department | Risk | Decision | Next |", "|---|---|---:|---|---|"])
    for result in report["results"]:
        lines.append(
            f"| `{result['case_id']}` | `{result['department']}` | "
            f"`{result['risk_level'] or 'invalid'}` | `{result['decision'] or '-'}` | {result['next_department'] or '-'} |"
        )
    lines.extend(["", "## Department Route Cases", "", "| Case | Primary | Passed |", "|---|---|---:|"])
    for result in report.get("route_results", []):
        lines.append(
            f"| `{result['case_id']}` | `{result['primary_department']}` | `{result['passed']}` |"
        )
    lines.append("")
    return "\n".join(lines)


def write_report(report: dict[str, Any], json_out: Path = DEFAULT_JSON_OUT, md_out: Path = DEFAULT_MD_OUT) -> None:
    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_out.write_text(render_markdown(report), encoding="utf-8")


def append_ledger(report: dict[str, Any], ledger: Path = DEFAULT_LEDGER) -> None:
    ledger.parent.mkdir(parents=True, exist_ok=True)
    with ledger.open("a", encoding="utf-8") as handle:
        for result in report["results"]:
            handle.write(json.dumps(result, ensure_ascii=False) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Chaotang department protocol validation and routing.")
    parser.add_argument("--config", type=Path, default=DEFAULT_DEPARTMENTS)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--route-cases", type=Path, default=DEFAULT_ROUTE_CASES)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--no-ledger", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(load_cases(args.cases), load_config(args.config), load_route_cases(args.route_cases))
    write_report(report, args.json_out, args.md_out)
    if not args.no_ledger:
        append_ledger(report, args.ledger)
    print(f"chaotang_department_protocol complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
