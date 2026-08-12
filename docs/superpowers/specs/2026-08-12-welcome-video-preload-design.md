# Welcome Video Preload Design

## Goal

Load the welcome gate video as soon as the root page renders, keep the "上朝" action clickable, and guarantee navigation to `/login` even on slow or failed media delivery.

## Interaction

- Mount the video during the initial `closed` phase with `preload="auto"`, paused and visually hidden behind the existing background.
- Record media readiness without disabling the action.
- On click, play immediately when ready. Otherwise show `宫门准备中…`, wait for readiness, and fall back to `/login` after 4 seconds.
- Natural completion routes to `/login`. Media load errors, rejected playback, reduced-motion preference, and timeout also route to `/login`.
- Accept only the first click and clear pending timers on navigation or unmount.

## Delivery Performance

- Keep HTML and API caching unchanged.
- Add a long-lived cache header only for `/assets/v5-pre-auth/*`; deployment must invalidate changed assets by changing their filenames before treating that cache as immutable.
- This change does not install an unpinned media tool. PNG transcoding remains a separate follow-up because no approved encoder is present in the workspace.

## Verification

- Pure state-machine tests cover ready, waiting, timeout, error, completion, reduced motion, and duplicate clicks.
- Source-contract tests prove initial video mounting and `preload="auto"`.
- Run frontend lint, typecheck, tests, build, deployment checks, and the repository harness for 10 consecutive unchanged rounds.

