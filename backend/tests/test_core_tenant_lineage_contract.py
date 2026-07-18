"""P4.5f architecture contract for nullable tenant lineage on the core chain."""

from __future__ import annotations

import ast
from collections import Counter
from pathlib import Path

from src.db.models import (
    ChancellorRouteDecision,
    CourtReview,
    DecisionTask,
    DecreeExecutionEvent,
    EmperorDecision,
    FinalMemorial,
    OutboxEvent,
    ShiguanArchive,
)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
CORE_MODELS = (
    DecisionTask,
    ChancellorRouteDecision,
    OutboxEvent,
    DecreeExecutionEvent,
    CourtReview,
    FinalMemorial,
    EmperorDecision,
    ShiguanArchive,
)
EXPECTED_WRITER_COUNTS = Counter(
    {
        "DecisionTask": 1,
        "ChancellorRouteDecision": 1,
        "OutboxEvent": 1,
        "DecreeExecutionEvent": 1,
        "CourtReview": 10,
        "FinalMemorial": 1,
        "EmperorDecision": 6,
        "ShiguanArchive": 1,
    }
)


def test_all_eight_core_tables_have_nullable_tenant_lineage_without_defaults():
    assert len(CORE_MODELS) == 8
    for model in CORE_MODELS:
        tenant_id = model.__table__.c.tenant_id
        assert tenant_id.nullable is True, model.__tablename__
        assert tenant_id.default is None, model.__tablename__
        assert tenant_id.server_default is None, model.__tablename__


def test_every_core_production_constructor_sets_tenant_id_explicitly():
    calls: list[tuple[str, str, int, set[str]]] = []
    for root in (BACKEND_ROOT / "src", BACKEND_ROOT / "web"):
        for path in sorted(root.rglob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
                    continue
                if node.func.id not in EXPECTED_WRITER_COUNTS:
                    continue
                calls.append(
                    (
                        node.func.id,
                        path.relative_to(BACKEND_ROOT).as_posix(),
                        node.lineno,
                        {keyword.arg for keyword in node.keywords if keyword.arg},
                    )
                )

    assert Counter(name for name, *_ in calls) == EXPECTED_WRITER_COUNTS
    assert [(name, path, line) for name, path, line, keywords in calls if "tenant_id" not in keywords] == []
