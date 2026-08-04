from __future__ import annotations

# ruff: noqa: E501, I001

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    EvidenceProtocolError,
    build_bureau_evidence_tool_adapter,
    verify_bureau_evidence_tool_adapter,
    build_default_evidence_session,
    bureau_node_id,
    invoke_bureau_with_evidence,
)
from app.agents.evidence_rendering import render_mainland_last_price
from app.agents.market_fact_plan import compile_mainland_last_price_plan
from app.jinyiwei.mcp.runtime import LOCAL_CREDENTIAL_SOURCE_ENV
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
    MarketMetric,
    SourceType,
)
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry
from app.agents.runtime_skills.tool_executor import execute_approved_tool
from app.agents.runtime_skills.tool_handlers import build_bureau_tool_handlers
from app.agents.runtime_skills.tool_models import (
    ToolAuthorizationContext, ToolBudget, ToolCallProposal, ToolHandlerContext,
    ToolName,
)
from app.agents.runtime_skills.tool_policy import approve_tool_call
from app.agents.runtime_skills.tool_registry import TOOL_DESCRIPTORS


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


def _quote_gap(node_id: str) -> str:
    return json.dumps(
        {
            "status": "NEEDS_DATA",
            "data_gap": {
                "requesting_agent": node_id,
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
                        "market_metric": "LAST_PRICE",
                    }
                ],
                "decision_context": "用于评估当前市场价格",
                "freshness": {"max_age_seconds": 300},
                "existing_evidence_ids": [],
            },
        },
        ensure_ascii=False,
    )


def _market_gap(node_id: str, facts: list[dict[str, object]]) -> str:
    return json.dumps(
        {
            "status": "NEEDS_DATA",
            "data_gap": {
                "requesting_agent": node_id,
                "question": "比亚迪行情如何？",
                "required_facts": facts,
                "decision_context": "用于评估当前市场价格",
                "freshness": {"max_age_seconds": 300},
                "existing_evidence_ids": [],
            },
        },
        ensure_ascii=False,
    )


def _market_fact(
    key: str,
    metric: str,
    *,
    jurisdiction: str | None = "CN",
    subject: str = "BYD",
) -> dict[str, object]:
    return {
        "key": key,
        "category": "MARKET_QUOTE",
        "data_scope": "EXTERNAL_PUBLIC",
        "subject": subject,
        "jurisdiction": jurisdiction,
        "description": key,
        "expected_unit": "CNY",
        "expected_shape": "number",
        "market_metric": metric,
    }


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
            else [_normative_claim(opinion)]
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


def _normative_claim(claim: str) -> dict[str, object]:
    return {
        "claim": claim,
        "basis": "NORMATIVE",
        "evidence_ids": [],
        "fact_key": None,
        "category": None,
        "subject": None,
    }


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


def test_bureau_evidence_tool_adapter_uses_real_session_and_canonical_projection() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator, id_factory=lambda: "request-tool")
    adapter = build_bureau_evidence_tool_adapter(
        session=session, node_id="bureau:libu:policy", department="吏部",
        matter_type="MEMORIAL", case_id="case-1", decree_id="decree-1",
    )
    call = SimpleNamespace(
        case_id="case-1", decree_id="decree-1",
        normalized_arguments={
            "domain": "workforce.policy",
            "fact_slots": [{
                "fact_slot": "market_size", "description": "market size",
                "category": "PUBLIC_STATISTIC", "data_scope": "EXTERNAL_PUBLIC",
                "subject": "market", "time_range": {"as_of": "case"},
                "freshness": {"max_age_seconds": 600}, "use": "decision",
            }],
        },
    )
    payload = adapter(SimpleNamespace(approved_call=call))
    assert len(coordinator.calls) == 1
    assert coordinator.calls[0][0].required_facts[0].key == "market_size"
    assert session.snapshot().available_evidence_ids == ("e-1",)
    assert payload["data"] == {"facts": [{
        "ref": "evidence:case:case-1:decree:decree-1:e-1",
        "fact_key": "market_size", "summary": "公开事实原文",
        "value": 100, "as_of": "2026-07-20T11:30:00Z",
    }]}
    with pytest.raises(AttributeError, match="frozen"):
        adapter._case_id = "forged"  # type: ignore[attr-defined]


def test_bureau_evidence_tool_adapter_is_signed_final_and_tamper_evident() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    adapter = build_bureau_evidence_tool_adapter(
        session=session, node_id="bureau:libu:policy", department="吏部",
        matter_type="MEMORIAL", case_id="case-1", decree_id="decree-1",
    )
    assert verify_bureau_evidence_tool_adapter(
        adapter, case_id="case-1", decree_id="decree-1"
    )
    with pytest.raises(TypeError):
        class Forged(type(adapter)):
            pass
    object.__setattr__(adapter, "_case_id", "forged")
    assert not verify_bureau_evidence_tool_adapter(
        adapter, case_id="case-1", decree_id="decree-1"
    )


def test_exact_type_full_slot_clone_cannot_reuse_signed_provenance() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    original = build_bureau_evidence_tool_adapter(session=session, node_id="bureau:x", department="吏部", matter_type="MEMORIAL", case_id="case-1", decree_id="decree-1")
    clone = object.__new__(type(original))
    for slot in type(original).__slots__:
        object.__setattr__(clone, slot, getattr(original, slot))
    assert not verify_bureau_evidence_tool_adapter(clone, case_id="case-1", decree_id="decree-1")
    object.__setattr__(clone, "_signature", "0" * 64)
    assert not verify_bureau_evidence_tool_adapter(clone, case_id="case-1", decree_id="decree-1")


