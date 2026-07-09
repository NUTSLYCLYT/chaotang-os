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
DEFAULT_RULES = ROOT / "uiux_rules.yaml"
DEFAULT_CASES = ROOT / "golden_cases" / "uiux_cases.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
DEFAULT_LEDGER = ROOT / "artifacts" / "ledger.jsonl"


@dataclass(frozen=True)
class ExperienceResult:
    case_id: str
    surface_type: str
    valid: bool
    level: str
    score: int
    first_view_score: int
    action_score: int
    teaching_score: int
    visual_score: int
    trust_score: int
    delight_score: int
    findings: list[str]
    passed: bool


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def load_rules(path: Path = DEFAULT_RULES) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def score_first_view(surface: dict[str, Any], rules: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    answers = set(surface.get("five_second_answers", []))
    required = set(rules["five_second_test"]["required_questions"])
    missing = sorted(required - answers)
    score = round(20 * len(answers & required) / len(required))
    if missing:
        findings.append(f"five_second_missing:{','.join(missing)}")
    return score, findings


def score_required_elements(surface: dict[str, Any], rules: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    surface_type = surface.get("type")
    spec = rules["core_surfaces"].get(surface_type, {})
    required = set(spec.get("required_elements", []))
    present = set(surface.get("elements", []))
    missing = sorted(required - present)
    score = round(20 * len(present & required) / max(1, len(required)))
    if missing:
        findings.append(f"missing_elements:{','.join(missing)}")
    max_depts = int(spec.get("max_visible_departments", 99))
    if len(surface.get("visible_departments", [])) > max_depts:
        findings.append("too_many_visible_departments")
        score = min(score, 10)
    return score, findings


def score_actions(surface: dict[str, Any], rules: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    actions = surface.get("actions", [])
    roles = [action.get("role") for action in actions]
    primary_count = roles.count("primary")
    if primary_count != 1:
        findings.append("primary_action_count_not_one")
    known_roles = set(rules["action_taxonomy"])
    unknown = [str(role) for role in roles if role not in known_roles]
    if unknown:
        findings.append(f"unknown_action_roles:{','.join(unknown)}")
    vague_labels = {"详情", "更多", "管理"}
    if any(action.get("label") in vague_labels for action in actions):
        findings.append("vague_action_label")
    commercial_count = roles.count("commercial")
    if commercial_count and primary_count == 0:
        findings.append("commercial_without_primary")
    if commercial_count > 1:
        findings.append("too_many_commercial_actions")
    score = 15
    score -= 5 if primary_count != 1 else 0
    score -= 3 if unknown else 0
    score -= 3 if "vague_action_label" in findings else 0
    score -= 4 if "commercial_without_primary" in findings else 0
    score -= 2 if "too_many_commercial_actions" in findings else 0
    return max(0, score), findings


def score_teaching(surface: dict[str, Any], rules: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    teaching = surface.get("teaching") or {}
    lines = teaching.get("lines", [])
    trigger = teaching.get("trigger")
    if trigger not in set(rules["teaching"]["allowed_triggers"]):
        findings.append("bad_teaching_trigger")
    if trigger in set(rules["teaching"]["prohibited_triggers"]):
        findings.append("prohibited_teaching_trigger")
    if len(lines) > int(rules["teaching"]["max_lines"]):
        findings.append("teaching_too_long")
    if len(lines) < len(rules["teaching"]["required_answers"]):
        findings.append("teaching_missing_required_answers")
    score = 15
    score -= 6 if "bad_teaching_trigger" in findings else 0
    score -= 8 if "prohibited_teaching_trigger" in findings else 0
    score -= 3 if "teaching_too_long" in findings else 0
    score -= 4 if "teaching_missing_required_answers" in findings else 0
    return max(0, score), findings


def score_visual(surface: dict[str, Any], rules: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    visual = surface.get("visual") or {}
    prohibited = set(visual.get("prohibited", []))
    configured_prohibited = set(rules["visual_direction"]["prohibited"])
    if prohibited & configured_prohibited:
        findings.append("prohibited_visual_pattern")
    palette = set(visual.get("palette", []))
    if "棕色" in palette or "土黄" in palette:
        findings.append("brown_tan_palette")
    allowed_palette = set()
    for values in rules["visual_direction"]["palette"].values():
        allowed_palette.update(values)
    if not palette & allowed_palette:
        findings.append("palette_not_in_system")
    motifs = set(visual.get("motifs", []))
    known_motifs = set(rules["visual_direction"]["motif_jobs"])
    if motifs and not motifs <= known_motifs:
        findings.append("decorative_unknown_motif")
    score = 15
    score -= 8 if "prohibited_visual_pattern" in findings else 0
    score -= 5 if "brown_tan_palette" in findings else 0
    score -= 4 if "palette_not_in_system" in findings else 0
    score -= 3 if "decorative_unknown_motif" in findings else 0
    return max(0, score), findings


def score_commercial(surface: dict[str, Any], rules: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    offer = surface.get("commercial_offer")
    if not offer:
        return 10, findings
    required = set(rules["commercial_offer"]["required_elements"])
    missing = sorted(required - set(offer))
    if missing:
        findings.append(f"commercial_missing:{','.join(missing)}")
    capability = offer.get("capability")
    if capability in {"user_title", "task_score", "yushi_approval", "leaderboard_rank"}:
        findings.append("commercial_trust_pollution")
    if not offer.get("fairness_principle"):
        findings.append("commercial_missing_fairness_principle")
    trigger = (surface.get("teaching") or {}).get("trigger")
    if trigger in {"fake_urgency", "paywall_pressure"}:
        findings.append("commercial_dark_pattern")
    score = 10
    score -= 4 if missing else 0
    score -= 8 if "commercial_trust_pollution" in findings else 0
    score -= 4 if "commercial_missing_fairness_principle" in findings else 0
    score -= 6 if "commercial_dark_pattern" in findings else 0
    return max(0, score), findings


def quality_level(score: int, valid: bool) -> str:
    if not valid:
        return "L0"
    if score >= 90:
        return "L5"
    if score >= 78:
        return "L4"
    if score >= 65:
        return "L3"
    if score >= 50:
        return "L2"
    return "L1"


def evaluate_case(case: dict[str, Any], rules: dict[str, Any] | None = None) -> ExperienceResult:
    rules = rules or load_rules()
    surface = case.get("surface", case)
    first_score, first_findings = score_first_view(surface, rules)
    element_score, element_findings = score_required_elements(surface, rules)
    action_score, action_findings = score_actions(surface, rules)
    teaching_score, teaching_findings = score_teaching(surface, rules)
    visual_score, visual_findings = score_visual(surface, rules)
    trust_score, trust_findings = score_commercial(surface, rules)
    delight_score = 10 if not (action_findings or teaching_findings or visual_findings) else 5
    findings = (
        first_findings
        + element_findings
        + action_findings
        + teaching_findings
        + visual_findings
        + trust_findings
    )
    score = min(
        100,
        first_score + element_score + action_score + teaching_score + visual_score + trust_score + delight_score,
    )
    valid = score >= 65 and not any(
        item in findings
        for item in [
            "commercial_trust_pollution",
            "prohibited_teaching_trigger",
            "too_many_visible_departments",
            "prohibited_visual_pattern",
        ]
    )
    level = quality_level(score, valid)
    expected = case.get("expect", {})
    passed = True
    if expected:
        checks = {"valid": valid, "level": level}
        passed = all(checks.get(key) == value for key, value in expected.items())
    return ExperienceResult(
        case_id=str(case.get("case_id", surface.get("type", "manual"))),
        surface_type=str(surface.get("type", "unknown")),
        valid=valid,
        level=level,
        score=score,
        first_view_score=first_score,
        action_score=action_score,
        teaching_score=teaching_score,
        visual_score=visual_score,
        trust_score=trust_score,
        delight_score=delight_score,
        findings=findings,
        passed=passed,
    )


def build_report(cases: list[dict[str, Any]], rules: dict[str, Any] | None = None) -> dict[str, Any]:
    rules = rules or load_rules()
    results = [evaluate_case(case, rules) for case in cases]
    return {
        "generated_at": utc_now(),
        "harness": "chaotang_uiux_system",
        "passed": all(result.passed for result in results),
        "summary": {
            "cases": len(results),
            "passed": sum(1 for result in results if result.passed),
            "valid": sum(1 for result in results if result.valid),
            "invalid": sum(1 for result in results if not result.valid),
            "levels": sorted({result.level for result in results}),
        },
        "experience_trio": ["朝堂气象", "圣门战报", "钦天监伴读"],
        "results": [asdict(result) for result in results],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 朝堂体验契约系统报告",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- harness: `{report['harness']}`",
        f"- passed: `{report['passed']}`",
        "",
        "## Experience Trio",
        "",
    ]
    for item in report["experience_trio"]:
        lines.append(f"- {item}")
    lines.extend(["", "## Summary", ""])
    for key, value in report["summary"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Surface Results", "", "| Case | Surface | Score | Level | Valid | Findings |", "|---|---|---:|---|---|---|"])
    for result in report["results"]:
        findings = ", ".join(result["findings"]) if result["findings"] else "-"
        lines.append(
            f"| `{result['case_id']}` | `{result['surface_type']}` | {result['score']} | "
            f"`{result['level']}` | `{result['valid']}` | {findings} |"
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
    parser = argparse.ArgumentParser(description="运行朝堂体验契约系统验证。")
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
    print(f"chaotang_uiux_system complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
