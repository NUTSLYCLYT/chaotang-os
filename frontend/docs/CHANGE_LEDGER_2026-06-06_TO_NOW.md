# Change Ledger: 2026-06-06 00:00 to 2026-06-08

> Scope: distinguish mainline work, experiment worktrees, local Codex/Claude configuration, and generated/runtime artifacts. Timezone: Asia/Shanghai.

## Classification Rules

- Mainline frontend: `/home/ubuntu/workspace/chaotang-web-lyt`.
- Mainline backend/harness: `/home/ubuntu/workspace/jiqun_ai`.
- Experiment or legacy worktree: any Chaotang repo outside the two mainlines unless explicitly promoted.
- Configuration: `/home/ubuntu/AGENTS.md`, `/home/ubuntu/.codex`, `/home/ubuntu/.claude`.
- Runtime artifacts: `.next/`, `node_modules/`, Playwright logs, browser caches, SQLite WAL/SHM, `swarm_sessions/`, `events/`, local screenshots, npm logs.

Runtime artifacts may be useful as evidence, but they are not product source changes.

## Mainline Frontend

Repository: `/home/ubuntu/workspace/chaotang-web-lyt`

Remote: `git@gitee.com:msxn/chaotang-web-lyt.git`

Status: point-in-time snapshot. When this ledger was written, the true-loop work
batch (this ledger, the launch/absorption plan + inventory + P0 docs,
`docs/TRUE_LOOP_MAP_2026-06-08.md`, `docs/TRUE_MODE_HEALTH_AUDIT_2026-06-08.md`,
`e2e/true-loop-contract.spec.ts`) plus an in-flight dadian responsive-polish change
(`src/features/dadian/*`, `src/app/(dashboard)/layout.tsx`,
`src/features/shared/lib/court-onboarding-paths.ts`) were uncommitted in the working
tree. All of it was verified (tsc clean, true-loop E2E green) and committed on
2026-06-08; aligned with `origin/master` otherwise.

Committed changes since 2026-06-06: 54 commits.

Primary areas changed:

- Shangshufang/study entry: `src/features/shangshufang/`, `src/app/(dashboard)/study/page.tsx`.
- Command center and swarm views: `src/app/(dashboard)/command-center/`, `src/app/(dashboard)/jiqun/`.
- Gongbu dev workbench: `src/app/(dashboard)/gongbu/dev-console/`.
- Donggong decision/draft loop: `src/app/(dashboard)/donggong/`, `src/features/donggong/`.
- Shiguan archive/release evidence: `src/app/(dashboard)/shiguan/`, `src/features/shiguan-ui/`, `src/app/api/court/shiguan/`.
- True-chain health gate: `src/app/api/court/true-chain-health/route.ts`.
- Operating loop/build ledger/object passport: `src/features/operating-loop/`.
- Release and screenshot gates: `scripts/final-release-harness.mjs`, `scripts/chaotang-release-gates.mjs`, `scripts/release-screenshot-qa.mjs`, `scripts/prod-doctor.mjs`.
- E2E coverage: `e2e/`.
- Deep-research and investment gates: `harness/deep-research-skill-distillation/`, `harness/hubu-investment-swarm-gate/`.
- Visual assets: `public/heroes/character-roster/`.
- Product and release docs: `docs/`.

Representative commits:

- `aa80f90 docs: align agent rules with src layout`
- `04f18e1 feat: archive chaotang frontend work snapshot`
- `817493f feat: archive release gate evidence in shiguan`
- `637d437 feat: close capability debt workflow`
- `161a01a feat: add chaotang release gate harness`
- `0b9f7f9 feat: close chaotang trusted dev loop`
- `30ebc5e feat: add deep research skill distillation harness`
- `3412b53 feat: expose true chain release signals`
- `1dca6fc chore: finalize frontend connection build`

Assessment:

- Source of truth for web UX and browser verification.
- Strong build/E2E gate direction.
- High mock/fallback surface remains and must be labeled in real-loop maps.

## Mainline Backend / Harness

Repository: `/home/ubuntu/workspace/jiqun_ai`

Remote: `git@gitee.com:msxn/jiqun_ai.git`

Status: aligned with `origin/master`. The true-loop harness/test/checklist
(`harness/chaotang-true-loop/`, `tests/test_chaotang_true_loop_contract.py`,
`docs/chaotang_board_review_checklist_2026-06-08.md`) and a `CLAUDE.md` import shim
were untracked when this ledger was written; verified (pytest 3/3, harness
`passed:true`) and committed on 2026-06-08.

Committed changes since 2026-06-06: 61 commits.

Primary areas changed:

- Commercial loop harness: `harness/chaotang-commercial-loop/`.
- Commercial loop API/dashboard: `web/routers/commercial_loop.py`, `tests/test_commercial_loop_*`.
- FlowEngine, memory, tool routing, OPC safety: `src/flow_engine.py`, `src/memory_store.py`, `src/tool_router.py`, `config/flow_opc.yaml`.
- Runtime prompt guardrails: `runtime_prompts/`.
- Legal red-team gate: `harness/legal-redteam/`, `harness/legal_redteam/`.
- Yushi/global gate and open-source watch: `harness/yushi_global_gate/`, `harness/open_source_watch/`.
- Department protocol and routing: `harness/chaotang_department_protocol/`, `src/chaotang_department_router.py`, `src/chaotang_department_payload.py`.
- Department autosubmit: `src/chaotang_department_autosubmit.py`, `scripts/chaotang_department_submit.py`.
- Production observability: `src/production_events.py`, `web/routers/observability.py`.
- Business model and merit systems: `harness/chaotang_business_model/`, `harness/chaotang_merit_system/`.
- Chaotang UI user modes: `skills/chaotang_user_modes/`, `web/chaotang_ui.html`.
- Recent local database snapshot: `data/fengqun.db`.

