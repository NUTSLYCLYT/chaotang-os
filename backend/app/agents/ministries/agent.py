"""Single-ministry (六部) layered bureau consultation and synthesis helper.

:func:`invoke_ministry_agent` first validates the approved required-bureau
constraint, then parses a department's strict bureau-route contract (non-empty
``rationale`` plus one or more unique in-department ``bureaus``), consults
those bureaus serially, and performs one additional ministry-level model call
over all ordered bureau opinions.

This module deliberately does **not** import anything from
``app.agents.chancellor``: ``app.agents.chancellor.graph`` imports *this*
module (to invoke a ministry from its single-department branch), so an
import back in the other direction would form an import cycle. Instead, this
module defines its own :class:`MinistryAgentInvocationError`; callers that
need to unify error handling under a different exception type (e.g. the
Chancellor graph wrapping every internal failure into its own
``ChancellorGraphInvocationError``) catch this exception and re-raise their
own, exactly like this module itself does with
``app.agents.structured_output.StructuredOutputError``.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import TYPE_CHECKING, TypedDict

from app.accounting_reports.intent import detect_accounting_report_intent
from app.agents.bureaus import (
    BureauAgentInvocationError,
    bureau_profiles_for,
    capability_profiles_for,
    invoke_bureau_agent,
)
from app.agents.evidence_protocol import AgentEvidenceSession
from app.agents.evidence_rendering import render_mainland_last_price
from app.agents.market_intent import (
    is_mainland_last_price_intent,
)
from app.agents.ministries.prompts import (
    ministry_required_bureaus_correction_prompt,
    ministry_synthesis_system_prompt,
    ministry_system_prompt,
)
from app.agents.structured_invocation import (
    StructuredInvocationError,
    invoke_strict_structured,
)
from app.agents.structured_output import parse_strict_json_object
from app.agents.synthesis_failures import is_locally_degradable
from app.jinyiwei.models import FactCategory, MarketMetric
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel
from app.shiguan.recall import RecallContext, safe_recall_context_for_department

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession


class MinistryAgentInvocationError(Exception):
    """Raised when invoking a single ministry (六部) agent fails.

    Covers invalid or failed ministry routing and failures from any selected
    bureau. Every failure is fail-closed: no partial aggregation is returned.

    The original exception (when applicable) is always preserved via
    ``raise ... from exc`` (available as ``__cause__``), but this
    exception's own message never echoes the raw model output or the
    underlying exception's ``str()`` -- callers are expected to catch this
    exception and re-raise their own sanitized, package-specific exception
    (e.g. ``app.agents.chancellor.graph.ChancellorGraphInvocationError``)
    without risking an information leak from arbitrary model output.
    """

    failure_stage = "ministry"


class BureauOpinion(TypedDict):
    """One selected bureau's validated opinion, in consultation order."""

    bureau: str
    opinion: str


class MinistryOpinion(TypedDict):
    """Stable layered result returned by one ministry invocation."""

    department: str
    bureau_opinions: list[BureauOpinion]
    opinion: str


def _fallback_ministry_opinion(department: str, bureau_opinions: Sequence[BureauOpinion]) -> str:
    bureau_names = "、".join(item["bureau"] for item in bureau_opinions)
    return (
        f"{department}已汇总{bureau_names}司议；当前仅形成规范性办理建议，"
        "不形成未经证据支持的事实结论。"
    )


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


def _format_recall_context(context: RecallContext) -> str:
    if not context.available:
        return "史馆旧案召回失败：不可把召回失败伪装成已有历史经验。"
    if not context.entries:
        return "史馆旧案召回：未命中旧案。"
    return "史馆旧案召回：" + json.dumps(
        [entry.model_dump() for entry in context.entries],
        ensure_ascii=False,
    )


