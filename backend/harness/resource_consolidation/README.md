# Resource Consolidation Harness

Purpose: help the release crew keep the mainline clean while preserving useful
work from old branches, experiments, and generated resources.

The harness is intentionally conservative:

- default mode is `dry-run`;
- tracked files are never moved;
- environment drift and databases are reported, not cleaned;
- cleanup uses an archive directory with a restore manifest;
- useful harnesses, docs, scripts, prompts, configs, and tests are marked as
  `absorb_candidate` for human review.

## Commands

```bash
python harness/resource_consolidation/scripts/resource_consolidation.py --json
python harness/resource_consolidation/scripts/resource_consolidation.py --report
python harness/resource_consolidation/scripts/resource_consolidation.py --apply --mode archive
python harness/resource_consolidation/scripts/resource_consolidation.py --apply --mode quarantine-local-drift
```

Artifacts:

- `harness/resource_consolidation/artifacts/resource_manifest.json`
- `harness/resource_consolidation/artifacts/resource_report.md`
- archived files under `harness/resource_consolidation/archive/<run_id>/`
- local drift backups and binary patches under `harness/resource_consolidation/archive/<run_id>/`

## Release Gate

Before release, run:

```bash
python scripts/commit_closeout_check.py
python harness/resource_consolidation/scripts/resource_consolidation.py --report
python scripts/validate_flows.py --skip-quality
python scripts/commit_closeout_check.py --strict
```

Full quality release still requires `python scripts/validate_flows.py` to pass
after the quality baseline has been regenerated from the fixed swarms.
