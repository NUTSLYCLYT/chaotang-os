# Chaotang Final Launch And OS Absorption Plan

Date: 2026-06-08

Companion inventory:

```text
docs/CHAOTANG_OS_LEGACY_INVENTORY_AND_ABSORPTION_GATES_2026-06-08.md
docs/CHAOTANG_OS_P0_ABSORPTION_LEDGER_2026-06-08.md
docs/CODEX_CLAUDE_LAUNCH_WORKFLOW_PLAYBOOK_2026-06-08.md
```

## Decision

Final launch product:

```text
先知和导师：用户提交一个真实经营/决策问题，系统调动朝堂部门、模型、蜂群和史馆，输出可裁决、可追问、可落地、可复盘的判断。
```

Mainline repositories:

| Area | Repository | Role |
|---|---|---|
| Frontend product | `/home/ubuntu/workspace/chaotang-web-lyt` | Final user-facing web app |
| Backend, harness, swarm runtime | `/home/ubuntu/workspace/jiqun_ai` | FlowEngine, governance, real execution, evals |
| Legacy/reference OS | `/home/ubuntu/chaotang-os` | Source material only; do not ship directly |
| Legacy UI snapshot | `/home/ubuntu/workspace/chaotang-os/chaotang-ui-ms` | Mostly already absorbed; source material only |

The launch should not be presented as every Chaotang page being production ready. The launch is one true loop:

```text
上书房真实问题
  -> 军机处/丞相路由
  -> 关键部门参审
  -> 真奏折
  -> 用户采纳、打回或追问
  -> 史馆归档证据
  -> 下一次更准
```

## Product Shape

| Layer | Final status | Why |
|---|---|---|
| 上书房 | PROD | Primary user entry: submit problem, read first answer, issue command |
| 军机处 / Command Center | FIX -> PROD | Orchestration surface; must connect to real backend run evidence |
| 史馆 | FIX -> PROD | Evidence, audit, replay, learning loop |
| 工部 | PROD-support | Build ledger, implementation readiness, release gates |
| 户部 | FIX/DEMO by data source | Valuable only when numbers cite source, timestamp, and uncertainty |
| 东宫 / 权限闸 | PROD-support | Human signoff and irreversible decision boundary |
| 大殿 / 总览 | DEMO/PROD mixed | Keep as navigation/status, but do not let it replace the true loop |
| 其它部门页 | DEMO until verified | Useful as resource and narrative, not launch proof |
| Lab / visual experiments | STOP from public nav | Keep only as internal inspiration or visual references |

## Chaotang OS Impact

`/home/ubuntu/chaotang-os` is not the mainline product. It contains useful experiments, docs, screenshots, bridge scripts, and an older web/backend split. It also has many uncommitted changes and local artifacts, so direct merge is unsafe.

Observed state:

| Source | State | Impact |
|---|---|---|
| `/home/ubuntu/chaotang-os` | Git repo with many modified and untracked files | Cannot delete or bulk merge until inventory is complete |
| `/home/ubuntu/workspace/chaotang-os` | Container folder, not a Git repo | Do not treat as source of truth |
| `/home/ubuntu/workspace/chaotang-os/chaotang-ui-ms` | Git repo ahead of origin by 1 commit | Mostly already absorbed into `chaotang-web-lyt`; keep as archived source |
| `chaotang-web-lyt` | Aligned with origin (no ahead/behind). True-loop work (this plan + true-loop docs + `e2e/true-loop-contract.spec.ts`) and a dadian responsive-polish change were in-flight when this plan was written; verified (tsc clean, E2E green) and committed 2026-06-08 | Frontend source of truth |
| `jiqun_ai` | Aligned with origin. True-loop harness/test/checklist were untracked when written; verified (pytest 3/3, harness `passed:true`) and committed 2026-06-08 | Backend/harness source of truth |

## Absorption Matrix

