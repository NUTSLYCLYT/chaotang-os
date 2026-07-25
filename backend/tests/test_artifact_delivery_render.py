"""R0-W06-2 RED: deterministic three-format artifact rendering contract."""

from __future__ import annotations

import hashlib
import io
import json

import pytest
from docx import Document
from pypdf import PdfReader

from tests.artifact_delivery_support import contract_review_pack


def test_render_artifacts_returns_json_docx_pdf_with_deterministic_hashes() -> None:
    from src.artifacts.delivery import render_artifacts

    decision_marker = "DECISION-SUMMARY-W06R-UNIQUE"
    risk_marker = "RISK-MARKER-W06R-UNIQUE"
    payload = contract_review_pack(
        task_id="task-1",
        decision_summary=decision_marker,
        risk_marker=risk_marker,
    )
    result = render_artifacts(
        task_id="task-1",
        final_memorial_id="memorial-1",
        final_memorial_version=2,
        payload=payload,
        required_kinds=["JSON", "DOCX", "PDF"],
    )
    repeated = render_artifacts(
        task_id="task-1",
        final_memorial_id="memorial-1",
        final_memorial_version=2,
        payload=payload,
        required_kinds=["JSON", "DOCX", "PDF"],
    )

    assert {item.kind for item in result.artifacts} == {"JSON", "DOCX", "PDF"}
    for item in result.artifacts:
        assert item.status == "READY"
        assert item.content_hash == hashlib.sha256(item.content).hexdigest()
        assert item.byte_size == len(item.content)
    assert [item.content for item in result.artifacts] == [item.content for item in repeated.artifacts]

    by_kind = {item.kind: item.content for item in result.artifacts}
    assert json.loads(by_kind["JSON"]) == payload
    docx_text = "\n".join(
        paragraph.text
        for paragraph in Document(io.BytesIO(by_kind["DOCX"])).paragraphs
    )
    pdf_text = "\n".join(
        page.extract_text() or ""
        for page in PdfReader(io.BytesIO(by_kind["PDF"])).pages
    )
    for rendered_text in (docx_text, pdf_text):
        assert decision_marker in rendered_text
        assert risk_marker in rendered_text
        assert all(field_name in rendered_text for field_name in payload)


def test_render_artifacts_isolates_one_format_failure() -> None:
    from src.artifacts.delivery import render_artifacts

    result = render_artifacts(
        task_id="task-2",
        final_memorial_id="memorial-2",
        final_memorial_version=1,
        payload={"title": "测试"},
        required_kinds=["JSON", "DOCX", "PDF"],
        disabled_kinds={"PDF"},
    )

    assert result.overall_status == "PARTIAL"
    assert {item.kind for item in result.artifacts if item.status == "READY"} == {"JSON", "DOCX"}
    assert [item.kind for item in result.artifacts if item.status == "UNAVAILABLE"] == ["PDF"]
    unavailable = result.artifacts[-1]
    assert unavailable.content_hash == hashlib.sha256(b"").hexdigest()
