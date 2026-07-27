from __future__ import annotations

import pytest

from src.contract_task_actions import (
    ContractTaskFacts,
    resolve_contract_task_actions,
)


@pytest.mark.parametrize(
    ("facts", "actions", "blockers"),
    [
        (
            ContractTaskFacts(mission_state="NONE", source_class="ADJUDICABLE"),
            (),
            ("MISSION_MISSING",),
        ),
        (
            ContractTaskFacts(mission_state="CONFLICT", source_class="ADJUDICABLE"),
            (),
            ("MISSION_CONFLICT",),
        ),
        (
            ContractTaskFacts(mission_state="DRAFT", source_class="ADJUDICABLE"),
            ("CONFIRM_MISSION",),
            ("MISSION_NOT_CONFIRMED",),
        ),
        (
            ContractTaskFacts(
                mission_state="DRAFT",
                source_class="ADJUDICABLE",
                final_status="ARCHIVED",
                delivery_status="READY",
                decision_status="APPROVED",
                downloadable_count=3,
                delivery_complete=True,
                archive_receipt_present=True,
            ),
            ("CONFIRM_MISSION",),
            ("MISSION_NOT_CONFIRMED",),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="ADJUDICABLE",
                evidence_ready=False,
            ),
            ("SUBMIT_EVIDENCE",),
            ("EVIDENCE_INCOMPLETE",),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="ADJUDICABLE",
                evidence_ready=True,
                review_pack_ready=True,
                final_status="READY_FOR_DECISION",
            ),
            ("GENERATE_DELIVERY",),
            ("DELIVERY_MISSING",),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="ADJUDICABLE",
                evidence_ready=True,
                review_pack_ready=True,
                final_status="READY_FOR_DECISION",
                delivery_status="PARTIAL",
                downloadable_count=2,
                resume_capability_present=True,
            ),
            ("DOWNLOAD_ARTIFACT", "RESUME_DELIVERY"),
            (),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="ADJUDICABLE",
                evidence_ready=True,
                review_pack_ready=True,
                final_status="READY_FOR_DECISION",
                delivery_status="PARTIAL",
                downloadable_count=2,
                resume_capability_present=False,
            ),
            ("DOWNLOAD_ARTIFACT",),
            ("PARTIAL_RECOVERY_REQUIRES_HARDENING",),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="ADJUDICABLE",
                evidence_ready=True,
                review_pack_ready=True,
                final_status="READY_FOR_DECISION",
                delivery_status="READY",
                downloadable_count=3,
                delivery_complete=True,
                review_verdict="PROCEED_TO_HUMAN_APPROVAL",
            ),
            ("DOWNLOAD_ARTIFACT", "DECIDE"),
            (),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="ADJUDICABLE",
                evidence_ready=True,
                review_pack_ready=True,
                review_verdict="PROCEED_TO_HUMAN_APPROVAL",
                final_status="ARCHIVED",
                decision_status="APPROVED",
                delivery_status="READY",
                downloadable_count=3,
                delivery_complete=True,
                archive_receipt_present=True,
            ),
            ("DOWNLOAD_ARTIFACT", "REOPEN_ARCHIVE"),
            (),
        ),
        (
            ContractTaskFacts(
                mission_state="CONFIRMED",
                source_class="FALLBACK",
            ),
            (),
            ("NON_ADJUDICABLE_SOURCE",),
        ),
    ],
)
def test_action_resolver_table(
    facts: ContractTaskFacts,
    actions: tuple[str, ...],
    blockers: tuple[str, ...],
) -> None:
    resolution = resolve_contract_task_actions(facts)

    assert resolution.allowed_actions == actions
    assert resolution.blockers == blockers


