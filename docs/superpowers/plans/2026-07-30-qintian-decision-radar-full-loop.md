# Qintian Decision Radar Full-loop Implementation Plan

**Goal:** Deliver authenticated consultation, formal three-scenario analysis,
falsifiable triggers, due review, and safe conversion to the existing Chancellor
draft flow.

## Global invariants

- Qintianjian is advisory only; ADR 0028 remains the sole execution authority.
- No browser-provided owner, external network lookup, Shiguan write, automatic
  investigation, automatic model rerun, or invented probability.
- Formal and tutorial content must have visibly different provenance.
- Every implementation task starts with a failing test.

## Task 1: Backend advisory domain

- [ ] Add strict Pydantic contracts and source guards.
- [ ] Add owner-scoped SQLite schema, atomic persistence, and idempotency.
- [ ] Add non-business consultation and strict formal forecast services.
- [ ] Add authenticated forecast, pending-trigger, and append-only review routes.
- [ ] Verify owner isolation, zero partial writes, fixed error codes, and no
      execution-domain imports.

## Task 2: Frontend contracts and BFF

- [ ] Add runtime parsers for forecast, scenario, trigger, review, and consultation.
- [ ] Add authenticated same-origin route handlers and typed server client calls.
- [ ] Verify opaque-session forwarding, absence of owner input, nullable
      probability, and sanitized provider failures.

## Task 3: Context-safe Study integration

- [ ] Introduce a stable Qintian context for draft, current reply, and archived reply.
- [ ] Ignore stale responses after context changes.
- [ ] Add formal pending/ready/unavailable/failed and trigger-due radar modes.
- [ ] Render three scenarios, assumptions, evidence age, counterfactuals, triggers,
      review actions, and required human signoff.

## Task 4: Consultation and safe handoff

- [ ] Render independent Qintian chat state and source labels.
- [ ] Handle live, fallback, and unavailable provider states honestly.
- [ ] Convert the latest answer only into a prefilled Chancellor draft/consultation;
      never submit a decree.

## Task 5: Review and verification

- [ ] Run focused RED/GREEN tests for each task.
- [ ] Run backend full tests, lint, and type checking.
- [ ] Run frontend full tests, type checking, lint, and production build.
- [ ] Run harness and diff checks.
- [ ] Perform independent spec and code reviews; repair material findings.
