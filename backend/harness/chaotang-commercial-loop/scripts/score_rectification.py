#!/usr/bin/env python3
"""Fast rectification score for Chaotang remediation work.

This is a read-only harness score. It deliberately separates:
- release readiness
- flow quality baseline
- commercial-loop harness health
- observability / learning artifacts
- governance maturity

Use it before and after each remediation batch so 三省/六部 can argue from the
same scorecard instead of taste.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


HARNESS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = HARNESS_ROOT.parents[1]
BASELINE_PATH = REPO_ROOT / "scripts" / "golden_cases" / "quality_baseline.json"
RUN_HARNESS = HARNESS_ROOT / "scripts" / "run_harness.py"
ARTIFACTS = HARNESS_ROOT / "artifacts"


def run_json(args: list[str], timeout: int = 60) -> tuple[bool, Any, str]:
    try:
        proc = subprocess.run(
            args,
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except Exception as exc:  # noqa: BLE001
        return False, None, str(exc)
    if proc.returncode != 0:
        return False, None, (proc.stderr or proc.stdout).strip()
    try:
        return True, json.loads(proc.stdout), ""
    except json.JSONDecodeError as exc:
        return False, None, f"invalid json: {exc}"


def score_release(status: str) -> dict[str, Any]:
    points = {"pass": 20.0, "fail": 0.0, "unknown": 5.0}[status]
    return {
        "score": points,
        "max": 20,
        "state": status,
        "evidence": f"web_build_status={status}",
        "next_action": "npm run build must pass before release" if status != "pass" else "run prod doctor and final release harness",
    }


def score_flow_quality() -> dict[str, Any]:
    if not BASELINE_PATH.exists():
        return {
            "score": 0.0,
            "max": 25,
            "state": "missing_baseline",
            "evidence": str(BASELINE_PATH),
            "next_action": "run eval_ci to create scripts/golden_cases/quality_baseline.json",
        }
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    rows = [
        {
            "id": key,
            "score": float(value.get("quality_score", 0)),
            "pass": bool(value.get("pass")),
            "cases": int(value.get("case_count", 0)),
        }
        for key, value in baseline.items()
    ]
    total = len(rows)
    passed = sum(1 for row in rows if row["pass"])
    failing = sorted([row for row in rows if not row["pass"]], key=lambda row: row["score"])
    points = round((passed / total) * 25, 2) if total else 0.0
    return {
        "score": points,
        "max": 25,
        "state": "pass" if passed == total and total else "fail",
        "evidence": f"{passed}/{total} baseline swarms pass",
        "failing": failing,
        "next_action": "fix lowest baseline swarms first: " + ", ".join(row["id"] for row in failing[:4]) if failing else "keep baseline green",
    }


def score_commercial(real_fast: bool) -> dict[str, Any]:
    ok, dry, err = run_json(
        [
            sys.executable,
            str(RUN_HARNESS),
            "--dry-run",
            "--all",
            "--no-write-ledger",
            "--no-write-events",
            "--no-write-business",
            "--no-write-golden-candidates",
            "--json",
        ],
        timeout=60,
    )
    if not ok:
        return {
            "score": 0.0,
            "max": 25,
            "state": "dry_run_failed",
            "evidence": err,
            "next_action": "fix commercial-loop harness contract before real-run",
        }
    cases = dry if isinstance(dry, list) else []
    passed = sum(1 for case in cases if case.get("status") == "passed" and case.get("quality_gate", {}).get("status") == "passed")
    points = 15.0 if cases and passed == len(cases) else round((passed / max(len(cases), 1)) * 15, 2)
    real_fast_state = "not_run"
    real_fast_points = 0.0
    if real_fast:
        ok_real, real, real_err = run_json(
            [
                sys.executable,
                str(RUN_HARNESS),
                "--real",
                "--fast",
                "--case-id",
                "cold_storage_100mwh",
                "--blocks",
                "opc",
                "--block-timeout",
                "30",
                "--no-write-ledger",
                "--no-write-events",
                "--no-write-business",
                "--no-write-golden-candidates",
                "--json",
            ],
            timeout=45,
        )
        real_fast_state = "passed" if ok_real and real.get("status") == "passed" else f"failed: {real_err or real}"
        real_fast_points = 10.0 if real_fast_state == "passed" else 0.0
    return {
        "score": round(points + real_fast_points, 2),
        "max": 25,
        "state": "pass" if points == 15.0 and (not real_fast or real_fast_points == 10.0) else "partial",
        "evidence": f"dry_run={passed}/{len(cases)}; real_fast={real_fast_state}",
        "next_action": "兵部先跑销售线 haolong/opc real-fast；同时复核售后线 storage_aftercare baseline and turn failures into golden candidates",
    }


def score_observability() -> dict[str, Any]:
    event_path = ARTIFACTS / "commercial_loop_events.jsonl"
    failure_path = ARTIFACTS / "commercial_loop_failures.jsonl"
    candidate_path = ARTIFACTS / "commercial_loop_golden_candidates.jsonl"
    business_path = ARTIFACTS / "commercial_loop_business.jsonl"

    files = {
        "events": event_path.exists(),
        "failures": failure_path.exists(),
        "golden_candidates": candidate_path.exists(),
        "business": business_path.exists(),
    }
    nonempty = {
        key: path.exists() and path.stat().st_size > 0
        for key, path in {
            "events": event_path,
            "failures": failure_path,
            "golden_candidates": candidate_path,
            "business": business_path,
        }.items()
    }
    score = 6.0
    score += sum(1.0 for value in files.values() if value)
    score += sum(1.25 for value in nonempty.values() if value)
    score = min(15.0, round(score, 2))
    return {
        "score": score,
        "max": 15,
        "state": "ready" if score >= 12 else "partial",
        "evidence": {"files": files, "nonempty": nonempty},
        "next_action": "write real runs to events/failures/business ledger, then review golden candidates",
    }


def score_governance() -> dict[str, Any]:
    ok, board, err = run_json([sys.executable, str(RUN_HARNESS), "--review-board", "--json"], timeout=30)
    if not ok:
        return {
            "score": 0.0,
            "max": 15,
            "state": "review_failed",
            "evidence": err,
            "next_action": "fix review-board before governance scoring",
        }
    maturity = board.get("maturity_level", "")
    level_scores = {
        "L0": 0.0,
        "L1": 3.0,
        "L2": 6.0,
        "L3": 9.0,
        "L4": 12.0,
        "L5": 15.0,
    }
    prefix = maturity.split(" ", 1)[0] if maturity else "L0"
    return {
        "score": level_scores.get(prefix, 0.0),
        "max": 15,
        "state": maturity or "unknown",
        "evidence": {
            "counts": board.get("counts", {}),
            "missing": board.get("missing", []),
        },
        "next_action": "move from L2 to L3 by adding source evidence, owner, verification, and production samples",
    }


def classify(total: float) -> str:
    if total >= 85:
        return "PROD"
    if total >= 70:
        return "BETA"
    if total >= 55:
        return "FIX_AND_RETEST"
    return "STOP_EXPANSION"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--web-build-status", choices=["pass", "fail", "unknown"], default="unknown")
    parser.add_argument("--real-fast", action="store_true", help="also run one fast real OPC case")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    sections = {
        "release_gate": score_release(args.web_build_status),
        "flow_quality": score_flow_quality(),
        "commercial_harness": score_commercial(args.real_fast),
        "observability_learning": score_observability(),
        "governance_maturity": score_governance(),
    }
    total = round(sum(section["score"] for section in sections.values()), 2)
    report = {
        "score": total,
        "max": 100,
        "decision": classify(total),
        "sections": sections,
        "commands": [
            "python scripts/validate_flows.py",
            "pytest -q tests/test_commercial_loop_harness.py",
            "python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --all --no-write-ledger",
            "python harness/chaotang-commercial-loop/scripts/run_harness.py --review-board",
        ],
    }
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    print(f"Chaotang rectification score: {total}/100 · {report['decision']}")
    for key, section in sections.items():
        print(f"- {key}: {section['score']}/{section['max']} · {section['state']} · {section['evidence']}")
        print(f"  next: {section['next_action']}")


if __name__ == "__main__":
    main()
