# Build-speed autoresearch (chaotang-web-lyt)

Adapted from karpathy/autoresearch's pattern for a Next.js build instead of an ML training script.
The objective here is **wall-clock seconds for a clean `pnpm build`** — lower is better — with a hard
correctness gate that make ML-style "just try anything" unsafe to copy verbatim: a faster build that
is broken, or faster because a real check got silently turned off, is not a win. It's a loss dressed up
as a win, and worse than doing nothing.

## Scope — what you CAN touch

- `next.config.ts`
- `tsconfig.json` — **only** performance-relevant keys (`incremental`, `skipLibCheck`, module resolution
  strategy, `assumeChangesOnlyAffectDirectDependencies`-style flags). Do not touch `strict`, do not add
  `skipLibCheck` if it changes what's already there in a way that hides real errors — it's already `true`,
  leave it.
- Anything under `.next-buildcheck-baseline` is scratch output, not source — ignore it, don't commit it.

## Scope — what you CANNOT touch (hard boundary, not a suggestion)

- Anything under `src/` — no production source changes, this is a build-config-only experiment.
- Any `scripts/guard-*.mjs`, `scripts/*-gate*.mjs`, or file under `scripts/` — these are the project's
  own correctness gates; weakening them to "win" is exactly the failure mode this file exists to prevent.
- Any test file (`*.nodetest.ts`, `*.itest.ts`, anything under `tests/`).
- **Forbidden config keys, anywhere** — if you catch yourself about to write any of these, stop, that's
  the cheating path, not a real optimization: `ignoreBuildErrors`, `ignoreDuringBuilds`, `transpileOnly`,
  `skipTypeChecking`, `output: 'export'` (changes deployment semantics, not a perf lever), disabling
  `eslint` in `next.config.ts`, removing `"strict": true` from tsconfig.

## The measurement

Run `bash bench.sh` — it does a clean build twice (removing `.next-buildcheck-baseline` first each time,
BUILD_DIR pinned to that scratch dir so it never touches the real `.next/` a running dev/prod server might
be using) and reports:

```
build_ok: true|false
seconds_run1: <float>
seconds_run2: <float>
median_seconds: <float>
```

If `build_ok` is false, that experiment is an automatic crash/discard — do not "fix" it by weakening a
check, actually fix the config or revert.

## The gate (all must hold before you're allowed to log `keep`)

1. `build_ok: true` from `bench.sh` on **both** runs.
2. `npm run test:core` still passes 398/398 (it's currently instant, ~0.9s — if this suddenly gets much
   slower or fails, you broke something, revert).
3. `git diff next.config.ts tsconfig.json` contains none of the forbidden keys listed above (grep it
   yourself before logging a keep — `grep -E "ignoreBuildErrors|ignoreDuringBuilds|transpileOnly|skipTypeChecking" next.config.ts tsconfig.json` must return nothing).

If any of these fail, it's `discard` or `crash`, never `keep`, no exceptions.

## The experiment loop

Branch: `autoresearch/build-speed-jul4` (already checked out, never merge this into anything, it's a
throwaway measurement branch same as the ML autoresearch branch).

LOOP:
1. Look at git state (current commit, current median_seconds baseline).
2. Try one config change to `next.config.ts` or `tsconfig.json` (real Next.js build-speed levers: webpack
   parallelism/workers, incremental TS build cache reuse, disabling source maps for this scratch build
   dir specifically, SWC minify settings, splitChunks tuning, experimental.turbo for build if the
   installed Next version supports it — check `next --version` and the installed version's docs/changelog
   behavior via `node_modules/next/package.json` before assuming a flag exists).
3. `git commit` the config change.
4. Run `bash bench.sh`, capture `build_ok` + `median_seconds`.
5. Run the gate (test:core pass + forbidden-key grep).
6. If gate passes and median_seconds improved: log `keep` to `results.tsv`, keep the commit.
7. Otherwise: log `discard` (or `crash` if build_ok was false) to `results.tsv`, `git reset --hard` back
   to the last kept commit.
8. Repeat. Stop when you're out of good ideas or budget — leave the branch on the best kept commit,
   results.tsv untracked (same convention as the ML version — do not `git add` it).

`results.tsv` columns: `commit	median_seconds	build_ok	status	description`
