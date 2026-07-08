"""工部取证式审查 一条命令闭环：抓真实 diff → 喂工部蜂群 → 验 catch-rate → 记台账。

把三块拼成可用闭环(大神硬伤治本后的 capstone)：
  code_context(取证) → swarm-run gongbu_review(审真代码) → gongbu_review_check(验抓到没) → truth_ledger

用法：
  # 1) 只看喂给工部的 grounded 上下文(不跑 LLM)：
  python scripts/gongbu_review_run.py context --base HEAD~5
  # 2) 真跑工部审本会话改动(需代理健康 + .env 已加载)：
  set -a; . ./.env; set +a
  python scripts/gongbu_review_run.py run --base HEAD~5 --provider deepseek
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

# 直接 `python scripts/x.py` 运行时,repo 根不在 sys.path → from src.* 导入失败。引导之。
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.code_context import build_review_context  # noqa: E402

_REVIEW_INSTRUCTION = (
    "\n\n【审查要求】严格基于上面的真实 diff(不是任何描述),从 4 方面逐条审查并指到具体文件/行：\n"
    "1. 代码质量 2. 安全红线(注入/吞异常/密钥) 3. 功能正确性 4. 可交付性(测试/回滚/不可逆风险)。\n"
    "输出：每条 finding 标 severity(critical/high/medium/low) + 证据行 + 修复建议；最后给发布建议。\n"
    "若无可审材料(diff 为空)，直接说明，不得凭空夸或编造。"
)


def build_gongbu_task(*, base: str = "HEAD", paths: list[str] | None = None, max_chars: int = 20000) -> str:
    """组装喂给工部蜂群的 task(grounded 上下文 + 审查要求)。纯函数,可测,不跑 LLM。"""
    ctx = build_review_context(base=base, paths=paths, max_chars=max_chars)
    return ctx["context_text"] + _REVIEW_INSTRUCTION


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="工部取证式审查闭环")
    sub = p.add_subparsers(dest="cmd", required=True)
    pc = sub.add_parser("context", help="只打印喂给工部的 grounded 上下文(不跑 LLM)")
    pc.add_argument("--base", default="HEAD")
    pc.add_argument("--paths", nargs="*", default=None)
    pr = sub.add_parser("run", help="真跑工部审真代码(需代理健康)")
    pr.add_argument("--base", default="HEAD")
    pr.add_argument("--paths", nargs="*", default=None)
    pr.add_argument("--provider", default="deepseek")
    args = p.parse_args(argv)

    task = build_gongbu_task(base=args.base, paths=args.paths)
    if args.cmd == "context":
        print(task)
        return 0
    # run：把 grounded task 交给现有 swarm-run(继承调用方 env/代理),工部审真代码
    cmd = ["python3", "cli.py", "swarm-run", task, "--entry", "gongbu_review", "--provider", args.provider]
    print(f"[gongbu] 审查 {args.base} 改动(grounded,{len(task)} 字)→ swarm-run gongbu_review")
    return subprocess.run(cmd, check=False).returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
