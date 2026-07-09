from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.chaotang_department_router import department_system_payload

DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
REQUIRED_TEXT = {
    "SKILL.md": ("职责", "边界", "输出"),
    "soul.md": ("人格核心", "边界", "输出"),
    "user.md": ("用户看到", "交互设计", "禁用动作"),
}


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def validate_persona(persona: dict[str, Any]) -> dict[str, Any]:
    issues: list[str] = []
    for field in (
        "historicalPrototype",
        "modernPrototype",
        "archetype",
        "voice",
        "skillPath",
        "soulPath",
        "userPath",
        "safetyBoundary",
    ):
        if not persona.get(field):
            issues.append(f"missing:{field}")
    for key in ("skillPath", "soulPath", "userPath"):
        path = PROJECT_ROOT / str(persona.get(key, ""))
        if not path.exists():
            issues.append(f"missing_file:{key}")
            continue
        required = REQUIRED_TEXT.get(path.name, ())
        text = path.read_text(encoding="utf-8")
        for needle in required:
            if needle not in text:
                issues.append(f"{path.name}:missing_text:{needle}")
    return {
        "code": persona.get("code"),
        "name": persona.get("name"),
        "passed": not issues,
        "issues": issues,
    }


def build_report() -> dict[str, Any]:
    payload = department_system_payload()
    personas = payload.get("personaPrototypes", [])
    visualization = payload.get("executionVisualization", {})
    modules = payload.get("geniusExperienceModules", [])
    results = [validate_persona(persona) for persona in personas]
    stage_issues = []
    stages = visualization.get("stages", [])
    if len(stages) < 6:
        stage_issues.append("executionVisualization.stages.min_6")
    for stage in stages:
        for field in ("stage", "label", "visible_status"):
            if not stage.get(field):
                stage_issues.append(f"stage:{stage.get('stage','unknown')}:missing:{field}")
    module_issues = []
    expected_modules = [
        "live_war_report",
        "advisor_review_panel",
        "memory_replay",
        "forecast_sandbox",
    ]
    if [item.get("module") for item in modules] != expected_modules:
        module_issues.append("geniusExperienceModules.order")
    for module in modules:
        for field in ("module", "order", "title", "status", "principle", "next_action", "harness_gate"):
            if not module.get(field):
                module_issues.append(f"module:{module.get('module','unknown')}:missing:{field}")
    return {
        "generated_at": utc_now(),
        "passed": all(item["passed"] for item in results) and not stage_issues and not module_issues,
        "summary": {
            "personas": len(results),
            "personas_passed": sum(1 for item in results if item["passed"]),
            "visualization_stages": len(stages),
            "stage_issues": len(stage_issues),
            "genius_modules": len(modules),
            "module_issues": len(module_issues),
        },
        "persona_results": results,
        "stage_issues": stage_issues,
        "module_issues": module_issues,
    }


def write_markdown(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# 朝堂部门人格 Harness",
        "",
        f"- passed: {report['passed']}",
        f"- personas: {report['summary']['personas_passed']}/{report['summary']['personas']}",
        f"- visualization stages: {report['summary']['visualization_stages']}",
        f"- genius modules: {report['summary']['genius_modules']}",
        "",
        "## 结果",
    ]
    for item in report["persona_results"]:
        mark = "PASS" if item["passed"] else "FAIL"
        lines.append(f"- {mark} {item['code']} {item['name']}: {', '.join(item['issues']) or 'ok'}")
    if report["stage_issues"]:
        lines.extend(["", "## 阶段问题"])
        lines.extend(f"- {issue}" for issue in report["stage_issues"])
    if report["module_issues"]:
        lines.extend(["", "## 模块问题"])
        lines.extend(f"- {issue}" for issue in report["module_issues"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    args = parser.parse_args()

    report = build_report()
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(report, args.md_out)
    print(f"chaotang_department_personas complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
