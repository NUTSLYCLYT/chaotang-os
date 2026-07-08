# chore-v1-module-taxonomy-20260708

## Intent

Align the visible frontend information architecture with Chaotang OS 1.0.

Primary modules:

- dadian
- shangshufang
- junjichu
- liubu
- zhusi
- shiguan

V1 child modules:

- zhusi: jinyiwei
- liubu/hubu: yusuan, chuna
- liubu/libu: renmian, zhaopin
- liubu/libu_rites: pending
- liubu/bingbu: baojia, xiansuo
- liubu/xingbu: hetong
- liubu/gongbu: chan-yan

## Scope

- Added a frontend SSOT for v1 modules and office exposure.
- Updated top navigation and route metadata to expose only the v1 primary modules.
- Removed old active pages from `src/app` by keeping only v1 route surfaces plus auth/invite/jiqun entry points.
- Deleted old `page.tsx` route archives under `dev/_attic`.
- Removed `next.config.ts` legacy redirects for old paths such as `/throne`, `/overview`, `/manor-dept/*`, and `/departments/*`.

## Verification

- `pnpm exec tsc --noEmit`
- `npx --yes tsx --test src/features/court-console/lib/launch-whitelist.nodetest.ts src/features/departments/lib/department-page-view-builder.nodetest.ts src/features/departments/lib/department-vitrine.nodetest.ts`
