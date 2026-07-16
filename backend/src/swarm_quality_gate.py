"""Standalone import seam for the deterministic swarm quality gate."""

from __future__ import annotations

from typing import Any


SOURCE_LABELS = {"LIVE", "LIVE_SWARM", "LIVE_ENGINE", "MIXED", "FALLBACK", "DEMO"}


def quality_gate(brief: dict[str, Any]) -> dict[str, Any]:
    blocking: list[str] = []
    warnings: list[str] = []
    label = brief.get("source_label")
    if label not in SOURCE_LABELS:
        blocking.append("source_label_required")
    if label == "DEMO":
        blocking.append("demo_cannot_enter_real_decision")
    if label == "FALLBACK":
        blocking.append(
            "fallback_cannot_enter_real_decision"
            if brief.get("missing_evidence")
            else "no_fallback_final_certainty"
        )
    if brief.get("missing_evidence"):
        blocking.append("missing_evidence_requires_resolution")
    if not brief.get("evidence_chain") and not brief.get("missing_evidence"):
        blocking.append("evidence_or_gap_required")
    if any(
        risk.get("requires_human_confirmation")
        for risk in brief.get("risk_register", [])
    ):
        warnings.append("high_risk_requires_human_confirmation")
    if brief.get("conflict_summary"):
        warnings.append("conflict_visible")
    if not brief.get("recommended_next_action"):
        blocking.append("one_primary_action_required")
    return {
        "passed": not blocking,
        "blocking_reasons": blocking,
        "warnings": warnings,
        "revised_output": brief,
    }