Representative commits:

- `f7b7f68 chore: archive fengqun database snapshot`
- `117327d chore: rename Chaotang user depth labels`
- `f67e255 Add Chaotang UIUX system harness`
- `11094b3 feat: add Chaotang next-step release gates`
- `e4b1388 feat: add production observability gates`
- `449da55 feat: add Chaotang business model harness`
- `da5040b fix: close release qa and department submission gates`
- `9cbad32 feat: add yushi governance harness gates`
- `bef1f1e feat: add governance harness recovery tools`
- `181c7da feat: add Chaotang commercial loop harness`
- `5b608c9 fix: harden OPC safety floor and curation gating`

Assessment:

- Source of truth for swarm, FlowEngine, governance, archive replay, and harnesses.
- Strong deterministic and pytest coverage.
- Real-mode operation still depends on credentials, gateway, provider, and production infra.

## Local Codex / Claude Configuration

Directories:

- `/home/ubuntu/AGENTS.md`
- `/home/ubuntu/.codex/`
- `/home/ubuntu/.claude/skills/`

Meaningful changes:

- Added top-builder workflow rules.
- Added Gitee-first code management rules.
- Added mainline repo routing for frontend and backend.
- Added advisor lens routing and `大神视角` closing format.
- Added distilled Codex/agentic-coding advisors.
- Added local skills:
  - `/home/ubuntu/.claude/skills/chaotang-frontend-change/SKILL.md`
  - `/home/ubuntu/.claude/skills/jiqun-backend-harness-change/SKILL.md`
  - `/home/ubuntu/.claude/skills/solo-dev-code-management/SKILL.md`
  - `/home/ubuntu/.claude/skills/gitee-push-flow/SKILL.md`
  - `/home/ubuntu/.claude/skills/daniel-vaughan-codex/SKILL.md`
  - `/home/ubuntu/.claude/skills/addy-osmani-agentic-coding/SKILL.md`
- Fixed HeyGen skill YAML under:
  - `/home/ubuntu/.codex/plugins/cache/openai-curated/heygen/3f0def1b/skills/heygen-avatar/SKILL.md`
  - `/home/ubuntu/.codex/plugins/cache/openai-curated/heygen/3f0def1b/skills/heygen-video/SKILL.md`

Assessment:

- These are operator/workflow changes, not product code.
- They should be preserved as local operating rules unless deliberately exported.

## Experiment / Legacy Worktrees

### `/home/ubuntu/workspace/tt/chaotang-web-lyt`

Status (re-verified 2026-06-08): **in sync with `origin/master` — `0` ahead, `0` behind**.
`HEAD == aa80f90`, identical to mainline `chaotang-web-lyt` HEAD.

Commits since 2026-06-06: mirrors mainline (54), no divergence.

Meaningful area: **none unique**. (The earlier "ahead 3, behind 159 / 1 commit /
`src/features/chaotang/study/`, `public/study/`, `DESIGN.md`" reading was stale or the
worktree was since reset/synced; those three paths do not exist in either tt or mainline.)

Assessment:

- **Nothing to absorb** — tt currently mirrors mainline, not a divergent idea source.
- Safe to ignore for absorption; candidate for cleanup (it had a stale dev server that
  squatted port 3002; see `docs/TRUE_MODE_HEALTH_AUDIT_2026-06-08.md`).

### `/home/ubuntu/chaotang-os`

Status: dirty worktree, no commits since 2026-06-06.

Modified tracked areas:

- `web/app/chaotang/archive/page.tsx`
- `web/app/chaotang/lab/gold/page.tsx`
- `web/app/chaotang/study/page.tsx`
- `web/app/chaotang/war-room/page.tsx`
- `web/components/auth/`
- `web/components/court/`
- `web/lib/`
- `web/package.json`

Untracked areas:

- `docs/CHAOTANG_BOARD_MATURITY_ROADMAP.md`
- `docs/CHAOTANG_PANEL_SKILLS.md`
- `docs/reviews/`
- `web/app/api/auth/session/`
- `web/app/api/court-workflows/`
- `web/docs/`
- `web/harness/page-design/`
- `web/lib/court-workflow.ts`
- `web/lib/workflow-orchestrator.ts`
- `web/lib/user-experience-modes.ts`
- `web/lib/repositories/court-workflows.ts`

Assessment:

- Treat as experiment or legacy source.
- Do not count as mainline until reviewed and intentionally absorbed.

## Runtime / Generated Artifacts

Examples observed:

- Frontend build output: `.next/`, `tsconfig.tsbuildinfo`.
- Dependencies: `node_modules/`, `pnpm-lock.yaml` changes only count when committed.
- Browser verification: `.playwright-mcp/`, screenshots under root or artifacts.
- Backend runs: `swarm_sessions/`, `events/`, `data/`, SQLite WAL/SHM.
- Logs/caches: `.npm/_logs/`, browser profile files, Codex sqlite WAL.

Policy:

- Use artifacts as evidence in docs or reports.
- Do not commit artifacts unless a harness explicitly defines them as golden evidence.
- If an artifact must be committed, isolate it in a separate evidence commit.

## Day-1 Verdict

The real product work happened in the two mainline repos. The operator/workflow work happened under `/home/ubuntu/AGENTS.md`, `.codex`, and `.claude`. The `tt` and `chaotang-os` directories are useful sources of ideas, but they are not current mainline truth.