def test_bureau_evidence_tool_real_approved_end_to_end() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator, id_factory=lambda: "req-e2e")
    skill = build_default_downstream_skill_registry().get_by_agent("libu-policy")
    policy = skill.tool_policy
    assert policy is not None
    arguments = {
        "operation": "request_fact_slots", "domain": "workforce.policy",
        "fact_slots": [{"fact_slot": "market_size", "description": "market size", "category": "PUBLIC_STATISTIC", "data_scope": "EXTERNAL_PUBLIC", "subject": "market", "time_range": {"as_of": "case"}, "freshness": {"max_age_seconds": 600}, "use": "decision"}],
        "estimated_rows": 1, "estimated_bytes": 1024,
    }
    authorization = ToolAuthorizationContext(
        request_id="request-1", case_id="case-1", decree_id="decree-1",
        agent_id=skill.agent_id, skill_id=skill.skill_id, skill_version=skill.version,
        policy_id=policy.policy_id, policy_version=policy.version,
        approved_input_refs=(), approved_evidence_refs=(), approved_data_refs=(),
        business_state="ready", system_max_calls=4, system_max_rounds=2,
        system_max_result_rows=200, system_max_result_bytes=262144,
    )
    budget = ToolBudget(max_calls=4, consumed_calls=0, max_rounds=2, consumed_rounds=0, max_rows=200, consumed_rows=0, max_bytes=262144, consumed_bytes=0)
    approved = approve_tool_call(authorization, ToolCallProposal(tool_call_id="tc-e2e", tool_name=ToolName.REQUEST_EVIDENCE, purpose="bounded fact", arguments=arguments, required_for=("finding",), expected_result_schema=TOOL_DESCRIPTORS[ToolName.REQUEST_EVIDENCE].output_schema_id), budget, ())
    adapter = build_bureau_evidence_tool_adapter(session=session, node_id="bureau:libu:policy", department="吏部", matter_type="MEMORIAL", case_id="case-1", decree_id="decree-1")
    capability = build_bureau_tool_handlers(material_reader=None, data_reader=None, evidence_requester=adapter)
    context = ToolHandlerContext(approved_call=approved, capability_id=capability.capability_id, resolved_approved_inputs={}, restricted_adapters={"evidence": "protocol"}, budget=budget)  # type: ignore[attr-defined]
    result = execute_approved_tool(approved, context, capability)
    assert result.data["facts"][0]["fact_key"] == "market_size"
    assert len(coordinator.calls) == 1
    assert coordinator.calls[0][0].source_scope[:2] == (SourceType.SHIGUAN, SourceType.MCP)
    snapshot = session.snapshot()
    assert snapshot.bureau_selections == snapshot.adopted_evidence_ids == ()
    assert snapshot.degradation_reasons == ()


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        (EvidencePackStatus.PARTIAL, "PARTIAL"),
        (EvidencePackStatus.UNAVAILABLE, "evidence_unavailable"),
        (EvidencePackStatus.BLOCKED, "evidence_blocked"),
    ],
)
def test_bureau_evidence_tool_status_mapping(status, expected) -> None:
    session = AgentEvidenceSession(coordinator=Coordinator(status=status))
    adapter = build_bureau_evidence_tool_adapter(session=session, node_id="bureau:x", department="吏部", matter_type="MEMORIAL", case_id="case-1", decree_id="decree-1")
    call = SimpleNamespace(case_id="case-1", decree_id="decree-1", normalized_arguments={"domain": "workforce.policy", "fact_slots": [{"fact_slot": "market_size", "description": "market size", "category": "PUBLIC_STATISTIC", "data_scope": "EXTERNAL_PUBLIC", "subject": "market", "time_range": {"as_of": "case"}, "freshness": {"max_age_seconds": 600}, "use": "decision"}]})
    if status is EvidencePackStatus.PARTIAL:
        assert adapter(SimpleNamespace(approved_call=call))["data_quality"] == expected
    else:
        with pytest.raises(EvidenceProtocolError, match=expected):
            adapter(SimpleNamespace(approved_call=call))
    snapshot = session.snapshot()
    assert len(snapshot.packs) == 1
    assert snapshot.bureau_selections == snapshot.adopted_evidence_ids == ()
    assert snapshot.degradation_reasons


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
        decree_text="旨意摘要",
        messages=[{"role": "user", "content": "旨意摘要"}],
        chat_model=model,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
        session=session,
    )


def test_bare_ready_response_is_rejected_without_investigation() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)

    result = _invoke(session, lambda _messages: '{"opinion":"可行"}')

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    assert coordinator.calls == []
    snapshot = session.snapshot()
    assert snapshot.investigation_count == 0
    assert snapshot.bureau_selections == ()
    assert snapshot.adopted_evidence_ids == ()
    assert snapshot.degradation_reasons == (
        f"model_synthesis_degraded:{bureau_node_id('户部', '预算司')}",
    )


def test_initial_malformed_ready_degrades_without_adopting_output() -> None:
    """An incomplete READY is discarded instead of aborting the whole decree."""

    session = AgentEvidenceSession(coordinator=Coordinator())
    node = bureau_node_id("户部", "预算司")

    result = _invoke(
        session,
        lambda _messages: '{"status":"READY","result":{"opinion":"SECRET-FACT"},'
        '"adopted_evidence_ids":[]}',
        node_id=node,
    )

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    snapshot = session.snapshot()
    assert snapshot.adopted_evidence_ids == ()
    assert snapshot.degradation_reasons == (f"model_synthesis_degraded:{node}",)
    assert "SECRET-FACT" not in result["opinion"]


def test_ready_response_rejects_missing_factual_claim_declarations() -> None:
    """READY envelopes cannot hide a factual dependency outside the contract."""

    result = _invoke(
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

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}


def test_ready_response_rejects_empty_citations_for_declared_external_claim() -> None:
    result = _invoke(
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

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}


def test_ready_cannot_hide_external_fact_dependency_with_empty_claims() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            decree_text="看看比亚迪股票价格",
            messages=[{"role": "user", "content": "旨意：看看比亚迪股票价格"}],
            chat_model=lambda _messages: _ready("比亚迪现价为 300 元"),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=session,
        )


def test_unsupported_dependency_correction_can_request_data_once() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    rejected_ready_body = _ready("比亚迪现价为 300 元")
    responses = iter(
        (
            rejected_ready_body,
            _quote_gap(node),
            _ready(
                "有证据的行情意见",
                adopted_evidence_ids=["e-1"],
                fact_key="byd_current_quote",
                category="MARKET_QUOTE",
                subject="BYD",
            ),
        )
    )
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="预算司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
        chat_model=model,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert result == {"opinion": "有证据的行情意见"}
    assert len(model_calls) == 3
    assert "NEEDS_DATA" in model_calls[1][-1]["content"]
    assert rejected_ready_body not in model_calls[1][-1]["content"]
    assert (
        coordinator.calls[0][0].required_facts[0].category
        is FactCategory.MARKET_QUOTE
    )


def test_unsupported_dependency_correction_rejects_corrected_ready() -> None:
    responses = iter((_ready("比亚迪现价为 300 元"), _ready("建议继续观察")))
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)
    assert len(model_calls) == 2


def test_bare_opinion_gets_one_sanitized_protocol_correction() -> None:
    bare_response = '{"opinion":"建议先定义岗位职责与交付里程碑"}'
    responses = iter(
        (
            bare_response,
            _ready("建议先定义岗位职责与交付里程碑"),
        )
    )
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    result = _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)

    assert result == {"opinion": "建议先定义岗位职责与交付里程碑"}
    assert len(model_calls) == 2
    correction = model_calls[1][-1]["content"]
    assert bare_response not in correction
    assert "READY" in correction
    assert "NEEDS_DATA" in correction


def test_bare_opinion_invalid_correction_degrades_without_using_output() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    node = bureau_node_id("户部", "预算司")
    rejected_correction = '{"opinion":"SECRET-REJECTED-FACT 300"}'
    responses = iter(
        (
            '{"opinion":"Recommend hiring two quantitative developers."}',
            rejected_correction,
        )
    )

    result = _invoke(
        session,
        lambda _messages: next(responses),
        node_id=node,
    )

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    snapshot = session.snapshot()
    assert snapshot.degradation_reasons == (f"model_synthesis_degraded:{node}",)
    assert snapshot.adopted_evidence_ids == ()
    assert "SECRET-REJECTED-FACT" not in result["opinion"]


def test_misnested_ready_envelope_gets_one_schema_correction() -> None:
    malformed_ready = json.dumps(
        {
            "status": "READY",
            "result": {
                "opinion": "建议先定义最小输入输出契约",
                "factual_claims": [
                    {
                        "claim": "建议先定义最小输入输出契约",
                        "basis": "NORMATIVE",
                        "evidence_ids": [],
                        "fact_key": None,
                        "category": None,
                        "subject": None,
                    }
                ],
                "adopted_evidence_ids": [],
                "fact_basis": "NOT_REQUIRED",
            },
        },
        ensure_ascii=False,
    )
    responses = iter(
        (
            malformed_ready,
            _ready(
                "建议先定义最小输入输出契约",
                factual_claims=[
                    {
                        "claim": "建议先定义最小输入输出契约",
                        "basis": "NORMATIVE",
                        "evidence_ids": [],
                    }
                ],
            ),
        )
    )
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    result = _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)

    assert result == {"opinion": "建议先定义最小输入输出契约"}
    assert len(model_calls) == 2
    correction = model_calls[1][-1]["content"]
    assert "top-level" in correction
    assert "adopted_evidence_ids" in correction
    assert "fact_basis" in correction


