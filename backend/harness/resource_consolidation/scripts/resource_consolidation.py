#!/usr/bin/env python3
"""Inventory, absorb, and safely archive old-branch/dirty resources."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
HARNESS_ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = HARNESS_ROOT / "artifacts"
ARCHIVE_DIR = HARNESS_ROOT / "archive"

RUNTIME_PREFIXES = (
    "data/",
    "events/",
    "reports/",
    "sessions/",
    "swarm_sessions/",
    "direct_cache/",
    "direct_feedback/",
    "repairs/",
    "knowledge/flywheel/",
)
ENVIRONMENT_PATHS = {".env", "config/providers.yaml", "docker-compose.override.yaml"}
GENERATED_PATHS = {"scripts/golden_cases/quality_baseline.json", "config/ops_snapshot.yaml"}
TEMP_MARKERS = ("__pycache__/", ".pytest_cache/", ".ruff_cache/")
ABSORB_PREFIXES = (
    "harness/",
    "docs/",
    "scripts/",
    "tests/",
    "config/",
    "runtime_prompts/",
    "src/",
    "knowledge/docs/",
)


@dataclass(frozen=True)
class ResourceEntry:
    path: str
    status: str
    category: str
    action: str
    reason: str
    tracked: bool
    staged: bool
    size_bytes: int | None = None


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)


def _tracked_paths() -> set[str]:
    proc = _run(["git", "ls-files"])
    return set(proc.stdout.splitlines()) if proc.returncode == 0 else set()


def _status_entries() -> list[tuple[str, str]]:
    proc = _run(["git", "status", "--porcelain=v1", "--untracked-files=all"])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "git status failed")
    out: list[tuple[str, str]] = []
    for line in proc.stdout.splitlines():
        if not line:
            continue
        out.append((line[:2], line[3:]))
    return out


def _branches() -> list[dict[str, str]]:
    proc = _run(["git", "branch", "--all", "--verbose", "--no-abbrev"])
    branches = []
    if proc.returncode != 0:
        return branches
    for raw in proc.stdout.splitlines():
        line = raw.strip()
        current = line.startswith("*")
        if current:
            line = line[1:].strip()
        parts = line.split(None, 2)
        if len(parts) >= 2:
            branches.append({"name": parts[0], "sha": parts[1], "current": str(current).lower()})
    return branches


def _branch_diffs(current_branch: str, branches: list[dict[str, str]]) -> list[dict[str, str]]:
    diffs = []
    for branch in branches:
        name = branch["name"]
        if branch.get("current") == "true" or name.startswith("remotes/origin/HEAD"):
            continue
        proc = _run(["git", "diff", "--name-status", f"{current_branch}...{name}"])
        if proc.returncode != 0:
            continue
        for line in proc.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                diffs.append(
                    {
                        "branch": name,
                        "status": parts[0],
                        "path": parts[-1],
                        "suggested_action": classify_path(parts[-1], tracked=True, staged=False)[1],
                    }
                )
    return diffs


def _size(path: str) -> int | None:
    p = ROOT / path
    if not p.exists() or not p.is_file():
        return None
    return p.stat().st_size


def _starts(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == prefix.rstrip("/") or path.startswith(prefix) for prefix in prefixes)


def classify_path(path: str, tracked: bool, staged: bool) -> tuple[str, str, str]:
    if path in ENVIRONMENT_PATHS:
        return "environment_drift", "report_only", "local provider/API/env configuration"
    if path in GENERATED_PATHS:
        return "generated_release_input", "manual_review", "generated baseline/snapshot must be reviewed separately"
    if _starts(path, RUNTIME_PREFIXES):
        action = "keep_tracked_report_only" if tracked else "archive_candidate"
        return "runtime_artifact", action, "run output, report, cache, session, or flywheel artifact"
    if "/artifacts/" in path and path.startswith("harness/"):
        action = "keep_tracked_report_only" if tracked else "archive_candidate"
        return "harness_artifact", action, "generated harness result; archive after useful signal is captured"
    if any(marker in path for marker in TEMP_MARKERS):
        action = "keep_tracked_report_only" if tracked else "archive_candidate"
        return "temp_artifact", action, "interpreter/test cache"
    if _starts(path, ABSORB_PREFIXES):
        return "absorb_candidate", "manual_review", "possible product/harness/prompt/test/documentation asset"
    return "unknown_dirty", "manual_review", "not recognized; requires human classification"


def build_manifest() -> dict:
    tracked = _tracked_paths()
    entries = []
    for status, path in _status_entries():
        is_tracked = path in tracked
        staged = status[0] not in {" ", "?"}
        category, action, reason = classify_path(path, tracked=is_tracked, staged=staged)
        entries.append(
            ResourceEntry(
                path=path,
                status=status,
                category=category,
                action=action,
                reason=reason,
                tracked=is_tracked,
                staged=staged,
                size_bytes=_size(path),
            )
        )

    current_proc = _run(["git", "branch", "--show-current"])
    current_branch = current_proc.stdout.strip() if current_proc.returncode == 0 else ""
    branches = _branches()
    branch_diffs = _branch_diffs(current_branch, branches) if current_branch else []
    counts: dict[str, int] = {}
    for entry in entries:
        counts[entry.category] = counts.get(entry.category, 0) + 1

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "current_branch": current_branch,
            "mode": "dry-run",
        },
        "summary": {
            "dirty_count": len(entries),
            "archive_candidates": sum(1 for e in entries if e.action == "archive_candidate"),
            "absorb_candidates": sum(1 for e in entries if e.category == "absorb_candidate"),
            "manual_review": sum(1 for e in entries if e.action == "manual_review"),
            "category_counts": counts,
        },
        "branches": branches,
        "branch_diffs": branch_diffs,
        "entries": [asdict(e) for e in entries],
        "release_gate": {
            "safe_to_auto_delete": False,
            "tracked_files_moved": False,
            "requires_human_review": True,
            "apply_modes": ["archive", "quarantine-local-drift"],
        },
    }


def write_artifacts(manifest: dict) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS_DIR / "resource_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (ARTIFACTS_DIR / "resource_report.md").write_text(render_report(manifest), encoding="utf-8")


def render_report(manifest: dict) -> str:
    lines = [
        "# Resource Consolidation Report",
        "",
        f"Generated: {manifest['meta']['generated_at']}",
        f"Branch: `{manifest['meta']['current_branch']}`",
        "",
        "## Summary",
        "",
    ]
    for key, value in manifest["summary"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## Archive Candidates", ""])
    for entry in manifest["entries"]:
        if entry["action"] == "archive_candidate":
            lines.append(f"- `{entry['path']}` - {entry['reason']}")
    lines.extend(["", "## Absorb Candidates", ""])
    for entry in manifest["entries"]:
        if entry["category"] == "absorb_candidate":
            lines.append(f"- `{entry['path']}` - {entry['reason']}")
    lines.extend(["", "## Branch Resource Diffs", ""])
    if manifest["branch_diffs"]:
        for diff in manifest["branch_diffs"]:
            lines.append(f"- `{diff['branch']}` {diff['status']} `{diff['path']}` -> {diff['suggested_action']}")
    else:
        lines.append("- No branch-only file diffs detected against current branch.")
    lines.extend(
        [
            "",
            "## Gate",
            "",
            "- Auto-delete is disabled.",
            "- Use `--apply --mode archive` to move only untracked archive candidates.",
            "- Use `--apply --mode quarantine-local-drift` to back up and restore tracked local drift.",
            "- Review `absorb_candidate` entries before committing or deleting duplicates.",
        ]
    )
    return "\n".join(lines) + "\n"


def archive_candidates(manifest: dict) -> dict:
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_root = ARCHIVE_DIR / run_id
    moved = []
    skipped = []
    for entry in manifest["entries"]:
        if entry["action"] != "archive_candidate":
            continue
        src = ROOT / entry["path"]
        if entry["tracked"] or not src.exists():
            skipped.append({"path": entry["path"], "reason": "tracked or missing"})
            continue
        dest = archive_root / entry["path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        moved.append({"from": entry["path"], "to": str(dest.relative_to(ROOT))})
    archive_root.mkdir(parents=True, exist_ok=True)
    result = {"run_id": run_id, "moved": moved, "skipped": skipped}
    (archive_root / "restore_manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def _safe_archive_name(path: str) -> str:
    return path.replace("/", "__").replace("\\", "__")


def quarantine_local_drift(manifest: dict) -> dict:
    """Back up tracked local drift, then restore it to HEAD for release checks."""
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_root = ARCHIVE_DIR / run_id
    moved = []
    skipped = []
    high_risk_categories = {"environment_drift", "runtime_artifact", "generated_release_input", "temp_artifact"}

    for entry in manifest["entries"]:
        if not entry["tracked"] or entry["category"] not in high_risk_categories:
            continue
        src = ROOT / entry["path"]
        if not src.exists():
            skipped.append({"path": entry["path"], "reason": "missing"})
            continue

        backup = archive_root / "local_drift" / entry["path"]
        patch = archive_root / "patches" / f"{_safe_archive_name(entry['path'])}.patch"
        backup.parent.mkdir(parents=True, exist_ok=True)
        patch.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, backup)

        diff = _run(["git", "diff", "--binary", "--", entry["path"]])
        patch.write_text(diff.stdout, encoding="utf-8", errors="replace")

        restore = _run(["git", "restore", "--", entry["path"]])
        if restore.returncode != 0:
            skipped.append({"path": entry["path"], "reason": restore.stderr.strip() or "git restore failed"})
            continue
        moved.append(
            {
                "path": entry["path"],
                "backup": str(backup.relative_to(ROOT)),
                "patch": str(patch.relative_to(ROOT)),
            }
        )

    archive_root.mkdir(parents=True, exist_ok=True)
    result = {"run_id": run_id, "quarantined": moved, "skipped": skipped}
    (archive_root / "restore_manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Resource consolidation harness")
    parser.add_argument("--json", action="store_true", help="print manifest JSON")
    parser.add_argument("--report", action="store_true", help="print report markdown")
    parser.add_argument("--apply", action="store_true", help="apply safe cleanup")
    parser.add_argument("--mode", choices=["archive", "quarantine-local-drift"], default="archive")
    args = parser.parse_args()

    manifest = build_manifest()
    write_artifacts(manifest)

    result = None
    if args.apply:
        if args.mode == "archive":
            result = archive_candidates(manifest)
        else:
            result = quarantine_local_drift(manifest)

    if args.json:
        print(json.dumps({"manifest": manifest, "apply": result}, ensure_ascii=False, indent=2))
    elif args.report:
        print(render_report(manifest))
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"wrote {ARTIFACTS_DIR / 'resource_manifest.json'}")
        print(f"wrote {ARTIFACTS_DIR / 'resource_report.md'}")
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
