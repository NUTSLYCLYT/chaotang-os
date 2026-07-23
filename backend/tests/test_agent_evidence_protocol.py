from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    EvidenceProtocolError,
    build_default_evidence_session,
    bureau_node_id,
    invoke_bureau_with_evidence,
)
from app.jinyiwei.models import (
    CacheMetadata,
    DataGapRequest,
    DataScope,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    FactCategory,
    InvestigationPlan,
    SourceType,
)


def _legacy_parser(value: object) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"opinion"}:
        raise ValueError("invalid legacy response")
    opinion = value["opinion"]
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("invalid legacy response")
    return {"opinion": opinion.strip()}


def _gap(node_id: str, *, existing: list[str] | None = None) -> str:
    return json.dumps(
        {
            "status": "NEEDS_DATA",
            "data_gap": {
                "requesting_agent": node_id,
                "question": "本次判断所需的公开事实是什么？",
                "required_facts": [
                    {
                        "key": "market_size",
                        "category": "ENTITY_REFERENCE",
                        "data_scope": "EXTERNAL_PUBLIC",
                        "subject": "target market",
                        "description": "目标市场规模",
                        "expected_unit": "元",
                        "expected_shape": "number",
                    }
                ],
                "decision_context": "用于判断预算是否合理",
                "freshness": {"max_age_seconds": 3600},
                "existing_evidence_ids": existing or [],
            },
        },
        ensure_ascii=False,
    )


def _ready(
    opinion: str,
    *,
    adopted_evidence_ids: list[str] | None = None,
    fact_basis: str | None = None,
    factual_claims: list[dict[str, object]] | None = None,
    fact_key: str = "market_size",
    category: str = "ENTITY_REFERENCE",
    subject: str = "target market",
    claim_basis: str = "CITED",
) -> str:
    adopted = adopted_evidence_ids or []
    claims = factual_claims
    if claims is None:
        claims = (
            [
                {
                    "claim": opinion,
                    "basis": claim_basis,
                    "evidence_ids": adopted,
                    "fact_key": fact_key,
                    "category": category,
                    "subject": subject,
                }
            ]
            if adopted
            else []
        )
    return json.dumps(
        {
            "status": "READY",
            "result": {"opinion": opinion, "factual_claims": claims},
            "adopted_evidence_ids": adopted,
            "fact_basis": fact_basis or ("CITED" if adopted else "NOT_REQUIRED"),
        },
        ensure_ascii=False,
    )


def _evidence(
    evidence_id: str = "e-1",
    *,
    fact_key: str = "market_size",
    source_type: SourceType = SourceType.SHIGUAN,
) -> EvidenceItem:
    return EvidenceItem(
        evidence_id=evidence_id,
        fact_key=fact_key,
        value=100,
        unit="元",
        as_of="2026-07-20T11:30:00Z",
        retrieved_at="2026-07-20T11:45:00Z",
        source_url="internal://archive/item",
        publisher="史馆",
        source_type=source_type,
        quality=EvidenceQuality.PRIMARY,
        stance=EvidenceStance.SUPPORTS,
        excerpt="公开事实原文",
        content_hash=hashlib.sha256(b"e-1").hexdigest(),
        confidence=0.9,
    )


def _pack(
    request: DataGapRequest,
    *,
    status: EvidencePackStatus = EvidencePackStatus.RESOLVED,
    cache_hit: bool = False,
    historical: bool = False,
    source_type: SourceType = SourceType.SHIGUAN,
) -> EvidencePack:
    fact_key = request.required_facts[0].key
    item = _evidence(fact_key=fact_key, source_type=source_type)
    unresolved = () if status is EvidencePackStatus.RESOLVED else (fact_key,)
    resolved = (fact_key,) if status is EvidencePackStatus.RESOLVED else ()
    return EvidencePack(
        pack_id="pack-1",
        investigation_id="investigation-1",
        status=status,
        request=request,
        investigation_plan=InvestigationPlan(
            fact_keys=(fact_key,), source_scope=request.source_scope
        ),
        evidence_by_fact={fact_key: (item,) if resolved and not historical else ()},
        historical_evidence_by_fact={fact_key: (item,) if historical else ()},
        resolved_facts=resolved,
        unresolved_facts=unresolved,
        conflicts=(),
        source_attempts=(),
        investigation_started_at="2026-07-20T11:45:00Z",
        investigation_completed_at="2026-07-20T11:45:01Z",
        cache=CacheMetadata(hit=cache_hit),
        do_not_infer=unresolved,
    )


