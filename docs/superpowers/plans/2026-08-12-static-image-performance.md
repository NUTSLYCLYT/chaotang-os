# Static Image Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce production image payload and repeat-load latency by converting presentation assets to WebP quality 82, enforcing size budgets, updating references, and applying scoped immutable caching.

**Architecture:** A deterministic Python/Pillow converter creates validated WebP siblings inside `frontend/public`; a Node audit enforces format, dimensions, byte budgets, references, and total size. Source references migrate to the optimized paths before legacy files are removed. Caddy applies immutable caching only to optimized raster paths, while HTML, APIs, Next.js runtime assets, and video retain their existing policies.

**Tech Stack:** Python 3 + Pillow from the bundled Codex runtime, Node.js 24 `node:test`, Next.js 15, TypeScript, CSS Modules, Caddy 2, Docker Compose.

## Global Constraints

- WebP quality is exactly 82; strip metadata.
- Background and hero images are at most 1920×1080, preserve aspect ratio, and are never upscaled.
- Existing portraits and avatars preserve dimensions and are never upscaled.
- Background/hero files are at most 600 KiB; portraits/avatars are at most 150 KiB; total raster assets are at most 12 MiB.
- A re-encoded existing WebP replaces its source only when smaller.
- Preserve layout, crop position, opacity, gradients, rendered dimensions, and ADR0028.
- Do not download image tools or add runtime image transcoding.
- Preserve all unrelated dirty-worktree changes.
- Do not commit, push, deploy, delete deployed releases, or change production until separately authorized.

---

### Task 1: Add a failing asset-policy audit

**Files:**
- Create: `scripts/check_frontend_images.mjs`
- Create: `scripts/check_frontend_images.test.mjs`

**Interfaces:**
- Produces: `checkFrontendImages(root = process.cwd()): Promise<string[]>`.
- Consumes: files below `frontend/public` plus source references below `frontend/src`.

- [ ] **Step 1: Write tests for legacy formats and byte budgets**

