from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = ROOT / "harness" / "open_source_watch" / "scripts" / "install_security_tools.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("open_source_security_installer", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_selects_osv_linux_amd64_asset():
    runner = load_runner()
    release = {
        "assets": [
            {"name": "osv-scanner_darwin_amd64"},
            {"name": "osv-scanner_linux_amd64", "browser_download_url": "https://example.com/osv"},
        ]
    }

    asset = runner.select_asset("osv-scanner", release, "linux", "amd64")

    assert asset["name"] == "osv-scanner_linux_amd64"


def test_selects_scorecard_linux_amd64_asset():
    runner = load_runner()
    release = {
        "assets": [
            {"name": "scorecard_5.5.0_linux_arm64.tar.gz"},
            {"name": "scorecard_5.5.0_linux_amd64.tar.gz"},
        ]
    }

    asset = runner.select_asset("scorecard", release, "linux", "amd64")

    assert asset["name"] == "scorecard_5.5.0_linux_amd64.tar.gz"


def test_verify_digest_blocks_mismatch():
    runner = load_runner()

    with pytest.raises(RuntimeError, match="Digest mismatch"):
        runner.verify_digest(b"abc", "sha256:wrong")


def test_write_manifest_records_installed_tools(tmp_path):
    runner = load_runner()
    manifest = tmp_path / "manifest.json"
    installed = [
        runner.InstalledTool(
            name="osv-scanner",
            version="v1",
            asset="osv-scanner_linux_amd64",
            url="https://example.com",
            digest="sha256:test",
            path="/tmp/osv-scanner",
            installed_at="2026-06-07T00:00:00+00:00",
        )
    ]

    runner.write_manifest(installed, manifest)

    assert "osv-scanner" in manifest.read_text(encoding="utf-8")