def test_bare_opinion_with_consumed_envelope_budget_degrades_locally() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    node = bureau_node_id("工部", "技术司")
    assert session.claim_envelope_correction(node) is True

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="工部",
        bureau="技术司",
        matter_type="MEMORIAL",
        decree_text="开发量化交易系统",
        messages=[{"role": "user", "content": "旨意：开发量化交易系统"}],
        chat_model=lambda _messages: '{"opinion":"开发团队已有完整交易系统经验"}',
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
        session=session,
    )

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{node}",
    )
    assert session.snapshot().adopted_evidence_ids == ()


def test_bare_opinion_then_investigation_can_correct_resumed_factual_dependency() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    bare_response = '{"opinion":"Recommend hiring two quantitative developers."}'
    rejected_resumed_ready = _ready("The target market size is 300.")
    responses = iter(
        (
            bare_response,
            _gap(node),
            rejected_resumed_ready,
            _ready(
                "Recommend defining the two roles and delivery milestones first.",
                factual_claims=[
                    {
                        "claim": (
                            "Recommend defining the two roles and delivery "
                            "milestones first."
                        ),
                        "basis": "NORMATIVE",
                        "evidence_ids": [],
                    }
                ],
            ),
        )
    )
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    result = _invoke(session, model, node_id=node)

    assert result == {
        "opinion": "Recommend defining the two roles and delivery milestones first."
    }
    assert len(model_calls) == 4
    resumed_correction = model_calls[3][-1]["content"]
    assert rejected_resumed_ready not in resumed_correction
    assert "READY" in resumed_correction
    assert "NEEDS_DATA" in resumed_correction
    assert "BEGIN_UNTRUSTED_EVIDENCE_PACK" not in resumed_correction
    assert len(coordinator.calls) == 1


def test_resumed_correction_invalid_envelope_degrades_without_adopting_output() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    rejected_ready = _ready("The target market size is 300.")
    rejected_correction = '{"opinion":"SECRET-REJECTED-FACT 300"}'
    responses = iter(
        (
            '{"opinion":"Recommend hiring two quantitative developers."}',
            _gap(node),
            rejected_ready,
            rejected_correction,
        )
    )

    result = _invoke(
        session,
        lambda _messages: next(responses),
        node_id=node,
    )

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    snapshot = session.snapshot()
    assert snapshot.degradation_reasons == (f"model_synthesis_degraded:{node}",)
    assert snapshot.adopted_evidence_ids == ()
    assert "SECRET-REJECTED-FACT" not in result["opinion"]


def test_resumed_correction_model_failure_does_not_degrade() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            '{"opinion":"Recommend hiring two quantitative developers."}',
            _gap(node),
            _ready("The target market size is 300."),
        )
    )
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        if model_calls == 4:
            raise RuntimeError("provider failure")
        return next(responses)

    with pytest.raises(EvidenceProtocolError, match="model_unavailable"):
        _invoke(session, model, node_id=node)

    assert model_calls == 4
    assert session.snapshot().degradation_reasons == ()


def test_unsupported_dependency_correction_is_once_per_session() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    calls_by_bureau: dict[str, int] = {}

    def invoke(department: str, bureau: str, *, correction_available: bool) -> None:
        node = bureau_node_id(department, bureau)

        def model(_messages: list[dict[str, str]]) -> str:
            calls_by_bureau[bureau] = calls_by_bureau.get(bureau, 0) + 1
            return _ready("比亚迪现价为 300 元")

        if correction_available:
            with pytest.raises(
                EvidenceProtocolError, match="unsupported_factual_dependency"
            ):
                invoke_bureau_with_evidence(
                    node_id=node,
                    department=department,
                    bureau=bureau,
                    matter_type="MEMORIAL",
                    decree_text="查看比亚迪股票价格",
                    messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
                    chat_model=model,
                    legacy_parser=_legacy_parser,
                    fallback=lambda reason: {"opinion": reason},
                    session=session,
                )
        else:
            result = invoke_bureau_with_evidence(
                node_id=node,
                department=department,
                bureau=bureau,
                matter_type="MEMORIAL",
                decree_text="查看比亚迪股票价格",
                messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
                chat_model=model,
                legacy_parser=_legacy_parser,
                fallback=lambda reason: {"opinion": reason},
                session=session,
            )
            assert result == {"opinion": "model_synthesis_invalid"}

    invoke("户部", "预算司", correction_available=True)
    invoke("户部", "投资司", correction_available=False)

    assert calls_by_bureau == {"预算司": 2, "投资司": 1}
    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{bureau_node_id('户部', '投资司')}",
    )


def test_unsupported_dependency_with_consumed_budget_degrades_locally() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    node = bureau_node_id("工部", "技术司")
    assert session.claim_protocol_correction() is True

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="工部",
        bureau="技术司",
        matter_type="MEMORIAL",
        decree_text="开发量化交易系统",
        messages=[{"role": "user", "content": "旨意：开发量化交易系统"}],
        chat_model=lambda _messages: _ready("当前开发团队已有完整交易系统经验"),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
        session=session,
    )

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{node}",
    )
    assert session.snapshot().adopted_evidence_ids == ()


def test_protocol_correction_claim_is_atomic() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())

    with ThreadPoolExecutor(max_workers=16) as executor:
        claims = list(executor.map(lambda _index: session.claim_protocol_correction(), range(64)))

    assert claims.count(True) == 1
    assert claims.count(False) == 63


def test_envelope_correction_budget_is_once_per_bureau_node() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    first = bureau_node_id("工部", "技术司")
    second = bureau_node_id("工部", "质量司")

    assert session.claim_envelope_correction(first) is True
    assert session.claim_envelope_correction(first) is False
    assert session.claim_envelope_correction(second) is True
    assert session.claim_envelope_correction(second) is False


def test_envelope_and_protocol_correction_claims_have_independent_atomic_budgets() -> None:
    session = AgentEvidenceSession(coordinator=Coordinator())
    first = bureau_node_id("工部", "技术司")
    second = bureau_node_id("工部", "质量司")

    with ThreadPoolExecutor(max_workers=16) as executor:
        envelope_claims = list(
            executor.map(
                lambda _index: session.claim_envelope_correction(first),
                range(64),
            )
        )
        protocol_claims = list(
            executor.map(lambda _index: session.claim_protocol_correction(), range(64))
        )

    assert envelope_claims.count(True) == 1
    assert envelope_claims.count(False) == 63
    assert session.claim_envelope_correction(second) is True
    assert session.claim_envelope_correction(second) is False
    assert protocol_claims.count(True) == 1
    assert protocol_claims.count(False) == 63


def test_unsupported_dependency_correction_skips_model_unavailable() -> None:
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        raise RuntimeError("provider failure")

    with pytest.raises(EvidenceProtocolError, match="model_unavailable"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)
    assert model_calls == 1


def test_unsupported_dependency_correction_skips_response_invalid() -> None:
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return "not json"

    with pytest.raises(EvidenceProtocolError, match="response_invalid"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)
    assert model_calls == 1


def test_unsupported_dependency_correction_skips_adoption_invalid() -> None:
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return _ready(
            "有证据的意见",
            adopted_evidence_ids=["not-frozen"],
        )

    with pytest.raises(EvidenceProtocolError, match="adoption_invalid"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)
    assert model_calls == 1


