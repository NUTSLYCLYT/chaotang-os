#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = ROOT / "business_model.yaml"
DEFAULT_CASES = ROOT / "golden_cases" / "business_model_cases.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
DEFAULT_LEDGER = ROOT / "artifacts" / "ledger.jsonl"


@dataclass(frozen=True)
class BusinessModelResult:
    case_id: str
    segment: str
    purchase_decision: str
    delight_decision: str
    investor_ready: bool
    cash_flow_score: int
    reasons: list[str]
    passed: bool


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def load_model(path: Path = DEFAULT_MODEL) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate_purchase(payload: dict[str, Any], model: dict[str, Any]) -> tuple[str, list[str]]:
    purchase = payload.get("purchase") or {}
    capability = str(purchase.get("capability", ""))
    currency = str(purchase.get("currency", ""))
    amount = float(purchase.get("amount", 0) or 0)
    reasons: list[str] = []

    if capability in set(model["forbidden_monetization"]):
        return "block", ["forbidden_monetization_preserves_trust"]
    if capability not in model["paid_capabilities"]:
        return "block", ["capability_not_allowlisted"]
    if currency != "chaobi":
        return "block", ["paid_capabilities_require_chaobi"]
    if amount <= 0:
        return "block", ["invalid_amount"]
    expected = float(model["paid_capabilities"][capability]["chaobi_cost"])
    if amount < expected:
        reasons.append("amount_below_configured_cost")
        return "block", reasons
    return "allow", ["paid_value_maps_to_capability"]


def evaluate_delight(payload: dict[str, Any], model: dict[str, Any]) -> tuple[str, list[str]]:
    report = payload.get("battle_report") or {}
    rules = model["delight_rules"]
    reasons: list[str] = []
    if not report.get("visible_feedback"):
        reasons.append("missing_visible_feedback")
    if rules["must_include_next_action"] and not report.get("next_action"):
        reasons.append("missing_next_action")
    if rules["must_show_value_metric"] and not report.get("value_metric"):
        reasons.append("missing_value_metric")
    if report.get("trigger") in set(rules["forbidden_triggers"]):
        reasons.append("dark_pattern_trigger")
    return ("pass" if not reasons else "fail"), reasons


def investor_ready(model: dict[str, Any]) -> tuple[bool, list[str]]:
    story = model["investor_story"]
    missing: list[str] = []
    if not story.get("headline"):
        missing.append("headline")
    if len(story.get("must_have_sections", [])) < 8:
        missing.append("must_have_sections")
    if len(story.get("proof_metrics", [])) < 6:
        missing.append("proof_metrics")
    for key in ["free", "pro", "max", "ultra", "team", "business", "enterprise"]:
        if key not in model["segments"]:
            missing.append(f"segment:{key}")
    return not missing, missing


def cash_flow_score(model: dict[str, Any]) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    segments = model["segments"]
    if any(segment.get("monthly_cny", 0) > 0 for segment in segments.values()):
        score += 25
    if "enterprise" in segments and segments["enterprise"].get("annual_cny", 0) >= 100000:
        score += 25
    if model.get("chaobi_packs"):
        score += 20
    if len(model.get("paid_capabilities", {})) >= 6:
        score += 15
    if model.get("cash_flow_targets", {}).get("month_12", {}).get("target_mrr_cny", 0) >= 500000:
        score += 15
    if score < 70:
        reasons.append("cash_flow_model_too_weak")
    return score, reasons


def evaluate_case(case: dict[str, Any], model: dict[str, Any] | None = None) -> BusinessModelResult:
    model = model or load_model()
    payload = case.get("payload", case)
    purchase_decision, purchase_reasons = evaluate_purchase(payload, model)
    delight_decision, delight_reasons = evaluate_delight(payload, model)
    ready, investor_reasons = investor_ready(model)
    cash_score, cash_reasons = cash_flow_score(model)

    expected = case.get("expect", {})
    checks = {
        "purchase": purchase_decision,
        "delight": delight_decision,
        "investor_ready": ready,
    }
    passed = all(checks.get(key) == value for key, value in expected.items())
    return BusinessModelResult(
        case_id=str(case.get("case_id", payload.get("run_id", "manual"))),
        segment=str(payload.get("segment", "unknown")),
        purchase_decision=purchase_decision,
        delight_decision=delight_decision,
        investor_ready=ready,
        cash_flow_score=cash_score,
        reasons=purchase_reasons + delight_reasons + investor_reasons + cash_reasons,
        passed=passed,
    )


def build_report(cases: list[dict[str, Any]], model: dict[str, Any] | None = None) -> dict[str, Any]:
    model = model or load_model()
    results = [evaluate_case(case, model) for case in cases]
    ready, investor_reasons = investor_ready(model)
    cash_score, cash_reasons = cash_flow_score(model)
    return {
        "generated_at": utc_now(),
        "harness": "chaotang_business_model",
        "passed": all(result.passed for result in results) and ready and cash_score >= 70,
        "summary": {
            "cases": len(results),
            "passed": sum(1 for result in results if result.passed),
            "blocked_purchases": sum(1 for result in results if result.purchase_decision == "block"),
            "cash_flow_score": cash_score,
            "investor_ready": ready,
        },
        "investor_headline": model["investor_story"]["headline"],
        "pricing_ladder": model["segments"],
        "cash_flow_targets": model["cash_flow_targets"],
        "latest_references": model["market_context"]["references"],
        "findings": investor_reasons + cash_reasons,
        "results": [asdict(result) for result in results],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 朝堂商业模式圆桌报告",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- harness: `{report['harness']}`",
        f"- passed: `{report['passed']}`",
        f"- cash_flow_score: `{report['summary']['cash_flow_score']}`",
        "",
        "## 投资人一句话",
        "",
        report["investor_headline"],
        "",
        "## Pricing Ladder",
        "",
        "| Segment | Price | Included Chaobi | Value |",
        "|---|---:|---:|---|",
    ]
    for key, segment in report["pricing_ladder"].items():
        price = segment.get("monthly_cny")
        if price is None:
            price = f"{segment.get('annual_cny')}/year"
        included = segment.get("included_chaobi", 0)
        lines.append(f"| `{key}` | `{price}` | `{included}` | {segment.get('value', '')} |")
    lines.extend(["", "## Golden Case Results", "", "| Case | Purchase | Delight | Investor |", "|---|---|---|---|"])
    for result in report["results"]:
        lines.append(
            f"| `{result['case_id']}` | `{result['purchase_decision']}` | "
            f"`{result['delight_decision']}` | `{result['investor_ready']}` |"
        )
    lines.extend(["", "## Latest References", ""])
    for ref in report["latest_references"]:
        lines.append(f"- [{ref['name']}]({ref['url']}): {ref['note']}")
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
    parser = argparse.ArgumentParser(description="Run Chaotang business model validation.")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--no-ledger", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(load_cases(args.cases), load_model(args.model))
    write_report(report, args.json_out, args.md_out)
    if not args.no_ledger:
        append_ledger(report, args.ledger)
    print(f"chaotang_business_model complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
