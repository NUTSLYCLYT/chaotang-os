"""Permanent P2 dependency gate for the legacy flow-store write surface."""

from __future__ import annotations

from pathlib import Path

from src.legacy_writer_architecture import find_legacy_writer_import_violations

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_current_production_imports_match_frozen_allowlist():
    assert find_legacy_writer_import_violations(BACKEND_ROOT) == []


def test_new_production_import_is_rejected(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "new_parallel_writer.py").write_text(
        "from src.db.flow_store import save_decree_and_task\n",
        encoding="utf-8",
    )

    violations = find_legacy_writer_import_violations(tmp_path)

    assert len(violations) == 1
    assert "new_parallel_writer.py" in violations[0]
    assert "save_decree_and_task" in violations[0]


def test_module_level_import_cannot_bypass_symbol_gate(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "new_parallel_writer.py").write_text(
        "from src.db import flow_store\nflow_store.save_decree_and_task(session=None, task_id='x')\n",
        encoding="utf-8",
    )

    violations = find_legacy_writer_import_violations(tmp_path)

    assert len(violations) == 1
    assert "module import" in violations[0]
