# Jinyiwei Scrapling PoC

Date: 2026-06-07

Purpose: test whether Scrapling should become Jinyiwei's adaptive public-source
crawler.

This PoC is intentionally conservative:

- ordinary public-page fetching only;
- robots.txt checked before fetch;
- no stealth fetcher by default;
- no Cloudflare solving;
- no paywall, login, or ToS bypass;
- JSONL artifacts with source URL, timestamp, status, title, text excerpt, and
  confidence.

Install for local PoC only:

```bash
python3 -m pip install "scrapling[fetchers]"
```

Run:

```bash
python3 harness/jinyiwei_scrapling_poc/scripts/run_scrapling_poc.py \
  --url https://example.com \
  --out harness/jinyiwei-scrapling-poc/artifacts/sample.jsonl
```

If Scrapling is not installed, the runner exits with install guidance and does
not modify project dependencies.
