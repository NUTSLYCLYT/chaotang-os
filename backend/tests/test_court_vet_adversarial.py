"""Adversarial contracts for the court truth gate.

These tests pin the semantic result of the gate. A high retrieval score alone
must not turn an unrelated or numerically altered claim into evidence.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import knowledge_vet as kv  # noqa: E402
from src.confidence_tag import tag_confidence  # noqa: E402


@pytest.fixture(
    autouse=True,
    name="_authenticated_api_user",
)
def _unit_authenticated_api_user():
    """Keep this pure unit suite independent from global web-app fixtures."""
    yield


@pytest.fixture(autouse=True)
def _block_default_session_local():
    yield


@pytest.fixture(autouse=True)
def _identify_legacy_chaotang_store_test_writers():
    yield


@pytest.fixture(autouse=True)
def _no_network_real_department_engines():
    yield


@pytest.fixture(autouse=True)
def _no_background_outbox_dispatch():
    yield


@pytest.fixture(autouse=True)
def _reset_login_rate_limiter():
    yield


TRUTH = (
    "# LFP-40C-100Ah product facts\n"
    "The LFP-40C-100Ah cell has 100Ah capacity and 3.2V voltage. "
    "Its cycle life is at least 3000 times. The price range is "
    "350-420 yuan per cell and the minimum order is 1000 cells. "
    "At -40C its discharge retention is at least 70%.\n"
    "磷酸铁锂电芯 LFP-40C-100Ah，容量100Ah，电压3.2V，循环寿命3000次，"
    "价格区间350-420元/只，起订量1000只，低温放电保持率70%。"
)


class _FixedHighScoreRag:
    """Return fixed evidence at a score above the historic noise floor."""

    def stats(self) -> dict:
        return {"total_chunks": 1}

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        return [{"content": TRUTH, "source": "lfp-reference.md", "score": 0.55}]


@pytest.fixture
def fixed_truth(monkeypatch):
    from src import knowledge_rag

    monkeypatch.setattr(knowledge_rag, "get_rag", lambda: _FixedHighScoreRag())
    monkeypatch.setattr(
        knowledge_rag,
        "get_ragflow",
        lambda: type("OfflineRagFlow", (), {"is_configured": lambda self: False})(),
    )


def test_truth_gate_accepts_matching_claim(fixed_truth):
    result = kv.vet_against_knowledge(
        "LFP-40C-100Ah 价格区间350-420元/只，起订量1000只"
    )

    assert result["grounded"] is True, result
    assert result["decision"] == kv.DECISION_GROUNDED
    assert result["evidence"]


@pytest.mark.parametrize(
    ("claim", "offending_figure"),
    [
        ("LFP-40C-100Ah 价格区间12-15元/只，起订量1只", "15元"),
        ("LFP-40C-100Ah 循环寿命仅80次", "80次"),
        ("LFP-40C-100Ah 在-40C放电保持率仅5%", "5%"),
    ],
)
def test_truth_gate_rejects_changed_figures(fixed_truth, claim, offending_figure):
    result = kv.vet_against_knowledge(claim)

    assert result["relevance"] >= kv.DEFAULT_THRESHOLD
    assert result["grounded"] is False, result
    assert offending_figure in result["decision"]
    assert result["evidence"] == ""


@pytest.mark.parametrize(
    "claim",
    [
        "本司在火星建成3座氦-3提炼厂，年产能500万吨",
        "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉",
        "'libu'",
    ],
)
def test_truth_gate_rejects_unrelated_high_score_claims(fixed_truth, claim):
    result = kv.vet_against_knowledge(claim)

    assert result["relevance"] >= kv.DEFAULT_THRESHOLD
    assert result["grounded"] is False, result
    assert result["evidence"] == ""


@pytest.mark.parametrize(
    "text",
    [
        "### 1. 输入约束与口径清单",
        "行业监管依据GB/T 42288-2022",
        "当前日期2026-07-19",
        "工业移动机器人B2B领域",
        "电芯18650-3500mAh为标准型号",
    ],
)
def test_confidence_stamp_ignores_identifiers(text):
    assert "[待核·无源]" not in tag_confidence(text)


def test_confidence_stamp_keeps_business_figures_visible():
    tagged = tag_confidence("据财报营收152.8万元，毛利率32%。", ["公司2025年财报"])

    assert "152.8万元[一手" in tagged
    assert "32%[一手" in tagged
