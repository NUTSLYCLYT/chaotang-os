"""Deterministic opinions rendered only from verified current evidence."""

from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class EvidenceBackedOpinion:
    opinion: str
    evidence_ids: tuple[str, ...]


def render_mainland_last_price(pack: EvidencePack) -> EvidenceBackedOpinion:
    fact = pack.request.required_facts[0]
    items = tuple(pack.evidence_by_fact.get(fact.key, ()))
    if (
        pack.status is not EvidencePackStatus.RESOLVED
        or pack.resolved_facts != (fact.key,)
        or pack.unresolved_facts
        or pack.conflicts
    ):
        raise EvidenceProtocolError("quote_unavailable")
    if (
        len(pack.request.required_facts) != 1
        or fact.category is not FactCategory.MARKET_QUOTE
        or fact.market_metric is not MarketMetric.LAST_PRICE
        or fact.jurisdiction != "CN"
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
        logger.warning(
            "quote render found no eligible item item_count=%d shapes=%s",
            len(items),
            [
                {
                    "unit": item.unit,
                    "numeric": _is_number(item),
                    "stance": item.stance.value,
                    "quality": item.quality.value,
                    "source_type": item.source_type.value,
                    "fresh": is_evidence_fresh(
                        as_of=item.as_of,
                        retrieved_at=item.retrieved_at,
                        request=pack.request,
                        fact_key=fact.key,
                        source_type=item.source_type,
                        now=_parse_timestamp(pack.investigation_completed_at),
                    ),
                }
                for item in items
            ],
        )
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


def render_entity_reference(pack: EvidencePack) -> EvidenceBackedOpinion:
    facts = pack.request.required_facts
    if len(facts) != 1:
        raise EvidenceProtocolError("entity_reference_unavailable")
    fact = facts[0]
    items = tuple(pack.evidence_by_fact.get(fact.key, ()))
    if (
        pack.status is not EvidencePackStatus.RESOLVED
        or fact.category is not FactCategory.ENTITY_REFERENCE
        or fact.expected_shape != "string"
        or pack.resolved_facts != (fact.key,)
        or pack.unresolved_facts
        or pack.conflicts
    ):
        logger.warning(
            "entity render rejected pack status=%s fact_count=%d resolved=%d "
            "unresolved=%d conflicts=%d item_count=%d attempts=%s",
            pack.status.value,
            len(facts),
            len(pack.resolved_facts),
            len(pack.unresolved_facts),
            len(pack.conflicts),
            len(items),
            [
                {
                    "source": attempt.source_type.value,
                    "status": attempt.status.value,
                    "error": attempt.error,
                }
                for attempt in pack.source_attempts
            ],
        )
        raise EvidenceProtocolError("entity_reference_unavailable")
    completed_at = _parse_timestamp(pack.investigation_completed_at)
    candidates = tuple(
        item
        for item in items
        if isinstance(item.value, str)
        and bool(item.value.strip())
        and item.stance is EvidenceStance.SUPPORTS
        and item.quality
        in {
            EvidenceQuality.PRIMARY,
            EvidenceQuality.AUTHORITATIVE,
            EvidenceQuality.SECONDARY,
        }
        and item.source_type
        in {SourceType.SHIGUAN, SourceType.PUBLIC_API, SourceType.PUBLIC_WEB}
        and is_evidence_fresh(
            as_of=item.as_of,
            retrieved_at=item.retrieved_at,
            request=pack.request,
            fact_key=fact.key,
            source_type=item.source_type,
            now=completed_at,
        )
    )
    if not candidates:
        logger.warning(
            "entity render found no eligible item item_count=%d shapes=%s",
            len(items),
            [
                {
                    "string": isinstance(item.value, str),
                    "stance": item.stance.value,
                    "quality": item.quality.value,
                    "source_type": item.source_type.value,
                    "fresh": is_evidence_fresh(
                        as_of=item.as_of,
                        retrieved_at=item.retrieved_at,
                        request=pack.request,
                        fact_key=fact.key,
                        source_type=item.source_type,
                        now=completed_at,
                    ),
                }
                for item in items
            ],
        )
        raise EvidenceProtocolError("entity_reference_unavailable")
    selected = max(candidates, key=_selection_key)
    return EvidenceBackedOpinion(
        opinion=(
            f"{fact.subject} 的公开实体身份为：{selected.value.strip()}"
            f"（来源：{selected.publisher}；资料时间：{selected.as_of}）。"
        ),
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
