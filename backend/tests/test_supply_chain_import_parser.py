from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from src.supply_chain_import_parser import (
    build_supply_chain_memorial,
    load_supply_chain_bundle,
    parse_inventory_csv,
    parse_payables_csv,
    parse_purchase_orders_csv,
    parse_suppliers_csv,
)


def _write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


def _sample_bundle(root: Path) -> Path:
    _write(
        root / "suppliers.csv",
        """supplierId,supplierName,category,riskLevel,paymentTerms,sourceLabel
S001,Alpha Metals,raw_material,HIGH,NET30,internal_uploaded_file
S002,Best Packaging,packaging,LOW,NET45,manual_confirmed
""",
    )
    _write(
        root / "purchase_orders.csv",
        """poId,supplierId,orderDate,item,quantity,unitPrice,currency,budgetCode,budgetLimit,status,sourceLabel
PO-001,S001,2026-06-01,copper sheet,100,1200,CNY,RAW-2026,100000,APPROVED,internal_uploaded_file
PO-002,S002,2026-06-02,carton,1000,6,CNY,PKG-2026,10000,APPROVED,manual_confirmed
""",
    )
    _write(
        root / "goods_receipts.csv",
        """receiptId,poId,receivedDate,receivedQuantity,qualityStatus,sourceLabel
GR-001,PO-002,2026-06-05,1000,PASS,internal_uploaded_file
""",
    )
    _write(
        root / "payables.csv",
        """payableId,supplierId,poId,dueDate,amount,currency,status,sourceLabel
AP-001,S001,PO-001,2026-06-24,125000,CNY,UNPAID,internal_uploaded_file
AP-002,S002,PO-002,2026-07-20,6000,CNY,UNPAID,manual_confirmed
""",
    )
    _write(
        root / "inventory.csv",
        """sku,itemName,quantity,onHandValue,lastMovementDate,sourceLabel
INV-RAW-001,copper sheet,100,120000,2025-11-01,internal_uploaded_file
INV-PKG-001,carton,1000,6000,2026-06-10,manual_confirmed
""",
    )
    _write(
        root / "quality_events.csv",
        """eventId,supplierId,eventDate,eventType,severity,description,sourceLabel
QE-001,S001,2026-06-03,delay,HIGH,late delivery twice,internal_uploaded_file
""",
    )
    return root


def test_parse_suppliers_rejects_unknown_source(tmp_path: Path):
    path = _write(
        tmp_path / "suppliers.csv",
        """supplierId,supplierName,category,riskLevel,paymentTerms,sourceLabel
S001,Alpha Metals,raw_material,HIGH,NET30,unknown
""",
    )
    result = parse_suppliers_csv(path)
    assert not result.rows
    assert result.errors
    assert "sourceLabel" in result.errors[0]


def test_parse_purchase_orders_computes_amount_and_budget_warning(tmp_path: Path):
    path = _write(
        tmp_path / "purchase_orders.csv",
        """poId,supplierId,orderDate,item,quantity,unitPrice,currency,budgetCode,budgetLimit,status,sourceLabel
PO-001,S001,2026-06-01,copper sheet,100,1200,CNY,RAW-2026,100000,APPROVED,internal_uploaded_file
""",
    )
    result = parse_purchase_orders_csv(path)
    assert result.errors == []
    assert result.rows[0]["orderAmount"] == Decimal("120000")
    assert any("超预算" in warning for warning in result.warnings)


def test_parse_payables_and_inventory(tmp_path: Path):
    payables = _write(
        tmp_path / "payables.csv",
        """payableId,supplierId,poId,dueDate,amount,currency,status,sourceLabel
AP-001,S001,PO-001,2026-06-24,125000,CNY,UNPAID,internal_uploaded_file
""",
    )
    inventory = _write(
        tmp_path / "inventory.csv",
        """sku,itemName,quantity,onHandValue,lastMovementDate,sourceLabel
INV-RAW-001,copper sheet,100,120000,2025-11-01,internal_uploaded_file
""",
    )
    assert parse_payables_csv(payables).rows[0]["amount"] == Decimal("125000")
    assert parse_inventory_csv(inventory).rows[0]["onHandValue"] == Decimal("120000")


def test_load_bundle_cross_checks_foreign_keys(tmp_path: Path):
    _sample_bundle(tmp_path)
    (tmp_path / "payables.csv").write_text(
        """payableId,supplierId,poId,dueDate,amount,currency,status,sourceLabel
AP-404,S404,PO-404,2026-06-24,125000,CNY,UNPAID,internal_uploaded_file
""",
        encoding="utf-8",
    )
    bundle = load_supply_chain_bundle(tmp_path)
    assert bundle.errors
    assert any("未知供应商" in err for err in bundle.errors)
    assert any("未知采购单" in err for err in bundle.errors)


def test_build_supply_chain_memorial_flags_boss_risks(tmp_path: Path):
    _sample_bundle(tmp_path)
    memorial = build_supply_chain_memorial(tmp_path, as_of="2026-06-22")

    assert memorial["status"] == "needs_boss_decision"
    assert memorial["sourceLabel"] == "MIXED"
    assert memorial["boss_brief"]["payablesDue7d"] == "125000"
    assert memorial["boss_brief"]["inventoryValue"] == "126000"
    assert "no_auto_payment" in memorial["forbiddenActions"]
    assert any(issue["type"] == "payable_without_receipt" for issue in memorial["riskIssues"])
    assert any(issue["type"] == "payable_exceeds_po" for issue in memorial["riskIssues"])
    assert any(issue["type"] == "high_risk_supplier" for issue in memorial["riskIssues"])
    assert any(issue["type"] == "stale_inventory" for issue in memorial["riskIssues"])


def test_missing_required_files_returns_needs_evidence(tmp_path: Path):
    memorial = build_supply_chain_memorial(tmp_path, as_of="2026-06-22")
    assert memorial["status"] == "needs_evidence"
    assert memorial["errors"]
    assert memorial["boss_brief"]["auditFindings"] == 0
