from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "build_supply_chain_memorial.py"
TEMPLATE = ROOT / "templates" / "hubu_supply_chain_import"


def test_build_supply_chain_memorial_cli_json(tmp_path: Path):
    output = tmp_path / "supply_chain_memorial.json"
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--input-dir",
            str(TEMPLATE),
            "--output",
            str(output),
            "--as-of",
            "2026-06-22",
        ],
        check=False,
        text=True,
        capture_output=True,
    )

    assert result.returncode == 0, result.stderr
    data = json.loads(output.read_text(encoding="utf-8"))
    assert data["department"] == "户部供应链司"
    assert data["status"] == "needs_boss_decision"
    assert "no_auto_payment" in data["forbiddenActions"]


def test_build_supply_chain_memorial_cli_markdown(tmp_path: Path):
    output = tmp_path / "supply_chain_memorial.md"
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--input-dir",
            str(TEMPLATE),
            "--output",
            str(output),
            "--format",
            "md",
            "--as-of",
            "2026-06-22",
        ],
        check=False,
        text=True,
        capture_output=True,
    )

    assert result.returncode == 0, result.stderr
    text = output.read_text(encoding="utf-8")
    assert "户部供应链司奏折" in text
    assert "不得自动付款" in text
    assert "老板裁决选项" in text
