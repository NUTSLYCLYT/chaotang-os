"""Canonical text extraction for accepted DOCX evidence."""

from __future__ import annotations

import io
from typing import Any

from docx import Document
from docx.oxml import parse_xml
from docx.oxml.ns import qn

EXTRACTOR_POLICY_VERSION = "docx-canonical-v1"


def extractor_policy_for_format(detected_format: str) -> str | None:
    """Return the canonical extraction policy recorded for an accepted format."""
    return EXTRACTOR_POLICY_VERSION if detected_format == "DOCX_OOXML" else None
_PARAGRAPH_TAG = qn("w:p")
_TEXT_NODE_NAMES = {"t", "delText", "instrText", "delInstrText"}
_AUXILIARY_STORY_PARTS = (
    "/word/comments.xml",
    "/word/footnotes.xml",
    "/word/endnotes.xml",
)


def _normalized_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _paragraph_lines(paragraph: Any) -> list[str]:
    fragments: list[str] = []

    def visit(node: Any) -> None:
        if node is not paragraph and node.tag == _PARAGRAPH_TAG:
            return
        local_name = node.tag.rsplit("}", 1)[-1] if isinstance(node.tag, str) else ""
        if local_name in _TEXT_NODE_NAMES and isinstance(node.text, str) and node.text.strip():
            fragments.append(node.text)
        elif local_name == "tab":
            fragments.append("\t")
        elif local_name in {"br", "cr"}:
            fragments.append("\n")
        elif local_name == "noBreakHyphen":
            fragments.append("\N{NON-BREAKING HYPHEN}")
        elif local_name == "softHyphen":
            fragments.append("\N{SOFT HYPHEN}")
        for child in node:
            visit(child)

    visit(paragraph)
    return _normalized_lines("".join(fragments))


def _story_lines(story_element: Any) -> list[str]:
    lines: list[str] = []
    for paragraph in story_element.iter(_PARAGRAPH_TAG):
        lines.extend(_paragraph_lines(paragraph))
    return lines


def extract_canonical_docx_text(raw_bytes: bytes) -> str:
    document = Document(io.BytesIO(raw_bytes))
    lines = _story_lines(document.element.body)

    seen_story_parts: set[int] = set()
    for story_name in (
        "header", "first_page_header", "even_page_header",
        "footer", "first_page_footer", "even_page_footer",
    ):
        for section in document.sections:
            story = getattr(section, story_name)
            identity = id(story._element)
            if identity in seen_story_parts:
                continue
            seen_story_parts.add(identity)
            lines.extend(_story_lines(story._element))

    parts_by_name = {str(part.partname): part for part in document.part.package.parts}
    for part_name in _AUXILIARY_STORY_PARTS:
        part = parts_by_name.get(part_name)
        if part is not None:
            lines.extend(_story_lines(parse_xml(part.blob)))
    return "\n".join(lines)
