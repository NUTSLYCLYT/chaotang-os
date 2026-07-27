# CI 摘要：feat-r0-w07-a0-runnable-minimum-20260727

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_contract*.py tests/test_mission_contract_v1.py tests/test_artifact*.py ... tests/test_schema_authority.py` | 0 | latest 436 passed, 2 skipped | mission、persisted review lineage、server action、P0-B、authz、W05/W06 regression | 2026-07-27 |
| `ruff check <W07-A0 backend files>` | 0 | All checks passed | Python scope | 2026-07-27 |
| `pnpm exec tsx --test src/features/contract-review/*.nodetest.ts` | 0 | latest 33 passed | full mission/pack/risk schema、business scope match、canonical download URL、三件套完整性、exact archive view | 2026-07-27 |
| `pnpm test:node` | 1 | 1099 passed, 1 failed | canonical frontend residual scan；1 个既有、非本 diff 日期样例失败 | 2026-07-27 |
| `pnpm exec tsx --test src/app/(dashboard)/liubu/page.nodetest.tsx` | 1 | 0 passed, 1 failed | canonical glob 未覆盖的 TSX residual；非本 diff | 2026-07-27 |
| `pnpm exec tsc --noEmit` | 0 | pass | generated contract and frontend types | 2026-07-27 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | pass | real-mode production build only | 2026-07-27 |
| `node --test scripts/api-contract-stability.nodetest.mjs` | 0 | 5 passed | immutable base、repin rejection、schema content、determinism | 2026-07-27 |
| `API_CONTRACT_BASE_REF=ed822... node scripts/api-contract-stability.mjs` x2 | 0 | pass, 362 routes, 0 breaking, 9 additions | fixed OpenAPI baseline；OpenAPI `72ada7c1...`、route snapshot `c1a36a68...`、TS `5314e34f...` 两次一致 | 2026-07-27 |
| `pnpm exec playwright test --config=playwright.w07.config.ts` | 0 | sixth remediation exact-state 1 passed | delayed initial read、fresh real JWT READY flow、audit-only exact archive、tampered archiveId、seeded PARTIAL refresh | 2026-07-27 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | backend harness | 2026-07-27 |
| `pnpm harness:doctor` | 0 | 0 errors, 0 warnings | frontend harness | 2026-07-27 |
| base `ed822255...`: `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | pre-edit integrated authority baseline | 2026-07-27 |
| isolated candidate: `node scripts/harness-doctor.mjs` | 1 | expected `active-packet EXT ref must equal pinned HEAD` only | PRE_INTEGRATION fail-closed；不得伪装为 root PASS | 2026-07-27 |
| `git diff --check` | 0 | pass | whitespace/diff integrity | 2026-07-27 |
| seventh remediation expanded backend suite | 0 | 388 passed, 2 skipped | W05/W06/W07 mission、artifact、worker、authz、legacy ownership | 2026-07-28 |
| seventh remediation direct backend files | 0 | 116 passed | action authority、projection、worker、legacy route | 2026-07-28 |
| `ruff check` scoped files | 0 | All checks passed | changed Python；`chaotang.py` 的 11 项与 HEAD 基线相同 | 2026-07-28 |
| contract-review Node + `tsc --noEmit` | 0 | 35 passed + typecheck pass | closed-world、mission identity、exact archive | 2026-07-28 |
| API stability test/generator | 0 | 6 passed；固定 ref 两次 PASS | 362 routes；0 breaking；新增 optional property warning | 2026-07-28 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | pass | real-mode build | 2026-07-28 |
| W07 Playwright | 0 | 1 passed | READY/PARTIAL、exact archive 只读右栏、tampered id | 2026-07-28 |
| eighth remediation expanded backend suite | 0 | 484 passed, 2 skipped | W02-W07 contract、mission、artifact、worker、authz、legacy ownership | 2026-07-28 |
| `ruff check <changed Python files>` | 0 | All checks passed | current implementation diff | 2026-07-28 |
| contract-review Node + `tsc --noEmit` | 0 | 36 passed + typecheck pass | server selection、typed pack、closed-world、exact archive | 2026-07-28 |
| API stability test/generator | 0 | 7 passed；362 routes；0 breaking | response-aware fixed-ref guard；双跑 deterministic | 2026-07-28 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | pass | exact implementation real-mode build | 2026-07-28 |
| W07 Playwright | 0 | 1 passed | exact implementation READY/PARTIAL/download/archive flow | 2026-07-28 |
| backend/frontend doctor | 0 | 0 errors, 0 warnings | two owned harness layers | 2026-07-28 |
| root doctor | 1 | expected exact-ref mismatch only | isolated candidate PRE_INTEGRATION fail-closed | 2026-07-28 |
| latest expanded backend suite | 0 | 464 passed, 1 skipped | contract/Mission/artifact/W05/worker/authz/legacy concurrency | 2026-07-28 |
| latest focused frontend + typecheck | 0 | 43 passed + `tsc --noEmit` pass | server classification、closed-world、exact archive、typed home path | 2026-07-28 |
| latest Ruff | 0 | All checks passed | all changed Python files | 2026-07-28 |
| latest API guard/generator x2 | 0 | 9 passed；363 routes；0 breaking；hashes identical | inline schema、component response reachability、fixed immutable ref | 2026-07-28 |
| latest real-mode build | 0 | Next production build pass | isolated candidate buildability only | 2026-07-28 |
| latest W07 Playwright | 0 | 1 passed | disposable real JWT READY/PARTIAL/download/archive/reopen | 2026-07-28 |
| latest backend/frontend doctor | 0 | 0 errors, 0 warnings | owned harness layers | 2026-07-28 |
| latest root doctor | 1 | only `active-packet EXT ref must equal pinned HEAD` | expected PRE_INTEGRATION fail-closed | 2026-07-28 |
| `git diff --check` | 0 | pass | implementation diff integrity | 2026-07-28 |
| seventh-review expanded backend suite | 0 | 583 passed, 2 skipped | contract/Mission/artifact/W05/worker/authz/legacy concurrency | 2026-07-28 |
| seventh-review focused frontend + typecheck | 0 | 43 passed + `tsc --noEmit` pass | `/home/v1` classification、closed-world、exact archive | 2026-07-28 |
| seventh-review full frontend residual | 1 | 1105 passed, 1 known date-fixture failure | no new Packet regression；fixed-date residual unchanged from base | 2026-07-28 |
| seventh-review Ruff | 0 | All checks passed | all changed Python files | 2026-07-28 |
| seventh-review API guard/generator x2 | 0 | 11 passed；363 routes；0 breaking；five hashes identical | response components、stable public schema、fixed immutable ref | 2026-07-28 |
| seventh-review real-mode build | 0 | Next production build pass | isolated candidate buildability only | 2026-07-28 |
| seventh-review W07 Playwright | 0 | 1 passed | real `/home/v1` list selection、READY/PARTIAL/download/archive/reopen | 2026-07-28 |
| seventh-review backend/frontend doctor | 0 | 0 errors, 0 warnings | owned harness layers | 2026-07-28 |
| seventh-review root doctor | 1 | only `active-packet EXT ref must equal pinned HEAD` | expected PRE_INTEGRATION fail-closed | 2026-07-28 |
| seventh-review `git diff --check` + secret scan | 0 | pass | candidate integrity | 2026-07-28 |

## 结果

review envelope `6a2ffefc...` 的两路 independent review 为 `NO-GO`；主控确认的
全部适用 HIGH/MEDIUM 已完成第六轮 TDD remediation 并通过上述 fresh evidence。
implementation candidate `5d5ff747850ee161a1b39af849f39a0732be15d9`, tree
`cf6a25089c69fe70961ae6d8f3972065923a605e` 已冻结。review envelope
`492703ce9b6f89d57f5ac0b07082289426ed6b5e`, tree
`6a2f5d859a1c4e6119e4d55e327823505895e9e7` 的两路 fresh review 均为
`NO-GO`，合并 `HIGH 3 / MEDIUM 5 / LOW 1`。Product Owner 已批准第七轮
remediation scope amendment；其 implementation `61805256...` 随后的 review
envelope `a7937d7e...` 两路仍为 `NO-GO`，合并适用项
`HIGH 2 / MEDIUM 6 / LOW 1`。全部 H/M 已在新 implementation
`7b8b84d20a3e21f38f89e97f590c554b4045081c`、tree
`6263bf1d2a45a3b2dafdddc2ccdcd7b79cad07f8` 按 TDD 闭环并通过 fresh tests。
后续 scope-amendment review 的适用 HIGH/MEDIUM 已在 exact implementation
`4ed274f8e530d4049bc01e807366d1d9ac6ff691`、tree
`77bf4aa111da81c9b8cdee485d42dac28201772a` 按 TDD 闭环并通过上表 fresh
verification。review envelope `5f351283...` 的两路 fresh review 均为
`NO-GO`，去重 `HIGH 3 / MEDIUM 8 / LOW 2`；candidate 不得整合，进入下一轮
H/M remediation。全部适用 HIGH/MEDIUM 已在 implementation
`af714f77ae9752cf1aafbcfd4a14a6e4081f26a3`、tree
`d37fe17900354afab1bcaa029fe3d097e210623c` 按 TDD 闭环并通过上表 fresh
verification。当前等待该 exact candidate 两路独立只读审查，仍不得整合。
review envelope `857930ed...` 的两路 fresh review 均为 `NO-GO`，去重
`HIGH 3 / MEDIUM 1 / LOW 0`；implementation `af714f77...` 被拒绝，进入下一轮
TDD remediation。

## 全仓既有 Residual

- `src/lib/intel/signal-dispatch.nodetest.ts`：固定日期样例在当前日期新增
  `signal_older_than_30_days`；canonical `pnpm test:node` 唯一失败，不在本
  Packet diff。
- `src/app/(dashboard)/liubu/page.nodetest.tsx`：测试期望礼部入口，但当前页面仍标
  “待建”；该 TSX 文件不在 canonical test glob 中，单独复验失败，不在本 Packet
  diff。

## 未验证项

- Checkpoint B 的数据库唯一约束、CAS 和并发 writer hardening。
- PARTIAL 跨刷新 resume；Checkpoint A 只返回 blocker，不提供 resume。
- 生产部署、持久数据库迁移、listener 3050 和真实客户数据。
- 36 黄金合同、10/10 全浏览器流程和 5 名非开发用户验收属于后续产品验收。

## Diff 与回滚复核

- changed files：只涉及 root Packet、backend contract bridge、generated OpenAPI、
  frontend child Packet、两个既有页面 hunk 和测试。
- diff review：`git diff --check` 通过；密钥模式扫描无命中。
- 回滚是否演练：未执行 destructive rollback；isolated worktree 可直接弃置，
  local EXT 尚未整合实现候选。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| server-owned read model/actions | backend tests + OpenAPI | PASS |
| exact pack/manifest/archive lineage | projection tests + browser readback | PASS |
| existing two-page consumption | focused node tests + Playwright | PASS |
| honest PARTIAL limitation | backend/frontend tests + real browser refresh | PASS |
| real backend synthetic flow | Playwright real JWT flow | PASS |
| no deployment or 3050 operation | isolated 3002/8081 config and report | PASS |
| sixth remediation | all applicable HIGH/MEDIUM locally closed | PASS |
| seventh remediation | all approved HIGH/MEDIUM locally closed | PASS |
| eighth remediation | all applicable HIGH/MEDIUM locally closed | PASS |
| independent review | exact `af714f77...` fresh two-pass | NO-GO |
| exact implementation candidate | `af714f77...` / `d37fe179...` | REJECTED |

## 声明状态

- `REVIEWED_NO_GO / REMEDIATION_IN_PROGRESS / NOT_DEPLOYED`