def invoke_ministry_agent(
    department: str,
    decree_text: str,
    rationale: str,
    chat_model: DeepSeekChatModel,
    *,
    required_bureaus: Sequence[str],
    recall_context: RecallContext | None = None,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
) -> MinistryOpinion:
    """Consult selected bureaus serially, then produce a ministry synthesis.

    Args:
        department: One of the six fixed ``app.agents.ministries.MINISTRIES``
            names.
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale, given to the
            department as context for why this matter was routed to it.
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests).

    Returns:
        A structured department result containing ordered bureau opinions and
        a separately generated, non-empty ministry-level opinion.

    Raises:
        ValueError: ``department`` is not one of the fixed six ministries
            (propagated, unwrapped, from
            ``app.agents.ministries.prompts.ministry_system_prompt`` -- this
            indicates a caller bug, e.g. an unvalidated department slipping
            through, not a model failure).
        MinistryAgentInvocationError: the model call failed, or its response
            did not satisfy the strict bureau-routing contract, or any selected
            bureau invocation failed.
    """
    system_prompt = ministry_system_prompt(department)
    allowed_bureau_order = tuple(profile.bureau for profile in bureau_profiles_for(department))
    allowed_bureaus = set(allowed_bureau_order)
    if (
        isinstance(required_bureaus, (str, bytes))
        or not required_bureaus
        or any(
            not isinstance(bureau, str) or bureau not in allowed_bureaus
            for bureau in required_bureaus
        )
        or len(required_bureaus) != len(set(required_bureaus))
    ):
        error = MinistryAgentInvocationError(
            f"{department} agent received invalid required bureaus."
        )
        error.failure_stage = "bureau"
        raise error
    required_bureaus = tuple(required_bureaus)
    is_accounting_report = (
        department == "户部" and detect_accounting_report_intent(decree_text).requested
    )
    if recall_context is None:
        recall_context = safe_recall_context_for_department(department)
    recall_context_text = _format_recall_context(recall_context)

    if department == "户部" and is_mainland_last_price_intent(decree_text):
        route_rationale = "明确的中国大陆证券最新价查询，由投资司办理。"
        selected_bureaus = ["投资司"]
    else:
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"旨意：{decree_text}\n\n丞相判断说明：{rationale}\n\n{recall_context_text}"
                ),
            },
        ]

        def parse_route(response: object) -> tuple[str, list[str]]:
            if not isinstance(response, str) or not response.strip():
                raise ValueError("The ministry routing response is empty.")
            parsed = parse_strict_json_object(response)
            if set(parsed) != {"rationale", "bureaus"}:
                raise ValueError("The ministry routing response has an invalid schema.")
            parsed_rationale = parsed["rationale"]
            parsed_bureaus = parsed["bureaus"]
            if not isinstance(parsed_rationale, str) or not parsed_rationale.strip():
                raise ValueError("The ministry routing rationale is not a non-empty string.")
            if (
                not isinstance(parsed_bureaus, list)
                or not parsed_bureaus
                or any(not isinstance(bureau, str) for bureau in parsed_bureaus)
                or len(parsed_bureaus) != len(set(parsed_bureaus))
                or any(bureau not in allowed_bureaus for bureau in parsed_bureaus)
            ):
                raise ValueError("The ministry bureau selection is invalid.")
            return parsed_rationale, parsed_bureaus

        def route_satisfies_approved_bureaus(bureaus: Sequence[str]) -> bool:
            if is_accounting_report:
                return tuple(bureaus) == required_bureaus
            return set(required_bureaus).issubset(bureaus)

        def parse_approved_route(response: object) -> tuple[str, list[str]]:
            parsed_rationale, parsed_bureaus = parse_route(response)
            if not route_satisfies_approved_bureaus(parsed_bureaus):
                raise ValueError("The ministry route omitted approved bureaus.")
            return parsed_rationale, parsed_bureaus

        correction_instruction = ministry_required_bureaus_correction_prompt(
            department,
            allowed_bureaus=allowed_bureau_order,
            required_bureaus=required_bureaus,
        ) + (
            "\n本旨意为确定性财务报表任务，bureaus 必须严格等于"
            f"{json.dumps(required_bureaus, ensure_ascii=False)}，不得增加其他司。"
            if is_accounting_report
            else ""
        )
        try:
            route_rationale, selected_bureaus = invoke_strict_structured(
                chat_model,
                messages,
                parse_approved_route,
                stage="ministry_route",
                correction_instruction=correction_instruction,
            )
        except StructuredInvocationError as exc:
            error = MinistryAgentInvocationError(
                f"{department} agent returned an invalid bureau selection."
            )
            error.failure_stage = (
                "ministry" if exc.failure_code == "provider_unavailable" else "bureau"
            )
            cause = exc.__cause__ if exc.failure_code == "provider_unavailable" else exc
            raise error from cause
    if (
        tuple(selected_bureaus) != required_bureaus
        if is_accounting_report
        else not set(required_bureaus).issubset(selected_bureaus)
    ):
        error = MinistryAgentInvocationError(f"{department} agent violated approved bureaus.")
        error.failure_stage = "bureau"
        raise error

    for bureau in selected_bureaus:
        try:
            capability_profiles_for(department, bureau)
        except Exception as exc:  # noqa: BLE001 - fail closed at the integrity boundary
            raise MinistryAgentInvocationError(
                f"{department} agent failed selected-bureau capability integrity validation."
            ) from exc

    bureau_opinions: list[BureauOpinion] = []
    for bureau in selected_bureaus:
        try:
            bureau_kwargs: dict[str, object] = {}
            if (
                not (
                    evidence_session is not None
                    and is_accounting_report
                    and report_session is not None
                    and bureau == "会计司"
                )
                and evidence_session is not None
            ):
                bureau_kwargs["evidence_session"] = evidence_session
            if report_session is not None:
                bureau_kwargs["report_session"] = report_session
            opinion = invoke_bureau_agent(
                department,
                bureau,
                decree_text,
                route_rationale.strip(),
                chat_model,
                **bureau_kwargs,
            )
        except BureauAgentInvocationError as exc:
            error = MinistryAgentInvocationError(
                f"{department} agent failed while consulting a selected bureau."
            )
            error.failure_stage = exc.failure_stage
            raise error from exc
        bureau_opinions.append({"bureau": bureau, "opinion": opinion})

    if (
        department == "户部"
        and is_mainland_last_price_intent(decree_text)
        and evidence_session is not None
        and (
            not evidence_session.snapshot().adopted_evidence_ids
            or not _has_canonical_last_price_evidence(evidence_session)
        )
    ):
        raise MinistryAgentInvocationError("户部 market synthesis requires adopted evidence.")

    synthesis_messages = [
        {
            "role": "system",
            "content": ministry_synthesis_system_prompt(department),
        },
        {
            "role": "user",
            "content": (
                f"原始旨意：{decree_text}\n\n"
                f"丞相判断说明：{rationale}\n\n"
                f"{recall_context_text}\n\n"
                f"本部司级路由说明：{route_rationale.strip()}\n\n"
                "全部司级意见（按本部路由顺序，JSON）："
                f"{json.dumps(bureau_opinions, ensure_ascii=False)}"
            ),
        },
    ]
    try:

        def parse_synthesis(response: object) -> str:
            if not isinstance(response, str) or not response.strip():
                raise ValueError("The ministry synthesis returned no usable text.")
            synthesis = parse_strict_json_object(response)
            if set(synthesis) != {"opinion"}:
                raise ValueError("The ministry synthesis response has an invalid schema.")
            opinion = synthesis["opinion"]
            if not isinstance(opinion, str) or not opinion.strip():
                raise ValueError("The ministry opinion is not a non-empty string.")
            return opinion.strip()

        try:
            ministry_opinion = invoke_strict_structured(
                chat_model,
                synthesis_messages,
                parse_synthesis,
                stage="ministry_synthesis",
            )
        except StructuredInvocationError as exc:
            error = MinistryAgentInvocationError(f"{department} agent ministry synthesis failed.")
            error.failure_stage = "ministry"
            error.failure_code = exc.failure_code
            cause = exc.__cause__ if exc.failure_code == "provider_unavailable" else exc
            raise error from cause
        if (
            department == "户部"
            and is_mainland_last_price_intent(decree_text)
            and evidence_session is not None
        ):
            authoritative_opinion = "\n".join(item["opinion"] for item in bureau_opinions)
            if ministry_opinion != authoritative_opinion:
                ministry_opinion = authoritative_opinion
                evidence_session.record_degradation("ministry:户部")
    except MinistryAgentInvocationError as exc:
        if getattr(exc, "failure_code", None) == "provider_unavailable":
            raise
        can_degrade = (
            department == "户部"
            and is_mainland_last_price_intent(decree_text)
            and evidence_session is not None
            and bool(evidence_session.snapshot().adopted_evidence_ids)
            and _has_canonical_last_price_evidence(evidence_session)
            and bool(bureau_opinions)
        )
        if is_locally_degradable(exc):
            if can_degrade:
                ministry_opinion = "\n".join(item["opinion"] for item in bureau_opinions)
            else:
                ministry_opinion = _fallback_ministry_opinion(department, bureau_opinions)
            if evidence_session is not None:
                evidence_session.record_degradation(f"ministry:{department}")
        elif not can_degrade:
            raise
        else:
            ministry_opinion = "\n".join(item["opinion"] for item in bureau_opinions)
            evidence_session.record_degradation("ministry:户部")

    return {
        "department": department,
        "bureau_opinions": bureau_opinions,
        "opinion": ministry_opinion,
    }
