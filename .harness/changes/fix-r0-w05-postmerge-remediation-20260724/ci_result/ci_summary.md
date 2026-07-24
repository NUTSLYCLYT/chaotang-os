# CI 摘要：fix-r0-w05-postmerge-remediation-20260724

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W05` | 0 | `GO / APPROVED_WORK_PACKAGE` | W05 施工权威 | 本地 / 2026-07-24 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | 非 0 | `STOP / BLOCKED_DEPENDENCY` | W06 未激活 | 本地 / 2026-07-24 |
| 首轮六文件 pytest（实现前） | 1 | `33 failed, 24 passed, 3 warnings`（目标 RED） | 五个行为簇缺失；第六项为旧 exact/status 证据账 RED | 本地 / 2026-07-24 |
| 预冻结补充矩阵（实现前） | 1 | `7 failed, 30 passed`（目标 RED） | 真实 v2 replay、scope drift、CAS audit、跨用户污染、单调降级、处理中 digest drift | 本地 / 2026-07-24 |
| publication fence 顺序（实现前） | 1 | `events=[classify,classify]`，缺少 lock | 最终重验后的 PostgreSQL INSERT phantom | 本地 / 2026-07-24 |
| 六文件最终 GREEN | 0 | `84 passed` | support/mission/review/generation/OpenAPI 与全部 remediation seam | 本地 / 2026-07-24 |
| 相关 W02/W05/canonical 扩大回归 | 0 | `185 passed, 1 skipped` | task/brief、worker、FinalMemorial、baseline、旧契约兼容 | 本地 / 2026-07-24 |
| backend 非基线排除全量 | 0 | `3053 passed, 44 skipped, 3 deselected` | 最终稳定 diff 的仓库级回归 | 本地 / 2026-07-24 |
| 3 个 exact-base 排除项 | expected 1 | exact base 已复现同组 3 failed；本 Packet 路径零 diff | 两个 case-archive RAG 顺序污染 + production route 枚举污染 | 本地 / 2026-07-24 |
| changed-file Ruff + `git diff --check` | 0 | `All checks passed` / clean | Python 静态规范与 whitespace | 本地 / 2026-07-24 |
| authority v2 tests + check | 0 | `27 passed`；`VALID_STRUCTURE` | authority 结构与 W05/W06 决策 | 本地 / 2026-07-24 |
| R0 amendment tests + checker | 0 | `10 passed`；`VALID_REPINNED_AMENDMENT` | amendment 映射与 digest | 本地 / 2026-07-24 |
| root/backend harness doctors | 0 | 均 `0 errors / 0 warnings` | 三层边界、change 与 backend harness | 本地 / 2026-07-24 |
| pre-freeze Standards/Spec 复审 | 0 | 两轴均 `0 MUST` | concurrency/security 与验收/范围 | 本地 / 2026-07-24 |
| backend commit closeout check | 0 | `31 staged candidates / 0 staged high-risk / 0 uncommitted high-risk drift`；1 条非阻断御史提示 | 候选 allowlist 与生成物卫生 | 本地 / 2026-07-24 |

## 结果

六项 post-merge MUST 已完成 RED→GREEN。canonical task 创建时冻结 typed
`contract_scope`，generation 创建时快照；bind 只做规范化等价核对，不写回事实源。
durable outbox 状态只经一个纯投影 Interface 进入领域响应；真实 worker 生成 v2 后，
旧 request hash 可重放原 generation。证据分类限制 tenant/user/task/name 边界，
worker 只允许单调降级，并在 PostgreSQL artifact 表 SHARE publication fence 下做
最终重验。

## 未验证项

- 本地 H1 尚未冻结；exact candidate 独立 Standards/Spec 双轴审查待 H1 后执行。
- PostgreSQL 真实方言演练不属于本 Packet MUST：019–022 migration 及新增
  `secure_ingest_artifacts` SHARE lock 的权限、lock wait、吞吐仍是 release 风险。
- 3 个全量排除项属于 exact base 已复现的既有顺序污染；本 Packet 不扩域修复。

## Diff 与回滚复核

- changed files：31 个文件，仅 W05 contracts/runtime/API/tests、历史/本次 W05 change evidence；
  无 frontend、migration、manifest、W06 或 secure-ingest upload writer diff。
- diff review：pre-freeze Standards/Spec 均 0 MUST；exact-SHA review 待 H1。
- 回滚是否演练：本 Packet 无 migration；未来获批后用 `git revert <candidate>`
  整体回滚，本轮不执行破坏性回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| W05 authority GO、W06 STOP | authority v2 命令 | PASS |
| 六项 MUST 有 RED→GREEN | 33-failure 首轮 + 7-failure 补充 + publication RED；84 passed GREEN | PASS |
| 相关回归与 doctor 全绿 | 185 related；3053 full；Ruff/authority/amendment/doctors | PASS_WITH_3_BASELINE_EXCLUSIONS |
| exact/status 历史证据纠偏 | 原 W05 记录标明 merge 事实与 H0 已被 remediation 取代 | PASS |
| exact SHA 双轴 0 MUST | 待冻结本地 H1 后执行 | PENDING |

## 声明状态

- `GREEN_VERIFIED / AWAITING_LOCAL_EXACT_CANDIDATE`
