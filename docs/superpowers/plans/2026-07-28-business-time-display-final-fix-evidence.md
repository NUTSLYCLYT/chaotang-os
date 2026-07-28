# Business Time Display Final Fix Evidence

## Scope

This final fix:

- migrated `DepartmentScene.tsx` and `OfficeScene.tsx` from direct
  `selectedReply.repliedAt` rendering to `formatBusinessTime`;
- preserved each original ISO value in semantic `<time dateTime={...}>`;
- added both ministry views to the business-time source guard;
- expanded guarded fields with `repliedAt`, `publishedAt`, `reviewedAt`,
  `expiresAt`, `notBefore`, `investigationStartedAt`, and
  `investigationCompletedAt`;
- added a nonzero positive-offset formatter case.

No payload, controller, sorting, API, database, or evidence-freshness behavior
was changed.

## RED

Command:

```powershell
cd frontend
node --test src/lib/formatBusinessTime.test.ts src/lib/businessTimeUsage.test.ts
```

Observed result: FAIL, 7 passed / 1 failed.

The failing test was
`user-visible business times use the shared formatter in every migrated view`.
It stopped on `DepartmentScene.tsx` because the view did not import
`formatBusinessTime` and directly rendered `selectedReply.repliedAt`. The new
positive-offset formatter test passed during RED, confirming that formatter
production code did not require a change.

## GREEN

Focused test command:

```powershell
cd frontend
node --test src/lib/formatBusinessTime.test.ts src/lib/businessTimeUsage.test.ts src/features/ministries-visual/departmentDirectory.test.ts src/features/ministries-visual/ministriesController.test.ts src/features/ministries-visual/ministriesViewModel.test.ts src/features/ministries-visual/ministriesVisual.test.ts src/features/ministries-visual/ministryRouteResolver.test.ts
```

Observed result: PASS, 29 passed / 0 failed.

Type verification:

```powershell
cd frontend
npm run typecheck
```

Observed result: PASS (`tsc --noEmit`, exit 0).

Scoped diff verification:

```powershell
cd frontend
git diff --check -- src/lib/businessTimeUsage.test.ts src/lib/formatBusinessTime.test.ts src/features/ministries-visual/DepartmentScene.tsx src/features/ministries-visual/OfficeScene.tsx
```

Observed result: PASS (exit 0). Git emitted only LF-to-CRLF working-copy
warnings for the two production view files; no whitespace errors were reported.

## Positive-offset case

The new assertion verifies:

```text
2026-07-28T11:11:36+05:30 -> 2026/07/28 13:41:36
```

This is the exact Asia/Shanghai representation of the same instant.

## Changed files

- `frontend/src/features/ministries-visual/DepartmentScene.tsx`
- `frontend/src/features/ministries-visual/OfficeScene.tsx`
- `frontend/src/lib/businessTimeUsage.test.ts`
- `frontend/src/lib/formatBusinessTime.test.ts`
- `docs/superpowers/plans/2026-07-28-business-time-display-final-fix-evidence.md`

No files were staged or committed.
