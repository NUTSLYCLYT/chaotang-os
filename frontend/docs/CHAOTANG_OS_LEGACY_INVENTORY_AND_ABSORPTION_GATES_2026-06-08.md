# Chaotang OS Legacy Inventory And Absorption Gates

Date: 2026-06-08

## Scope

This inventory turns `/home/ubuntu/chaotang-os` from an ambiguous legacy repo
into a controlled source-material library.

Mainline remains:

| Concern | Source of truth |
|---|---|
| Frontend product | `/home/ubuntu/workspace/chaotang-web-lyt` |
| Backend, FlowEngine, swarms, governance, harnesses | `/home/ubuntu/workspace/jiqun_ai` |
| Legacy reference only | `/home/ubuntu/chaotang-os` |

No delete or bulk merge is allowed until the gates in this document pass.

## Evidence Snapshot

Commands used:

```bash
git status --short --branch
git diff --name-only
git ls-files --others --exclude-standard
find /home/ubuntu/chaotang-os -path '*/node_modules' -prune -o -path '*/.next' -prune -o -path '*/.git' -prune -o -type f -printf '%P\n'
du -sh /home/ubuntu/chaotang-os/docs /home/ubuntu/chaotang-os/backend /home/ubuntu/chaotang-os/web /home/ubuntu/chaotang-os/bridge /home/ubuntu/chaotang-os/data
```

Summary:

| Metric | Result |
|---|---:|
| Files after excluding `.git`, `.next`, `node_modules` | 485 |
| Modified tracked files | 16 |
| Untracked files | 45+ |
| `docs/` size | 15M |
| `backend/` size | 1.5M |
| `web/` size | 1.8G |
| `bridge/` size | 204K |
| `data/` size | 4K |

Extension distribution:

| Extension | Count | Decision |
|---|---:|---|
| `.ts` | 82 | Review only; cherry-pick behavior |
| `.md` | 77 | High-value extraction candidates |
| `.tsx` | 67 | Review only; no bulk copy |
| `.pyc` | 62 | Reject |
| `.png` | 54 | Asset/reference ledger candidates |
| `.py` | 43 | Backend/bridge idea candidates |
| `.json` | 24 | Review; reports and run outputs usually reject |
| `.yml`, `.log`, `.db`, `.env`, caches | mixed | Reject unless explicitly justified |

## Current Dirty State

Tracked modified files in `/home/ubuntu/chaotang-os`:

| Area | Files | Absorption decision |
|---|---|---|
| Study UX | `web/app/chaotang/study/page.tsx`, `web/lib/study-briefing.ts`, tests, briefing cards | Extract workflow ideas only after comparing with mainline 上书房 |
| Archive UX | `web/app/chaotang/archive/page.tsx` | Extract evidence/archive interaction ideas only |
| War room UX | `web/app/chaotang/war-room/page.tsx` | Extract command-center orchestration ideas only |
| Auth/session | `web/components/auth/session-provider.tsx` | Do not copy blindly; security review first |
| Page transitions / nav / visual polish | top nav, page transition, decree panel, gold lab | Visual reference only; verify with screenshots if adopted |
| DB/schema/package | `web/lib/db/schema.ts`, `web/package.json` | Do not copy without API contract and build impact review |

High-value untracked candidates:

| Candidate | Decision | Target if adopted |
|---|---|---|
| `docs/CHAOTANG_BOARD_MATURITY_ROADMAP.md` | Adopt concept | `jiqun_ai` harness docs or panel review gate |
| `docs/CHAOTANG_PANEL_SKILLS.md` | Adopt as routing reference | Already reflected in local AGENTS/advisors; keep as reference |
| `docs/reviews/BOARD_REVIEW_STUDY.md` | Review | 上书房 maturity scorecard |
| `web/harness/page-design/*` | Selective adopt | `chaotang-web-lyt` screenshot QA / visual rubric if better than current gates |
| `web/lib/workflow-orchestrator.ts` and tests | Review | `jiqun_ai` FlowEngine or `chaotang-web-lyt` BFF only if contract fits |
| `web/lib/court-workflow.ts` and tests | Review | Mainline workflow contract only |
| `web/lib/user-experience-modes.ts` and tests | Review | Mainline already has depth modes; compare before copying |
| `web/app/api/court-workflows/route.ts` | Review | API route only after auth/basePath/security review |

## Asset Inventory

Largest production-looking assets:

