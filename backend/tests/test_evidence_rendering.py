from __future__ import annotations

import hashlib
from decimal import Decimal

import pytest

from app.agents.evidence_protocol import EvidenceProtocolError
from app.agents.evidence_rendering import render_entity_reference, render_mainland_last_price
from app.jinyiwei.models import (
    CacheMetadata,
    DataGapRequest,
    DataScope,
    EvidenceConflict,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    FactCategory,
    FreshnessRequirement,
    InvestigationPlan,
    MarketMetric,
    RequiredFact,
    SourceType,
)

FACT_KEY = "market_quote:last_price"


def _item(
    evidence_id: str,
    *,
    value: object = 123.45,
    unit: str = "CNY",
    as_of: str = "2026-07-24T10:00:00+08:00",
    retrieved_at: str = "2026-07-24T10:00:02+08:00",
    publisher: str = "行情提供方",
) -> EvidenceItem:
    return EvidenceItem(
        evidence_id=evidence_id,
        fact_key=FACT_KEY,
        value=value,
        unit=unit,
        as_of=as_of,
        retrieved_at=retrieved_at,
        source_url="https://provider.example.test/quote",
        publisher=publisher,
        source_type=SourceType.MCP,
        quality=EvidenceQuality.AUTHORITATIVE,
        stance=EvidenceStance.SUPPORTS,
        excerpt="不得进入确定性答复的原始摘录",
        content_hash=hashlib.sha256(evidence_id.encode()).hexdigest(),
        confidence=0.9,
        access_metadata={"raw": "不得进入确定性答复"},
    )


def _pack(
    *,
    status: EvidencePackStatus = EvidencePackStatus.RESOLVED,
    current: tuple[EvidenceItem, ...] = (),
    historical: tuple[EvidenceItem, ...] = (),
    resolved: tuple[str, ...] = (FACT_KEY,),
    unresolved: tuple[str, ...] = (),
    conflicts: tuple[EvidenceConflict, ...] = (),
) -> EvidencePack:
    fact = RequiredFact(
        key=FACT_KEY,
        description="查询任意公司的最新可得价格",
        category=FactCategory.MARKET_QUOTE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject="任意公司",
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        market_metric=MarketMetric.LAST_PRICE,
    )
    request = DataGapRequest(
        requesting_agent="bureau:户部:投资司",
        question="任意公司的股票价格是多少？",
        required_facts=(fact,),
        decision_context="回答明确证券行情查询",
        freshness=FreshnessRequirement(max_age_seconds=3600),
        request_id="request-render",
        timeout_seconds=30,
        source_scope=(SourceType.SHIGUAN, SourceType.MCP),
    )
    return EvidencePack(
        pack_id="pack-render",
        investigation_id="investigation-render",
        status=status,
        request=request,
        investigation_plan=InvestigationPlan(
            fact_keys=(FACT_KEY,),
            source_scope=(SourceType.SHIGUAN, SourceType.MCP),
        ),
        evidence_by_fact={FACT_KEY: current},
        historical_evidence_by_fact={FACT_KEY: historical},
        resolved_facts=resolved,
        unresolved_facts=unresolved,
        conflicts=conflicts,
        source_attempts=(),
        investigation_started_at="2026-07-24T10:00:00+08:00",
        investigation_completed_at="2026-07-24T10:00:03+08:00",
        cache=CacheMetadata(hit=False),
        do_not_infer=unresolved,
    )


def test_renderer_selects_latest_current_quote_deterministically() -> None:
    selected = _item(
        "e-z",
        value=123.45,
        as_of="2026-07-24T10:00:02+08:00",
        publisher="确定来源",
    )
    older = _item("e-old", value=999, as_of="2026-07-24T10:00:00+08:00")

    rendered = render_mainland_last_price(_pack(current=(older, selected)))

    assert rendered.evidence_ids == ("e-z",)
    assert rendered.opinion == (
        "任意公司最新可得价格为 123.45 CNY"
        "（行情时间：2026-07-24T10:00:02+08:00；来源：确定来源）。\n"
        "该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，"
        "也不构成投资建议。"
    )
    assert "不得进入" not in rendered.opinion
    assert "provider.example.test" not in rendered.opinion


@pytest.mark.parametrize(
    ("pack", "reason"),
    [
        (
            _pack(
                status=EvidencePackStatus.UNAVAILABLE,
                current=(),
                resolved=(),
                unresolved=(FACT_KEY,),
            ),
            "quote_unavailable",
        ),
        (
            _pack(
                status=EvidencePackStatus.PARTIAL,
                current=(),
                resolved=(),
                unresolved=(FACT_KEY,),
            ),
            "quote_unavailable",
        ),
        (
            _pack(
                status=EvidencePackStatus.PARTIAL,
                current=(_item("e-a"), _item("e-b")),
                conflicts=(
                    EvidenceConflict(
                        fact_key=FACT_KEY,
                        evidence_ids=("e-a", "e-b"),
                        summary="行情冲突",
                    ),
                ),
            ),
            "quote_unavailable",
        ),
        (
            _pack(current=(), historical=(_item("e-history"),)),
            "quote_unavailable",
        ),
        (_pack(current=(_item("e-unit", unit="USD"),)), "quote_unavailable"),
        (_pack(current=(_item("e-bool", value=True),)), "quote_unavailable"),
        (_pack(current=(_item("e-text", value="123.45"),)), "quote_unavailable"),
        (_pack(current=()), "quote_unavailable"),
    ],
)
def test_renderer_fails_closed_without_verified_current_cny_number(
    pack: EvidencePack,
    reason: str,
) -> None:
    with pytest.raises(EvidenceProtocolError, match=f"^{reason}$"):
        render_mainland_last_price(pack)


