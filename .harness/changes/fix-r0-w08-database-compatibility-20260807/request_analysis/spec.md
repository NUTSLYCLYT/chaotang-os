# Specification: R0-W08 Database Compatibility

## Problem

The EXT baseline has W06 artifact-delivery tables and W07 lineage columns, while `schema_adoption.py` still treats only the earlier secure-ingest tables and columns as later additions. Compatible legacy databases are therefore rejected, and migration tests still assert an obsolete head in the candidate history.

## Contract

1. Legacy adoption must recognize post-adoption artifact-delivery tables as later schema additions.
2. Adoption validation must tolerate the approved later columns, indexes, and checks when they are present as a complete later slice.
3. A partial later slice must remain incompatible.
4. Unversioned databases containing post-adoption tables must remain rejected unless the adoption contract explicitly treats them as a later slice.
5. Fresh migration tests must assert the current repository migration head, not a historical head.

## Data and safety boundary

This change only inspects schema metadata and tests temporary databases. It must not connect to, migrate, or mutate a persistent database.

## Acceptance

- Focused adoption and migration tests pass.
- Existing W08 product acceptance tests remain unchanged and pass.
- No changed path falls outside the approved implementation scope plus this amendment record.
