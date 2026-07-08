from __future__ import annotations

import csv

from src.investment_import_parser import (
    build_asset_analysis_memorial,
    build_portfolio_risk_memorial,
    load_investment_import_bundle,
    parse_accounts_csv,
    parse_fundamentals_csv,
    parse_positions_csv,
    parse_price_series_csv,
    parse_transactions_csv,
    parse_valuation_csv,
    parse_watchlist_csv,
)


def _write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def test_parse_accounts_csv_normalizes_minimal_account_contract(tmp_path):
    path = tmp_path / "accounts.csv"
    _write_csv(
        path,
        [
            {
                "accountId": "acct-001",
                "accountName": "Main Brokerage",
                "accountType": "BROKERAGE",
                "currency": "USD",
                "sourceLabel": "broker_statement",
            }
        ],
    )

    result = parse_accounts_csv(path)

    assert result.errors == []
    assert result.rows == [
        {
            "accountId": "acct-001",
            "accountName": "Main Brokerage",
            "accountType": "BROKERAGE",
            "currency": "USD",
            "sourceLabel": "broker_statement",
        }
    ]


def test_parse_positions_csv_rejects_missing_required_fields(tmp_path):
    path = tmp_path / "positions.csv"
    _write_csv(
        path,
        [
            {
                "accountId": "acct-001",
                "symbol": "",
                "assetType": "STOCK",
                "quantity": "100",
                "costBasis": "300",
                "industry": "software",
                "sourceLabel": "broker_statement",
            }
        ],
    )

    result = parse_positions_csv(path)

    assert result.rows == []
    assert any("symbol" in error for error in result.errors)


def test_parse_transactions_csv_accepts_historical_trade_actions(tmp_path):
    path = tmp_path / "transactions.csv"
    _write_csv(
        path,
        [
            {
                "accountId": "acct-001",
                "tradeDate": "2026-06-21",
                "symbol": "MSFT",
                "action": "BUY",
                "quantity": "10",
                "price": "420.5",
                "fees": "1.2",
                "currency": "USD",
                "sourceLabel": "broker_statement",
            }
        ],
    )

    result = parse_transactions_csv(path)

    assert result.errors == []
    assert result.rows[0]["action"] == "BUY"
    assert result.rows[0]["quantity"] == "10"


def test_parse_watchlist_csv_keeps_thesis_read_only(tmp_path):
    path = tmp_path / "watchlist.csv"
    _write_csv(
        path,
        [
            {
                "symbol": "VOO",
                "assetType": "ETF",
                "thesis": "benchmark exposure",
                "riskLevel": "LOW",
                "sourceLabel": "manual_confirmed",
            }
        ],
    )

    result = parse_watchlist_csv(path)

    assert result.errors == []
    assert result.rows[0]["thesis"] == "benchmark exposure"


def test_parse_price_series_csv_accepts_verified_kline_rows(tmp_path):
    path = tmp_path / "price_series.csv"
    _write_csv(
        path,
        [
            {
                "symbol": "MSFT",
                "date": "2026-06-21",
                "open": "410",
                "high": "425",
                "low": "408",
                "close": "420",
                "volume": "1200000",
                "sourceLabel": "market_data_provider",
            }
        ],
    )

    result = parse_price_series_csv(path)

    assert result.errors == []
    assert result.rows[0]["symbol"] == "MSFT"
    assert result.rows[0]["close"] == "420"


def test_parse_price_series_csv_rejects_bad_kline_shape(tmp_path):
    path = tmp_path / "price_series.csv"
    _write_csv(
        path,
        [
            {
                "symbol": "MSFT",
                "date": "2026-06-21",
                "open": "410",
                "high": "405",
                "low": "415",
                "close": "420",
                "volume": "-1",
                "sourceLabel": "unknown",
            }
        ],
    )

    result = parse_price_series_csv(path)

    assert result.rows == []
    assert any("K线数据存在" in error for error in result.errors)


