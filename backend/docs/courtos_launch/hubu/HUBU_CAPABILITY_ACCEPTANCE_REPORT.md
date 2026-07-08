# Hubu Capability Acceptance Report

## One Line Conclusion

Hubu now has a side-effect-free finance decision pipeline from local CSV intake to boss-reviewable memorial. It is ready for controlled real-data preview, but not yet ready to replace legally accountable accounting, tax filing, banking submission, or production payment execution.

## Current Pipeline

```text
CSV templates
  -> CSV loader
  -> finance intake preview
  -> financial reporting preview
  -> accounting / budget / treasury / financing gates
  -> Hubu memorial rollup
  -> boss decision preview
```

All current modules are local, deterministic, and preview-only.

## Implemented Capabilities

| Capability | Module / file | Status | What it does |
| --- | --- | --- | --- |
| Accounting and audit gate | `src/hubu_accounting_audit.py` | Ready | Checks accounting identity, source labels, ratios, and report number grounding. |
| Budget gate | `src/hubu_budget.py` | Ready | Checks approved budget, usage, remaining amount, near-limit and over-budget gates. |
| Treasury / payment gate | `src/hubu_treasury.py` | Ready | Checks available cash, payment evidence, large payment, related party and external commitment gates. |
| Financial reporting preview | `src/hubu_financial_reporting.py` | Ready | Builds statement drafts, audit findings, financing draft, archive draft and decision actions. |
| Financing readiness gate | `src/hubu_financing_gate.py` | Ready | Checks financing evidence, source labels, DSCR, large financing and pledged asset gates. |
| Hubu memorial rollup | `src/hubu_memorial.py` | Ready | Rolls office gates into one boss-readable recommendation. |
| Finance intake gate | `src/hubu_finance_intake.py` | Ready | Checks sourceLabel coverage, three-way match, bank reconciliation and aging. |
| CSV loader | `src/hubu_finance_csv_loader.py` | Ready | Converts template CSV files into intake `dataSources`. |
| Import templates | `templates/hubu_finance_import/` | Ready | Defines stable CSV headers for real finance data. |
| Preview CLI | `scripts/hubu_finance_import_preview.py` | Ready | Runs CSV import preview and returns JSON summary or full preview. |
| Local workspace init | `scripts/init_hubu_finance_import_workspace.py` | Ready | Creates ignored local working folder for real finance CSVs. |
| Real data guide | `docs/courtos_launch/hubu/REAL_DATA_IMPORT_GUIDE.md` | Ready | Explains how to prepare real finance data safely. |

## Safety Boundaries

The current Hubu system can:

- Validate structured finance facts.
- Detect evidence gaps.
- Detect source label gaps.
- Detect contract / invoice / payment mismatches.
- Detect bank reconciliation gaps.
- Detect aging risks.
- Generate statement previews.
- Generate financing and loan draft previews.
- Generate a boss-readable memorial recommendation.
- Return a safe JSON summary from local CSV files.

The current Hubu system cannot and must not:

- Execute payments.
- Submit loan applications.
- File taxes.
- Change accounting books.
- Replace statutory accounting, audit, tax or legal signatures.
- Write production databases.
- Read arbitrary user drives recursively.
- Store real finance data in git.
- Treat unknown sources as裁决-ready evidence.

## Verification Baseline

Focused Hubu regression currently covers:

```bash
.venv/bin/python -m pytest \
  tests/test_init_hubu_finance_import_workspace.py \
  tests/test_hubu_finance_import_preview_cli.py \
  tests/test_hubu_finance_csv_loader.py \
  tests/test_hubu_finance_import_templates.py \
  tests/test_hubu_finance_intake.py \
  tests/test_hubu_e2e_fact_pack.py \
  tests/test_hubu_memorial.py \
  tests/test_hubu_financing_gate.py \
  tests/test_hubu_financial_reporting.py \
  tests/test_hubu_treasury.py \
  tests/test_hubu_budget.py \
  tests/test_hubu_accounting_audit.py \
  -q
```

Global structural gate:

```bash
.venv/bin/python scripts/validate_flows.py
```

Commit hygiene gate:

```bash
.venv/bin/python scripts/commit_closeout_check.py
```

## Operational Runbook

Create an ignored local workspace:

```bash
.venv/bin/python scripts/init_hubu_finance_import_workspace.py
```

Fill:

```text
local_data/hubu_finance_import_demo/*.csv
```

Preview:

```bash
.venv/bin/python scripts/hubu_finance_import_preview.py local_data/hubu_finance_import_demo \
  --case-id hubu-real-001 \
  --title "2026-06 real finance intake" \
  --period 2026-06
```

Expected safe flags:

```text
previewOnly = true
executionAllowed = false
sideEffects = none
```

## Current Grade

Engineering grade: 86 / 100.

Why not 100:

- No production API endpoint for Hubu intake yet.
- No frontend page wired to the Hubu preview CLI/API yet.
- No real-data sample folder has been reviewed with anonymized company data.
- No exportable PDF/Excel report packet yet.
- No formal audit trail persistence yet.
- No permission model for who can run finance import preview.
- No tax-specific gate.
- No investment portfolio gate is integrated into this finance pipeline yet.
- No supply-chain finance gate is integrated into this finance pipeline yet.

## Recommended Next Tasks

### P0.1: Real Data Dry Run

Create a local ignored sample folder, fill it with anonymized real data, run the preview CLI, and save the result outside git for manual review.

Acceptance:

- CLI returns valid JSON.
- No secrets are present in CSV.
- `sourceCoveragePct` is visible.
- All findings are understood by a human.

### P0.2: Frontend Preview Surface

Add a read-only frontend page or panel that can display the Hubu preview summary.

Acceptance:

- Shows verdict, risk level, source coverage, finding count and next actions.
- Does not upload real data unless explicitly designed later.
- Does not execute payment or financing actions.

### P0.3: API Contract Slice

Expose a preview-only backend function/API for already-structured Hubu fact packs.

Acceptance:

- Returns `previewOnly=true`, `executionAllowed=false`, `sideEffects=none`.
- Rejects missing `dataSources`.
- Covered by API tests.

### P1: Report Packet Export

Generate a local Markdown/JSON report packet from a Hubu preview result.

Acceptance:

- Includes intake summary, reporting summary, findings, evidence gaps and next actions.
- No real data committed to git.

### P1: Tax Gate

Add a tax evidence gate for invoice, tax record, revenue and expense consistency.

Acceptance:

- Detects missing tax records.
- Detects invoice / revenue mismatch.
- Does not file taxes.

### P1: Investment and Supply-Chain Finance Integration

Integrate investment and supply-chain finance findings into Hubu memorial rollup as optional gates.

Acceptance:

- Optional gate inputs can influence risk level and next actions.
- Existing Hubu tests remain green.

## Final Acceptance Statement

Hubu is now a safe preview-grade finance decision subsystem. It can support a business owner by replacing the first-pass整理,校验,审查 and奏折生成 work of accounting, audit, treasury, budget and financing assistants. It cannot yet replace legally accountable professionals or production financial operations. The next best move is controlled real-data dry run, not more abstract design.
