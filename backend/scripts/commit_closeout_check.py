#!/usr/bin/env python3
"""提交收口检查:把可提交改动和本地漂移分开。

默认用于提交前人工检查:
  python scripts/commit_closeout_check.py

用于 git hook 或 CI 的 staged 检查:
  python scripts/commit_closeout_check.py --staged-only

严格模式会要求工作区没有任何高风险漂移:
  python scripts/commit_closeout_check.py --strict
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
# 直接 `python scripts/commit_closeout_check.py` 运行时 sys.path[0] 是 scripts/ 本身，
# 不含项目根，import scripts.xxx 会失败——先把 ROOT 塞进 sys.path 再导入兄弟脚本。
sys.path.insert(0, str(ROOT))
from scripts.yushi_drift_monitor import changed_patch, scan_content_for_drift  # noqa: E402

RUNTIME_ARTIFACTS = (
    "data/",
    "events/",
    "reports/",
    "sessions/",
    "swarm_sessions/",
    "direct_cache/",
    "direct_feedback/",
    "repairs/",
    "memory/",
)
ENVIRONMENT_DRIFT = (
    ".env",
    "config/providers.yaml",
    "docker-compose.override.yaml",
)
GENERATED_ARTIFACTS = (
    "config/_generated/",
    "scripts/golden_cases/quality_baseline.json",
)
TEMP_ARTIFACTS = (
    ".pytest_cache/",
    ".ruff_cache/",
    "__pycache__/",
)


@dataclass(frozen=True)
class GitEntry:
    index_status: str
    worktree_status: str
    path: str

    @property
    def staged(self) -> bool:
        return self.index_status not in (" ", "?")

    @property
    def unstaged(self) -> bool:
        return self.worktree_status not in (" ", "")


def run_git_status(include_ignored: bool) -> list[GitEntry]:
    cmd = ["git", "status", "--porcelain=v1"]
    if include_ignored:
        cmd.append("--ignored=matching")
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)
    if proc.returncode != 0:
        print(proc.stderr.strip() or "git status failed", file=sys.stderr)
        raise SystemExit(proc.returncode)

    entries: list[GitEntry] = []
    for line in proc.stdout.splitlines():
        if not line:
            continue
        status = line[:2]
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        entries.append(GitEntry(status[0], status[1], path))
    return entries


def starts_with_any(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == prefix.rstrip("/") or path.startswith(prefix) for prefix in prefixes)


def category_for(path: str) -> tuple[str, str]:
    if starts_with_any(path, ENVIRONMENT_DRIFT):
        return "环境漂移", "本机 provider/API key/启动配置，不应进入功能提交"
    if starts_with_any(path, RUNTIME_ARTIFACTS):
        return "运行产物", "数据库、日志、会话、缓存，通常由运行过程产生"
    if starts_with_any(path, GENERATED_ARTIFACTS):
        return "生成/质量基线", "生成配置或质量基线；质量基线必须单独评估后提交"
    if starts_with_any(path, TEMP_ARTIFACTS):
        return "临时缓存", "解释器或测试缓存"
    return "待提交候选", "需要人工判断是否属于本轮目标"


def is_quality_baseline(path: str) -> bool:
    return path == "scripts/golden_cases/quality_baseline.json"


# 结构性/组织性词,不代表主题,查重时忽略,减少假阳性
_DOC_GENERIC_TOKENS = {
    "system", "design", "docs", "guide", "report", "review",
    "index", "overview", "protocol", "contract", "readme",
}


def _doc_topic_tokens(path: str) -> set[str]:
    """从文档文件名提取主题词(去掉 chaotang_ 这类组织前缀和通用词),用于粗粒度查重。"""
    stem = Path(path).stem.lower()
    if stem.startswith("chaotang_"):
        stem = stem[len("chaotang_"):]
    return {tok for tok in stem.split("_") if len(tok) >= 4 and tok not in _DOC_GENERIC_TOKENS}


def check_doc_duplicates(paths: list[str]) -> list[str]:
    """新增 docs/*.md 时提醒检查有没有同主题文档——钦天监4份文档重复的教训(2026-07-04)：
    `docs/qintianjian.md` 和 `docs/chaotang_qintianjian_system.md` 专家配对表逐字重复，
    写了两遍互不知道。这里只做提醒，不阻断，因为按词重叠匹配本身就不精确，宁可多提醒。
    """
    proc = subprocess.run(
        ["git", "ls-files", "docs"], cwd=ROOT, text=True, capture_output=True, check=False
    )
    existing = [p for p in proc.stdout.splitlines() if p.endswith(".md")]
    warnings: list[str] = []
    for path in paths:
        if not (path.startswith("docs/") and path.endswith(".md")):
            continue
        if path in existing:
            continue  # 已跟踪的旧文件改动，不是新建
        new_tokens = _doc_topic_tokens(path)
        if not new_tokens:
            continue
        hits = [e for e in existing if e != path and new_tokens & _doc_topic_tokens(e)]
        if hits:
            warnings.append(
                f"新文档 {path} 的主题词 {sorted(new_tokens)} 与已有文档重叠：{', '.join(hits[:3])}"
                "——先确认不是钦天监式的'设计写了两遍互不知道'再提交。"
            )
    return warnings


def print_group(title: str, entries: list[tuple[GitEntry, str]]) -> None:
    if not entries:
        return
    print(f"\n## {title}")
    for entry, reason in entries:
        flag = "staged" if entry.staged else "dirty"
        print(f"- [{flag}] {entry.path} — {reason}")


def main() -> int:
    parser = argparse.ArgumentParser(description="检查提交前的收口状态")
    parser.add_argument("--staged-only", action="store_true", help="只检查 staged 的高风险文件")
    parser.add_argument("--strict", action="store_true", help="工作区存在任何高风险漂移都返回失败")
    parser.add_argument("--include-ignored", action="store_true", help="同时展示 ignored 文件")
    parser.add_argument(
        "--allow-quality-baseline",
        action="store_true",
        help="允许已完成独立评估的 quality_baseline.json 进入本次检查",
    )
    args = parser.parse_args()

    entries = run_git_status(include_ignored=args.include_ignored)
    if args.staged_only:
        entries = [entry for entry in entries if entry.staged]

    candidates: list[tuple[GitEntry, str]] = []
    risky_staged: list[tuple[GitEntry, str]] = []
    risky_dirty: list[tuple[GitEntry, str]] = []
    ignored: list[tuple[GitEntry, str]] = []

    for entry in entries:
        category, reason = category_for(entry.path)
        if entry.index_status == "!" or entry.worktree_status == "!":
            ignored.append((entry, f"{category}；{reason}"))
        elif args.allow_quality_baseline and is_quality_baseline(entry.path):
            candidates.append((entry, "质量基线已显式放行；必须已先运行 python scripts/validate_flows.py 并绿灯"))
        elif category == "待提交候选":
            candidates.append((entry, reason))
        elif entry.staged:
            risky_staged.append((entry, f"{category}；{reason}"))
        else:
            risky_dirty.append((entry, f"{category}；{reason}"))

    print("收口检查")
    print(f"- staged 高风险: {len(risky_staged)}")
    print(f"- 未提交高风险漂移: {len(risky_dirty)}")
    print(f"- 待提交候选: {len(candidates)}")

    print_group("应人工确认后提交", candidates)
    print_group("不应提交：已 staged，必须先从暂存区移除", risky_staged)
    print_group("不应提交：留在本地或清理", risky_dirty)
    if args.include_ignored:
        print_group("已 ignored", ignored)

    doc_dup_warnings = check_doc_duplicates([entry.path for entry in entries])
    if doc_dup_warnings:
        print("\n## 文档主题查重提醒(不阻断)")
        for warning in doc_dup_warnings:
            print(f"- ⚠️ {warning}")

    try:
        drift_findings = scan_content_for_drift(changed_patch(staged_only=args.staged_only))
    except RuntimeError:
        drift_findings = []
    if drift_findings:
        print("\n## 御史偏移提醒(Web支线信号/重大事项未提钦天监,不阻断)")
        for finding in drift_findings:
            print(f"- ⚠️ {finding.reason} → {finding.recommendation}")

    if risky_staged:
        print("\n❌ 红灯：高风险文件已经 staged。请用 git restore --staged <path> 移出暂存区。")
        return 1
    if args.strict and risky_dirty:
        print("\n❌ 红灯：严格模式要求先处理本地高风险漂移。")
        return 1

    print("\n✅ 暂存区未混入运行产物、环境漂移或生成质量基线。")
    if risky_dirty:
        print("⚠️  工作区仍有本地漂移；提交时继续使用 git add <path> 精确分拣。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
