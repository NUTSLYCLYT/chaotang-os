from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RULES = ROOT / "rules.yaml"
DEFAULT_CASES = ROOT / "golden_cases" / "global_gate_cases.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
DEFAULT_LEDGER = ROOT / "artifacts" / "ledger.jsonl"

RISK_ORDER = {"green": 0, "yellow": 1, "red": 2, "black": 3}
DECISION_BY_RISK = {
    "green": "allow",
    "yellow": "allow_with_conditions",
    "red": "block",
    "black": "block_and_escalate",
}


@dataclass(frozen=True)
class Finding:
    rule_id: str
    risk_level: str
    reason: str
    condition: str
    next_gate: str


@dataclass(frozen=True)
class DecisionCard:
    run_id: str
    department: str
    output_type: str
    risk_level: str
    benefit_score: float
    evidence_score: float
    automation_level: str
    decision: str
    conditions: list[str]
    findings: list[dict[str, str]]
    red_team_required: bool
    archive_to_shiguan: bool
    next_gate: str
    generated_at: str


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def load_rules(path: Path = DEFAULT_RULES) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def text_of(payload: dict[str, Any]) -> str:
    parts = [
        str(payload.get("summary", "")),
        str(payload.get("output", "")),
        " ".join(str(path) for path in payload.get("changed_paths", [])),
    ]
    return "\n".join(parts)


def evidence_score(payload: dict[str, Any]) -> float:
    evidence = payload.get("evidence", [])
    if not evidence:
        return 0.0
    score = min(5.0, 1.5 + len(evidence))
    if all(item.get("source") for item in evidence if isinstance(item, dict)):
        score += 1.0
    if all(item.get("status") for item in evidence if isinstance(item, dict)):
        score += 0.5
    return round(min(5.0, score), 2)


def highest_risk(levels: list[str]) -> str:
    if not levels:
        return "green"
    return max(levels, key=lambda level: RISK_ORDER[level])


def automation_value(level: str) -> int:
    match = re.fullmatch(r"L([0-5])", str(level or "L0"))
    return int(match.group(1)) if match else 0


def contains_any(text: str, terms: list[str]) -> bool:
    return any(term and term in text for term in terms)


def has_number_claim(text: str, rules: dict[str, Any]) -> bool:
    if re.search(r"\d+(?:\.\d+)?\s*(元|万|亿|%|MWh|GWh|分钟|小时|天|个月)", text):
        return True
    return contains_any(text, rules.get("number_claim_terms", []))


def evaluate_dependency_security(payload: dict[str, Any], rules: dict[str, Any]) -> list[Finding]:
    if payload.get("output_type") != "dependency_security":
        return []
    config = rules["risk_rules"]["dependency_security"]
    status = payload.get("security_status")
    summary = payload.get("finding_summary", {}) or {}
    max_severity = float(summary.get("max_severity", 0) or 0)
    findings: list[Finding] = []
    if max_severity >= float(config["max_severity_black"]):
        findings.append(
            Finding(
                "dependency_security.max_severity_black",
                "black",
                f"依赖扫描最高严重度 {max_severity} 超过 black 阈值。",
                "修复高危依赖并重新运行 OSV。",
                "osv_scan",
            )
        )
    elif max_severity >= float(config["max_severity_red"]):
        findings.append(
            Finding(
                "dependency_security.max_severity_red",
                "red",
                f"依赖扫描最高严重度 {max_severity} 超过 red 阈值。",
                "修复依赖或形成风险豁免。",
                "osv_scan",
            )
        )
    if status in config["red_statuses"]:
        findings.append(
            Finding(
                "dependency_security.red_status",
                "red",
                f"依赖安全状态为 {status}。",
                "安全 POC 必须通过或有御史豁免。",
                "security_poc",
            )
        )
    if status in config["yellow_statuses"]:
        findings.append(
            Finding(
                "dependency_security.yellow_status",
                "yellow",
                f"依赖安全状态为 {status}。",
                "补齐只读凭证或安装证据后复跑。",
                "security_poc",
            )
        )
    return findings


def evaluate_customer_commitment(payload: dict[str, Any], rules: dict[str, Any]) -> list[Finding]:
    text = text_of(payload)
    if not contains_any(text, ["客户承诺", "报价", "合同", "交付"]):
        return []
    if payload.get("human_signoff"):
        return []
    return [
        Finding(
            "customer_commitment.no_human_signoff",
            "red",
            "客户承诺、报价、合同或交付内容缺少人工签字。",
            "补人工签字、证据来源和适用边界。",
            "human_signoff",
        )
    ]