class Coordinator:
    def __init__(
        self,
        *,
        status: EvidencePackStatus = EvidencePackStatus.RESOLVED,
        cache_hit: bool = False,
    ) -> None:
        self.status = status
        self.cache_hit = cache_hit
        self.calls: list[tuple[DataGapRequest, str, str, object]] = []

    def investigate(
        self,
        request: DataGapRequest,
        *,
        department: str,
        matter_type: str,
        extraction_budget: object,
    ) -> EvidencePack:
        self.calls.append((request, department, matter_type, extraction_budget))
        return _pack(request, status=self.status, cache_hit=self.cache_hit)


class Clock:
    def __init__(self) -> None:
        self.value = 100.0

    def __call__(self) -> float:
        return self.value


def _invoke(
    session: AgentEvidenceSession,
    model: object,
    *,
    node_id: str | None = None,
) -> dict[str, str]:
    return invoke_bureau_with_evidence(
        node_id=node_id or bureau_node_id("户部", "预算司"),
        department="户部",
        bureau="预算司",
        matter_type="MEMORIAL",
        messages=[{"role": "user", "content": "旨意摘要"}],
        chat_model=model,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
        session=session,
    )


def test_bare_ready_response_is_rejected_without_investigation() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)

    with pytest.raises(EvidenceProtocolError, match="uncited_fact_dependency"):
        _invoke(session, lambda _messages: '{"opinion":"可行"}')
    assert coordinator.calls == []
    snapshot = session.snapshot()
    assert snapshot.investigation_count == 0
    assert snapshot.bureau_selections == ()


def test_ready_response_rejects_undeclared_fact_basis() -> None:
    """An evidence-session READY response cannot silently omit its fact basis."""

    with pytest.raises(EvidenceProtocolError, match="uncited_fact_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: '{"status":"READY","result":{"opinion":"最新股价上涨"},'
            '"adopted_evidence_ids":[]}',
        )


def test_ready_response_rejects_missing_factual_claim_declarations() -> None:
    """READY envelopes cannot hide a factual dependency outside the contract."""

    with pytest.raises(EvidenceProtocolError, match="uncited_fact_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: json.dumps(
                {
                    "status": "READY",
                    "result": {"opinion": "比亚迪最新股价上涨"},
                    "adopted_evidence_ids": [],
                    "fact_basis": "NOT_REQUIRED",
                },
                ensure_ascii=False,
            ),
        )


def test_ready_response_rejects_empty_citations_for_declared_external_claim() -> None:
    with pytest.raises(EvidenceProtocolError, match="uncited_fact_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(
                "比亚迪最新股价上涨",
                fact_basis="CITED",
                factual_claims=[
                    {
                        "claim": "比亚迪最新股价上涨",
                        "basis": "CITED",
                        "evidence_ids": [],
                        "fact_key": "quote",
                        "category": "MARKET_QUOTE",
                        "subject": "比亚迪",
                    }
                ],
            ),
        )


def test_ready_cannot_hide_external_fact_dependency_with_empty_claims() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            messages=[{"role": "user", "content": "旨意：看看比亚迪股票价格"}],
            chat_model=lambda _messages: _ready("比亚迪现价为 300 元"),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=session,
        )


def test_normative_ready_is_not_misclassified_as_external_dependency() -> None:
    result = invoke_bureau_with_evidence(
        node_id=bureau_node_id("户部", "预算司"),
        department="户部",
        bureau="预算司",
        matter_type="MEMORIAL",
        messages=[{"role": "user", "content": "旨意：完善内部审批制度"}],
        chat_model=lambda _messages: _ready("建议在当前阶段先建立三级审核流程"),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=AgentEvidenceSession(coordinator=Coordinator()),
    )

    assert result == {"opinion": "建议在当前阶段先建立三级审核流程"}

    metric_policy = _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready("建议加强营收披露审核"),
    )
    assert metric_policy == {"opinion": "建议加强营收披露审核"}


