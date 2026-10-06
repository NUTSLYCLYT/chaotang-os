"""Authenticated application service for immutable Mingshuo fact-pack revisions."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

from app.accounting_reports.models import ReportPeriod
from app.accounting_reports.storage import (
    ArtifactNotFound,
    ArtifactStorage,
    ArtifactStorageError,
)
from app.auth.models import AuthenticatedPrincipal
from app.mingshuo import delivery, fact_pack, storage
from app.mingshuo.models import CreateProjectRequest, DraftRequest, RevisionRequest
from app.work_products import WorkProductEnvelope, semantic_digest

EVALUATOR_POLICY_VERSION = "mingshuo.fact-pack.validation.v1"
REQUEST_STATE_CONTRACT_VERSION = "mingshuo.request-state.v1"
_DELIVERY_LOCKS = tuple(threading.Lock() for _ in range(64))


class MingshuoValidationError(RuntimeError):
    """A validated request could not form an accepted domain projection."""


def _artifact_storage() -> ArtifactStorage:
    return ArtifactStorage()


def _utc_day() -> date:
    return datetime.now(UTC).date()


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _digest_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def _dump(value: Any) -> str:
    return _canonical_bytes(value).decode("utf-8")


def _load(value: str) -> Any:
    result = json.loads(value)
    _canonical_bytes(result)
    return result


def _request_payload_digest(payload: CreateProjectRequest | RevisionRequest) -> str:
    return _digest_bytes(_canonical_bytes(payload.model_dump(mode="json", by_alias=True)))


def _fingerprint(
    *,
    operation: str,
    principal: AuthenticatedPrincipal,
    project_id: str,
    fact_pack_version: int,
    fact_pack_digest: str,
    request_payload_digest: str,
) -> str:
    return _digest_bytes(
        _canonical_bytes(
            {
                "factPackDigest": fact_pack_digest,
                "factPackVersion": fact_pack_version,
                "operation": operation,
                "ownerUserId": principal.id,
                "projectId": project_id,
                "requestPayloadDigest": request_payload_digest,
                "requestStateContractVersion": REQUEST_STATE_CONTRACT_VERSION,
                "tenantId": principal.tenant_id,
            }
        )
    )


def _item_list(items: list[Any]) -> list[dict[str, Any]]:
    return [item.model_dump(mode="json", by_alias=True) for item in items]


def _build_pack(
    payload: CreateProjectRequest | RevisionRequest,
    principal: AuthenticatedPrincipal,
    *,
    project_id: str,
    project_name: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": fact_pack.SCHEMA_VERSION,
        "tenant": {"id": principal.tenant_id, "ownerUserId": principal.id},
        "project": {
            "id": project_id,
            "name": project_name,
            "productLines": list(payload.product_lines),
            "markets": list(payload.markets),
            "languages": list(payload.languages),
            "status": "READY_FOR_REVIEW",
        },
        "skuCandidates": _item_list(payload.sku_candidates),
        "sourcePolicy": {
            "finalTruthSource": "COURTOS_SERVER_EVIDENCE_BINDING",
            "imaMode": "UNAVAILABLE",
            "externalModelMode": "DISABLED",
            "knowledgePromotion": "CANDIDATE_ONLY",
        },
        "evidence": _item_list(payload.evidence),
        "facts": _item_list(payload.facts),
        "claims": [
            {**item.model_dump(mode="json", by_alias=True), "approvalStatus": "DRAFT"}
            for item in payload.claims
        ],
        "commercial": {
            "priceAuthority": {"status": "MISSING", "approver": None},
            "quoteStatus": "DRAFT" if payload.quote_requested else "NOT_REQUESTED",
        },
        "channels": [
            {"id": item.id, "state": "DRAFT", "publicationAuthorized": False}
            for item in payload.channels
        ],
        "safety": {"dangerousOperationalInstructionsPresent": False},
        "knowledgeWriteBack": {"status": "CANDIDATE_ONLY"},
        "businessSuccessMeasured": False,
        "productionPromotionAuthorized": False,
    }


def _evaluate(pack: dict[str, Any], day: date) -> tuple[bytes, str, dict[str, Any]]:
    canonical = fact_pack.canonical_fact_pack_bytes(pack)
    digest = fact_pack.fact_pack_digest(pack)
    result = fact_pack.evaluate_pack(pack, now=day.isoformat())
    if result["decision"] == "STOP" or any(
        result[key] is None for key in ("evidenceDigest", "factDigest", "claimDigest")
    ):
        raise MingshuoValidationError("fact pack projection invalid")
    return canonical, digest, result


def _identity_row(
    connection: sqlite3.Connection, principal: AuthenticatedPrincipal, request_key: str
) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM mingshuo_idempotency_keys "
        "WHERE tenant_id=? AND owner_user_id=? AND request_key=?",
        (principal.tenant_id, principal.id, request_key),
    ).fetchone()


def _project_row(
    connection: sqlite3.Connection, principal: AuthenticatedPrincipal, project_id: str
) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM mingshuo_projects WHERE tenant_id=? AND owner_user_id=? AND project_id=?",
        (principal.tenant_id, principal.id, project_id),
    ).fetchone()


def _verified_revision(row: sqlite3.Row) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        canonical = bytes(row["canonical_bytes"])
        pack = json.loads(canonical.decode("utf-8"))
        if fact_pack.canonical_fact_pack_bytes(pack) != canonical:
            raise ValueError("canonical bytes drift")
        if fact_pack.fact_pack_digest(pack) != row["fact_pack_digest"]:
            raise ValueError("fact pack digest drift")
        evaluated_day = date.fromisoformat(row["evaluated_utc_day"])
        result = fact_pack.evaluate_pack(pack, now=evaluated_day.isoformat())
        expected = {
            "decision": row["decision"],
            "errors": _load(row["errors_json"]),
            "holdReasons": _load(row["hold_reasons_json"]),
            "blockReasons": _load(row["block_reasons_json"]),
            "evidenceDigest": row["evidence_digest"],
            "factDigest": row["fact_digest"],
            "claimDigest": row["claim_digest"],
        }
        if any(result[key] != value for key, value in expected.items()):
            raise ValueError("stored evaluation drift")
        if row["evaluator_policy_version"] != EVALUATOR_POLICY_VERSION:
            raise ValueError("evaluator policy drift")
        if row["schema_policy_version"] != fact_pack.SCHEMA_VERSION:
            raise ValueError("schema policy drift")
        return pack, result
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def _fact_pack_json(row: sqlite3.Row, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": int(row["version"]),
        "factPackDigest": row["fact_pack_digest"],
        "decision": result["decision"],
        "nonAuthorizing": True,
        "errors": result["errors"],
        "holdReasons": result["holdReasons"],
        "blockReasons": result["blockReasons"],
        "evidenceDigest": result["evidenceDigest"],
        "factDigest": result["factDigest"],
        "claimDigest": result["claimDigest"],
        "evaluatedUtcDay": row["evaluated_utc_day"],
    }


def _snapshot(
    connection: sqlite3.Connection, principal: AuthenticatedPrincipal, project_id: str
) -> dict[str, Any]:
    project = _project_row(connection, principal, project_id)
    if project is None:
        raise storage.MingshuoNotFoundError("not found")
    rows = connection.execute(
        "SELECT r.revision,r.requirements_revision_id,r.requirements_text,r.requirements_digest,"
        "r.created_at AS requirements_created_at,f.* "
        "FROM mingshuo_requirement_revisions r "
        "JOIN mingshuo_fact_pack_revisions f "
        "ON f.tenant_id=r.tenant_id AND f.owner_user_id=r.owner_user_id "
        "AND f.project_id=r.project_id AND f.requirements_revision_id=r.requirements_revision_id "
        "WHERE r.tenant_id=? AND r.owner_user_id=? AND r.project_id=? ORDER BY r.revision",
        (principal.tenant_id, principal.id, project_id),
    ).fetchall()
    revisions: list[dict[str, Any]] = []
    for row in rows:
        pack, result = _verified_revision(row)
        if (
            pack["tenant"] != {"id": principal.tenant_id, "ownerUserId": principal.id}
            or pack["project"]["id"] != project_id
            or pack["project"]["name"] != project["project_name"]
            or pack["project"]["productLines"] != _load(project["product_lines_json"])
            or pack["project"]["markets"] != _load(project["markets_json"])
            or pack["project"]["languages"] != _load(project["languages_json"])
            or _digest_bytes(row["requirements_text"].encode("utf-8")) != row["requirements_digest"]
        ):
            raise storage.MingshuoStorageError("unavailable")
        revisions.append(
            {
                "revision": int(row["revision"]),
                "requirementsRevisionId": row["requirements_revision_id"],
                "requirementsText": row["requirements_text"],
                "requirementsDigest": row["requirements_digest"],
                "factPack": _fact_pack_json(row, result),
                "createdAt": row["requirements_created_at"],
            }
        )
    if len(revisions) != int(project["current_revision"]) or [
        item["revision"] for item in revisions
    ] != list(range(1, len(revisions) + 1)):
        raise storage.MingshuoStorageError("unavailable")
    draft_rows = connection.execute(
        "SELECT draft_request_id,fact_pack_version,fact_pack_digest,status,created_at "
        "FROM mingshuo_draft_requests WHERE tenant_id=? AND owner_user_id=? AND project_id=? "
        "ORDER BY created_at,draft_request_id",
        (principal.tenant_id, principal.id, project_id),
    ).fetchall()
    draft_requests = [
        {
            "draftRequestId": row["draft_request_id"],
            "factPackVersion": int(row["fact_pack_version"]),
            "factPackDigest": row["fact_pack_digest"],
            "status": row["status"],
            "createdAt": row["created_at"],
        }
        for row in draft_rows
    ]
    return {
        "projectId": project_id,
        "projectName": project["project_name"],
        "productLines": _load(project["product_lines_json"]),
        "markets": _load(project["markets_json"]),
        "languages": _load(project["languages_json"]),
        "currentRevision": int(project["current_revision"]),
        "currentFactPack": revisions[-1]["factPack"],
        "revisions": revisions,
        "draftRequests": draft_requests,
        "createdAt": project["created_at"],
        "updatedAt": project["updated_at"],
    }


def _insert_revision(
    connection: sqlite3.Connection,
    principal: AuthenticatedPrincipal,
    *,
    project_id: str,
    version: int,
    payload: CreateProjectRequest | RevisionRequest,
    canonical: bytes,
    pack_digest: str,
    result: dict[str, Any],
    day: date,
    timestamp: str,
) -> tuple[str, str]:
    requirements_revision_id = uuid.uuid4().hex
    fact_pack_revision_id = uuid.uuid4().hex
    requirements_digest = _digest_bytes(payload.requirements_text.encode("utf-8"))
    connection.execute(
        "INSERT INTO mingshuo_requirement_revisions VALUES (?,?,?,?,?,?,?,?)",
        (
            requirements_revision_id,
            principal.tenant_id,
            principal.id,
            project_id,
            version,
            payload.requirements_text,
            requirements_digest,
            timestamp,
        ),
    )
    connection.execute(
        "INSERT INTO mingshuo_fact_pack_revisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            fact_pack_revision_id,
            principal.tenant_id,
            principal.id,
            project_id,
            version,
            requirements_revision_id,
            canonical,
            pack_digest,
            result["decision"],
            _dump(result["errors"]),
            _dump(result["holdReasons"]),
            _dump(result["blockReasons"]),
            result["evidenceDigest"],
            result["factDigest"],
            result["claimDigest"],
            day.isoformat(),
            EVALUATOR_POLICY_VERSION,
            fact_pack.SCHEMA_VERSION,
            timestamp,
        ),
    )
    return requirements_revision_id, fact_pack_revision_id


def _insert_idempotency(
    connection: sqlite3.Connection,
    principal: AuthenticatedPrincipal,
    *,
    request_key: str,
    operation: str,
    project_id: str,
    version: int,
    pack_digest: str,
    fingerprint: str,
    result_kind: str,
    result_id: str,
    timestamp: str,
) -> None:
    connection.execute(
        "INSERT INTO mingshuo_idempotency_keys VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (
            principal.tenant_id,
            principal.id,
            request_key,
            operation,
            project_id,
            version,
            pack_digest,
            fingerprint,
            result_kind,
            result_id,
            timestamp,
        ),
    )


def create_project(
    payload: CreateProjectRequest,
    principal: AuthenticatedPrincipal,
    *,
    serialize: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    request_digest = _request_payload_digest(payload)
    try:
        with storage.write_transaction() as connection:
            existing = _identity_row(connection, principal, payload.request_key)
            if existing is not None:
                project_id = str(existing["project_id"])
                pack = _build_pack(
                    payload, principal, project_id=project_id, project_name=payload.project_name
                )
                _, pack_digest, _ = _evaluate(pack, _utc_day())
                fingerprint = _fingerprint(
                    operation="CREATE_PROJECT",
                    principal=principal,
                    project_id=project_id,
                    fact_pack_version=int(existing["fact_pack_version"]),
                    fact_pack_digest=pack_digest,
                    request_payload_digest=request_digest,
                )
                if (
                    existing["operation"] != "CREATE_PROJECT"
                    or existing["request_fingerprint"] != fingerprint
                    or existing["fact_pack_digest"] != pack_digest
                ):
                    raise storage.MingshuoConflictError("conflict")
                return serialize(
                    {"created": False, "project": _snapshot(connection, principal, project_id)}
                ), False

            project_id = uuid.uuid4().hex
            day = _utc_day()
            pack = _build_pack(
                payload, principal, project_id=project_id, project_name=payload.project_name
            )
            canonical, pack_digest, result = _evaluate(pack, day)
            timestamp = _now_iso()
            connection.execute(
                "INSERT INTO mingshuo_projects VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    project_id,
                    principal.tenant_id,
                    principal.id,
                    payload.project_name,
                    _dump(payload.product_lines),
                    _dump(payload.markets),
                    _dump(payload.languages),
                    1,
                    timestamp,
                    timestamp,
                ),
            )
            _, revision_id = _insert_revision(
                connection,
                principal,
                project_id=project_id,
                version=1,
                payload=payload,
                canonical=canonical,
                pack_digest=pack_digest,
                result=result,
                day=day,
                timestamp=timestamp,
            )
            fingerprint = _fingerprint(
                operation="CREATE_PROJECT",
                principal=principal,
                project_id=project_id,
                fact_pack_version=1,
                fact_pack_digest=pack_digest,
                request_payload_digest=request_digest,
            )
            _insert_idempotency(
                connection,
                principal,
                request_key=payload.request_key,
                operation="CREATE_PROJECT",
                project_id=project_id,
                version=1,
                pack_digest=pack_digest,
                fingerprint=fingerprint,
                result_kind="FACT_PACK_REVISION",
                result_id=revision_id,
                timestamp=timestamp,
            )
            return serialize(
                {"created": True, "project": _snapshot(connection, principal, project_id)}
            ), True
    except storage.MingshuoConflictError:
        raise
    except (sqlite3.Error, OSError, TypeError, ValueError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def append_revision(
    project_id: str,
    payload: RevisionRequest,
    principal: AuthenticatedPrincipal,
    *,
    serialize: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    request_digest = _request_payload_digest(payload)
    try:
        with storage.write_transaction() as connection:
            project = _project_row(connection, principal, project_id)
            if project is None:
                raise storage.MingshuoNotFoundError("not found")
            if (
                _load(project["product_lines_json"]) != payload.product_lines
                or _load(project["markets_json"]) != payload.markets
                or _load(project["languages_json"]) != payload.languages
            ):
                raise storage.MingshuoConflictError("conflict")
            existing = _identity_row(connection, principal, payload.request_key)
            if existing is not None:
                version = int(existing["fact_pack_version"])
                pack = _build_pack(
                    payload,
                    principal,
                    project_id=project_id,
                    project_name=str(project["project_name"]),
                )
                _, pack_digest, _ = _evaluate(pack, _utc_day())
                fingerprint = _fingerprint(
                    operation="APPEND_REVISION",
                    principal=principal,
                    project_id=project_id,
                    fact_pack_version=version,
                    fact_pack_digest=pack_digest,
                    request_payload_digest=request_digest,
                )
                if (
                    existing["operation"] != "APPEND_REVISION"
                    or existing["project_id"] != project_id
                    or existing["request_fingerprint"] != fingerprint
                    or existing["fact_pack_digest"] != pack_digest
                ):
                    raise storage.MingshuoConflictError("conflict")
                return serialize(
                    {"created": False, "project": _snapshot(connection, principal, project_id)}
                ), False
            version = int(project["current_revision"]) + 1
            if version > 64:
                raise storage.MingshuoConflictError("revision limit")
            day = _utc_day()
            pack = _build_pack(
                payload,
                principal,
                project_id=project_id,
                project_name=str(project["project_name"]),
            )
            canonical, pack_digest, result = _evaluate(pack, day)
            timestamp = _now_iso()
            _, revision_id = _insert_revision(
                connection,
                principal,
                project_id=project_id,
                version=version,
                payload=payload,
                canonical=canonical,
                pack_digest=pack_digest,
                result=result,
                day=day,
                timestamp=timestamp,
            )
            connection.execute(
                "UPDATE mingshuo_projects SET current_revision=?,updated_at=? "
                "WHERE tenant_id=? AND owner_user_id=? AND project_id=? AND current_revision=?",
                (version, timestamp, principal.tenant_id, principal.id, project_id, version - 1),
            )
            fingerprint = _fingerprint(
                operation="APPEND_REVISION",
                principal=principal,
                project_id=project_id,
                fact_pack_version=version,
                fact_pack_digest=pack_digest,
                request_payload_digest=request_digest,
            )
            _insert_idempotency(
                connection,
                principal,
                request_key=payload.request_key,
                operation="APPEND_REVISION",
                project_id=project_id,
                version=version,
                pack_digest=pack_digest,
                fingerprint=fingerprint,
                result_kind="FACT_PACK_REVISION",
                result_id=revision_id,
                timestamp=timestamp,
            )
            return serialize(
                {"created": True, "project": _snapshot(connection, principal, project_id)}
            ), True
    except (storage.MingshuoConflictError, storage.MingshuoNotFoundError):
        raise
    except (sqlite3.Error, OSError, TypeError, ValueError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def get_project(
    project_id: str,
    principal: AuthenticatedPrincipal,
    *,
    serialize: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    try:
        with storage.read_connection() as connection:
            return serialize({"project": _snapshot(connection, principal, project_id)})
    except storage.MingshuoNotFoundError:
        raise
    except (sqlite3.Error, OSError, TypeError, ValueError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def create_draft_request(
    project_id: str,
    payload: DraftRequest,
    principal: AuthenticatedPrincipal,
    *,
    serialize: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    try:
        with storage.write_transaction() as connection:
            project = _project_row(connection, principal, project_id)
            if project is None:
                raise storage.MingshuoNotFoundError("not found")
            current_version = int(project["current_revision"])
            row = connection.execute(
                "SELECT * FROM mingshuo_fact_pack_revisions "
                "WHERE tenant_id=? AND owner_user_id=? AND project_id=? AND version=?",
                (principal.tenant_id, principal.id, project_id, current_version),
            ).fetchone()
            if row is None:
                raise storage.MingshuoStorageError("unavailable")
            pack, stored_result = _verified_revision(row)
            day = _utc_day()
            evaluated_day = date.fromisoformat(row["evaluated_utc_day"])
            if day < evaluated_day:
                raise storage.MingshuoConflictError("clock rollback")
            if (
                payload.fact_pack_version != current_version
                or payload.fact_pack_digest != row["fact_pack_digest"]
            ):
                raise storage.MingshuoConflictError("stale fact pack")
            current_result = fact_pack.evaluate_pack(pack, now=day.isoformat())
            stable_keys = ("evidenceDigest", "factDigest", "claimDigest")
            if (
                stored_result["decision"] != "PASS"
                or current_result["decision"] != "PASS"
                or any(current_result[key] != stored_result[key] for key in stable_keys)
            ):
                raise storage.MingshuoConflictError("fact pack unavailable for drafting")
            fingerprint = _fingerprint(
                operation="CREATE_DRAFT_REQUEST",
                principal=principal,
                project_id=project_id,
                fact_pack_version=current_version,
                fact_pack_digest=str(row["fact_pack_digest"]),
                request_payload_digest=_digest_bytes(
                    _canonical_bytes(payload.model_dump(mode="json", by_alias=True))
                ),
            )
            existing = _identity_row(connection, principal, payload.request_key)
            if existing is not None:
                if (
                    existing["operation"] != "CREATE_DRAFT_REQUEST"
                    or existing["project_id"] != project_id
                    or existing["request_fingerprint"] != fingerprint
                ):
                    raise storage.MingshuoConflictError("conflict")
                draft = connection.execute(
                    "SELECT * FROM mingshuo_draft_requests "
                    "WHERE tenant_id=? AND owner_user_id=? AND project_id=? AND draft_request_id=?",
                    (principal.tenant_id, principal.id, project_id, existing["result_id"]),
                ).fetchone()
                if draft is None:
                    raise storage.MingshuoStorageError("unavailable")
                return serialize({"created": False, "draftRequest": _draft_json(draft)}), False
            timestamp = _now_iso()
            draft_request_id = uuid.uuid4().hex
            connection.execute(
                "INSERT INTO mingshuo_draft_requests VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    draft_request_id,
                    principal.tenant_id,
                    principal.id,
                    project_id,
                    payload.request_key,
                    fingerprint,
                    current_version,
                    row["fact_pack_digest"],
                    "NON_AUTHORIZING",
                    timestamp,
                ),
            )
            _insert_idempotency(
                connection,
                principal,
                request_key=payload.request_key,
                operation="CREATE_DRAFT_REQUEST",
                project_id=project_id,
                version=current_version,
                pack_digest=str(row["fact_pack_digest"]),
                fingerprint=fingerprint,
                result_kind="DRAFT_REQUEST",
                result_id=draft_request_id,
                timestamp=timestamp,
            )
            draft = connection.execute(
                "SELECT * FROM mingshuo_draft_requests "
                "WHERE tenant_id=? AND owner_user_id=? AND project_id=? AND draft_request_id=?",
                (principal.tenant_id, principal.id, project_id, draft_request_id),
            ).fetchone()
            if draft is None:
                raise storage.MingshuoStorageError("unavailable")
            return serialize({"created": True, "draftRequest": _draft_json(draft)}), True
    except (storage.MingshuoConflictError, storage.MingshuoNotFoundError):
        raise
    except (sqlite3.Error, OSError, TypeError, ValueError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def _draft_json(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "draftRequestId": row["draft_request_id"],
        "projectId": row["project_id"],
        "factPackVersion": int(row["fact_pack_version"]),
        "factPackDigest": row["fact_pack_digest"],
        "status": row["status"],
        "createdAt": row["created_at"],
    }


def _delivery_response(
    product: delivery.DeliveryArtifact,
    *,
    fact_pack_version: int,
    fact_pack_digest: str,
    created: bool,
) -> dict[str, Any]:
    return {
        "created": created,
        "artifactId": product.artifact_id,
        "workProductId": product.work_product_id,
        "factPackVersion": fact_pack_version,
        "factPackDigest": fact_pack_digest,
        "workStatus": product.envelope.work_status.value,
        "confirmationStatus": product.envelope.confirmation_status.value,
        "artifactState": product.envelope.artifact_state.value,
        "nonAuthorizing": True,
    }


def _delivery_response_from_envelope(
    *,
    artifact_id: str,
    envelope: WorkProductEnvelope,
    fact_pack_version: int,
    fact_pack_digest: str,
    created: bool,
) -> dict[str, Any]:
    return {
        "created": created,
        "artifactId": artifact_id,
        "workProductId": envelope.work_product_id,
        "factPackVersion": fact_pack_version,
        "factPackDigest": fact_pack_digest,
        "workStatus": envelope.work_status.value,
        "confirmationStatus": envelope.confirmation_status.value,
        "artifactState": envelope.artifact_state.value,
        "nonAuthorizing": True,
    }


def _expected_replay_envelope(
    product: delivery.DeliveryArtifact, frozen_artifact_sha256: str
) -> WorkProductEnvelope:
    frozen_hex = frozen_artifact_sha256.removeprefix("sha256:")
    if len(frozen_hex) != 64 or any(value not in "0123456789abcdef" for value in frozen_hex):
        raise storage.MingshuoConflictError("conflict")
    manifest = tuple(
        item.model_copy(update={"content_digest": frozen_hex})
        if item.kind == "mingshuo_solution_quote_xlsx"
        else item
        for item in product.envelope.artifact_manifest
    )
    draft = product.envelope.model_copy(
        update={"artifact_manifest": manifest, "content_digest": "0" * 64}
    )
    return draft.model_copy(update={"content_digest": semantic_digest(draft.model_dump())})


def _delivery_lock(
    principal: AuthenticatedPrincipal, project_id: str, draft_request_id: str
) -> threading.Lock:
    identity = f"{principal.tenant_id}\0{principal.id}\0{project_id}\0{draft_request_id}"
    index = int(hashlib.sha256(identity.encode()).hexdigest(), 16) % len(_DELIVERY_LOCKS)
    return _DELIVERY_LOCKS[index]


def _secure_pending_file(store: ArtifactStorage, content: bytes, expected_sha256: str):
    name = f".{uuid.uuid4().hex}.xlsx"
    path = store.artifact_dir / name
    # Workbooks are opaque ZIP bytes.  Windows otherwise opens the descriptor
    # in text mode and transparently rewrites ``\n`` to ``\r\n``, which makes
    # the persisted hash differ from the producer hash.
    flags = os.O_RDWR | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags, 0o600)
    try:
        view = memoryview(content)
        offset = 0
        while offset < len(view):
            offset += os.write(descriptor, view[offset:])
        os.fsync(descriptor)
        os.lseek(descriptor, 0, os.SEEK_SET)
        digest = hashlib.sha256()
        while chunk := os.read(descriptor, 1024 * 1024):
            digest.update(chunk)
        if digest.hexdigest() != expected_sha256:
            raise storage.MingshuoStorageError("unavailable")
    except Exception:
        os.close(descriptor)
        path.unlink(missing_ok=True)
        raise
    os.close(descriptor)
    return path


def _transition_delivery_intent(
    principal: AuthenticatedPrincipal,
    draft_request_id: str,
    old_state: str,
    new_state: str,
) -> None:
    try:
        with storage.write_transaction() as connection:
            row = connection.execute(
                "SELECT state,updated_at FROM mingshuo_delivery_intents "
                "WHERE tenant_id=? AND owner_user_id=? AND draft_request_id=?",
                (principal.tenant_id, principal.id, draft_request_id),
            ).fetchone()
            if row is None:
                raise storage.MingshuoStorageError("unavailable")
            state_order = {
                "PREPARED": 0,
                "ARTIFACT_PENDING": 1,
                "WORK_PRODUCT_BOUND": 2,
            }
            if state_order.get(str(row["state"]), -1) >= state_order[new_state]:
                return
            if row["state"] != old_state:
                raise storage.MingshuoConflictError("conflict")
            timestamp = _now_iso()
            if timestamp <= row["updated_at"]:
                raise storage.MingshuoStorageError("unavailable")
            changed = connection.execute(
                "UPDATE mingshuo_delivery_intents SET state=?,updated_at=? "
                "WHERE tenant_id=? AND owner_user_id=? AND draft_request_id=? AND state=?",
                (
                    new_state,
                    timestamp,
                    principal.tenant_id,
                    principal.id,
                    draft_request_id,
                    old_state,
                ),
            ).rowcount
            if changed != 1:
                raise storage.MingshuoConflictError("conflict")
    except (storage.MingshuoConflictError, storage.MingshuoStorageError):
        raise
    except (sqlite3.Error, OSError, TypeError, ValueError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def _create_work_product_unlocked(
    project_id: str,
    draft_request_id: str,
    principal: AuthenticatedPrincipal,
    *,
    serialize: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    """Create or exactly replay one private-bound, non-authorizing delivery."""

    try:
        with storage.write_transaction() as connection:
            row = connection.execute(
                """
                SELECT d.*,f.canonical_bytes,f.decision,f.errors_json,
                       f.hold_reasons_json,f.block_reasons_json,f.evidence_digest,
                       f.fact_digest,f.claim_digest,f.evaluated_utc_day,
                       f.evaluator_policy_version,f.schema_policy_version,
                       r.requirements_text
                FROM mingshuo_draft_requests AS d
                JOIN mingshuo_fact_pack_revisions AS f
                  ON f.tenant_id=d.tenant_id AND f.owner_user_id=d.owner_user_id
                 AND f.project_id=d.project_id AND f.version=d.fact_pack_version
                JOIN mingshuo_requirement_revisions AS r
                  ON r.tenant_id=f.tenant_id AND r.owner_user_id=f.owner_user_id
                 AND r.project_id=f.project_id
                 AND r.requirements_revision_id=f.requirements_revision_id
                WHERE d.tenant_id=? AND d.owner_user_id=?
                  AND d.project_id=? AND d.draft_request_id=?
                """,
                (principal.tenant_id, principal.id, project_id, draft_request_id),
            ).fetchone()
            project = _project_row(connection, principal, project_id)
            if row is None or project is None:
                raise storage.MingshuoNotFoundError("not found")
            if int(project["current_revision"]) != int(row["fact_pack_version"]):
                raise storage.MingshuoConflictError("stale fact pack")
            pack, stored_result = _verified_revision(row)
            day = _utc_day()
            evaluated_day = date.fromisoformat(row["evaluated_utc_day"])
            if day < evaluated_day:
                raise storage.MingshuoConflictError("clock rollback")
            current_result = fact_pack.evaluate_pack(pack, now=day.isoformat())
            stable = ("evidenceDigest", "factDigest", "claimDigest")
            if (
                row["status"] != "NON_AUTHORIZING"
                or row["fact_pack_digest"] != fact_pack.fact_pack_digest(pack)
                or stored_result["decision"] != "PASS"
                or current_result["decision"] != "PASS"
                or any(current_result[key] != stored_result[key] for key in stable)
            ):
                raise storage.MingshuoConflictError("fact pack unavailable")
            product = delivery.build_delivery_artifact(
                pack=pack,
                evaluation=current_result,
                requirements_text=str(row["requirements_text"]),
                tenant_id=principal.tenant_id,
                owner_user_id=principal.id,
                project_id=project_id,
                draft_request_id=draft_request_id,
                fact_pack_version=int(row["fact_pack_version"]),
                fact_pack_digest=str(row["fact_pack_digest"]),
                created_at=datetime.fromisoformat(str(row["created_at"])),
            )
            frozen = {
                "tenant_id": principal.tenant_id,
                "owner_user_id": principal.id,
                "project_id": project_id,
                "fact_pack_version": int(row["fact_pack_version"]),
                "fact_pack_digest": str(row["fact_pack_digest"]),
                "binding_json": product.binding_json,
                "binding_digest": product.binding_digest,
                "cell_projection_digest": product.cell_projection_digest,
                "artifact_id": product.artifact_id,
                "work_product_id": product.work_product_id,
                "artifact_sha256": product.workbook_sha256,
                "work_product_digest": product.envelope.content_digest,
            }
            existing = connection.execute(
                "SELECT * FROM mingshuo_delivery_intents "
                "WHERE tenant_id=? AND owner_user_id=? AND project_id=? "
                "AND draft_request_id=?",
                (principal.tenant_id, principal.id, project_id, draft_request_id),
            ).fetchone()
            created = existing is None
            if existing is None:
                timestamp = _now_iso()
                connection.execute(
                    """
                    INSERT INTO mingshuo_delivery_intents (
                        draft_request_id,tenant_id,owner_user_id,project_id,
                        fact_pack_version,fact_pack_digest,binding_json,binding_digest,
                        cell_projection_digest,artifact_id,work_product_id,
                        artifact_sha256,work_product_digest,state,created_at,updated_at
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'PREPARED',?,?)
                    """,
                    (
                        draft_request_id,
                        *frozen.values(),
                        timestamp,
                        timestamp,
                    ),
                )
            else:
                stable_keys = (
                    "tenant_id",
                    "owner_user_id",
                    "project_id",
                    "fact_pack_version",
                    "fact_pack_digest",
                    "binding_json",
                    "binding_digest",
                    "cell_projection_digest",
                    "artifact_id",
                    "work_product_id",
                )
                if any(existing[key] != frozen[key] for key in stable_keys):
                    raise storage.MingshuoConflictError("conflict")

        report_store = _artifact_storage()
        source_hashes = (
            str(row["fact_pack_digest"]).removeprefix("sha256:"),
            str(row["evidence_digest"]).removeprefix("sha256:"),
            str(row["fact_digest"]).removeprefix("sha256:"),
            str(row["claim_digest"]).removeprefix("sha256:"),
        )
        period = ReportPeriod(day.year, day.year)
        if not created:
            expected_envelope = _expected_replay_envelope(
                product, str(existing["artifact_sha256"])
            )
            if (
                expected_envelope.content_digest != existing["work_product_digest"]
                or expected_envelope.work_product_id != existing["work_product_id"]
            ):
                raise storage.MingshuoConflictError("conflict")
            report_store.verify_pending_identity(
                artifact_id=str(existing["artifact_id"]),
                owner_user_id=principal.id,
                run_id=draft_request_id,
                report_type=delivery.REPORT_TYPE,
                display_name=delivery.DISPLAY_NAME,
                period=period,
                source_hashes=source_hashes,
                file_sha256=str(existing["artifact_sha256"]).removeprefix("sha256:"),
            )
            stored_envelope = report_store.get_work_product_for_artifact(
                principal.id, str(existing["artifact_id"])
            )
            if stored_envelope != expected_envelope:
                raise storage.MingshuoConflictError("conflict")
            report_store.create_or_verify_work_product(
                principal.id, str(existing["artifact_id"]), expected_envelope
            )
            state = str(existing["state"])
            if state == "PREPARED":
                _transition_delivery_intent(
                    principal, draft_request_id, "PREPARED", "ARTIFACT_PENDING"
                )
                state = "ARTIFACT_PENDING"
            if state == "ARTIFACT_PENDING":
                _transition_delivery_intent(
                    principal,
                    draft_request_id,
                    "ARTIFACT_PENDING",
                    "WORK_PRODUCT_BOUND",
                )
            elif state != "WORK_PRODUCT_BOUND":
                raise storage.MingshuoConflictError("conflict")
            response = _delivery_response_from_envelope(
                artifact_id=str(existing["artifact_id"]),
                envelope=expected_envelope,
                fact_pack_version=int(row["fact_pack_version"]),
                fact_pack_digest=str(row["fact_pack_digest"]),
                created=False,
            )
            return serialize(response), False

        pending_path = _secure_pending_file(
            report_store,
            product.workbook_bytes,
            product.workbook_sha256.removeprefix("sha256:"),
        )
        try:
            report_store.create_or_verify_pending(
                artifact_id=product.artifact_id,
                owner_user_id=principal.id,
                run_id=draft_request_id,
                report_type=delivery.REPORT_TYPE,
                display_name=delivery.DISPLAY_NAME,
                period=period,
                source_hashes=source_hashes,
                file_sha256=product.workbook_sha256.removeprefix("sha256:"),
                pending_path=pending_path,
            )
        finally:
            pending_path.unlink(missing_ok=True)
        _transition_delivery_intent(
            principal, draft_request_id, "PREPARED", "ARTIFACT_PENDING"
        )
        report_store.create_or_verify_work_product(
            principal.id, product.artifact_id, product.envelope
        )
        _transition_delivery_intent(
            principal, draft_request_id, "ARTIFACT_PENDING", "WORK_PRODUCT_BOUND"
        )
        response = _delivery_response(
            product,
            fact_pack_version=int(row["fact_pack_version"]),
            fact_pack_digest=str(row["fact_pack_digest"]),
            created=created,
        )
        return serialize(response), created
    except (storage.MingshuoConflictError, storage.MingshuoNotFoundError):
        raise
    except ArtifactNotFound as exc:
        raise storage.MingshuoConflictError("conflict") from exc
    except ArtifactStorageError as exc:
        if str(exc) == "artifact_conflict":
            raise storage.MingshuoConflictError("conflict") from exc
        raise storage.MingshuoStorageError("unavailable") from exc
    except delivery.DeliveryValidationError as exc:
        raise storage.MingshuoConflictError("conflict") from exc
    except (sqlite3.Error, OSError, TypeError, ValueError) as exc:
        raise storage.MingshuoStorageError("unavailable") from exc


def create_work_product(
    project_id: str,
    draft_request_id: str,
    principal: AuthenticatedPrincipal,
    *,
    serialize: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    """Serialize one delivery identity and create or exactly replay it."""

    with _delivery_lock(principal, project_id, draft_request_id):
        return _create_work_product_unlocked(
            project_id,
            draft_request_id,
            principal,
            serialize=serialize,
        )


__all__ = [
    "MingshuoValidationError",
    "append_revision",
    "create_draft_request",
    "create_project",
    "create_work_product",
    "get_project",
]
