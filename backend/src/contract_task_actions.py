from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from src.contract_taxonomy import ContractVerdict
from src.contracts.contract_task_read_model import (
    ContractTaskAction,
    ContractTaskBlockerCode,
)

MissionState = Literal["NONE", "DRAFT", "CONFIRMED", "CONFLICT"]
SourceClass = Literal["ADJUDICABLE", "FALLBACK", "UNKNOWN"]
FinalStatus = Literal[
    "NONE",
    "READY_FOR_DECISION",
    "AWAITING_EVIDENCE",
    "ARCHIVED",
    "SUPERSEDED",
    "CONFLICT",
]
DeliveryStatus = Literal["NONE", "READY", "PARTIAL", "UNDER_REVIEW", "CONFLICT"]
DecisionStatus = Literal[
    "NONE",
    "APPROVED",
    "REJECTED",
    "REQUEST_EVIDENCE",
]


@dataclass(frozen=True)
class ContractTaskFacts:
    mission_state: MissionState
    source_class: SourceClass
    evidence_ready: bool = False
    review_pack_ready: bool = False
    review_verdict: ContractVerdict | None = None
    final_status: FinalStatus = "NONE"
    delivery_status: DeliveryStatus = "NONE"
    decision_status: DecisionStatus = "NONE"
    downloadable_count: int = 0
    delivery_complete: bool = False
    resume_capability_present: bool = False
    archive_receipt_present: bool = False


@dataclass(frozen=True)
class ContractTaskActionResolution:
    allowed_actions: tuple[ContractTaskAction, ...]
    blockers: tuple[ContractTaskBlockerCode, ...]


def _resolution(
    *actions: ContractTaskAction,
    blockers: tuple[ContractTaskBlockerCode, ...] = (),
) -> ContractTaskActionResolution:
    return ContractTaskActionResolution(
        allowed_actions=actions,
        blockers=blockers,
    )


def _review_verdict_blocker(
    verdict: ContractVerdict | None,
) -> ContractTaskBlockerCode:
    return {
        "NEED_INFO": "EVIDENCE_INCOMPLETE",
        "REVISE_BEFORE_PROCEED": "REVIEW_REVISION_REQUIRED",
        "BLOCKED": "REVIEW_BLOCKED",
        "NEED_LEGAL_REVIEW": "LEGAL_REVIEW_REQUIRED",
    }.get(verdict, "STATE_INCONSISTENT")


def resolve_contract_task_actions(
    facts: ContractTaskFacts,
) -> ContractTaskActionResolution:
    if facts.source_class == "UNKNOWN":
        return _resolution(blockers=("STATE_INCONSISTENT",))
    if facts.source_class == "FALLBACK":
        return _resolution(blockers=("NON_ADJUDICABLE_SOURCE",))
    if facts.mission_state == "NONE":
        return _resolution(blockers=("MISSION_MISSING",))
    if facts.mission_state == "CONFLICT":
        return _resolution(blockers=("MISSION_CONFLICT",))
    if facts.mission_state == "DRAFT":
        return _resolution(
            "CONFIRM_MISSION",
            blockers=("MISSION_NOT_CONFIRMED",),
        )
    if facts.final_status == "CONFLICT":
        return _resolution(blockers=("LINEAGE_CONFLICT",))
    if facts.delivery_status in {"UNDER_REVIEW", "CONFLICT"}:
        return _resolution(blockers=("DELIVERY_INTEGRITY_FAILED",))
    if facts.downloadable_count < 0:
        return _resolution(blockers=("STATE_INCONSISTENT",))
    if facts.archive_receipt_present:
        if facts.review_verdict != "PROCEED_TO_HUMAN_APPROVAL":
            return _resolution(
                blockers=(_review_verdict_blocker(facts.review_verdict),)
            )
        if (
            facts.final_status != "ARCHIVED"
            or facts.decision_status != "APPROVED"
            or facts.delivery_status != "READY"
            or not facts.delivery_complete
        ):
            return _resolution(blockers=("ARCHIVE_LINEAGE_CONFLICT",))
        actions: list[ContractTaskAction] = []
        if facts.downloadable_count:
            actions.append("DOWNLOAD_ARTIFACT")
        actions.append("REOPEN_ARCHIVE")
        return _resolution(*actions)
    if facts.decision_status == "APPROVED" or facts.final_status == "ARCHIVED":
        return _resolution(blockers=("ARCHIVE_RECEIPT_MISSING",))
    if not facts.evidence_ready:
        return _resolution(
            "SUBMIT_EVIDENCE",
            blockers=("EVIDENCE_INCOMPLETE",),
        )
    if not facts.review_pack_ready:
        return _resolution(
            "REFRESH_REVIEW",
            blockers=("REVIEW_PACK_MISSING",),
        )
    if facts.final_status == "NONE":
        return _resolution(blockers=("FINAL_MEMORIAL_MISSING",))
    if facts.final_status != "READY_FOR_DECISION":
        return _resolution(blockers=("STATE_INCONSISTENT",))
    if facts.delivery_status == "NONE":
        return _resolution(
            "GENERATE_DELIVERY",
            blockers=("DELIVERY_MISSING",),
        )
    if facts.delivery_status == "PARTIAL":
        actions = []
        if facts.downloadable_count:
            actions.append("DOWNLOAD_ARTIFACT")
        if facts.resume_capability_present:
            actions.append("RESUME_DELIVERY")
            return _resolution(*actions)
        return _resolution(
            *actions,
            blockers=("PARTIAL_RECOVERY_REQUIRES_HARDENING",),
        )
    if facts.delivery_status == "READY":
        if not facts.delivery_complete:
            return _resolution(blockers=("DELIVERY_INTEGRITY_FAILED",))
        if facts.review_verdict == "PROCEED_TO_HUMAN_APPROVAL":
            return _resolution("DOWNLOAD_ARTIFACT", "DECIDE")
        if facts.review_verdict == "NEED_INFO":
            return _resolution(
                "DOWNLOAD_ARTIFACT",
                "SUBMIT_EVIDENCE",
                blockers=("EVIDENCE_INCOMPLETE",),
            )
        if facts.review_verdict == "REVISE_BEFORE_PROCEED":
            return _resolution(
                "DOWNLOAD_ARTIFACT",
                "REFRESH_REVIEW",
                blockers=("REVIEW_REVISION_REQUIRED",),
            )
        if facts.review_verdict == "BLOCKED":
            return _resolution(
                "DOWNLOAD_ARTIFACT",
                blockers=("REVIEW_BLOCKED",),
            )
        if facts.review_verdict == "NEED_LEGAL_REVIEW":
            return _resolution(
                "DOWNLOAD_ARTIFACT",
                blockers=("LEGAL_REVIEW_REQUIRED",),
            )
        return _resolution(blockers=("STATE_INCONSISTENT",))
    return _resolution(blockers=("STATE_INCONSISTENT",))