def test_ready_rejects_objective_opinion_not_covered_by_declared_claim() -> None:
    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            _gap(node),
            _ready(
                "比亚迪现价为 300 元",
                adopted_evidence_ids=["e-1"],
                factual_claims=[
                    {
                        "claim": "证据表明市场活跃",
                        "basis": "CITED",
                        "evidence_ids": ["e-1"],
                        "fact_key": "market_size",
                        "category": "ENTITY_REFERENCE",
                        "subject": "target market",
                    }
                ],
            ),
        )
    )

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: next(responses),
        )


def test_ready_rejects_unrelated_citation_with_same_value_and_state() -> None:
    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            _gap(node),
            _ready(
                "比亚迪现价为 300 元",
                adopted_evidence_ids=["e-1"],
                factual_claims=[
                    {
                        "claim": "腾讯现价为 300 元",
                        "basis": "CITED",
                        "evidence_ids": ["e-1"],
                        "fact_key": "market_size",
                        "category": "ENTITY_REFERENCE",
                        "subject": "target market",
                    }
                ],
            ),
        )
    )

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: next(responses),
        )


def test_user_provided_claim_must_be_traceable_to_original_prompt() -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            messages=[{"role": "user", "content": "旨意：分析比亚迪"}],
            chat_model=lambda _messages: _ready(
                "比亚迪营收为 300 亿元",
                factual_claims=[
                    {
                        "claim": "比亚迪营收为 300 亿元",
                        "basis": "USER_PROVIDED",
                        "evidence_ids": [],
                        "fact_key": None,
                        "category": None,
                        "subject": None,
                    }
                ],
            ),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


@pytest.mark.parametrize("opinion", ["公司有3家工厂", "公司已停牌"])
def test_ready_rejects_plain_numeric_and_short_status_facts(opinion: str) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(opinion),
        )


@pytest.mark.parametrize(
    "opinion",
    ["建议将补贴上限设为300元", "建议在2026年7月完成评审"],
)
def test_ready_allows_numeric_and_date_normative_proposals(opinion: str) -> None:
    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(opinion),
    ) == {"opinion": opinion}


@pytest.mark.parametrize(
    ("prompt", "opinion"),
    [
        ("看看比亚迪最新报价", "比亚迪最新报价三百块"),
        ("分析公司交易状态", "公司已停止交易"),
        ("分析公司产能", "公司有三家工厂"),
        ("看看公司最新动态", "公司最新动态没有变化"),
        ("看看公司新闻", "公司昨日发布新公告"),
    ],
)
def test_ready_rejects_any_unclaimed_observation(prompt: str, opinion: str) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            messages=[{"role": "user", "content": f"旨意：{prompt}"}],
            chat_model=lambda _messages: _ready(opinion),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


@pytest.mark.parametrize(
    "opinion", ["建议补贴300元", "可将补贴上限设为300元"]
)
def test_ready_allows_unbounded_normative_wording(opinion: str) -> None:
    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(opinion),
    ) == {"opinion": opinion}


def test_user_provided_question_is_not_a_grounded_fact() -> None:
    claim = {
        "claim": "比亚迪营收为300亿元",
        "basis": "USER_PROVIDED",
        "evidence_ids": [],
        "fact_key": None,
        "category": None,
        "subject": None,
    }
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            messages=[{"role": "user", "content": "旨意：比亚迪营收为300亿元吗？"}],
            chat_model=lambda _messages: _ready(
                "比亚迪营收为300亿元", factual_claims=[claim]
            ),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )

    assert invoke_bureau_with_evidence(
        node_id=bureau_node_id("户部", "预算司"),
        department="户部",
        bureau="预算司",
        matter_type="MEMORIAL",
        messages=[
            {
                "role": "user",
                "content": "旨意：已知比亚迪营收为300亿元，请分析风险。",
            }
        ],
        chat_model=lambda _messages: _ready(
            "比亚迪营收为300亿元", factual_claims=[claim]
        ),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=AgentEvidenceSession(coordinator=Coordinator()),
    ) == {"opinion": "比亚迪营收为300亿元"}


@pytest.mark.parametrize(
    "prompt",
    [
        "旨意：已知比亚迪营收为300亿元吗？",
        "旨意：事实是比亚迪营收为300亿元呢？",
        "旨意：请说明已知比亚迪营收为300亿元",
        "旨意：帮我看看已知比亚迪营收为300亿元是否属实",
        "旨意：查询已知比亚迪营收为300亿元的数据来源",
    ],
)
def test_user_provided_request_overrides_fact_marker(prompt: str) -> None:
    claim = {
        "claim": "比亚迪营收为300亿元",
        "basis": "USER_PROVIDED",
        "evidence_ids": [],
        "fact_key": None,
        "category": None,
        "subject": None,
    }
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            messages=[{"role": "user", "content": prompt}],
            chat_model=lambda _messages: _ready(
                "比亚迪营收为300亿元", factual_claims=[claim]
            ),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


