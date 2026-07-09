from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "candidates.json"
DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"
DEFAULT_ENRICHED_OUT = ROOT / "artifacts" / "enriched_candidates.json"

BLOCKED_RISKS = {
    "license_unknown",
    "security_risk",
    "abandoned",
    "hype_only",
    "web_only",
}

MAINLINE_FITS = {
    "qintianjian",
    "shiguan",
    "harness",
    "swarm",
    "yushi",
    "flow",
}

CATEGORY_ROUTE = {
    "security": ["jinyiwei", "yushi", "gongbu", "shiguan"],
    "knowledge": ["jinyiwei", "qintianjian", "gongbu", "shiguan"],
    "agent_eval": ["jinyiwei", "qintianjian", "gongbu", "yushi", "shiguan"],
    "ui_optional": ["jinyiwei", "shiguan"],
}


@dataclass(frozen=True)
class RepoScore:
    repo: str
    url: str
    category: str
    recommendation: str
    total_score: float
    dimensions: dict[str, float]
    blocked_risks: list[str]
    departments: list[str]
    next_action: str
    rationale: list[str]
    evidence: list[dict[str, Any]]
    notes: str


def _clamp(value: float) -> float:
    return max(0.0, min(5.0, round(value, 2)))


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def days_since_iso8601(value: str, now: datetime | None = None) -> int:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    current = now or datetime.now(UTC)
    return max(0, (current - parsed).days)


def score_growth(candidate: dict[str, Any]) -> float:
    stars = int(candidate.get("stars", 0) or 0)
    stars_30d = int(candidate.get("stars_30d", 0) or 0)
    base = min(stars / 2500, 3.0)
    momentum = min(stars_30d / 250, 2.0)
    return _clamp(base + momentum)


def score_maintenance(candidate: dict[str, Any]) -> float:
    pushed_days_ago = int(candidate["pushed_days_ago"]) if "pushed_days_ago" in candidate else 9999
    if pushed_days_ago <= 14:
        return 5.0
    if pushed_days_ago <= 60:
        return 4.0
    if pushed_days_ago <= 180:
        return 3.0
    if pushed_days_ago <= 365:
        return 2.0
    return 0.5


