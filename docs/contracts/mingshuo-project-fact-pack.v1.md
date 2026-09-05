# Mingshuo Project Fact Pack V1

## Status

Non-authorizing contract.

## Purpose

`MingshuoProjectFactPackV1` is the first bounded fact packet for the Mingshuo
solution-hub vertical. It lets CourtOS represent candidate SKUs, project facts,
evidence, claims, commercial constraints, channels, and knowledge write-back
without promoting any external source, model, IMA record, or swarm output into
truth.

The packet is designed for manual, non-production pilots first. It does not
authorize publication, quoting, production promotion, equipment control,
dangerous process instructions, customer-data ingestion, or knowledge promotion.

## Core rules

- Tenant, project, version, owner, product line, market, language, source
  policy, evidence, facts, claims, commercial state, channels, safety, and
  knowledge write-back must be explicit.
- Evidence IDs are unique and content-addressed.
- Facts and claims must reference existing ADOPTED, unexpired evidence IDs.
- Claims with missing evidence hold closed.
- Expired certification or market evidence holds closed.
- Pricing or quote output blocks without price authority.
- External publication blocks unless a later successor grants channel authority.
- Knowledge write-back is candidate-only.
- Any dangerous operational chemistry/process/equipment/EHS instruction blocks.
- Final truth source remains CourtOS server-owned evidence binding, not IMA,
  LangGraph, swarm, external model, spreadsheet, or third-party skill.

## Evidence classes

Allowed source classes:

- `PUBLIC_CANDIDATE`
- `SUPPLIER_ASSERTED`
- `INTERNAL_MEASURED`
- `THIRD_PARTY_VERIFIED`
- `FROZEN_RELEASED`

`FROZEN_RELEASED` is not trusted by label alone. A later runtime successor must
verify release registry identity, digest, project/product/version, approval ID,
and revocation state before consuming it as released truth.

## Decisions

The offline checker returns:

- `PASS` when all current facts and claims are evidence-bound and no authority
  conflict exists;
- `HOLD` when data is incomplete, stale, or insufficient;
- `BLOCK` when security, authority, publication, dangerous-operation, price, or
  source-of-truth boundaries are violated;
- `STOP` when the packet shape is invalid or ambiguous.

All outputs include `nonAuthorizing: true`.

## Offline validation contract

The checker executes the versioned schema, not merely a JSON parse. Required
fields, closed object keys, types, enums/constants, string constraints and array
constraints are enforced at every structural level. Only the schema keywords
used by V1 are supported; unsupported future keywords fail closed. Input must
be JSON data (finite numbers, no accessors/cycles/non-JSON values); nesting over
128 levels is rejected. No backend authorization or source authenticity is
established by this offline check. Schema diagnostics are capped at the first
128 violations; any violation still returns STOP. Sparse arrays and extra array
properties are not JSON data and are rejected.

Decision precedence is STOP, then BLOCK, then HOLD, then PASS. Invalid structure
or validation clock produces STOP; summary returns the same errors, empty counts
and `0/0` coverage instead of deriving trusted-looking values from invalid data.
Missing, PROPOSED, REJECTED or expired referenced evidence yields HOLD. Summary
coverage requires every reference on a claim to resolve to ADOPTED, unexpired
evidence, using the same UTC day as validation. Coverage means declared evidence
eligibility only, not substantiation, publication approval or real-world truth.

Dates must be real Gregorian dates (years 0001–9999). `now` accepts a UTC date
or an ISO UTC timestamp ending in Z, with valid hours/minutes/seconds and optional
fractional seconds. Offsets, invalid dates and invalid explicit clocks STOP;
expiry is inclusive through validUntil's UTC day. With no clock, current UTC is
used. CLI `--check` uses only the fixed synthetic fixture and clock, never real
customer input or a live authorization assertion.

A PRICE fact or any quote state except NOT_REQUESTED requires a declared APPROVED
price authority and a non-whitespace approver string; absence BLOCKs. This checks
only a declaration. A future runtime must independently authenticate the user,
tenant, approval, price/version, revocation and storage binding. PASS does not
approve a quote, confirm a claim or enable delivery, publication or knowledge
promotion. Safety flags likewise do not detect dangerous natural-language text.

## Non-goals

- No real IMA ingestion.
- No customer-data ingestion.
- No frontend workbench.
- No backend API or database runtime.
- No channel publication.
- No RFQ sending or price approval.
- No knowledge promotion.
- No equipment, recipe, EHS, or quality release instruction.
- No production deployment.
