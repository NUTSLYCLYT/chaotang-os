# Change Summary: chore-selective-dev-integration-20260710-20260710

| Field | Value |
| --- | --- |
| Change ID | chore-selective-dev-integration-20260710-20260710 |
| Type | chore |
| Status | IN_PROGRESS |
| Owner | Project Agent |
| Created | 20260710 |

## Scope

- Selectively integrate safe backend and non-UI changes from `origin/dev` into `dev-rpy`.
- Preserve the active API contract alignment boundary:
  - Do not modify UI/page/component/hook implementation.
  - Do not add frontend BFF routes under `frontend/src/app/api/**`.
  - Keep newly added business API clients/adapters and contract audits intact.

## Integrated

- Backend invite-code closure from `020ad06`, excluding frontend page UI changes.
- Jinyiwei backend honesty fix from `3044ad6`.
- Auth guard script fix from `c7999aa`.
- Archive chronicle/outcome backend from `5d990b0`, excluding Shiguan UI changes.
- Scribe lessons backend from `8688fd7`, excluding Shiguan UI changes.
- IMA knowledge backend from `7820dc0`, excluding Shangshufang UI changes.
- Next redirect config from `2b71613`.

## Deferred

- `frontend/src/app/api/court/build-ledger/route.ts`
- `frontend/src/app/api/court/intel/signals/route.ts`
- Page/component/hook UI changes from invite, Shangshufang, Shiguan, Junjichu, Intel and Liubu commits.
- Remote deletion of `frontend/src/features/command-center/junjichu/api/*`, because those files are contract client-layer evidence in the current implementation line.

## Verification

- Run contract and boundary audits after integration.
- Verify backend contract tests that cover the active API alignment work.
- Confirm frontend typecheck still fails only on known workspace UI permission/deletion issues, not on selected dev integration.
