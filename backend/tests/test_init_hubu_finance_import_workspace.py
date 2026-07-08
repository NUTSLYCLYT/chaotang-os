from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from scripts.init_hubu_finance_import_workspace import DEFAULT_TEMPLATE_DIR, init_workspace


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "init_hubu_finance_import_workspace.py"


def test_init_hubu_finance_import_workspace_copies_templates_and_readme(tmp_path: Path):
    target = tmp_path / "hubu_finance_import_demo"

    copied = init_workspace(DEFAULT_TEMPLATE_DIR, target)

    assert (target / "bank_statements.csv").exists()
    assert (target / "trial_balance.csv").exists()
    assert (target / "README.md").exists()
    assert any(path.name == "README.md" for path in copied)
    assert "sourceLabel/sourceRef" in (target / "README.md").read_text(encoding="utf-8")


def test_init_hubu_finance_import_workspace_refuses_non_empty_target(tmp_path: Path):
    target = tmp_path / "existing"
    target.mkdir()
    (target / "keep.txt").write_text("do not overwrite", encoding="utf-8")

    with pytest.raises(FileExistsError):
        init_workspace(DEFAULT_TEMPLATE_DIR, target)


def test_init_hubu_finance_import_workspace_cli_outputs_next_command(tmp_path: Path):
    target = tmp_path / "cli_workspace"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--target-dir", str(target)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0
    assert "created:" in result.stdout
    assert "hubu_finance_import_preview.py" in result.stdout
    assert (target / "bank_statements.csv").exists()


def test_init_hubu_finance_import_workspace_cli_returns_2_for_existing_target(tmp_path: Path):
    target = tmp_path / "cli_existing"
    target.mkdir()
    (target / "keep.txt").write_text("do not overwrite", encoding="utf-8")

    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--target-dir", str(target)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 2
    assert "not empty" in result.stderr
