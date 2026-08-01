"""P4.5d architecture gate for the frozen CourtReview writer inventory."""

from __future__ import annotations

import ast
from collections import Counter
from pathlib import Path

from src.court_review_writer_inventory import COURT_REVIEW_WRITER_BASELINE


BACKEND_ROOT = Path(__file__).resolve().parent.parent
PRODUCTION_ROOTS = (BACKEND_ROOT / "src", BACKEND_ROOT / "web")


def _enclosing_function(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> str:
    current = node
    while current in parents:
        current = parents[current]
        if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return current.name
    return "<module>"


def _scan_court_review_writers() -> Counter[tuple[str, str]]:
    writers: Counter[tuple[str, str]] = Counter()
    for root in PRODUCTION_ROOTS:
        for path in sorted(root.rglob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            parents = {
                child: parent
                for parent in ast.walk(tree)
                for child in ast.iter_child_nodes(parent)
            }
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                called_name = (
                    node.func.id
                    if isinstance(node.func, ast.Name)
                    else node.func.attr
                    if isinstance(node.func, ast.Attribute)
                    else None
                )
                if called_name == "CourtReview":
                    relative_path = path.relative_to(BACKEND_ROOT).as_posix()
                    writers[(relative_path, _enclosing_function(node, parents))] += 1
    return writers


def test_court_review_production_writer_multiset_matches_frozen_baseline():
    actual = _scan_court_review_writers()

    assert actual == Counter(COURT_REVIEW_WRITER_BASELINE)
    assert actual.total() == 11
