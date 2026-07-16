"""P4.5c architecture contract for the standalone swarm quality-gate seam."""

from __future__ import annotations

import ast
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent


def test_quality_gate_behavior_and_compatibility_exports_are_unchanged():
    from src import swarm_execution_loop, swarm_quality_gate, swarm_review

    brief = {
        "source_label": "LIVE",
        "evidence_chain": [{"source": "contract"}],
        "missing_evidence": [],
        "risk_register": [],
        "conflict_summary": [],
        "recommended_next_action": "推进",
    }
    expected = {
        "passed": True,
        "blocking_reasons": [],
        "warnings": [],
        "revised_output": brief,
    }

    assert swarm_quality_gate.quality_gate(brief) == expected
    assert swarm_review.quality_gate is swarm_quality_gate.quality_gate
    assert swarm_execution_loop.quality_gate is swarm_quality_gate.quality_gate


def test_producer_imports_the_seam_and_review_module_no_longer_owns_gate_logic():
    loop_path = BACKEND_ROOT / "src/swarm_execution_loop.py"
    review_path = BACKEND_ROOT / "src/swarm_review.py"
    seam_path = BACKEND_ROOT / "src/swarm_quality_gate.py"
    loop_tree = ast.parse(loop_path.read_text(encoding="utf-8"))
    review_tree = ast.parse(review_path.read_text(encoding="utf-8"))
    seam_tree = ast.parse(seam_path.read_text(encoding="utf-8"))

    imports = {
        (node.module, alias.name)
        for node in ast.walk(loop_tree)
        if isinstance(node, ast.ImportFrom)
        for alias in node.names
    }
    assert ("src.swarm_quality_gate", "quality_gate") in imports
    assert ("src.swarm_review", "quality_gate") not in imports

    review_defs = {
        node.name for node in ast.walk(review_tree) if isinstance(node, ast.FunctionDef)
    }
    seam_defs = {
        node.name for node in ast.walk(seam_tree) if isinstance(node, ast.FunctionDef)
    }
    assert "quality_gate" not in review_defs
    assert "quality_gate" in seam_defs
