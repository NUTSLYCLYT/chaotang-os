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
import re
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Required, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.bureaus import BureauAgentInvocationError
from app.agents.chancellor.prompts import CHANCELLOR_FINALIZATION_SYSTEM_PROMPT
from app.agents.chancellor_draft.battery_safety import (
    assert_battery_safety_execution_route,
    guard_battery_safety_result,
)
from app.agents.chancellor_draft.routing import (
    ApprovedRouteSnapshot,
    validate_route_snapshot,
)
from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    AgentEvidenceSnapshot,
    build_default_evidence_session,
    bureau_node_id,
)
from app.agents.evidence_rendering import render_mainland_last_price
from app.agents.junjichu.agent import (
    CaseLifecycleObserver,
    run_junjichu_council,
    run_junjichu_council_with_report,
)
from app.agents.market_intent import is_mainland_last_price_intent
from app.agents.ministries.agent import (
    MinistryAgentInvocationError,
    MinistryOpinion,
    invoke_ministry_agent,
)
from app.agents.ministries.prompts import MINISTRIES
from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.agents.synthesis_failures import SynthesisStage, is_locally_degradable
from app.jinyiwei.models import FactCategory, MarketMetric
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel, build_deepseek_chat_model
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config
from app.langgraph_runtime.provider_budget import get_provider_attempt_budget
from app.shiguan.recall import RecallContext, safe_recall_context_for_department

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession

_DEFAULT_LEGACY_COUNCIL_RUNNER = run_junjichu_council

_CANONICAL_MARKET_RECOMMENDATIONS = [
    "请核对行情时间与交易时段后再使用该价格。",
    "请结合自身风险承受能力独立判断。",
    "本回奏仅提供行情信息，不构成投资建议。",
]
_SAFE_RECOMMENDATIONS = (
    "明确岗位职责、权限边界与交付标准",
    "按里程碑评审办理成果并保留验证记录",
    "涉及投资决策时另行完成合规与风险审查",
)
_ROUTE_DOMAIN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "吏部": ("招聘", "招人", "人员", "岗位", "任免", "绩效", "薪酬"),
    "户部": ("财务", "预算", "报价", "融资", "审计", "投资", "股票", "证券"),
    "礼部": ("品牌", "公关", "内容", "体验", "对外沟通"),
    "兵部": ("销售", "客户", "商机", "渠道", "竞争", "增长"),
    "刑部": ("合同", "合规", "授权", "安全", "争议", "法务", "风控"),
    "工部": ("产品", "技术", "研发", "开发", "交付", "供应链", "产能", "质量", "工程"),
}
_RECRUITING_PEOPLE_PATTERN = re.compile(
    r"(?<!不要)(?<!暂不)(?<!无需)(?<!不用)"
    r"招[一二三四五六七八九十百千万两\d]+(?:个|名|位)?人"
)


class _FinalizationContentError(ValueError):
    """Marks only locally degradable finalizer response-content failures."""


class _RouteContentError(ValueError):
    """Marks only locally degradable route response-content failures."""


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
    approved_route: Required[ApprovedRouteSnapshot]
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
    required_bureaus_by_department: dict[str, tuple[str, ...]]


def _fallback_finalization(
    state: ChancellorGraphState,
) -> tuple[str, list[str]]:
    departments = "、".join(state["departments"])
    summary = f"已完成{departments}分层办理；当前回奏仅保留规范性安排与证据边界。"
    return summary, list(_SAFE_RECOMMENDATIONS)


def _deterministic_route(decree_text: str) -> tuple[str, str, list[str]]:
    departments = [
        department
        for department in MINISTRIES
        if any(keyword in decree_text for keyword in _ROUTE_DOMAIN_KEYWORDS[department])
        or (department == "吏部" and _RECRUITING_PEOPLE_PATTERN.search(decree_text) is not None)
    ]
    if len(departments) >= 2:
        return (
            "multi",
            "旨意明确涉及多个固定职责领域，按六部名录顺序会审；该分流不形成任何事实判断。",
            departments,
        )
    if len(departments) == 1:
        return (
            "single",
            "旨意匹配一个固定职责领域，由对应部门规范办理；该分流不形成任何事实判断。",
            departments,
        )
    return (
        "single",
        "旨意未匹配明确职责领域，先由吏部澄清责任边界；该分流不形成任何事实判断。",
        ["吏部"],
    )


