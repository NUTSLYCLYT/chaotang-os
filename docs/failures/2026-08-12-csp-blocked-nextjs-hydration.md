# CSP Blocked Next.js Hydration

## Summary

The production welcome page rendered visually, but clicking "上朝" did not run the client-side transition or play the opening video.

## Root Cause

The Caddy deployment policy set `script-src 'self'`. Next.js emitted first-party inline bootstrap scripts for hydration, so browsers blocked those scripts and left the server-rendered page without React event handlers.

## Prevention

Keep the deployment CSP compatible with the rendering mode actually produced by the pinned Next.js build. Until nonce-based rendering is adopted end to end, explicitly permit the required first-party inline hydration scripts and keep all other script sources restricted to `self`.

## Detection

`scripts/check_deployment.mjs` must reject a Caddy CSP that omits the hydration allowance. Production browser acceptance must also fail on CSP console errors and prove that clicking "上朝" advances the video state.

## Evidence

- `deploy/Caddyfile`
- `scripts/check_deployment.mjs`
- `scripts/check_deployment.test.mjs`
- `docs/decisions/0041-single-host-container-deployment.md`
