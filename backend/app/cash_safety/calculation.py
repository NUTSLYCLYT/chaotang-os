"""Pure Decimal calculation for the Hubu cash-safety review."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, localcontext

from .contracts import (
    CashMovementDirection,
    CashRiskLevel,
    CashRunwayState,
    HubuCashSafetyCaseInput,
)

_ZERO = Decimal("0")
_THREE = Decimal("3")
_SIX = Decimal("6")


@dataclass(frozen=True, slots=True)
class DailyCashForecast:
    forecast_date: str
    ending_cash: Decimal


@dataclass(frozen=True, slots=True)
class CashSafetyEvaluation:
    available_cash: Decimal
    monthly_net_burn: Decimal | None
    runway_months: Decimal | None
    runway_state: CashRunwayState
    forecast_ending_cash: Decimal
    daily_forecast: tuple[DailyCashForecast, ...]
    risk_level: CashRiskLevel
    check_codes: tuple[str, ...]
    evidence_links: tuple[str, ...]
    missing_evidence_codes: tuple[str, ...]
    risk_reason_codes: tuple[str, ...]
    external_effects: str = "NONE"
    payment_executed: bool = False
    ledger_posted: bool = False


def _ordered(values: list[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(values))


def _previous_month(period: str, offset: int) -> str:
    year, month = (int(part) for part in period.split("-"))
    zero_based = year * 12 + month - 1 - offset
    expected_year, expected_month = divmod(zero_based, 12)
    return f"{expected_year:04d}-{expected_month + 1:02d}"


def _evidence(case: HubuCashSafetyCaseInput) -> tuple[tuple[str, ...], tuple[str, ...]]:
    links: list[str] = []
    gaps: list[str] = []
    for fact in (case.balances.cash, case.balances.bank, case.balances.reserved):
        links.append(fact.source_reference) if fact.source_reference else gaps.append(
            "BALANCE_SOURCE_MISSING"
        )
        if not fact.attested:
            gaps.append("BALANCE_NOT_ATTESTED")
    expected = tuple(_previous_month(case.period, offset) for offset in (2, 1, 0))
    if tuple(flow.period for flow in case.monthly_flows) != expected:
        gaps.append("MONTHLY_FLOW_WINDOW_INVALID")
    for flow in case.monthly_flows:
        links.append(flow.source_reference) if flow.source_reference else gaps.append(
            "MONTHLY_FLOW_SOURCE_MISSING"
        )
        if not flow.attested:
            gaps.append("MONTHLY_FLOW_NOT_ATTESTED")
    for movement in case.scheduled_movements:
        links.append(movement.source_reference) if movement.source_reference else gaps.append(
            "SCHEDULED_MOVEMENT_SOURCE_MISSING"
        )
        if not movement.attested:
            gaps.append("SCHEDULED_MOVEMENT_NOT_ATTESTED")
    return _ordered(links), _ordered(gaps)


def _daily_forecast(
    case: HubuCashSafetyCaseInput, starting_cash: Decimal
) -> tuple[DailyCashForecast, ...]:
    movements: dict[str, Decimal] = {}
    for item in case.scheduled_movements:
        signed = (
            Decimal(item.amount)
            if item.direction is CashMovementDirection.INFLOW
            else -Decimal(item.amount)
        )
        movements[item.due_date] = movements.get(item.due_date, _ZERO) + signed
    current = starting_cash
    start = date.fromisoformat(case.as_of)
    points: list[DailyCashForecast] = []
    for offset in range(1, 32):
        day = (start + timedelta(days=offset)).isoformat()
        current += movements.get(day, _ZERO)
        points.append(DailyCashForecast(day, current))
    return tuple(points)


def _evaluate(case: HubuCashSafetyCaseInput) -> CashSafetyEvaluation:
    available = (
        Decimal(case.balances.cash.amount)
        + Decimal(case.balances.bank.amount)
        - Decimal(case.balances.reserved.amount)
    )
    forecast = _daily_forecast(case, available)
    forecast_end = forecast[-1].ending_cash
    links, gaps = _evidence(case)
    checks = ["AVAILABLE_CASH_CALCULATED"]
    if gaps:
        burn = runway = None
        runway_state = CashRunwayState.NOT_CALCULATED
        checks.extend(("EVIDENCE_INCOMPLETE", "RUNWAY_NOT_CALCULATED"))
    else:
        burn = (
            sum(
                (Decimal(flow.outflow) - Decimal(flow.inflow) for flow in case.monthly_flows),
                start=_ZERO,
            )
            / _THREE
        )
        checks.append("EVIDENCE_COMPLETE")
        if burn <= _ZERO:
            runway = None
            runway_state = CashRunwayState.NO_NET_BURN
            checks.append("NO_NET_BURN")
        else:
            runway = available / burn
            runway_state = CashRunwayState.CALCULATED
            checks.append("RUNWAY_CALCULATED")
    checks.append("FORECAST_ENDING_CASH_CALCULATED")
    reasons: list[str] = []
    if gaps:
        risk = CashRiskLevel.NEEDS_EVIDENCE
        reasons.append("EVIDENCE_INCOMPLETE")
    else:
        if available < _ZERO:
            reasons.append("AVAILABLE_CASH_NEGATIVE")
        if forecast_end < _ZERO:
            reasons.append("FORECAST_ENDING_CASH_NEGATIVE")
        if runway is not None and runway < _THREE:
            reasons.append("RUNWAY_BELOW_THREE_MONTHS")
        if reasons:
            risk = CashRiskLevel.CRITICAL
        else:
            if runway is not None and runway < _SIX:
                reasons.append("RUNWAY_BELOW_SIX_MONTHS")
            scheduled_net = forecast_end - available
            if scheduled_net < _ZERO:
                reasons.append("FORECAST_NET_OUTFLOW")
            risk = CashRiskLevel.WATCH if reasons else CashRiskLevel.HEALTHY
            if not reasons:
                reasons.append("CASH_POSITION_WITHIN_THRESHOLDS")
    return CashSafetyEvaluation(
        available,
        burn,
        runway,
        runway_state,
        forecast_end,
        forecast,
        risk,
        _ordered(checks),
        links,
        gaps,
        _ordered(reasons),
    )


def evaluate_cash_safety(case: HubuCashSafetyCaseInput) -> CashSafetyEvaluation:
    """Evaluate one canonical case with a process-independent Decimal context."""
    with localcontext() as context:
        context.prec = 50
        return _evaluate(case)
