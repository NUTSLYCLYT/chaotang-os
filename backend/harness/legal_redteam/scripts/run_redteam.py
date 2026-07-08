#!/usr/bin/env python3
"""Run deterministic P0 checks for legal swarm outputs."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
CASES_PATH = ROOT / "harness" / "legal-redteam" / "cases.json"
ARTIFACTS_DIR = ROOT / "harness" / "legal-redteam" / "artifacts"


def load_cases() -> list[dict[str, Any]]:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


def flatten_output(raw: str) -> str:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return raw
    return json.dumps(data, ensure_ascii=False, sort_keys=True)


def evaluate_output(case: dict[str, Any], output: str) -> dict[str, Any]:
    failures: list[dict[str, str]] = []
    for check in case.get("checks", []):
        ctype = check["type"]
        if ctype == "contains":
            value = check["value"]
            if value not in output:
                failures.append({"check": ctype, "reason": f"missing required text: {value}"})
        elif ctype == "contains_any":
            values = check["values"]
            if not any(value in output for value in values):
                failures.append({"check": ctype, "reason": f"missing any required text: {values}"})
        elif ctype == "not_contains":
            value = check["value"]
            if value in output:
                failures.append({"check": ctype, "reason": f"forbidden text present: {value}"})
        elif ctype == "not_contains_any":
            for value in check["values"]:
                if value in output:
                    failures.append({"check": ctype, "reason": f"forbidden text present: {value}"})
        else:
            failures.append({"check": ctype, "reason": f"unknown check type: {ctype}"})
    return {
        "case_id": case["id"],
        "severity": case.get("severity", "P0"),
        "status": "fail" if failures else "pass",
        "failures": failures,
    }


def run_legal_flow(task: str, timeout: int) -> str:
    before = _run_dirs_for_task(task)
    cmd = [sys.executable, "scripts/run_flow.py", "config/flow_legal.yaml", task]
    completed = subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    after = _run_dirs_for_task(task)
    new_dirs = [path for path in after if path not in before]
    output_parts = [completed.stdout, completed.stderr]
    for run_dir in sorted(new_dirs, key=lambda path: path.stat().st_mtime):
        output_parts.append(_collect_run_artifacts(run_dir))
    return "\n".join(part for part in output_parts if part)


def _run_dirs_for_task(task: str, root: Path = ROOT) -> set[Path]:
    runs_dir = root / "data" / "default" / "runs"
    if not runs_dir.exists():
        return set()

    matches: set[Path] = set()
    for run_dir in runs_dir.iterdir():
        if run_dir.is_dir() and _run_dir_matches_task(run_dir, task):
            matches.add(run_dir)
    return matches


def _run_dir_matches_task(run_dir: Path, task: str) -> bool:
    meta_path = run_dir / "run_meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            meta = {}
        if meta.get("task_input") == task:
            return True

    for step_path in run_dir.glob("step_*.json"):
        try:
            data = json.loads(step_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        text = "\n".join(
            str(data.get(key) or "")
            for key in ("rendered_context", "input", "output")
        )
        if task in text:
            return True
    return False


def _collect_run_artifacts(run_dir: Path) -> str:
    parts: list[str] = [f"\n## RUN_ARTIFACTS {run_dir.name}"]
    final_path = run_dir / "final_output.json"
    if final_path.exists():
        parts.append(output_from_file(final_path))

    for step_path in sorted(run_dir.glob("step_*.json")):
        try:
            data = json.loads(step_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        step_id = data.get("step_id", step_path.stem)
        output = data.get("output") or data.get("input") or ""
        parts.append(f"\n### {step_id}\n{output}")
    return "\n".join(parts)


def output_from_file(path: Path) -> str:
    return flatten_output(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run legal swarm red-team checks")
    parser.add_argument("--output-file", type=Path, help="Evaluate one saved output against all cases")
    parser.add_argument("--real", action="store_true", help="Run flow_legal once per case before checking")
    parser.add_argument("--timeout", type=int, default=480)
    parser.add_argument("--case-id", help="Limit to one case")
    args = parser.parse_args()

    if not args.output_file and not args.real:
        parser.error("provide --output-file or --real")

    cases = load_cases()
    if args.case_id:
        cases = [case for case in cases if case["id"] == args.case_id]
    if not cases:
        parser.error("no matching cases")

    results = []
    for case in cases:
        if args.real:
            output = run_legal_flow(case["task"], args.timeout)
        else:
            output = output_from_file(args.output_file)
        results.append(evaluate_output(case, output))

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = ARTIFACTS_DIR / "legal_redteam_results.json"
    report_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    failed = [result for result in results if result["status"] == "fail"]
    for result in results:
        print(f"{result['status'].upper():4s} {result['case_id']}")
        for failure in result["failures"]:
            print(f"     - {failure['reason']}")
    print(f"\nReport: {report_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
