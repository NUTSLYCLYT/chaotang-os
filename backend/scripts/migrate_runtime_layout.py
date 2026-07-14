#!/usr/bin/env python3
"""Move legacy backend runtime directories into the canonical ``var/`` tree.

The command is dry-run by default. Stop every backend process first, inspect the
plan, then pass ``--apply``. Existing destinations are never merged or replaced.
That conservative rule prevents a partially migrated deployment from choosing
between two competing databases or ledgers.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from src.runtime_paths import BACKEND_ROOT, resolve_runtime_paths


LEGACY_TO_RUNTIME = {
    "data": "data",
    "events": "events",
    "memory": "memory",
    "sessions": "chat_sessions",
    "swarm_sessions": "swarm_sessions",
    "traces": "traces",
    "direct_cache": "direct_cache",
    "direct_feedback": "direct_feedback",
    "runs": "runs",
    "repairs": "repairs",
    "drafts": "drafts",
    "reports": "reports",
    "cases": "cases",
    "ab_tests": "ab_tests",
}


def build_plan() -> list[tuple[Path, Path]]:
    paths = resolve_runtime_paths()
    plan: list[tuple[Path, Path]] = []
    for legacy_name, attribute in LEGACY_TO_RUNTIME.items():
        source = BACKEND_ROOT / legacy_name
        has_state = source.exists() and any(
            item.is_file() or item.is_symlink() for item in source.rglob("*")
        )
        if has_state:
            plan.append((source, getattr(paths, attribute)))
    return plan


def apply_plan(plan: list[tuple[Path, Path]]) -> None:
    conflicts = [(source, target) for source, target in plan if target.exists()]
    # A parent move can create another planned destination.  Detect that before
    # making any mutation so migration is all-or-nothing at the planning layer.
    for parent_source, parent_target in plan:
        for child_source, child_target in plan:
            if parent_target == child_target or parent_target not in child_target.parents:
                continue
            projected = parent_source / child_target.relative_to(parent_target)
            if projected.exists():
                conflicts.append((child_source, child_target))
    if conflicts:
        details = "\n".join(f"- {source} -> {target} (destination exists)" for source, target in conflicts)
        raise SystemExit(f"Refusing to merge competing runtime trees:\n{details}")
    for source, target in plan:
        if target.exists():  # defensive re-check against races
            raise SystemExit(f"Refusing to replace runtime destination created during migration: {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            source.rename(target)
        except OSError:
            shutil.move(str(source), str(target))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="perform the displayed moves")
    args = parser.parse_args()
    plan = build_plan()
    if not plan:
        print("No non-empty legacy runtime directories detected.")
        return 0
    for source, target in plan:
        print(f"{source} -> {target}")
    if not args.apply:
        print("Dry run only. Stop the backend and re-run with --apply.")
        return 2
    apply_plan(plan)
    print("Runtime layout migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
