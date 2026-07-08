from __future__ import annotations

import csv
import json
import subprocess
import sys


def _write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _write_bundle(root):
    _write_csv(
        root / "accounts.csv",
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
        root / "positions.csv",
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


def test_cli_writes_json_memorial(tmp_path):
    _write_bundle(tmp_path)
    out = tmp_path / "memorial.json"

    result = subprocess.run(
        [
            sys.executable,
            "scripts/build_investment_risk_memorial.py",
            "--input-dir",
            str(tmp_path),
            "--output",
            str(out),
        ],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["summary"]["total_market_value"] == "42000"
    assert payload["forbidden_actions"] == ["no_auto_trade", "no_buy_sell_recommendation"]
    assert "wrote" in result.stdout


def test_cli_writes_markdown_memorial(tmp_path):
    _write_bundle(tmp_path)
    out = tmp_path / "memorial.md"

    result = subprocess.run(
        [
            sys.executable,
            "scripts/build_investment_risk_memorial.py",
            "--input-dir",
            str(tmp_path),
            "--output",
            str(out),
            "--format",
            "md",
        ],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    text = out.read_text(encoding="utf-8")
    assert "# 资管投研司组合风控奏折" in text
    assert "不得自动交易" in text
    assert "买入" not in text


def test_cli_writes_single_asset_json_memorial(tmp_path):
    _write_bundle(tmp_path)
    out = tmp_path / "asset.json"

    result = subprocess.run(
        [
            sys.executable,
            "scripts/build_investment_risk_memorial.py",
            "--input-dir",
            str(tmp_path),
            "--output",
            str(out),
            "--symbol",
            "MSFT",
        ],
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["symbol"] == "MSFT"
    assert payload["position"]["marketValue"] == "42000"
    assert payload["forbidden_actions"] == ["no_auto_trade", "no_buy_sell_recommendation"]
