#!/usr/bin/env python3
"""朝堂任务启动路由:把一句需求分到合适执行模式。

用法:
  python scripts/chaotang_task_protocol.py "修复 OPC 评分不稳定，并提交"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.task_protocol import TaskProtocol, classify_task


def render(protocol: TaskProtocol) -> str:
    lines = [
        f"推荐模式：{protocol.mode}",
        f"原因：{protocol.reason}",
        f"人工签字：{'需要' if protocol.signoff_required else '暂不需要'}",
        "下一步：",
    ]
    lines.extend(f"{idx}. {step}" for idx, step in enumerate(protocol.next_steps, start=1))
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="朝堂任务启动路由")
    parser.add_argument("task", nargs="+", help="用户原始任务描述")
    args = parser.parse_args()
    print(render(classify_task(" ".join(args.task))))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
