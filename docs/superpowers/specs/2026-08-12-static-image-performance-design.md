# Static Image Performance Design

## Goal

Reduce production image transfer time without changing the existing page layout or visual composition. Convert raster presentation assets to reproducible WebP quality 82 outputs, constrain oversized sources, and make immutable static assets cacheable.

## Evidence and Baseline

- `frontend/public` contains 27 raster images totaling 28.442 MB.
- Ten PNG files account for most of the payload; individual files range from 1.623 MB to 3.960 MB.
- Production throughput during the audit was roughly 249–293 KB/s.
- `/assets/v5-pre-auth/welcome-gate-closed.png` transferred 4,152,592 bytes in 16.55 seconds.
- `/assets/zhuangyuan/04-zhuangyuan-liubu-manors.png` transferred 2,865,685 bytes in 11.49 seconds.
- Assets outside `/assets/v5-pre-auth/*` returned `Cache-Control: public, max-age=0`.

## Scope

- Process every raster image under `frontend/public`.
- Convert PNG and JPEG presentation assets to WebP with quality 82.
- Re-encode existing WebP only when doing so reduces size without exceeding the dimensional constraints below.
- Preserve SVG and data-URI artwork unchanged.
- Update every TypeScript, TSX, CSS, and test reference to the resulting paths.
- Remove superseded raster files only after a reference scan proves they are unused.
- Extend deployment and asset checks so oversized or legacy raster assets cannot silently return.
- Extend Caddy caching from the welcome directory to versioned/static raster assets without caching HTML, APIs, or mutable application responses.

## Image Rules

- Encoding: WebP, lossy quality 82, metadata stripped.
- Background and hero images: maximum width 1920 px and maximum height 1080 px, preserving aspect ratio and never upscaling.
- Portraits, avatars, and small UI images: preserve current pixel dimensions; never upscale.
- A converted output must be smaller than its source. If re-encoding an existing WebP is not smaller, retain the original bytes.
- Background/hero target: at most 600 KiB per file.
- Portrait/avatar target: at most 150 KiB per file.
- Repository-wide raster budget under `frontend/public`: at most 12 MiB.
- Visual layout, crop position, opacity, gradients, and component dimensions remain unchanged.

## Reproducible Conversion

Add a repository script that uses the bundled Python runtime and Pillow already available in the Codex workspace for the one-time conversion. The committed outputs, path manifest, quality, dimensional limits, and byte limits are the reproducible artifact; production image building must not download converters or dynamically recompress assets.

The conversion script must operate only inside `frontend/public`, reject paths outside that root, write each result to a temporary sibling, verify it can be decoded, and then replace only the intended output. Source deletion is a separate explicit step after reference validation.

## Loading and Cache Policy

- Keep the welcome background as an eager CSS background because it is required for the first screen.
- Keep route-specific backgrounds route-local; do not add global preload for all court images.
- Keep Next.js `Image` for portraits already using it, with their current rendered dimensions.
- Replace the two raw portrait `<img>` elements in `CourtQuickDock` with `next/image` if tests confirm no layout change.
- Caddy must return `Cache-Control: public, max-age=604800, immutable` for the optimized image paths.
- HTML, `/_next` behavior, API responses, and video caching rules remain unchanged.

## Automated Detection

Add an asset audit that fails when:

- a PNG, JPEG, or GIF remains under `frontend/public` without an explicit allow-list entry;
- a background/hero exceeds 600 KiB;
- a portrait/avatar exceeds 150 KiB;
- total raster size exceeds 12 MiB;
- source code references a deleted image;
- Caddy does not apply the required scoped immutable image cache policy.

Tests must first fail against the current 28.442 MB asset set, then pass after conversion and reference updates.

## Verification

Local verification includes the asset audit, frontend lint, typecheck, unit tests, production build, deployment checks, harness, and `git diff --check`. Visual verification compares key routes at desktop and narrow viewport sizes and checks for missing resources or layout shifts.

Production verification occurs only after separate deployment authorization. It must confirm container health, representative `Content-Type: image/webp`, immutable cache headers, byte sizes, no image 404s, and materially lower cold-load transfer time. The same final version must complete the repository-required ten consecutive acceptance rounds before formal PASS.

## Rollback

Keep the currently deployed frontend image digest and release directory unchanged until the optimized image is verified. Rollback consists of restoring the previous frontend image digest; Caddy cache changes must use new asset paths so cached optimized files cannot mask a rollback.

## Non-Goals

- No CDN introduction.
- No runtime image proxy or dynamic transcoding service.
- No redesign, crop change, color adjustment, or new artwork.
- No API, database, authentication, ADR0028, secret, firewall, or DNS changes.
- No Git commit, push, or production deployment without the separately required authorization.
