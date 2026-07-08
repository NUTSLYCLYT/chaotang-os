# Chaotang Web LYT Release Candidate

Date: 2026-06-07
Branch: `absorb/chaotang-ui-ms-roundtable`
Base commit: `0b9f7f9 feat: close chaotang trusted dev loop`

## Product Position

Main product: `先知和导师 (Oracle & Mentor)`.

Chaotang OS is the trusted governance and workflow layer for using AI agents to solve real work. Mingshuo is the first customer and reference implementation, not the whole business.

## RC Scope

This release candidate closes the internal development loop:

1. 工部 receives a concrete development task with file boundary, acceptance commands, rollback language, and archive target.
2. 军机处 receives the build ledger entry, shows status, owners, next action, and an audit timeline.
3. 史馆 reads build ledger entries, independent audit events, knowledge cases, lessons, and RAG entry points from one unified memory router.
4. 上书房 now exposes role scenarios for operations, sales, and content users so non-founder users can see their own work language.

## Demo Path

Golden path:

`/gongbu/dev-console -> /command-center -> /shiguan -> /scribe?tab=recall -> /jiqun/knowledge`

Suggested demo:

1. Open 工部开发工作台 and dispatch `建设朝堂开发工作台 MVP`.
2. Open 军机处 and show the build ledger inbox.
3. Show the empty audit timeline before review.
4. Click `开始复核`, then show the server-authored timeline event.
5. Archive to 史馆.
6. Open 史馆 and show `统一记忆入口`, independent audit, build ledger, lessons, and RAG links.

## Acceptance Gates

Required before treating this as a usable internal RC:

- `pnpm exec tsc --noEmit`
- `pnpm exec playwright test e2e/gongbu-dev-workbench.spec.ts --project=chromium`
- `pnpm exec playwright test e2e/shangshufang-ux.spec.ts --project=chromium`
- `npm run build`
- `HARNESS_BASE_URL=<prod-url> HARNESS_BASE_PATH=/chaotang node scripts/synthetic-user-harness.mjs`

Latest local RC verification:

- TypeScript: passed.
- Gongbu/Shiguan trusted loop E2E: passed.
- Shangshufang UX E2E: passed.
- Production build: passed.
- Synthetic user harness: `SHIP`, 12/12 personas passed, average score `10`.

Report artifact:

- `dev/artifacts/synthetic-user-report-rc-2026-06-07.json`

## Current Known Risks

- The system is suitable for internal development use, but not yet a polished external launch.
- Build ledger persistence is file-backed; production needs a database-backed audit store with tenant isolation.
- Lessons and knowledge kernel are visible in 史馆 but not yet automatically recalled into every 上书房 or 工部 drafting flow.
- Role language has improved for operations, sales, and content, but each department still needs its own narrow golden case.
- Production release still requires security review, deployment review, and human signoff.

## Next Task Card

Title: `让统一记忆入口反哺上书房起草`

Owner: 史馆 + 上书房 + 工部

Goal: before a new decree is drafted, fetch relevant build ledger, audit, lessons, and knowledge cases, then show a small "历史可复用依据" panel beside the decree input.

Acceptance:

- 上书房 can show at least three recalled items before dispatch.
- Recalled items have source, timestamp, confidence or match reason.
- User can ignore or apply recalled context.
- E2E proves recall appears for a known development task.

## Release Decision

Current recommendation: `INTERNAL_RC`.

Use it to develop Chaotang with Chaotang. The synthetic user harness is now `SHIP`, but do not sell it as a finished external product until production audit is database-backed and the customer demo has one narrow vertical winner.
