#!/usr/bin/env python3
"""Backfill legacy Retrospective rows into the canonical outcome ledger.

Default mode is a transactionally rolled-back dry run. Pass ``--apply`` to commit.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.archive_outcomes import backfill_legacy_retrospectives  # noqa: E402
from src.db.engine import SessionLocal  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="commit appended outcome events (default: dry-run and rollback)",
    )
    args = parser.parse_args()

    with SessionLocal() as session:
        stats = backfill_legacy_retrospectives(session=session)
        if args.apply:
            session.commit()
        else:
            session.rollback()
    print(json.dumps({**stats, "applied": args.apply}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
