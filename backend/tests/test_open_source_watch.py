from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "open_source_watch"
RUNNER_PATH = HARNESS / "scripts" / "score_repos.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("open_source_watch_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_candidates_have_required_fields():
    candidates = json.loads((HARNESS / "candidates.json").read_text(encoding="utf-8"))
    assert len(candidates) >= 5
    for candidate in candidates:
        assert candidate["repo"]
        assert candidate["url"].startswith("https://")
        assert candidate["category"]
        assert candidate["license"]
        assert isinstance(candidate["signals"], list)
        assert isinstance(candidate["risks"], list)
        assert isinstance(candidate["fit_for_chaotang"], list)


def test_security_scanner_is_routed_to_yushi_and_not_blocked():
    runner = load_runner()
    candidates = runner.load_candidates()
    osv = next(candidate for candidate in candidates if candidate["repo"] == "google/osv-scanner")

    score = runner.score_candidate(osv)

    assert score.recommendation in {"adopt", "poc"}
    assert score.total_score >= 3.5
    assert score.blocked_risks == []
    assert "yushi" in score.departments
    assert score.dimensions["mainline_value"] >= 4.0


def test_openssf_scorecard_is_a_mainline_security_candidate():
    runner = load_runner()
    candidates = runner.load_candidates()
    scorecard = next(candidate for candidate in candidates if candidate["repo"] == "ossf/scorecard")

    score = runner.score_candidate(scorecard)

    assert score.recommendation in {"adopt", "poc"}
    assert "yushi" in score.departments
    assert score.dimensions["security"] >= 4.0
    assert score.dimensions["mainline_value"] >= 4.0


def test_hype_ui_project_is_blocked_from_mainline():
    runner = load_runner()
    candidates = runner.load_candidates()
    hype = next(candidate for candidate in candidates if candidate["repo"] == "example/hype-agent-ui")

    score = runner.score_candidate(hype)

    assert score.recommendation == "must_not"
    assert "license_unknown" in score.blocked_risks
    assert "hype_only" in score.blocked_risks
    assert score.dimensions["mainline_value"] < 2.0
    assert "yushi" in score.departments


def test_abandoned_eval_project_is_not_allowed_to_enter_poc():
    runner = load_runner()
    candidates = runner.load_candidates()
    abandoned = next(candidate for candidate in candidates if candidate["repo"] == "example/abandoned-eval")

    score = runner.score_candidate(abandoned)

    assert score.recommendation == "must_not"
    assert score.blocked_risks == ["abandoned"]
    assert score.dimensions["maintenance"] < 1.0


def test_zero_day_push_counts_as_fresh_maintenance():
    runner = load_runner()

    assert runner.score_maintenance({"pushed_days_ago": 0}) == 5.0


def test_report_writes_json_and_markdown(tmp_path):
    runner = load_runner()
    report = runner.build_report(runner.load_candidates(), source_mode="offline")
    json_out = tmp_path / "latest.json"
    md_out = tmp_path / "latest.md"

    runner.write_report(report, json_out, md_out)

    stored = json.loads(json_out.read_text(encoding="utf-8"))
    markdown = md_out.read_text(encoding="utf-8")
    assert stored["harness"] == "open_source_watch"
    assert stored["source_mode"] == "offline"
    assert stored["summary"]["must_not"] >= 2
    assert "google/osv-scanner" in markdown
    assert "source_mode" in markdown
    assert "锦衣卫开源天眼报告" in markdown


def test_github_enrichment_updates_repo_metadata_without_mutating_source():
    runner = load_runner()
    candidate = {
        "repo": "owner/tool",
        "url": "https://github.com/owner/tool",
        "description": "tool",
        "category": "agent_eval",
        "stars": 1,
        "stars_30d": 0,
        "pushed_days_ago": 999,
        "license": "NOASSERTION",
        "languages": [],
        "signals": ["eval"],
        "risks": [],
        "fit_for_chaotang": ["harness"],
        "notes": "",
    }

    def fake_fetcher(url, token):
        assert url == "https://api.github.com/repos/owner/tool"
        assert token == "token"
        return {
            "stargazers_count": 4200,
            "pushed_at": "2026-06-01T00:00:00Z",
            "license": {"spdx_id": "Apache-2.0"},
            "language": "Python",
        }

    enriched = runner.enrich_with_github(candidate, token="token", fetcher=fake_fetcher)

    assert candidate["stars"] == 1
    assert enriched["stars"] == 4200
    assert enriched["license"] == "Apache-2.0"
    assert "Python" in enriched["languages"]
    assert "github_api" in enriched["signals"]
    assert enriched["evidence"][0]["source"] == "github_repo_api"
    assert enriched["evidence"][0]["status"] == "ok"


def test_github_enrichment_records_failure_as_evidence():
    runner = load_runner()
    candidate = {
        "repo": "owner/tool",
        "url": "https://github.com/owner/tool",
        "signals": [],
    }

    def fake_fetcher(url, token):
        raise TimeoutError("timeout")

    enriched = runner.enrich_with_github(candidate, fetcher=fake_fetcher)

    assert enriched["evidence"][0]["status"] == "failed"
    assert "timeout" in enriched["evidence"][0]["error"]
