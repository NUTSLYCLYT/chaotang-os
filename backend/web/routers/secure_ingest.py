"""R0-W03 安全摄取路由(REQ-001/002/019)。tenant 只从 `CurrentUser` 拿,永不信任 body/
query(照抄 `web/routers/chaotang.py::_shiguan_archive_projection` 的租户隔离范式)。
"""

from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timedelta, timezone

import docx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from src.secure_ingest.audit import build_audit_event
from src.secure_ingest.digest import compute_sha256
from src.secure_ingest.download_ticket import hash_token, issue_raw_token
from src.secure_ingest.limits import DOWNLOAD_TICKET_TTL_SECONDS, MAX_DOCX_PAGES, MAX_UPLOAD_BYTES
from src.secure_ingest.mime_sniff import detect_format
from src.secure_ingest.ooxml_structure import inspect_ooxml_structure
from src.secure_ingest.purpose_authz import authorize_body_access
from src.secure_ingest.schema import IngestArtifactV1
from src.secure_ingest.storage import read_artifact_bytes_at_path, write_artifact_bytes
from src.secure_ingest.text_scan import scan_for_injection
from src.tenant import DEFAULT_TENANT_SLUG, resolve_tenant_slug_id
from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/secure-ingest", tags=["secure_ingest"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _owner_id(user: CurrentUser) -> str:
    return str(user.user_id or user.username or user.tenant_slug or "anonymous")


def _resolve_tenant(user: CurrentUser) -> int | None:
    """跟 `_shiguan_archive_projection` 同款:解析不出就返回 None,调用方 fail closed。"""
    tenant_slug = user.tenant_slug or DEFAULT_TENANT_SLUG
    if user.tenant_id is not None:
        return user.tenant_id
    return resolve_tenant_slug_id(tenant_slug)