Create temporary fixtures and assert errors containing `legacy raster`, `600 KiB`, `150 KiB`, `12 MiB`, and `missing image reference`. Include a valid fixture with one WebP background and one WebP portrait.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/check_frontend_images.test.mjs`

Expected: FAIL because `check_frontend_images.mjs` does not exist.

- [ ] **Step 3: Implement the minimal audit**

Walk `frontend/public`, classify paths containing `portrait`, `avatar`, `character-roster`, or `heroes` as portraits and all other raster assets as backgrounds. Reject `.png`, `.jpg`, `.jpeg`, and `.gif`; enforce 150 KiB/600 KiB and 12 MiB limits; scan `.ts`, `.tsx`, and `.css` quoted `/assets`, `/heroes`, and `/shangshufang` paths and verify each referenced file exists. Export the function and make the command exit nonzero for any error.

- [ ] **Step 4: Verify GREEN and prove the current repository fails policy**

Run: `node --test scripts/check_frontend_images.test.mjs`

Expected: all audit unit tests PASS.

Run: `node scripts/check_frontend_images.mjs`

Expected: FAIL listing the current PNG files and total-size breach.

### Task 2: Add the deterministic converter and generate optimized assets

**Files:**
- Create: `scripts/optimize_frontend_images.py`
- Create: `scripts/optimize_frontend_images.test.py`
- Create/modify: WebP files below `frontend/public`

**Interfaces:**
- Produces: `optimize_image(source: Path, destination: Path, *, quality: int = 82) -> ConversionResult`.
- `ConversionResult` records source/output bytes and output width/height.

- [ ] **Step 1: Write converter safety tests**

Using `unittest` and temporary directories, test quality 82 output, 1920×1080 bounding without upscaling, metadata removal, decode validation, rejection of destinations outside `frontend/public`, and retention of an existing WebP when the candidate is not smaller.

- [ ] **Step 2: Run tests and verify RED**

Run with the bundled Python: `python -m unittest scripts/optimize_frontend_images.test.py -v`

Expected: FAIL because the converter is missing.

- [ ] **Step 3: Implement safe conversion**

Resolve the public root and both paths, require that outputs remain descendants of that root, use `Image.Resampling.LANCZOS`, convert transparency to RGBA and opaque images to RGB, save a temporary sibling with `format="WEBP", quality=82, method=6, exif=b""`, reopen and verify dimensions, then atomically replace the output. Do not delete sources.

- [ ] **Step 4: Convert the inventory**

Convert every PNG/JPEG to the same relative name with `.webp`; evaluate every existing WebP and replace only if the generated candidate is smaller. Emit a manifest table with old/new bytes, dimensions, and percent reduction.

- [ ] **Step 5: Verify generated artifacts**

Run: `python -m unittest scripts/optimize_frontend_images.test.py -v`

Expected: all converter tests PASS.

Run a Pillow decode over every generated WebP.

Expected: every file opens and `verify()` succeeds.

### Task 3: Migrate references and remove superseded sources

**Files:**
- Modify: all exact matches reported by `rg -n '\.(png|jpe?g|gif)' frontend/src`
- Modify: related frontend tests that assert asset paths
- Modify: `frontend/src/features/court-visuals/CourtQuickDock.tsx`
- Delete: only converted source PNG/JPEG/GIF files proven unreferenced

**Interfaces:**
- Consumes: optimized WebP paths from Task 2.
- Produces: source tree containing no reference to removed raster files.

- [ ] **Step 1: Update tests to require WebP paths and Next Image portraits**

Change exact asset-path assertions from `.png` to `.webp`; add an assertion that `CourtQuickDock.tsx` imports `Image` from `next/image` and contains no raw `<img`.

- [ ] **Step 2: Run focused frontend tests and verify RED**

Run: `npm test -- court-entry-pages.test.ts court-migration-assets.test.ts publicEntry.visual.test.ts welcomeContent.test.ts ministriesVisual.test.ts`

Expected: FAIL on old `.png` references and raw `<img>`.

- [ ] **Step 3: Update production references**

Replace only exact static paths with their `.webp` siblings in TSX and CSS. Replace the two `CourtQuickDock` portrait tags with `Image` while preserving `src`, `alt`, class/style behavior, and intrinsic dimensions from the actual files.

- [ ] **Step 4: Prove sources are unreferenced before deletion**

Run: `rg -n '\.(png|jpe?g|gif)' frontend/src frontend/public scripts`

Expected: no production or test references to converted sources; converter/audit test fixtures may mention extensions as policy inputs.

- [ ] **Step 5: Delete only the enumerated superseded source files**

Resolve every candidate under the absolute `frontend/public` root, reject reparse points, print the exact list and count, and then remove only those files. Stop on any mismatch or locked file.

- [ ] **Step 6: Verify GREEN**

Run the focused tests from Step 2 and `node scripts/check_frontend_images.mjs`.

Expected: all tests PASS and the asset audit exits 0.

### Task 4: Apply scoped immutable caching

**Files:**
- Modify: `deploy/Caddyfile`
- Modify: `scripts/check_deployment.mjs`
- Modify: `scripts/check_deployment.test.mjs`

**Interfaces:**
- Produces: an `@optimizedImages` matcher restricted to `.webp` asset paths and `Cache-Control: public, max-age=604800, immutable`.

- [ ] **Step 1: Add a failing deployment test**

Add a fixture whose Caddyfile has the old welcome-only cache rule and assert an error containing `optimized image cache`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: the new cache-policy test FAILS.

- [ ] **Step 3: Implement the matcher and audit**

Add Caddy path matchers for `/assets/*.webp`, `/assets/*/*.webp`, `/assets/*/*/*.webp`, `/heroes/*/*/*.webp`, and `/shangshufang/*.webp`; set the immutable seven-day header. Update `check_deployment.mjs` to require both the scoped matcher and exact header, and to reject a global cache header.

- [ ] **Step 4: Verify GREEN**

Run: `node --test scripts/check_deployment.test.mjs && node scripts/check_deployment.mjs`

Expected: all deployment tests PASS and the check exits 0.

### Task 5: Local quality and visual acceptance

**Files:**
- Create: `docs/failures/2026-08-12-oversized-static-images.md`
- Modify only if a verified regression is found: files already in Tasks 1–4

**Interfaces:**
- Consumes: final local image set and source references.
- Produces: fresh verification evidence and failure memory.

- [ ] **Step 1: Record the production-visible failure**

Document the 28.442 MB baseline, 4.15 MB/16.55 s welcome image, missing non-welcome caching, prevention gates, detection commands, and evidence paths using all five required failure headings.

- [ ] **Step 2: Run full local verification**

Run from `frontend`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Run from repository root: `node scripts/check_frontend_images.mjs`, `node --test scripts/check_frontend_images.test.mjs`, `node scripts/check_deployment.mjs`, `node --test scripts/check_deployment.test.mjs`, `node scripts/check_harness.mjs`, and `git diff --check`.

Expected: every command exits 0.

- [ ] **Step 3: Inspect final inventory**

Print each image path, dimensions, and bytes. Expected: no disallowed legacy raster, each category under its limit, and total at most 12 MiB.

- [ ] **Step 4: Browser visual acceptance**

Build and run the production frontend locally. Inspect `/`, `/login`, `/dadian`, `/junjichu`, `/liubu`, `/zhuanshu`, `/jinyiwei`, `/shiguan`, and `/study` at desktop and 360px width. Expected: no missing images, no console image errors, unchanged crop/layout, and no unintended eager requests for route-inactive backgrounds.

### Task 6: Production gate and ten-round acceptance

**Files:**
- No additional repository changes after acceptance starts.

**Interfaces:**
- Requires: separate user authorization to build/upload/release and update production containers/Caddy.
- Produces: production PASS/FAIL evidence and rollback-ready previous image digest.

- [ ] **Step 1: Stop for deployment authorization**

Present local byte reductions, verification results, changed paths, target frontend image digest, Caddy diff, and rollback digest. Do not deploy until the user separately confirms.

- [ ] **Step 2: Deploy immutably after authorization**

Create a new release directory and digest-qualified frontend image; validate Caddy before replacement; update only frontend/Caddy; retain the current release and image digest. Do not migrate databases, edit secrets, change firewall/SSH/DNS, or delete releases.

- [ ] **Step 3: Run one production browser and HTTP acceptance**

Confirm all three containers healthy, key routes 200, representative images return `image/webp`, immutable cache headers, expected byte sizes, no image 404s, welcome video still plays, and cold-load timings materially improve over the recorded baseline.

- [ ] **Step 4: Run ten consecutive complete rounds**

For the same final image/config version, repeat the complete local audit + container health + public headers + route/browser image check ten times. Log each command, exit code, PASS/FAIL, image bytes, and timing. Any failure or substantive change resets counting to round 1.

- [ ] **Step 5: Report rollback and residual risks**

Report the active and previous image digests, Caddy backup path, exact rollback commands, remaining large assets, network/CDN limitations, and any routes not exercised because authentication or paid API usage would be required.

## Plan Self-Review

- Spec coverage: conversion, dimensions, budgets, references, raw `<img>`, caching, failure memory, local browser QA, deployment authorization, rollback, and ten-round acceptance are covered.
- Placeholder scan: no deferred implementation markers are present.
- Interface consistency: the Node audit and Python converter interfaces are defined once and consumed by later tasks.
- Intentional deviation: Git commit steps are omitted because the active task explicitly forbids committing and pushing.
