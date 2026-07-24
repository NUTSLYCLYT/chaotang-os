"""Deterministic opinions rendered only from verified current evidence."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from app.agents.evidence_protocol import EvidenceProtocolError
from app.jinyiwei.freshness import is_evidence_fresh
from app.jinyiwei.models import (
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    FactCategory,
    MarketMetric,
    SourceType,
)


@dataclass(frozen=True, slots=True)
class EvidenceBackedOpinion:
    opinion: str
    evidence_ids: tuple[str, ...]


def render_mainland_last_price(pack: EvidencePack) -> EvidenceBackedOpinion:
    fact = pack.request.required_facts[0]
    items = tuple(pack.evidence_by_fact.get(fact.key, ()))
    if (
        pack.status is not EvidencePackStatus.RESOLVED
        or len(pack.request.required_facts) != 1
        or fact.category is not FactCategory.MARKET_QUOTE
        or fact.market_metric is not MarketMetric.LAST_PRICE
        or fact.jurisdiction != "CN"
        or pack.resolved_facts != (fact.key,)
        or pack.unresolved_facts
        or pack.conflicts
    ):
        raise EvidenceProtocolError("quote_unavailable")
    candidates = tuple(
        item
        for item in items
        if item.unit == "CNY"
        and _is_number(item)
        and item.stance is EvidenceStance.SUPPORTS
        and item.quality
        in {EvidenceQuality.PRIMARY, EvidenceQuality.AUTHORITATIVE}
        and item.source_type in {SourceType.SHIGUAN, SourceType.MCP}
        and is_evidence_fresh(
            as_of=item.as_of,
            retrieved_at=item.retrieved_at,
            request=pack.request,
            fact_key=fact.key,
            source_type=item.source_type,
            now=_parse_timestamp(pack.investigation_completed_at),
        )
    )
    if not candidates:
        raise EvidenceProtocolError("quote_unavailable")
    selected = max(candidates, key=_selection_key)
    opinion = (
        f"{fact.subject}最新可得价格为 {selected.value} CNY"
        f"（行情时间：{selected.as_of}；来源：{selected.publisher}）。\n"
        "该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，"
        "也不构成投资建议。"
    )
    return EvidenceBackedOpinion(
        opinion=opinion,
        evidence_ids=(selected.evidence_id,),
    )


def _is_number(item: EvidenceItem) -> bool:
    value = item.value
    return (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and (not isinstance(value, float) or math.isfinite(value))
    )


def _selection_key(item: EvidenceItem) -> tuple[datetime, datetime, str]:
    return (
        _parse_timestamp(item.as_of),
        _parse_timestamp(item.retrieved_at),
        item.evidence_id,
    )


def _parse_timestamp(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return datetime.fromisoformat(normalized)