def _parse_route_response(raw_response: object) -> tuple[str, str, list[str]]:
    if not isinstance(raw_response, str) or not raw_response.strip():
        raise _RouteContentError("The Chancellor route response is empty.")
    try:
        parsed = parse_strict_json_object(raw_response)
    except StructuredOutputError as exc:
        raise _RouteContentError("The Chancellor route response is not JSON.") from exc

    route_type = parsed.get("route_type")
    if route_type not in ("single", "multi"):
        raise _RouteContentError("The Chancellor route type is invalid.")
    rationale = parsed.get("rationale")
    if not isinstance(rationale, str) or not rationale.strip():
        raise _RouteContentError("The Chancellor route rationale is invalid.")
    departments = parsed.get("departments")
    if (
        not isinstance(departments, list)
        or not departments
        or not all(isinstance(department, str) for department in departments)
    ):
        raise _RouteContentError("The Chancellor route departments are invalid.")
    if len(set(departments)) != len(departments):
        raise _RouteContentError("The Chancellor route departments contain duplicates.")
    if not all(department in MINISTRIES for department in departments):
        raise _RouteContentError("The Chancellor route contains an unknown department.")
    if route_type == "single" and len(departments) != 1:
        raise _RouteContentError("A single route requires exactly one department.")
    if route_type == "multi" and len(departments) < 2:
        raise _RouteContentError("A multi route requires at least two departments.")
    return route_type, rationale.strip(), departments


def _parse_finalization_response(raw_response: object) -> tuple[str, list[str]]:
    if not isinstance(raw_response, str) or not raw_response.strip():
        raise _FinalizationContentError("The Chancellor finalizer returned no usable response.")
    parsed = parse_strict_json_object(raw_response)
    if set(parsed) != {"summary", "recommendations"}:
        raise _FinalizationContentError("The Chancellor finalizer response has an invalid schema.")
    summary = parsed["summary"]
    raw_recommendations = parsed["recommendations"]
    if not isinstance(summary, str) or not summary.strip():
        raise _FinalizationContentError("The Chancellor finalizer summary is invalid.")
    if (
        not isinstance(raw_recommendations, list)
        or len(raw_recommendations) != 3
        or any(not isinstance(item, str) or not item.strip() for item in raw_recommendations)
    ):
        raise _FinalizationContentError("The Chancellor finalizer recommendations are invalid.")
    recommendations = [item.strip() for item in raw_recommendations]
    if len(set(recommendations)) != 3:
        raise _FinalizationContentError("The Chancellor finalizer recommendations must be unique.")
    return summary.strip(), recommendations


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

    request_id: str | None

    def __init__(self, message: str, *, request_id: str | None = None) -> None:
        super().__init__(message)
        self.request_id = request_id


