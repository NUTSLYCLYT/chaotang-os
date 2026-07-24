"""Deterministic, in-memory R0-W06 artifact rendering."""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from dataclasses import dataclass
from typing import Any

from docx import Document


@dataclass(frozen=True)
class DeliveryArtifact:
    artifact_id: str
    kind: str
    mime_type: str
    content: bytes
    status: str
    content_hash: str
    byte_size: int


@dataclass(frozen=True)
class DeliveryResult:
    task_id: str
    final_memorial_id: str
    final_memorial_version: int
    artifacts: tuple[DeliveryArtifact, ...]
    overall_status: str


def _pdf_bytes(text: str) -> bytes:
    body = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 12 Tf 72 720 Td ({body}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    output.extend(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]))
    output.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(output)


def _render(kind: str, payload: dict[str, Any]) -> tuple[bytes, str]:
    title = str(payload.get("title", "Final Memorial"))
    summary = str(payload.get("summary", ""))
    if kind == "JSON":
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(), "application/json"
    if kind == "DOCX":
        document = Document()
        document.add_heading(title, level=1)
        document.add_paragraph(summary)
        stream = io.BytesIO()
        document.save(stream)
        source = zipfile.ZipFile(io.BytesIO(stream.getvalue()))
        normalized = io.BytesIO()
        with zipfile.ZipFile(normalized, "w", compression=zipfile.ZIP_DEFLATED) as target:
            for name in sorted(source.namelist()):
                info = source.getinfo(name)
                entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = info.external_attr
                target.writestr(entry, source.read(name))
        return normalized.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if kind == "PDF":
        return _pdf_bytes(f"{title}: {summary}"), "application/pdf"
    raise ValueError(f"unsupported artifact kind: {kind}")


def render_artifacts(*, task_id: str, final_memorial_id: str, final_memorial_version: int, payload: dict[str, Any], required_kinds: list[str], disabled_kinds: set[str] | None = None) -> DeliveryResult:
    disabled = disabled_kinds or set()
    artifacts: list[DeliveryArtifact] = []
    for kind in required_kinds:
        artifact_id = f"artifact-{task_id}-{final_memorial_version}-{kind.lower()}"
        if kind in disabled:
            empty = b""
            artifacts.append(DeliveryArtifact(artifact_id, kind, "application/octet-stream", empty, "UNAVAILABLE", hashlib.sha256(empty).hexdigest(), 0))
            continue
        content, mime = _render(kind, payload)
        digest = hashlib.sha256(content).hexdigest()
        artifacts.append(DeliveryArtifact(artifact_id, kind, mime, content, "READY", digest, len(content)))
    statuses = {artifact.status for artifact in artifacts}
    overall = "READY" if statuses == {"READY"} else "PARTIAL"
    return DeliveryResult(task_id, final_memorial_id, final_memorial_version, tuple(artifacts), overall)
