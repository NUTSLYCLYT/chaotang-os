#!/usr/bin/env python3
"""Check or explicitly adopt an unversioned legacy primary database."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_ROOT))

from src.schema_adoption import (  # noqa: E402
    AdoptionError,
    adopt_unversioned_database,
    inspect_unversioned_database,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="explicit read-only compatibility check")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--backup",
        type=Path,
        help="required with --apply; consistent SQLite backup, never overwritten",
    )
    parser.add_argument(
        "--alembic-ini",
        type=Path,
        default=_BACKEND_ROOT / "alembic.ini",
    )
    args = parser.parse_args()
    try:
        report = inspect_unversioned_database(args.db_url)
    except AdoptionError as exc:
        print(json.dumps({"error": str(exc), "mode": "apply" if args.apply else "check"}, ensure_ascii=False))
        return 2
    print(
        json.dumps(
            {
                "compatible": report.compatible,
                "adopt_revision": report.adopt_revision,
                "mismatches": report.mismatches,
                "mode": "apply" if args.apply else "check",
            },
            ensure_ascii=False,
        )
    )
    if not report.compatible:
        return 2
    if not args.apply:
        return 0
    try:
        result = adopt_unversioned_database(
            args.db_url,
            alembic_ini=args.alembic_ini,
            backup_path=args.backup,
            apply=True,
        )
    except AdoptionError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 2
    print(
        json.dumps(
            {
                "adopted_revision": result.adopted_revision,
                "current_revision": result.current_revision,
                "backup_path": result.backup_path,
                "backup_sha256": result.backup_sha256,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
