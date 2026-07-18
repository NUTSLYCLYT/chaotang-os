#!/usr/bin/env python3
"""Backfill CourtReview.memorial_json rows written before the 2026-07-18 fix.

menxia_veto_pending reviews written before this fix landed can be missing
fields the frontend read model dereferences unconditionally (conflict_summary
entries missing `departments`, quality_gate missing `passed`/`blocking_issues`)
- those rows would still crash canonical-read-model.ts on read, even though
new writes are now correct. Only patches the specific fields this fix
introduced; does not attempt to fix arbitrary future contract violations.

Default mode is a transactionally rolled-back dry run. Pass --apply to commit.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.db.engine import SessionLocal  # noqa: E402
from src.db.models import CourtReview  # noqa: E402
from src.shangshufang_memorial_contract import (  # noqa: E402
    find_memorial_contract_violations,
)


def _patch_known_gaps(memorial: dict) -> bool:
    """Fill in the specific required-contract fields the 2026-07-18 fix introduced.

    Scope is deliberately narrow: only fields find_memorial_contract_violations
    actually flags (departments, quality_gate.passed). blocking_issues is
    optional on the frontend type and safely defaults to [] there - patching
    it isn't a correctness fix, just noise, so it's left alone.

    Every row this runs against has review_status == "menxia_veto_pending"
    (the caller's query filter) - the gate can only ever be "not passed" for
    that status, so passed is unconditionally False, not derived from the
    status string (get(...) == "blocked" would have set passed=True for a
    blocked gate - backwards; caught by test_already_valid_memorial_is_left_unchanged).
    """
    changed = False
    for entry in memorial.get("conflict_summary") or []:
        if isinstance(entry, dict) and "departments" not in entry:
            entry["departments"] = []
            changed = True
    gate = memorial.get("quality_gate")
    if isinstance(gate, dict) and "passed" not in gate:
        gate["passed"] = False
        changed = True
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="commit patched rows (default: dry-run and rollback)",
    )
    args = parser.parse_args()

    stats = {"scanned": 0, "patched": 0, "still_violating": 0}
    with SessionLocal() as db:
        rows = (
            db.query(CourtReview)
            .filter(CourtReview.review_status == "menxia_veto_pending")
            .all()
        )
        for row in rows:
            stats["scanned"] += 1
            if not row.memorial_json:
                continue
            try:
                memorial = json.loads(row.memorial_json)
            except json.JSONDecodeError:
                continue
            if not isinstance(memorial, dict):
                continue
            if not find_memorial_contract_violations(memorial):
                continue
            if _patch_known_gaps(memorial):
                stats["patched"] += 1
                row.memorial_json = json.dumps(memorial, ensure_ascii=False)
            remaining = find_memorial_contract_violations(memorial)
            if remaining:
                stats["still_violating"] += 1

        if args.apply:
            db.commit()
        else:
            db.rollback()

    print(json.dumps({**stats, "applied": args.apply}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
