"""Pure public projection for a durable evidence-rework OutboxEvent."""

from __future__ import annotations

from typing import Protocol

from pydantic import ValidationError

from src.contracts.evidence_rework_generation import (
    EvidenceReworkGenerationPayloadV1,
    EvidenceReworkMissionIdentityMissing,
    load_durable_evidence_rework_generation,
    validate_durable_evidence_rework_envelope,
)


class EvidenceReworkEvent(Protocol):
    id: str
    generation: int | None
    status: str
    payload_json: str | None
    last_error: str | None


class EvidenceReworkUnavailable(ValueError):
    """A valid durable terminal state that cannot produce a successful replay."""


def project_evidence_rework_generation(
    event: EvidenceReworkEvent,
) -> EvidenceReworkGenerationPayloadV1:
    """Map durable execution state to the one public domain contract.

    Durable worker states never leak into ``EvidenceReworkGenerationV1``.
    Legal terminal failures are conflicts; impossible state combinations are
    invariant corruption and deliberately remain server errors.
    """

    durable_status = event.status
    if durable_status in {"failed", "dead_letter", "superseded"}:
        detail = f": {event.last_error}" if event.last_error else ""
        raise EvidenceReworkUnavailable(
            f"补证 generation {durable_status}{detail}"
        )

    try:
        generation = load_durable_evidence_rework_generation(
            event.payload_json or "{}"
        )
    except EvidenceReworkMissionIdentityMissing as exc:
        try:
            validate_durable_evidence_rework_envelope(
                exc.generation,
                event_id=event.id,
                event_generation=event.generation,
                durable_status=durable_status,
            )
        except ValueError as envelope_error:
            raise RuntimeError(
                "evidence rework invariant: durable envelope mismatch"
            ) from envelope_error
        raise EvidenceReworkUnavailable(
            "补证 generation missing mission identity"
        ) from exc
    except ValidationError as exc:
        raise RuntimeError(
            "evidence rework invariant: durable row contains an invalid payload"
        ) from exc
    try:
        validate_durable_evidence_rework_envelope(
            generation,
            event_id=event.id,
            event_generation=event.generation,
            durable_status=durable_status,
        )
    except ValueError as envelope_error:
        raise RuntimeError(
            "evidence rework invariant: durable envelope mismatch"
        ) from envelope_error
    payload_status = generation.status

    if durable_status == "awaiting_evidence":
        if payload_status != "awaiting_evidence":
            raise RuntimeError(
                "evidence rework invariant: awaiting_evidence durable row "
                f"contains {payload_status!r}"
            )
        return generation

    if durable_status in {"evidence_bound", "pending"}:
        if payload_status not in {"evidence_bound", "pending"}:
            raise RuntimeError(
                "evidence rework invariant: queued durable row contains "
                f"{payload_status!r}"
            )
        return generation

    if durable_status == "processing":
        if payload_status not in {"evidence_bound", "pending"}:
            raise RuntimeError(
                "evidence rework invariant: processing durable row contains "
                f"{payload_status!r}"
            )
        return generation.model_copy(update={"status": "pending"})

    if durable_status == "completed":
        if payload_status not in {"candidate_ready", "quality_blocked"}:
            raise RuntimeError(
                "evidence rework invariant: completed durable row contains "
                f"{payload_status!r}"
            )
        return generation

    raise RuntimeError(
        f"evidence rework invariant: unknown durable status {durable_status!r}"
    )
