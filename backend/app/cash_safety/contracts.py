"""Strict immutable input contracts for cash-safety analysis."""

from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictStr,
    field_validator,
    model_validator,
)

_DATE = re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$")
_MONTH = re.compile(r"^(?P<year>[1-9]\d{3})-(?P<month>0[1-9]|1[0-2])$")
_MONEY = re.compile(r"^(?:0|[1-9]\d{0,27})(?:\.\d{1,2})?$")
_MOVEMENT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


class CashMovementDirection(StrEnum):
    INFLOW = "INFLOW"
    OUTFLOW = "OUTFLOW"


class CashRiskLevel(StrEnum):
    NEEDS_EVIDENCE = "NEEDS_EVIDENCE"
    CRITICAL = "CRITICAL"
    WATCH = "WATCH"
    HEALTHY = "HEALTHY"


class CashRunwayState(StrEnum):
    NOT_CALCULATED = "NOT_CALCULATED"
    CALCULATED = "CALCULATED"
    NO_NET_BURN = "NO_NET_BURN"


class _FrozenContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=False)


def _money(value: str) -> str:
    if type(value) is not str or _MONEY.fullmatch(value) is None:
        raise ValueError("amount must be a non-negative decimal with at most two fractional digits")
    try:
        amount = Decimal(value)
    except InvalidOperation:
        raise ValueError("amount is invalid") from None
    if not amount.is_finite():
        raise ValueError("amount must be finite")
    return f"{amount:.2f}"


def _source(value: str | None) -> str | None:
    if value is None:
        return None
    if type(value) is not str or not value.strip() or len(value) > 256:
        raise ValueError("source_reference is invalid")
    if value != value.strip() or any(ord(char) < 32 for char in value):
        raise ValueError("source_reference must use visible single-line characters")
    return value


def _date(value: str) -> str:
    if type(value) is not str or _DATE.fullmatch(value) is None:
        raise ValueError("date must be a legal YYYY-MM-DD value")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError("date must be a legal YYYY-MM-DD value") from None
    return value


def _month(value: str) -> str:
    if type(value) is not str or _MONTH.fullmatch(value) is None:
        raise ValueError("period must be a legal positive YYYY-MM value")
    return value


class CashEvidenceAmount(_FrozenContract):
    amount: StrictStr
    source_reference: StrictStr | None = Field(default=None, alias="sourceReference")
    attested: StrictBool

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: str) -> str:
        return _money(value)

    @field_validator("source_reference")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        return _source(value)


class CashBalances(_FrozenContract):
    cash: CashEvidenceAmount
    bank: CashEvidenceAmount
    reserved: CashEvidenceAmount


class MonthlyCashFlow(_FrozenContract):
    period: StrictStr
    inflow: StrictStr
    outflow: StrictStr
    source_reference: StrictStr | None = Field(default=None, alias="sourceReference")
    attested: StrictBool

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        return _month(value)

    @field_validator("inflow", "outflow")
    @classmethod
    def validate_amount(cls, value: str) -> str:
        return _money(value)

    @field_validator("source_reference")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        return _source(value)


class ScheduledCashMovement(_FrozenContract):
    id: StrictStr
    direction: CashMovementDirection
    amount: StrictStr
    due_date: StrictStr = Field(alias="dueDate")
    source_reference: StrictStr | None = Field(default=None, alias="sourceReference")
    attested: StrictBool

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if _MOVEMENT_ID.fullmatch(value) is None:
            raise ValueError("movement id is invalid")
        return value

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: str) -> str:
        return _money(value)

    @field_validator("due_date")
    @classmethod
    def validate_due_date(cls, value: str) -> str:
        return _date(value)

    @field_validator("source_reference")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        return _source(value)


class HubuCashSafetyCaseInput(_FrozenContract):
    kind: Literal["hubu.cash-safety-review.v1"]
    period: StrictStr
    as_of: StrictStr = Field(alias="asOf")
    currency: Literal["CNY"]
    balances: CashBalances
    monthly_flows: tuple[MonthlyCashFlow, ...] = Field(alias="monthlyFlows", max_length=3)
    scheduled_movements: tuple[ScheduledCashMovement, ...] = Field(
        alias="scheduledMovements", max_length=128
    )

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        return _month(value)

    @field_validator("as_of")
    @classmethod
    def validate_as_of(cls, value: str) -> str:
        return _date(value)

    @model_validator(mode="after")
    def validate_window(self) -> HubuCashSafetyCaseInput:
        as_of = date.fromisoformat(self.as_of)
        year, month = (int(part) for part in self.period.split("-"))
        if (year, month) >= (as_of.year, as_of.month):
            raise ValueError("period must be earlier than the as_of calendar month")
        latest = as_of + timedelta(days=31)
        for movement in self.scheduled_movements:
            due = date.fromisoformat(movement.due_date)
            if not as_of < due <= latest:
                raise ValueError("scheduled movement must be due within the future 31-day window")
        ids = tuple(item.id for item in self.scheduled_movements)
        if len(set(ids)) != len(ids):
            raise ValueError("scheduled movement ids must be unique")
        return self
