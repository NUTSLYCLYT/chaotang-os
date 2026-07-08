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
PROJECT_ROOT = ROOT.parents[1]
DEFAULT_RULES = ROOT / "rules.yaml"
DEFAULT_CASES = ROOT / "golden_cases" / "merit_cases.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
DEFAULT_LEDGER = ROOT / "artifacts" / "ledger.jsonl"
DEFAULT_BUSINESS_MODEL = PROJECT_ROOT / "harness" / "chaotang_business_model" / "business_model.yaml"


@dataclass(frozen=True)
class EconomyDecision:
    decision: str
    item_type: str
    currency: str
    amount: float
    reason: str


@dataclass(frozen=True)
class MeritResult:
    case_id: str
    run_id: str
    department: str
    advisor_agent: str
    raw_score: float
    final_score: float
    grade: str
    user_title: str
    department_level: int
    department_title: str
    merit_awarded: dict[str, int]
    special_titles: list[str]
    unlocks: list[str]
    economy_decision: dict[str, Any] | None
    commercial_offer: dict[str, Any] | None
    yushi_verdict: str
    conditions: list[str]
    passed: bool


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def load_rules(path: Path = DEFAULT_RULES) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_business_model(path: Path = DEFAULT_BUSINESS_MODEL) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def score_payload(payload: dict[str, Any], rules: dict[str, Any]) -> float:
    dimensions = payload.get("score_dimensions", {})
    allowed = rules["score_dimensions"]
    score = 0.0
    for key, max_points in allowed.items():
        score += clamp(float(dimensions.get(key, 0)), 0, float(max_points))
    return round(clamp(score), 2)


def apply_yushi_controls(raw_score: float, payload: dict[str, Any], rules: dict[str, Any]) -> tuple[float, list[str]]:
    decision = str(payload.get("yushi_decision", "allow_with_conditions"))
    multiplier = float(rules["yushi_multipliers"].get(decision, 0.0))
    score = raw_score * multiplier
    conditions: list[str] = []

    if decision in {"block", "block_and_escalate"}:
        score = min(score, float(rules["yushi_score_caps"]["blocked"]))
        conditions.append("御史阻断：任务不能获得功业或称号推进。")
    if not payload.get("evidence"):
        score = min(score, float(rules["yushi_score_caps"]["missing_evidence"]))
        conditions.append("证据不足：最高只能进入待修/可行区间。")
    if payload.get("has_drift"):
        score = min(score, float(rules["yushi_score_caps"]["has_drift"]))
        conditions.append("发现偏移：必须先回主线。")
    if payload.get("automation_overreach"):
        score = min(score, float(rules["yushi_score_caps"]["automation_overreach"]))
        conditions.append("自动化越权：直接驳回。")
    return round(clamp(score), 2), conditions


def grade_for(score: float, rules: dict[str, Any]) -> str:
    for item in rules["grades"]:
        if score >= float(item["min_score"]):
            return str(item["grade"])
    return "御史驳回"


def coeff(payload: dict[str, Any], key: str, default: float = 1.0) -> float:
    return float((payload.get("value_coefficients") or {}).get(key, default))


def event_bonuses(payload: dict[str, Any], rules: dict[str, Any]) -> tuple[dict[str, int], list[str]]:
    events = set(payload.get("events", []))
    bonus = {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0}
    labels: list[str] = []
    for spec in rules["special_events"].values():
        if spec["condition"] not in events:
            continue
        labels.append(str(spec["label"]))
        for key, value in spec.get("merit_bonus", {}).items():
            bonus[key] = bonus.get(key, 0) + int(value)
    return bonus, labels


def calculate_merit(final_score: float, payload: dict[str, Any], rules: dict[str, Any]) -> dict[str, int]:
    if final_score <= 0:
        return {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0}
    base = final_score * coeff(payload, "real_value") * coeff(payload, "reuse") * coeff(payload, "user_confirmed")
    weights = rules["merit_weights"]
    awarded = {
        "gongji": int(round(base * float(weights["gongji"]))),
        "mingcha": int(round(base * float(weights["mingcha"]))),
        "jinglue": int(round(base * float(weights["jinglue"]))),
        "weiwang": int(round(base * float(weights["weiwang"]))),
    }
    bonus, _ = event_bonuses(payload, rules)
    return {key: int(awarded.get(key, 0) + bonus.get(key, 0)) for key in ["gongji", "mingcha", "jinglue", "weiwang"]}


def merged_merit(payload: dict[str, Any], awarded: dict[str, int]) -> dict[str, int]:
    current = ((payload.get("user_state") or {}).get("merit") or {})
    return {
        "gongji": int(current.get("gongji", current.get("gongye", 0))) + int(awarded.get("gongji", 0)),
        "mingcha": int(current.get("mingcha", 0)) + int(awarded.get("mingcha", 0)),
        "jinglue": int(current.get("jinglue", 0)) + int(awarded.get("jinglue", 0)),
        "weiwang": int(current.get("weiwang", 0)) + int(awarded.get("weiwang", 0)),
    }


