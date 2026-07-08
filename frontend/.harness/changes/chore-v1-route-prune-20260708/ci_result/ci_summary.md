# CI Summary

- `pnpm exec tsc --noEmit`: pass
- `NEXT_PUBLIC_API_MODE=real pnpm build`: pass
- `node scripts/harness-doctor.mjs`: fails on pre-existing harness skill frontmatter and `chore-remove-bff-layer-20260708` placeholders; this change directory has no TBD/template placeholders.

Build route output confirmed the canonical 1.0 routes:

- `/dadian`
- `/shangshufang`
- `/junjichu`
- `/liubu`
- `/zhusi`
- `/shiguan`
- `/zhusi/jinyiwei`
- `/liubu/[code]/[office]` with generated v1 office paths.
