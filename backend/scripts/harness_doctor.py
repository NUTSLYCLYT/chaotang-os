#!/usr/bin/env python
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
HARNESS_ROOT = BACKEND_ROOT / "harness"
MANIFEST_PATH = HARNESS_ROOT / "manifest.json"

errors = 0
warnings = 0


def ok(message: str) -> None:
    print(f"[ok] {message}")


def warn(message: str) -> None:
    global warnings
    warnings += 1
    print(f"[warn] {message}")


def error(message: str) -> None:
    global errors
    errors += 1
    print(f"[error] {message}", file=sys.stderr)


def check_exists(path: Path, label: str) -> bool:
    if path.exists():
        ok(f"required: {label}")
        return True
    error(f"missing required file: {label}")
    return False


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_manifest() -> dict:
    if not check_exists(MANIFEST_PATH, "harness/manifest.json"):
        return {}
    try:
        manifest = json.loads(read_text(MANIFEST_PATH))
    except json.JSONDecodeError as exc:
        error(f"harness/manifest.json invalid JSON: {exc}")
        return {}
    ok("manifest: harness/manifest.json")
    return manifest


def check_harness_item(item: dict, group: str, known_ids: set[str]) -> None:
    item_id = item.get("id")
    if not item_id:
        error(f"{group}: missing id")
        return

    base = HARNESS_ROOT / item_id
    if not base.exists():
        error(f"{group} missing directory: {item_id}")
        return
    if not base.is_dir():
        error(f"{group} is not a directory: {item_id}")
        return

    known_ids.add(item_id)
    for rel in item.get("required", []):
        check_exists(base / rel, f"{group} {item_id}/{rel}")

    tests = item.get("tests", [])
    for rel in tests:
        check_exists(BACKEND_ROOT / rel, f"{group} {item_id} test: {rel}")

    implementation = item.get("implementation")
    if implementation and implementation not in known_ids and not (HARNESS_ROOT / implementation).exists():
        error(f"{group} {item_id}: implementation package missing: {implementation}")

    ok(f"{group}: {item_id}")


def check_change_records() -> None:
    change_root = HARNESS_ROOT / "changes"
    if not change_root.exists():
        warn("harness/changes is missing; backend changes are not yet traceable")
        return

    for change_dir in sorted(path for path in change_root.iterdir() if path.is_dir()):
        summary = change_dir / "summary.md"
        if not summary.exists():
            error(f"backend change {change_dir.name}: missing summary.md")
            continue

        body = read_text(summary)
        if f"| Change ID | {change_dir.name} |" not in body:
            error(f"backend change {change_dir.name}: summary Change ID mismatch")

        delivered = re.search(r"\|\s*Status\s*\|\s*DELIVERED\s*\|", body, re.I) is not None
        if delivered:
            required = [
                "summary.md",
                "request_analysis/spec.md",
                "request_analysis/tasks.md",
                "ci_result/ci_summary.md",
            ]
            for rel in required:
                check_exists(change_dir / rel, f"backend change {change_dir.name}/{rel}")

            placeholders = []
            for md in change_dir.rglob("*.md"):
                text = read_text(md)
                if re.search(r"\bTBD\b|\bPENDING\b|\{\{[A-Z_]+\}\}", text):
                    placeholders.append(md.relative_to(BACKEND_ROOT).as_posix())
            if placeholders:
                error(
                    f"backend change {change_dir.name}: DELIVERED but contains placeholders: "
                    + ", ".join(placeholders)
                )

        ok(f"backend change: {change_dir.name}")


def main() -> int:
    check_exists(HARNESS_ROOT / "README.md", "harness/README.md")
    check_exists(BACKEND_ROOT / "scripts" / "harness_doctor.py", "scripts/harness_doctor.py")

    manifest = load_manifest()
    known_ids: set[str] = set()

    for rel in manifest.get("shared", {}).get("required", []):
        check_exists(HARNESS_ROOT / rel, f"harness/{rel}")

    for item in manifest.get("primaryHarnesses", []):
        check_harness_item(item, "primary harness", known_ids)

    for item in manifest.get("implementationPackages", []):
        check_harness_item(item, "implementation package", known_ids)

    allowed = set(manifest.get("allowedInfrastructureDirs", []))
    for child in sorted(path for path in HARNESS_ROOT.iterdir() if path.is_dir()):
        if child.name not in known_ids and child.name not in allowed:
            warn(f"harness directory not represented in manifest: {child.name}")

    for command in manifest.get("verification", {}).get("architecture", []):
        if command != "python scripts/harness_doctor.py":
            warn(f"architecture verification command is external to this doctor: {command}")

    check_change_records()

    print()
    if errors:
        print(f"backend-harness-doctor: {errors} error(s), {warnings} warning(s)", file=sys.stderr)
        return 1
    print(f"backend-harness-doctor: 0 errors, {warnings} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
