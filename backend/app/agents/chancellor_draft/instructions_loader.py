"""Fail-closed loader for backend-owned Chancellor drafting instructions."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

_MAX_INSTRUCTIONS_BYTES = 64 * 1024
_REQUIRED_ANCHORS = (
    "保守补全、直接成旨",
    "不得为了多问一句而维持 `CLARIFYING`",
    "只有 `DRAFT_READY` 能启用【下旨】",
)


class ChancellorDraftInstructionsError(RuntimeError):
    """Raised when governed runtime instructions are unavailable or invalid."""


@dataclass(frozen=True)
class ChancellorDraftInstructions:
    """Validated instructions and immutable identity of the loaded resource."""

    instructions: str
    sha256: str
    source_path: Path


def _default_instructions_path() -> Path:
    return Path(__file__).with_name("instructions.md")


def load_chancellor_draft_instructions(
    path: Path | None = None,
) -> ChancellorDraftInstructions:
    """Load and validate the governed Chancellor drafting instructions."""

    source_path = (path or _default_instructions_path()).resolve()
    try:
        raw = source_path.read_bytes()
    except OSError as exc:
        raise ChancellorDraftInstructionsError(
            "Chancellor draft instructions are invalid."
        ) from exc

    if not raw or len(raw) > _MAX_INSTRUCTIONS_BYTES:
        raise ChancellorDraftInstructionsError(
            "Chancellor draft instructions are invalid."
        )

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ChancellorDraftInstructionsError(
            "Chancellor draft instructions are invalid."
        ) from exc

    instructions = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not instructions or any(
        anchor not in instructions for anchor in _REQUIRED_ANCHORS
    ):
        raise ChancellorDraftInstructionsError(
            "Chancellor draft instructions are invalid."
        )

    return ChancellorDraftInstructions(
        instructions=instructions,
        sha256=hashlib.sha256(raw).hexdigest(),
        source_path=source_path,
    )