@pytest.mark.parametrize(
    "opinion",
    [
        "可以看到比亚迪现价为300元",
        "可见比亚迪现价为300元",
        "建议注意比亚迪现价为300元",
        "建议关注公司当前已停牌",
        "建议注意公司昨日发布新公告",
        "可以看到公司有三家工厂",
    ],
)
def test_normative_prefix_cannot_hide_observation(opinion: str) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            messages=[{"role": "user", "content": "旨意：分析比亚迪"}],
            chat_model=lambda _messages: _ready(opinion),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


@pytest.mark.parametrize("declaration", ["EMPTY", "NORMATIVE"])
@pytest.mark.parametrize(
    "opinion",
    [
        "建议按比亚迪300元股价立即买入",
        "建议采用比亚迪昨日收盘价制定预算",
        "建议在英伟达最新市值基础上配置资金",
        "应当基于腾讯当前估值调整方案",
        "Recommend buying BYD immediately at its CNY 300 share price",
        "Recommend buying BYD immediately at its 300-yuan stock price",
        "Use BYD's yesterday closing price to set the budget",
        "Use BYD's previous close to set the budget",
        "Allocate funds based on NVIDIA's latest market capitalization",
        "Allocate funds based on NVIDIA's most recent market value",
        "The plan should reflect Tesla's current valuation",
    ],
)
def test_normative_declaration_cannot_exempt_embedded_observed_fact(
    opinion: str,
    declaration: str,
) -> None:
    factual_claims = (
        []
        if declaration == "EMPTY"
        else [
            {
                "claim": opinion,
                "basis": "NORMATIVE",
                "evidence_ids": [],
                "fact_key": None,
                "category": None,
                "subject": None,
            }
        ]
    )

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(opinion, factual_claims=factual_claims),
        )


@pytest.mark.parametrize(
    "opinion",
    [
        "建议补贴300元",
        "可将上限设为300元",
        "建议将补贴调整为300元",
        "建议在2026年7月执行新方案",
        "Recommend a CNY 300 subsidy",
        "Set the subsidy cap at CNY 300",
    ],
)
def test_explicit_proposal_remains_exempt(opinion: str) -> None:
    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(opinion),
    ) == {"opinion": opinion}


def test_frozen_evidence_binding_is_read_only_and_fact_specific() -> None:
    request = DataGapRequest(
        request_id="population-request",
        requesting_agent="bureau:户部:预算司",
        question="人口是多少？",
        required_facts=(
            {
                "key": "population",
                "description": "当前人口",
                "category": "PUBLIC_STATISTIC",
                "data_scope": "EXTERNAL_PUBLIC",
                "subject": "北京市",
            },
        ),
        decision_context="人口分析",
        freshness={"max_age_seconds": 3600},
        timeout_seconds=30,
        source_scope=("SHIGUAN",),
    )
    session = AgentEvidenceSession(coordinator=Coordinator())
    session.freeze_pack(_pack(request))

    binding = session.evidence_binding("e-1")
    assert binding is not None
    assert binding.fact_key == "population"
    assert binding.category is FactCategory.PUBLIC_STATISTIC
    assert binding.data_scope is DataScope.EXTERNAL_PUBLIC
    assert binding.subject == "北京市"
    assert binding.historical is False
    with pytest.raises(AttributeError):
        binding.subject = "比亚迪"


def test_population_evidence_cannot_support_byd_quote_claim() -> None:
    population_request = DataGapRequest(
        request_id="population-request",
        requesting_agent="bureau:户部:预算司",
        question="人口是多少？",
        required_facts=(
            {
                "key": "population",
                "description": "当前人口",
                "category": "PUBLIC_STATISTIC",
                "data_scope": "EXTERNAL_PUBLIC",
                "subject": "北京市",
            },
        ),
        decision_context="人口分析",
        freshness={"max_age_seconds": 3600},
        timeout_seconds=30,
        source_scope=("SHIGUAN",),
    )
    session = AgentEvidenceSession(coordinator=Coordinator())
    session.freeze_pack(_pack(population_request))

    with pytest.raises(EvidenceProtocolError, match="evidence_binding_invalid"):
        _invoke(
            session,
            lambda _messages: _ready(
                "比亚迪现价为300元",
                adopted_evidence_ids=["e-1"],
                fact_key="byd_quote",
                category="MARKET_QUOTE",
                subject="比亚迪",
            ),
        )


