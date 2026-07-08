#!/usr/bin/env python3
"""Conservative Scrapling PoC for Jinyiwei public-source briefs."""

from __future__ import annotations

import argparse
import datetime as dt
import importlib
import json
import re
import sys
import urllib.parse
import urllib.robotparser
from pathlib import Path
from typing import Any


INSTALL_HINT = 'python3 -m pip install "scrapling[fetchers]"'


def check_robots(url: str, user_agent: str = "OracleMentorJinyiweiBot") -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    robots_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "/robots.txt", "", "", ""))
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
        allowed = parser.can_fetch(user_agent, url)
        return {"robots_url": robots_url, "robots_obeyed": True, "allowed": bool(allowed), "error": None}
    except Exception as exc:  # noqa: BLE001
        return {"robots_url": robots_url, "robots_obeyed": False, "allowed": False, "error": str(exc)}


def normalize_text(text: str, max_chars: int = 1600) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:max_chars]


def extract_title(html_or_text: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html_or_text or "", re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return normalize_text(re.sub(r"<[^>]+>", "", match.group(1)), max_chars=200)


def build_record(url: str, status: str, title: str, text: str, robots: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_url": url,
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        "fetcher": "scrapling.Fetcher",
        "status": status,
        "title": title,
        "text_excerpt": normalize_text(text),
        "robots": robots,
        "confidence": "medium" if status == "fetched" and robots.get("allowed") else "low",
        "guardrails": {
            "stealth_enabled": False,
            "cloudflare_solve_enabled": False,
            "login_required": False,
            "paywall_bypass": False,
        },
    }


def fetch_with_scrapling(url: str) -> tuple[str, str]:
    try:
        fetchers = importlib.import_module("scrapling.fetchers")
    except ModuleNotFoundError as exc:
        raise RuntimeError(f"Scrapling is not installed. Install for PoC only: {INSTALL_HINT}") from exc

    fetcher = getattr(fetchers, "Fetcher")
    page = fetcher.get(url)
    html = getattr(page, "html_content", "") or str(page)
    text = getattr(page, "text", "") or html
    return html, text


def run(url: str, out: Path, user_agent: str) -> dict[str, Any]:
    robots = check_robots(url, user_agent=user_agent)
    if not robots.get("allowed"):
        record = build_record(url, "blocked_by_robots", "", "", robots)
    else:
        html, text = fetch_with_scrapling(url)
        record = build_record(url, "fetched", extract_title(html), text, robots)

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description="Run conservative Scrapling PoC")
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", type=Path, default=Path("harness/jinyiwei-scrapling-poc/artifacts/sample.jsonl"))
    parser.add_argument("--user-agent", default="OracleMentorJinyiweiBot")
    args = parser.parse_args()

    try:
        record = run(args.url, args.out, args.user_agent)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    print(json.dumps(record, ensure_ascii=False, indent=2))
    return 0 if record["status"] == "fetched" else 1


if __name__ == "__main__":
    raise SystemExit(main())