def score_security(candidate: dict[str, Any]) -> float:
    risks = set(candidate.get("risks", []))
    license_name = str(candidate.get("license", "")).strip()
    if risks & {"license_unknown", "security_risk"}:
        return 0.5
    if license_name in {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"}:
        return 4.5
    if license_name and license_name != "NOASSERTION":
        return 3.5
    return 1.0


def score_integrability(candidate: dict[str, Any]) -> float:
    signals = set(candidate.get("signals", []))
    languages = set(candidate.get("languages", []))
    score = 1.5
    if signals & {"cli", "api", "sdk"}:
        score += 2.0
    if signals & {"markdown", "eval", "security", "supply_chain"}:
        score += 1.0
    if languages & {"Python", "TypeScript", "Go"}:
        score += 0.5
    return _clamp(score)


def score_relevance(candidate: dict[str, Any]) -> float:
    category = candidate.get("category")
    fit = set(candidate.get("fit_for_chaotang", []))
    if category == "ui_optional":
        return 1.0
    score = 1.5 + len(fit & MAINLINE_FITS)
    if category in {"security", "knowledge", "agent_eval"}:
        score += 1.0
    return _clamp(score)


def score_poc_cost(candidate: dict[str, Any]) -> float:
    signals = set(candidate.get("signals", []))
    risks = set(candidate.get("risks", []))
    if risks & BLOCKED_RISKS:
        return 1.0
    if signals & {"cli", "markdown", "eval"}:
        return 4.5
    if signals & {"api", "sdk"}:
        return 4.0
    return 2.5


def score_mainline_value(candidate: dict[str, Any]) -> float:
    fit = set(candidate.get("fit_for_chaotang", []))
    category = candidate.get("category")
    if category == "ui_optional" or "skip" in fit:
        return 0.5
    score = 1.0 + 1.25 * len(fit & MAINLINE_FITS)
    if category in {"security", "agent_eval"}:
        score += 1.0
    return _clamp(score)


def make_recommendation(total_score: float, blocked_risks: list[str]) -> str:
    if blocked_risks:
        return "must_not"
    if total_score >= 4.2:
        return "adopt"
    if total_score >= 3.5:
        return "poc"
    if total_score >= 2.8:
        return "watch"
    return "reject"


def route_departments(candidate: dict[str, Any], blocked_risks: list[str]) -> list[str]:
    route = list(CATEGORY_ROUTE.get(candidate.get("category"), ["jinyiwei", "qintianjian", "shiguan"]))
    if blocked_risks and "yushi" not in route:
        route.insert(1, "yushi")
    return route


def next_action_for(recommendation: str, departments: list[str]) -> str:
    if recommendation == "adopt":
        return "钦天监确认主线价值后，工部做 2 小时 POC，御史复核许可证与供应链。"
    if recommendation == "poc":
        return "工部限时验证集成成本，史馆记录验证命令和结果。"
    if recommendation == "watch":
        return "锦衣卫继续观察，暂不占用主线实现周期。"
    if recommendation == "must_not":
        owner = "御史" if "yushi" in departments else "史馆"
        return f"{owner}归档为风险样本，后续同类项目默认拦截。"
    return "史馆归档为不适合当前主线。"


def rationale_for(candidate: dict[str, Any], dimensions: dict[str, float], blocked_risks: list[str]) -> list[str]:
    rationale: list[str] = []
    fit = ", ".join(candidate.get("fit_for_chaotang", [])) or "none"
    rationale.append(f"fit_for_chaotang={fit}")
    if blocked_risks:
        rationale.append(f"blocked_risks={', '.join(blocked_risks)}")
    if dimensions["mainline_value"] < 2.0:
        rationale.append("mainline_value 低，不能因为热度进入主线")
    if dimensions["poc_cost"] >= 4.0:
        rationale.append("2 小时内可验证")
    if dimensions["security"] < 2.0:
        rationale.append("许可证或供应链信号不足")
    return rationale


def score_candidate(candidate: dict[str, Any]) -> RepoScore:
    dimensions = {
        "relevance": score_relevance(candidate),
        "growth": score_growth(candidate),
        "integrability": score_integrability(candidate),
        "security": score_security(candidate),
        "maintenance": score_maintenance(candidate),
        "poc_cost": score_poc_cost(candidate),
        "mainline_value": score_mainline_value(candidate),
    }
    blocked_risks = sorted(set(candidate.get("risks", [])) & BLOCKED_RISKS)
    total_score = round(sum(dimensions.values()) / len(dimensions), 2)
    recommendation = make_recommendation(total_score, blocked_risks)
    departments = route_departments(candidate, blocked_risks)
    return RepoScore(
        repo=str(candidate["repo"]),
        url=str(candidate.get("url", "")),
        category=str(candidate.get("category", "unknown")),
        recommendation=recommendation,
        total_score=total_score,
        dimensions=dimensions,
        blocked_risks=blocked_risks,
        departments=departments,
        next_action=next_action_for(recommendation, departments),
        rationale=rationale_for(candidate, dimensions, blocked_risks),
        evidence=list(candidate.get("evidence", [])),
        notes=str(candidate.get("notes", "")),
    )


def load_candidates(path: Path = DEFAULT_INPUT) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_json(url: str, token: str | None = None, timeout: float = 10.0) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "chaotang-os-open-source-watch",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers)
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def github_api_url(candidate: dict[str, Any]) -> str | None:
    repo = str(candidate.get("repo", "")).strip()
    url = str(candidate.get("url", "")).strip()
    if repo and "/" in repo and not repo.startswith("example/"):
        return f"https://api.github.com/repos/{repo}"
    marker = "github.com/"
    if marker in url:
        suffix = url.split(marker, 1)[1].strip("/")
        parts = suffix.split("/")
        if len(parts) >= 2 and parts[0] != "example":
            return f"https://api.github.com/repos/{parts[0]}/{parts[1]}"
    return None


