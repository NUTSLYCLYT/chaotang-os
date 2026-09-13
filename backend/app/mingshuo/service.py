"""Authenticated application service for immutable Mingshuo fact-pack revisions."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

from app.auth.models import AuthenticatedPrincipal
from app.mingshuo import fact_pack, storage
from app.mingshuo.models import CreateProjectRequest, DraftRequest, RevisionRequest

EVALUATOR_POLICY_VERSION = "mingshuo.fact-pack.validation.v1"
REQUEST_STATE_CONTRACT_VERSION = "mingshuo.request-state.v1"


class MingshuoValidationError(RuntimeError):
    """A validated request could not form an accepted domain projection."""


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


__all__ = [
    "MingshuoValidationError",
    "append_revision",
    "create_draft_request",
    "create_project",
    "get_project",
]