def evaluate_automation(payload: dict[str, Any], rules: dict[str, Any]) -> list[Finding]:
    requested = str(payload.get("automation_level_requested", "L0"))
    threshold = rules["risk_rules"]["automation"]["black_without_qintianjian_at_or_above"]
    if automation_value(requested) < automation_value(threshold):
        return []
    if payload.get("qintianjian_brief") and payload.get("human_signoff"):
        return []
    return [
        Finding(
            "automation.missing_qintianjian_or_signoff",
            "black",
            f"{requested} 自动化缺少钦天监简报或人工签字。",
            "补钦天监简报、人工签字和回滚方案。",
            "qintianjian_brief",
        )
    ]


def evaluate_experience_drift(payload: dict[str, Any], rules: dict[str, Any]) -> list[Finding]:
    text = text_of(payload)
    if not contains_any(text, rules.get("experience_drift_terms", [])):
        return []
    return [
        Finding(
            "mainline.experience_drift",
            "red",
            "输出包含跨工程线体验实现信号，可能偏离后端运行主线。",
            "迁往根级清单指定的体验实现归属，或形成钦天监纠偏说明。",
            "yushi_drift_monitor",
        )
    ]


def evaluate_ungrounded_numbers(payload: dict[str, Any], rules: dict[str, Any]) -> list[Finding]:
    text = text_of(payload)
    if not has_number_claim(text, rules):
        return []
    if payload.get("evidence"):
        return []
    high_stakes = contains_any(text, rules.get("high_stakes_terms", []))
    return [
        Finding(
            "output.ungrounded_numbers",
            "red" if high_stakes else "yellow",
            "输出包含数字、报价、收益或成本声明，但没有证据。",
            "补来源、时间戳、计算过程和不确定性说明。",
            "evidence_check",
        )
    ]


def evaluate_payload(payload: dict[str, Any], rules: dict[str, Any] | None = None) -> DecisionCard:
    rules = rules or load_rules()
    findings = []
    findings.extend(evaluate_dependency_security(payload, rules))
    findings.extend(evaluate_customer_commitment(payload, rules))
    findings.extend(evaluate_automation(payload, rules))
    findings.extend(evaluate_experience_drift(payload, rules))
    findings.extend(evaluate_ungrounded_numbers(payload, rules))

    risk_level = highest_risk([finding.risk_level for finding in findings])
    conditions = [finding.condition for finding in findings]
    next_gate = findings[0].next_gate if findings else "shiguan_archive"
    return DecisionCard(
        run_id=str(payload.get("run_id", "manual")),
        department=str(payload.get("department", "unknown")),
        output_type=str(payload.get("output_type", "unknown")),
        risk_level=risk_level,
        benefit_score=round(float(payload.get("benefit_score", 0) or 0), 2),
        evidence_score=evidence_score(payload),
        automation_level=str(payload.get("automation_level_requested", "L0")),
        decision=DECISION_BY_RISK[risk_level],
        conditions=conditions,
        findings=[asdict(finding) for finding in findings],
        red_team_required=risk_level == "black",
        archive_to_shiguan=True,
        next_gate=next_gate,
        generated_at=utc_now(),
    )


def build_report(cases: list[dict[str, Any]], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    rules = rules or load_rules()
    cards = []
    case_results = []
    for case in cases:
        payload = case.get("payload", case)
        card = evaluate_payload(payload, rules)
        cards.append(card)
        expected = case.get("expect")
        passed = True
        if expected:
            passed = all(getattr(card, key) == value for key, value in expected.items())
        case_results.append({"case_id": case.get("case_id", payload.get("run_id", "manual")), "passed": passed, "card": asdict(card)})
    return {
        "generated_at": utc_now(),
        "harness": "yushi_global_gate",
        "summary": {
            level: sum(1 for card in cards if card.risk_level == level)
            for level in ["green", "yellow", "red", "black"]
        },
        "passed": all(result["passed"] for result in case_results),
        "results": case_results,
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 御史总判报告",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- harness: `{report['harness']}`",
        f"- passed: `{report['passed']}`",
        "",
        "## Summary",
        "",
    ]
    for level, count in report["summary"].items():
        lines.append(f"- `{level}`: {count}")
    lines.extend(["", "## Decisions", "", "| Case | Risk | Decision | Next gate |", "|---|---:|---|---|"])
    for result in report["results"]:
        card = result["card"]
        lines.append(f"| `{result['case_id']}` | `{card['risk_level']}` | `{card['decision']}` | {card['next_gate']} |")
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
            handle.write(json.dumps(result["card"], ensure_ascii=False) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Yushi global risk/benefit/evidence gate.")
    parser.add_argument("--rules", type=Path, default=DEFAULT_RULES)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--input-json", type=Path, default=None)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--no-ledger", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rules = load_rules(args.rules)
    if args.input_json:
        cases = [{"case_id": args.input_json.stem, "payload": json.loads(args.input_json.read_text(encoding="utf-8"))}]
    else:
        cases = load_cases(args.cases)
    report = build_report(cases, rules)
    write_report(report, args.json_out, args.md_out)
    if not args.no_ledger:
        append_ledger(report, args.ledger)
    print(f"yushi_global_gate complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
