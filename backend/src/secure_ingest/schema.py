"""R0-W03 安全摄取契约（REQ-001/002）。

API 面永不携带原始字节或抽取文本——`IngestArtifactV1` 只暴露状态/摘要/拒答原因，正文永不
经过这层（W03 packet card 硬红线："合同正文进入全局 IMA/shared RAG、localStorage、日志、
trace 或截图"禁止）。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DetectedFormat = Literal["DOCX_OOXML", "DOCX_ENCRYPTED", "CORRUPTED", "UNKNOWN"]

IngestStatus = Literal["RECEIVED", "VALIDATING", "ACCEPTED", "REJECTED"]

RejectReason = Literal[
    "FAKE_MIME",
    "OVERSIZE",
    "TOO_MANY_PAGES",
    "CORRUPTED",
    "ENCRYPTED",
    "MACRO_DETECTED",
    "ZIP_BOMB_SUSPECTED",
    "INJECTION_SUSPECTED",
    "MISSING_PURPOSE",
    "UNKNOWN_PROVIDER",
]

# 首刀（DOCX-only）恒为 NOT_APPLICABLE；LOW_CONFIDENCE/OK/FAILED/PENDING 为 PDF/OCR 扩展预留，
# 现在就把值域定完整，扩展时不用改 schema。
OcrStatus = Literal["NOT_APPLICABLE", "PENDING", "LOW_CONFIDENCE", "OK", "FAILED"]


class IngestArtifactV1(BaseModel):
    """摄取产物的对外投影——不含原始字节、不含抽取文本。"""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["IngestArtifactV1"] = "IngestArtifactV1"
    artifact_id: str = Field(min_length=1)
    mission_contract_id: str = Field(min_length=1)
    status: IngestStatus
    detected_format: DetectedFormat
    file_size_bytes: int = Field(ge=0)
    page_count: int | None = Field(default=None, ge=0)
    digest_sha256: str = Field(min_length=64, max_length=64)
    ocr_status: OcrStatus
    reject_reason: RejectReason | None = None
    macro_detected: bool
    zip_bomb_suspected: bool
    injection_flag_categories: list[str] = Field(default_factory=list)
    created_at: str = Field(min_length=1)
