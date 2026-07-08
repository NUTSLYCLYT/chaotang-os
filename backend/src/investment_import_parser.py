"""资管投研司 · 只读导入解析器。

第一版只吃 CSV 模板,用于把券商导出的账户、持仓、交易、观察名单变成
结构化事实包。解析层不连券商、不接交易接口、不生成买卖建议。
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from src.finance_validators import portfolio_risk_snapshot, price_series_gate


@dataclass
class InvestmentImportResult:
    rows: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


ACCOUNT_FIELDS = ("accountId", "accountName", "accountType", "currency", "sourceLabel")
POSITION_FIELDS = ("accountId", "symbol", "assetType", "quantity", "costBasis", "industry", "sourceLabel")
TRANSACTION_FIELDS = ("accountId", "tradeDate", "symbol", "action", "quantity", "price", "fees", "currency", "sourceLabel")
WATCHLIST_FIELDS = ("symbol", "assetType", "thesis", "riskLevel", "sourceLabel")
PRICE_SERIES_FIELDS = ("symbol", "date", "open", "high", "low", "close", "volume", "sourceLabel")
FUNDAMENTALS_FIELDS = (
    "symbol",
    "period",
    "revenueGrowth",
    "netIncomeGrowth",
    "roe",
    "debtToAssets",
    "operatingCashFlow",
    "sourceLabel",
)
VALUATION_FIELDS = ("symbol", "asOf", "pe", "pb", "ps", "dividendYield", "valuationPercentile", "sourceLabel")
POSITION_OPTIONAL_FIELDS = ("lastPrice", "quoteSourceLabel")

ALLOWED_TRANSACTION_ACTIONS = {"BUY", "SELL", "DIVIDEND", "INTEREST", "FEE", "DEPOSIT", "WITHDRAWAL", "TRANSFER", "SPLIT"}
ALLOWED_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL", "WATCH"}
VERIFIED_INVESTMENT_SOURCE_LABELS = {"broker_statement", "market_data_provider", "manual_confirmed", "web_research", "internal_uploaded_file", "historical_archive"}


def _read_csv(path: str | Path, required_fields: tuple[str, ...]) -> InvestmentImportResult:
    result = InvestmentImportResult()
    path = Path(path)
    if not path.exists():
        result.errors.append(f"文件不存在:{path}")
        return result

    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        headers = set(reader.fieldnames or [])
        missing_headers = [field for field in required_fields if field not in headers]
        if missing_headers:
            result.errors.append(f"{path.name}缺表头:{','.join(missing_headers)}")
            return result

        for line_no, row in enumerate(reader, start=2):
            normalized = {field: (row.get(field) or "").strip() for field in required_fields}
            missing_values = [field for field in required_fields if not normalized[field]]
            if missing_values:
                result.errors.append(f"{path.name}:L{line_no}缺值:{','.join(missing_values)}")
                continue
            result.rows.append(normalized)

    return result


def _read_csv_with_optional(
    path: str | Path, required_fields: tuple[str, ...], optional_fields: tuple[str, ...]
) -> InvestmentImportResult:
    result = _read_csv(path, required_fields)
    path = Path(path)
    if result.errors or not path.exists():
        return result

    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        optional_present = [field for field in optional_fields if field in set(reader.fieldnames or [])]
        if not optional_present:
            return result
        kept_rows: list[dict] = []
        valid_idx = 0
        for row in reader:
            normalized_required = {field: (row.get(field) or "").strip() for field in required_fields}
            if any(not normalized_required[field] for field in required_fields):
                continue
            normalized_required.update({field: (row.get(field) or "").strip() for field in optional_present})
            kept_rows.append(normalized_required)
            valid_idx += 1
        result.rows = kept_rows
    return result


def parse_accounts_csv(path: str | Path) -> InvestmentImportResult:
    return _read_csv(path, ACCOUNT_FIELDS)


def parse_positions_csv(path: str | Path) -> InvestmentImportResult:
    return _read_csv_with_optional(path, POSITION_FIELDS, POSITION_OPTIONAL_FIELDS)


def parse_transactions_csv(path: str | Path) -> InvestmentImportResult:
    result = _read_csv(path, TRANSACTION_FIELDS)
    kept_rows: list[dict] = []
    for idx, row in enumerate(result.rows, start=2):
        action = row["action"].upper()
        if action not in ALLOWED_TRANSACTION_ACTIONS:
            result.errors.append(f"transactions.csv:L{idx}未知历史交易动作:{row['action']}")
            continue
        row["action"] = action
        kept_rows.append(row)
    result.rows = kept_rows
    return result


def parse_watchlist_csv(path: str | Path) -> InvestmentImportResult:
    result = _read_csv(path, WATCHLIST_FIELDS)
    kept_rows: list[dict] = []
    for idx, row in enumerate(result.rows, start=2):
        risk = row["riskLevel"].upper()
        if risk not in ALLOWED_RISK_LEVELS:
            result.errors.append(f"watchlist.csv:L{idx}未知riskLevel:{row['riskLevel']}")
            continue
        row["riskLevel"] = risk
        kept_rows.append(row)
    result.rows = kept_rows
    return result


def parse_price_series_csv(path: str | Path) -> InvestmentImportResult:
    result = _read_csv(path, PRICE_SERIES_FIELDS)
    if result.errors:
        return result
    gate = price_series_gate(result.rows)
    if not gate.passed:
        result.errors.append(gate.detail)
        result.errors.extend(gate.gaps)
        result.rows = []
    return result


def _validate_source_label_rows(result: InvestmentImportResult, filename: str) -> InvestmentImportResult:
    kept_rows: list[dict] = []
    for idx, row in enumerate(result.rows, start=2):
        if row.get("sourceLabel") not in VERIFIED_INVESTMENT_SOURCE_LABELS:
            result.errors.append(f"{filename}:L{idx}sourceLabel未验证:{row.get('sourceLabel')}")
            continue
        kept_rows.append(row)
    result.rows = kept_rows
    return result


def parse_fundamentals_csv(path: str | Path) -> InvestmentImportResult:
    result = _read_csv(path, FUNDAMENTALS_FIELDS)
    return _validate_source_label_rows(result, "fundamentals.csv") if not result.errors else result


def parse_valuation_csv(path: str | Path) -> InvestmentImportResult:
    result = _read_csv(path, VALUATION_FIELDS)
    return _validate_source_label_rows(result, "valuation.csv") if not result.errors else result


def load_investment_import_bundle(root: str | Path) -> dict:
    """读取一个投资导入目录。

    目录内文件名固定:
    - accounts.csv
    - positions.csv
    - transactions.csv
    - watchlist.csv

    positions/transactions/watchlist 允许暂缺,便于分步导入。
    """
    root = Path(root)
    bundle = {
        "accounts": parse_accounts_csv(root / "accounts.csv"),
        "positions": InvestmentImportResult(),
        "transactions": InvestmentImportResult(),
        "watchlist": InvestmentImportResult(),
        "price_series": InvestmentImportResult(),
        "fundamentals": InvestmentImportResult(),
        "valuation": InvestmentImportResult(),
        "warnings": [],
    }

    optional_parsers = {
        "positions": parse_positions_csv,
        "transactions": parse_transactions_csv,
        "watchlist": parse_watchlist_csv,
        "price_series": parse_price_series_csv,
        "fundamentals": parse_fundamentals_csv,
        "valuation": parse_valuation_csv,
    }
    for key, parser in optional_parsers.items():
        path = root / f"{key}.csv"
        if path.exists():
            bundle[key] = parser(path)
        else:
            bundle["warnings"].append(f"缺少可选文件:{path.name}")

    account_ids = {row["accountId"] for row in bundle["accounts"].rows}
    for section in ("positions", "transactions"):
        for row in bundle[section].rows:
            account_id = row.get("accountId")
            if account_id and account_id not in account_ids:
                bundle["warnings"].append(f"{section}.csv引用未知accountId:{account_id}")

    return bundle


def _money_string(value) -> str:
    d = value if isinstance(value, Decimal) else Decimal(str(value))
    return format(d.normalize(), "f")


def _json_ready(value):
    if isinstance(value, Decimal):
        return _money_string(value)
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    return value


def build_portfolio_risk_memorial(root: str | Path) -> dict:
    """从只读导入目录生成组合风控奏折草案。

    该函数只做风险快照与老板摘要,不生成买卖建议。
    """
    bundle = load_investment_import_bundle(root)
    snapshot = portfolio_risk_snapshot(bundle["positions"].rows)

    risk_issues: list[str] = []
    warnings = list(bundle["warnings"])
    for section in ("accounts", "positions", "transactions", "watchlist", "price_series", "fundamentals", "valuation"):
        result = bundle[section]
        warnings.extend(result.warnings)
        risk_issues.extend(result.errors)

    for check in snapshot["checks"]:
        if not check.passed:
            risk_issues.append(f"{check.name}:{check.detail}")

    total = snapshot["total_market_value"]
    pnl = snapshot["unrealized_pnl"]
    concentration = snapshot["top_concentration_percent"]
    boss_brief = (
        f"当前导入组合总市值 {total:,}, 未实现盈亏 {pnl:,}, "
        f"最高单一资产占比 {concentration}%。本报告仅用于风控复核和老板裁决,不得自动交易。"
    )

    return {
        "status": "ready" if snapshot["status"] == "ready" and not risk_issues else "needs_review",
        "sourceLabel": "MIXED",
        "summary": {
            "total_market_value": _money_string(total),
            "total_cost": _money_string(snapshot["total_cost"]),
            "unrealized_pnl": _money_string(pnl),
            "top_concentration_percent": _money_string(concentration),
        },
        "risk_issues": risk_issues,
        "warnings": warnings,
        "positions": snapshot["positions"],
        "price_series": bundle["price_series"].rows,
        "industry_exposure": snapshot["industry_exposure"],
        "boss_brief": boss_brief,
        "forbidden_actions": ["no_auto_trade", "no_buy_sell_recommendation"],
    }


def _same_symbol(row: dict, symbol: str) -> bool:
    return str(row.get("symbol") or "").strip().upper() == symbol.strip().upper()


def _technical_snapshot(rows: list[dict]) -> dict:
    if not rows:
        return {
            "latest_close": None,
            "previous_close": None,
            "change_percent": None,
            "data_points": 0,
        }
    ordered = sorted(rows, key=lambda row: row["date"])
    latest = Decimal(str(ordered[-1]["close"]))
    previous = Decimal(str(ordered[-2]["close"])) if len(ordered) > 1 else None
    change = None
    if previous and previous != 0:
        change = ((latest - previous) / previous * 100).quantize(Decimal("0.1"))
    return {
        "latest_close": _money_string(latest),
        "previous_close": _money_string(previous) if previous is not None else None,
        "change_percent": _money_string(change) if change is not None else None,
        "data_points": len(ordered),
    }


def build_asset_analysis_memorial(root: str | Path, symbol: str) -> dict:
    """生成单资产分析奏折草案。

    汇总本地持仓、K线和观察名单 thesis。输出供前端单资产详情页使用;
    不接真实行情,不输出交易建议。
    """
    symbol = symbol.strip().upper()
    bundle = load_investment_import_bundle(root)
    snapshot = portfolio_risk_snapshot([row for row in bundle["positions"].rows if _same_symbol(row, symbol)])
    price_rows = [row for row in bundle["price_series"].rows if _same_symbol(row, symbol)]
    watch = next((row for row in bundle["watchlist"].rows if _same_symbol(row, symbol)), None)
    fundamentals = next((row for row in bundle["fundamentals"].rows if _same_symbol(row, symbol)), None)
    valuation = next((row for row in bundle["valuation"].rows if _same_symbol(row, symbol)), None)

    risk_issues: list[str] = []
    warnings = list(bundle["warnings"])
    for section in ("accounts", "positions", "transactions", "watchlist", "price_series", "fundamentals", "valuation"):
        result = bundle[section]
        warnings.extend(result.warnings)
        risk_issues.extend(result.errors)

    if not snapshot["positions"]:
        risk_issues.append(f"未找到持仓:{symbol}")
    if not price_rows:
        warnings.append(f"缺少K线数据:{symbol}")
    if not watch:
        warnings.append(f"缺少观察名单thesis:{symbol}")
    if not fundamentals:
        warnings.append(f"缺少基本面数据:{symbol}")
    if not valuation:
        warnings.append(f"缺少估值数据:{symbol}")

    for check in snapshot["checks"]:
        if not check.passed:
            risk_issues.append(f"{check.name}:{check.detail}")

    raw_position = snapshot["positions"][0] if snapshot["positions"] else None
    position = _json_ready(raw_position) if raw_position else None
    tech = _technical_snapshot(price_rows)
    thesis = watch["thesis"] if watch else ""

    if raw_position:
        value_tail = ""
        if fundamentals and valuation:
            value_tail = f" ROE {fundamentals['roe']}%, PE {valuation['pe']}。"
        boss_brief = (
            f"{symbol} 当前市值 {raw_position['marketValue']:,}, 未实现盈亏 {raw_position['unrealizedPnL']:,}, "
            f"K线最新收盘 {tech['latest_close'] or '缺失'}。{value_tail}本报告仅用于资产复核和老板裁决,不得自动交易。"
        )
    else:
        boss_brief = f"{symbol} 缺少可验证持仓,只能进入待补证,不得自动交易。"

    return {
        "symbol": symbol,
        "status": "ready" if position else "needs_evidence",
        "sourceLabel": "MIXED",
        "position": position,
        "price_series": price_rows,
        "technical_snapshot": tech,
        "fundamentals": fundamentals or {},
        "valuation": valuation or {},
        "watchlist_thesis": thesis,
        "risk_level": watch["riskLevel"] if watch else "UNKNOWN",
        "risk_issues": risk_issues,
        "warnings": warnings,
        "boss_brief": boss_brief,
        "forbidden_actions": ["no_auto_trade", "no_buy_sell_recommendation"],
    }
