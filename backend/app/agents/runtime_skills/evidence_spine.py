"""Server-owned decree authority helpers for the Six Ministry evidence spine.

The only public decision exchange lives in
``six_ministry_evidence_service.resolve_six_ministry_decision``.  This module
intentionally contains no second intent, evidence-resolution, or decision
envelope API; it only reloads the committed decree scope needed by that
service and other internal adapters.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from enum import StrEnum
from typing import Literal, Protocol

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictStr,
    field_validator,
)

from app.agents.chancellor_draft.routing import (
    ApprovedRouteSnapshot,
    validate_route_snapshot,
)
from app.decree_jobs.models import AcceptedDecreeJob, DecreeJob
from app.decree_jobs.storage import JobNotFound


class EvidenceSpineErrorCode(StrEnum):
    """Stable machine codes; messages intentionally do not disclose ownership."""

    NOT_FOUND_OR_NOT_AUTHORIZED = "not_found_or_not_authorized"
    AUTHORITY_SNAPSHOT_INVALID = "authority_snapshot_invalid"
    CASE_BINDING_UNAVAILABLE = "case_binding_unavailable"


class EvidenceSpineError(RuntimeError):
    """Fail-closed boundary error with a stable, sanitized machine code."""

    def __init__(self, code: EvidenceSpineErrorCode) -> None:
        self.code = code
        super().__init__(code.value)


class _FrozenContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


def _required_text(value: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError("value_must_be_nonblank")
    return normalized


def _required_identifier(value: str) -> str:
    if not value or value != value.strip() or any(
        character.isspace() for character in value
    ):
        raise ValueError("identifier_must_be_nonblank_and_whitespace_free")
    return value


def _json_value(value: object) -> object:
    if isinstance(value, Mapping):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def _digest(value: object) -> str:
    canonical = json.dumps(
        _json_value(value),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def route_snapshot_digest(snapshot: ApprovedRouteSnapshot) -> str:
    """Return the canonical digest used by decree, case, and evidence bindings."""

    validated = validate_route_snapshot(snapshot)
    return _digest(validated.model_dump(mode="json"))


class RunLocatorV1(_FrozenContract):
    """Untrusted locator only; owner and decree identity are server-derived."""

    job_id: StrictStr
    case_id: StrictStr | None = None

    @field_validator("job_id")
    @classmethod
    def _job_id(cls, value: str) -> str:
        return _required_identifier(value)

    @field_validator("case_id")
    @classmethod
    def _case_id(cls, value: str | None) -> str | None:
        return None if value is None else _required_identifier(value)


class ExecutionScopeV1(_FrozenContract):
    """Server-reloaded owner-only scope for the current tenancy model."""

    scope_mode: Literal["owner_only"] = "owner_only"
    tenant_id: Literal[None] = None
    owner_user_id: StrictStr
    run_id: StrictStr
    decree_id: StrictStr
    case_id: StrictStr | None = None
    draft_fingerprint: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    route_digest: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    binding_digest: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")

    @field_validator("owner_user_id", "run_id", "decree_id")
    @classmethod
    def _identifiers(cls, value: str) -> str:
        return _required_identifier(value)

    @field_validator("case_id")
    @classmethod
    def _optional_identifier(cls, value: str | None) -> str | None:
        return None if value is None else _required_identifier(value)


class BoundDecreeAuthority(_FrozenContract):
    """Committed decree scope and validated immutable approved route."""

    scope: ExecutionScopeV1
    route: ApprovedRouteSnapshot
    decree_text: StrictStr

    @field_validator("decree_text")
    @classmethod
    def _decree_text(cls, value: str) -> str:
        return _required_text(value)


class DecreeJobReader(Protocol):
    """Port for the existing owner-scoped decree authority store."""

    def get_for_owner(self, job_id: str, owner_user_id: str) -> DecreeJob: ...

    def lookup_replay(
        self,
        *,
        owner_user_id: str,
        idempotency_key: str,
        request_hash: str,
    ) -> AcceptedDecreeJob | None: ...


def load_bound_decree_authority(
    reader: DecreeJobReader,
    *,
    authenticated_owner_user_id: str,
    run_locator: RunLocatorV1,
) -> BoundDecreeAuthority:
    """Reload one committed, owner-scoped decree and its immutable route."""

    owner_user_id = _required_identifier(authenticated_owner_user_id)
    try:
        job = reader.get_for_owner(run_locator.job_id, owner_user_id)
    except JobNotFound as exc:
        raise EvidenceSpineError(
            EvidenceSpineErrorCode.NOT_FOUND_OR_NOT_AUTHORIZED
        ) from exc
    committed = reader.lookup_replay(
        owner_user_id=owner_user_id,
        idempotency_key=job.idempotency_key,
        request_hash=job.request_hash,
    )
    if committed is None or committed.job.job_id != job.job_id:
        raise EvidenceSpineError(
            EvidenceSpineErrorCode.NOT_FOUND_OR_NOT_AUTHORIZED
        )
    if run_locator.case_id is not None:
        raise EvidenceSpineError(EvidenceSpineErrorCode.CASE_BINDING_UNAVAILABLE)

    try:
        raw_authority = json.loads(job.approved_route_json)
        if not isinstance(raw_authority, dict) or set(raw_authority) != {
            "approved_route",
            "accounting_context",
        }:
            raise ValueError("invalid authority snapshot shape")
        route = validate_route_snapshot(
            ApprovedRouteSnapshot.model_validate(raw_authority["approved_route"])
        )
        if not job.draft_fingerprint or len(job.draft_fingerprint) != 64:
            raise ValueError("invalid draft fingerprint")
        int(job.draft_fingerprint, 16)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise EvidenceSpineError(
            EvidenceSpineErrorCode.AUTHORITY_SNAPSHOT_INVALID
        ) from exc

    route_digest = route_snapshot_digest(route)
    binding = {
        "v": 1,
        "scope_mode": "owner_only",
        "tenant_id": None,
        "owner_user_id": owner_user_id,
        "run_id": job.job_id,
        "decree_id": job.job_id,
        "case_id": None,
        "draft_fingerprint": job.draft_fingerprint,
        "route_digest": route_digest,
    }
    return BoundDecreeAuthority(
        scope=ExecutionScopeV1(
            owner_user_id=owner_user_id,
            run_id=job.job_id,
            decree_id=job.job_id,
            draft_fingerprint=job.draft_fingerprint,
            route_digest=route_digest,
            binding_digest=_digest(binding),
        ),
        route=route,
        decree_text=job.decree_text,
    )


__all__ = [
    "BoundDecreeAuthority",
    "EvidenceSpineError",
    "EvidenceSpineErrorCode",
    "ExecutionScopeV1",
    "RunLocatorV1",
    "load_bound_decree_authority",
    "route_snapshot_digest",
]