@pytest.mark.parametrize(
    "facts",
    [
        ContractTaskFacts(mission_state="CONFIRMED", source_class="UNKNOWN"),
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            final_status="CONFLICT",
        ),
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            delivery_status="CONFLICT",
        ),
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            decision_status="APPROVED",
            final_status="ARCHIVED",
            archive_receipt_present=False,
        ),
    ],
)
def test_unknown_or_inconsistent_facts_fail_closed(facts: ContractTaskFacts) -> None:
    resolution = resolve_contract_task_actions(facts)

    assert resolution.allowed_actions == ()
    assert resolution.blockers


def test_under_review_delivery_reports_integrity_failure() -> None:
    resolution = resolve_contract_task_actions(
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            evidence_ready=True,
            review_pack_ready=True,
            final_status="READY_FOR_DECISION",
            delivery_status="UNDER_REVIEW",
            downloadable_count=2,
            delivery_complete=False,
        )
    )

    assert resolution.allowed_actions == ()
    assert resolution.blockers == ("DELIVERY_INTEGRITY_FAILED",)


@pytest.mark.parametrize("downloadable_count", [0, 1, 2])
def test_ready_delivery_requires_complete_pdf_docx_json_set(
    downloadable_count: int,
) -> None:
    resolution = resolve_contract_task_actions(
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            evidence_ready=True,
            review_pack_ready=True,
            final_status="READY_FOR_DECISION",
            delivery_status="READY",
            downloadable_count=downloadable_count,
            delivery_complete=False,
        )
    )

    assert resolution.allowed_actions == ()
    assert resolution.blockers == ("DELIVERY_INTEGRITY_FAILED",)


@pytest.mark.parametrize(
    ("verdict", "actions", "blockers"),
    [
        (
            "NEED_INFO",
            ("DOWNLOAD_ARTIFACT", "SUBMIT_EVIDENCE"),
            ("EVIDENCE_INCOMPLETE",),
        ),
        (
            "REVISE_BEFORE_PROCEED",
            ("DOWNLOAD_ARTIFACT", "REFRESH_REVIEW"),
            ("REVIEW_REVISION_REQUIRED",),
        ),
        ("BLOCKED", ("DOWNLOAD_ARTIFACT",), ("REVIEW_BLOCKED",)),
        (
            "NEED_LEGAL_REVIEW",
            ("DOWNLOAD_ARTIFACT",),
            ("LEGAL_REVIEW_REQUIRED",),
        ),
    ],
)
def test_non_proceed_verdict_never_exposes_decide(
    verdict: str,
    actions: tuple[str, ...],
    blockers: tuple[str, ...],
) -> None:
    resolution = resolve_contract_task_actions(
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            evidence_ready=True,
            review_pack_ready=True,
            review_verdict=verdict,
            final_status="READY_FOR_DECISION",
            delivery_status="READY",
            downloadable_count=3,
            delivery_complete=True,
        )
    )

    assert resolution.allowed_actions == actions
    assert resolution.blockers == blockers
    assert "DECIDE" not in resolution.allowed_actions


@pytest.mark.parametrize(
    ("verdict", "blocker"),
    [
        ("NEED_INFO", "EVIDENCE_INCOMPLETE"),
        ("REVISE_BEFORE_PROCEED", "REVIEW_REVISION_REQUIRED"),
        ("BLOCKED", "REVIEW_BLOCKED"),
        ("NEED_LEGAL_REVIEW", "LEGAL_REVIEW_REQUIRED"),
    ],
)
def test_non_proceed_verdict_cannot_reopen_an_existing_archive(
    verdict: str,
    blocker: str,
) -> None:
    resolution = resolve_contract_task_actions(
        ContractTaskFacts(
            mission_state="CONFIRMED",
            source_class="ADJUDICABLE",
            evidence_ready=True,
            review_pack_ready=True,
            review_verdict=verdict,
            final_status="ARCHIVED",
            delivery_status="READY",
            decision_status="APPROVED",
            downloadable_count=3,
            delivery_complete=True,
            archive_receipt_present=True,
        )
    )

    assert resolution.allowed_actions == ()
    assert resolution.blockers == (blocker,)
