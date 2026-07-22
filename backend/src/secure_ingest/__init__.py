"""R0-W03 安全摄取与租户隔离。

首刀只支持合成采购 DOCX；PDF/扫描件/OCR 是后续在同一 schema 里的扩展，不在本包范围内。
真病毒扫描（ClamAV 级别）明确排除在 R0 范围外，只做结构性宏/zip-bomb 检查——见
`ooxml_structure.py` 模块 docstring。
"""

from __future__ import annotations

from src.secure_ingest.schema import (
    DetectedFormat,
    IngestArtifactV1,
    IngestStatus,
    OcrStatus,
    RejectReason,
)

__all__ = [
    "DetectedFormat",
    "IngestArtifactV1",
    "IngestStatus",
    "OcrStatus",
    "RejectReason",
]