def _trusted_failure_stage(exc: BaseException, *, default: SynthesisStage) -> SynthesisStage:
    if isinstance(
        exc,
        (
            BureauAgentInvocationError,
            MinistryAgentInvocationError,
            ChancellorGraphInvocationError,
        ),
    ):
        stage = getattr(exc, "failure_stage", default)
        if stage in {
            "route",
            "report",
            "bureau",
            "ministry",
            "council",
            "finalize",
            "archive",
        }:
            return stage
    return default


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
    owner_user_id: str,
    evidence_session_factory: Callable[[], AgentEvidenceSession] | None = None,
    report_session: AccountingReportSession | None = None,
    lifecycle_observer: CaseLifecycleObserver | None = None,
    execution_boundary: Callable[[], None] | None = None,
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
    if not isinstance(owner_user_id, str) or not owner_user_id.strip():
        raise ValueError("owner_user_id must be nonempty")

    resolved_chat_model: DeepSeekChatModel
    if chat_model is not None:
        resolved_chat_model = chat_model
    else:
        config = load_deepseek_provider_config()
        resolved_chat_model = build_deepseek_chat_model(
            config,
            dotenv_path,
            json_output=True,
            attempt_budget=get_provider_attempt_budget(),
        )

    def _decide_route(state: ChancellorGraphState) -> dict:
        try:
            approved_route = validate_route_snapshot(state["approved_route"])
            assert_battery_safety_execution_route(
                state["decree_text"], approved_route
            )
        except Exception as exc:  # noqa: BLE001 - sanitized graph boundary
            error = ChancellorGraphInvocationError(
                "Chancellor graph rejected the approved route snapshot; "
                "see __cause__ for the original exception."
            )
            error.failure_stage = "route"
            raise error from exc
        departments = [item.department for item in approved_route.departments]
        route_type = "single" if len(departments) == 1 else "multi"
        required_bureaus_by_department = {
            item.department: item.required_bureaus for item in approved_route.departments
        }
        rationale = "依已批准拟旨路由办理，参与部门及顺序不得变更。"
        try:
            evidence_session = (
                evidence_session_factory()
                if evidence_session_factory is not None
                else build_default_evidence_session(
                    resolved_chat_model,
                    owner_user_id=owner_user_id,
                )
            )
            evidence_owner_user_id = getattr(evidence_session, "owner_user_id", None)
            if (
                not isinstance(evidence_owner_user_id, str)
                or not evidence_owner_user_id.strip()
            ):
                raise ValueError("evidence session owner_user_id must be nonempty")
            if evidence_owner_user_id != owner_user_id:
                raise ValueError(
                    "evidence session owner_user_id must match graph owner_user_id"
                )
        except Exception as exc:  # noqa: BLE001 - sanitized graph boundary
            raise ChancellorGraphInvocationError(
                "Chancellor graph failed to initialize its evidence session; "
                "see __cause__ for the original exception."
            ) from exc
        processing_path = ["上书房", "丞相（首次分流）"]
        if route_type == "multi" and lifecycle_observer is not None:
            lifecycle_observer.open_case(
                decree_text=state["decree_text"],
                departments=departments,
                processing_path=processing_path,
            )

        route_state = {
            "chancellor_rationale": rationale,
            "route_type": route_type,
            "departments": departments,
            "evidence_session": evidence_session,
            "processing_path": processing_path,
            "approved_route": approved_route,
            "required_bureaus_by_department": required_bureaus_by_department,
        }
        return route_state

    def _route_condition(state: ChancellorGraphState) -> str:
        return state["route_type"]

    def _handle_single_ministry(state: ChancellorGraphState) -> dict:
        if execution_boundary is not None:
            execution_boundary()
        department = state["departments"][0]
        recall_context = safe_recall_context_for_department(department)
        try:
            ministry_kwargs: dict[str, object] = {
                "recall_context": recall_context,
                "evidence_session": state["evidence_session"],
                "required_bureaus": state["required_bureaus_by_department"][department],
            }
            if report_session is not None:
                ministry_kwargs["report_session"] = report_session
            opinion = invoke_ministry_agent(
                department,
                state["decree_text"],
                state["chancellor_rationale"],
                resolved_chat_model,
                **ministry_kwargs,
            )
        except Exception as exc:  # noqa: BLE001 - one sanitized graph error boundary
            error = ChancellorGraphInvocationError(
                f"Chancellor graph node failed to obtain a {department} ministry "
                "response; see __cause__ for the original exception."
            )
            error.failure_stage = _trusted_failure_stage(exc, default="ministry")
            raise error from exc

        snapshot = state["evidence_session"].snapshot()
        first_investigating_bureau = (
            snapshot.investigating_bureau_node_ids[0]
            if snapshot.investigating_bureau_node_ids
            else None
        )
        bureau_path: list[str] = []
        for bureau_opinion in opinion["bureau_opinions"]:
            bureau_path.append(f"{department}·{bureau_opinion['bureau']}")
            if first_investigating_bureau == bureau_node_id(department, bureau_opinion["bureau"]):
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
            department: safe_recall_context_for_department(department) for department in departments
        }
        try:
            council_kwargs: dict[str, object] = {
                "recall_contexts": recall_contexts,
                "evidence_session": state["evidence_session"],
                "required_bureaus_by_department": state["required_bureaus_by_department"],
            }
            if report_session is not None:
                council_kwargs["report_session"] = report_session
            if lifecycle_observer is not None:
                council_kwargs["lifecycle_observer"] = lifecycle_observer
                council_kwargs["processing_path"] = state["processing_path"]
            if execution_boundary is not None:
                council_kwargs["execution_boundary"] = execution_boundary
            if run_junjichu_council is not _DEFAULT_LEGACY_COUNCIL_RUNNER:
                ministry_opinions, verdict = run_junjichu_council(
                    state["decree_text"],
                    state["chancellor_rationale"],
                    departments,
                    resolved_chat_model,
                    **council_kwargs,
                )
            else:
                typed_result = run_junjichu_council_with_report(
                    state["decree_text"],
                    state["chancellor_rationale"],
                    departments,
                    resolved_chat_model,
                    **council_kwargs,
                )
                ministry_opinions = typed_result.ministry_opinions
                verdict = typed_result.verdict
        except Exception as exc:  # noqa: BLE001 - intentionally wrap any model/validation error
            error = ChancellorGraphInvocationError(
                "Chancellor graph node failed to complete the 军机处 multi-department "
                "council review; see __cause__ for the original exception."
            )
            error.failure_stage = _trusted_failure_stage(exc, default="council")
            raise error from exc

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
                if not investigation_marked and first_investigating_bureau == bureau_node_id(
                    department, bureau_opinion["bureau"]
                ):
                    layered_path.append("锦衣卫（调查）")
                    investigation_marked = True
            layered_path.append(f"{department}（部级补充）")
        layered_path.append("军机处（会审）")
        if lifecycle_observer is not None:
            lifecycle_observer.record_checkpoint(
                status="COUNCIL_REVIEWING",
                processing_path=layered_path,
                council_verdict=verdict,
            )

        return {
            "processing_path": layered_path,
            "ministry_opinions": ministry_opinions,
            "council_verdict": verdict,
            "recall_contexts": {
                department: context.model_dump() for department, context in recall_contexts.items()
            },
            "evidence_snapshot": snapshot,
            "adopted_evidence_ids": snapshot.adopted_evidence_ids,
        }

    def _finalize_chancellor(state: ChancellorGraphState) -> dict:
        def guarded_result(result: dict[str, object]) -> dict[str, object]:
            guarded = guard_battery_safety_result(
                state["decree_text"], {**state, **result}
            )
            return result if guarded is None else guarded

        if execution_boundary is not None:
            execution_boundary()
        if state["route_type"] == "multi" and lifecycle_observer is not None:
            lifecycle_observer.record_checkpoint(
                status="CHANCELLOR_FINALIZING",
                processing_path=state["processing_path"],
            )
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
            summary, recommendations = invoke_strict_structured(
                resolved_chat_model,
                messages,
                _parse_finalization_response,
                stage="chancellor_finalize",
            )
        except StructuredInvocationError as exc:
            if exc.failure_code == "provider_unavailable":
                error = ChancellorGraphInvocationError(
                    "Chancellor graph finalization failed; "
                    "see __cause__ for the original exception."
                )
                error.failure_stage = "finalize"
                raise error from exc.__cause__
            if not is_locally_degradable(exc):
                error = ChancellorGraphInvocationError(
                    "Chancellor graph finalization failed; "
                    "see __cause__ for the original exception."
                )
                error.failure_stage = "finalize"
                raise error from exc
            can_degrade = (
                state["route_type"] == "single"
                and state["departments"] == ["户部"]
                and is_mainland_last_price_intent(state["decree_text"])
                and bool(state["evidence_session"].snapshot().adopted_evidence_ids)
                and _has_canonical_last_price_evidence(state["evidence_session"])
                and len(state["ministry_opinions"]) == 1
            )
            state["evidence_session"].record_degradation("chancellor:finalize")
            snapshot = state["evidence_session"].snapshot()
            if not can_degrade:
                fallback_summary, fallback_recommendations = _fallback_finalization(state)
                return guarded_result({
                    "processing_path": [
                        *state["processing_path"],
                        "丞相（最终汇总）",
                    ],
                    "final_verdict": fallback_summary,
                    "recommendations": fallback_recommendations,
                    "evidence_snapshot": snapshot,
                    "adopted_evidence_ids": snapshot.adopted_evidence_ids,
                })
            return guarded_result({
                "processing_path": [*state["processing_path"], "丞相（最终汇总）"],
                "final_verdict": state["ministry_opinions"][0]["opinion"],
                "recommendations": list(_CANONICAL_MARKET_RECOMMENDATIONS),
                "evidence_snapshot": snapshot,
                "adopted_evidence_ids": snapshot.adopted_evidence_ids,
            })

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
                summary != authoritative_summary
                or recommendations != _CANONICAL_MARKET_RECOMMENDATIONS
            ):
                state["evidence_session"].record_degradation("chancellor:finalize")
                snapshot = state["evidence_session"].snapshot()
                return guarded_result({
                    "processing_path": [
                        *state["processing_path"],
                        "丞相（最终汇总）",
                    ],
                    "final_verdict": authoritative_summary,
                    "recommendations": list(_CANONICAL_MARKET_RECOMMENDATIONS),
                    "evidence_snapshot": snapshot,
                    "adopted_evidence_ids": snapshot.adopted_evidence_ids,
                })

        return guarded_result({
            "processing_path": [*state["processing_path"], "丞相（最终汇总）"],
            "final_verdict": summary,
            "recommendations": recommendations,
        })

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
