# Task 2 Report — 史馆时间轴 outcome 回填

## Status: DONE

## archive_id source
`shiguan_archives.id` is the archive_id. The `ArchiveRecord.id` field is set to `row.id` directly in the
`/api/court/shiguan/archive` route handler. When the UI calls
`POST /api/shiguan/archives/${archiveId}/retrospective`, it passes this same id, which maps 1-to-1 to
the database row. No ID translation needed.

## What was changed

1. `src/lib/contracts/archive.ts` — Added `retrospectiveStatus?: string` to `ArchiveRecord` interface.

2. `src/app/api/court/shiguan/archive/route.ts` — Added `retrospectiveStatus: row.retrospective_status ?? 'not_started'`
   to the shiguan_archives pushUnique call. Non-shiguan rows get undefined (field absent), so only
   shiguan_archives rows trigger the retrospective UI.

3. `src/features/shiguan-ui/components/RetrospectiveControl.tsx` (new) — Small client component with
   status badge (未回填/达成/未达成/部分), three toggle buttons, inline busy/error feedback.

4. `src/features/shiguan-ui/components/TimelinePanel.tsx` — Extended TimelineRow interface with
   archiveId?, retrospectiveStatus?, onRetroUpdate?. Updated ChronicleList and DecisionList to
   render RetrospectiveControl below rows that have archiveId and onRetroUpdate.

5. `src/features/shiguan-ui/components/ShiguanPage.tsx` — Three changes:
   - Added mutate: mutateArchiveRecords from useArchiveRecords(80)
   - Added handleRetroUpdate callback (POST + mutateArchiveRecords)
   - Updated chronicleRows and decisionRows to spread retrospective props when
     record.retrospectiveStatus !== undefined

## TSC result
0 errors in source files. Stale .next-buildcheck/types errors are pre-existing (deleted battery-exchange routes).

## Build result
NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-buildcheck pnpm build succeeded.
/shiguan built as static, all pages compiled without error.

## Commit
5b3ad94 feat(shiguan): 史馆时间轴卡 outcome 回填(达成/未达成/部分)+ 角标
5 files changed, 143 insertions(+), 20 deletions(-)
