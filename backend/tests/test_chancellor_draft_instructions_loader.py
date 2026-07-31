"""Tests for the backend-owned Chancellor drafting instruction resource."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.agents.chancellor_draft.instructions_loader import (
    ChancellorDraftInstructionsError,
    load_chancellor_draft_instructions,
)
from app.agents.chancellor_draft.models import (
    ChancellorDraftResponse,
    DraftStatus,
)


def _write_instructions(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    return path


def test_loads_repository_chancellor_instructions() -> None:
    resource = load_chancellor_draft_instructions()

    assert resource.source_path.name == "instructions.md"
    assert ".agents" not in resource.source_path.parts
    assert "保守补全、直接成旨" in resource.instructions
    assert "只有 `DRAFT_READY` 能启用【下旨】" in resource.instructions
    assert resource.sha256


def test_repository_instructions_require_conservative_direct_draft_contract() -> None:
    resource = load_chancellor_draft_instructions()

    assert "保守补全、直接成旨" in resource.instructions
    assert "不得为了多问一句而维持 `CLARIFYING`" in resource.instructions
    assert "丞相建议" in resource.instructions
    assert "暂定边界" in resource.instructions


def test_loader_rejects_instructions_without_direct_draft_anchor(
    tmp_path: Path,
) -> None:
    source = load_chancellor_draft_instructions().source_path.read_text(encoding="utf-8")
    downgraded = source.replace("保守补全、直接成旨", "保守补全、直接成稿")
    path = tmp_path / "SKILL.md"
    path.write_text(downgraded, encoding="utf-8")

    with pytest.raises(ChancellorDraftInstructionsError):
        load_chancellor_draft_instructions(path)


def test_repository_instructions_ready_example_has_no_missing_inputs() -> None:
    instructions = load_chancellor_draft_instructions().instructions
    example = instructions.split("## 优秀示例", maxsplit=1)[1].split(
        "## 快速检查", maxsplit=1
    )[0]

    assert "当前状态：`DRAFT_READY`" in example
    assert "材料缺口**：无" in example
    assert "输入材料**：仅使用用户已表达的“想通过股票赚钱”这一目标" in example
    assert "用户后续提供市场范围、投资期限和可承受风险" not in example
    assert "具体市场、具体股票、投入金额、个性化最大损失和实际交易" in example
    assert "形成新版本草案" in example


def test_rejects_instructions_missing_governance_anchor(tmp_path: Path) -> None:
    path = _write_instructions(
        tmp_path / "instructions.md",
        """
案例是主要产出
""",
    )

    with pytest.raises(ChancellorDraftInstructionsError, match="invalid"):
        load_chancellor_draft_instructions(path)


def test_loader_accepts_valid_crlf_instructions(tmp_path: Path) -> None:
    source = load_chancellor_draft_instructions().source_path.read_bytes()
    normalized = source.replace(b"\r\n", b"\n")
    path = tmp_path / "SKILL.md"
    path.write_bytes(normalized.replace(b"\n", b"\r\n"))

    resource = load_chancellor_draft_instructions(path)

    assert resource.sha256


def test_draft_response_accepts_only_governed_statuses() -> None:
    response = ChancellorDraftResponse(
        status=DraftStatus.CLARIFYING,
        version=1,
        fingerprint="a" * 64,
        understanding="用户希望把模糊需求整理为可执行草案。",
        expert_example="专业人士通常会明确目标、范围、风险和交付物。",
        recommendation_reason="这样能减少误解并提前暴露关键边界。",
        assumptions=["尚未确认具体完成期限。"],
        revision_prompt="请直接告诉臣案例中哪里需要调整。",
    )

    assert response.status is DraftStatus.CLARIFYING
    assert response.draft is None

    with pytest.raises(ValidationError):
        ChancellorDraftResponse(
            status="CONTENT_CHANGED",
            version=1,
            fingerprint="b" * 64,
            understanding="理解",
            expert_example="案例",
            recommendation_reason="理由",
            assumptions=[],
            revision_prompt="修改提示",
        )
