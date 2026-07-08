"""scripts/ci_gate.py — 合并前一道总门(把宪法/协议校验变成真卡门)。

聚合跑全院结构性校验,任一红灯整体 exit 1。无 GitHub Actions 时,这是"合并前必跑的一条命令";
可挂进 pre-commit / CI / nightly。让 dept_constitution 的铁律从盼望变强制。

  - 部门宪法一致性(validate_dept_conformance)
  - 大神协议接入(validate_advisor_protocols)
不依赖 LLM,纯静态。
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GATES = [
    ("部门宪法一致性", "validate_dept_conformance.py"),
    ("大神协议接入", "validate_advisor_protocols.py"),
    # 网关感知门:无 LLM key 自动跳过(不破静态 CI);有 key(nightly/本地)则强制判决质量不退步
    ("真实样本判决回归", "real_sample_regression.py"),
]


def main() -> int:
    failed = []
    for title, script in GATES:
        path = ROOT / "scripts" / script
        print(f"\n===== {title}({script})=====")
        if not path.exists():
            print(f"  ⚠️ 跳过:{script} 不存在")
            continue
        proc = subprocess.run([sys.executable, str(path)], cwd=ROOT, check=False)
        if proc.returncode != 0:
            failed.append(title)
    print("\n" + "=" * 56)
    if failed:
        print(f"❌ CI 门:{len(failed)} 项违规 → {', '.join(failed)}(不得合并)")
        return 1
    print("✅ CI 门:全院结构性校验通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
