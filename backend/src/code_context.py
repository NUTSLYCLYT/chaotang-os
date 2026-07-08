"""工部取证式审查的地基：抓真实 git diff + 变更文件，产出 grounded 审查上下文。

大神会审硬伤(2026-06-10)：gongbu_review 原来只从 task_input(文本描述)审查，读不到真代码，
是"复述式审查"(Harrison Chase: 没工具的审查 agent 在背诵 / Addy: 喂它描述还你想象)。
本模块把"真实改动"抓进上下文，让四审有真料可审 —— 工部从复述式 → 取证式的治本第一刀。

设计：run_git 可注入(测试不依赖真 git)；输出有界(max_chars，防 context 爆炸)，截断显式标注(不静默)。
"""

from __future__ import annotations

import subprocess
from collections.abc import Callable


def _real_git(args: list[str]) -> str:
    """跑 git 命令返回 stdout(失败返回空串,不抛——审查上下文缺失不该阻断)。"""
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True, timeout=20, check=False).stdout
    except Exception:  # noqa: BLE001
        return ""


def build_review_context(
    *,
    base: str = "HEAD",
    paths: list[str] | None = None,
    max_chars: int = 20000,
    run_git: Callable[[list[str]], str] | None = None,
) -> dict:
    """抓真实改动产出 grounded 审查上下文。

    返回 {stat, diff, files_changed, truncated, context_text}。
    - stat: `git diff --stat` 概览
    - diff: 真实 unified diff(有界)
    - files_changed: 变更文件清单
    - truncated: diff 是否被 max_chars 截断(显式,不静默)
    - context_text: 拼好的、可直接喂给工部 task_input 的审查上下文
    """
    run_git = run_git or _real_git
    diff_args = ["diff", base]
    stat_args = ["diff", "--stat", base]
    name_args = ["diff", "--name-only", base]
    if paths:
        diff_args += ["--", *paths]
        stat_args += ["--", *paths]
        name_args += ["--", *paths]

    stat = run_git(stat_args).strip()
    diff = run_git(diff_args)
    files_changed = [f for f in run_git(name_args).splitlines() if f.strip()]

    # 未跟踪(新建)文件 git diff HEAD 看不到——审查工具必须覆盖,否则新增代码成盲区。
    # 用 --no-index 对 /dev/null 出"新文件全量 diff"(仅当未限定 paths 或文件在 paths 内)。
    untracked = [f for f in run_git(["ls-files", "--others", "--exclude-standard"]).splitlines() if f.strip()]
    if paths:
        untracked = [f for f in untracked if f in paths]
    for f in untracked:
        nd = run_git(["diff", "--no-index", "/dev/null", f])
        if nd.strip():
            diff += f"\n{nd}"
            files_changed.append(f)

    truncated = len(diff) > max_chars
    diff_shown = diff[:max_chars] + ("\n…(diff 已截断,超过 max_chars)…" if truncated else "")

    has_real_code = bool(diff.strip())
    context_text = (
        "【真实改动取证(git diff)——审查必须基于以下真实代码,而非任务描述】\n"
        f"变更文件({len(files_changed)}): {', '.join(files_changed) or '(无)'}\n\n"
        f"--- 改动概览 ---\n{stat or '(无改动)'}\n\n"
        f"--- 真实 diff ---\n{diff_shown or '(无 diff——可能未改动或 base 错误,审查应据此指出无可审材料)'}"
    )
    return {
        "stat": stat,
        "diff": diff,
        "files_changed": files_changed,
        "truncated": truncated,
        "has_real_code": has_real_code,
        "context_text": context_text,
    }