def test_unsupported_dependency_correction_skips_evidence_binding_invalid() -> None:
    node = bureau_node_id("户部", "预算司")
    request = DataGapRequest.model_validate(
        json.loads(_gap(node))["data_gap"]
        | {
            "request_id": "preloaded-request",
            "timeout_seconds": 30,
            "source_scope": ["SHIGUAN"],
        }
    )
    session = AgentEvidenceSession(coordinator=Coordinator())
    session.freeze_pack(_pack(request))
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return _ready(
            "比亚迪现价为 300 元",
            adopted_evidence_ids=["e-1"],
            fact_key="byd_current_quote",
            category="MARKET_QUOTE",
            subject="BYD",
        )

    with pytest.raises(EvidenceProtocolError, match="evidence_binding_invalid"):
        _invoke(session, model)
    assert model_calls == 1


def test_unsupported_dependency_correction_keeps_second_gap_fallback() -> None:
    node = bureau_node_id("户部", "预算司")
    responses = iter(
        (
            _ready("比亚迪现价为 300 元"),
            _quote_gap(node),
            _quote_gap(node),
        )
    )
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return next(responses)

    result = _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)

    assert result == {"opinion": "证据受限：second_data_gap"}
    assert model_calls == 3


def test_unsupported_dependency_correction_message_is_static_and_sanitized() -> None:
    rejected_ready_body = _ready(
        "比亚迪现价为 300 元；DeepSeek；sk-secret-marker"
    )
    responses = iter((rejected_ready_body, _ready("建议继续观察")))
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(AgentEvidenceSession(coordinator=Coordinator()), model)

    correction = model_calls[1][-1]["content"]
    assert rejected_ready_body not in correction
    assert "BEGIN_UNTRUSTED_EVIDENCE_PACK" not in correction
    assert "unsupported_factual_dependency" not in correction
    assert "sk-secret-marker" not in correction
    assert "DeepSeek" not in correction
    assert '"market_metric":"LAST_PRICE"' in correction
    assert "PRICE_TREND_30D" in correction
    assert "all other categories require JSON null" in correction


def test_normative_ready_is_not_misclassified_as_external_dependency() -> None:
    result = invoke_bureau_with_evidence(
        node_id=bureau_node_id("户部", "预算司"),
        department="户部",
        bureau="预算司",
        matter_type="MEMORIAL",
        decree_text="完善内部审批制度",
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
    rejected_ready = _ready(
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
    )
    responses = iter(
        (
            _gap(node),
            rejected_ready,
            rejected_ready,
        )
    )

    session = AgentEvidenceSession(coordinator=Coordinator())
    result = _invoke(session, lambda _messages: next(responses))

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    assert session.snapshot().adopted_evidence_ids == ()
    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{node}",
    )


def test_ready_allows_nonassertive_citation_attribution_before_bound_claim() -> None:
    node = bureau_node_id("户部", "投资司")
    price_claim = "比亚迪A股最新收盘价为91.89元人民币"
    opinion = f"根据腾讯自选股提供的MCP数据，{price_claim}"
    responses = iter(
        (
            _quote_gap(node),
            _ready(
                opinion,
                adopted_evidence_ids=["e-1"],
                factual_claims=[
                    {
                        "claim": "根据腾讯自选股提供的MCP数据",
                        "basis": "CITED",
                        "evidence_ids": ["e-1"],
                        "fact_key": "byd_current_quote",
                        "category": "MARKET_QUOTE",
                        "subject": "BYD",
                    },
                    {
                        "claim": price_claim,
                        "basis": "CITED",
                        "evidence_ids": ["e-1"],
                        "fact_key": "byd_current_quote",
                        "category": "MARKET_QUOTE",
                        "subject": "BYD",
                    }
                ],
            ),
        )
    )

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
        chat_model=lambda _messages: next(responses),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=AgentEvidenceSession(coordinator=Coordinator()),
    )

    assert result == {
        "opinion": f"根据腾讯自选股提供的MCP数据，{price_claim}"
    }


def test_ready_rejects_attribution_clause_that_asserts_an_extra_fact() -> None:
    node = bureau_node_id("户部", "投资司")
    price_claim = "比亚迪A股最新收盘价为91.89元人民币"
    rejected_ready = _ready(
        f"根据腾讯数据表明公司已经停牌，{price_claim}",
        adopted_evidence_ids=["e-1"],
        factual_claims=[
            {
                "claim": price_claim,
                "basis": "CITED",
                "evidence_ids": ["e-1"],
                "fact_key": "byd_current_quote",
                "category": "MARKET_QUOTE",
                "subject": "BYD",
            }
        ],
    )
    responses = iter(
        (
            _quote_gap(node),
            rejected_ready,
            rejected_ready,
        )
    )

    session = AgentEvidenceSession(coordinator=Coordinator())
    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
        chat_model=lambda _messages: next(responses),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert result == {"opinion": "model_synthesis_invalid"}
    assert session.snapshot().adopted_evidence_ids == ()
    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{node}",
    )


def test_ready_rejects_unrelated_citation_with_same_value_and_state() -> None:
    node = bureau_node_id("户部", "预算司")
    rejected_ready = _ready(
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
    )
    responses = iter(
        (
            _gap(node),
            rejected_ready,
            rejected_ready,
        )
    )

    session = AgentEvidenceSession(coordinator=Coordinator())
    result = _invoke(session, lambda _messages: next(responses))

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    assert session.snapshot().adopted_evidence_ids == ()
    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{node}",
    )


def test_user_provided_claim_must_be_traceable_to_original_prompt() -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "预算司"),
            department="户部",
            bureau="预算司",
            matter_type="MEMORIAL",
            decree_text="分析比亚迪",
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
    "opinion",
    [
        "必须在方案设计完成后进行技术评审",
        "不得在验收通过前发布",
        "不应以口头承诺替代书面验收依据",
        "严禁绕过质量门禁",
        "禁止在缺陷未关闭时进入下一阶段",
        "未经技术司评审不得进入详细设计阶段",
    ],
)
def test_ready_allows_explicit_normative_obligations(opinion: str) -> None:
    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(opinion),
    ) == {"opinion": opinion}


@pytest.mark.parametrize(
    "opinion",
    [
        "当前必须返工的项目有三个",
        "最新数据显示必须提高预算",
        "根据公告不得继续交易",
        "建议根据最新公告继续交易",
        "建议根据最新公告调整预算",
        "今日已完成全部质量验收",
    ],
)
def test_normative_words_cannot_hide_observed_facts(opinion: str) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(opinion),
        )


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
            decree_text=prompt,
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
            decree_text="比亚迪营收为300亿元吗？",
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
        decree_text="已知比亚迪营收为300亿元，请分析风险。",
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
            decree_text=prompt,
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
            decree_text="分析比亚迪",
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


def test_nonempty_ready_requires_exact_claim_for_every_clause() -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(
                "必须评审；不得绕过验收",
                factual_claims=[],
            ),
        )


def test_structured_normative_claims_allow_imperative_and_numbered_clauses() -> None:
    opinion = "1. 设置评审门槛；2. 未经验收不得发布"
    claims = [
        _normative_claim("1. 设置评审门槛"),
        _normative_claim("2. 未经验收不得发布"),
    ]

    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(opinion, factual_claims=claims),
    ) == {"opinion": opinion}


def test_structured_normative_claim_can_cover_multiple_contiguous_clauses() -> None:
    opinion = "必须完成技术评审；不得绕过质量验收"

    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(
            opinion,
            factual_claims=[_normative_claim(opinion)],
        ),
    ) == {"opinion": opinion}


