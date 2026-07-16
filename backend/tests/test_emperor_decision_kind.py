"""P4.5a contract tests for explicit EmperorDecision semantic kinds."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest


BACKEND_ROOT = Path(__file__).resolve().parent.parent


def test_action_vocabulary_maps_to_three_frozen_kinds_and_rejects_unknowns():
    from src.emperor_decision_kind import emperor_decision_kind

    expected = {
        "confirm_direct_task": "edict_confirm",
        "confirm_edict": "edict_confirm",
        "compat_court_dispatch": "compat_dispatch",
        "adopt": "final_verdict",
        "approve": "final_verdict",
        "archive": "final_verdict",
        "reject": "final_verdict",
        "request_evidence": "final_verdict",
        "recheck": "final_verdict",
        "followup": "final_verdict",
    }
    assert {action: emperor_decision_kind(action) for action in expected} == expected
    with pytest.raises(ValueError, match="unknown EmperorDecision action"):
        emperor_decision_kind("invented_action")


def test_every_production_emperor_decision_writer_sets_kind_explicitly():
    writer_calls: list[tuple[Path, int, set[str]]] = []
    for root in (BACKEND_ROOT / "src", BACKEND_ROOT / "web"):
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                if isinstance(node.func, ast.Name) and node.func.id == "EmperorDecision":
                    writer_calls.append(
                        (
                            path.relative_to(BACKEND_ROOT),
                            node.lineno,
                            {kw.arg for kw in node.keywords},
                        )
                    )

    assert len(writer_calls) == 6, writer_calls
    missing = [
        (str(path), line)
        for path, line, keywords in writer_calls
        if "kind" not in keywords
    ]
    assert missing == []


def test_model_requires_kind_and_freezes_the_allowed_database_values():
    from src.db.models import EmperorDecision

    kind = EmperorDecision.__table__.c.kind
    assert kind.nullable is False
    checks = {
        constraint.name: str(constraint.sqltext)
        for constraint in EmperorDecision.__table__.constraints
        if constraint.__class__.__name__ == "CheckConstraint"
    }
    assert "ck_emperor_decisions_kind" in checks
    for value in ("edict_confirm", "compat_dispatch", "final_verdict"):
        assert value in checks["ck_emperor_decisions_kind"]
