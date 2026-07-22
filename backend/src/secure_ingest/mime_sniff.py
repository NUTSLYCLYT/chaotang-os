"""REQ-001：真实 MIME 检测——magic bytes，不信文件名/声明的 content-type。

标准库 `zipfile` 即可完成，不引入 `python-magic` 等新依赖（DOCX/OOXML 结构简单，够用）。
"""

from __future__ import annotations

import io
import zipfile

from src.secure_ingest.schema import DetectedFormat

_ZIP_MAGIC = b"PK\x03\x04"
_OLE_CFBF_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # 加密 DOCX 外层容器
_REQUIRED_OOXML_PARTS = ("[Content_Types].xml", "word/document.xml")


def detect_format(raw_bytes: bytes) -> DetectedFormat:
    """只信 magic bytes 和 zip 内部结构，不信调用方声明的文件名/content-type。"""
    if raw_bytes.startswith(_OLE_CFBF_MAGIC):
        # Office 把密码保护的 OOXML 包裹进 CFBF 容器（EncryptedPackage stream）。
        return "DOCX_ENCRYPTED"
    if not raw_bytes.startswith(_ZIP_MAGIC):
        return "UNKNOWN"
    try:
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
            names = set(zf.namelist())
    except zipfile.BadZipFile:
        return "CORRUPTED"
    if not all(part in names for part in _REQUIRED_OOXML_PARTS):
        # 是个合法 zip，但不含 DOCX 必需部件——伪 MIME(.docx 名字包了个别的东西)。
        return "UNKNOWN"
    return "DOCX_OOXML"
