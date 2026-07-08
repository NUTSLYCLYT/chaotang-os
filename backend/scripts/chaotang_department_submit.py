#!/usr/bin/env python3
"""Submit a daily department output through the Chaotang protocol and Yushi gate."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.chaotang_department_payload import build_security_poc_payload, build_text_payload


ROOT = Path(__file__).resolve().parent.parent
PROTOCOL_RUNNER = ROOT / "harness" / "chaotang_department_protocol" / "scripts" / "run_protocol.py"
DEFAULT_JSON_OUT = ROOT / "harness" / "chaotang_department_protocol" / "artifacts" / "submit_latest.json"
DEFAULT_MD_OUT = ROOT / "harness" / "chaotang_department_protocol" / "artifacts" / "submit_latest.md"
DEFAULT_LEDGER = ROOT / "harness" / "chaotang_department_protocol" / "artifacts" / "submit_ledger.jsonl"


def load_protocol_runner():
    spec = importlib.util.spec_from_file_location("chaotang_department_protocol_runner", PROTOCOL_RUNNER)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot load department protocol runner")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def build_payload(args: argparse.Namespace) -> dict:
    if args.security_poc_report:
        return build_security_poc_payload(args.security_poc_report, run_id=args.run_id)
    evidence = []
    for item in args.evidence:
        if "=" in item:
            source, status = item.split("=", 1)
        else:
            source, status = item, "ok"
        evidence.append({"source": source, "status": status})
    return build_text_payload(
        department=args.department,
        summary=args.summary,
        run_id=args.run_id,
        output_type=args.output_type,
        evidence=evidence,
        next_action=args.next_action,
        automation_level_requested=args.automation_level,
        human_signoff=args.human_signoff,
        qintianjian_brief=args.qintianjian_brief,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Submit a department output through protocol + Yushi gate.")
    parser.add_argument("--department", default="gongbu", help="Department slug or Chinese name")
    parser.add_argument("--summary", default="", help="Department output summary")
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--output-type", default=None)
    parser.add_argument("--next-action", default="进入部门协同协议和御史总判。")
    parser.add_argument("--automation-level", default=None)
    parser.add_argument("--evidence", action="append", default=[], help="Evidence source or source=status; repeatable")
    parser.add_argument("--human-signoff", action="store_true")
    parser.add_argument("--qintianjian-brief", action="store_true")
    parser.add_argument("--security-poc-report", type=Path, default=None)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--print-payload", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.security_poc_report and not args.summary:
        print("--summary is required unless --security-poc-report is provided", file=sys.stderr)
        return 2
    payload = build_payload(args)
    if args.print_payload:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    runner = load_protocol_runner()
    report = runner.build_report([{"case_id": payload["run_id"], "payload": payload}], runner.load_config())
    runner.write_report(report, args.json_out, args.md_out)
    runner.append_ledger(report, args.ledger)
    print(f"chaotang_department_submit complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
