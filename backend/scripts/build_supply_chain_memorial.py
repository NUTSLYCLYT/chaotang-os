#!/usr/bin/env python3
"""生成户部供应链司奏折(JSON/Markdown)。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.supply_chain_import_parser import build_supply_chain_memorial  # noqa: E402


def _render_markdown(memorial: dict) -> str:
    lines = [
        "# 户部供应链司奏折",
        "",
        f"- 状态：{memorial['status']}",
        f"- sourceLabel：{memorial['sourceLabel']}",
        f"- 截止日期：{memorial['asOf']}",
        f"- 7天内应付：{memorial['boss_brief']['payablesDue7d']}",
        f"- 库存占用：{memorial['boss_brief']['inventoryValue']}",
        f"- 审计发现：{memorial['boss_brief']['auditFindings']}",
        "",
        "## 老板摘要",
        "",
        memorial.get("boss_summary", "证据不足,请补齐供应链导入文件。"),
        "",
        "## 风险问题",
        "",
    ]
    issues = memorial.get("riskIssues") or []
    if issues:
        for issue in issues:
            lines.append(f"- [{issue['severity']}] {issue['title']}：{issue['detail']}")
    else:
        lines.append("- 暂未发现确定性风险。")
    lines.extend(
        [
            "",
            "## 老板裁决选项",
            "",
        ]
    )
    for option in memorial.get("decisionOptions", ["return_for_evidence", "save_draft_only"]):
        lines.append(f"- {option}")
    lines.extend(
        [
            "",
            "## 禁止动作",
            "",
        ]
    )
    for action in memorial.get("forbiddenActions", []):
        lines.append(f"- {action}")
    lines.extend(
        [
            "",
            "说明：本奏折仅用于供应链复核和老板裁决，不得自动付款，不得自动下单，不得删除原始证据。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="户部供应链司奏折生成器")
    parser.add_argument("--input-dir", required=True, help="供应链 CSV 导入目录")
    parser.add_argument("--output", required=True, help="输出 JSON/Markdown 文件")
    parser.add_argument("--format", choices=["json", "md"], default="json")
    parser.add_argument("--as-of", default=None, help="检查日期 YYYY-MM-DD")
    args = parser.parse_args()

    memorial = build_supply_chain_memorial(Path(args.input_dir), as_of=args.as_of)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    if args.format == "json":
        output.write_text(json.dumps(memorial, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        output.write_text(_render_markdown(memorial), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