@router.post("/upload", response_model=IngestArtifactV1)
async def upload_artifact(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> IngestArtifactV1:
    tenant_id = _resolve_tenant(user)
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant 无法解析")

    if "multipart" not in request.headers.get("content-type", ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="需要 multipart/form-data")
    form = await request.form()
    mission_contract_id = str(form.get("mission_contract_id") or "").strip()
    purpose = str(form.get("purpose") or "").strip()
    upload = form.get("file")
    if not mission_contract_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mission_contract_id 不能为空")
    if not purpose:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="purpose 不能为空")
    if upload is None or not hasattr(upload, "read"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="需要 file 字段")

    raw_bytes = await upload.read()
    declared_content_type = getattr(upload, "content_type", None) or ""
    original_filename = getattr(upload, "filename", None) or ""

    artifact_id = str(uuid.uuid4())
    file_size_bytes = len(raw_bytes)
    reject_reason = None
    macro_detected = False
    zip_bomb_suspected = False
    injection_categories: list[str] = []
    page_count: int | None = None

    if file_size_bytes > MAX_UPLOAD_BYTES:
        detected_format = "UNKNOWN"
        reject_reason = "OVERSIZE"
    else:
        detected_format = detect_format(raw_bytes)
        if detected_format == "CORRUPTED":
            reject_reason = "CORRUPTED"
        elif detected_format == "DOCX_ENCRYPTED":
            reject_reason = "ENCRYPTED"
        elif detected_format == "UNKNOWN":
            reject_reason = "FAKE_MIME"
        else:
            structure = inspect_ooxml_structure(raw_bytes)
            macro_detected = structure.macro_detected
            zip_bomb_suspected = structure.zip_bomb_suspected
            page_count = structure.page_count
            if macro_detected:
                reject_reason = "MACRO_DETECTED"
            elif zip_bomb_suspected:
                reject_reason = "ZIP_BOMB_SUSPECTED"
            elif page_count is not None and page_count > MAX_DOCX_PAGES:
                reject_reason = "TOO_MANY_PAGES"
            else:
                # 只有确认是真 DOCX、结构安全时才抽文本做注入扫描——避免对可疑 zip 内容
                # 做更多不必要的处理。抽取文本本身不落库、不落日志，只保留命中的类别名。
                try:
                    document = docx.Document(io.BytesIO(raw_bytes))
                    extracted_text = "\n".join(p.text for p in document.paragraphs)
                except Exception:  # noqa: BLE001 — 解析失败按结构损坏处理，不让异常穿透成 500
                    extracted_text = ""
                    if reject_reason is None:
                        reject_reason = "CORRUPTED"
                if extracted_text:
                    injection_categories = scan_for_injection(extracted_text)
                    if injection_categories:
                        reject_reason = "INJECTION_SUSPECTED"

    digest_sha256 = compute_sha256(raw_bytes)
    ingest_status = "REJECTED" if reject_reason else "ACCEPTED"
    storage_path = ""
    if ingest_status == "ACCEPTED":
        storage_path = str(write_artifact_bytes(user.tenant_slug or DEFAULT_TENANT_SLUG, artifact_id, raw_bytes))

    from src.db.engine import SessionLocal
    from src.db.models import SecureIngestArtifact, SecureIngestAuditEvent

    db = SessionLocal()
    try:
        row = SecureIngestArtifact(
            id=artifact_id,
            tenant_id=tenant_id,
            user_id=_owner_id(user),
            mission_contract_id=mission_contract_id,
            original_filename=original_filename,
            declared_content_type=declared_content_type,
            detected_format=detected_format,
            file_size_bytes=file_size_bytes,
            page_count=page_count,
            digest_sha256=digest_sha256,
            status=ingest_status,
            reject_reason=reject_reason,
            ocr_status="NOT_APPLICABLE",
            macro_detected=macro_detected,
            zip_bomb_suspected=zip_bomb_suspected,
            injection_flag_categories_json=json.dumps(injection_categories),
            storage_path=storage_path,
            created_at=_now_iso(),
        )
        db.add(row)
        event = build_audit_event(
            tenant_id=tenant_id,
            user_id=_owner_id(user),
            event_type="upload",
            task_id=mission_contract_id,
            artifact_id=artifact_id,
            input_digest=digest_sha256,
            purpose=purpose,
        )
        db.add(SecureIngestAuditEvent(id=str(uuid.uuid4()), created_at=_now_iso(), **event))
        db.commit()
    finally:
        db.close()

    return IngestArtifactV1(
        artifact_id=artifact_id,
        mission_contract_id=mission_contract_id,
        status=ingest_status,
        detected_format=detected_format,
        file_size_bytes=file_size_bytes,
        page_count=page_count,
        digest_sha256=digest_sha256,
        ocr_status="NOT_APPLICABLE",
        reject_reason=reject_reason,
        macro_detected=macro_detected,
        zip_bomb_suspected=zip_bomb_suspected,
        injection_flag_categories=injection_categories,
        created_at=_now_iso(),
    )


@router.get("/{artifact_id}/status", response_model=IngestArtifactV1)
def get_artifact_status(
    artifact_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> IngestArtifactV1:
    tenant_id = _resolve_tenant(user)
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    from src.db.engine import SessionLocal
    from src.db.models import SecureIngestArtifact

    db = SessionLocal()
    try:
        row = (
            db.query(SecureIngestArtifact)
            .filter(
                SecureIngestArtifact.id == artifact_id,
                SecureIngestArtifact.tenant_id == tenant_id,
            )
            .one_or_none()
        )
    finally:
        db.close()
    if row is None:
        # 404 而非 403——不向调用方泄漏"这个 id 存在,只是不是你的"。
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return _row_to_artifact(row)


@router.post("/{artifact_id}/ticket")
def issue_ticket(
    artifact_id: str,
    purpose: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    tenant_id = _resolve_tenant(user)
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant 无法解析")

    from src.db.engine import SessionLocal
    from src.db.models import SecureIngestArtifact, SecureIngestAuditEvent, SecureIngestDownloadTicket

    db = SessionLocal()
    try:
        row = (
            db.query(SecureIngestArtifact)
            .filter(
                SecureIngestArtifact.id == artifact_id,
                SecureIngestArtifact.tenant_id == tenant_id,
            )
            .one_or_none()
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
        if row.status != "ACCEPTED":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="artifact not accepted, no body to ticket")

        authz = authorize_body_access(
            user_id=user.user_id,
            role=user.role,
            requester_tenant_id=tenant_id,
            artifact_tenant_id=row.tenant_id,
            purpose=purpose,
        )
        if not authz.allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=authz.deny_reason)

        raw_token = issue_raw_token()
        ticket_id = str(uuid.uuid4())
        issued_at = _now_iso()
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=DOWNLOAD_TICKET_TTL_SECONDS)
        ).isoformat()
        db.add(
            SecureIngestDownloadTicket(
                id=ticket_id,
                token_hash=hash_token(raw_token),
                tenant_id=tenant_id,
                user_id=_owner_id(user),
                artifact_id=artifact_id,
                purpose=purpose,
                issued_at=issued_at,
                expires_at=expires_at,
                redeemed_at=None,
            )
        )
        event = build_audit_event(
            tenant_id=tenant_id,
            user_id=_owner_id(user),
            event_type="ticket_issued",
            artifact_id=artifact_id,
            input_digest=row.digest_sha256,
            purpose=purpose,
        )
        db.add(SecureIngestAuditEvent(id=str(uuid.uuid4()), created_at=_now_iso(), **event))
        db.commit()
    finally:
        db.close()

    return {"ticket_id": ticket_id, "token": raw_token, "expires_at": expires_at}


