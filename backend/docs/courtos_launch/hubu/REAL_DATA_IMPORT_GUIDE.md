# Hubu Real Data Import Guide

## Purpose

This guide explains how to turn real finance files into the CSV inputs expected by the Hubu intake gate.

The current supported path is:

```text
real files -> CSV templates -> CSV loader -> intake preview -> reporting fact pack -> Hubu memorial
```

This guide is for local preview only. It does not approve payments, file taxes, submit loans, change accounting books, or write production data.

## What To Prepare

Create one working folder copied from:

```bash
templates/hubu_finance_import
```

You can create a safe local workspace with:

```bash
.venv/bin/python scripts/init_hubu_finance_import_workspace.py
```

The default output is:

```text
local_data/hubu_finance_import_demo
```

`local_data/` is ignored by git. Put real finance data there, not under `templates/`.

Fill these CSV files from your real source files:

| CSV | Typical source | Required key fields |
| --- | --- | --- |
| `bank_statements.csv` | Bank export | `id`, `direction`, `amount`, `matchRef`, `balanceAfter`, `sourceLabel`, `sourceRef` |
| `contracts.csv` | Contract files | `id`, `counterparty`, `amount`, `sourceLabel`, `sourceRef` |
| `invoices.csv` | Invoice list | `id`, `contractId`, `amount`, `sourceLabel`, `sourceRef` |
| `payment_requests.csv` | Payment request list | `id`, `payee`, `contractId`, `invoiceId`, `amount`, `sourceLabel`, `sourceRef` |
| `receivables.csv` | AR aging | `id`, `counterparty`, `amount`, `daysOutstanding`, `sourceLabel`, `sourceRef` |
| `payables.csv` | AP aging | `id`, `counterparty`, `amount`, `daysOutstanding`, `sourceLabel`, `sourceRef` |
| `budgets.csv` | Budget ledger | `id`, `amount`, `used`, `sourceLabel`, `sourceRef` |
| `trial_balance.csv` | Trial balance / statements | revenue, cost, expense, cash, bank, debt and equity fields |
| `trial_balance_sources.csv` | Source map | `path`, `sourceLabel`, `sourceRef` |
| `cash_flow.csv` | Cash flow statement | `beginningCash`, `cashReceipts`, `cashPayments`, `capex`, `debtProceeds`, `debtRepayments` |

## Source Labels

Use one of these labels:

| Label | Meaning |
| --- | --- |
| `internal_uploaded_file` | File exported from bank, finance software, spreadsheet, invoice system, or uploaded document |
| `manual_confirmed` | Manually verified by the owner/accountant |
| `historical_archive` | Comes from an archived prior CourtOS record |
| `web_research` | Public external reference, such as rate reference |
| `unknown` | Untrusted. This should trigger evidence review. |

For P0, avoid `unknown` unless you deliberately want the intake gate to block and ask for evidence.

## Matching Rules

Use stable IDs:

- `invoices.contractId` must match `contracts.id`.
- `payment_requests.contractId` must match `contracts.id`.
- `payment_requests.invoiceId` must match `invoices.id`.
- `bank_statements.matchRef` should match either `invoices.id` for income or `payment_requests.id` for outgoing payments.

If these IDs do not match, the intake gate will return findings such as:

- `invoice_contract_unmatched`
- `payment_request_unmatched`
- `bank_reconciliation_gap`
- `duplicate_payment_request`

## How To Run Preview

From the repository root:

```bash
.venv/bin/python scripts/hubu_finance_import_preview.py templates/hubu_finance_import
```

For your copied real-data folder:

```bash
.venv/bin/python scripts/hubu_finance_import_preview.py local_data/hubu_finance_import_demo \
  --case-id hubu-real-001 \
  --title "2026-06 real finance intake" \
  --period 2026-06
```

Expected safe output includes:

```text
previewOnly: true
executionAllowed: false
sideEffects: none
```

If you need full machine-readable output:

```bash
.venv/bin/python scripts/hubu_finance_import_preview.py /path/to/your/hubu_finance_import --full
```

## Pass / Block Meaning

Green path:

```text
verdict = ready_for_reporting_preview
riskLevel = low
sourceCoveragePct >= 0.8000
auditFindingCount = 0
archiveEligible = true
```

Blocked or review path:

```text
verdict = needs_evidence
riskLevel = high
auditFindingCount > 0
archiveEligible = false
```

Do not treat a blocked result as a program error. It usually means the data is doing its job by exposing missing evidence or mismatches.

## Do Not Put These Into CSV

Do not include:

- Bank passwords
- API keys
- Login cookies
- Personal identity documents unless explicitly needed and approved
- Full customer private notes
- Raw chat logs
- Unredacted legal disputes
- Any production credential

Use `sourceRef` to point to a file name or controlled archive reference, not to expose secrets.

## Minimum Manual Checklist

Before running the CLI on real data:

1. Confirm every CSV has headers unchanged from `templates/hubu_finance_import`.
2. Confirm `sourceLabel` and `sourceRef` are filled for every business row.
3. Confirm payment IDs, invoice IDs, and contract IDs match.
4. Confirm bank `direction` is exactly `in` or `out`.
5. Confirm amounts are numbers with no formulas.
6. Confirm dates use a consistent format such as `YYYY-MM-DD`.
7. Confirm `trial_balance_sources.csv` covers the major `trialBalance.*` paths.

## Verification Commands

Run the focused checks:

```bash
.venv/bin/python -m pytest tests/test_hubu_finance_import_preview_cli.py tests/test_hubu_finance_csv_loader.py tests/test_hubu_finance_intake.py -q
```

Run the Hubu regression group:

```bash
.venv/bin/python -m pytest \
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

## Next Step

After the CSV preview is green, the next safe engineering step is to build a real-data sample folder outside git, run the CLI against it, and keep the generated output as a local review artifact. Do not commit real customer or company finance data.
