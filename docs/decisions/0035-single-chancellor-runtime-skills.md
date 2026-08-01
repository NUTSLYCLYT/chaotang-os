# Single Chancellor runtime skills

## Status

Accepted — 2026-07-31

## Context

The product presents one Chancellor, while consultation, drafting, and formal
execution currently use independent graphs and API seams. The separation is a
necessary safety boundary, but treating those capabilities as separate product
agents causes identity, authorization, context, and audit semantics to drift.

## Decision

The product runtime has one Chancellor Agent with versioned Runtime Skills:
`consult`, `draft_decree`, `execute_decree`, and a disabled future
`follow_up` registration.

Existing entrypoints deterministically select one allowed Skill. Models may
suggest a later Skill but cannot execute a transition. Existing graphs remain
separate handlers. Formal execution still requires the current owner-scoped,
one-time draft authority and approved route. MCP remains available only through
bureau evidence requests, the Evidence Protocol, and Jinyiwei.

Runtime Skills are Python-owned product capability contracts. They do not load
or depend on development-time `.agents/skills/*/SKILL.md`.

## Consequences

The product identity becomes coherent without weakening isolation or rewriting
stable graphs. A small registry and dispatcher become shared infrastructure that
must fail closed and remain API-compatible. `follow_up` stays disabled until a
separate product task defines triggers, owner-scoped inputs, and presentation.

## Verification

- `cd backend && .venv/Scripts/python.exe -m pytest`
- `cd backend && .venv/Scripts/python.exe -m ruff check .`
- `node scripts/check_harness.mjs`
