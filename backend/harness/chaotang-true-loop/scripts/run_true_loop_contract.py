from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


HARNESS_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = HARNESS_ROOT / "golden_cases" / "true_loop_cases.json"
ALLOWED_TRUTH_STATES = {"real", "fallback_labeled", "mock", "missing"}
BLOCKING_STATES = {"mock", "missing"}


def load_cases(path: Path = DEFAULT_CASES) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    cases = payload.get("cases")
    if not isinstance(cases, list):
        raise ValueError("golden case file must contain a cases list")
    return cases


def _require(condition: bool, reason: str, failures: list[str]) -> None:
    if not condition:
        failures.append(reason)


def validate_case(case: dict[str, Any]) -> dict[str, Any]:
    failures: list[str] = []

    _require(bool(case.get("case_id")), "missing case_id", failures)
    _require(bool(case.get("user_input")), "missing user_input", failures)
    _require(case.get("experience_entry") == "/study", "experience entry must be /study", failures)
    _require(case.get("backend_api") == "/api/chaotang/study/run", "backend api must be study/run", failures)
    _require(case.get("mode") == "live", "true loop must exercise live mode", failures)

    adapter = case.get("adapter") or {}
    _require(adapter.get("name") == "swarm_orchestrator", "adapter must be swarm_orchestrator", failures)
    _require(bool(adapter.get("entry_swarm")), "adapter entry_swarm is required", failures)
    _require(
        str(adapter.get("session_id_pattern", "")).startswith("study-live-"),
        "session pattern must start study-live-",
        failures,
    )

    replay = case.get("replay_artifact") or {}
    _require(replay.get("owner") == "shiguan", "replay artifact owner must be shiguan", failures)
    _require(
        "{session_id}" in str(replay.get("api_path_pattern", "")), "replay api path must include session_id", failures
    )
    _require(
        "{session_id}" in str(replay.get("path_pattern", "")), "replay file path must include session_id", failures
    )

    archive = case.get("archive") or {}
    _require(archive.get("owner") == "shiguan", "archive owner must be shiguan", failures)
    _require(
        "{task_id}" in str(archive.get("retrospective_api_pattern", "")),
        "archive retrospective path must include task_id",
        failures,
    )
    if archive.get("fallback_allowed"):
        _require(archive.get("fallback_must_be_labeled") is True, "fallback must be labeled", failures)

    launch_case = case.get("launch_loop_case") or {}
    _require(
        launch_case.get("schema_version") == "launch_loop_case.v1",
        "launch loop case schema must be v1",
        failures,
    )
    required_launch_fields = set(launch_case.get("required_fields") or [])
    _require(
        {
            "case_id",
            "tenantSlug",
            "source",
            "sourceId",
            "title",
            "command",
            "owner",
            "targetDept",
            "evidenceIds",
            "taskId",
            "runId",
            "status",
            "qualityGate",
            "nextAction",
            "archive",
            "learning",
        }.issubset(required_launch_fields),
        "launch loop case must require tenant, source, evidence, task/run, gate, next action, archive, and learning",
        failures,
    )
    _require(
        "decision_ready" in set(launch_case.get("status_lifecycle") or []),
        "launch loop lifecycle must include decision_ready",
        failures,
    )
    _require(launch_case.get("archive_owner") == "shiguan", "launch loop archive owner must be shiguan", failures)
    _require(launch_case.get("learning_owner") == "shiguan", "launch loop learning owner must be shiguan", failures)
    _require(
        launch_case.get("tenant_isolation") is True,
        "launch loop must declare tenant_isolation",
        failures,
    )
    _require(
        launch_case.get("idempotency") == "client_key",
        "launch loop must declare client_key idempotency",
        failures,
    )
    _require(
        str(launch_case.get("append_only_store", "")).endswith(".jsonl"),
        "launch loop store must be append-only jsonl",
        failures,
    )
    _require(
        launch_case.get("observability_event") == "launch_loop_case_created",
        "launch loop must emit launch_loop_case_created",
        failures,
    )

    gate = case.get("quality_gate") or {}
    required_gate_fields = set(gate.get("required_fields") or [])
    _require(
        {"status", "score", "reasons", "human_signoff_required"}.issubset(required_gate_fields),
        "quality gate must require status, score, reasons, and human_signoff_required",
        failures,
    )
    _require("blocked" in set(gate.get("allowed_status") or []), "quality gate must allow blocked status", failures)

    next_action = case.get("next_action") or {}
    _require(next_action.get("owner_required") is True, "next action owner must be required", failures)
    _require(next_action.get("label_required") is True, "next action label must be required", failures)

    steps = case.get("truth_steps") or []
    _require(bool(steps), "truth_steps are required", failures)
    seen_steps: set[str] = set()
    blocking_steps: list[str] = []
    unlabeled_states: list[str] = []
    for step in steps:
        step_id = str(step.get("id") or "")
        state = str(step.get("state") or "")
        seen_steps.add(step_id)
        if state not in ALLOWED_TRUTH_STATES:
            unlabeled_states.append(f"{step_id}:{state}")
        if state in BLOCKING_STATES:
            blocking_steps.append(f"{step_id}:{state}")

    _require(not unlabeled_states, f"unknown truth states: {', '.join(unlabeled_states)}", failures)
    _require(not blocking_steps, f"required true loop contains blocking states: {', '.join(blocking_steps)}", failures)
    _require(
        {
            "experience_entry",
            "study_run_api",
            "live_swarm_adapter",
            "replay_artifact",
            "archive_retrospective",
            "launch_loop_case",
            "observability_event",
            "human_signoff",
        }.issubset(seen_steps),
        "truth_steps must cover experience, api, swarm, replay, archive, launch case, observability, and signoff",
        failures,
    )

    return {
        "case_id": case.get("case_id", ""),
        "passed": not failures,
        "failures": failures,
        "truth_steps": steps,
    }


def run(path: Path = DEFAULT_CASES) -> dict[str, Any]:
    records = [validate_case(case) for case in load_cases(path)]
    return {
        "harness": "chaotang_true_loop",
        "cases": len(records),
        "passed": all(record["passed"] for record in records),
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Chaotang true-loop golden contracts")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    args = parser.parse_args()
    result = run(args.cases)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
