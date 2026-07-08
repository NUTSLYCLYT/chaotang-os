#!/usr/bin/env python3
"""御史偏移监控器。

目标：防止把 Web/UI 支线、运行产物、环境漂移或未经钦天监的重大决策混进
jiqun_ai 主线仓。

默认检查当前 git 工作区改动：
  python scripts/yushi_drift_monitor.py

CI / pre-commit 可检查已暂存文件：
  python scripts/yushi_drift_monitor.py --staged-only
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

MAINLINE_ALLOWED_PREFIXES = (
    "AGENTS.md",
    ".gitignore",
    "pyproject.toml",
    "config/",
    "docs/",
    "harness/",
    "requirements",
    "runtime_prompts/",
    "scripts/",
    "src/",
    "tests/",
    "web/routers/",
    "web/schemas/",
    "web/main.py",
)

WEB_DRIFT_PREFIXES = (
    "app/",
    "components/",
    "pages/",
    "public/",
    "styles/",
    "web/app/",
    "web/components/",
    "web/pages/",
    "web/static/",
)

WEB_DRIFT_FILENAMES = (
    "next.config",
    "package.json",
    "tailwind.config",
    "postcss.config",
    "tsconfig.json",
    "vite.config",
)

RUNTIME_PREFIXES = (
    "data/",
    "events/",
    "reports/",
    "sessions/",
    "swarm_sessions/",
    "memory/",
    "direct_cache/",
    "direct_feedback/",
    "repairs/",
)

ENVIRONMENT_PATHS = (
    ".env",
    "config/providers.yaml",
    "docker-compose.override.yaml",
)

QINTIAN_REQUIRED_TERMS = (
    "上线",
    "生产",
    "客户承诺",
    "不可逆",
    "自动执行",
    "花钱",
    "架构分叉",
    "多蜂群",
    "删除",
    "报价",
    "合同",
)

WEB_CONTENT_TERMS = (
    "Next.js",
    "React component",
    "Tailwind",
    "页面样式",
    "浏览器截图",
    "钦天监",
    "chaotang-os/web",
    "chaotang-web-lyt",
)


@dataclass(frozen=True)
class DriftFinding:
    path: str
    severity: str
    reason: str
    recommendation: str


def starts_with_any(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == p.rstrip("/") or path.startswith(p) for p in prefixes)


def path_requires_attention(path: str) -> DriftFinding | None:
    if path in ENVIRONMENT_PATHS:
        return DriftFinding(
            path,
            "block",
            "环境漂移文件不属于主线功能提交。",
            "移出暂存区；必要时只保留本地。",
        )
    if starts_with_any(path, RUNTIME_PREFIXES):
        return DriftFinding(
            path,
            "block",
            "运行产物/日志/会话/缓存不属于主线功能提交。",
            "不要提交；如需基线更新，单独走质量基线流程。",
        )
    if starts_with_any(path, WEB_DRIFT_PREFIXES) or any(
        Path(path).name.startswith(name) for name in WEB_DRIFT_FILENAMES
    ):
        return DriftFinding(
            path,
            "block",
            "疑似 Web/UI 支线改动，jiqun_ai 主线不承接页面/组件/样式。",
            "回到 /home/ubuntu/workspace/chaotang-web-lyt 或对应 Web 仓处理。",
        )
    if not starts_with_any(path, MAINLINE_ALLOWED_PREFIXES):
        return DriftFinding(
            path,
            "warn",
            "路径不在主线常规承接范围。",
            "确认是否属于后端/蜂群/flow/harness/质量基线/钦天监证据链。",
        )
    return None


def changed_paths(staged_only: bool = False) -> list[str]:
    cmd = ["git", "diff", "--name-only", "--cached" if staged_only else "HEAD"]
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "git diff failed")
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def changed_patch(staged_only: bool = False) -> str:
    cmd = ["git", "diff", "--cached" if staged_only else "HEAD", "--"]
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "git diff failed")
    return proc.stdout


def scan_content_for_drift(patch_text: str) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    added_lines = [
        line[1:]
        for line in patch_text.splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]
    joined = "\n".join(added_lines)

    for term in WEB_CONTENT_TERMS:
        if term in joined:
            findings.append(
                DriftFinding(
                    "<diff>",
                    "warn",
                    f"新增内容出现 Web/UI 支线信号：{term}",
                    "确认是否只是纠偏记录；若是产品实现，请迁往 Web 仓。",
                )
            )

    if any(term in joined for term in QINTIAN_REQUIRED_TERMS) and "钦天监" not in joined:
        findings.append(
            DriftFinding(
                "<diff>",
                "warn",
                "新增内容疑似重大/不可逆/生产/多蜂群事项，但未提到钦天监。",
                "先形成钦天监简报，再进入执行或提交。",
            )
        )
    return findings


def evaluate(paths: list[str], patch_text: str) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    for path in paths:
        finding = path_requires_attention(path)
        if finding:
            findings.append(finding)
    findings.extend(scan_content_for_drift(patch_text))
    return findings


def render(findings: list[DriftFinding]) -> str:
    if not findings:
        return "御史偏移监控：通过。未发现主线偏移信号。"

    lines = ["御史偏移监控：发现风险。"]
    for finding in findings:
        icon = "⛔" if finding.severity == "block" else "⚠️"
        lines.extend(
            [
                f"- {icon} {finding.path}",
                f"  原因：{finding.reason}",
                f"  处置：{finding.recommendation}",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="御史偏移监控器")
    parser.add_argument("--staged-only", action="store_true", help="只检查已暂存改动")
    args = parser.parse_args()

    try:
        paths = changed_paths(staged_only=args.staged_only)
        patch_text = changed_patch(staged_only=args.staged_only)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    findings = evaluate(paths, patch_text)
    print(render(findings))
    return 1 if any(f.severity == "block" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
