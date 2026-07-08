# Root Layout Audit - 2026-06-23

This note records the current repository root policy after introducing `dev/` as
the development-process root.

## Current Result

Completed:

- `dev/` is the canonical root for development-process files.
- Generated release and QA outputs now default to `dev/artifacts/`.
- Checked-in historical evidence moved from root-level `artifacts/` and
  `screenshots/` into `dev/reference/`.
- Root-level `artifacts/` and `screenshots/` are no longer tracked.
- CourtOS validation contracts moved from root-level `schemas/`, `loops/`,
  `prompts/`, and `evals/` into `dev/contracts/`.

Verified:

- `pnpm exec tsc --noEmit`
- `pnpm package:release -- --skip-build`

## Keep At Repository Root

These paths should remain at root because framework/tooling conventions or
existing scripts expect them there:

- `src/` - application and runtime source.
- `public/` - Next.js static assets.
- `scripts/` - package scripts call these paths directly.
- `e2e/` and `tests/` - Playwright and node test entrypoints.
- `docs/` - many source comments, README links, and operator docs point here.
- `harness/` - harness scripts and historical docs currently read this
  root-relative path.
- `config/` - runtime/config files.
- `.github/`, `.claude/` - tool-owned configuration directories.
- Root config files: `package.json`, lockfiles, `next.config.ts`,
  `playwright.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `Dockerfile`,
  `README.md`, `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`.

## Already Moved Under dev

- `dev/artifacts/` - generated packages, release gates, screenshot QA, and
  similar machine output. Ignored by git.
- `dev/reference/artifacts/alignment-2026-06-08/` - checked-in historical
  alignment evidence.
- `dev/reference/screenshots/` - checked-in visual reference screenshots.
- `dev/contracts/` - checked-in CourtOS validation contracts. Scripts still use
  logical paths like `schemas/Foo.json`, resolved through
  `scripts/lib/dev-contract-paths.mjs`.

## Next Migration Candidates

Do not move these casually. Each needs a dedicated PR with path updates,
validation, and release notes.

1. `harness/`
   - Candidate target: `dev/harness/`.
   - Risk: harness scripts and historical docs use root-relative paths.
   - Required validation: affected harness commands plus docs link check.

2. Long-lived planning docs in `docs/`
   - Candidate target: keep stable docs in `docs/`, move ephemeral handoffs to
     `dev/handoffs/` and working notes to `dev/notes/`.
   - Risk: high reference density from README, AGENTS, source comments, and
     operator docs.

3. `package-lock.json`
   - Keep until Dockerfile/package-manager policy is clarified.
   - Current Dockerfile still copies `package-lock.json`.

## Rule For New Work

New process files should go under `dev/` by default:

- Notes: `dev/notes/`
- Handoffs: `dev/handoffs/`
- Release records: `dev/release/`
- Generated artifacts: `dev/artifacts/`
- Visual evidence: `dev/screenshots/` or checked-in references under
  `dev/reference/`

Only add new root-level files when a framework or toolchain must discover them
there.