def test_cited_and_archived_claims_enforce_evidence_partition() -> None:
    request = DataGapRequest(
        request_id="archive-request",
        requesting_agent="bureau:户部:预算司",
        question="历史规模是多少？",
        required_facts=(
            {
                "key": "market_size",
                "description": "历史市场规模",
                "category": "ENTITY_REFERENCE",
                "data_scope": "INTERNAL_BUSINESS",
                "subject": "target market",
            },
        ),
        decision_context="历史分析",
        freshness={"max_age_seconds": 3600},
        timeout_seconds=30,
        source_scope=("SHIGUAN",),
    )
    historical_session = AgentEvidenceSession(coordinator=Coordinator())
    historical_session.freeze_pack(_pack(request, historical=True))

    with pytest.raises(EvidenceProtocolError, match="evidence_binding_invalid"):
        _invoke(
            historical_session,
            lambda _messages: _ready(
                "历史市场规模为100元", adopted_evidence_ids=["e-1"]
            ),
        )

    archived_session = AgentEvidenceSession(coordinator=Coordinator())
    archived_session.freeze_pack(_pack(request, historical=True))
    assert _invoke(
        archived_session,
        lambda _messages: _ready(
            "历史市场规模为100元",
            adopted_evidence_ids=["e-1"],
            claim_basis="ARCHIVED",
        ),
    ) == {"opinion": "历史市场规模为100元"}

    public_request = request.model_copy(update={"source_scope": (SourceType.PUBLIC_API,)})
    public_session = AgentEvidenceSession(coordinator=Coordinator())
    public_session.freeze_pack(
        _pack(public_request, source_type=SourceType.PUBLIC_API)
    )
    with pytest.raises(EvidenceProtocolError, match="evidence_binding_invalid"):
        _invoke(
            public_session,
            lambda _messages: _ready(
                "历史市场规模为100元",
                adopted_evidence_ids=["e-1"],
                claim_basis="ARCHIVED",
            ),
        )


def test_bureau_requests_current_market_quote_then_cites_frozen_evidence() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    current_quote_gap = json.dumps(
        {
            "status": "NEEDS_DATA",
            "data_gap": {
                "requesting_agent": node,
                "question": "比亚迪当前成交价是多少？",
                "required_facts": [
                    {
                        "key": "byd_current_quote",
                        "category": "MARKET_QUOTE",
                        "data_scope": "EXTERNAL_PUBLIC",
                        "subject": "BYD",
                        "jurisdiction": "CN",
                        "description": "比亚迪当前成交价",
                        "expected_unit": "CNY",
                        "expected_shape": "number",
                    }
                ],
                "decision_context": "用于评估当前市场价格",
                "freshness": {"max_age_seconds": 300},
                "existing_evidence_ids": [],
            },
        },
        ensure_ascii=False,
    )
    responses = iter(
        (
            current_quote_gap,
            _ready(
                "有证据的意见",
                adopted_evidence_ids=["e-1"],
                fact_key="byd_current_quote",
                category="MARKET_QUOTE",
                subject="BYD",
            ),
        )
    )

    assert _invoke(session, lambda _messages: next(responses)) == {
        "opinion": "有证据的意见"
    }
    request = coordinator.calls[0][0]
    assert request.required_facts[0].category.value == "MARKET_QUOTE"
    assert request.required_facts[0].subject == "BYD"
    assert request.required_facts[0].jurisdiction == "CN"
    assert request.freshness.max_age_seconds == 300


def test_policy_only_ready_response_declares_not_required_fact_basis() -> None:
    result = _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: json.dumps(
            {
                "status": "READY",
                    "result": {"opinion": "建议建立审核流程", "factual_claims": []},
                "adopted_evidence_ids": [],
                "fact_basis": "NOT_REQUIRED",
            },
            ensure_ascii=False,
        ),
    )

    assert result == {"opinion": "建议建立审核流程"}


