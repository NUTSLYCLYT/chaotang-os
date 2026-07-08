from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.production_events import release_gate_snapshot


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check production observability release gate.")
    parser.add_argument("--events", type=Path, default=None, help="Optional production events jsonl path.")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--allow-empty", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot = release_gate_snapshot(limit=args.limit, path=args.events)
    empty_allowed = args.allow_empty and snapshot["events_considered"] == 0
    print(json.dumps(snapshot, ensure_ascii=False, indent=2, sort_keys=True))
    if snapshot["ready"] or empty_allowed:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
