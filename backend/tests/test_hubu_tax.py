"""税务司确定性 gate/测算(2026-07-06 补第 4 司)。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.finance_validators import tax_burden_metrics, tax_source_gate  # noqa: E402


def test_tax_burden_metrics_deterministic():
    m = tax_burden_metrics({"revenue": 1000000, "vat": 60000, "income_tax": 40000})
    assert str(m["税额合计"]) == "100000"
    assert str(m["综合税负率"]) == "0.1"  # 10万/100万


def test_tax_burden_missing_returns_none():
    m = tax_burden_metrics({"revenue": 1000000})  # 无税额
    assert m["税额合计"] is None and m["综合税负率"] is None


def test_tax_source_gate_flags_unverified():
    g = tax_source_gate({"vat": 60000})  # 无 sourceLabel
    assert g.passed is False and g.gaps
