#!/usr/bin/env python3
"""生成资管投研司组合风控奏折。

只读取本地 CSV 导入目录,不连接券商,不请求行情,不触发交易。
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.investment_import_parser import build_asset_analysis_memorial, build_portfolio_risk_memorial


def _jsonable(value):
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _render_markdown(memorial: dict) -> str:
    if "symbol" in memorial:
        return _render_asset_markdown(memorial)
    summary = memorial["summary"]
    lines = [
        "# 资管投研司组合风控奏折",
        "",
        f"- 状态：{memorial['status']}",
        f"- sourceLabel：{memorial['sourceLabel']}",
        f"- 总市值：{summary['total_market_value']}",
        f"- 持仓成本：{summary['total_cost']}",
        f"- 未实现盈亏：{summary['unrealized_pnl']}",
        f"- 最高单一资产占比：{summary['top_concentration_percent']}%",
        "",
        "## 老板摘要",
        "",
        memorial["boss_brief"],
        "",
        "## 风险问题",
        "",
    ]
    if memorial["risk_issues"]:
        lines.extend(f"- {issue}" for issue in memorial["risk_issues"])
    else:
        lines.append("- 未发现阻塞性风险。")
    lines.extend(
        [
            "",
            "## 禁止动作",
            "",
            "- no_auto_trade",
            "- no_buy_sell_recommendation",
            "",
            "说明：本奏折仅用于风控复核和老板裁决，不得自动交易，不得作为直接买卖建议。",
            "",
        ]
    )
    return "\n".join(lines)


def _render_asset_markdown(memorial: dict) -> str:
    position = memorial.get("position") or {}
    tech = memorial.get("technical_snapshot") or {}
    fundamentals = memorial.get("fundamentals") or {}
    valuation = memorial.get("valuation") or {}
    lines = [
        "# 资管投研司单资产分析奏折",
        "",
        f"- 标的：{memorial['symbol']}",
        f"- 状态：{memorial['status']}",
        f"- sourceLabel：{memorial['sourceLabel']}",
        f"- 市值：{position.get('marketValue', '缺失')}",
        f"- 未实现盈亏：{position.get('unrealizedPnL', '缺失')}",
        f"- 最新收盘：{tech.get('latest_close') or '缺失'}",
        f"- 涨跌幅：{tech.get('change_percent') or '缺失'}%",
        f"- ROE：{fundamentals.get('roe', '缺失')}%",
        f"- 经营现金流：{fundamentals.get('operatingCashFlow', '缺失')}",
        f"- PE：{valuation.get('pe', '缺失')}",
        f"- PB：{valuation.get('pb', '缺失')}",
        f"- 估值分位：{valuation.get('valuationPercentile', '缺失')}%",
        "",
        "## 观察逻辑",
        "",
        memorial.get("watchlist_thesis") or "缺少观察名单 thesis。",
        "",
        "## 老板摘要",
        "",
        memorial["boss_brief"],
        "",
        "## 风险问题",
        "",
    ]
    if memorial["risk_issues"]:
        lines.extend(f"- {issue}" for issue in memorial["risk_issues"])
    else:
        lines.append("- 未发现阻塞性风险。")
    lines.extend(
        [
            "",
            "## 禁止动作",
            "",
            "- no_auto_trade",
            "- no_buy_sell_recommendation",
            "",
            "说明：本奏折仅用于资产复核和老板裁决，不得自动交易，不得作为直接买卖建议。",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build read-only investment portfolio risk memorial.")
    parser.add_argument("--input-dir", required=True, help="Directory containing accounts/positions/transactions/watchlist CSV files.")
    parser.add_argument("--output", required=True, help="Output file path.")
    parser.add_argument("--format", choices=("json", "md"), default="json", help="Output format.")
    parser.add_argument("--symbol", help="Optional symbol for a single-asset analysis memorial.")
    args = parser.parse_args(argv)

    memorial = (
        build_asset_analysis_memorial(args.input_dir, args.symbol)
        if args.symbol
        else build_portfolio_risk_memorial(args.input_dir)
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "json":
        output.write_text(json.dumps(_jsonable(memorial), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        output.write_text(_render_markdown(_jsonable(memorial)), encoding="utf-8")

    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