def test_parse_fundamentals_csv_accepts_sourced_value_metrics(tmp_path):
    path = tmp_path / "fundamentals.csv"
    _write_csv(
        path,
        [
            {
                "symbol": "MSFT",
                "period": "FY2025",
                "revenueGrowth": "13.5",
                "netIncomeGrowth": "10.2",
                "roe": "32.1",
                "debtToAssets": "47.5",
                "operatingCashFlow": "118000000000",
                "sourceLabel": "web_research",
            }
        ],
    )

    result = parse_fundamentals_csv(path)

    assert result.errors == []
    assert result.rows[0]["roe"] == "32.1"


def test_parse_valuation_csv_rejects_unknown_source(tmp_path):
    path = tmp_path / "valuation.csv"
    _write_csv(
        path,
        [
            {
                "symbol": "MSFT",
                "asOf": "2026-06-21",
                "pe": "34.2",
                "pb": "10.5",
                "ps": "11.8",
                "dividendYield": "0.7",
                "valuationPercentile": "82",
                "sourceLabel": "unknown",
            }
        ],
    )

    result = parse_valuation_csv(path)

    assert result.rows == []
    assert any("sourceLabel" in error for error in result.errors)


def test_load_bundle_cross_checks_position_accounts(tmp_path):
    _write_csv(
        tmp_path / "accounts.csv",
        [
            {
                "accountId": "acct-001",
                "accountName": "Main Brokerage",
                "accountType": "BROKERAGE",
                "currency": "USD",
                "sourceLabel": "broker_statement",
            }
        ],
    )
    _write_csv(
        tmp_path / "positions.csv",
        [
            {
                "accountId": "acct-missing",
                "symbol": "MSFT",
                "assetType": "STOCK",
                "quantity": "100",
                "costBasis": "300",
                "industry": "software",
                "sourceLabel": "broker_statement",
            }
        ],
    )

    bundle = load_investment_import_bundle(tmp_path)

    assert bundle["accounts"].errors == []
    assert bundle["positions"].errors == []
    assert any("acct-missing" in warning for warning in bundle["warnings"])


def test_build_portfolio_risk_memorial_from_read_only_import(tmp_path):
    _write_csv(
        tmp_path / "accounts.csv",
        [
            {
                "accountId": "acct-001",
                "accountName": "Main Brokerage",
                "accountType": "BROKERAGE",
                "currency": "USD",
                "sourceLabel": "broker_statement",
            }
        ],
    )
    _write_csv(
        tmp_path / "positions.csv",
        [
            {
                "accountId": "acct-001",
                "symbol": "MSFT",
                "assetType": "STOCK",
                "quantity": "100",
                "costBasis": "300",
                "industry": "software",
                "sourceLabel": "broker_statement",
                "lastPrice": "420",
                "quoteSourceLabel": "market_data_provider",
            },
            {
                "accountId": "acct-001",
                "symbol": "CASH",
                "assetType": "CASH",
                "quantity": "1",
                "costBasis": "5000",
                "industry": "cash",
                "sourceLabel": "manual_confirmed",
                "lastPrice": "5000",
                "quoteSourceLabel": "manual_confirmed",
            },
        ],
    )
    _write_csv(
        tmp_path / "price_series.csv",
        [
            {
                "symbol": "MSFT",
                "date": "2026-06-21",
                "open": "410",
                "high": "425",
                "low": "408",
                "close": "420",
                "volume": "1200000",
                "sourceLabel": "market_data_provider",
            }
        ],
    )

    memorial = build_portfolio_risk_memorial(tmp_path)

    assert memorial["status"] == "needs_review"
    assert memorial["summary"]["total_market_value"] == "47000"
    assert memorial["summary"]["unrealized_pnl"] == "12000"
    assert any("单一资产集中度" in issue for issue in memorial["risk_issues"])
    assert memorial["price_series"][0]["symbol"] == "MSFT"
    assert memorial["forbidden_actions"] == ["no_auto_trade", "no_buy_sell_recommendation"]
    assert "买入" not in memorial["boss_brief"]


