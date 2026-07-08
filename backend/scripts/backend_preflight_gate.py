#!/usr/bin/env python3
"""Backend preflight gate: model gateway + swarm admission + eval timeout."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check backend preflight readiness.")
    parser.add_argument("--window", type=int, default=30, help="Governance score window.")
    parser.add_argument("--json", action="store_true", help="Print full JSON report.")
    args = parser.parse_args()

    from src.backend_preflight import build_preflight_report

    report = build_preflight_report(window=args.window)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        admission = report["swarmAdmission"]
        print(f"overallStatus={report['overallStatus']}")
        print(f"blockers={','.join(report['blockers']) or '-'}")
        print(f"warnings={','.join(report['warnings']) or '-'}")
        print(f"swarmCounts={admission['counts']}")
        print(f"scoreSwarmTimeout={report['scoreSwarm']['caseTimeoutSeconds']}s")
    return 1 if report["overallStatus"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main())
