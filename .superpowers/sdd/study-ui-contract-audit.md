# `/study` UI contract audit

Scope: read-only review of the revised `/study` migration. Checked the page guard,
the decree client, the existing `POST /api/decrees/chancellor` handler, selector
continuity, and remnants of the discarded three-column workspace. No application
files were changed.

## Contract result

The requested behavioral contracts are preserved in the current working tree:

- `frontend/src/app/study/page.tsx:5-7` remains a server-rendered protected entry
  point and calls `requireUser("/study")` before it renders `StudyClient`.
- The client still submits only to the same-origin `POST /api/decrees/chancellor`
  endpoint with `{ decreeText }` at `frontend/src/app/study/StudyClient.tsx:37-44`.
- Authentication failure is handled without parsing a response body: a 401 redirects
  to `/login?next=%2Fstudy` at `StudyClient.tsx:53-59`. The route also returns 401
  for a missing session at `frontend/src/app/api/decrees/chancellor/route.ts:98-102`.
- All original decree selectors and their success/error data attributes remain in
  `StudyClient.tsx:123-201`: fee notice, textarea, submit button, status,
  rationale, processing path, ministry and bureau opinions, council verdict, final
  verdict, recommendations, `data-decree-ok="true"`, and `data-decree-ok="false"`.

## Findings

### P2 — obsolete three-column state-summary module and test were dead code (resolved)

`frontend/src/app/study/studyWorkspace.ts:1-22` is not imported by the runtime
application; its only reference is its isolated test at
`frontend/src/app/study/studyWorkspace.test.ts:4`. The module labels the removed
workspace stages (for example, the former central-column composition guidance) and
does not contribute to the revised scroll UI. Keeping it makes the discarded design
look supported and adds unrelated test maintenance.

Resolution: removed `studyWorkspace.ts` and `studyWorkspace.test.ts`. This does not
alter the rendered page, request flow, route handler, or visual components.

### P3 — stale `three-axis` test hook remains in the shared header

`frontend/src/components/chaotang/ChaotangHeader.tsx:7` exposes
`data-three-axis-topnav`, and its only repository use is the source-string assertion
at `frontend/src/components/chaotang/ChaotangHeader.test.ts:9`. The new scope is a
common header plus scroll/background, not a three-axis workspace, so this identifier
is stale terminology and an unnecessary test-only coupling.

Recommendation: replace it with a scope-neutral hook only if a selector is actually
needed, otherwise remove both the attribute and its source-string assertion.

## Test-gap note

`frontend/src/app/study/StudyClient.test.ts:12-17` verifies only four of the decree
selectors and the fetch path. The full selector set above is present today, but a
future refactor could delete an unasserted result selector without the test catching
it. Consider extending this source-level contract test to cover all retained result
selectors and the 401 redirect branch.

## Cleanup verification (2026-07-23)

- `rg -n -e 'studyWorkspace|getStudyWorkspaceSummary|StudyWorkspaceTone|StudyWorkspaceSummary' src`
  from `frontend/` reported no remaining references.
- `npm test` from `frontend/` passed: 107 tests, 0 failures (including the Study
  client, protected decree route, and `requireUser` tests).