def test_cited_ready_response_requires_adopted_evidence() -> None:
    with pytest.raises(EvidenceProtocolError, match="uncited_fact_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: json.dumps(
                {
                    "status": "READY",
                    "result": {"opinion": "依据最新股价处理"},
                    "adopted_evidence_ids": [],
                    "fact_basis": "CITED",
                },
                ensure_ascii=False,
            ),
        )


def test_enveloped_ready_adopts_only_frozen_unique_evidence() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            _gap(node),
            _ready("有证据后可行", adopted_evidence_ids=["e-1"]),
        )
    )

    result = _invoke(session, lambda _messages: next(responses))

    assert result == {"opinion": "有证据后可行"}
    snapshot = session.snapshot()
    assert snapshot.available_evidence_ids == ("e-1",)
    assert snapshot.adopted_evidence_ids == ("e-1",)
    assert snapshot.bureau_selections == ((node, ("e-1",)),)
    assert snapshot.investigation_count == 1
    assert snapshot.used is True
    assert snapshot.investigating_bureau_node_ids == (node,)


def test_cache_hit_freezes_pack_but_does_not_claim_real_investigation() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator(cache_hit=True))
    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            _gap(node),
            _ready("cached", adopted_evidence_ids=["e-1"]),
        )
    )

    assert _invoke(session, lambda _messages: next(responses)) == {"opinion": "cached"}
    snapshot = session.snapshot()
    assert snapshot.available_evidence_ids == ("e-1",)
    assert snapshot.used is False
    assert snapshot.investigating_bureau_node_ids == ()


def test_non_bureau_identity_is_rejected_before_model_call() -> None:
    calls = 0

    def model(_messages: object) -> str:
        nonlocal calls
        calls += 1
        return '{"opinion":"不应调用"}'

    with pytest.raises(EvidenceProtocolError, match="bureau_identity_invalid"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), model, node_id="ministry:户部")
    assert calls == 0


def test_spoofed_or_oversized_gap_is_sanitized() -> None:
    node = bureau_node_id("户部", "预算司")
    spoofed = _gap(bureau_node_id("工部", "质量司"))
    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid") as exc_info:
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), lambda _messages: spoofed)
    assert "质量司" not in str(exc_info.value)

    oversized = json.loads(_gap(node))
    oversized["data_gap"]["question"] = "x" * 501
    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: json.dumps(oversized),
        )


def test_one_investigation_injects_delimited_untrusted_pack_and_resumes_same_bureau() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    seen: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        seen.append(messages)
        if len(seen) == 1:
            return _gap(node)
        return _ready("建议继续办理")

    assert _invoke(session, model) == {"opinion": "建议继续办理"}
    assert len(seen) == 2
    assert seen[0] == [{"role": "user", "content": "旨意摘要"}]
    injected = seen[1][-1]["content"]
    assert "BEGIN_UNTRUSTED_EVIDENCE_PACK" in injected
    assert "END_UNTRUSTED_EVIDENCE_PACK" in injected
    assert "公开事实原文" in injected
    assert coordinator.calls[0][1:3] == ("户部", "MEMORIAL")


def test_second_gap_and_unavailable_pack_use_fallback_without_loop() -> None:
    node = bureau_node_id("户部", "预算司")
    calls = 0

    def model(_messages: object) -> str:
        nonlocal calls
        calls += 1
        return _gap(node)

    result = _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)
    assert result == {"opinion": "证据受限：second_data_gap"}
    assert calls == 2

    calls = 0
    result = _invoke(
        AgentEvidenceSession(coordinator=Coordinator(status=EvidencePackStatus.UNAVAILABLE)),
        model,
    )
    assert result == {"opinion": "证据受限：evidence_unavailable"}
    assert calls == 1


