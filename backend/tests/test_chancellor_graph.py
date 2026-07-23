"""Offline tests for the layered Chancellor memorial graph."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
import yaml
from langgraph.graph.state import CompiledStateGraph

from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor.graph import (
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor.prompts import (
    CHANCELLOR_FINALIZATION_SYSTEM_PROMPT,
    CHANCELLOR_SYSTEM_PROMPT,
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
    ministry_system_prompt,
)
from app.jinyiwei.coordinator import InvestigationCoordinator
from app.jinyiwei.extractor import StructuredEvidenceExtractor
from app.jinyiwei.mcp.client import McpToolResult
from app.jinyiwei.mcp.mapping import DeterministicMcpMapper
from app.jinyiwei.mcp.registry import McpRegistry
from app.jinyiwei.models import SourceAttempt, SourceAttemptStatus, SourceType
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
                    "factual_claims": [],
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


def test_build_chancellor_graph_with_injected_model_returns_compiled_graph():
    graph = build_chancellor_graph(chat_model=lambda _messages: _single_route_response("户部"))
    assert isinstance(graph, CompiledStateGraph)


def test_chancellor_prompts_cover_routing_finalization_and_shared_constraint():
    for department in MINISTRIES:
        assert department in CHANCELLOR_SYSTEM_PROMPT
    assert ministry_routing_guide() in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_SYSTEM_PROMPT
    assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "恰好三项" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "summary" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "recommendations" in CHANCELLOR_FINALIZATION_SYSTEM_PROMPT


def test_single_route_runs_ministry_then_common_finalizer_without_junjichu():
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _single_route_response("户部"),
            *_ministry_turns("户部", "预算司意见", "户部补充意见"),
            _final_response("丞相最终总结"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke(
        {"decree_text": "评估年度预算与融资安排"}
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
    assert len(captured_messages) == 5
    assert captured_messages[0][0]["content"] == CHANCELLOR_SYSTEM_PROMPT
    assert captured_messages[1][0]["content"] == ministry_system_prompt("户部")
    assert captured_messages[4][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    final_evidence = captured_messages[4][1]["content"]
    assert "评估年度预算与融资安排" in final_evidence
    assert "此事只涉及一部，交其办理" in final_evidence
    assert "预算司意见" in final_evidence
    assert "户部补充意见" in final_evidence
    assert '"council_verdict": null' in final_evidence
    assert not any(
        message[0]["content"].startswith("你是军机处") for message in captured_messages
    )


def test_single_route_works_for_every_ministry():
    for department in MINISTRIES:
        responses = [
            _single_route_response(department),
            *_ministry_turns(department, "司级意见", "部级补充"),
            _final_response(f"{department}最终总结"),
        ]
        result = build_chancellor_graph(
            chat_model=_sequenced_chat_model(responses)
        ).invoke({"decree_text": "旨意"})
        assert result["departments"] == [department]
        assert result["final_verdict"] == f"{department}最终总结"
        assert result["processing_path"][-1] == "丞相（最终汇总）"


@pytest.mark.parametrize(
    "response",
    [
        "",
        "not json",
        '{"route_type":"unknown","rationale":"说明","departments":["户部"]}',
        '{"route_type":"single","rationale":"说明","departments":["未知部"]}',
        '{"route_type":"multi","rationale":"说明","departments":["户部","户部"]}',
        '{"route_type":"single","rationale":"说明","departments":["户部","工部"]}',
        '{"route_type":"multi","rationale":"说明","departments":["户部"]}',
        '{"route_type":"single","rationale":" ","departments":["户部"]}',
    ],
)
def test_invalid_route_responses_fail_closed(response):
    graph = build_chancellor_graph(chat_model=lambda _messages: response)
    with pytest.raises(ChancellorGraphInvocationError):
        graph.invoke({"decree_text": "旨意"})


def test_multi_route_runs_all_layered_ministries_then_council_then_finalizer():
    departments = ["礼部", "刑部"]
    captured_messages: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _multi_route_response(departments),
            *_ministry_turns("礼部", "品牌司意见", "礼部补充意见"),
            *_ministry_turns("刑部", "合同司意见", "刑部补充意见"),
            '{"verdict":"军机处会审结论"}',
            _final_response("丞相会审后总结"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        captured_messages.append(messages)
        return next(responses)

    result = build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "联合旨意"})

    assert len(captured_messages) == 9
    assert captured_messages[1][0]["content"] == ministry_system_prompt("礼部")
    assert captured_messages[4][0]["content"] == ministry_system_prompt("刑部")
    council_evidence = captured_messages[7][1]["content"]
    assert "品牌司意见" in council_evidence
    assert "礼部补充意见" in council_evidence
    assert "合同司意见" in council_evidence
    assert "刑部补充意见" in council_evidence
    assert captured_messages[8][0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
    assert "军机处会审结论" in captured_messages[8][1]["content"]
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


def test_multi_route_all_six_ministries_remains_serial_and_feasible():
    departments = list(MINISTRIES)
    responses = [_multi_route_response(departments)]
    for department in departments:
        responses.extend(_ministry_turns(department, f"{department}司见", f"{department}部见"))
    responses.extend(['{"verdict":"六部会审"}', _final_response("六部最终总结")])
    result = build_chancellor_graph(chat_model=_sequenced_chat_model(responses)).invoke(
        {"decree_text": "六部旨意"}
    )
    assert result["departments"] == departments
    assert [item["department"] for item in result["ministry_opinions"]] == departments
    assert result["council_verdict"] == "六部会审"
    assert result["final_verdict"] == "六部最终总结"


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
def test_invalid_chancellor_final_response_fails_closed(final_response):
    graph = build_chancellor_graph(
        chat_model=_sequenced_chat_model(
            [
                _single_route_response("户部"),
                *_ministry_turns("户部", "司见", "部见"),
                final_response,
            ]
        )
    )
    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        graph.invoke({"decree_text": "旨意"})
    assert "司见" not in str(exc_info.value)
    assert exc_info.value.__cause__ is not None


def test_multi_council_invalid_schema_stops_before_chancellor_finalizer():
    calls = {"value": 0}
    responses = iter(
        [
            _multi_route_response(["户部", "工部"]),
            *_ministry_turns("户部", "户司", "户部"),
            *_ministry_turns("工部", "工司", "工部"),
            '{"verdict":"会审","extra":true}',
        ]
    )

    def _chat_model(_messages: list[dict[str, str]]) -> str:
        calls["value"] += 1
        return next(responses)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "旨意"})
    assert isinstance(exc_info.value.__cause__, ValueError)
    assert calls["value"] == 8


def test_ministry_failure_is_wrapped_and_short_circuits():
    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_SYSTEM_PROMPT:
            return _single_route_response("兵部")
        raise RuntimeError("simulated ministry failure")

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "旨意"})
    assert isinstance(exc_info.value.__cause__, MinistryAgentInvocationError)
    assert isinstance(exc_info.value.__cause__.__cause__, RuntimeError)


def test_finalizer_failure_is_sanitized_and_preserves_cause():
    marker = "sk-finalizer-must-not-leak-24680"
    responses = iter(
        [
            _single_route_response("户部"),
            *_ministry_turns("户部", "司见", "部见"),
        ]
    )

    def _chat_model(messages: list[dict[str, str]]) -> str:
        if messages[0]["content"] == CHANCELLOR_FINALIZATION_SYSTEM_PROMPT:
            raise RuntimeError(f"SDK failure key={marker}")
        return next(responses)

    with pytest.raises(ChancellorGraphInvocationError) as exc_info:
        build_chancellor_graph(chat_model=_chat_model).invoke({"decree_text": "旨意"})
    assert marker in str(exc_info.value.__cause__)
    assert marker not in str(exc_info.value)


def test_same_graph_has_no_state_leak_across_invocations():
    responses = [
        _single_route_response("户部"),
        *_ministry_turns("户部", "司见一", "部见一"),
        _final_response("总结一"),
        _single_route_response("礼部"),
        *_ministry_turns("礼部", "司见二", "部见二"),
        _final_response("总结二"),
    ]
    graph = build_chancellor_graph(chat_model=_sequenced_chat_model(responses))
    first = graph.invoke({"decree_text": "旨意一"})
    second = graph.invoke({"decree_text": "旨意二"})
    assert first["departments"] == ["户部"]
    assert first["final_verdict"] == "总结一"
    assert second["departments"] == ["礼部"]
    assert second["final_verdict"] == "总结二"
    assert first["ministry_opinions"] != second["ministry_opinions"]


def test_missing_api_key_fails_fast_before_graph_is_returned(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with pytest.raises(DeepSeekApiKeyError):
        build_chancellor_graph()


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
    ):
        assert recall_context is not None
        passed_to_ministry.append(evidence_session)
        return _expected_ministry(department, "bureau opinion", "ministry opinion")

    monkeypatch.setattr("app.agents.chancellor.graph.invoke_ministry_agent", fake_ministry)
    captured: list[list[dict[str, str]]] = []
    responses = iter(
        [
            _single_route_response(department),
            _final_response("first"),
            _single_route_response(department),
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

    first = graph.invoke({"decree_text": "first decree"})
    second = graph.invoke({"decree_text": "second decree"})

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
    ):
        assert recall_contexts is not None
        council_sessions.append(evidence_session)
        return opinions, "council verdict"

    monkeypatch.setattr("app.agents.chancellor.graph.run_junjichu_council", fake_council)
    model = _sequenced_chat_model(
        [_multi_route_response(departments), _final_response("final")]
    )

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=factory,
    ).invoke({"decree_text": "multi decree"})

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
            _single_route_response(department),
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
    ).invoke({"decree_text": "decree"})

    assert result["adopted_evidence_ids"] == (
        "evidence-2",
        "evidence-1",
        "evidence-3",
    )
    assert ["NEEDS_DATA" in messages[0]["content"] for messages in captured] == [
        False,
        False,
        True,
        True,
        False,
        False,
    ]
    assert "锦衣卫（调查）" not in result["processing_path"]


def test_real_graph_byd_gap_runs_jinyiwei_and_resumes_with_cited_quote(
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
            name = (
                "westock_search_byd.json"
                if approval.tool_name == "data_search"
                else "westock_quote_byd.json"
            )
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
    department = "户部"
    bureau = bureau_profiles_for(department)[0].bureau
    node_id = bureau_node_id(department, bureau)
    captured: list[list[dict[str, str]]] = []
    emitted_statuses: list[str] = []
    call_index = 0

    def model(messages: list[dict[str, str]]) -> str:
        nonlocal call_index
        captured.append(messages)
        index = call_index
        call_index += 1
        if index == 0:
            return _single_route_response(department)
        if index == 1:
            return _bureau_route_response(department)
        if index == 2:
            emitted_statuses.append("NEEDS_DATA")
            return json.dumps(
                {
                    "status": "NEEDS_DATA",
                    "data_gap": {
                        "requesting_agent": node_id,
                        "question": "看看比亚迪股票价格",
                        "required_facts": [
                            {
                                "key": "current_quote",
                                "description": "比亚迪股票当前价格",
                                "category": "MARKET_QUOTE",
                                "data_scope": "EXTERNAL_PUBLIC",
                                "subject": "比亚迪",
                                "jurisdiction": "CN",
                                "expected_unit": "CNY",
                                "expected_shape": "number",
                            }
                        ],
                        "decision_context": "回答用户当前行情查询",
                        "freshness": {"max_age_seconds": 60},
                        "existing_evidence_ids": [],
                    },
                },
                ensure_ascii=False,
            )
        if index == 3:
            evidence_id = session.snapshot().available_evidence_ids[0]
            emitted_statuses.append("READY:CITED")
            return json.dumps(
                {
                    "status": "READY",
                    "result": {
                        "opinion": "比亚迪当前价格为321.5元",
                        "factual_claims": [
                            {
                                "claim": "比亚迪当前价格为321.5元",
                                "basis": "CITED",
                                "evidence_ids": [evidence_id],
                                "fact_key": "current_quote",
                                "category": "MARKET_QUOTE",
                                "subject": "比亚迪",
                            }
                        ],
                    },
                    "adopted_evidence_ids": [evidence_id],
                    "fact_basis": "CITED",
                },
                ensure_ascii=False,
            )
        if index == 4:
            return json.dumps({"opinion": "户部依据已核行情答复"}, ensure_ascii=False)
        return _final_response("丞相汇总已核验的比亚迪行情")

    result = build_chancellor_graph(
        chat_model=model,
        evidence_session_factory=lambda: session,
    ).invoke({"decree_text": "看看比亚迪股票价格"})

    snapshot = session.snapshot()
    assert emitted_statuses == ["NEEDS_DATA", "READY:CITED"]
    assert client.calls == [
        ("data_search", {"query": "比亚迪"}),
        ("data_quote", {"code": "sz002594"}),
    ]
    assert snapshot.investigation_count == 1
    assert snapshot.packs[0].status.value == "RESOLVED"
    assert snapshot.packs[0].evidence_by_fact["current_quote"][0].source_type is SourceType.MCP
    assert result["adopted_evidence_ids"] == snapshot.available_evidence_ids
    assert result["processing_path"].count("锦衣卫（调查）") == 1
    resumed_prompt = "\n".join(message["content"] for message in captured[3])
    assert "BEGIN_UNTRUSTED_EVIDENCE_PACK" in resumed_prompt
    assert "END_UNTRUSTED_EVIDENCE_PACK" in resumed_prompt
