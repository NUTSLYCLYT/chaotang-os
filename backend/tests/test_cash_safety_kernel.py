from __future__ import annotations

from copy import deepcopy
from decimal import Decimal, localcontext

import pytest
from pydantic import ValidationError

from app.cash_safety import HubuCashSafetyCaseInput, evaluate_cash_safety
from app.cash_safety.contracts import CashRiskLevel, CashRunwayState


def payload() -> dict[str, object]:
    return {
        "kind": "hubu.cash-safety-review.v1",
        "period": "2026-07",
        "asOf": "2026-08-01",
        "currency": "CNY",
        "balances": {
            "cash": {"amount": "100", "sourceReference": "cash", "attested": True},
            "bank": {"amount": "500", "sourceReference": "bank", "attested": True},
            "reserved": {"amount": "0", "sourceReference": "reserved", "attested": True},
        },
        "monthlyFlows": [
            {
                "period": month,
                "inflow": "0",
                "outflow": "100",
                "sourceReference": month,
                "attested": True,
            }
            for month in ("2026-05", "2026-06", "2026-07")
        ],
        "scheduledMovements": [],
    }


def evaluate(value: dict[str, object]):
    return evaluate_cash_safety(HubuCashSafetyCaseInput.model_validate(value))


def test_calculates_runway_and_exact_31_day_forecast() -> None:
    value = payload()
    value["scheduledMovements"] = [
        {
            "id": "in",
            "direction": "INFLOW",
            "amount": "75",
            "dueDate": "2026-08-02",
            "sourceReference": "in",
            "attested": True,
        },
        {
            "id": "out",
            "direction": "OUTFLOW",
            "amount": "25",
            "dueDate": "2026-09-01",
            "sourceReference": "out",
            "attested": True,
        },
    ]
    result = evaluate(value)
    assert result.available_cash == Decimal("600.00")
    assert result.monthly_net_burn == Decimal("100.00")
    assert result.runway_months == Decimal("6")
    assert len(result.daily_forecast) == 31
    assert result.daily_forecast[0].ending_cash == Decimal("675.00")
    assert result.forecast_ending_cash == Decimal("650.00")
    assert result.risk_level is CashRiskLevel.HEALTHY


def test_missing_evidence_prevents_runway_even_when_arithmetic_is_critical() -> None:
    value = payload()
    value["balances"]["reserved"]["amount"] = "700"  # type: ignore[index]
    value["balances"]["cash"]["attested"] = False  # type: ignore[index]
    result = evaluate(value)
    assert result.available_cash == Decimal("-100.00")
    assert result.risk_level is CashRiskLevel.NEEDS_EVIDENCE
    assert result.runway_state is CashRunwayState.NOT_CALCULATED
    assert result.runway_months is None


def test_decimal_result_is_independent_of_caller_context() -> None:
    value = payload()
    value["monthlyFlows"][0]["outflow"] = "101"  # type: ignore[index]
    case = HubuCashSafetyCaseInput.model_validate(value)
    expected = evaluate_cash_safety(case)
    with localcontext() as context:
        context.prec = 6
        actual = evaluate_cash_safety(case)
    assert actual == expected


@pytest.mark.parametrize(
    "change",
    [
        lambda value: value.update(currency="USD"),
        lambda value: value.update(asOf="2026-02-30"),
        lambda value: value["scheduledMovements"].append(
            {
                "id": "bad",
                "direction": "OUTFLOW",
                "amount": "1",
                "dueDate": "2026-09-02",
                "sourceReference": "x",
                "attested": True,
            }
        ),
        lambda value: value["balances"]["cash"].update(amount="-1"),
    ],
)
def test_rejects_noncanonical_or_out_of_scope_input(change) -> None:
    value = deepcopy(payload())
    change(value)
    with pytest.raises(ValidationError):
        HubuCashSafetyCaseInput.model_validate(value)


def test_kernel_never_claims_payment_ledger_or_external_effects() -> None:
    result = evaluate(payload())
    assert result.external_effects == "NONE"
    assert result.payment_executed is False
    assert result.ledger_posted is False
