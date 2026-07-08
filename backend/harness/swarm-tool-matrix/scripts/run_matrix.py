#!/usr/bin/env python3
"""Score candidate tools for Oracle & Mentor swarm testing.

The harness combines static strategy scores with live GitHub metadata. It is a
selection aid, not an installer.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CANDIDATES_PATH = ROOT / "candidates.json"
ARTIFACTS_DIR = ROOT / "artifacts"


def fetch_github(repo: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{repo}"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def star_score(stars: int) -> float:
    # 100 stars ~= 2, 1k ~= 3, 10k ~= 4, 100k ~= 5.
    return max(0.0, min(5.0, math.log10(max(stars, 1)) + 0.0))


def freshness_score(updated_at: str) -> float:
    updated = dt.datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    now = dt.datetime.now(dt.timezone.utc)
    days = (now - updated).days
    if days <= 30:
        return 5.0
    if days <= 90:
        return 4.0
    if days <= 180:
        return 3.0
    if days <= 365:
        return 2.0
    return 1.0


def license_score(spdx: str | None) -> float:
    if spdx in {"Apache-2.0", "MIT", "BSD-3-Clause", "BSD-2-Clause"}:
        return 5.0
    if spdx in {"NOASSERTION"}:
        return 3.0
    if spdx in {"AGPL-3.0", "GPL-3.0", "GPL-2.0"}:
        return 2.0
    return 2.5


def maturity_score(meta: dict[str, Any]) -> float:
    stars = int(meta.get("stargazers_count") or 0)
    forks = int(meta.get("forks_count") or 0)
    updated_at = meta.get("updated_at") or "1970-01-01T00:00:00Z"
    fork_component = min(5.0, math.log10(max(forks, 1)) + 1.0)
    return round((star_score(stars) * 0.55 + freshness_score(updated_at) * 0.30 + fork_component * 0.15), 2)


def clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def decision(score: float, candidate: dict[str, Any], spdx: str | None) -> str:
    if candidate["risk_penalty"] >= 4 or spdx in {"AGPL-3.0", "GPL-3.0", "GPL-2.0"}:
        return "RESEARCH"
    if score >= 82:
        return "FIRST_WAVE"
    if score >= 70:
        return "SECOND_WAVE"
    if score >= 55:
        return "WATCH"
    return "SKIP"


def score_candidate(candidate: dict[str, Any], weights: dict[str, float], meta: dict[str, Any]) -> dict[str, Any]:
    spdx = (meta.get("license") or {}).get("spdx_id")
    dimensions = {
        "strategic_fit": float(candidate["strategic_fit"]),
        "integration_fit": float(candidate["integration_fit"]),
        "maturity": maturity_score(meta),
        "eval_value": float(candidate["eval_value"]),
        "license_fit": license_score(spdx),
        "security_fit": float(candidate["security_fit"]),
        "maintainability": float(candidate["maintainability"]),
        "risk_penalty": float(candidate["risk_penalty"]),
    }
    positive = sum(dimensions[k] * weights[k] for k in dimensions if k != "risk_penalty")
    penalty = dimensions["risk_penalty"] * weights["risk_penalty"]
    score = clamp_score(((positive - penalty) / 5.0) * 100.0)
    return {
        **candidate,
        "score": round(score, 1),
        "decision": decision(score, candidate, spdx),
        "dimensions": dimensions,
        "github": {
            "stars": meta.get("stargazers_count"),
            "forks": meta.get("forks_count"),
            "updated_at": meta.get("updated_at"),
            "license": spdx,
            "language": meta.get("language"),
            "url": meta.get("html_url"),
            "description": meta.get("description"),
        },
    }


def render_report(results: list[dict[str, Any]]) -> str:
    lines = [
        "# Swarm Tool Matrix Test",
        "",
        f"Generated: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Decision Summary",
        "",
        "| Decision | Tool | Category | Score | Stars | License | Role |",
        "|---|---|---:|---:|---:|---|---|",
    ]
    for r in results:
        gh = r["github"]
        lines.append(
            f"| {r['decision']} | [{r['name']}]({gh['url']}) | {r['category']} | "
            f"{r['score']} | {gh['stars']} | {gh['license']} | {r['role']} |"
        )

    lines.extend(["", "## First-Wave Recommendation", ""])
    first_wave = [r for r in results if r["decision"] == "FIRST_WAVE"]
    for r in first_wave:
        lines.append(f"- **{r['name']}**: {r['recommended_use']}")

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Synthetic-user outputs are hypothesis generators, not real user research.",
            "- Crawling must respect robots, terms, paywalls, rate limits, and licensed-data boundaries.",
            "- Browser agents must run in sandboxed sessions with audit logs.",
            "- Any tool that cannot emit source, timestamp, confidence, and failure reason is not ready for Jinyiwei.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    cfg = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    results = []
    for candidate in cfg["candidates"]:
        try:
            meta = fetch_github(candidate["repo"])
        except Exception as exc:  # noqa: BLE001
            meta = {
                "stargazers_count": 0,
                "forks_count": 0,
                "updated_at": "1970-01-01T00:00:00Z",
                "license": {"spdx_id": None},
                "language": None,
                "html_url": f"https://github.com/{candidate['repo']}",
                "description": f"metadata fetch failed: {exc}",
            }
        results.append(score_candidate(candidate, cfg["weights"], meta))

    results.sort(key=lambda r: (r["decision"] != "FIRST_WAVE", -r["score"], r["name"]))
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS_DIR / "tool_matrix_results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (ARTIFACTS_DIR / "tool_matrix_report.md").write_text(render_report(results), encoding="utf-8")

    for r in results:
        print(f"{r['decision']:11s} {r['score']:5.1f} {r['name']} ({r['github']['stars']} stars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
