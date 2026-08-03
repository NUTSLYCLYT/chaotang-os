# Downstream Agent runtime skills

## Status

Accepted — 2026-08-03

## Context

The Chancellor already owns three Runtime Skills, while the Junjichu, six
ministries, and 39 bureaus need independently versioned professional methods,
permissions, report contracts, and audit identities. These 46 downstream
definitions must remain one-to-one without duplicating common execution logic or
changing the established decree and evidence flow.

## Decision

Adopt one immutable downstream Runtime Skill definition per Junjichu,
ministry, and bureau Agent. Definitions own professional methods and report
contracts; a shared executor owns invocation, validation, policy enforcement,
and audit. Existing Chancellor LangGraph topology and ADR 0028 remain unchanged.

## Consequences

The 1 Junjichu, 6 ministry, and 39 bureau Agents receive exactly 46 distinct,
versioned Runtime Skill definitions with explicit report and permission
boundaries. Common execution remains centralized, and bureau Skills remain
controlled calls inside the existing flow rather than becoming 39 LangGraph
nodes. The frontend, API, Chancellor Skills, and ADR 0028 business flow do not
change.

## Verification

- Registry and contract tests prove one-to-one coverage, uniqueness, permission
  enforcement, report validation, degradation, audit, and capability migration.
- Existing backend compatibility tests and `node scripts/check_harness.mjs` pass.
- The final unchanged implementation and verification suite pass 10 consecutive
  complete rounds with per-round evidence.
