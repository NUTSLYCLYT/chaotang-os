from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.jinyiwei.models import DataGapDraft, SourceType


class FactPlanDisposition(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    PLANNED = "PLANNED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class FactPlanResult:
    disposition: FactPlanDisposition
    draft: DataGapDraft | None = None
    source_scope: tuple[SourceType, ...] = ()
    reason: str | None = None
