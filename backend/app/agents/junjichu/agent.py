"""军机处 (Grand Council) multi-department review orchestration.

:func:`run_junjichu_council` is the single place that implements the
multi-department (``"multi"`` route type) call sequence: given the
Chancellor's chosen ``departments`` (already validated upstream -- fixed
six-ministries membership, no duplicates, at least 2 entries -- by
``app.agents.chancellor.graph``'s ``_decide_route`` node; this module does
not repeat that validation), it invokes
``app.agents.ministries.agent.invoke_ministry_agent`` once per department,
**strictly serially, in a plain Python ``for`` loop, in ``departments``
order** -- never concurrently, and never via a LangGraph ``Send``/fan-out --
collecting each department's layered bureau/ministry opinion in call order, and only once every
department has answered does it invoke 军机处's own model turn (via
:func:`invoke_junjichu_council`) to produce the final council verdict under
the strict ``{"verdict": "<non-empty text>"}`` JSON contract.

This module deliberately does **not** import anything from
``app.agents.chancellor``: ``app.agents.chancellor.graph`` imports *this*
module (to run the 军机处 council from its multi-department branch), so an
import back in the other direction would form an import cycle -- the same
reasoning documented in ``app.agents.ministries.agent``'s module docstring.
Consistent with the product task's Technical Plan ("新增的所有结构化校验失败
统一复用/继承既有 ChancellorGraphInvocationError -> 502 映射，不新增异常类型或
异常处理器"), this module does **not** define its own exception type: model
call failures propagate unwrapped, empty-response/empty-``verdict`` failures
raise the built-in ``ValueError``, malformed-JSON failures raise the shared
``app.agents.structured_output.StructuredOutputError``, and a failing
department's call raises the existing
``app.agents.ministries.agent.MinistryAgentInvocationError`` -- unmodified,
uncaught, propagated straight through. The Chancellor graph's own
multi-department node is the single place that catches all of these and
re-raises its own ``ChancellorGraphInvocationError`` (with ``__cause__``
preserved), exactly like it already does for the single-department branch.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Protocol

from app.agents.evidence_protocol import AgentEvidenceSession
from app.agents.junjichu.prompts import junjichu_system_prompt
from app.agents.ministries.agent import MinistryOpinion, invoke_ministry_agent
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.agents.synthesis_failures import (
    SynthesisFailureCode,
    SynthesisStage,
    is_locally_degradable,
)
from app.langgraph_runtime.deepseek_client import DeepSeekChatModel
from app.shiguan.recall import RecallContext, safe_recall_context_for_department

if TYPE_CHECKING:
    from app.accounting_reports.session import AccountingReportSession


class CaseLifecycleObserver(Protocol):
    """Receives validated, storage-agnostic multi-case lifecycle events."""

    def open_case(
        self, *, decree_text: str, departments: list[str], processing_path: list[str]
    ) -> None: ...

    def record_ministry_opinion(self, opinion: MinistryOpinion) -> None: ...

    def record_checkpoint(
        self,
        *,
        status: str,
        processing_path: list[str],
        council_verdict: str | None = None,
    ) -> None: ...

    def archive(self, reply_id: str) -> None: ...

    def fail(
        self,
        *,
        stage: SynthesisStage = "route",
        code: SynthesisFailureCode = "state_invalid",
    ) -> None: ...


class _CouncilContentError(ValueError):
    """Marks only locally degradable council response-content failures."""


def _format_ministry_opinions(ministry_opinions: list[MinistryOpinion]) -> str:
    """Serialize every bureau and ministry opinion without flattening layers."""
    return json.dumps(ministry_opinions, ensure_ascii=False)


def _format_recall_contexts(
    departments: list[str], recall_contexts: Mapping[str, RecallContext] | None = None
) -> str:
    contexts = {
        department: (
            recall_contexts[department]
            if recall_contexts is not None
            else safe_recall_context_for_department(department)
        ).model_dump()
        for department in departments
    }
    return json.dumps(contexts, ensure_ascii=False)


def _fallback_council_verdict(
    ministry_opinions: Sequence[MinistryOpinion],
) -> str:
    departments = "、".join(item["department"] for item in ministry_opinions)
    return (
        f"军机处已会审{departments}意见；仅确认协同办理顺序，"
        "不形成未经证据支持的事实判断。"
    )


def _parse_council_verdict(raw_response: object) -> str:
    if not isinstance(raw_response, str) or not raw_response.strip():
        raise _CouncilContentError("军机处 agent returned an empty model response.")
    parsed = parse_strict_json_object(raw_response)
    if set(parsed) != {"verdict"}:
        raise _CouncilContentError(
            "军机处 agent response JSON has an invalid schema."
        )
    verdict = parsed.get("verdict")
    if not isinstance(verdict, str) or not verdict.strip():
        raise _CouncilContentError(
            "军机处 agent response JSON is missing a non-empty 'verdict' string."
        )
    return verdict.strip()


def invoke_junjichu_council(
    decree_text: str,
    rationale: str,
    departments: list[str],
    ministry_opinions: list[MinistryOpinion],
    chat_model: DeepSeekChatModel,
    *,
    recall_contexts: Mapping[str, RecallContext] | None = None,
) -> str:
    """Invoke 军机处's own council-verdict model turn and return the verdict.

    Args:
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale.
        departments: The ordered list of departments consulted (used to
            build 军机处's system prompt).
        ministry_opinions: Every consulted department's already-collected
            structured result, including ordered ``bureau_opinions`` and its
            independent ministry-level ``opinion``, in call order.
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests).

    Returns:
        军机处's non-empty, stripped council verdict text.

    Raises:
        Exception: whatever ``chat_model`` itself raises, propagated
            unwrapped.
        StructuredOutputError: the response is not valid strict JSON, or
            not a JSON object.
        ValueError: the response is empty/non-string, or the parsed JSON is
            missing a non-empty ``verdict`` string.
    """
    system_prompt = junjichu_system_prompt(departments)
    opinions_text = _format_ministry_opinions(ministry_opinions)
    recall_contexts_text = _format_recall_contexts(departments, recall_contexts)
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"旨意：{decree_text}\n\n丞相判断说明：{rationale}\n\n"
                f"史馆旧案上下文（按部门，召回失败与无旧案须区别处理）：\n{recall_contexts_text}\n\n"
                "各部门分层意见（按丞相选定部门顺序，JSON；每部包含按咨询顺序排列的"
                f"司级意见及独立的部级补充意见）：\n{opinions_text}"
            ),
        },
    ]

    raw_response = chat_model(messages)
    return _parse_council_verdict(raw_response)


def run_junjichu_council(
    decree_text: str,
    rationale: str,
    departments: list[str],
    chat_model: DeepSeekChatModel,
    *,
    recall_contexts: Mapping[str, RecallContext] | None = None,
    evidence_session: AgentEvidenceSession | None = None,
    report_session: AccountingReportSession | None = None,
    lifecycle_observer: CaseLifecycleObserver | None = None,
    processing_path: list[str] | None = None,
) -> tuple[list[MinistryOpinion], str]:
    """Run the full multi-department 军机处 council sequence.

    Strictly serial: calls ``invoke_ministry_agent`` once per entry of
    ``departments``, in a plain Python ``for`` loop, in the given order --
    each call must return before the next one is issued, and no call is
    made concurrently. Only after every department has answered does this
    function call :func:`invoke_junjichu_council` for the final verdict.

    Args:
        decree_text: The original decree (旨意) text.
        rationale: The Chancellor's routing judgement/rationale.
        departments: The Chancellor's chosen departments, in the order they
            should be consulted (already validated upstream: fixed
            six-ministries membership, no duplicates, at least 2 entries).
        chat_model: A ``DeepSeekChatModel``-compatible callable (real or
            fake/injected for offline tests), used for both every
            department's call and 军机处's own final call.

    Returns:
        A ``(ministry_opinions, verdict)`` tuple: ``ministry_opinions`` is
        every consulted department's layered result in call order;
        ``verdict`` is 军机处's non-empty council verdict.

    Raises:
        MinistryAgentInvocationError: propagated, unwrapped, from
            ``invoke_ministry_agent`` when a department's call fails --
            this also means every department after the failing one, and
            军机处's own call, are never made.
        Exception / StructuredOutputError / ValueError: propagated,
            unwrapped, from :func:`invoke_junjichu_council` when 军机处's
            own call fails.
    """
    ministry_opinions: list[MinistryOpinion] = []
    for department in departments:
        ministry_kwargs = {
            "recall_context": (
                recall_contexts[department] if recall_contexts else None
            )
        }
        if evidence_session is not None:
            ministry_kwargs["evidence_session"] = evidence_session
        if report_session is not None:
            ministry_kwargs["report_session"] = report_session
        opinion = invoke_ministry_agent(
            department,
            decree_text,
            rationale,
            chat_model,
            **ministry_kwargs,
        )
        ministry_opinions.append(opinion)
        if lifecycle_observer is not None:
            lifecycle_observer.record_ministry_opinion(opinion)

    if lifecycle_observer is not None:
        council_processing_path = [
            node for node in (processing_path or []) if node != "军机处（会审）"
        ]
        council_processing_path.append("军机处（会审）")
        lifecycle_observer.record_checkpoint(
            status="COUNCIL_REVIEWING",
            processing_path=council_processing_path,
        )
    try:
        verdict = invoke_junjichu_council(
            decree_text,
            rationale,
            departments,
            ministry_opinions,
            chat_model,
            recall_contexts=recall_contexts,
        )
    except (_CouncilContentError, StructuredOutputError) as exc:
        if not is_locally_degradable(exc):
            raise
        if evidence_session is not None:
            evidence_session.record_degradation("junjichu:council")
        verdict = _fallback_council_verdict(ministry_opinions)
    return ministry_opinions, verdict
