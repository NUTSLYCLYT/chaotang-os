from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_security_dependency_floors_do_not_regress():
    core = _read("requirements-core.txt")
    test = _read("requirements-test.txt")
    pyproject = _read("pyproject.toml")

    assert "litellm>=1.83.10" in core
    assert "litellm>=1.83.10" in pyproject
    assert "python-multipart>=0.0.27" in core
    assert "pytest>=9.0.3" in test


def test_chromadb_is_not_default_install_until_osv_fixed():
    optional = _read("requirements-optional.txt")
    pyproject = _read("pyproject.toml")

    active_optional_lines = [
        line.strip()
        for line in optional.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert not any(re.match(r"chromadb[<>=]", line) for line in active_optional_lines)
    assert "chromadb" not in pyproject