def test_build_asset_analysis_memorial_combines_position_kline_and_watchlist(tmp_path):
    _write_csv(
        tmp_path / "accounts.csv",
        [
            {
                "accountId": "acct-001",
                "accountName": "Main Brokerage",
                "accountType": "BROKERAGE",
                "currency": "USD",
                "sourceLabel": "broker_statement",
            }
        ],
    )
    _write_csv(
        tmp_path / "positions.csv",
        [
            {
                "accountId": "acct-001",
                "symbol": "MSFT",
                "assetType": "STOCK",
                "quantity": "100",
                "costBasis": "300",
                "industry": "software",
                "sourceLabel": "broker_statement",
                "lastPrice": "420",
                "quoteSourceLabel": "market_data_provider",
            }
        ],
    )
    _write_csv(
        tmp_path / "price_series.csv",
        [
            {
                "symbol": "MSFT",
                "date": "2026-06-20",
                "open": "400",
                "high": "415",
                "low": "398",
                "close": "410",
                "volume": "1000000",
                "sourceLabel": "market_data_provider",
            },
            {
                "symbol": "MSFT",
                "date": "2026-06-21",
                "open": "410",
                "high": "425",
                "low": "408",
                "close": "420",
                "volume": "1200000",
                "sourceLabel": "market_data_provider",
            },
        ],
    )
    _write_csv(
        tmp_path / "watchlist.csv",
        [
            {
                "symbol": "MSFT",
                "assetType": "STOCK",
                "thesis": "cloud and AI platform exposure",
                "riskLevel": "WATCH",
                "sourceLabel": "manual_confirmed",
            }
        ],
    )
    _write_csv(
        tmp_path / "fundamentals.csv",
        [
            {
                "symbol": "MSFT",
                "period": "FY2025",
                "revenueGrowth": "13.5",
                "netIncomeGrowth": "10.2",
                "roe": "32.1",
                "debtToAssets": "47.5",
                "operatingCashFlow": "118000000000",
                "sourceLabel": "web_research",
            }
        ],
    )
    _write_csv(
        tmp_path / "valuation.csv",
        [
            {
                "symbol": "MSFT",
                "asOf": "2026-06-21",
                "pe": "34.2",
                "pb": "10.5",
                "ps": "11.8",
                "dividendYield": "0.7",
                "valuationPercentile": "82",
                "sourceLabel": "market_data_provider",
            }
        ],
    )

    memorial = build_asset_analysis_memorial(tmp_path, "MSFT")

    assert memorial["symbol"] == "MSFT"
    assert memorial["status"] == "ready"
    assert memorial["position"]["marketValue"] == "42000"
    assert memorial["position"]["unrealizedPnL"] == "12000"
    assert memorial["technical_snapshot"]["latest_close"] == "420"
    assert memorial["technical_snapshot"]["change_percent"] == "2.4"
    assert memorial["fundamentals"]["roe"] == "32.1"
    assert memorial["valuation"]["pe"] == "34.2"
    assert "ROE 32.1%" in memorial["boss_brief"]
    assert memorial["watchlist_thesis"] == "cloud and AI platform exposure"
    assert memorial["forbidden_actions"] == ["no_auto_trade", "no_buy_sell_recommendation"]
    assert "买入" not in memorial["boss_brief"]


def test_build_asset_analysis_memorial_marks_missing_asset_as_needs_evidence(tmp_path):
    _write_csv(
        tmp_path / "accounts.csv",
        [
            {
                "accountId": "acct-001",
                "accountName": "Main Brokerage",
                "accountType": "BROKERAGE",
                "currency": "USD",
                "sourceLabel": "broker_statement",
            }
        ],
    )

    memorial = build_asset_analysis_memorial(tmp_path, "MSFT")

    assert memorial["status"] == "needs_evidence"
    assert any("未找到持仓" in issue for issue in memorial["risk_issues"])
