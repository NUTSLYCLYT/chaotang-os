# Welcome Media Stall

## Summary

The production welcome page appeared unresponsive after clicking "上朝", while large first-party media loaded slowly.

## Root Cause

The opening video was mounted only after the click and navigation depended on its `ended` event. While the media buffered, the UI disabled the action and provided no waiting state or bounded fallback. Welcome assets also used revalidation caching, so repeat visits did not receive an effective long-lived asset cache.

## Prevention

Mount and preload the video during initial render, preserve an actionable button, model the waiting state explicitly, and converge timeout and media failures on `/login`. Keep media caching scoped away from HTML and APIs.

## Detection

The welcome transition unit tests must cover click-before-ready and timeout behavior. `welcomeContent.test.ts` must assert initial video mounting and preload. Deployment checks must assert the scoped media cache rule. Production acceptance must inspect the media response headers and exercise the public entry page without invoking business APIs.

## Evidence

- `frontend/src/features/welcome/WelcomeGate.tsx`
- `frontend/src/features/welcome/welcomeTransition.ts`
- `frontend/src/features/welcome/welcomeContent.test.ts`
- `deploy/Caddyfile`
- `docs/superpowers/specs/2026-08-12-welcome-video-preload-design.md`