def departments_l3(payload: dict[str, Any], rules: dict[str, Any]) -> int:
    thresholds = rules["department_level_thresholds"]
    points = ((payload.get("user_state") or {}).get("department_points") or {})
    return sum(1 for value in points.values() if level_for_points(int(value), thresholds) >= 3)


def level_for_points(points: int, thresholds: list[int]) -> int:
    level = 1
    for index, threshold in enumerate(thresholds, start=1):
        if points >= int(threshold):
            level = index
    return level


def qualifies(title_rule: dict[str, Any], payload: dict[str, Any], merit: dict[str, int], rules: dict[str, Any]) -> bool:
    state = payload.get("user_state") or {}
    if merit["gongji"] < int(title_rule.get("min_gongye", 0)):
        return False
    if merit["mingcha"] < int(title_rule.get("min_mingcha", 0)):
        return False
    if merit["jinglue"] < int(title_rule.get("min_jinglue", 0)):
        return False
    if int(state.get("tasks_completed", 0)) + 1 < int(title_rule.get("min_tasks", 0)):
        return False
    if float(state.get("average_score", 0)) < float(title_rule.get("min_average_score", 0)):
        return False
    if float(state.get("recent_reject_rate", 0)) > float(title_rule.get("max_recent_reject_rate", 1)):
        return False
    if int(state.get("templates", 0)) + len([e for e in payload.get("events", []) if e == "template_archived"]) < int(title_rule.get("min_templates", 0)):
        return False
    if departments_l3(payload, rules) < int(title_rule.get("min_departments_l3", 0)):
        return False
    if title_rule.get("requires_user_confirmed_value") and not state.get("user_confirmed_value"):
        return False
    if title_rule.get("requires_enterprise_grade_audit") and not state.get("enterprise_grade_audit"):
        return False
    return True


def title_for(payload: dict[str, Any], merit: dict[str, int], rules: dict[str, Any]) -> str:
    title = "未入朝"
    for title_rule in rules["user_titles"]:
        if qualifies(title_rule, payload, merit, rules):
            title = str(title_rule["title"])
    return title


def department_progress(payload: dict[str, Any], awarded: dict[str, int], rules: dict[str, Any]) -> tuple[int, str]:
    department = str(payload.get("department", "gongbu"))
    state_points = ((payload.get("user_state") or {}).get("department_points") or {})
    current = int(state_points.get(department, 0))
    points = current + int(awarded.get("gongji", 0)) + int(awarded.get("jinglue", 0))
    level = level_for_points(points, rules["department_level_thresholds"])
    titles = rules["department_titles"].get(department, ["见习", "主事", "侍郎", "尚书"])
    return level, str(titles[min(level - 1, len(titles) - 1)])


def evaluate_purchase(payload: dict[str, Any], rules: dict[str, Any]) -> EconomyDecision | None:
    request = payload.get("purchase_request")
    if not request:
        return None
    item_type = str(request.get("item_type", ""))
    currency = str(request.get("currency", ""))
    amount = float(request.get("amount", 0) or 0)
    currencies = rules["economy"]["currencies"]
    if currency not in currencies:
        return EconomyDecision("block", item_type, currency, amount, "unknown_currency")
    if currencies[currency].get("cash_out"):
        return EconomyDecision("block", item_type, currency, amount, "cash_out_forbidden")
    if item_type in set(rules["economy"]["forbidden_purchases"]):
        return EconomyDecision("block", item_type, currency, amount, "forbidden_item_preserves_fairness")
    if item_type not in set(rules["economy"]["allowed_purchases"]):
        return EconomyDecision("block", item_type, currency, amount, "item_not_allowlisted")
    if currency == "gongye":
        return EconomyDecision("block", item_type, currency, amount, "honor_ledger_not_spendable")
    if amount <= 0:
        return EconomyDecision("block", item_type, currency, amount, "invalid_amount")
    return EconomyDecision("allow", item_type, currency, amount, "platform_internal_digital_service")


