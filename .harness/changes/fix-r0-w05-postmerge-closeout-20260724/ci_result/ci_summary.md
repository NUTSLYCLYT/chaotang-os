# CI 摘要：fix-r0-w05-postmerge-closeout-20260724

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| base authority tests | 0 | `27 passed` | 修改前 authority baseline | local / 2026-07-24 |
| base amendment tests/checker | 0 | `10 passed`；`VALID_REPINNED_AMENDMENT` | amendment 与 digest baseline | local / 2026-07-24 |
| base W05 authorize | 0 | `GO / APPROVED_WORK_PACKAGE` | W05 尚 ACTIVE | local / 2026-07-24 |
| base W06 authorize | 2 | `STOP / BLOCKED_DEPENDENCY` | W06 未激活但前驱尚未关闭 | local / 2026-07-24 |
| post-merge six-file pytest | 0 | `84 passed, 2 warnings` | merge tree 产品行为未漂移 | detached merge worktree / 2026-07-24 |
| post-merge Ruff/diff/doctors | 0 | 全部通过 | merge tree 静态与三层边界 | detached merge worktree / 2026-07-24 |
| closeout tests before manifest change | 1 | `25 passed, 2 failed`（目标 RED） | W05 仍 ACTIVE；W06 尚非 quiescent | local / 2026-07-24 |
| closeout tests after manifest change | 0 | `27 passed` | W05 closeout + W06 fail-closed | local / 2026-07-24 |
| authority v2 `--check` | 0 | `VALID_STRUCTURE` | closeout manifest/schema | local / 2026-07-24 |
| final W05 authorize | 2 | `STOP / NO_ACTIVE_WORK_PACKAGE` | W05 已关闭且不可重复施工 | local / 2026-07-24 |
| final W06 authorize | 2 | `STOP / NO_ACTIVE_WORK_PACKAGE` | W06 未自动激活 | local / 2026-07-24 |
| amendment tests/checker | 0 | `10 passed`；`VALID_REPINNED_AMENDMENT` | 旧 amendment/digest 未漂移 | local / 2026-07-24 |
| root/backend doctors | 0 | 均 `0 errors / 0 warnings` | 三层边界与 harness | local / 2026-07-24 |
| diff/allowlist | 0 | whitespace clean；无 frontend/backend diff | Packet 范围 | local / 2026-07-24 |

## 结果

目标 RED 只命中真实 manifest 仍 ACTIVE。最小 GREEN 只把
`activeWorkPackage` 置空并把 W05 ledger 改为 `MERGED_AND_VERIFIED`；resolver
与 schema 无需修改。W05 与 W06 都将返回 `STOP/NO_ACTIVE_WORK_PACKAGE`，证明
完成 W05 不会自动批准 W06。

## 未验证项

- exact candidate 尚未冻结，独立 review 尚未执行。
- PostgreSQL release 风险与三个 backend baseline exclusions沿用 remediation
  记录，不属于本治理 Packet。

## Diff 与回滚复核

- changed files：12（8 个既有根治理文件 + 4 个本 change 文件）；不含
  frontend/backend 产品路径。
- diff review：待 exact SHA 后执行。
- 回滚是否演练：无数据迁移；本轮不执行破坏性回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| merge identity 精确 | parents/tree/diff | PASS |
| closeout 有目标 RED | 25 passed / 2 failed | PASS |
| W05 ledger closeout | 27 authority tests | PASS |
| W06 未激活 | W06 STOP/NO_ACTIVE_WORK_PACKAGE | PASS |
| 当前证据不再失真 | W05 historical/remediation + 本 change | PASS |
| broad verification | authority/amendment/doctors/diff | PASS |
| exact review | fixed SHA independent review | PENDING |

## 声明状态

- `GREEN_VERIFIED / AWAITING_LOCAL_EXACT_CANDIDATE_REVIEW`
