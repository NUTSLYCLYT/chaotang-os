"""LangGraph graph factory for the dedicated Chancellor (丞相) business agent.

This graph is independent of ``app.langgraph_runtime``: it does not modify or
reuse ``app.langgraph_runtime.graph``/``state.py``, and business code must not
call ``app.langgraph_runtime.deepseek_graph.build_deepseek_graph()`` directly
-- the Chancellor agent is its own dedicated, single-purpose graph with its
own explicit state type (:class:`ChancellorGraphState`) and its own
invocation-error type (:class:`ChancellorGraphInvocationError`).

It is, however, deliberately structurally symmetric with
``build_deepseek_graph`` and reuses (read-only, unmodified) the DeepSeek
configuration/client construction helpers
(:func:`app.langgraph_runtime.deepseek_config.load_deepseek_provider_config`,
:func:`app.langgraph_runtime.deepseek_client.build_deepseek_chat_model`) so
that this module never has to re-implement provider config parsing, API key
resolution, or ``openai.OpenAI`` client construction.

:func:`build_chancellor_graph` supports the same dependency-injection contract
as ``build_deepseek_graph``: callers may pass a fake ``chat_model`` for fully
offline tests. When no ``chat_model`` is supplied, the factory eagerly loads
configuration and validates/resolves the DeepSeek API key (raising a
``DeepSeekConfigError`` subclass immediately if that fails) and constructs the
real ``openai``-backed client *before* returning the compiled graph -- so a
missing/invalid configuration or API key fails fast at graph-build time,
before any outbound request could be attempted from ``.invoke()``.

Layered memorial topology
-------------------------
``START -> decide_route -> (single ministry | multi Grand Council) ->
finalize_chancellor -> END``.

``decide_route`` asks the Chancellor model to classify the decree as
``"single"`` (exactly one ministry) or ``"multi"`` (at least two ministries,
to be escalated to 军机处/junjichu), under the strict JSON contract described
in ``chancellor/prompts.py``. Every way that response can fail the contract
(invalid JSON, invalid ``route_type``, unknown/duplicate department, wrong
department count for the chosen route type, empty ``rationale``) fails
closed into the existing :class:`ChancellorGraphInvocationError` -- no new
exception type is introduced for these validation failures.

``handle_single_ministry`` calls the single department chosen by the Chancellor via
``app.agents.ministries.agent.invoke_ministry_agent`` (shared, stable
signature) and preserves its ordered bureau opinions and independent
ministry-level synthesis in ``ministry_opinions``.

``_route_condition`` returns ``state["route_type"]`` verbatim (i.e. either
``"single"`` or ``"multi"``); the ``"multi"`` branch is handled by the
``run_junjichu_council`` node, which is reached only when
``route_type == "multi"``. It calls
``app.agents.junjichu.agent.run_junjichu_council`` -- which, in a plain
Python ``for`` loop (never concurrently, never via a LangGraph ``Send``/
fan-out), invokes ``app.agents.ministries.agent.invoke_ministry_agent`` once
per department in ``state["departments"]`` order, then invokes 军机处's own
model turn for the council verdict -- and merges all layered results into
``processing_path``, ``ministry_opinions``, and ``council_verdict``.

Both branches then enter ``finalize_chancellor``. It sees the original decree,
routing rationale, every bureau/ministry layer and (for multi only) the council
verdict, and enforces exact ``summary`` plus three unique recommendations.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.chancellor.prompts import (
    CHANCELLOR_FINALIZATION_SYSTEM_PROMPT,
    CHANCELLOR_SYSTEM_PROMPT,
)
from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    AgentEvidenceSnapshot,
    build_default_evidence_session,
    bureau_node_id,
)
from app.agents.evidence_rendering import render_mainland_last_price
from app.agents.junjichu.agent import run_junjichu_council
from app.agents.market_intent import (
    is_mainland_last_price_intent,
    normalize_market_quote_route,
)
from app.agents.ministries.agent import MinistryOpinion, invoke_ministry_agent
from app.agents.ministries.prompts import MINISTRIES
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.jinyiwei.models import FactCategory, MarketMetric
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config
from app.shiguan.recall import RecallContext, safe_recall_context_for_department

_CANONICAL_MARKET_RECOMMENDATIONS = [
    "请核对行情时间与交易时段后再使用该价格。",
    "请结合自身风险承受能力独立判断。",
    "本回奏仅提供行情信息，不构成投资建议。",
]


class ChancellorGraphState(TypedDict, total=False):
    """State for the dedicated Chancellor (丞相) routing graph.

    Attributes:
        decree_text: The decree (旨意) text supplied by the caller. Required
            as part of the initial ``.invoke()`` input.
        chancellor_rationale: The Chancellor's non-empty routing judgement/
            explanation, written by ``decide_route``.
        route_type: ``"single"`` or ``"multi"``, written by ``decide_route``.
        departments: The department(s) the Chancellor selected -- exactly 1
            element for ``"single"``, at least 2 (no duplicates) for
            ``"multi"``. Every element is one of ``MINISTRIES``.
        processing_path: Ordered list of the stages this decree has passed
            through so far (e.g. ``["上书房", "丞相", "户部"]`` for a
            single-department decree). Started by ``decide_route`` as
            ``["上书房", "丞相"]`` and extended by the branch node(s).
        ministry_opinions: Each consulted department's structured result,
            containing ordered bureau opinions and a ministry-level synthesis.
        council_verdict: ``None`` for single routing, otherwise the Grand
            Council's non-empty review conclusion.
        recommendations: Exactly three stripped, non-empty, unique Chancellor
            recommendations.
        final_verdict: The Chancellor finalizer's non-empty ``summary``.
        recall_contexts: Optional old-case recall context by department. It is
            internal evidence for finalization, not part of the HTTP success
            response contract.

    There is intentionally no ``error`` field: model-call and validation
    failures propagate as exceptions (``ChancellorGraphInvocationError``)
    instead of being captured into state.
    """

    decree_text: str
    chancellor_rationale: str
    route_type: str
    departments: list[str]
    processing_path: list[str]
    ministry_opinions: list[MinistryOpinion]
    council_verdict: str | None
    recommendations: list[str]
    final_verdict: str
    recall_contexts: dict[str, object]
    evidence_session: AgentEvidenceSession
    evidence_snapshot: AgentEvidenceSnapshot
    adopted_evidence_ids: tuple[str, ...]


class ChancellorGraphInvocationError(Exception):
    """Raised by the graph's nodes when routing or ministry invocation fails.

    This is the single, existing exception type every failure-closed
    validation/invocation error in this graph maps to -- the Chancellor's
    routing JSON contract violations, and single-ministry invocation
    failures (wrapped from
    ``app.agents.ministries.agent.MinistryAgentInvocationError``) alike. No
    new exception type is introduced for any of these cases.

    The original exception (when applicable) is always available via
    ``__cause__``. This exception's own message never concatenates
    ``str(exc)`` from the original failure, nor echoes raw model output, so
    it cannot leak a secret or arbitrary model output that may appear in a
    third-party SDK error message or a malformed model response.
    """


def _has_canonical_last_price_evidence(session: AgentEvidenceSession) -> bool:
    return session.has_adopted_fact(
        node_id="bureau:户部:投资司",
        fact_key="market_quote:last_price",
        category=FactCategory.MARKET_QUOTE,
        market_metric=MarketMetric.LAST_PRICE,
        jurisdiction="CN",
        expected_unit="CNY",
        expected_shape="number",
        evidence_renderer=render_mainland_last_price,
    )


def build_chancellor_graph(
    chat_model: DeepSeekChatModel | None = None,
    dotenv_path: Path | None = None,
    *,
    evidence_session_factory: Callable[[], AgentEvidenceSession] | None = None,
) -> CompiledStateGraph:
    """Build and compile the layered Chancellor memorial graph.

    Args:
        chat_model: Optional fake/compatible chat model callable for offline
            tests. When supplied, this factory never touches environment
            variables, configuration files, or network clients -- only the
            injected callable is used (for both the Chancellor's own routing
            call and every ministry's call). When omitted, the real DeepSeek
            configuration and environment variable are loaded/validated and
            a real ``openai.OpenAI``-backed client is constructed here (via
            the read-only, reused ``load_deepseek_provider_config`` and
            ``build_deepseek_chat_model`` helpers), so any configuration or
            missing-key error is raised before this function returns (i.e.
            before ``.invoke()`` could ever be called).
        dotenv_path: Optional override path to a dotenv file, forwarded
            unchanged to :func:`build_deepseek_chat_model` and used only as
            a fallback when the process environment variable is unset/empty.
            Ignored when ``chat_model`` is supplied.

    Returns:
        A compiled, callable graph object
        (``.invoke({"decree_text": "..."})``).

    Raises:
        DeepSeekConfigError: (or a subclass, e.g. ``DeepSeekApiKeyError``)
            propagated from configuration loading/key resolution when
            ``chat_model`` is not supplied.
    """
    resolved_chat_model: DeepSeekChatModel
    if chat_model is not None:
        resolved_chat_model = chat_model
    else:
        config = load_deepseek_provider_config()
        resolved_chat_model = build_deepseek_chat_model(config, dotenv_path)

    def _decide_route(state: ChancellorGraphState) -> dict:
        try:
            evidence_session = (
                evidence_session_factory()
                if evidence_session_factory is not None
                else build_default_evidence_session(resolved_chat_model)
            )
        except Exception as exc:  # noqa: BLE001 - sanitized graph boundary
            raise ChancellorGraphInvocationError(
                "Chancellor graph failed to initialize its evidence session; "
                "see __cause__ for the original exception."
            ) from exc
        if is_mainland_last_price_intent(state["decree_text"]):
            return {
                "chancellor_rationale": "明确的中国大陆证券最新价查询，由户部办理。",
                "route_type": "single",
                "departments": ["户部"],
                "evidence_session": evidence_session,
                "processing_path": ["上书房", "丞相（首次分流）"],
            }
        messages = [
            {"role": "system", "content": CHANCELLOR_SYSTEM_PROMPT},
            {"role": "user", "content": state["decree_text"]},
        ]
        try:
            raw_response = resolved_chat_model(messages)
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model error
            raise ChancellorGraphInvocationError(
                "Chancellor graph node failed to obtain a model response; "
                "see __cause__ for the original exception."
            ) from exc

        if not isinstance(raw_response, str) or not raw_response.strip():
            raise ChancellorGraphInvocationError(
                "Chancellor graph node returned an empty model response."
            )

        try:
            parsed = parse_strict_json_object(raw_response)
        except StructuredOutputError as exc:
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response failed strict JSON parsing."
            ) from exc

        route_type = parsed.get("route_type")
        if route_type not in ("single", "multi"):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response has an invalid 'route_type'."
            )

        rationale = parsed.get("rationale")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response is missing a non-empty 'rationale'."
            )

        departments = parsed.get("departments")
        if not isinstance(departments, list) or not departments or not all(
            isinstance(department, str) for department in departments
        ):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response has an invalid 'departments' list."
            )
        if len(set(departments)) != len(departments):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response contains duplicate departments."
            )
        if not all(department in MINISTRIES for department in departments):
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response contains an unknown department."
            )
        if route_type == "single" and len(departments) != 1:
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response must select exactly 1 department "
                "for 'single' routing."
            )
        if route_type == "multi" and len(departments) < 2:
            raise ChancellorGraphInvocationError(
                "Chancellor graph node response must select at least 2 departments "
                "for 'multi' routing."
            )

        route_type, rationale, normalized_departments = normalize_market_quote_route(
            decree_text=state["decree_text"],
            route_type=route_type,
            rationale=rationale.strip(),
            departments=departments,
        )
        departments = list(normalized_departments)

        return {
            "chancellor_rationale": rationale,
            "route_type": route_type,
            "departments": departments,
            "evidence_session": evidence_session,
            "processing_path": ["上书房", "丞相（首次分流）"],
        }

    def _route_condition(state: ChancellorGraphState) -> str:
        return state["route_type"]

    def _handle_single_ministry(state: ChancellorGraphState) -> dict:
        department = state["departments"][0]
        recall_context = safe_recall_context_for_department(department)
        try:
            opinion = invoke_ministry_agent(
                department,
                state["decree_text"],
                state["chancellor_rationale"],
                resolved_chat_model,
                recall_context=recall_context,
                evidence_session=state["evidence_session"],
            )
        except Exception as exc:  # noqa: BLE001 - one sanitized graph error boundary
            raise ChancellorGraphInvocationError(
                f"Chancellor graph node failed to obtain a {department} ministry "
                "response; see __cause__ for the original exception."
            ) from exc

        snapshot = state["evidence_session"].snapshot()
        first_investigating_bureau = (
            snapshot.investigating_bureau_node_ids[0]
            if snapshot.investigating_bureau_node_ids
            else None
        )
        bureau_path: list[str] = []
        for bureau_opinion in opinion["bureau_opinions"]:
            bureau_path.append(f"{department}·{bureau_opinion['bureau']}")
            if (
                first_investigating_bureau
                == bureau_node_id(department, bureau_opinion["bureau"])
            ):
                bureau_path.append("锦衣卫（调查）")
        return {
            "processing_path": [
                *state["processing_path"],
                department,
                *bureau_path,
                f"{department}（部级补充）",
            ],
            "ministry_opinions": [opinion],
            "council_verdict": None,
            "recall_contexts": {department: recall_context.model_dump()},
            "evidence_snapshot": snapshot,
            "adopted_evidence_ids": snapshot.adopted_evidence_ids,
        }

    def _run_junjichu_council(state: ChancellorGraphState) -> dict:
        departments = state["departments"]
        recall_contexts: dict[str, RecallContext] = {
            department: safe_recall_context_for_department(department)
            for department in departments
        }
        try:
            ministry_opinions, verdict = run_junjichu_council(
                state["decree_text"],
                state["chancellor_rationale"],
                departments,
                resolved_chat_model,
                recall_contexts=recall_contexts,
                evidence_session=state["evidence_session"],
            )
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model/validation error
            raise ChancellorGraphInvocationError(
                "Chancellor graph node failed to complete the 军机处 multi-department "
                "council review; see __cause__ for the original exception."
            ) from exc

        snapshot = state["evidence_session"].snapshot()
        first_investigating_bureau = (
            snapshot.investigating_bureau_node_ids[0]
            if snapshot.investigating_bureau_node_ids
            else None
        )
        investigation_marked = False
        layered_path: list[str] = [*state["processing_path"], "军机处（召集）"]
        for ministry_opinion in ministry_opinions:
            department = ministry_opinion["department"]
            layered_path.append(department)
            for bureau_opinion in ministry_opinion["bureau_opinions"]:
                layered_path.append(f"{department}·{bureau_opinion['bureau']}")
                if (
                    not investigation_marked
                    and first_investigating_bureau
                    == bureau_node_id(department, bureau_opinion["bureau"])
                ):
                    layered_path.append("锦衣卫（调查）")
                    investigation_marked = True
            layered_path.append(f"{department}（部级补充）")
        layered_path.append("军机处（会审）")

        return {
            "processing_path": layered_path,
            "ministry_opinions": ministry_opinions,
            "council_verdict": verdict,
            "recall_contexts": {
                department: context.model_dump()
                for department, context in recall_contexts.items()
            },
            "evidence_snapshot": snapshot,
            "adopted_evidence_ids": snapshot.adopted_evidence_ids,
        }

    def _finalize_chancellor(state: ChancellorGraphState) -> dict:
        evidence = {
            "decree_text": state["decree_text"],
            "route_type": state["route_type"],
            "rationale": state["chancellor_rationale"],
            "ministry_opinions": state["ministry_opinions"],
            "council_verdict": state.get("council_verdict"),
            "recall_contexts": state.get("recall_contexts", {}),
        }
        messages = [
            {"role": "system", "content": CHANCELLOR_FINALIZATION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "请依据以下完整回奏证据作最终汇总。不得遗漏任何司级意见、部级补充意见，"
                    "也不得在多部门路径中遗漏军机处会审结论。\n"
                    f"{json.dumps(evidence, ensure_ascii=False)}"
                ),
            },
        ]
        try:
            raw_response = resolved_chat_model(messages)
            if not isinstance(raw_response, str) or not raw_response.strip():
                raise ValueError("The Chancellor finalizer returned no usable response.")
            parsed = parse_strict_json_object(raw_response)
            if set(parsed) != {"summary", "recommendations"}:
                raise ValueError("The Chancellor finalizer response has an invalid schema.")
            summary = parsed["summary"]
            raw_recommendations = parsed["recommendations"]
            if not isinstance(summary, str) or not summary.strip():
                raise ValueError("The Chancellor finalizer summary is invalid.")
            if (
                not isinstance(raw_recommendations, list)
                or len(raw_recommendations) != 3
                or any(
                    not isinstance(item, str) or not item.strip()
                    for item in raw_recommendations
                )
            ):
                raise ValueError("The Chancellor finalizer recommendations are invalid.")
            recommendations = [item.strip() for item in raw_recommendations]
            if len(set(recommendations)) != 3:
                raise ValueError("The Chancellor finalizer recommendations must be unique.")
            can_use_canonical = (
                state["route_type"] == "single"
                and state["departments"] == ["户部"]
                and is_mainland_last_price_intent(state["decree_text"])
                and bool(state["evidence_session"].snapshot().adopted_evidence_ids)
                and _has_canonical_last_price_evidence(state["evidence_session"])
                and len(state["ministry_opinions"]) == 1
            )
            if can_use_canonical:
                authoritative_summary = state["ministry_opinions"][0]["opinion"]
                if (
                    summary.strip() != authoritative_summary
                    or recommendations != _CANONICAL_MARKET_RECOMMENDATIONS
                ):
                    state["evidence_session"].record_degradation(
                        "chancellor:finalize"
                    )
                    snapshot = state["evidence_session"].snapshot()
                    return {
                        "processing_path": [
                            *state["processing_path"],
                            "丞相（最终汇总）",
                        ],
                        "final_verdict": authoritative_summary,
                        "recommendations": list(
                            _CANONICAL_MARKET_RECOMMENDATIONS
                        ),
                        "evidence_snapshot": snapshot,
                        "adopted_evidence_ids": snapshot.adopted_evidence_ids,
                    }
        except Exception as exc:  # noqa: BLE001 - one sanitized graph error boundary
            can_degrade = (
                state["route_type"] == "single"
                and state["departments"] == ["户部"]
                and is_mainland_last_price_intent(state["decree_text"])
                and bool(state["evidence_session"].snapshot().adopted_evidence_ids)
                and _has_canonical_last_price_evidence(state["evidence_session"])
                and len(state["ministry_opinions"]) == 1
            )
            if not can_degrade:
                raise ChancellorGraphInvocationError(
                    "Chancellor graph finalization failed; "
                    "see __cause__ for the original exception."
                ) from exc
            state["evidence_session"].record_degradation("chancellor:finalize")
            snapshot = state["evidence_session"].snapshot()
            return {
                "processing_path": [*state["processing_path"], "丞相（最终汇总）"],
                "final_verdict": state["ministry_opinions"][0]["opinion"],
                "recommendations": list(_CANONICAL_MARKET_RECOMMENDATIONS),
                "evidence_snapshot": snapshot,
                "adopted_evidence_ids": snapshot.adopted_evidence_ids,
            }

        return {
            "processing_path": [*state["processing_path"], "丞相（最终汇总）"],
            "final_verdict": summary.strip(),
            "recommendations": recommendations,
        }

    builder = StateGraph(ChancellorGraphState)
    builder.add_node("decide_route", _decide_route)
    builder.add_node("handle_single_ministry", _handle_single_ministry)
    builder.add_node("run_junjichu_council", _run_junjichu_council)
    builder.add_node("finalize_chancellor", _finalize_chancellor)
    builder.add_edge(START, "decide_route")
    builder.add_conditional_edges(
        "decide_route",
        _route_condition,
        {
            "single": "handle_single_ministry",
            "multi": "run_junjichu_council",
        },
    )
    builder.add_edge("handle_single_ministry", "finalize_chancellor")
    builder.add_edge("run_junjichu_council", "finalize_chancellor")
    builder.add_edge("finalize_chancellor", END)
    return builder.compile()
