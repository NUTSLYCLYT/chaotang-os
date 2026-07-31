"""Offline tests for the layered Chancellor memorial graph."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
import yaml
from langgraph.graph.state import CompiledStateGraph

from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor.graph import (
    ChancellorGraphInvocationError,
    _deterministic_route,
    build_chancellor_graph,
)
from app.agents.chancellor.prompts import (
    CHANCELLOR_FINALIZATION_SYSTEM_PROMPT,
    CHANCELLOR_SYSTEM_PROMPT,
)
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)
from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    AgentEvidenceSnapshot,
    bureau_node_id,
)
from app.agents.ministries.agent import MinistryAgentInvocationError
from app.agents.ministries.prompts import (
    MINISTRIES,
    NO_IRREVERSIBLE_ACTION_CONSTRAINT,
    ministry_routing_guide,
    ministry_synthesis_system_prompt,
    ministry_system_prompt,
)
from app.jinyiwei.coordinator import InvestigationCoordinator
from app.jinyiwei.extractor import StructuredEvidenceExtractor
from app.jinyiwei.freshness import is_evidence_fresh
from app.jinyiwei.mcp.client import McpToolResult
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper
from app.jinyiwei.mcp.registry import McpRegistry
from app.jinyiwei.models import (
    CacheMetadata,
    DataGapRequest,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    FactCategory,
    InvestigationPlan,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.sources.base import SourceQuery, SourceResult
from app.jinyiwei.sources.mcp import McpSource
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError


def _single_route_response(department: str) -> str:
    return json.dumps(
        {
            "route_type": "single",
            "rationale": "此事只涉及一部，交其办理",
            "departments": [department],
        },
        ensure_ascii=False,
    )


def _multi_route_response(departments: list[str]) -> str:
    return json.dumps(
        {
            "route_type": "multi",
            "rationale": "此事涉及多部门，需军机处会审",
            "departments": departments,
        },
        ensure_ascii=False,
    )


def _bureau_route_response(department: str) -> str:
    bureau = bureau_profiles_for(department)[0].bureau
    return json.dumps(
        {"rationale": "交由本司办理", "bureaus": [bureau]}, ensure_ascii=False
    )


def _ministry_turns(department: str, bureau_opinion: str, ministry_opinion: str) -> list[str]:
    return [
        _bureau_route_response(department),
        json.dumps(
            {
                "status": "READY",
                "result": {
                    "opinion": f"建议{bureau_opinion}",
                    "factual_claims": [
                        {
                            "claim": f"建议{bureau_opinion}",
                            "basis": "NORMATIVE",
                            "evidence_ids": [],
                            "fact_key": None,
                            "category": None,
                            "subject": None,
                        }
                    ],
                },
                "adopted_evidence_ids": [],
                "fact_basis": "NOT_REQUIRED",
            },
            ensure_ascii=False,
        ),
        json.dumps({"opinion": ministry_opinion}, ensure_ascii=False),
    ]


def _final_response(summary: str = "丞相总结") -> str:
    return json.dumps(
        {"summary": summary, "recommendations": ["建议一", "建议二", "建议三"]},
        ensure_ascii=False,
    )


def _sequenced_chat_model(responses: list[str]):
    call_index = {"value": 0}

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        index = call_index["value"]
        call_index["value"] += 1
        return responses[index]

    return _chat_model


def _expected_ministry(department: str, bureau_opinion: str, opinion: str) -> dict:
    return {
        "department": department,
        "bureau_opinions": [
            {
                "bureau": bureau_profiles_for(department)[0].bureau,
                "opinion": f"建议{bureau_opinion}",
            }
        ],
        "opinion": opinion,
    }


def _approved_input(
    decree_text: str,
    *departments: str,
    required_bureaus: dict[str, tuple[str, ...]] | None = None,
) -> dict[str, object]:
    required = required_bureaus or {
        department: (bureau_profiles_for(department)[0].bureau,)
        for department in departments
    }
    return {
        "decree_text": decree_text,
        "approved_route": ApprovedRouteSnapshot(
            departments=tuple(
                ApprovedDepartmentRoute(
                    department=department,
                    required_bureaus=required[department],
                )
                for department in departments
            )
        ),
    }


def test_build_chancellor_graph_with_injected_model_returns_compiled_graph():
    graph = build_chancellor_graph(chat_model=lambda _messages: _single_route_response("户部"))
    assert isinstance(graph, CompiledStateGraph)


def test_approved_single_route_bypasses_route_model_and_forwards_required_bureaus(
    monkeypatch,
):
    calls = []

    def fake_ministry(department, *_args, **kwargs):
        calls.append((department, kwargs["required_bureaus"]))
        return _expected_ministry("户部", "会计司议", "户部意见")

    monkeypatch.setattr(
        "app.agents.chancellor.graph.invoke_ministry_agent", fake_ministry
    )

    def model(messages):
        assert messages[0]["content"] != CHANCELLOR_SYSTEM_PROMPT
        return _final_response()

    approved_route = ApprovedRouteSnapshot(
        departments=(
            ApprovedDepartmentRoute(
                department="户部", required_bureaus=("会计司",)
            ),
        )
    )
    result = build_chancellor_graph(chat_model=model).invoke(
        {"decree_text": "生成财务报表", "approved_route": approved_route}
    )

    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert result["required_bureaus_by_department"] == {"户部": ("会计司",)}
    assert calls == [("户部", ("会计司",))]


def test_chancellor_prompts_cover_routing_finalization_and_shared_constraint():
    for department in MINISTRIES:
        assert department in CHANCELLOR_SYSTEM_PROMPT
    assert ministry_routing_guide() in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "恰好三项" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "summary" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "recommendations" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT


def test_market_quote_decree_overrides_valid_but_wrong_model_route(
    monkeypatch,
) -> None:
    def fake_ministry(
        department,
        _decree,
        _rationale,
        _model,
        *,
        recall_context=None,
        evidence_session=None,
        required_bureaus=None,
    ):
        assert required_bureaus
        assert department == "户部"
        assert recall_context is not None
        assert evidence_session is not None
        return _expected_ministry("户部", "行情司议", "户部行情意见")

    monkeypatch.setattr(
        "app.agents.chancellor.graph.invoke_ministry_agent", fake_ministry
    )
    def model(messages):
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            raise AssertionError("supported market route must bypass Chancellor routing")
        return _final_response("行情回奏")

    result = build_chancellor_graph(
        chat_model=model
    ).invoke(
        _approved_input(
            "帮我看看比亚迪的股票价格",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert "军机处（召集）" not in result["processing_path"]


def test_market_quote_capability_keeps_single_department_layered_flow(
    monkeypatch,
) -> None:
    def fake_ministry(
        department,
        _decree,
        _rationale,
        _model,
        *,
        recall_context=None,
        evidence_session=None,
        required_bureaus=None,
    ):
        assert required_bureaus
        assert department == "户部"
        assert recall_context is not None
        assert evidence_session is not None
        return _expected_ministry("户部", "行情司意见", "户部行情补充意见")

    monkeypatch.setattr(
        "app.agents.chancellor.graph.invoke_ministry_agent", fake_ministry
    )

    result = build_chancellor_graph(
        chat_model=lambda _messages: _final_response("行情回奏")
    ).invoke(
        _approved_input(
            "帮我看看比亚迪的股票价格",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    bureau = bureau_profiles_for("户部")[0].bureau
    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert result["ministry_opinions"] == [
        _expected_ministry("户部", "行情司意见", "户部行情补充意见")
    ]
    assert result["council_verdict"] is None
    assert result["final_verdict"] == "行情回奏"
    assert result["recommendations"] == ["建议一", "建议二", "建议三"]
    assert result["processing_path"] == [
        "上书房",
        "丞相（首次分流）",
        "户部",
        f"户部·{bureau}",
        "户部（部级补充）",
        "丞相（最终汇总）",
    ]
    forbidden_node_fragments = (
        "capability",
        "swarm",
        "worker",
        "task-run",
        "军机处",
        "junjichu",
    )
    assert not any(
        fragment in node.lower()
        for node in result["processing_path"]
        for fragment in forbidden_node_fragments
    )


def _quote_ready_response() -> str:
    opinion = "比亚迪最新可得价格为 300 CNY。"
    return json.dumps(
        {
            "status": "READY",
            "result": {
                "opinion": opinion,
                "factual_claims": [
                    {
                        "claim": opinion,
                        "basis": "CITED",
                        "evidence_ids": ["evidence-market-graph"],
                        "fact_key": "market_quote:last_price",
                        "category": "MARKET_QUOTE",
                        "subject": "比亚迪",
                    }
                ],
            },
            "adopted_evidence_ids": ["evidence-market-graph"],
            "fact_basis": "CITED",
        },
        ensure_ascii=False,
    )


def _authoritative_graph_quote() -> str:
    return (
        "比亚迪最新可得价格为 300 CNY"
        "（行情时间：2026-07-23T07:00:00Z；来源：管理员批准的行情来源）。\n"
        "该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，"
        "也不构成投资建议。"
    )


@pytest.mark.parametrize("failed_stage", ["bureau", "ministry", "finalizer"])
def test_supported_market_graph_degrades_each_model_layer_with_adopted_evidence(
    failed_stage,
) -> None:
    class FakeCoordinator:
        def __init__(self) -> None:
            self.requests: list[DataGapRequest] = []

        def investigate(self, request, **_kwargs):
            self.requests.append(request)
            return _resolved_market_pack(request)

    coordinator = FakeCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    authoritative = _authoritative_graph_quote()
    invalid_payloads = {
        "bureau": "{malformed-json",
        "ministry": '{"opinion":42}',
        "finalizer": json.dumps(
            {
                "final_verdict": "比亚迪最新可得价格为 300 CNY。",
                "recommendations": "not-a-list",
            },
            ensure_ascii=False,
        ),
    }

    def model(messages):
        system = messages[0]["content"]
        if system == CHANCELLOR_SYSTEM_PROMPT:
            raise AssertionError("supported market route must bypass Chancellor routing")
        if system == ministry_system_prompt("户部"):
            raise AssertionError("supported market route must bypass ministry routing")
        if system == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            if failed_stage == "finalizer":
                return invalid_payloads[failed_stage]
            return json.dumps(
                {
                    "summary": authoritative,
                    "recommendations": [
                        "请核对行情时间与交易时段后再使用该价格。",
                        "请结合自身风险承受能力独立判断。",
                        "本回奏仅提供行情信息，不构成投资建议。",
                    ],
                },
                ensure_ascii=False,
            )
        if system == ministry_synthesis_system_prompt("户部"):
            if failed_stage == "ministry":
                return invalid_payloads[failed_stage]
            return json.dumps({"opinion": authoritative}, ensure_ascii=False)
        if failed_stage == "bureau":
            return invalid_payloads[failed_stage]
        return _quote_ready_response()

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke(
        _approved_input(
            "帮我看看比亚迪的股票价格",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    snapshot = result["evidence_snapshot"]
    assert result["processing_path"] == [
        "上书房",
        "丞相（首次分流）",
        "户部",
        "户部·投资司",
        "锦衣卫（调查）",
        "户部（部级补充）",
        "丞相（最终汇总）",
    ]
    assert result["adopted_evidence_ids"] == ("evidence-market-graph",)
    assert snapshot.adopted_evidence_ids == ("evidence-market-graph",)
    assert snapshot.investigation_count == 1
    assert len(coordinator.requests) == 1
    assert result["processing_path"].count("锦衣卫（调查）") == 1
    assert "300" in result["final_verdict"]
    assert "CNY" in result["final_verdict"]
    assert len(result["recommendations"]) == 3
    assert len(set(result["recommendations"])) == 3
    expected_degradations = {
        "bureau": ("model_synthesis_degraded:bureau:户部:投资司",),
        "ministry": (
            "model_synthesis_degraded:bureau:户部:投资司",
            "model_synthesis_degraded:ministry:户部",
        ),
        "finalizer": (
            "model_synthesis_degraded:bureau:户部:投资司",
            "model_synthesis_degraded:chancellor:finalize",
        ),
    }[failed_stage]
    assert snapshot.degradation_reasons == expected_degradations
    if failed_stage == "finalizer":
        assert result["recommendations"] == [
            "请核对行情时间与交易时段后再使用该价格。",
            "请结合自身风险承受能力独立判断。",
            "本回奏仅提供行情信息，不构成投资建议。",
        ]


def test_supported_market_graph_unavailable_investigation_never_becomes_price_success():
    class UnavailableCoordinator:
        def investigate(self, request, **_kwargs):
            pack = _resolved_market_pack(request)
            return pack.model_copy(
                update={
                    "status": EvidencePackStatus.UNAVAILABLE,
                    "evidence_by_fact": {request.required_facts[0].key: ()},
                    "resolved_facts": (),
                    "unresolved_facts": (request.required_facts[0].key,),
                }
            )

    session = AgentEvidenceSession(coordinator=UnavailableCoordinator())

    def model(messages):
        system = messages[0]["content"]
        if system in {CHANCELLOR_SYSTEM_PROMPT, ministry_system_prompt("户部")}:
            raise AssertionError("supported market routes must remain static")
        if system == ministry_synthesis_system_prompt("户部"):
            return '{"opinion":"伪造价格 300 CNY"}'
        return _final_response("伪造价格 300 CNY")

    with pytest.raises(ChancellorGraphInvocationError):
        build_chancellor_graph(
            chat_model=model,
            evidence_session_factory=lambda: session,
        ).invoke(
            _approved_input(
                "帮我看看比亚迪的股票价格",
                "户部",
                required_bureaus={"户部": ("投资司",)},
            )
        )

    assert session.snapshot().adopted_evidence_ids == ()


def test_supported_market_graph_extracts_ambiguous_entity_before_one_investigation():
    events: list[str] = []

    class FakeCoordinator:
        def __init__(self) -> None:
            self.requests: list[DataGapRequest] = []

        def investigate(self, request, **_kwargs):
            events.append("investigation")
            self.requests.append(request)
            return _resolved_market_pack(request)

    coordinator = FakeCoordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    entity_calls = 0

    def model(messages):
        nonlocal entity_calls
        system = messages[0]["content"]
        if system in {CHANCELLOR_SYSTEM_PROMPT, ministry_system_prompt("户部")}:
            raise AssertionError("supported market routes must remain static")
        if "entity_type" in system:
            entity_calls += 1
            events.append("entity")
            if entity_calls == 1:
                return "invalid-private-output"
            assert "invalid-private-output" not in str(messages)
            return '{"entity_type":"name","value":"比亚迪"}'
        if system == ministry_synthesis_system_prompt("户部"):
            return '{"opinion":"比亚迪最新可得价格为 300 CNY。"}'
        if system == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            return _final_response("比亚迪最新可得价格为 300 CNY。")
        events.append("expression")
        raise RuntimeError("exercise deterministic renderer")

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke(
        _approved_input(
            "关于比亚迪这只证券，现价是多少",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    assert entity_calls == 2
    assert len(coordinator.requests) == 1
    assert events == ["entity", "entity", "investigation", "expression"]
    assert result["adopted_evidence_ids"] == ("evidence-market-graph",)


def test_finalizer_fallback_rejects_unrelated_prefilled_adoption(monkeypatch):
    session = AgentEvidenceSession(
        coordinator=lambda *_args, **_kwargs: pytest.fail("investigation must not run")
    )
    session.record_selection(
        bureau_node_id("户部", "投资司"),
        ("unrelated-evidence",),
    )

    monkeypatch.setattr(
        "app.agents.chancellor.graph.invoke_ministry_agent",
        lambda *_args, **_kwargs: {
            "department": "户部",
            "bureau_opinions": [
                {"bureau": "投资司", "opinion": "伪造价格 300 CNY"}
            ],
            "opinion": "伪造价格 300 CNY",
        },
    )

    def model(messages):
        if messages[0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            raise RuntimeError("finalizer unavailable")
        raise AssertionError("supported route must bypass other model calls")

    with pytest.raises(ChancellorGraphInvocationError):
        build_chancellor_graph(
            chat_model=model,
            evidence_session_factory=lambda: session,
        ).invoke(
            _approved_input(
                "帮我看看比亚迪的股票价格",
                "户部",
                required_bureaus={"户部": ("投资司",)},
            )
        )


def test_canonical_finalizer_rejects_valid_but_altered_source_and_recommendations():
    class FakeCoordinator:
        def investigate(self, request, **_kwargs):
            return _resolved_market_pack(request)

    session = AgentEvidenceSession(coordinator=FakeCoordinator())
    authoritative = _authoritative_graph_quote()

    def model(messages):
        system = messages[0]["content"]
        if system in {CHANCELLOR_SYSTEM_PROMPT, ministry_system_prompt("户部")}:
            raise AssertionError("supported market routes must remain static")
        if system == ministry_synthesis_system_prompt("户部"):
            return json.dumps({"opinion": authoritative}, ensure_ascii=False)
        if system == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            return json.dumps(
                {
                    "summary": (
                        "比亚迪最新可得价格为 999 CNY"
                        "（行情时间：2099-01-01；来源：伪造来源）。"
                    ),
                    "recommendations": ["立即买入", "保证收益", "无需核验"],
                },
                ensure_ascii=False,
            )
        return _quote_ready_response()

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke(
        _approved_input(
            "帮我看看比亚迪的股票价格",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    assert result["final_verdict"] == authoritative
    assert result["recommendations"] == [
        "请核对行情时间与交易时段后再使用该价格。",
        "请结合自身风险承受能力独立判断。",
        "本回奏仅提供行情信息，不构成投资建议。",
    ]
    assert result["evidence_snapshot"].investigation_count == 1
    assert "model_synthesis_degraded:chancellor:finalize" in (
        result["evidence_snapshot"].degradation_reasons
    )


def test_non_market_route_remains_multi_and_keeps_selected_departments(
    monkeypatch,
) -> None:
    departments = ["吏部", "工部"]
    opinions = [
        _expected_ministry(department, f"{department}司议", f"{department}意见")
        for department in departments
    ]

    def fake_council(
        _decree,
        _rationale,
        selected_departments,
        _model,
        *,
        recall_contexts=None,
        evidence_session=None,
        required_bureaus_by_department=None,
    ):
        assert required_bureaus_by_department
        assert selected_departments == departments
        assert recall_contexts is not None
        assert evidence_session is not None
        return opinions, "军机处会审意见"

    monkeypatch.setattr(
        "app.agents.chancellor.graph.run_junjichu_council", fake_council
    )
    responses = iter(
        [
            _final_response("非行情回奏"),
        ]
    )

    result = build_chancellor_graph(
        chat_model=lambda _messages: next(responses)
    ).invoke(_approved_input("请协调官员任用与河道修缮", "吏部", "工部"))

    assert result["route_type"] == "multi"
    assert result["departments"] == departments
    assert "军机处（召集）" in result["processing_path"]


def test_single_route_runs_ministry_then_common_finalizer_without_junjichu():
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            *_ministry_turns("户部", "预算司意见", "户部补充意见"),
            _final_response("丞相最终总结"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke(
        _approved_input("评估年度预算与融资安排", "户部")
    )

    bureau = bureau_profiles_for("户部")[0].bureau
    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert result["ministry_opinions"] == [
        _expected_ministry("户部", "预算司意见", "户部补充意见")
    ]
    assert result["council_verdict"] is None
    assert result["final_verdict"] == "丞相最终总结"
    assert result["recommendations"] == ["建议一", "建议二", "建议三"]
    assert result["processing_path"] == [
        "上书房",
        "丞相（首次分流）",
        "户部",
        f"户部·{bureau}",
        "户部（部级补充）",
        "丞相（最终汇总）",
    ]
    assert len(captured_messages) == 4
    assert captured_messages[0][0]["content"] == ministry_system_prompt("户部")
    assert captured_messages[3][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    final_evidence = captured_messages[3][1]["content"]
    assert "评估年度预算与融资安排" in final_evidence
    assert "依已批准拟旨路由办理" in final_evidence
    assert "预算司意见" in final_evidence
    assert "户部补充意见" in final_evidence
    assert '"council_verdict": null' in final_evidence
    assert not any(
        message[0]["content"].startswith("你是军机处") for message in captured_messages
    )


def test_single_route_works_for_every_ministry():
    for department in MINISTRIES:
        responses = [
            *_ministry_turns(department, "司级意见", "部级补充"),
            _final_response(f"{department}最终总结"),
        ]
        result = build_chancellor_graph(
            chat_model=_sequenced_chat_model(responses)
        ).invoke(_approved_input("旨意", department))
        assert result["departments"] == [department]
        assert result["final_verdict"] == f"{department}最终总结"
        assert result["processing_path"][-1] == "丞相（最终汇总）"


def test_multi_route_runs_all_layered_ministries_then_council_then_finalizer():
    departments = ["礼部", "刑部"]
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            *_ministry_turns("礼部", "品牌司意见", "礼部补充意见"),
            *_ministry_turns("刑部", "合同司意见", "刑部补充意见"),
            '{"verdict":"军机处会审结论"}',
            _final_response("丞相会审后总结"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke(
        _approved_input("联合旨意", *departments)
    )

    assert len(captured_messages) == 8
    assert captured_messages[0][0]["content"] == ministry_system_prompt("礼部")
    assert captured_messages[3][0]["content"] == ministry_system_prompt("刑部")
    council_evidence = captured_messages[6][1]["content"]
    assert "品牌司意见" in council_evidence
    assert "礼部补充意见" in council_evidence
    assert "合同司意见" in council_evidence
    assert "刑部补充意见" in council_evidence
    assert captured_messages[7][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "军机处会审结论" in captured_messages[7][1]["content"]
    assert result["council_verdict"] == "军机处会审结论"
    assert result["final_verdict"] == "丞相会审后总结"
    assert result["recommendations"] == ["建议一", "建议二", "建议三"]
    expected_path = ["上书房", "丞相（首次分流）", "军机处（召集）"]
    for department in departments:
        bureau = bureau_profiles_for(department)[0].bureau
        expected_path.extend(
            [department, f"{department}·{bureau}", f"{department}（部级补充）"]
        )
    expected_path.extend(["军机处（会审）", "丞相（最终汇总）"])
    assert result["processing_path"] == expected_path


def test_cross_department_capability_intention_keeps_existing_council_path_and_inputs():
    departments = ["工部", "兵部"]
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            *_ministry_turns("工部", "工部司议", "工部部议"),
            *_ministry_turns("兵部", "兵部司议", "兵部部议"),
            '{"verdict":"军机处会审结论"}',
            _final_response("跨部门能力回奏"),
        ]
    )

    def model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=model).invoke(
        _approved_input("为跨部门治河能力协调工部与兵部", *departments)
    )

    expected_path = ["上书房", "丞相（首次分流）", "军机处（召集）"]
    for department in departments:
        bureau = bureau_profiles_for(department)[0].bureau
        expected_path.extend(
            [department, f"{department}·{bureau}", f"{department}（部级补充）"]
        )
    expected_path.extend(["军机处（会审）", "丞相（最终汇总）"])

    assert result["processing_path"] == expected_path
    assert result["processing_path"].count("军机处（召集）") == 1
    assert result["processing_path"].count("军机处（会审）") == 1
    assert [node for node in result["processing_path"] if node.startswith("军机处")] == [
        "军机处（召集）",
        "军机处（会审）",
    ]
    assert [opinion["department"] for opinion in result["ministry_opinions"]] == departments
    assert all(
        set(opinion) == {"department", "bureau_opinions", "opinion"}
        for opinion in result["ministry_opinions"]
    )
    council_evidence = captured_messages[6][1]["content"]
    assert "工部司议" in council_evidence
    assert "工部部议" in council_evidence
    assert "兵部司议" in council_evidence
    assert "兵部部议" in council_evidence
    assert "capability" not in council_evidence.lower()
    assert "evidence" not in council_evidence.lower()
    assert captured_messages[7][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT


def test_cross_department_bureau_failure_stops_later_ministries_council_and_finalizer():
    model_calls: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _bureau_route_response("工部"),
        ]
    )

    def model(messages: list[dict[str, str]]) -> str:
        model_calls.append(messages)
        if len(model_calls) == 2:
            raise RuntimeError("simulated selected-bureau failure")
        return next(responses)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=model).invoke(
            _approved_input("跨部门能力旨意", "工部", "兵部")
        )

    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)
    assert len(model_calls) == 2
    assert not any(
        messages[0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
        for messages in model_calls
    )


def test_multi_route_all_six_ministries_remains_serial_and_feasible():
    departments = list(MINISTRIES)
    responses = []
    for department in departments:
        responses.extend(_ministry_turns(department, f"{department}司见", f"{department}部见"))
    responses.extend(['{"verdict":"六部会审"}', _final_response("六部最终总结")])
    result = build_chancellor_graph(chat_model=_sequenced_chat_model(responses)).invoke(
        _approved_input("六部旨意", *departments)
    )
    assert result["departments"] == departments
    assert [item["department"] for item in result["ministry_opinions"]] == departments
    assert result["council_verdict"] == "六部会审"
    assert result["final_verdict"] == "六部最终总结"


def test_deterministic_route_recognizes_recruiting_people_then_development():
    route_type, _rationale, departments = _deterministic_route(
        "我要招两个人做量化炒股，然后让他们去开发"
    )

    assert route_type == "multi"
    assert departments == ["吏部", "工部"]


@pytest.mark.parametrize(
    "decree_text",
    [
        "不要招两个人，只做开发",
        "暂不招两个人，只做开发",
        "无需招两个人，只做开发",
        "不用招两个人，只做开发",
    ],
)
def test_deterministic_route_ignores_negated_recruiting_people(decree_text):
    route_type, _rationale, departments = _deterministic_route(decree_text)

    assert route_type == "single"
    assert departments == ["工部"]


@pytest.mark.parametrize(
    "final_response",
    [
        None,
        True,
        "",
        "   ",
        "not json",
        "[]",
        "null",
        "{}",
        '{"summary":"总结"}',
        '{"recommendations":["一","二","三"]}',
        '{"summary":"总结","recommendations":["一","二","三"],"extra":1}',
        '{"summary":1,"recommendations":["一","二","三"]}',
        '{"summary":null,"recommendations":["一","二","三"]}',
        '{"summary":[],"recommendations":["一","二","三"]}',
        '{"summary":" ","recommendations":["一","二","三"]}',
        '{"summary":"总结","recommendations":null}',
        '{"summary":"总结","recommendations":["一","二"]}',
        '{"summary":"总结","recommendations":["一","二","三","四"]}',
        '{"summary":"总结","recommendations":["一"," ","三"]}',
        '{"summary":"总结","recommendations":["一",2,"三"]}',
        '{"summary":"总结","recommendations":["一",null,"三"]}',
        '{"summary":"总结","recommendations":["一"," 二 ","二"]}',
        '{"summary":"总结","recommendations":"一二三"}',
    ],
)
def test_invalid_chancellor_final_response_uses_safe_fallback(final_response):
    graph = build_chancellor_graph(
        chat_model=_sequenced_chat_model(
            [
                *_ministry_turns("户部", "司见", "部见"),
                final_response,
            ]
        )
    )
    result = graph.invoke(_approved_input("旨意", "户部"))
    assert result["final_verdict"]
    assert len(result["recommendations"]) == 3
    assert len(set(result["recommendations"])) == 3


def test_finalizer_schema_drift_returns_three_safe_recommendations():
    result = build_chancellor_graph(
        chat_model=_sequenced_chat_model(
            [
                *_ministry_turns("户部", "司见", "部见"),
                '{"summary":"SECRET-REJECTED","recommendations":[]}',
            ]
        )
    ).invoke(_approved_input("旨意", "户部"))

    assert result["final_verdict"]
    assert len(result["recommendations"]) == 3
    assert len(set(result["recommendations"])) == 3
    public_result = {
        "final_verdict": result["final_verdict"],
        "recommendations": result["recommendations"],
        "council_verdict": result.get("council_verdict"),
    }
    assert "SECRET-REJECTED" not in json.dumps(public_result, ensure_ascii=False)
    assert (
        "model_synthesis_degraded:chancellor:finalize"
        in result["evidence_snapshot"].degradation_reasons
    )


def test_multi_council_invalid_schema_falls_back_before_chancellor_finalizer():
    calls = {"value": 0}
    responses = iter(
        [
            *_ministry_turns("户部", "户司", "户部"),
            *_ministry_turns("工部", "工司", "工部"),
            '{"verdict":"会审","extra":true}',
            _final_response("最终总结"),
        ]
    )

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        calls["value"] += 1
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke(
        _approved_input("旨意", "户部", "工部")
    )
    assert result["council_verdict"]
    assert result["council_verdict"] != "会审"
    assert result["final_verdict"] == "最终总结"
    assert (
        "model_synthesis_degraded:junjichu:council"
        in result["evidence_snapshot"].degradation_reasons
    )
    assert calls["value"] == 8


def test_ministry_failure_is_wrapped_and_short_circuits():
    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _single_route_response("兵部")
        raise RuntimeError("simulated ministry failure")

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke(
            _approved_input("旨意", "兵部")
        )
    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)
    assert isinstance(exc_info.value.__cause__.__cause__, RuntimeError)


def test_untyped_ministry_exception_cannot_forge_graph_failure_stage(monkeypatch):
    class ForgedStageError(RuntimeError):
        failure_stage = "bureau"

    def raise_forged_stage(*_args, **_kwargs):
        raise ForgedStageError("sdk")

    monkeypatch.setattr(
        "app.agents.chancellor.graph.invoke_ministry_agent",
        raise_forged_stage,
    )

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(
            chat_model=lambda _messages: _single_route_response("兵部")
        ).invoke(_approved_input("旨意", "兵部"))

    assert exc_info.value.failure_stage == "ministry"


def test_finalizer_failure_is_sanitized_and_preserves_cause():
    marker = "sk-finalizer-must-not-leak-24680"
    responses = iter(
        [
            *_ministry_turns("户部", "司见", "部见"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            raise RuntimeError(f"SDK failure key={marker}")
        return next(responses)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke(
            _approved_input("旨意", "户部")
        )
    assert marker in str(exc_info.value.__cause__)
    assert marker not in str(exc_info.value)


def test_same_graph_has_no_state_leak_across_invocations():
    responses = [
        *_ministry_turns("户部", "司见一", "部见一"),
        _final_response("总结一"),
        *_ministry_turns("礼部", "司见二", "部见二"),
        _final_response("总结二"),
    ]
    graph = build_chancellor_graph(chat_model=_sequenced_chat_model(responses))
    first = graph.invoke(_approved_input("旨意一", "户部"))
    second = graph.invoke(_approved_input("旨意二", "礼部"))
    assert first["departments"] == ["户部"]
    assert first["final_verdict"] == "总结一"
    assert second["departments"] == ["礼部"]
    assert second["final_verdict"] == "总结二"
    assert first["ministry_opinions"] != second["ministry_opinions"]


def test_missing_api_key_fails_fast_before_graph_is_returned(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(DeepSeekApiKeyError):
        build_chancellor_graph()


def test_production_chancellor_graph_opts_in_to_json_output(monkeypatch):
    calls = []
    fake_config = object()
    monkeypatch.setattr(
        "app.agents.chancellor.graph.load_deepseek_provider_config",
        lambda: fake_config,
    )

    def fake_builder(config, dotenv_path, *, json_output=False):
        calls.append((config, dotenv_path, json_output))
        return lambda _messages: "{}"

    monkeypatch.setattr(
        "app.agents.chancellor.graph.build_deepseek_chat_model",
        fake_builder,
    )

    build_chancellor_graph(dotenv_path=Path("offline.env"))

    assert calls == [(fake_config, Path("offline.env"), True)]


class _RecordingEvidenceSession:
    def __init__(
        self,
        *,
        used: bool,
        adopted: tuple[str, ...] = (),
        investigating: tuple[str, ...] = (),
    ) -> None:
        self.used = used
        self.adopted = adopted
        self.investigating = investigating

    def snapshot(self) -> AgentEvidenceSnapshot:
        return AgentEvidenceSnapshot(
            packs=(),
            available_evidence_ids=self.adopted,
            bureau_selections=(),
            adopted_evidence_ids=self.adopted,
            investigation_count=int(self.used),
            extractor_count=0,
            used=self.used,
            investigating_bureau_node_ids=self.investigating,
        )


class _AdoptingEvidenceSession(_RecordingEvidenceSession):
    def __init__(self, available: tuple[str, ...]) -> None:
        super().__init__(used=False)
        self.available = available
        self.selections: list[tuple[str, tuple[str, ...]]] = []

    def knows_all(self, evidence_ids) -> bool:
        return set(evidence_ids) <= set(self.available)

    def validates_claim_binding(self, _claim) -> bool:
        return True

    def record_selection(self, node_id, evidence_ids) -> None:
        self.selections.append((node_id, evidence_ids))
        ordered = list(self.adopted)
        for evidence_id in evidence_ids:
            if evidence_id not in ordered:
                ordered.append(evidence_id)
        self.adopted = tuple(ordered)

    def snapshot(self) -> AgentEvidenceSnapshot:
        return AgentEvidenceSnapshot(
            packs=(),
            available_evidence_ids=self.available,
            bureau_selections=tuple(self.selections),
            adopted_evidence_ids=self.adopted,
            investigation_count=0,
            extractor_count=0,
            used=False,
            investigating_bureau_node_ids=(),
        )


def test_graph_creates_one_fresh_session_per_invoke_and_only_marks_used_path(monkeypatch):
    created: list[_RecordingEvidenceSession] = []
    passed_to_ministry: list[object] = []
    department = MINISTRIES[0]
    bureau = bureau_profiles_for(department)[0].bureau

    def factory():
        session = _RecordingEvidenceSession(
            used=bool(created),
            adopted=("evidence-2", "evidence-1") if created else (),
            investigating=(bureau_node_id(department, bureau),) if created else (),
        )
        created.append(session)
        return session

    def fake_ministry(
        _department,
        _decree,
        _rationale,
        _model,
        *,
        recall_context=None,
        evidence_session=None,
        required_bureaus=None,
    ):
        assert required_bureaus
        assert recall_context is not None
        passed_to_ministry.append(evidence_session)
        return _expected_ministry(department, "bureau opinion", "ministry opinion")

    monkeypatch.setattr("app.agents.chancellor.graph.invoke_ministry_agent", fake_ministry)
    captured: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _final_response("first"),
            _final_response("second"),
        ]
    )

    def model(messages):
        captured.append(messages)
        return next(responses)

    graph = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=factory,
    )
    assert created == []

    first = graph.invoke(_approved_input("first decree", department))
    second = graph.invoke(_approved_input("second decree", department))

    assert len(created) == 2
    assert created[0] is not created[1]
    assert passed_to_ministry == created
    assert "锦衣卫（调查）" not in first["processing_path"]
    assert second["processing_path"].count("锦衣卫（调查）") == 1
    assert second["processing_path"].index("锦衣卫（调查）") == (
        second["processing_path"].index(f"{department}·{bureau}") + 1
    )
    assert second["processing_path"].index("锦衣卫（调查）") < second[
        "processing_path"
    ].index(f"{department}（部级补充）")
    assert first["adopted_evidence_ids"] == ()
    assert second["adopted_evidence_ids"] == ("evidence-2", "evidence-1")
    assert second["evidence_snapshot"] == created[1].snapshot()
    assert all("NEEDS_DATA" not in messages[0]["content"] for messages in captured)


def test_multi_graph_passes_same_session_to_council_without_upper_protocol(monkeypatch):
    factory_calls = {"value": 0}
    council_sessions: list[object] = []
    departments = [MINISTRIES[0], MINISTRIES[1]]
    investigated_bureau = bureau_profiles_for(departments[1])[0].bureau
    session = _RecordingEvidenceSession(
        used=True,
        investigating=(
            bureau_node_id(departments[1], investigated_bureau),
            bureau_node_id(
                departments[0], bureau_profiles_for(departments[0])[0].bureau
            ),
        ),
    )

    def factory():
        factory_calls["value"] += 1
        return session

    opinions = [
        _expected_ministry(department, f"{department} bureau", f"{department} ministry")
        for department in departments
    ]

    def fake_council(
        _decree,
        _rationale,
        _departments,
        _model,
        *,
        recall_contexts=None,
        evidence_session=None,
        required_bureaus_by_department=None,
    ):
        assert required_bureaus_by_department
        assert recall_contexts is not None
        council_sessions.append(evidence_session)
        return opinions, "council verdict"

    monkeypatch.setattr("app.agents.chancellor.graph.run_junjichu_council", fake_council)
    model = _sequenced_chat_model([_final_response("final")])

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=factory,
    ).invoke(_approved_input("multi decree", "吏部", "户部"))

    assert factory_calls["value"] == 1
    assert council_sessions == [session]
    assert result["council_verdict"] == "council verdict"
    assert result["evidence_snapshot"] == session.snapshot()
    marker_index = result["processing_path"].index("锦衣卫（调查）")
    assert result["processing_path"].count("锦衣卫（调查）") == 1
    assert marker_index == result["processing_path"].index(
        f"{departments[1]}·{investigated_bureau}"
    ) + 1
    assert marker_index < result["processing_path"].index(
        f"{departments[1]}（部级补充）"
    )
    assert marker_index < result["processing_path"].index("军机处（会审）")


def test_graph_returns_ordered_union_selected_by_real_bureau_adapter():
    department = MINISTRIES[0]
    bureaus = [profile.bureau for profile in bureau_profiles_for(department)[:2]]
    session = _AdoptingEvidenceSession(("evidence-1", "evidence-2", "evidence-3"))
    captured: list[list[dict[str, str]]] = []
    responses = iter(
        [
            json.dumps(
                {"rationale": "route to two bureaus", "bureaus": bureaus},
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "status": "READY",
                    "result": {
                        "opinion": "first bureau evidence",
                        "factual_claims": [
                            {
                                "claim": "first bureau evidence",
                                "basis": "CITED",
                                "evidence_ids": ["evidence-2", "evidence-1"],
                                "fact_key": "first",
                                "category": "ENTITY_REFERENCE",
                                "subject": "first",
                            }
                        ],
                    },
                    "adopted_evidence_ids": ["evidence-2", "evidence-1"],
                    "fact_basis": "CITED",
                }
            ),
            json.dumps(
                {
                    "status": "READY",
                    "result": {
                        "opinion": "second bureau evidence",
                        "factual_claims": [
                            {
                                "claim": "second bureau evidence",
                                "basis": "CITED",
                                "evidence_ids": ["evidence-1", "evidence-3"],
                                "fact_key": "second",
                                "category": "ENTITY_REFERENCE",
                                "subject": "second",
                            }
                        ],
                    },
                    "adopted_evidence_ids": ["evidence-1", "evidence-3"],
                    "fact_basis": "CITED",
                }
            ),
            '{"opinion":"ministry synthesis"}',
            _final_response("final"),
        ]
    )

    def model(messages):
        captured.append(messages)
        return next(responses)

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke(_approved_input("decree", "吏部"))

    assert result["adopted_evidence_ids"] == (
        "evidence-2",
        "evidence-1",
        "evidence-3",
    )
    assert ["NEEDS_DATA" in messages[0]["content"] for messages in captured] == [
        False,
        True,
        True,
        False,
        False,
    ]
    assert "锦衣卫（调查）" not in result["processing_path"]


def _resolved_market_pack(request: DataGapRequest) -> EvidencePack:
    fact_key = request.required_facts[0].key
    evidence = EvidenceItem(
        evidence_id="evidence-market-graph",
        fact_key=fact_key,
        value=300,
        unit="CNY",
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-24T03:00:00Z",
        source_url="https://market.example/quote",
        publisher="管理员批准的行情来源",
        source_type=SourceType.MCP,
        quality=EvidenceQuality.PRIMARY,
        stance=EvidenceStance.SUPPORTS,
        excerpt="最近市场观测价格为 300 CNY",
        content_hash=hashlib.sha256(b"market-graph-evidence").hexdigest(),
        confidence=0.95,
    )
    assert is_evidence_fresh(
        as_of=evidence.as_of,
        retrieved_at=evidence.retrieved_at,
        request=request,
        fact_key=fact_key,
        source_type=evidence.source_type,
        now=datetime(2026, 7, 24, 3, 0, tzinfo=UTC),
    )
    return EvidencePack(
        pack_id="pack-market-graph",
        investigation_id="investigation-market-graph",
        status=EvidencePackStatus.RESOLVED,
        request=request,
        investigation_plan=InvestigationPlan(
            fact_keys=(fact_key,),
            source_scope=request.source_scope,
        ),
        evidence_by_fact={fact_key: (evidence,)},
        historical_evidence_by_fact={fact_key: ()},
        resolved_facts=(fact_key,),
        unresolved_facts=(),
        conflicts=(),
        source_attempts=(),
        investigation_started_at="2026-07-24T02:59:59Z",
        investigation_completed_at="2026-07-24T03:00:00Z",
        cache=CacheMetadata(hit=False),
        do_not_infer=(),
    )


def test_market_quote_graph_uses_precompiled_plan_and_adopts_latest_available_evidence():
    class FakeCoordinator:
        def __init__(self) -> None:
            self.requests: list[DataGapRequest] = []

        def investigate(
            self,
            request: DataGapRequest,
            *,
            department: str,
            matter_type: str,
            extraction_budget: object,
        ):
            assert department == "户部"
            assert matter_type == "MEMORIAL"
            assert extraction_budget is session
            self.requests.append(request)
            return _resolved_market_pack(request)

    coordinator = FakeCoordinator()
    session = AgentEvidenceSession(
        coordinator=coordinator,
        id_factory=lambda: "request-market-graph",
    )
    calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        system = messages[0]["content"]
        if system == CHANCELLOR_SYSTEM_PROMPT:
            raise AssertionError("supported market route must be static")
        if system == ministry_system_prompt("户部"):
            raise AssertionError("supported ministry route must be static")
        if system == ministry_synthesis_system_prompt("户部"):
            return json.dumps({"opinion": "户部采纳行情证据"}, ensure_ascii=False)
        if system == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            return _final_response("丞相确认行情证据")
        return _quote_ready_response()

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke(
        _approved_input(
            "帮我看看比亚迪的股票价格",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    assert len(coordinator.requests) == 1
    assert coordinator.requests[0].required_facts[0].category is FactCategory.MARKET_QUOTE
    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert result["processing_path"] == [
        "上书房",
        "丞相（首次分流）",
        "户部",
        "户部·投资司",
        "锦衣卫（调查）",
        "户部（部级补充）",
        "丞相（最终汇总）",
    ]
    assert result["evidence_snapshot"].adopted_evidence_ids
    evidence = result["evidence_snapshot"].packs[0].evidence_by_fact[
        "market_quote:last_price"
    ][0]
    assert evidence.source_type is SourceType.MCP
    assert evidence.as_of < evidence.retrieved_at
    assert len(calls) == 3
    assert "NEEDS_DATA" not in calls[0][-1]["content"]
    assert "evidence-market-graph" in calls[0][-1]["content"]


def test_real_graph_byd_price_gap_runs_jinyiwei_and_resolves_fresh_quote(
    tmp_path: Path,
) -> None:
    backend = Path(__file__).parents[1]
    fixture_dir = Path(__file__).parent / "fixtures" / "mcp"
    config = yaml.safe_load(
        (backend / "config" / "jinyiwei_mcp.yaml").read_text(encoding="utf-8")
    )
    config["servers"][0]["enabled"] = True
    for tool in config["tools"]:
        tool["enabled"] = True
    registry = McpRegistry.from_mapping(config)

    def fixture(name: str):
        return json.loads((fixture_dir / name).read_text(encoding="utf-8"))

    class FixtureClient:
        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, object]]] = []

        def discover(self, server):
            tools = tuple(fixture("westock_tools_list.json")["result"]["tools"])
            registry.verify_discovery(server.server_id, tools)
            return tools

        def call(self, server, approval, arguments):
            normalized = dict(arguments)
            self.calls.append((approval.tool_name, normalized))
            name = {
                "data_search": "westock_search_byd.json",
                "data_quote": "westock_quote_byd.json",
                "data_minute": "westock_minute_byd.json",
            }[approval.tool_name]
            return McpToolResult(
                server.server_id,
                approval.tool_name,
                fixture(name)["result"],
            )

    class EmptyArchive:
        def fetch(self, query: SourceQuery) -> SourceResult:
            return SourceResult(
                documents=(),
                attempt=SourceAttempt(
                    source_type=SourceType.SHIGUAN,
                    source_name="fixture_archive",
                    status=SourceAttemptStatus.SKIPPED,
                    started_at="2026-07-23T02:00:30Z",
                    completed_at="2026-07-23T02:00:30Z",
                    error="source_unavailable",
                    facts_attempted=query.unresolved_fact_keys,
                ),
            )

    now = datetime(2026, 7, 23, 2, 0, 30, tzinfo=UTC)
    client = FixtureClient()
    coordinator = InvestigationCoordinator(
        shiguan=EmptyArchive(),
        mcp=McpSource(
            registry=registry,
            client=client,
            mapper=DeterministicMcpMapper(),
            now=lambda: now,
        ),
        public_api=EmptyArchive(),
        public_web=EmptyArchive(),
        extractor=StructuredEvidenceExtractor(
            model=lambda _prompt: pytest.fail("MCP extraction must be deterministic")
        ),
        clock=lambda: now,
        id_factory=iter(("investigation-graph-byd", "pack-graph-byd")).__next__,
        db_path=tmp_path / "jinyiwei.sqlite3",
    )
    session = AgentEvidenceSession(coordinator=coordinator)
    captured: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        captured.append(messages)
        system = messages[0]["content"]
        if system in {CHANCELLOR_SYSTEM_PROMPT, ministry_system_prompt("户部")}:
            raise AssertionError("supported market routes must be static")
        if system == ministry_synthesis_system_prompt("户部"):
            return json.dumps(
                {"opinion": "户部采纳行情证据"},
                ensure_ascii=False,
            )
        if system == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            return _final_response("丞相确认已取得满足时效要求的比亚迪行情")
        raise RuntimeError("exercise deterministic evidence renderer")

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke(
        _approved_input(
            "看看比亚迪股票价格",
            "户部",
            required_bureaus={"户部": ("投资司",)},
        )
    )

    snapshot = session.snapshot()
    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_quote", {"code": "sz002594"}),
    ]
    assert snapshot.investigation_count == 1
    assert snapshot.packs[0].status.value == "RESOLVED"
    assert len(snapshot.packs[0].evidence_by_fact["market_quote:last_price"]) == 1
    assert len(snapshot.available_evidence_ids) == 1
    assert result["adopted_evidence_ids"] == snapshot.available_evidence_ids
    assert result["processing_path"].count("锦衣卫（调查）") == 1
    synthesis_prompt = "\n".join(message["content"] for message in captured[1])
    assert "evidence_unavailable" not in synthesis_prompt
    assert "321.5" in synthesis_prompt
    assert "CNY" in synthesis_prompt
def test_graph_sanitizes_report_failure_stage(monkeypatch):
    marker = "private-ledger-path"

    def fail_ministry(*_args, **_kwargs):
        exc = MinistryAgentInvocationError(marker)
        exc.failure_stage = "report"
        raise exc

    monkeypatch.setattr(
        "app.agents.chancellor.graph.invoke_ministry_agent", fail_ministry
    )
    with pytest.raises(ChancellorGraphInvocationError) as caught:
        build_chancellor_graph(
            chat_model=lambda _messages: pytest.fail("model must not run"),
            report_session=object(),
        ).invoke(_approved_input("生成2020年至2025年财务报表", "户部"))
    assert caught.value.failure_stage == "report"
    assert marker not in str(caught.value)


def test_real_single_graph_report_session_preserves_model_call_sequence():
    decree = "请户部会计司生成2020年会计报表"

    def run(report_session=None):
        bureau_response = (
            json.dumps({"opinion": "建议会计司意见"}, ensure_ascii=False)
            if report_session is not None
            else _ministry_turns("户部", "会计司意见", "户部补充")[1]
        )
        responses = [
            json.dumps(
                {"rationale": "交会计司办理", "bureaus": ["会计司"]},
                ensure_ascii=False,
            ),
            bureau_response,
            json.dumps({"opinion": "户部补充"}, ensure_ascii=False),
            _final_response("单部门回奏"),
        ]
        captured = []
        response_iter = iter(responses)

        def model(messages):
            captured.append(messages)
            return next(response_iter)

        result = build_chancellor_graph(
            chat_model=model, report_session=report_session
        ).invoke(
            _approved_input(
                decree,
                "户部",
                required_bureaus={"户部": ("会计司",)},
            )
        )
        return result, captured

    baseline_result, baseline_calls = run()

    class SpySession:
        def __init__(self):
            self.calls = []

        def maybe_generate(self, *args):
            self.calls.append(args)
            return '{"period":{"start_year":2020,"end_year":2020}}'

    session = SpySession()
    result, report_calls = run(session)

    assert session.calls == [("户部", "会计司", decree)]
    assert result["departments"] == baseline_result["departments"] == ["户部"]
    assert len(report_calls) == len(baseline_calls) == 4
    assert "factual_claims" in baseline_calls[1][0]["content"]
    assert "factual_claims" not in report_calls[1][0]["content"]


def test_real_multi_graph_report_session_generates_once_and_preserves_order():
    decree = "请户部生成2020年会计报表并由工部协同技术审查"

    def run(report_session=None):
        hubu_bureau_response = (
            json.dumps({"opinion": "建议会计司意见"}, ensure_ascii=False)
            if report_session is not None
            else _ministry_turns("户部", "会计司意见", "户部补充")[1]
        )
        responses = [
            json.dumps(
                {"rationale": "交会计司办理", "bureaus": ["会计司"]},
                ensure_ascii=False,
            ),
            hubu_bureau_response,
            json.dumps({"opinion": "户部补充"}, ensure_ascii=False),
            json.dumps(
                {"rationale": "交技术司办理", "bureaus": ["技术司"]},
                ensure_ascii=False,
            ),
            *_ministry_turns("工部", "技术司意见", "工部补充")[1:],
            '{"verdict":"军机处会审意见"}',
            _final_response("多部门回奏"),
        ]
        captured = []
        response_iter = iter(responses)

        def model(messages):
            captured.append(messages)
            return next(response_iter)

        result = build_chancellor_graph(
            chat_model=model, report_session=report_session
        ).invoke(
            _approved_input(
                decree,
                "户部",
                "工部",
                required_bureaus={"户部": ("会计司",), "工部": ("技术司",)},
            )
        )
        return result, captured

    baseline_result, baseline_calls = run()

    class SpySession:
        def __init__(self):
            self.calls = []

        def maybe_generate(self, *args):
            self.calls.append(args)
            return '{"period":{"start_year":2020,"end_year":2020}}'

    session = SpySession()
    result, report_calls = run(session)

    assert session.calls == [("户部", "会计司", decree)]
    assert result["departments"] == baseline_result["departments"] == ["户部", "工部"]
    assert [item["department"] for item in result["ministry_opinions"]] == [
        "户部",
        "工部",
    ]
    assert len(report_calls) == len(baseline_calls) == 8
    assert "factual_claims" in baseline_calls[1][0]["content"]
    assert "factual_claims" not in report_calls[1][0]["content"]