| Candidate | Source | Target | Action | Verification | Delete condition |
|---|---|---|---|---|---|
| Product architecture docs | `chaotang-os/docs/朝堂OS-产品结构.md`, `INTEGRATION_ALIGNMENT.md` | `chaotang-web-lyt/docs` or `jiqun_ai/docs` | Extract decisions only; do not duplicate stale assumptions | Docs reference current mainline repos and ports | Copied decisions are represented in current docs |
| Panel and maturity docs | `CHAOTANG_PANEL_SKILLS.md`, `CHAOTANG_BOARD_MATURITY_ROADMAP.md` | `jiqun_ai/docs` or advisor skills | Absorb rubric language into harness gates | Department gates still require evidence, owner, next action | No unique active rule remains only in legacy repo |
| Hubu budget design | `HUBU_BUDGET_PLATFORM_DESIGN.md` | `chaotang-web-lyt/docs` + `jiqun_ai/harness` if implemented | Keep as P1 product spec, not launch blocker | Financial claims include source/timestamp/uncertainty | Spec migrated or explicitly deferred |
| Eastern Palace / Prince docs | `EASTERN_PALACE_HARNESS.md`, `PRINCE_DATABASE_GUIDE.md`, backend docs | `jiqun_ai/docs` | Mine for auth, signoff, and data model ideas | Backend tests/harness confirm any adopted contract | Current backend contract supersedes old docs |
| Visual references | root PNGs, `docs/design/*.png` | `chaotang-web-lyt/docs` or asset ledger | Use as visual references only; no blind asset dump | Asset ledger records source and intended use | Approved assets copied or rejected |
| Old Next routes | `chaotang-os/web/app/*` | `chaotang-web-lyt/src/app/*` | Do not bulk copy; cherry-pick behavior only | `npm run build`, screenshot QA, release gates | Mainline route has equal or better behavior |
| Study/archive/war-room ideas | uncommitted diffs in `chaotang-os/web` | `chaotang-web-lyt` | Review manually; likely extract UX and workflow states | Focused page tests or screenshot QA | Accepted UX captured in mainline issue/doc |
| Bridge scripts | `chaotang-os/bridge/*.py`, `*.sh` | `jiqun_ai/scripts` only if still used | Prefer rewriting as deterministic harness or FlowEngine contract | `pytest` or harness run proves behavior | Replaced by maintained backend script |
| Local DB and run outputs | `web/local.db`, `bridge/out/*`, `.next`, node_modules | Nowhere | Do not migrate | N/A | Safe to delete only with whole archived repo |
| Old backend app | `chaotang-os/backend` | `jiqun_ai` | Do not merge wholesale; extract API/data-model lessons | Existing `jiqun_ai` tests stay green | Any useful contract is documented or tested |

## What To Copy Now

1. Copy decisions, not repositories.
2. Copy only assets that support the launch loop: 上书房, 军机处, 史馆, 工部/户部 evidence surfaces.
3. Copy any better visual treatment only after checking text fit, mobile, and browser screenshots.
4. Copy harness ideas into `jiqun_ai` only when they become golden cases, deterministic checks, or release gates.
5. Copy bridge behavior only if it connects to a maintained API contract.

## What Not To Copy

| Do not copy | Reason |
|---|---|
| Full `chaotang-os/web` | Older experimental Next app with divergent structure |
| Full `chaotang-os/backend` | Superseded by `jiqun_ai` as backend/harness source of truth |
| `node_modules`, `.next`, `.pytest_cache`, `__pycache__` | Generated artifacts |
| Local `.env`, local databases, bridge output files | Secrets/state/output risk |
| Screenshots as production assets without ledger | They are evidence or references, not automatically licensed product assets |
| Mock data as live data | Trust risk |

## Deletion Policy

Do not delete `chaotang-os` immediately.

It becomes safe to delete or move to cold archive only after all gates pass:

| Gate | Required evidence |
|---|---|
| Inventory | File manifest exists for docs, assets, scripts, backend, web, data |
| Migration | Every accepted item has target path or explicit rejection |
| Mainline verification | `chaotang-web-lyt` build/release gates pass; `jiqun_ai` focused tests pass for adopted backend contracts |
| Archive | A tarball or remote branch preserves the legacy repo before deletion |
| Human signoff | User approves deletion after seeing the migration report |

Recommended end state:

```text
/home/ubuntu/workspace/chaotang-web-lyt  = final frontend
/home/ubuntu/workspace/jiqun_ai          = final backend/harness
/home/ubuntu/archive/chaotang-os-legacy-2026-06-08.tar.gz = cold backup
```

## Launch Gate

| Gate | Command or evidence |
|---|---|
| Frontend build | `npm run build` in `/home/ubuntu/workspace/chaotang-web-lyt` |
| Production smoke | `npm run start`, then `http://127.0.0.1:3050/chaotang` |
| Release harness | `npm run harness:chaotang:gates` and `npm run harness:screenshot-qa` |
| Backend harness | focused `pytest` or deterministic harness in `/home/ubuntu/workspace/jiqun_ai` |
| True capability label | LIVE/MIXED/DEMO shown honestly in product |
| Evidence archive | 史馆 records input, output, sources, run id, cost/status, and user feedback |

## Next Execution Order

1. Freeze final launch loop: 上书房 -> 军机处 -> 真奏折 -> 史馆.
2. Use `docs/CHAOTANG_OS_LEGACY_INVENTORY_AND_ABSORPTION_GATES_2026-06-08.md` as the migration control sheet.
3. Review uncommitted `study`, `archive`, `war-room`, and workflow changes in old OS; convert only useful ideas to mainline issues or patches.
4. Move panel/rubric/harness ideas into `jiqun_ai` only as tests, golden cases, gates, or docs tied to current code.
5. Run mainline build and harness gates.
6. Archive legacy OS.
7. Ask for explicit deletion approval only after the archive and migration report exist.
