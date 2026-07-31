# Qintianjian advisory domain

## Status

Accepted — 2026-07-30

## Context

The first Qintianjian slice projects `/study` page facts into a decision radar. The
complete product also needs authenticated consultation, formal three-scenario
analysis, falsifiable triggers, and human review. The legacy `feature-chaotang-ext`
implementation mixes mock data, anonymous routes, JSONL ledgers, external-market
lookups, and Shiguan archive writes. Those choices conflict with ADR 0027 and ADR
0028: private data must be owner-scoped, decrees remain the only execution entry,
and Shiguan public records remain MEMORIAL/REPLY.

## Decision

Qintianjian is an advisory domain, not an execution authority.

- FastAPI exposes authenticated `/api/v1/qintianjian/*` contracts behind same-origin
  Next.js BFF routes. Browser requests never provide an owner identifier.
- Formal forecasts, scenarios, assumptions, triggers, and append-only reviews are
  stored in an independent owner-scoped SQLite database. The domain does not join
  another domain database and does not write Shiguan records.
- A formal forecast is created only after an explicit user action and is bound to
  an immutable decree-draft snapshot or an owner-visible reply reference.
- Every forecast has exactly three named scenarios, explicit assumptions,
  falsifiable triggers, evidence provenance, and a human-review date.
- Probability intervals are nullable. They remain null unless an approved,
  versioned calibration method exists; clients must not synthesize a probability.
- Consultation is non-business and non-persistent on the backend. Provider
  unavailability is explicit and must not be presented as a live prediction.
- Trigger review is append-only. KEEP, INVALIDATE, REQUEST_RERUN, and
  ESCALATE_TO_CHANCELLOR record human intent; none executes a decree, starts an
  investigation, or silently invokes another model.
- Escalation or “convert to decree” may only prefill an existing Chancellor draft
  flow. The user must still confirm through the sole ADR 0028 execution path.

## Consequences

The design preserves a clear trust boundary and provides auditable review without
creating a second execution system. It adds a database, API surface, BFF surface,
and shared contract validation that must be maintained. Forecast generation can
fail visibly when the provider is unavailable. Automated external signal
collection and calibrated probabilities remain out of scope until separately
approved with evidence-source governance.

## Verification

Run:

```text
cd backend
python -m pytest
python -m ruff check .
python -m mypy app
cd ../frontend
npm test
npm run typecheck
npm run lint
npm run build
cd ..
node scripts/check_harness.mjs
```