def build_commercial_offer(
    payload: dict[str, Any],
    purchase: EconomyDecision | None,
    business_model: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not purchase or purchase.decision != "allow" or not business_model:
        return None
    capability = business_model.get("paid_capabilities", {}).get(purchase.item_type)
    if not capability:
        return None
    return {
        "capability": purchase.item_type,
        "currency": purchase.currency,
        "amount": purchase.amount,
        "configured_cost": capability.get("chaobi_cost"),
        "visible_feedback": capability.get("visible_feedback"),
        "value_metric": capability.get("value_metric"),
        "next_action": payload.get("next_action", "confirm_optional_upgrade"),
        "principle": "付费增强能力，不影响评分、称号、御史通过或史馆事实。",
    }


def unlocks_for(payload: dict[str, Any], final_score: float, awarded: dict[str, int], special_titles: list[str]) -> list[str]:
    unlocks: list[str] = []
    if final_score >= 90:
        unlocks.append("圣裁战报候选")
    if awarded.get("jinglue", 0) >= 20:
        unlocks.append("史馆模板候选")
    if "火眼金睛" in special_titles or "铁面无私" in special_titles:
        unlocks.append("御史明察进度提升")
    if "富国有术" in special_titles:
        unlocks.append("户部 ROI 复盘候选")
    if payload.get("purchase_request"):
        unlocks.append("商业权益请求已过御史经济规则")
    return unlocks


def evaluate_case(case: dict[str, Any], rules: dict[str, Any] | None = None) -> MeritResult:
    rules = rules or load_rules()
    business_model = load_business_model()
    payload = case.get("payload", case)
    raw = score_payload(payload, rules)
    final_score, conditions = apply_yushi_controls(raw, payload, rules)
    grade = grade_for(final_score, rules)
    awarded = calculate_merit(final_score, payload, rules)
    _, special_titles = event_bonuses(payload, rules)
    merit_after = merged_merit(payload, awarded)
    title = title_for(payload, merit_after, rules)
    dept_level, dept_title = department_progress(payload, awarded, rules)
    purchase = evaluate_purchase(payload, rules)
    commercial_offer = build_commercial_offer(payload, purchase, business_model)
    unlocks = unlocks_for(payload, final_score, awarded, special_titles)

    expected = case.get("expect", {})
    checks = {
        "grade": grade,
        "economy_decision": purchase.decision if purchase else None,
        "title": title,
    }
    passed = all(checks.get(key) == value for key, value in expected.items() if key != "passed")
    if "passed" in expected:
        passed = passed and bool(expected["passed"])

    return MeritResult(
        case_id=str(case.get("case_id", payload.get("run_id", "manual"))),
        run_id=str(payload.get("run_id", "manual")),
        department=str(payload.get("department", "unknown")),
        advisor_agent=str(payload.get("advisor_agent") or rules["advisors"].get(str(payload.get("department", "")), {}).get("default", "default")),
        raw_score=raw,
        final_score=final_score,
        grade=grade,
        user_title=title,
        department_level=dept_level,
        department_title=dept_title,
        merit_awarded=awarded,
        special_titles=special_titles,
        unlocks=unlocks,
        economy_decision=asdict(purchase) if purchase else None,
        commercial_offer=commercial_offer,
        yushi_verdict=str(payload.get("yushi_decision", "allow_with_conditions")),
        conditions=conditions,
        passed=passed,
    )


def build_report(cases: list[dict[str, Any]], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    rules = rules or load_rules()
    results = [evaluate_case(case, rules) for case in cases]
    return {
        "generated_at": utc_now(),
        "harness": "chaotang_merit_system",
        "passed": all(result.passed for result in results),
        "summary": {
            "cases": len(results),
            "passed": sum(1 for result in results if result.passed),
            "blocked_economy": sum(1 for result in results if result.economy_decision and result.economy_decision["decision"] == "block"),
            "commercial_offers": sum(1 for result in results if result.commercial_offer),
            "earned_titles": sorted({result.user_title for result in results}),
            "special_titles": sorted({title for result in results for title in result.special_titles}),
        },
        "policy_notes": rules["economy"]["platform_policy_notes"],
        "results": [asdict(result) for result in results],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 朝堂功业系统报告",
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
    lines.extend(["", "## Battle Reports", "", "| Case | Score | Grade | Title | Department | Economy | Offer |", "|---|---:|---|---|---|---|---|"])
    for result in report["results"]:
        economy = "-"
        if result["economy_decision"]:
            economy = result["economy_decision"]["decision"]
        offer = "-"
        if result["commercial_offer"]:
            offer = result["commercial_offer"]["capability"]
        lines.append(
            f"| `{result['case_id']}` | {result['final_score']} | `{result['grade']}` | "
            f"`{result['user_title']}` | `{result['department_title']}` | `{economy}` | `{offer}` |"
        )
    lines.extend(["", "## Policy Notes", ""])
    for note in report["policy_notes"]:
        lines.append(f"- {note}")
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
    parser = argparse.ArgumentParser(description="Run Chaotang merit, progression, and economy harness.")
    parser.add_argument("--rules", type=Path, default=DEFAULT_RULES)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--no-ledger", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(load_cases(args.cases), load_rules(args.rules))
    write_report(report, args.json_out, args.md_out)
    if not args.no_ledger:
        append_ledger(report, args.ledger)
    print(f"chaotang_merit_system complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
