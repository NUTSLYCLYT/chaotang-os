"""户部供应链司 · 只读导入与确定性风险奏折。

本模块只处理本地 CSV/ERP 导出文件,不连接供应商系统,不自动付款,不自动下单。
目标是把供应商、采购单、应付、库存、收货与质量事件收口成老板可裁决的证据包。
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


VERIFIED_SOURCE_LABELS = {
    "internal_uploaded_file",
    "manual_confirmed",
    "historical_archive",
    "erp_export",
    "supplier_statement",
    "invoice_scan",
    "goods_receipt",
}

RISK_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL", "WATCH"}
PAYABLE_OPEN_STATUSES = {"UNPAID", "APPROVED", "PARTIAL"}
QUALITY_RISK_SEVERITIES = {"HIGH", "CRITICAL"}


@dataclass
class SupplyChainImportResult:
    rows: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class SupplyChainBundle:
    suppliers: list[dict[str, Any]]
    purchase_orders: list[dict[str, Any]]
    goods_receipts: list[dict[str, Any]]
    payables: list[dict[str, Any]]
    inventory: list[dict[str, Any]]
    quality_events: list[dict[str, Any]]
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _read_rows(path: Path, required: list[str]) -> tuple[list[dict[str, str]], list[str]]:
    if not path.exists():
        return [], [f"缺少必需文件: {path.name}"]
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = [name for name in required if name not in headers]
        if missing:
            return [], [f"{path.name} 缺少字段: {', '.join(missing)}"]
        return [dict(row) for row in reader], []


def _optional_rows(path: Path, required: list[str]) -> tuple[list[dict[str, str]], list[str]]:
    if not path.exists():
        return [], []
    return _read_rows(path, required)


def _money(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError, AttributeError):
        return None


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _source_ok(label: str | None) -> bool:
    return str(label or "").strip() in VERIFIED_SOURCE_LABELS


def _json_ready(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_ready(val) for key, val in value.items()}
    return value


def _money_string(value: Decimal) -> str:
    return format(value.quantize(Decimal("0.01")).normalize(), "f")


def parse_suppliers_csv(path: Path) -> SupplyChainImportResult:
    required = ["supplierId", "supplierName", "category", "riskLevel", "paymentTerms", "sourceLabel"]
    rows, errors = _read_rows(path, required)
    result = SupplyChainImportResult(errors=errors)
    for idx, raw in enumerate(rows, start=2):
        risk = raw["riskLevel"].strip().upper()
        if not _source_ok(raw.get("sourceLabel")):
            result.errors.append(f"{path.name}:{idx} sourceLabel 未验证: {raw.get('sourceLabel')}")
            continue
        if risk not in RISK_LEVELS:
            result.errors.append(f"{path.name}:{idx} riskLevel 非法: {risk}")
            continue
        result.rows.append(
            {
                "supplierId": raw["supplierId"].strip(),
                "supplierName": raw["supplierName"].strip(),
                "category": raw["category"].strip(),
                "riskLevel": risk,
                "paymentTerms": raw["paymentTerms"].strip(),
                "sourceLabel": raw["sourceLabel"].strip(),
            }
        )
    return result


def parse_purchase_orders_csv(path: Path) -> SupplyChainImportResult:
    required = [
        "poId",
        "supplierId",
        "orderDate",
        "item",
        "quantity",
        "unitPrice",
        "currency",
        "budgetCode",
        "budgetLimit",
        "status",
        "sourceLabel",
    ]
    rows, errors = _read_rows(path, required)
    result = SupplyChainImportResult(errors=errors)
    for idx, raw in enumerate(rows, start=2):
        quantity = _money(raw.get("quantity"))
        unit_price = _money(raw.get("unitPrice"))
        budget_limit = _money(raw.get("budgetLimit"))
        order_date = _parse_date(raw.get("orderDate"))
        if not _source_ok(raw.get("sourceLabel")):
            result.errors.append(f"{path.name}:{idx} sourceLabel 未验证: {raw.get('sourceLabel')}")
            continue
        if quantity is None or unit_price is None or budget_limit is None:
            result.errors.append(f"{path.name}:{idx} 金额/数量字段非法")
            continue
        if order_date is None:
            result.errors.append(f"{path.name}:{idx} orderDate 非法: {raw.get('orderDate')}")
            continue
        amount = quantity * unit_price
        if amount > budget_limit:
            result.warnings.append(f"{raw['poId']} 超预算: 订单 {amount} > 预算 {budget_limit}")
        result.rows.append(
            {
                "poId": raw["poId"].strip(),
                "supplierId": raw["supplierId"].strip(),
                "orderDate": order_date,
                "item": raw["item"].strip(),
                "quantity": quantity,
                "unitPrice": unit_price,
                "orderAmount": amount,
                "currency": raw["currency"].strip(),
                "budgetCode": raw["budgetCode"].strip(),
                "budgetLimit": budget_limit,
                "status": raw["status"].strip().upper(),
                "sourceLabel": raw["sourceLabel"].strip(),
            }
        )
    return result


def parse_goods_receipts_csv(path: Path) -> SupplyChainImportResult:
    required = ["receiptId", "poId", "receivedDate", "receivedQuantity", "qualityStatus", "sourceLabel"]
    rows, errors = _optional_rows(path, required)
    result = SupplyChainImportResult(errors=errors)
    for idx, raw in enumerate(rows, start=2):
        received_date = _parse_date(raw.get("receivedDate"))
        quantity = _money(raw.get("receivedQuantity"))
        if not _source_ok(raw.get("sourceLabel")):
            result.errors.append(f"{path.name}:{idx} sourceLabel 未验证: {raw.get('sourceLabel')}")
            continue
        if received_date is None or quantity is None:
            result.errors.append(f"{path.name}:{idx} 收货日期/数量非法")
            continue
        result.rows.append(
            {
                "receiptId": raw["receiptId"].strip(),
                "poId": raw["poId"].strip(),
                "receivedDate": received_date,
                "receivedQuantity": quantity,
                "qualityStatus": raw["qualityStatus"].strip().upper(),
                "sourceLabel": raw["sourceLabel"].strip(),
            }
        )
    return result


def parse_payables_csv(path: Path) -> SupplyChainImportResult:
    required = ["payableId", "supplierId", "poId", "dueDate", "amount", "currency", "status", "sourceLabel"]
    rows, errors = _read_rows(path, required)
    result = SupplyChainImportResult(errors=errors)
    for idx, raw in enumerate(rows, start=2):
        amount = _money(raw.get("amount"))
        due_date = _parse_date(raw.get("dueDate"))
        if not _source_ok(raw.get("sourceLabel")):
            result.errors.append(f"{path.name}:{idx} sourceLabel 未验证: {raw.get('sourceLabel')}")
            continue
        if amount is None or due_date is None:
            result.errors.append(f"{path.name}:{idx} 应付金额/到期日非法")
            continue
        result.rows.append(
            {
                "payableId": raw["payableId"].strip(),
                "supplierId": raw["supplierId"].strip(),
                "poId": raw["poId"].strip(),
                "dueDate": due_date,
                "amount": amount,
                "currency": raw["currency"].strip(),
                "status": raw["status"].strip().upper(),
                "sourceLabel": raw["sourceLabel"].strip(),
            }
        )
    return result


def parse_inventory_csv(path: Path) -> SupplyChainImportResult:
    required = ["sku", "itemName", "quantity", "onHandValue", "lastMovementDate", "sourceLabel"]
    rows, errors = _read_rows(path, required)
    result = SupplyChainImportResult(errors=errors)
    for idx, raw in enumerate(rows, start=2):
        quantity = _money(raw.get("quantity"))
        value = _money(raw.get("onHandValue"))
        movement = _parse_date(raw.get("lastMovementDate"))
        if not _source_ok(raw.get("sourceLabel")):
            result.errors.append(f"{path.name}:{idx} sourceLabel 未验证: {raw.get('sourceLabel')}")
            continue
        if quantity is None or value is None or movement is None:
            result.errors.append(f"{path.name}:{idx} 库存数量/金额/日期非法")
            continue
        result.rows.append(
            {
                "sku": raw["sku"].strip(),
                "itemName": raw["itemName"].strip(),
                "quantity": quantity,
                "onHandValue": value,
                "lastMovementDate": movement,
                "sourceLabel": raw["sourceLabel"].strip(),
            }
        )
    return result


def parse_quality_events_csv(path: Path) -> SupplyChainImportResult:
    required = ["eventId", "supplierId", "eventDate", "eventType", "severity", "description", "sourceLabel"]
    rows, errors = _optional_rows(path, required)
    result = SupplyChainImportResult(errors=errors)
    for idx, raw in enumerate(rows, start=2):
        event_date = _parse_date(raw.get("eventDate"))
        severity = raw["severity"].strip().upper()
        if not _source_ok(raw.get("sourceLabel")):
            result.errors.append(f"{path.name}:{idx} sourceLabel 未验证: {raw.get('sourceLabel')}")
            continue
        if event_date is None:
            result.errors.append(f"{path.name}:{idx} eventDate 非法: {raw.get('eventDate')}")
            continue
        result.rows.append(
            {
                "eventId": raw["eventId"].strip(),
                "supplierId": raw["supplierId"].strip(),
                "eventDate": event_date,
                "eventType": raw["eventType"].strip(),
                "severity": severity,
                "description": raw["description"].strip(),
                "sourceLabel": raw["sourceLabel"].strip(),
            }
        )
    return result


def load_supply_chain_bundle(root: Path) -> SupplyChainBundle:
    root = Path(root)
    parsed = {
        "suppliers": parse_suppliers_csv(root / "suppliers.csv"),
        "purchase_orders": parse_purchase_orders_csv(root / "purchase_orders.csv"),
        "goods_receipts": parse_goods_receipts_csv(root / "goods_receipts.csv"),
        "payables": parse_payables_csv(root / "payables.csv"),
        "inventory": parse_inventory_csv(root / "inventory.csv"),
        "quality_events": parse_quality_events_csv(root / "quality_events.csv"),
    }
    errors: list[str] = []
    warnings: list[str] = []
    for result in parsed.values():
        errors.extend(result.errors)
        warnings.extend(result.warnings)

    supplier_ids = {row["supplierId"] for row in parsed["suppliers"].rows}
    po_ids = {row["poId"] for row in parsed["purchase_orders"].rows}
    for po in parsed["purchase_orders"].rows:
        if po["supplierId"] not in supplier_ids:
            errors.append(f"{po['poId']} 引用未知供应商: {po['supplierId']}")
    for payable in parsed["payables"].rows:
        if payable["supplierId"] not in supplier_ids:
            errors.append(f"{payable['payableId']} 引用未知供应商: {payable['supplierId']}")
        if payable["poId"] not in po_ids:
            errors.append(f"{payable['payableId']} 引用未知采购单: {payable['poId']}")
    for receipt in parsed["goods_receipts"].rows:
        if receipt["poId"] not in po_ids:
            errors.append(f"{receipt['receiptId']} 引用未知采购单: {receipt['poId']}")
    for event in parsed["quality_events"].rows:
        if event["supplierId"] not in supplier_ids:
            errors.append(f"{event['eventId']} 引用未知供应商: {event['supplierId']}")

    return SupplyChainBundle(
        suppliers=parsed["suppliers"].rows,
        purchase_orders=parsed["purchase_orders"].rows,
        goods_receipts=parsed["goods_receipts"].rows,
        payables=parsed["payables"].rows,
        inventory=parsed["inventory"].rows,
        quality_events=parsed["quality_events"].rows,
        errors=errors,
        warnings=warnings,
    )


def _source_label(bundle: SupplyChainBundle) -> str:
    labels = {
        row.get("sourceLabel")
        for rows in (
            bundle.suppliers,
            bundle.purchase_orders,
            bundle.goods_receipts,
            bundle.payables,
            bundle.inventory,
            bundle.quality_events,
        )
        for row in rows
        if row.get("sourceLabel")
    }
    if not labels:
        return "UNKNOWN"
    return labels.pop() if len(labels) == 1 else "MIXED"


def _risk_issue(issue_type: str, severity: str, title: str, detail: str, evidence: list[str]) -> dict[str, Any]:
    return {"type": issue_type, "severity": severity, "title": title, "detail": detail, "evidence": evidence}


def _build_risk_issues(bundle: SupplyChainBundle, as_of_date: date) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    suppliers = {row["supplierId"]: row for row in bundle.suppliers}
    purchase_orders = {row["poId"]: row for row in bundle.purchase_orders}
    receipts_by_po: dict[str, list[dict[str, Any]]] = {}
    for receipt in bundle.goods_receipts:
        receipts_by_po.setdefault(receipt["poId"], []).append(receipt)

    for supplier in bundle.suppliers:
        if supplier["riskLevel"] in {"HIGH", "CRITICAL"}:
            issues.append(
                _risk_issue(
                    "high_risk_supplier",
                    supplier["riskLevel"],
                    f"高风险供应商: {supplier['supplierName']}",
                    f"供应商风险等级为 {supplier['riskLevel']},付款或新增采购需复核。",
                    [supplier["supplierId"], supplier["sourceLabel"]],
                )
            )

    for po in bundle.purchase_orders:
        if po["orderAmount"] > po["budgetLimit"]:
            issues.append(
                _risk_issue(
                    "purchase_over_budget",
                    "HIGH",
                    f"采购单超预算: {po['poId']}",
                    f"订单金额 {po['orderAmount']} > 预算 {po['budgetLimit']}",
                    [po["poId"], po["budgetCode"], po["sourceLabel"]],
                )
            )

    for payable in bundle.payables:
        if payable["status"] not in PAYABLE_OPEN_STATUSES:
            continue
        po = purchase_orders.get(payable["poId"])
        supplier = suppliers.get(payable["supplierId"])
        if po and payable["amount"] > po["orderAmount"] * Decimal("1.02"):
            issues.append(
                _risk_issue(
                    "payable_exceeds_po",
                    "HIGH",
                    f"应付超过采购单: {payable['payableId']}",
                    f"应付 {payable['amount']} > 采购单 {po['orderAmount']} 的 102%",
                    [payable["payableId"], payable["poId"], payable["sourceLabel"]],
                )
            )
        if payable["poId"] not in receipts_by_po:
            issues.append(
                _risk_issue(
                    "payable_without_receipt",
                    "HIGH",
                    f"未见收货即应付: {payable['payableId']}",
                    "未找到对应 goods_receipts 记录,不得直接付款。",
                    [payable["payableId"], payable["poId"], payable["sourceLabel"]],
                )
            )
        if 0 <= (payable["dueDate"] - as_of_date).days <= 7:
            issues.append(
                _risk_issue(
                    "payable_due_soon",
                    "MEDIUM",
                    f"7天内到期应付: {payable['payableId']}",
                    f"{supplier['supplierName'] if supplier else payable['supplierId']} 到期日 {payable['dueDate'].isoformat()}",
                    [payable["payableId"], payable["sourceLabel"]],
                )
            )

    total_po = sum((po["orderAmount"] for po in bundle.purchase_orders), Decimal("0"))
    if total_po > 0:
        by_supplier: dict[str, Decimal] = {}
        for po in bundle.purchase_orders:
            by_supplier[po["supplierId"]] = by_supplier.get(po["supplierId"], Decimal("0")) + po["orderAmount"]
        for supplier_id, amount in by_supplier.items():
            share = amount / total_po * Decimal("100")
            if share > Decimal("50"):
                name = suppliers.get(supplier_id, {}).get("supplierName", supplier_id)
                issues.append(
                    _risk_issue(
                        "supplier_concentration",
                        "MEDIUM",
                        f"供应商集中度过高: {name}",
                        f"{name} 占采购金额 {share.quantize(Decimal('0.1'))}%,超过50%预警线。",
                        [supplier_id],
                    )
                )

    for item in bundle.inventory:
        stale_days = (as_of_date - item["lastMovementDate"]).days
        if stale_days > 180 and item["onHandValue"] > 0:
            issues.append(
                _risk_issue(
                    "stale_inventory",
                    "MEDIUM",
                    f"库存呆滞: {item['itemName']}",
                    f"{item['sku']} 已 {stale_days} 天无流动,占用 {item['onHandValue']}",
                    [item["sku"], item["sourceLabel"]],
                )
            )

    for event in bundle.quality_events:
        if event["severity"] in QUALITY_RISK_SEVERITIES:
            supplier = suppliers.get(event["supplierId"])
            issues.append(
                _risk_issue(
                    "supplier_quality_event",
                    event["severity"],
                    f"供应商质量/交付事件: {supplier['supplierName'] if supplier else event['supplierId']}",
                    event["description"],
                    [event["eventId"], event["sourceLabel"]],
                )
            )
    return issues


def build_supply_chain_memorial(root: Path, *, as_of: str | date | None = None) -> dict[str, Any]:
    as_of_date = _parse_date(as_of) if as_of is not None else date.today()
    if as_of_date is None:
        raise ValueError(f"非法 as_of 日期: {as_of}")
    bundle = load_supply_chain_bundle(Path(root))
    if bundle.errors:
        return _json_ready(
            {
                "department": "户部供应链司",
                "status": "needs_evidence",
                "sourceLabel": _source_label(bundle),
                "asOf": as_of_date,
                "errors": bundle.errors,
                "warnings": bundle.warnings,
                "boss_brief": {
                    "payablesDue7d": "0",
                    "inventoryValue": "0",
                    "auditFindings": 0,
                    "decisionRequired": False,
                },
                "riskIssues": [],
                "forbiddenActions": ["no_auto_payment", "no_auto_purchase_order", "no_delete_source_evidence"],
            }
        )

    issues = _build_risk_issues(bundle, as_of_date)
    payables_due_7d = sum(
        (
            row["amount"]
            for row in bundle.payables
            if row["status"] in PAYABLE_OPEN_STATUSES and 0 <= (row["dueDate"] - as_of_date).days <= 7
        ),
        Decimal("0"),
    )
    inventory_value = sum((row["onHandValue"] for row in bundle.inventory), Decimal("0"))
    total_po = sum((row["orderAmount"] for row in bundle.purchase_orders), Decimal("0"))
    summary = {
        "supplierCount": len(bundle.suppliers),
        "purchaseOrderAmount": _money_string(total_po),
        "payablesDue7d": _money_string(payables_due_7d),
        "inventoryValue": _money_string(inventory_value),
        "auditFindings": len(issues),
        "decisionRequired": bool(issues),
    }
    return _json_ready(
        {
            "department": "户部供应链司",
            "status": "needs_boss_decision" if issues else "ready",
            "sourceLabel": _source_label(bundle),
            "asOf": as_of_date,
            "boss_brief": summary,
            "riskIssues": issues,
            "warnings": bundle.warnings,
            "errors": [],
            "suppliers": bundle.suppliers,
            "purchaseOrders": bundle.purchase_orders,
            "payables": bundle.payables,
            "inventory": bundle.inventory,
            "decisionOptions": [
                "approve_payment_plan",
                "return_for_evidence",
                "send_to_audit",
                "renegotiate_supplier",
                "save_draft_only",
            ],
            "forbiddenActions": [
                "no_auto_payment",
                "no_auto_purchase_order",
                "no_vendor_commitment",
                "no_delete_source_evidence",
            ],
            "boss_summary": (
                f"供应商 {len(bundle.suppliers)} 家,采购单金额 {summary['purchaseOrderAmount']},"
                f"7天内应付 {summary['payablesDue7d']},库存占用 {summary['inventoryValue']},"
                f"发现 {len(issues)} 条供应链风险。本奏折只供老板裁决,不得自动付款或下单。"
            ),
        }
    )