@pytest.mark.parametrize(
    ("opinion", "claims"),
    [
        (
            "必须评审；不得绕过验收",
            [_normative_claim("必须评审")],
        ),
        (
            "必须评审",
            [_normative_claim("必须评审"), _normative_claim("不得绕过验收")],
        ),
        (
            "必须完成技术评审",
            [_normative_claim("必须完成评审")],
        ),
        (
            "必须评审",
            [_normative_claim("必须评审"), _normative_claim("必须评审")],
        ),
        (
            "必须评审；不得绕过验收",
            [_normative_claim("不得绕过验收；必须评审")],
        ),
        (
            "必须评审；不得绕过验收",
            [
                _normative_claim("必须评审"),
                _normative_claim("必须评审；不得绕过验收"),
            ],
        ),
    ],
)
def test_structured_normative_requires_exact_unique_clause_coverage(
    opinion: str,
    claims: list[dict[str, object]],
) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(opinion, factual_claims=claims),
        )


@pytest.mark.parametrize(
    "claim",
    [
        "必须对当前三个项目返工",
        "建议根据最新公告调整方案",
        "不得依据当前数据形成结论",
        "今日已完成全部验收",
    ],
)
def test_structured_normative_rejects_fact_disguise(claim: str) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(
                claim,
                factual_claims=[_normative_claim(claim)],
            ),
        )


@pytest.mark.parametrize(
    "claim",
    [
        "当前项目共三项",
        "目前待办事项共3项",
        "当前规则共三条",
        "目前供应商共3家",
        "当前候选人共三名",
        "目前重试共3次",
        "当前文件共三份",
        "目前设备共3台",
        "当前案件共三宗",
        "目前交易共3笔",
        "当前乘客共三人",
        "目前车辆共3辆",
        "当前设备共三套",
        "目前物料共3件",
        "当前住户共三户",
    ],
)
def test_structured_normative_rejects_current_quantified_observation(
    claim: str,
) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(
                claim,
                factual_claims=[_normative_claim(claim)],
            ),
        )


@pytest.mark.parametrize(
    "claim",
    [
        "当前项目共三项建议将目标设为3项",
        "今日已完成全部验收后建议将目标设为3项",
    ],
)
def test_structured_normative_proposal_cannot_hide_observation(
    claim: str,
) -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready(
                claim,
                factual_claims=[_normative_claim(claim)],
            ),
        )


@pytest.mark.parametrize(
    "claim",
    [
        "不得以口头承诺作为书面验收依据办理交付",
        "建议将测试覆盖率目标设为80%",
        "每个阶段设置书面准入条件",
        "建议设置三个评审阶段",
        "建议将目标设为3项",
        "建议将当前目标设为3项",
        "建议将目前阶段的验收目标设为3项",
        "建议将当前目标定为3项",
        "建议将目前目标改为3项",
        "建议将当前目标调整为3项",
        "验收必须依据事先书面确认的文档",
    ],
)
def test_structured_normative_accepts_pure_declaration_without_lead(
    claim: str,
) -> None:
    assert _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: _ready(
            claim,
            factual_claims=[_normative_claim(claim)],
        ),
    ) == {"opinion": claim}


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
                        "market_metric": "LAST_PRICE",
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


def test_price_only_decree_constrains_draft_to_one_mainland_last_price() -> None:
    coordinator = Coordinator(status=EvidencePackStatus.UNAVAILABLE)
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    gap = _market_gap(
        node,
        [
            _market_fact("BYD_STOCK_PRICE", "LAST_PRICE"),
            _market_fact("BYD_HK_PRICE", "LAST_PRICE", jurisdiction="HK"),
            _market_fact("BYD_PE", "PE_RATIO"),
            _market_fact("BYD_PB", "PB_RATIO"),
            _market_fact("BYD_MARKET_CAP", "MARKET_CAP"),
        ],
    )

    invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="帮我看看比亚迪的股票价格",
        messages=[{"role": "user", "content": "旨意：帮我看看比亚迪的股票价格"}],
        chat_model=lambda _messages: gap,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    request = coordinator.calls[0][0]
    assert [(fact.key, fact.market_metric) for fact in request.required_facts] == [
        ("BYD_STOCK_PRICE", MarketMetric.LAST_PRICE)
    ]


def test_natural_price_decree_discards_model_generated_optional_metrics() -> None:
    coordinator = Coordinator(status=EvidencePackStatus.UNAVAILABLE)
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    gap = _market_gap(
        node,
        [
            _market_fact("BYD_STOCK_PRICE", "LAST_PRICE"),
            _market_fact("BYD_PE", "PE_RATIO"),
            _market_fact("BYD_PB", "PB_RATIO"),
            _market_fact("BYD_MARKET_CAP", "MARKET_CAP"),
        ],
    )

    invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="比亚迪股票多少钱",
        messages=[{"role": "user", "content": "旨意：比亚迪股票多少钱"}],
        chat_model=lambda _messages: gap,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    request = coordinator.calls[0][0]
    assert [(fact.key, fact.market_metric) for fact in request.required_facts] == [
        ("BYD_STOCK_PRICE", MarketMetric.LAST_PRICE)
    ]


def test_price_and_volume_decree_keeps_both_explicit_metrics() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    gap = _market_gap(
        node,
        [
            _market_fact("BYD_STOCK_PRICE", "LAST_PRICE"),
            _market_fact("BYD_VOLUME", "VOLUME"),
            _market_fact("BYD_PE", "PE_RATIO"),
        ],
    )
    responses = iter((gap, _ready("建议等待")))

    invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查一下比亚迪股价和成交量",
        messages=[{"role": "user", "content": "旨意：查一下比亚迪股价和成交量"}],
        chat_model=lambda _messages: next(responses),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert [
        (fact.key, fact.market_metric)
        for fact in coordinator.calls[0][0].required_facts
    ] == [
        ("BYD_STOCK_PRICE", MarketMetric.LAST_PRICE),
        ("BYD_VOLUME", MarketMetric.VOLUME),
    ]


def test_market_scope_uses_only_explicit_original_decree_text() -> None:
    coordinator = Coordinator(status=EvidencePackStatus.UNAVAILABLE)
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    gap = _market_gap(
        node,
        [
            _market_fact("BYD_PRICE", "LAST_PRICE"),
            _market_fact("BYD_PE", "PE_RATIO"),
            _market_fact("BYD_PB", "PB_RATIO"),
            _market_fact("BYD_CAP", "MARKET_CAP"),
        ],
    )

    invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[
            {"role": "system", "content": "历史材料提到 PE ratio 和 market cap"},
            {
                "role": "user",
                "content": (
                    "旨意：查看比亚迪股票价格\n\n"
                    "部级路由判断：同时分析 PE、PB 和 market cap"
                ),
            },
            {"role": "user", "content": "纠正提示：补充 PB ratio"},
        ],
        chat_model=lambda _messages: gap,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert [
        (fact.key, fact.market_metric)
        for fact in coordinator.calls[0][0].required_facts
    ] == [("BYD_PRICE", MarketMetric.LAST_PRICE)]


