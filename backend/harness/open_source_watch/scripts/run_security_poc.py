from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
DEFAULT_TOOLS = ROOT / "security_tools.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "security_poc_latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "security_poc_latest.md"
DEFAULT_TOOLS_BIN = ROOT / "tools" / "bin"

CommandRunner = Callable[[list[str], Path, int], subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class ToolResult:
    name: str
    repo: str
    owner: str
    status: str
    installed: bool
    executable: str | None
    version_command: list[str]
    poc_command: list[str]
    version_exit_code: int | None
    poc_exit_code: int | None
    missing_env: list[str]
    install: list[str]
    next_action: str
    evidence: list[dict[str, Any]]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def truncate(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[truncated]"


def default_runner(command: list[str], cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=timeout, check=False)


def local_which(tools_bin: Path) -> Callable[[str], str | None]:
    def find(name: str) -> str | None:
        local = tools_bin / name
        if local.exists():
            return str(local)
        return shutil.which(name)

    return find


def load_tool_specs(path: Path = DEFAULT_TOOLS) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def command_evidence(
    *,
    command: list[str],
    cwd: Path,
    phase: str,
    proc: subprocess.CompletedProcess[str] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    evidence: dict[str, Any] = {
        "phase": phase,
        "command": command,
        "cwd": str(cwd),
        "captured_at": utc_now(),
    }
    if proc is not None:
        evidence.update(
            {
                "exit_code": proc.returncode,
                "stdout": truncate(proc.stdout or ""),
                "stderr": truncate(proc.stderr or ""),
            }
        )
        summary = summarize_osv_stdout(proc.stdout or "")
        if summary:
            evidence["finding_summary"] = summary
    if error:
        evidence["error"] = error
    return evidence


def summarize_osv_stdout(stdout: str) -> dict[str, Any] | None:
    text = stdout.strip()
    if not text.startswith("{"):
        return None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    results = payload.get("results")
    if not isinstance(results, list):
        return None
    packages = 0
    groups = 0
    max_severity = 0.0
    affected: list[str] = []
    for result in results:
        for package_result in result.get("packages", []):
            package = package_result.get("package", {})
            name = package.get("name")
            version = package.get("version")
            if name:
                affected.append(f"{name}=={version}" if version else str(name))
            packages += 1
            for group in package_result.get("groups", []):
                groups += 1
                try:
                    max_severity = max(max_severity, float(group.get("max_severity", 0) or 0))
                except (TypeError, ValueError):
                    continue
    return {
        "affected_packages": packages,
        "vulnerability_groups": groups,
        "max_severity": max_severity,
        "affected": sorted(set(affected))[:20],
    }


def evaluate_tool(
    spec: dict[str, Any],
    *,
    cwd: Path = PROJECT_ROOT,
    run_poc: bool = False,
    timeout: int = 120,
    runner: CommandRunner = default_runner,
    which: Callable[[str], str | None] = shutil.which,
    env: dict[str, str] | None = None,
) -> ToolResult:
    env_values = env if env is not None else os.environ
    version_command = list(spec["version_command"])
    poc_command = list(spec["poc_command"])
    executable = which(version_command[0])
    missing_env = [name for name in spec.get("requires_env", []) if not env_values.get(name)]
    evidence = [
        {
            "phase": "docs",
            "sources": spec.get("evidence_sources", []),
            "captured_at": utc_now(),
        }
    ]

    if not executable:
        return ToolResult(
            name=spec["name"],
            repo=spec["repo"],
            owner=spec.get("owner", "yushi"),
            status="missing_tool",
            installed=False,
            executable=None,
            version_command=version_command,
            poc_command=poc_command,
            version_exit_code=None,
            poc_exit_code=None,
            missing_env=missing_env,
            install=list(spec.get("install", [])),
            next_action="工部安装工具后重跑；御史保留安装来源和版本证据。",
            evidence=evidence,
        )

    version_command[0] = executable
    if poc_command and poc_command[0] == spec["version_command"][0]:
        poc_command[0] = executable

    version_proc: subprocess.CompletedProcess[str] | None = None
    poc_proc: subprocess.CompletedProcess[str] | None = None
    try:
        version_proc = runner(version_command, cwd, timeout)
        evidence.append(command_evidence(command=version_command, cwd=cwd, phase="version", proc=version_proc))
    except (OSError, subprocess.TimeoutExpired) as exc:
        evidence.append(command_evidence(command=version_command, cwd=cwd, phase="version", error=str(exc)))
        return ToolResult(
            name=spec["name"],
            repo=spec["repo"],
            owner=spec.get("owner", "yushi"),
            status="version_failed",
            installed=True,
            executable=executable,
            version_command=version_command,
            poc_command=poc_command,
            version_exit_code=None,
            poc_exit_code=None,
            missing_env=missing_env,
            install=list(spec.get("install", [])),
            next_action="工部修复工具安装或 PATH；御史复核二进制来源。",
            evidence=evidence,
        )

    if version_proc.returncode != 0:
        return ToolResult(
            name=spec["name"],
            repo=spec["repo"],
            owner=spec.get("owner", "yushi"),
            status="version_failed",
            installed=True,
            executable=executable,
            version_command=version_command,
            poc_command=poc_command,
            version_exit_code=version_proc.returncode,
            poc_exit_code=None,
            missing_env=missing_env,
            install=list(spec.get("install", [])),
            next_action="工部修复工具安装或 PATH；御史复核二进制来源。",
            evidence=evidence,
        )

    if run_poc and missing_env:
        return ToolResult(
            name=spec["name"],
            repo=spec["repo"],
            owner=spec.get("owner", "yushi"),
            status="poc_blocked_missing_env",
            installed=True,
            executable=executable,
            version_command=version_command,
            poc_command=poc_command,
            version_exit_code=version_proc.returncode,
            poc_exit_code=None,
            missing_env=missing_env,
            install=list(spec.get("install", [])),
            next_action="补只读环境变量后再跑 POC；不要把 token 写入仓库。",
            evidence=evidence,
        )

    if not run_poc:
        return ToolResult(
            name=spec["name"],
            repo=spec["repo"],
            owner=spec.get("owner", "yushi"),
            status="ready" if not missing_env else "ready_missing_env",
            installed=True,
            executable=executable,
            version_command=version_command,
            poc_command=poc_command,
            version_exit_code=version_proc.returncode,
            poc_exit_code=None,
            missing_env=missing_env,
            install=list(spec.get("install", [])),
            next_action="可执行 POC；若缺 token，先补只读环境变量再跑远程仓库评分。",
            evidence=evidence,
        )

    try:
        poc_proc = runner(poc_command, cwd, timeout)
        evidence.append(command_evidence(command=poc_command, cwd=cwd, phase="poc", proc=poc_proc))
    except (OSError, subprocess.TimeoutExpired) as exc:
        evidence.append(command_evidence(command=poc_command, cwd=cwd, phase="poc", error=str(exc)))
        return ToolResult(
            name=spec["name"],
            repo=spec["repo"],
            owner=spec.get("owner", "yushi"),
            status="poc_failed",
            installed=True,
            executable=executable,
            version_command=version_command,
            poc_command=poc_command,
            version_exit_code=version_proc.returncode,
            poc_exit_code=None,
            missing_env=missing_env,
            install=list(spec.get("install", [])),
            next_action="工部排查命令失败；御史根据 stderr 判断是否阻断采用。",
            evidence=evidence,
        )

    status = "poc_passed" if poc_proc.returncode == 0 else "poc_needs_review"
    return ToolResult(
        name=spec["name"],
        repo=spec["repo"],
        owner=spec.get("owner", "yushi"),
        status=status,
        installed=True,
        executable=executable,
        version_command=version_command,
        poc_command=poc_command,
        version_exit_code=version_proc.returncode,
        poc_exit_code=poc_proc.returncode,
        missing_env=missing_env,
        install=list(spec.get("install", [])),
        next_action="史馆归档输出；御史判断是否进入常规依赖/仓库安全门禁。",
        evidence=evidence,
    )


def build_report(
    specs: list[dict[str, Any]],
    *,
    cwd: Path = PROJECT_ROOT,
    run_poc: bool = False,
    timeout: int = 120,
) -> dict[str, Any]:
    results = [evaluate_tool(spec, cwd=cwd, run_poc=run_poc, timeout=timeout) for spec in specs]
    return {
        "generated_at": utc_now(),
        "harness": "open_source_security_poc",
        "target": str(cwd),
        "run_poc": run_poc,
        "summary": {
            status: sum(1 for result in results if result.status == status)
            for status in [
                "missing_tool",
                "ready",
                "ready_missing_env",
                "version_failed",
                "poc_passed",
                "poc_needs_review",
                "poc_failed",
                "poc_blocked_missing_env",
            ]
        },
        "results": [asdict(result) for result in results],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 开源安全工具 POC 报告",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- harness: `{report['harness']}`",
        f"- target: `{report['target']}`",
        f"- run_poc: `{report['run_poc']}`",
        "",
        "## Summary",
        "",
    ]
    for status, count in report["summary"].items():
        lines.append(f"- `{status}`: {count}")
    lines.extend(
        [
            "",
            "## Tools",
            "",
            "| Tool | Status | Owner | Missing env | Next action |",
            "|---|---:|---|---|---|",
        ]
    )
    for item in report["results"]:
        missing_env = ", ".join(item["missing_env"]) or "-"
        lines.append(
            f"| `{item['name']}` | `{item['status']}` | {item['owner']} | "
            f"{missing_env} | {item['next_action']} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_report(report: dict[str, Any], json_out: Path = DEFAULT_JSON_OUT, md_out: Path = DEFAULT_MD_OUT) -> None:
    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_out.write_text(render_markdown(report), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run or prepare security-tool POCs for adopted open-source tools.")
    parser.add_argument("--tools", type=Path, default=DEFAULT_TOOLS)
    parser.add_argument("--target", type=Path, default=PROJECT_ROOT)
    parser.add_argument("--run-poc", action="store_true", help="Run POC commands after version checks pass")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--tools-bin", type=Path, default=DEFAULT_TOOLS_BIN)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    specs = load_tool_specs(args.tools)
    results = [
        evaluate_tool(
            spec,
            cwd=args.target.resolve(),
            run_poc=args.run_poc,
            timeout=args.timeout,
            which=local_which(args.tools_bin),
        )
        for spec in specs
    ]
    report = {
        "generated_at": utc_now(),
        "harness": "open_source_security_poc",
        "target": str(args.target.resolve()),
        "run_poc": args.run_poc,
        "summary": {
            status: sum(1 for result in results if result.status == status)
            for status in [
                "missing_tool",
                "ready",
                "ready_missing_env",
                "version_failed",
                "poc_passed",
                "poc_needs_review",
                "poc_failed",
                "poc_blocked_missing_env",
            ]
        },
        "results": [asdict(result) for result in results],
    }
    write_report(report, args.json_out, args.md_out)
    summary = ", ".join(f"{key}={value}" for key, value in report["summary"].items())
    print(f"open_source_security_poc complete: {summary}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
