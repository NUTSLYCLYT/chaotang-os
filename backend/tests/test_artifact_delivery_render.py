"""R0-W06-2 RED: deterministic three-format artifact rendering contract."""

from __future__ import annotations

import hashlib

import pytest


def test_render_artifacts_returns_json_docx_pdf_with_deterministic_hashes() -> None:
    from src.artifacts.delivery import render_artifacts

    result = render_artifacts(
        task_id="task-1",
        final_memorial_id="memorial-1",
        final_memorial_version=2,
        payload={"title": "测试奏折", "summary": "可复核结论"},
        required_kinds=["JSON", "DOCX", "PDF"],
    )
    repeated = render_artifacts(
        task_id="task-1",
        final_memorial_id="memorial-1",
        final_memorial_version=2,
        payload={"title": "测试奏折", "summary": "可复核结论"},
        required_kinds=["JSON", "DOCX", "PDF"],
    )

    assert {item.kind for item in result.artifacts} == {"JSON", "DOCX", "PDF"}
    for item in result.artifacts:
        assert item.status == "READY"
        assert item.content_hash == hashlib.sha256(item.content).hexdigest()
        assert item.byte_size == len(item.content)
    assert [item.content for item in result.artifacts] == [item.content for item in repeated.artifacts]


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
