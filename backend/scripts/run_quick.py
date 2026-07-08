#!/usr/bin/env python3
"""员工一键入口 — 三个最常用蜂群的快捷命令。

用法：python scripts/run_quick.py

然后选数字就行，无需记忆路径和参数。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)


def _read_input() -> str:
    """如果参数传入则直接使用，否则从 stdin 读取。"""
    if len(sys.argv) > 2:
        return sys.argv[2]
    print("粘贴工单/需求文本后按回车（Ctrl+D结束多行输入）：")
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except (EOFError, KeyboardInterrupt):
        pass
    return "\n".join(lines).strip()


def main() -> int:
    print()
    print("=" * 56)
    print("  本司新能源 · 蜂群平台员工入口")
    print("=" * 56)
    print()
    print("  蜂群              编号  用途")
    print("  报价蜂群          1    客户报价需求")
    print("  售后诊断蜂群      2    现场故障工单")
    print("  PACK研发蜂群      3    产品设计评审")
    print("  查看今天质量报告  4    governance_monitor")
    print("  史馆归档          5    archive_manager")
    print()
    print("  Ctrl+C 退出")
    print()

    try:
        choice = input("请选择（输入编号后回车）: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return 0

    if choice == "4":
        os.execvp("python3", ["python3", "scripts/governance_monitor.py", "--window", "4"])
    elif choice == "5":
        os.execvp("python3", ["python3", "scripts/archive_manager.py", "--governance"])

    flow_map = {
        "1": "config/flow_quotation.yaml",
        "2": "config/flow_storage_aftercare.yaml",
        "3": "config/flow_pack_rd.yaml",
    }
    flow_path = flow_map.get(choice)
    if not flow_path:
        print(f"无效选择: {choice}")
        return 1

    print(f"\n正在加载蜂群（首次加载可能10-20秒）...")
    task = _read_input()

    from scripts.run_flow import main as run_main

    sys.argv = ["run_flow.py", flow_path, task]
    return run_main()


if __name__ == "__main__":
    sys.exit(main())
