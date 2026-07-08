#!/usr/bin/env python3
"""Build a deterministic AI-ops snapshot from local run/eval resources."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "config" / "ops_snapshot.yaml"


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _load_yaml(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return yaml.safe_load(path.read_text(encoding="utf-8")) or default


def _registered_swarms(root: Path) -> list[str]:
    orch = _load_yaml(root / "config" / "swarm_orchestrator.yaml", {})
    return [s["id"] for s in orch.get("swarms", []) if s.get("id")]


def _all_flow_ids(root: Path) -> list[str]:
    return [p.stem.removeprefix("flow_") for p in sorted((root / "config").glob("flow_*.yaml"))]


def _quality_baseline(root: Path) -> dict[str, dict[str, Any]]:
    return _load_json(root / "scripts" / "golden_cases" / "quality_baseline.json", {})


def _quality_eval_log(root: Path) -> dict[str, Any]:
    path = root / "data" / "quality_eval_log.jsonl"
    by_swarm: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            sid = rec.get("swarm_id")
            if sid:
                by_swarm[sid].append(rec)

    summary = {}
    for sid, rows in by_swarm.items():
        scores = [float(r.get("overall") or 0) for r in rows]
        risk_count = sum(1 for r in rows if r.get("irreversible_risk_error"))
        latest = rows[-1]
        summary[sid] = {
            "eval_runs": len(rows),
            "avg_overall_5pt": round(sum(scores) / len(scores), 2) if scores else None,
            "median_overall_5pt": median(scores) if scores else None,
            "irreversible_risk_errors": risk_count,
            "latest_verdict": latest.get("verdict", ""),
            "latest_reason": latest.get("reasons", ""),
            "latest_timestamp": latest.get("timestamp", ""),
        }
    return summary


def _session_stats(root: Path) -> dict[str, Any]:
    stats: dict[str, Counter] = defaultdict(Counter)
    score_values: dict[str, list[float]] = defaultdict(list)
    sessions_dir = root / "swarm_sessions"
    for path in sorted(sessions_dir.glob("*.json")) if sessions_dir.exists() else []:
        session = _load_json(path, {})
        for run in session.get("swarm_runs", []) or []:
            sid = run.get("swarm_id")
            if not sid:
                continue
            status = run.get("status") or "unknown"
            stats[sid][status] += 1
            score = run.get("quality_score")
            if isinstance(score, (int, float)):
                score_values[sid].append(float(score))

    out = {}
    for sid, counter in stats.items():
        total = sum(counter.values())
        completed = counter.get("completed", 0)
        values = score_values.get(sid, [])
        out[sid] = {
            "runs": total,
            "completed": completed,
            "skipped": counter.get("skipped", 0),
            "failed": counter.get("failed", 0) + counter.get("error", 0),
            "success_rate": round(completed / total, 4) if total else None,
            "avg_session_quality": round(sum(values) / len(values), 2) if values else None,
        }
    return out


def _run_dir_stats(root: Path) -> dict[str, Any]:
    stats: dict[str, Counter] = defaultdict(Counter)
    quality_values: dict[str, list[float]] = defaultdict(list)
    token_usage: dict[str, Counter] = defaultdict(Counter)
    latest: dict[str, dict[str, Any]] = {}

    runs_dir = root / "data" / "default" / "runs"
    if not runs_dir.exists():
        return {}

    for meta_path in sorted(runs_dir.glob("*/run_meta.json")):
        meta = _load_json(meta_path, {})
        config_path = str(meta.get("config_path") or "")
        if "flow_" not in config_path:
            continue
        sid = Path(config_path).stem.removeprefix("flow_")
        run_id = meta.get("run_id") or meta_path.parent.name
        stats[sid]["runs"] += 1
        if meta.get("has_final_output"):
            stats[sid]["completed"] += 1
        else:
            stats[sid]["failed"] += 1

        q = meta.get("quality_score")
        if isinstance(q, dict) and isinstance(q.get("total_score"), (int, float)):
            quality_values[sid].append(float(q["total_score"]))

        for step_path in meta_path.parent.glob("step_*.json"):
            step = _load_json(step_path, {})
            token_usage[sid]["input_tokens"] += int(step.get("input_tokens") or 0)
            token_usage[sid]["output_tokens"] += int(step.get("output_tokens") or 0)
            token_usage[sid]["duration_seconds"] += int(float(step.get("duration_seconds") or 0))
            metrics = (step.get("metadata") or {}).get("context_metrics") or {}
            token_usage[sid]["cost_usd_micros"] += int(float(metrics.get("cost_usd") or 0.0) * 1_000_000)

        latest[sid] = {
            "run_id": run_id,
            "task_input": str(meta.get("task_input") or "")[:120],
            "has_final_output": bool(meta.get("has_final_output")),
            "total_score_5pt": (meta.get("quality_score") or {}).get("total_score")
            if isinstance(meta.get("quality_score"), dict)
            else None,
        }

    out = {}
    for sid, counter in stats.items():
        total = counter["runs"]
        completed = counter["completed"]
        usage = token_usage.get(sid, Counter())
        values = quality_values.get(sid, [])
        out[sid] = {
            "runs": total,
            "completed": completed,
            "failed": counter["failed"],
            "success_rate": round(completed / total, 4) if total else None,
            "avg_run_quality_5pt": round(sum(values) / len(values), 2) if values else None,
            "latest": latest.get(sid, {}),
            "cost": {
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
                "duration_seconds": usage.get("duration_seconds", 0),
                "cost_usd": round(usage.get("cost_usd_micros", 0) / 1_000_000, 6),
            },
        }
    return out


def build_snapshot(root: Path = ROOT) -> dict[str, Any]:
    registered = _registered_swarms(root)
    flows = _all_flow_ids(root)
    baseline = _quality_baseline(root)
    eval_summary = _quality_eval_log(root)
    session_summary = _session_stats(root)
    run_dir_summary = _run_dir_stats(root)

    real_ids = set(flows) | set(registered) | set(baseline) | set(eval_summary)
    all_ids = sorted(real_ids)
    swarms = {}
    red_lights = []
    missing_baseline = []

    for sid in all_ids:
        b = baseline.get(sid, {})
        q = b.get("quality_score")
        flow_exists = sid in flows
        registered_exists = sid in registered
        pass_quality = bool(b.get("pass")) if "pass" in b else None
        if q is None:
            missing_baseline.append(sid)
        elif float(q) < 7.0:
            red_lights.append({"id": sid, "quality_score": q})

        swarms[sid] = {
            "registered": registered_exists,
            "flow_exists": flow_exists,
            "quality_score_10pt": q,
            "quality_pass": pass_quality,
            "case_count": b.get("case_count"),
            "evaluated_at": b.get("evaluated_at"),
            "session": session_summary.get(sid, {"runs": 0, "success_rate": None}),
            "run_logs": run_dir_summary.get(sid, {"runs": 0, "success_rate": None}),
            "eval_log": eval_summary.get(sid, {"eval_runs": 0}),
        }

    scores = [float(v["quality_score_10pt"]) for v in swarms.values() if v["quality_score_10pt"] is not None]
    total_cost = sum((v.get("run_logs") or {}).get("cost", {}).get("cost_usd", 0.0) for v in swarms.values())
    total_input_tokens = sum((v.get("run_logs") or {}).get("cost", {}).get("input_tokens", 0) for v in swarms.values())
    total_output_tokens = sum((v.get("run_logs") or {}).get("cost", {}).get("output_tokens", 0) for v in swarms.values())
    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_files": [
                "config/swarm_orchestrator.yaml",
                "config/flow_*.yaml",
                "scripts/golden_cases/quality_baseline.json",
                "data/quality_eval_log.jsonl",
                "swarm_sessions/*.json",
                "data/default/runs/*/run_meta.json",
                "data/default/runs/*/step_*.json",
            ],
            "cost_data_status": "available_from_step_logs" if total_input_tokens or total_output_tokens else "missing",
        },
        "cost": {
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "cost_usd": round(total_cost, 6),
            "note": "Aggregated from step logs; not yet a durable business ledger.",
        },
        "coverage": {
            "flow_count": len(flows),
            "registered_count": len(registered),
            "baseline_count": len(baseline),
            "missing_baseline": missing_baseline,
        },
        "quality": {
            "threshold": 7.0,
            "avg_quality_score_10pt": round(sum(scores) / len(scores), 2) if scores else None,
            "median_quality_score_10pt": median(scores) if scores else None,
            "red_light_count": len(red_lights),
            "red_lights": sorted(red_lights, key=lambda r: r["quality_score"]),
        },
        "swarms": swarms,
        "immediate_priorities": [
            {
                "priority": f"P{i}",
                "swarm_id": item["id"],
                "reason": f"quality_score={item['quality_score']} < 7.0",
                "next_action": f"Run python scripts/eval_ci.py --swarm {item['id']} after prompt/flow fix",
            }
            for i, item in enumerate(sorted(red_lights, key=lambda r: r["quality_score"])[:8])
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build deterministic AI ops snapshot")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    snapshot = build_snapshot()
    if args.json:
        print(json.dumps(snapshot, ensure_ascii=False, indent=2))
    out = Path(args.output)
    out.write_text(yaml.safe_dump(snapshot, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
