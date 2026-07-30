"""Fail-closed runtime loader for the repository Chancellor drafting skill."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import yaml

_EXPECTED_NAME = "chancellor-draft-edict"
_MAX_SKILL_BYTES = 64 * 1024
_REQUIRED_ANCHORS = (
    "保守补全、直接成旨",
    "不得为了多问一句而维持 `CLARIFYING`",
    "只有 `DRAFT_READY` 能启用【下旨】",
)


class ChancellorDraftSkillError(RuntimeError):
    """Raised when the governed runtime skill is unavailable or invalid."""


@dataclass(frozen=True)
class ChancellorDraftSkill:
    """Validated instructions and immutable identity of the loaded skill."""

    name: str
    instructions: str
    sha256: str
    source_path: Path


def _default_skill_path() -> Path:
    repository_root = Path(__file__).resolve().parents[4]
    return repository_root / ".agents" / "skills" / _EXPECTED_NAME / "SKILL.md"


def load_chancellor_draft_skill(path: Path | None = None) -> ChancellorDraftSkill:
    """Load and validate the governed Chancellor drafting instructions.

    The loader intentionally fails closed. A missing, oversized, malformed,
    renamed or governance-incomplete skill must never silently fall back to a
    generic prompt because that would erase the 拟旨/下旨 authority boundary.
    """

    source_path = (path or _default_skill_path()).resolve()
    try:
        raw = source_path.read_bytes()
    except OSError as exc:
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.") from exc

    if not raw or len(raw) > _MAX_SKILL_BYTES:
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.") from exc

    if not text.startswith("---\n"):
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.")

    closing = text.find("\n---\n", 4)
    if closing < 0:
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.")

    try:
        metadata = yaml.safe_load(text[4:closing])
    except yaml.YAMLError as exc:
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.") from exc

    instructions = text[closing + 5 :].strip()
    if (
        not isinstance(metadata, dict)
        or metadata.get("name") != _EXPECTED_NAME
        or not instructions
        or any(anchor not in instructions for anchor in _REQUIRED_ANCHORS)
    ):
        raise ChancellorDraftSkillError("Chancellor draft skill is invalid.")

    return ChancellorDraftSkill(
        name=_EXPECTED_NAME,
        instructions=instructions,
        sha256=hashlib.sha256(raw).hexdigest(),
        source_path=source_path,
    )