def test_renderer_ignores_ineligible_later_candidates() -> None:
    valid = _item(
        "e-valid",
        value=123.45,
        as_of="2026-07-24T09:59:00+08:00",
        retrieved_at="2026-07-24T09:59:30+08:00",
        publisher="有效来源",
    )
    later = {
        "future": _item(
            "e-future",
            as_of="2026-07-24T10:01:00+08:00",
            retrieved_at="2026-07-24T10:01:01+08:00",
        ),
        "stale": _item(
            "e-stale",
            as_of="2026-07-24T09:58:00+08:00",
            retrieved_at="2026-07-24T08:00:00+08:00",
        ),
        "unverified": _item(
            "e-unverified",
            as_of="2026-07-24T09:59:59+08:00",
        ).model_copy(update={"quality": EvidenceQuality.UNVERIFIED}),
        "contradicts": _item(
            "e-contradicts",
            as_of="2026-07-24T09:59:58+08:00",
        ).model_copy(update={"stance": EvidenceStance.CONTRADICTS}),
        "nan": _item(
            "e-nan",
            as_of="2026-07-24T09:59:57+08:00",
        ).model_copy(update={"value": float("nan")}),
        "decimal": _item(
            "e-decimal",
            as_of="2026-07-24T09:59:56+08:00",
        ).model_copy(update={"value": Decimal("999.99")}),
        "public_api": _item(
            "e-public-api",
            as_of="2026-07-24T09:59:55+08:00",
        ).model_copy(update={"source_type": SourceType.PUBLIC_API}),
    }

    eligible_scope_items = tuple(
        item for name, item in later.items() if name != "public_api"
    )
    pack = _pack(current=(valid, *eligible_scope_items))
    forged = pack.model_copy(
        update={
            "evidence_by_fact": {
                FACT_KEY: (*pack.evidence_by_fact[FACT_KEY], later["public_api"])
            }
        }
    )

    rendered = render_mainland_last_price(forged)

    assert rendered.evidence_ids == ("e-valid",)
    assert "123.45 CNY" in rendered.opinion


@pytest.mark.parametrize(
    "fact_updates",
    [
        {"category": FactCategory.PUBLIC_STATISTIC, "market_metric": None},
        {"market_metric": MarketMetric.VOLUME},
        {"jurisdiction": "US"},
    ],
)
def test_renderer_rejects_noncanonical_quote_fact(
    fact_updates: dict[str, object],
) -> None:
    pack = _pack(current=(_item("e-valid"),))
    fact = pack.request.required_facts[0].model_copy(update=fact_updates)
    request = pack.request.model_copy(update={"required_facts": (fact,)})
    forged = pack.model_copy(update={"request": request})

    with pytest.raises(EvidenceProtocolError, match="^quote_unavailable$"):
        render_mainland_last_price(forged)


def test_entity_renderer_uses_only_verified_current_string_evidence() -> None:
    fact = RequiredFact(
        key="entity_reference:identity",
        description="核查 OpenAI 的公开实体身份",
        category=FactCategory.ENTITY_REFERENCE,
        data_scope=DataScope.EXTERNAL_PUBLIC,
        subject="OpenAI",
        jurisdiction="US",
        expected_shape="string",
    )
    request = DataGapRequest(
        requesting_agent="bureau:礼部:内容司",
        question="核查 OpenAI 是什么公开实体，只需要一个 ENTITY_REFERENCE",
        required_facts=(fact,),
        decision_context="核查一个公开实体身份",
        freshness=FreshnessRequirement(max_age_seconds=86400),
        request_id="request-entity-render",
        timeout_seconds=30,
        source_scope=(SourceType.SHIGUAN, SourceType.PUBLIC_API, SourceType.PUBLIC_WEB),
    )
    item = _item("entity-1", value="美国人工智能研究与部署公司", unit=None).model_copy(
        update={
            "fact_key": fact.key,
            "source_type": SourceType.PUBLIC_WEB,
            "publisher": "Wikipedia",
            "quality": EvidenceQuality.SECONDARY,
        }
    )
    pack = _pack(current=()).model_copy(
        update={
            "request": request,
            "investigation_plan": InvestigationPlan(
                fact_keys=(fact.key,), source_scope=request.source_scope
            ),
            "evidence_by_fact": {fact.key: (item,)},
            "resolved_facts": (fact.key,),
        }
    )

    rendered = render_entity_reference(pack)

    assert rendered.evidence_ids == ("entity-1",)
    assert rendered.opinion == (
        "OpenAI 的公开实体身份为：美国人工智能研究与部署公司"
        "（来源：Wikipedia；资料时间：2026-07-24T10:00:00+08:00）。"
    )
    assert "provider.example.test" not in rendered.opinion


def test_entity_renderer_fails_closed_on_unresolved_pack() -> None:
    with pytest.raises(EvidenceProtocolError, match="^entity_reference_unavailable$"):
        render_entity_reference(
            _pack(
                status=EvidencePackStatus.UNAVAILABLE,
                current=(),
                resolved=(),
                unresolved=(FACT_KEY,),
            )
        )
