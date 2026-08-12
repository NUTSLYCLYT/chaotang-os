# Oversized Static Images

## Summary

The production frontend shipped 28.442 MB of static raster images. The welcome image alone transferred 4.15 MB and took 16.55 seconds to load, while non-welcome images lacked an explicit immutable cache policy.

## Root Cause

Large source rasters were copied into the production public tree without a repository-enforced format, per-category byte budget, aggregate budget, or source-reference audit. Deployment checks covered the welcome media cache but did not require caching for the other optimized route images, so repeated navigation could pay the transfer cost again.

## Prevention

Convert production raster assets to WebP while preserving their intended dimensions and crop behavior. Enforce 150 KiB for portraits, 600 KiB for other raster images, and 12 MiB for the complete public raster inventory. Reject legacy PNG/JPEG/GIF files and missing source references. Keep the reverse-proxy image cache matcher narrow and immutable instead of applying a global cache header to HTML, APIs, or video.

## Detection

Run `node scripts/check_frontend_images.mjs` and `node --test scripts/check_frontend_images.test.mjs` to detect legacy formats, oversized category files, aggregate budget regressions, and missing references. Run `node scripts/check_deployment.mjs` and `node --test scripts/check_deployment.test.mjs` to detect missing optimized-image caching or unsafe global cache headers. Local production browser acceptance must also inspect desktop and 360px layouts, console/network failures, and route-specific resource timing entries so route-inactive backgrounds are not fetched eagerly.

## Evidence

- Baseline: 28.442 MB total production raster inventory; welcome image 4.15 MB and 16.55 s load time.
- `docs/superpowers/specs/2026-08-12-static-image-performance-design.md`
- `docs/superpowers/plans/2026-08-12-static-image-performance.md`
- `scripts/check_frontend_images.mjs`
- `scripts/check_frontend_images.test.mjs`
- `scripts/check_deployment.mjs`
- `scripts/check_deployment.test.mjs`
- `deploy/Caddyfile`
- `.superpowers/sdd/task-5-report.md`