def enrich_with_github(
    candidate: dict[str, Any],
    *,
    token: str | None = None,
    fetcher: Callable[[str, str | None], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    api_url = github_api_url(candidate)
    enriched = dict(candidate)
    evidence = list(enriched.get("evidence", []))
    if not api_url:
        return enriched

    fetch = fetcher or (lambda url, auth_token: fetch_json(url, token=auth_token))
    try:
        data = fetch(api_url, token)
    except (OSError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        evidence.append(
            {
                "source": "github_repo_api",
                "url": api_url,
                "fetched_at": utc_now(),
                "status": "failed",
                "error": str(exc),
            }
        )
        enriched["evidence"] = evidence
        return enriched

    license_data = data.get("license") or {}
    pushed_at = data.get("pushed_at")
    if isinstance(data.get("stargazers_count"), int):
        enriched["stars"] = data["stargazers_count"]
    if isinstance(pushed_at, str):
        enriched["pushed_days_ago"] = days_since_iso8601(pushed_at)
    if isinstance(license_data, dict) and license_data.get("spdx_id"):
        enriched["license"] = license_data["spdx_id"]
    if data.get("language"):
        languages = list(enriched.get("languages", []))
        if data["language"] not in languages:
            languages.insert(0, data["language"])
        enriched["languages"] = languages

    signals = list(enriched.get("signals", []))
    for signal in ("github_api", "active" if int(enriched.get("pushed_days_ago", 9999)) <= 30 else "maintained"):
        if signal not in signals:
            signals.append(signal)
    enriched["signals"] = signals

    evidence.append(
        {
            "source": "github_repo_api",
            "url": api_url,
            "fetched_at": utc_now(),
            "status": "ok",
            "fields": ["stars", "pushed_days_ago", "license", "languages", "signals"],
        }
    )
    enriched["evidence"] = evidence
    return enriched


def enrich_candidates(
    candidates: list[dict[str, Any]],
    *,
    enrich_github: bool = False,
    token: str | None = None,
) -> list[dict[str, Any]]:
    if not enrich_github:
        return candidates
    return [enrich_with_github(candidate, token=token) for candidate in candidates]


def build_report(candidates: list[dict[str, Any]], *, source_mode: str = "offline") -> dict[str, Any]:
    scored = [score_candidate(candidate) for candidate in candidates]
    return {
        "generated_at": utc_now(),
        "harness": "open_source_watch",
        "source_mode": source_mode,
        "policy": {
            "blocked_risks": sorted(BLOCKED_RISKS),
            "adopt_threshold": 4.2,
            "poc_threshold": 3.5,
            "watch_threshold": 2.8,
        },
        "summary": {
            recommendation: sum(1 for item in scored if item.recommendation == recommendation)
            for recommendation in ["adopt", "poc", "watch", "reject", "must_not"]
        },
        "results": [asdict(item) for item in scored],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# 锦衣卫开源天眼报告",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- harness: `{report['harness']}`",
        f"- source_mode: `{report['source_mode']}`",
        "",
        "## Summary",
        "",
    ]
    for recommendation, count in report["summary"].items():
        lines.append(f"- `{recommendation}`: {count}")
    lines.extend(
        [
            "",
            "## Results",
            "",
            "| Repo | Recommendation | Score | Route | Next action |",
            "|---|---:|---:|---|---|",
        ]
    )
    for item in report["results"]:
        route = " -> ".join(item["departments"])
        lines.append(
            f"| [{item['repo']}]({item['url']}) | `{item['recommendation']}` | "
            f"{item['total_score']:.2f} | {route} | {item['next_action']} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_report(report: dict[str, Any], json_out: Path = DEFAULT_JSON_OUT, md_out: Path = DEFAULT_MD_OUT) -> None:
    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_out.write_text(render_markdown(report), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score open-source projects for Chaotang mainline intake.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    parser.add_argument("--enrich-github", action="store_true", help="Fetch GitHub repository metadata before scoring")
    parser.add_argument("--github-token-env", default="GITHUB_TOKEN", help="Environment variable containing a GitHub token")
    parser.add_argument("--enriched-out", type=Path, default=None, help="Optional path to write enriched candidate JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = None
    if args.enrich_github:
        import os

        token = os.environ.get(args.github_token_env)
    candidates = enrich_candidates(load_candidates(args.input), enrich_github=args.enrich_github, token=token)
    if args.enriched_out:
        args.enriched_out.parent.mkdir(parents=True, exist_ok=True)
        args.enriched_out.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = build_report(candidates, source_mode="github_enriched" if args.enrich_github else "offline")
    write_report(report, args.json_out, args.md_out)
    summary = ", ".join(f"{key}={value}" for key, value in report["summary"].items())
    print(f"open_source_watch complete: {summary}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