def test_per_bureau_once_and_decree_three_investigation_cap() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    identities = (("户部", "预算司"), ("户部", "出纳司"), ("工部", "质量司"))
    for department, bureau in identities:
        node = bureau_node_id(department, bureau)
        responses = iter((_gap(node), _ready("建议继续办理")))
        result = invoke_bureau_with_evidence(
            node_id=node,
            department=department,
            bureau=bureau,
            matter_type="MEMORIAL",
            messages=[],
            chat_model=lambda _messages, values=responses: next(values),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=session,
        )
        assert result == {"opinion": "建议继续办理"}
    fourth = bureau_node_id("工部", "现场司")
    assert invoke_bureau_with_evidence(
        node_id=fourth,
        department="工部",
        bureau="现场司",
        matter_type="MEMORIAL",
        messages=[],
        chat_model=lambda _messages: _gap(fourth),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    ) == {"opinion": "investigation_budget_exhausted"}
    assert len(coordinator.calls) == 3
    assert session.snapshot().investigating_bureau_node_ids == tuple(
        bureau_node_id(department, bureau) for department, bureau in identities
    )


def test_deadline_and_unknown_existing_evidence_fall_closed() -> None:
    clock = Clock()
    session = AgentEvidenceSession(coordinator=Coordinator(), monotonic=clock)
    clock.value = 130.0
    node = bureau_node_id("户部", "预算司")
    assert _invoke(session, lambda _messages: _gap(node)) == {
        "opinion": "证据受限：deadline_exhausted"
    }

    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _gap(node, existing=["unknown"]),
        )


def test_subsecond_remaining_time_falls_back_without_oversized_request() -> None:
    clock = Clock()
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator, monotonic=clock)
    clock.value = 129.5
    node = bureau_node_id("户部", "预算司")

    assert _invoke(session, lambda _messages: _gap(node)) == {
        "opinion": "证据受限：deadline_exhausted"
    }
    assert coordinator.calls == []
    assert session.snapshot().used is False


def test_deadline_rechecked_after_investigation_claim_before_coordinator() -> None:
    values = iter((100.0, 129.0, 129.5, 130.0))
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator, monotonic=lambda: next(values))
    node = bureau_node_id("户部", "预算司")

    assert _invoke(session, lambda _messages: _gap(node)) == {
        "opinion": "证据受限：deadline_exhausted"
    }
    assert coordinator.calls == []
    assert session.snapshot().used is False


def test_extractor_cap_is_exactly_six_and_snapshot_is_immutable() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    assert [session.claim() for _ in range(7)] == [True] * 6 + [False]
    snapshot = session.snapshot()
    assert snapshot.extractor_count == 6
    with pytest.raises((AttributeError, TypeError)):
        snapshot.available_evidence_ids += ("tamper",)


def test_coordinator_failure_is_sanitized_and_default_factory_has_no_io(tmp_path: Path) -> None:
    class FailingCoordinator:
        def investigate(self, *_args: object, **_kwargs: object) -> EvidencePack:
            raise RuntimeError("secret evidence\ntrace")

    node = bureau_node_id("户部", "预算司")
    failing_session = AgentEvidenceSession(coordinator=FailingCoordinator())
    assert _invoke(
        failing_session,
        lambda _messages: _gap(node),
    ) == {"opinion": "证据受限：evidence_unavailable"}
    assert failing_session.snapshot().used is False
    assert failing_session.snapshot().investigating_bureau_node_ids == ()

    model_calls = 0

    def model(_input: object) -> str:
        nonlocal model_calls
        model_calls += 1
        raise AssertionError("must not run during construction")

    built = build_default_evidence_session(model, db_path=tmp_path / "jinyiwei.sqlite3")
    assert isinstance(built, AgentEvidenceSession)
    assert model_calls == 0


def test_default_evidence_session_does_not_touch_environment_when_mcp_disabled(
    monkeypatch, tmp_path: Path
) -> None:
    class NoAccessEnvironment(dict[str, str]):
        def __iter__(self):
            raise AssertionError("environment iterated")

        def items(self):
            raise AssertionError("environment iterated")

        def get(self, _key: str, _default=None):
            raise AssertionError("environment key read")

    monkeypatch.setattr(
        "app.jinyiwei.mcp.credentials.os.environ",
        NoAccessEnvironment(),
    )

    session = build_default_evidence_session(
        lambda _messages: pytest.fail("model called"),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    assert session.snapshot().used is False


def test_malformed_ready_and_adoption_outside_frozen_pack_are_typed() -> None:
    with pytest.raises(EvidenceProtocolError, match="response_invalid"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), lambda _messages: "not json")

    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            _gap(node),
            _ready("x", adopted_evidence_ids=["not-frozen"]),
        )
    )
    with pytest.raises(EvidenceProtocolError, match="adoption_invalid"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), lambda _messages: next(responses))