@router.get("/download/{ticket_id}")
def redeem_ticket(
    ticket_id: str,
    token: str,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    tenant_id = _resolve_tenant(user)
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant 无法解析")

    from src.db.engine import SessionLocal
    from src.db.models import SecureIngestArtifact, SecureIngestAuditEvent, SecureIngestDownloadTicket

    db = SessionLocal()
    try:
        ticket = (
            db.query(SecureIngestDownloadTicket)
            .filter(
                SecureIngestDownloadTicket.id == ticket_id,
                SecureIngestDownloadTicket.tenant_id == tenant_id,
            )
            .one_or_none()
        )
        if ticket is None or ticket.token_hash != hash_token(token):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
        if ticket.redeemed_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ticket already redeemed")
        if datetime.fromisoformat(ticket.expires_at) < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="ticket expired")

        artifact = (
            db.query(SecureIngestArtifact)
            .filter(
                SecureIngestArtifact.id == ticket.artifact_id,
                SecureIngestArtifact.tenant_id == tenant_id,
            )
            .one_or_none()
        )
        if artifact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact missing")

        # 对象替换防线:兑换时重新读盘算摘要,跟发放时记录的摘要比对,而不是只信当初的检查。
        # 读取用持久化的 storage_path(row 已按 tenant_id 过滤),不重算下载者当下的 tenant_slug——
        # 避免两者不一致时把"文件不存在"错误当成未处理异常穿透成 500。
        if not artifact.storage_path:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact has no stored body")
        try:
            raw_bytes = read_artifact_bytes_at_path(artifact.storage_path)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="stored body missing") from exc
        if compute_sha256(raw_bytes) != artifact.digest_sha256:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="digest mismatch, object may have been replaced")

        ticket.redeemed_at = _now_iso()
        event = build_audit_event(
            tenant_id=tenant_id,
            user_id=_owner_id(user),
            event_type="ticket_redeemed",
            artifact_id=artifact.id,
            input_digest=artifact.digest_sha256,
            purpose=ticket.purpose,
        )
        db.add(SecureIngestAuditEvent(id=str(uuid.uuid4()), created_at=_now_iso(), **event))
        db.commit()
    finally:
        db.close()

    return StreamingResponse(iter([raw_bytes]), media_type="application/octet-stream")


def _row_to_artifact(row) -> IngestArtifactV1:
    return IngestArtifactV1(
        artifact_id=row.id,
        mission_contract_id=row.mission_contract_id,
        status=row.status,
        detected_format=row.detected_format,
        file_size_bytes=row.file_size_bytes,
        page_count=row.page_count,
        digest_sha256=row.digest_sha256,
        ocr_status=row.ocr_status,
        reject_reason=row.reject_reason,
        macro_detected=row.macro_detected,
        zip_bomb_suspected=row.zip_bomb_suspected,
        injection_flag_categories=json.loads(row.injection_flag_categories_json or "[]"),
        created_at=row.created_at,
    )