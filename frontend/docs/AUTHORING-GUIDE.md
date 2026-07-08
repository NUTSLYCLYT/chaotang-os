# Harness Authoring Guide

> This guide explains who edits which Harness files and when.

## Ownership Matrix

| Area | Primary Author | Edit Frequency | Notes |
| --- | --- | --- | --- |
| `.harness/agents/` | Human + senior agent | Rare | Keep as map, not encyclopedia |
| `.harness/rules/` | Human confirmed | When a lesson becomes law | Prefer mechanical checks when possible |
| `.harness/skills/` | Human + agent drafts | When workflow improves | Stage checklists live here |
| `.harness/wiki/` | Human + agent | Whenever project facts change | Architecture/API/domain facts only |
| `.harness/changes/` | Agent generated | Every material change | Audit trail, not permanent doctrine |
| `AGENTS.md` / `CLAUDE.md` | Human confirmed | Rare | L1 entry and highest-priority index |
| `docs/` | Human + agent | As needed | Durable user/team docs |

## Creating A New Change

```bash
pnpm harness:new-change feat short-name
```

Then follow:

1. Fill `request_analysis/spec.md`.
2. Fill `request_analysis/tasks.md`.
3. Review plan and write `request_analysis/review/spec_review_v1.md`.
4. Implement scoped changes.
5. Write `coding/coding_report_v1.md`.
6. Review code and write `coding/review/code_review_v1.md`.
7. Add appropriate tests or explicitly mark test stage N/A with reason.
8. Record command evidence in `ci_result/ci_summary.md`.
9. Update `summary.md` as stages complete.

## Editing Rules

Use `.harness/rules/` for things that are:

- non-negotiable,
- repeatedly useful,
- product- or architecture-defining,
- capable of being checked by script/test/lint now or later.

Do not put one-off discussion or temporary plans into rules. Use `.harness/changes/{id}` or `dev/notes/`.

## Editing Skills

Use `.harness/skills/` for repeatable work methods:

- request analysis,
- coding,
- review,
- tests,
- deployment,
- stuck diagnosis.

Skills should answer "how to do this stage well" and should point to rules/wiki rather than duplicating them.

## Editing Wiki

Use `.harness/wiki/` for current facts:

- architecture,
- domain terms,
- API/BFF contracts,
- document indexes,
- release operations.

If a wiki fact changes because code changed, update both in the same change.

## Root Document Rule

Root documents should remain entry points:

- `AGENTS.md`: agent L1 map plus historical high-priority law.
- `CLAUDE.md`: session bootstrap.
- `README.md`: human project overview.

Do not keep expanding root files when a new rule/wiki/skill would be clearer.

## Completion Standard

A Harness change is complete only when:

- `pnpm harness:doctor` passes,
- the active change directory has no placeholder `TBD` in delivered files,
- entry docs point to the right Harness files,
- verification evidence is recorded in the change directory.