def test_price_only_decree_fails_closed_for_ambiguous_mainland_facts() -> None:
    node = bureau_node_id("户部", "投资司")
    gap = _market_gap(
        node,
        [
            _market_fact("BYD_PRICE_ONE", "LAST_PRICE"),
            _market_fact("BYD_PRICE_TWO", "LAST_PRICE", jurisdiction=None),
        ],
    )

    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid"):
        invoke_bureau_with_evidence(
            node_id=node,
            department="户部",
            bureau="投资司",
            matter_type="MEMORIAL",
            decree_text="查看比亚迪股票价格",
            messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
            chat_model=lambda _messages: gap,
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


def test_price_gap_with_non_iso_jurisdictions_gets_one_static_correction() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    invalid_gap = _market_gap(
        node,
        [
            _market_fact(
                "BYD_CN_PRICE",
                "LAST_PRICE",
                jurisdiction="中国",
                subject="比亚迪",
            ),
            _market_fact(
                "BYD_HK_PRICE",
                "LAST_PRICE",
                jurisdiction="香港",
                subject="比亚迪",
            ),
        ],
    )
    responses = iter(
        (
            invalid_gap,
            _quote_gap(node),
            _ready(
                "有证据的行情意见",
                adopted_evidence_ids=["e-1"],
                fact_key="byd_current_quote",
                category="MARKET_QUOTE",
                subject="BYD",
            ),
        )
    )
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
        chat_model=model,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert result == {"opinion": "有证据的行情意见"}
    assert len(model_calls) == 3
    assert len(coordinator.calls) == 1
    assert coordinator.calls[0][0].required_facts[0].jurisdiction == "CN"
    correction = model_calls[1][-1]["content"]
    assert invalid_gap not in correction
    assert '"jurisdiction":"CN"' in correction
    assert "exactly one mainland LAST_PRICE fact" in correction


def test_price_gap_with_model_added_hk_scope_gets_one_static_correction() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    invalid_payload = json.loads(
        _market_gap(
            node,
            [
                _market_fact(
                    "BYD_PRICE",
                    "LAST_PRICE",
                    subject="比亚迪",
                )
            ],
        )
    )
    invalid_payload["data_gap"]["question"] = (
        "比亚迪（002594.SZ / 1211.HK）最新股票价格是多少？"
    )
    invalid_payload["data_gap"]["required_facts"][0]["description"] = (
        "比亚迪 A 股或 H 股最新交易价格"
    )
    invalid_gap = json.dumps(invalid_payload, ensure_ascii=False)
    responses = iter(
        (
            invalid_gap,
            _quote_gap(node),
            _ready(
                "有证据的行情意见",
                adopted_evidence_ids=["e-1"],
                fact_key="byd_current_quote",
                category="MARKET_QUOTE",
                subject="BYD",
            ),
        )
    )
    model_calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        return next(responses)

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
        chat_model=model,
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert result == {"opinion": "有证据的行情意见"}
    assert len(model_calls) == 3
    assert coordinator.calls[0][0].question == "比亚迪当前成交价是多少？"
    correction = model_calls[1][-1]["content"]
    assert invalid_gap not in correction
    assert "Do not mention Hong Kong" in correction


def test_price_gap_with_noncanonical_unit_and_shape_gets_one_correction() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    invalid_fact = _market_fact(
        "BYD_PRICE",
        "LAST_PRICE",
        subject="比亚迪",
    )
    invalid_fact["expected_unit"] = "人民币元"
    invalid_fact["expected_shape"] = "scalar"
    responses = iter(
        (
            _market_gap(node, [invalid_fact]),
            _quote_gap(node),
            _ready(
                "有证据的行情意见",
                adopted_evidence_ids=["e-1"],
                fact_key="byd_current_quote",
                category="MARKET_QUOTE",
                subject="BYD",
            ),
        )
    )

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查看比亚迪股票价格",
        messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
        chat_model=lambda _messages: next(responses),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": reason},
        session=session,
    )

    assert result == {"opinion": "有证据的行情意见"}
    fact = coordinator.calls[0][0].required_facts[0]
    assert fact.expected_unit == "CNY"
    assert fact.expected_shape == "number"


def test_explicit_hk_decree_does_not_get_mainland_gap_correction() -> None:
    node = bureau_node_id("户部", "投资司")
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return _market_gap(
            node,
            [
                _market_fact(
                    "BYD_HK_PRICE",
                    "LAST_PRICE",
                    jurisdiction="HK",
                    subject="比亚迪 1211.HK",
                )
            ],
        )

    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid"):
        invoke_bureau_with_evidence(
            node_id=node,
            department="户部",
            bureau="投资司",
            matter_type="MEMORIAL",
            decree_text="查询港股价格",
            messages=[{"role": "user", "content": "旨意：查询港股价格"}],
            chat_model=model,
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )

    assert model_calls == 1


def test_explicit_market_decree_fails_closed_without_allowed_fact() -> None:
    node = bureau_node_id("户部", "投资司")
    gap = _market_gap(node, [_market_fact("BYD_PE", "PE_RATIO")])

    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid"):
        invoke_bureau_with_evidence(
            node_id=node,
            department="户部",
            bureau="投资司",
            matter_type="MEMORIAL",
            decree_text="查看比亚迪股票价格",
            messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
            chat_model=lambda _messages: gap,
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


def test_market_scope_runs_after_market_fact_schema_validation() -> None:
    node = bureau_node_id("户部", "投资司")
    malformed = _market_fact("BYD_PRICE", "LAST_PRICE")
    malformed.pop("market_metric")

    with pytest.raises(EvidenceProtocolError, match="data_gap_invalid"):
        invoke_bureau_with_evidence(
            node_id=node,
            department="户部",
            bureau="投资司",
            matter_type="MEMORIAL",
            decree_text="查看比亚迪股票价格",
            messages=[{"role": "user", "content": "旨意：查看比亚迪股票价格"}],
            chat_model=lambda _messages: _market_gap(node, [malformed]),
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": reason},
            session=AgentEvidenceSession(coordinator=Coordinator()),
        )


def test_partial_market_evidence_remains_usable_on_resume() -> None:
    class PartialCoordinator:
        def __init__(self) -> None:
            self.calls: list[DataGapRequest] = []

        def investigate(
            self,
            request: DataGapRequest,
            *,
            department: str,
            matter_type: str,
            extraction_budget: object,
        ) -> EvidencePack:
            del department, matter_type, extraction_budget
            self.calls.append(request)
            price_key, volume_key = (fact.key for fact in request.required_facts)
            return EvidencePack(
                pack_id="partial-pack",
                investigation_id="partial-investigation",
                status=EvidencePackStatus.PARTIAL,
                request=request,
                investigation_plan=InvestigationPlan(
                    fact_keys=(price_key, volume_key),
                    source_scope=request.source_scope,
                ),
                evidence_by_fact={
                    price_key: (_evidence(fact_key=price_key),),
                    volume_key: (),
                },
                historical_evidence_by_fact={price_key: (), volume_key: ()},
                resolved_facts=(price_key,),
                unresolved_facts=(volume_key,),
                conflicts=(),
                source_attempts=(),
                investigation_started_at="2026-07-20T11:45:00Z",
                investigation_completed_at="2026-07-20T11:45:01Z",
                cache=CacheMetadata(hit=False),
                do_not_infer=(volume_key,),
            )

    coordinator = PartialCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "投资司")
    responses = iter(
        (
            _market_gap(
                node,
                [
                    _market_fact("BYD_PRICE", "LAST_PRICE"),
                    _market_fact("BYD_VOLUME", "VOLUME"),
                ],
            ),
            _ready(
                "比亚迪股价证据可用",
                adopted_evidence_ids=["e-1"],
                fact_key="BYD_PRICE",
                category="MARKET_QUOTE",
                subject="BYD",
            ),
        )
    )

    result = invoke_bureau_with_evidence(
        node_id=node,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="查询比亚迪股票价格和成交量",
        messages=[{"role": "user", "content": "旨意：查询比亚迪股票价格和成交量"}],
        chat_model=lambda _messages: next(responses),
        legacy_parser=_legacy_parser,
        fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
        session=session,
    )

    assert result == {"opinion": "比亚迪股价证据可用"}
    assert coordinator.calls