| Asset group | Source examples | Decision |
|---|---|---|
| Department PRD images | `docs/design/*.png`, `web/public/design/*.png` | Candidate references; avoid duplicate copies |
| Shangshufang / edict visuals | `edict-real.png`, `study-edict-final.png`, `study-edict.png`, `scroll-rods.png` | Candidate for visual director review |
| Throne / court visuals | `throne-p2.png`, `throne-integration.png`, `soul-final.png` | Reference only unless final route needs them |
| Lab/gold visuals | `lab-fresh.png`, `lab-idle*.png`, `gold-demo.png` | Internal/lab only; not launch proof |
| Harness screenshots | `web/harness/page-design/reports/screenshots/*.png` | Evidence artifacts, not production assets |

Asset gate:

```text
No image moves into production unless the target page, source, intended use,
license/ownership assumption, responsive screenshot, and removal path are recorded.
```

## Absorption Gates

Every adopted item must pass this gate before it enters a mainline repo.

| Gate | Required proof |
|---|---|
| User value | It supports the launch loop or a named department gate |
| Boundary | Target repo and module are explicit |
| Contract | Data/API/output shape is typed, documented, or tested |
| Evidence | Screenshot, focused test, harness output, or source audit exists |
| Safety | Auth, secrets, mock/fallback, financial/media claims reviewed |
| Rollback | File-level rollback path is clear |
| Archive | Source item is marked accepted/rejected/deferred |

Harness shape for backend/workflow ideas:

```text
golden_cases/ -> contracts/ -> evaluators/ -> gates/ -> artifacts/ -> dashboard fields
```

## Migration Backlog

| Priority | Work item | Owner repo | Verification |
|---|---|---|---|
| P0 | Compare old `study` changes against current 上书房 | `chaotang-web-lyt` | `DONE` in `docs/CHAOTANG_OS_P0_ABSORPTION_LEDGER_2026-06-08.md` |
| P0 | Compare old `archive` changes against current 史馆 | `chaotang-web-lyt` | `DONE` in `docs/CHAOTANG_OS_P0_ABSORPTION_LEDGER_2026-06-08.md` |
| P0 | Compare old `war-room` changes against current command center | `chaotang-web-lyt` | `DONE` in `docs/CHAOTANG_OS_P0_ABSORPTION_LEDGER_2026-06-08.md` |
| P0 | Convert board maturity roadmap into current department review checklist | `jiqun_ai` | `DONE` in `/home/ubuntu/workspace/jiqun_ai/docs/chaotang_board_review_checklist_2026-06-08.md` |
| P1 | Evaluate `web/harness/page-design` against existing screenshot QA | `chaotang-web-lyt` | no duplicate harness; better rubric only |
| P1 | Review `workflow-orchestrator` and `court-workflow` contracts | `jiqun_ai` first, frontend only if UI contract needed | focused pytest or TS route tests |
| P1 | Asset ledger review for edict/study/court images | `chaotang-web-lyt` | asset ledger plus desktop/mobile screenshots |
| P2 | Prince backend docs/API lessons | `jiqun_ai` | existing backend tests stay green |
| P2 | Bridge scripts | `jiqun_ai` | rewritten script/harness, no shell-output dependency |

## Reject List

| Source | Reason |
|---|---|
| `backend/.env`, `web/.env.local` | Secret/local config risk |
| `web/local.db`, `web/data/chaotang.db` | Local state, not portable source of truth |
| `bridge/out/*`, `web/data/archive/*` | Run outputs; use only as examples if cited |
| `.pyc`, `__pycache__`, `.pytest_cache`, `.next`, `node_modules`, `tsconfig.tsbuildinfo` | Generated artifacts |
| `web/package.json` from legacy repo | Dependency drift risk |
| Full legacy backend or frontend tree | Mainline already exists; use strangler-style extraction only |

## Deletion Readiness

`/home/ubuntu/chaotang-os` is not deletion-ready today.

It becomes deletion-ready only when:

1. Every item in the migration backlog is marked accepted, rejected, or deferred.
2. Accepted frontend items pass `npm run build` and relevant release/screenshot gates.
3. Accepted backend/workflow items pass focused `pytest` or deterministic harnesses.
4. A cold archive exists outside the repo.
5. The user explicitly approves deletion after seeing the final migration ledger.

Recommended archive command after approval:

```bash
mkdir -p /home/ubuntu/archive
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czf /home/ubuntu/archive/chaotang-os-legacy-2026-06-08.tar.gz /home/ubuntu/chaotang-os
```

Do not run deletion automatically.
