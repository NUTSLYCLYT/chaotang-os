from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "open_source_watch"
RUNNER_PATH = HARNESS / "scripts" / "run_security_poc.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("open_source_security_poc_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_tool_specs_include_security_adopt_candidates():
    runner = load_runner()
    specs = runner.load_tool_specs()
    repos = {spec["repo"] for spec in specs}

    assert "google/osv-scanner" in repos
    assert "ossf/scorecard" in repos
    for spec in specs:
        assert spec["version_command"]
        assert spec["poc_command"]
        assert spec["install"]
        assert spec["evidence_sources"]


def test_osv_default_poc_uses_bounded_lockfile_scan():
    runner = load_runner()
    spec = next(item for item in runner.load_tool_specs() if item["name"] == "osv-scanner")

    assert "--lockfile" in spec["poc_command"]
    assert "--no-resolve" in spec["poc_command"]
    assert "--recursive" not in spec["poc_command"]
    assert spec["deep_scan_command"]


def test_missing_tool_is_recorded_without_failing_poc():
    runner = load_runner()
    spec = runner.load_tool_specs()[0]

    result = runner.evaluate_tool(spec, which=lambda name: None)

    assert result.status == "missing_tool"
    assert result.installed is False
    assert result.version_exit_code is None
    assert result.install
    assert "安装" in result.next_action


def test_installed_tool_runs_version_but_not_poc_by_default(tmp_path):
    runner = load_runner()
    spec = runner.load_tool_specs()[0]
    commands: list[list[str]] = []

    def fake_runner(command, cwd, timeout):
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="v1.0.0", stderr="")

    result = runner.evaluate_tool(
        spec,
        cwd=tmp_path,
        runner=fake_runner,
        which=lambda name: f"/bin/{name}",
    )

    assert result.status == "ready"
    assert result.version_exit_code == 0
    assert result.poc_exit_code is None
    assert commands == [[f"/bin/{spec['version_command'][0]}", *spec["version_command"][1:]]]


def test_run_poc_executes_poc_command_after_version_check(tmp_path):
    runner = load_runner()
    spec = runner.load_tool_specs()[0]
    commands: list[list[str]] = []

    def fake_runner(command, cwd, timeout):
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="{}", stderr="")

    result = runner.evaluate_tool(
        spec,
        cwd=tmp_path,
        run_poc=True,
        runner=fake_runner,
        which=lambda name: f"/bin/{name}",
    )

    assert result.status == "poc_passed"
    executable = f"/bin/{spec['version_command'][0]}"
    assert commands == [
        [executable, *spec["version_command"][1:]],
        [executable, *spec["poc_command"][1:]],
    ]
    assert result.evidence[-1]["phase"] == "poc"


def test_scorecard_missing_token_is_visible_but_not_blocking_readiness(tmp_path):
    runner = load_runner()
    spec = next(item for item in runner.load_tool_specs() if item["name"] == "scorecard")

    def fake_runner(command, cwd, timeout):
        return subprocess.CompletedProcess(command, 0, stdout="help", stderr="")

    result = runner.evaluate_tool(
        spec,
        cwd=tmp_path,
        runner=fake_runner,
        which=lambda name: f"/bin/{name}",
        env={},
    )

    assert result.status == "ready_missing_env"
    assert result.missing_env == ["GITHUB_AUTH_TOKEN"]


def test_run_poc_blocks_when_required_env_is_missing(tmp_path):
    runner = load_runner()
    spec = next(item for item in runner.load_tool_specs() if item["name"] == "scorecard")
    commands: list[list[str]] = []

    def fake_runner(command, cwd, timeout):
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="help", stderr="")

    result = runner.evaluate_tool(
        spec,
        cwd=tmp_path,
        run_poc=True,
        runner=fake_runner,
        which=lambda name: f"/bin/{name}",
        env={},
    )

    assert result.status == "poc_blocked_missing_env"
    assert commands == [[f"/bin/{spec['version_command'][0]}", *spec["version_command"][1:]]]


def test_report_writes_summary(tmp_path):
    runner = load_runner()
    specs = runner.load_tool_specs()

    report = {
        "generated_at": runner.utc_now(),
        "harness": "open_source_security_poc",
        "target": str(tmp_path),
        "run_poc": False,
        "summary": {"missing_tool": 1},
        "results": [
            {
                "name": "osv-scanner",
                "status": "missing_tool",
                "owner": "yushi",
                "missing_env": [],
                "next_action": "install",
            }
        ],
    }
    json_out = tmp_path / "report.json"
    md_out = tmp_path / "report.md"

    runner.write_report(report, json_out, md_out)

    assert "open_source_security_poc" in json_out.read_text(encoding="utf-8")
    assert "开源安全工具 POC 报告" in md_out.read_text(encoding="utf-8")
    assert specs


def test_summarizes_osv_json_findings():
    runner = load_runner()
    stdout = """
{
  "results": [
    {
      "packages": [
        {
          "package": {"name": "litellm", "version": "1.40.0"},
          "groups": [
            {"ids": ["GHSA-test"], "max_severity": "8.7"},
            {"ids": ["GHSA-test-2"], "max_severity": "7.5"}
          ]
        }
      ]
    }
  ]
}
"""

    summary = runner.summarize_osv_stdout(stdout)

    assert summary["affected_packages"] == 1
    assert summary["vulnerability_groups"] == 2
    assert summary["max_severity"] == 8.7
    assert summary["affected"] == ["litellm==1.40.0"]