def test_policy_only_ready_response_declares_not_required_fact_basis() -> None:
    result = _invoke(
        AgentEvidenceSession(coordinator=Coordinator()),
        lambda _messages: json.dumps(
                {
                    "status": "READY",
                    "result": {
                        "opinion": "建议建立审核流程",
                        "factual_claims": [_normative_claim("建议建立审核流程")],
                    },
                "adopted_evidence_ids": [],
                "fact_basis": "NOT_REQUIRED",
            },
            ensure_ascii=False,
        ),
    )

    assert result == {"opinion": "建议建立审核流程"}


def test_cited_ready_response_requires_adopted_evidence() -> None:
    result = _invoke(
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

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}


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
                decree_text="旨意摘要",
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
        decree_text="旨意摘要",
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
        def __init__(self) -> None:
            super().__init__()
            self.read_keys: list[str] = []

        def __iter__(self):
            raise AssertionError("environment iterated")

        def items(self):
            raise AssertionError("environment iterated")

        def get(self, key: str, default=None):
            if key != LOCAL_CREDENTIAL_SOURCE_ENV:
                raise AssertionError(f"unexpected environment key read: {key}")
            self.read_keys.append(key)
            return default

    environment = NoAccessEnvironment()
    monkeypatch.setattr(
        "app.jinyiwei.mcp.runtime.os",
        SimpleNamespace(environ=environment),
    )

    session = build_default_evidence_session(
        lambda _messages: pytest.fail("model called"),
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    assert session.snapshot().used is False
    assert environment.read_keys == [LOCAL_CREDENTIAL_SOURCE_ENV]


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


class QuoteCoordinator:
    def __init__(
        self,
        *,
        status: EvidencePackStatus = EvidencePackStatus.RESOLVED,
    ) -> None:
        self.status = status
        self.requests: list[DataGapRequest] = []

    def investigate(
        self,
        request: DataGapRequest,
        *,
        department: str,
        matter_type: str,
        extraction_budget: object,
    ) -> EvidencePack:
        del department, matter_type, extraction_budget
        self.requests.append(request)
        fact_key = request.required_facts[0].key
        item = EvidenceItem(
            evidence_id="quote-evidence",
            fact_key=fact_key,
            value=88.5,
            unit="CNY",
            as_of="2026-07-24T10:00:00+08:00",
            retrieved_at="2026-07-24T10:00:02+08:00",
            source_url="https://provider.example.test/quote",
            publisher="行情提供方",
            source_type=SourceType.MCP,
            quality=EvidenceQuality.AUTHORITATIVE,
            stance=EvidenceStance.SUPPORTS,
            excerpt="任意公司最新价 88.5 CNY",
            content_hash=hashlib.sha256(b"quote-evidence").hexdigest(),
            confidence=0.9,
        )
        resolved = (
            (fact_key,)
            if self.status is EvidencePackStatus.RESOLVED
            else ()
        )
        unresolved = () if resolved else (fact_key,)
        return EvidencePack(
            pack_id="quote-pack",
            investigation_id="quote-investigation",
            status=self.status,
            request=request,
            investigation_plan=InvestigationPlan(
                fact_keys=(fact_key,),
                source_scope=request.source_scope,
            ),
            evidence_by_fact={fact_key: (item,) if resolved else ()},
            historical_evidence_by_fact={fact_key: ()},
            resolved_facts=resolved,
            unresolved_facts=unresolved,
            conflicts=(),
            source_attempts=(),
            investigation_started_at="2026-07-24T10:00:00+08:00",
            investigation_completed_at="2026-07-24T10:00:03+08:00",
            cache=CacheMetadata(hit=False),
            do_not_infer=unresolved,
        )


def _canonical_plan():
    return compile_mainland_last_price_plan(
        decree_text="帮我看看任意公司的股票价格",
        node_id=bureau_node_id("户部", "投资司"),
    )


def _valid_quote_ready() -> str:
    return _ready(
        "模型引用意见",
        adopted_evidence_ids=["quote-evidence"],
        fact_key="market_quote:last_price",
        category="MARKET_QUOTE",
        subject="任意公司",
    )


def _invoke_precompiled(
    session: AgentEvidenceSession,
    model: object,
    *,
    renderer=render_mainland_last_price,
    legacy_parser=_legacy_parser,
) -> dict[str, str]:
    return invoke_bureau_with_evidence(
        node_id=bureau_node_id("户部", "投资司"),
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="帮我看看任意公司的股票价格",
        messages=[{"role": "user", "content": "帮我看看任意公司的股票价格"}],
        chat_model=model,
        legacy_parser=legacy_parser,
        fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
        session=session,
        fact_plan=_canonical_plan(),
        evidence_renderer=renderer,
    )


def test_precompiled_plan_skips_model_generated_data_gap() -> None:
    coordinator = QuoteCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_quote_ready()

    result = _invoke_precompiled(session, model)

    assert len(calls) == 1
    assert coordinator.requests[0].required_facts == _canonical_plan().draft.required_facts
    assert coordinator.requests[0].source_scope == (
        SourceType.SHIGUAN,
        SourceType.MCP,
    )
    assert "88.5 CNY" in result["opinion"]
    assert "模型引用意见" not in result["opinion"]
    assert session.snapshot().degradation_reasons == (
        "model_synthesis_degraded:bureau:户部:投资司",
    )


@pytest.mark.parametrize(
    "response",
    [
        RuntimeError("private model failure"),
        "not json",
        _ready(
            "无效引用",
            adopted_evidence_ids=["unknown-evidence"],
            fact_key="market_quote:last_price",
            category="MARKET_QUOTE",
            subject="任意公司",
        ),
        _quote_gap(bureau_node_id("户部", "投资司")),
    ],
)
def test_precompiled_expression_failure_uses_verified_renderer_once(response: object) -> None:
    coordinator = QuoteCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal calls
        calls += 1
        if isinstance(response, Exception):
            raise response
        assert isinstance(response, str)
        return response

    result = _invoke_precompiled(session, model)

    expected = (
        "任意公司最新可得价格为 88.5 CNY"
        "（行情时间：2026-07-24T10:00:00+08:00；来源：行情提供方）。\n"
        "该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，"
        "也不构成投资建议。"
    )
    assert result == {"opinion": expected}
    assert calls == 1
    assert len(coordinator.requests) == 1
    snapshot = session.snapshot()
    assert snapshot.investigation_count == 1
    assert snapshot.bureau_selections == (
        (bureau_node_id("户部", "投资司"), ("quote-evidence",)),
    )
    assert snapshot.degradation_reasons == (
        f"model_synthesis_degraded:{bureau_node_id('户部', '投资司')}",
    )


def test_precompiled_valid_but_altered_price_uses_authoritative_renderer() -> None:
    coordinator = QuoteCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    altered = _ready(
        "任意公司最新可得价格为 999 CNY",
        adopted_evidence_ids=["quote-evidence"],
        fact_key="market_quote:last_price",
        category="MARKET_QUOTE",
        subject="任意公司",
    )

    result = _invoke_precompiled(session, lambda _messages: altered)

    assert result == {
        "opinion": (
            "任意公司最新可得价格为 88.5 CNY"
            "（行情时间：2026-07-24T10:00:00+08:00；来源：行情提供方）。\n"
            "该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，"
            "也不构成投资建议。"
        )
    }
    snapshot = session.snapshot()
    assert snapshot.investigation_count == 1
    assert snapshot.adopted_evidence_ids == ("quote-evidence",)
    assert snapshot.degradation_reasons == (
        "model_synthesis_degraded:bureau:户部:投资司",
    )


def test_precompiled_investigation_failure_never_runs_renderer() -> None:
    coordinator = QuoteCoordinator(status=EvidencePackStatus.UNAVAILABLE)
    session = AgentEvidenceSession(coordinator=coordinator)
    renderer_calls = 0

    def renderer(_pack: EvidencePack):
        nonlocal renderer_calls
        renderer_calls += 1
        raise AssertionError("renderer must not run")

    result = _invoke_precompiled(
        session,
        lambda _messages: pytest.fail("model must not run"),
        renderer=renderer,
    )

    assert result == {"opinion": "证据受限：evidence_unavailable"}
    assert renderer_calls == 0
    assert len(coordinator.requests) == 1


def test_precompiled_partial_pack_fails_before_expression_or_adoption() -> None:
    coordinator = QuoteCoordinator(status=EvidencePackStatus.PARTIAL)
    session = AgentEvidenceSession(coordinator=coordinator)
    model_calls = 0
    renderer_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return _valid_quote_ready()

    def renderer(_pack: EvidencePack):
        nonlocal renderer_calls
        renderer_calls += 1
        return render_mainland_last_price(_pack)

    result = _invoke_precompiled(session, model, renderer=renderer)

    assert result == {"opinion": "证据受限：evidence_unavailable"}
    assert model_calls == 0
    assert renderer_calls == 0
    assert len(coordinator.requests) == 1
    snapshot = session.snapshot()
    assert snapshot.bureau_selections == ()
    assert snapshot.adopted_evidence_ids == ()
    assert snapshot.degradation_reasons == ()


@pytest.mark.parametrize(
    "source_scope",
    [
        (SourceType.MCP, SourceType.SHIGUAN),
        (SourceType.MCP,),
        (SourceType.SHIGUAN, SourceType.MCP, SourceType.PUBLIC_API),
    ],
)
def test_precompiled_plan_requires_exact_locked_source_scope(
    source_scope: tuple[SourceType, ...],
) -> None:
    coordinator = QuoteCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    model_calls = 0

    def model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return _valid_quote_ready()

    with pytest.raises(EvidenceProtocolError, match="^data_plan_invalid$"):
        invoke_bureau_with_evidence(
            node_id=bureau_node_id("户部", "投资司"),
            department="户部",
            bureau="投资司",
            matter_type="MEMORIAL",
            decree_text="帮我看看任意公司的股票价格",
            messages=[{"role": "user", "content": "帮我看看任意公司的股票价格"}],
            chat_model=model,
            legacy_parser=_legacy_parser,
            fallback=lambda reason: {"opinion": f"证据受限：{reason}"},
            session=session,
            fact_plan=replace(_canonical_plan(), source_scope=source_scope),
            evidence_renderer=render_mainland_last_price,
        )

    assert model_calls == 0
    assert coordinator.requests == []


def test_degradation_reason_is_recorded_once_in_invocation_order() -> None:
    session = AgentEvidenceSession(coordinator=QuoteCoordinator())
    first = bureau_node_id("户部", "投资司")
    second = bureau_node_id("户部", "预算司")

    session.record_degradation(first)
    session.record_degradation(first)
    session.record_degradation(second)

    assert session.snapshot().degradation_reasons == (
        f"model_synthesis_degraded:{first}",
        f"model_synthesis_degraded:{second}",
    )


def test_renderer_records_selection_before_returning_through_legacy_parser() -> None:
    session = AgentEvidenceSession(coordinator=QuoteCoordinator())
    node_id = bureau_node_id("户部", "投资司")

    def parser(value: object) -> dict[str, str]:
        snapshot = session.snapshot()
        assert snapshot.bureau_selections == ((node_id, ("quote-evidence",)),)
        assert snapshot.degradation_reasons == (
            f"model_synthesis_degraded:{node_id}",
        )
        return _legacy_parser(value)

    assert _invoke_precompiled(session, lambda _messages: "not json", legacy_parser=parser)


def test_has_adopted_fact_requires_selected_current_resolved_canonical_binding() -> None:
    session = AgentEvidenceSession(coordinator=QuoteCoordinator())
    _invoke_precompiled(session, lambda _messages: _valid_quote_ready())
    node_id = bureau_node_id("户部", "投资司")

    assert session.has_adopted_fact(
        node_id=node_id,
        fact_key="market_quote:last_price",
        category=FactCategory.MARKET_QUOTE,
        market_metric=MarketMetric.LAST_PRICE,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        evidence_renderer=render_mainland_last_price,
    )
    assert not session.has_adopted_fact(
        node_id=bureau_node_id("户部", "预算司"),
        fact_key="market_quote:last_price",
        category=FactCategory.MARKET_QUOTE,
        market_metric=MarketMetric.LAST_PRICE,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        evidence_renderer=render_mainland_last_price,
    )


def test_has_adopted_fact_rejects_unrelated_prefilled_adoption() -> None:
    session = AgentEvidenceSession(coordinator=QuoteCoordinator())
    session.record_selection(
        bureau_node_id("户部", "投资司"),
        ("unrelated-evidence",),
    )

    assert session.snapshot().adopted_evidence_ids == ("unrelated-evidence",)
    assert not session.has_adopted_fact(
        node_id=bureau_node_id("户部", "投资司"),
        fact_key="market_quote:last_price",
        category=FactCategory.MARKET_QUOTE,
        market_metric=MarketMetric.LAST_PRICE,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        evidence_renderer=render_mainland_last_price,
    )


@pytest.mark.parametrize(
    "item_update",
    (
        {"retrieved_at": "2026-07-24T08:00:00+08:00"},
        {"stance": EvidenceStance.CONTRADICTS},
        {"quality": EvidenceQuality.UNVERIFIED},
        {"source_type": SourceType.PUBLIC_API},
    ),
)
def test_has_adopted_fact_rejects_selected_ineligible_item_when_pack_resolved(
    item_update,
) -> None:
    plan = _canonical_plan()
    request = DataGapRequest(
        **plan.draft.model_dump(mode="python"),
        request_id="selected-ineligible",
        timeout_seconds=30,
        source_scope=plan.source_scope,
    )
    pack = QuoteCoordinator().investigate(
        request,
        department="户部",
        matter_type="MEMORIAL",
        extraction_budget=object(),
    )
    eligible = pack.evidence_by_fact["market_quote:last_price"][0]
    ineligible = eligible.model_copy(
        update={
            "evidence_id": "selected-ineligible",
            **item_update,
        }
    )
    forged = pack.model_copy(
        update={
            "evidence_by_fact": {
                "market_quote:last_price": (eligible, ineligible)
            }
        }
    )
    session = AgentEvidenceSession(coordinator=QuoteCoordinator())
    session.freeze_pack(forged)
    session.record_selection(
        bureau_node_id("户部", "投资司"),
        ("selected-ineligible",),
    )

    assert render_mainland_last_price(forged).evidence_ids == ("quote-evidence",)
    assert not session.has_adopted_fact(
        node_id=bureau_node_id("户部", "投资司"),
        fact_key="market_quote:last_price",
        category=FactCategory.MARKET_QUOTE,
        market_metric=MarketMetric.LAST_PRICE,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        evidence_renderer=render_mainland_last_price,
    )
