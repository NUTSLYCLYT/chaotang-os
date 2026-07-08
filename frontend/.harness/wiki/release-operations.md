# Release Operations

## Ports

- Dev: 3002
- Production: 3050
- Forbidden: 3001

## Common Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm test:e2e
pnpm harness:doctor
pnpm gate:prod-release
```

## Release Evidence

For release-facing changes, capture:

- build command and result
- start/preview command and result
- route smoke checks
- Playwright result or screenshot evidence for visual changes
- any console errors found
- LIVE/MIXED/DEMO boundary if runtime data is displayed

Write the evidence to `.harness/changes/{change-id}/deployment/preview_report.md`.
