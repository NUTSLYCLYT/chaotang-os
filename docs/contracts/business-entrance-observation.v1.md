# Business Entrance Observation V1

## Status

Non-authorizing contract.

## Purpose

Business Entrance Observation V1 gives CourtOS one deterministic, read-only map
for business entry convergence. It helps future successors identify canonical,
observed, migration-required, and forbidden entrance families before touching
runtime code.

The contract is intentionally not an execution authority. It cannot approve
product work, retire routes, activate providers, create candidates, write
Shiguan records, deploy production, or consume donor identities.

## Output shape

The checker emits JSON with:

- `schemaVersion`: `chaotang.business-entrance-observation.v1`
- `decision`: `PASS` or `STOP`
- `nonAuthorizing`: always `true`
- `baseline`: current repository `head`, `tree`, and `branch`
- `canonicalFamilies`: server-owned business chain and projections
- `observeFamilies`: compatibility surfaces that need observation
- `migrationRequiredFamilies`: old or donor-only entrances requiring a successor
- `forbiddenPatterns`: patterns that must fail closed
- `requiredAnchors`: repository paths that must exist for the current map
- `nextSuccessor`: the narrow next successor recommendation
- `errors`: empty on `PASS`, non-empty on `STOP`

## Family rules

Canonical families are the current accepted business flow:

1. authenticated browser session;
2. Chancellor draft preparation;
3. explicit decree;
4. persistent decree job;
5. Shiguan archive and recall;
6. Junjichu case projection;
7. Scene Pack V1 roadshow surface;
8. Honglusi capability gate UI.

Observe families are compatibility surfaces that may still be called. They need
telemetry and replacement evidence before retirement.

Migration-required families are old direct/swarm/orchestration/flywheel/
knowledge writer lineages and dirty donor assets. They must be handled by
separate successors and cannot become current product identity through bulk
merge.

## Forbidden patterns

The checker must reject:

- a second product authority;
- a second truth ledger;
- a second Shiguan writer;
- direct/swarm business execution outside the canonical chain;
- production deployment claims;
- external publication activation;
- unobserved route retirement;
- dirty donor bulk import;
- Mingshuo or IMA as a second source of truth.

## Retirement rule

Legacy route retirement is not allowed by this contract. A future successor must
provide telemetry or an explicit Owner lifecycle exception. The default minimum
observation period is 14 continuous days of zero invocation.

## Non-goals

- No backend runtime rewrite.
- No frontend route rewrite.
- No database migration.
- No authority or Harness runtime change.
- No external provider, IMA, MCP, Alibaba, website, mini-program, email, RFQ, or
  production publication activation.
- No branch/worktree cleanup.
- No production deployment.
