# Spec: selective origin/dev integration

## Background

`origin/dev` contains useful backend functionality, but also includes frontend BFF route handlers and large UI/page/component changes. The current implementation boundary forbids both.

## Scope

- Inspect `origin/dev`.
- Integrate only backend, test, script, config and documentation-safe changes.
- Preserve current API contract alignment artifacts and business API clients.

## Non-Goals

- No full merge from `origin/dev`.
- No new frontend BFF route handlers.
- No UI layer changes.
- No deletion of Junjichu API adapter/client evidence.

## Acceptance

- Selected commits are integrated as local commits on `dev-rpy`.
- Boundary audit reports 0 frontend BFF violations and 0 UI layer violations for this integration line.
- Contract audits remain reproducible.

## Verification Plan

- `node scripts/api-contract-boundary-audit.mjs`
- `node scripts/api-contract-inventory.mjs`
- `node scripts/api-contract-client-layer-audit.mjs`
- `node scripts/api-contract-implementation-audit.mjs`
- Targeted backend pytest for contract and newly integrated backend areas.
- `node scripts/harness-doctor.mjs`
