# 规格说明：docs-ext-full-asset-reconciliation-20260729

## 背景

用户要求把所有部门、创意、设置和历史分叉/worktree 进行 100% 融合。该目标不能解释为无差别合并全部历史代码，因为这会破坏 EXT 单一主线和 R0 authority。正确目标是 100% asset disposition coverage：每个资产必须被吸收、重制、归档、废弃、确认已覆盖，或进入冲突取舍。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前主线为 `feature-chaotang-ext` | `git branch --show-current` | EXT Master Governance | 否 |
| 已确认事实 | 当前 HEAD 为 `9d82bea9` | `git rev-parse HEAD` | EXT Master Governance | 否 |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | Authority gate | 否 |
| 已确认事实 | R0-W09 authority 为 STOP | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09` | Authority gate | 否 |
| 已确认事实 | refs inventory 约 206 条 | `git for-each-ref refs/heads refs/remotes` | Asset audit | 否 |
| 已确认事实 | worktree porcelain 585 行，约 145 个 worktree 条目 | `git worktree list --porcelain` | Asset audit | 否 |
| 已确认事实 | change summaries 238 份 | `find ... -name summary.md` | Asset audit | 否 |
| 未知问题 | 每个资产的最终处置尚未逐项完成 | 本 Packet 只建立 baseline | EXT-A9 execution | 是 |

## 数据流与调用链

```text
branch/worktree/change record
-> asset family
-> lane classification
-> disposition
-> packet if ABSORB/REBUILD
-> isolated worktree
-> tests
-> QA review
-> Codex acceptance
-> controlled EXT integration
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Asset reconciliation ledger | `.harness/changes/docs-ext-full-asset-reconciliation-20260729/asset_reconciliation_ledger.md` | EXT Master Governance / future agents | Docs-only, reviewable |
| Git refs inventory | local git refs | EXT-A9 audit | Read-only shell command |
| Worktree inventory | local git worktree metadata | EXT-A9 audit | Read-only shell command |
| Change record inventory | `.harness/changes`, backend/frontend harness changes | EXT-A9 audit | Read-only find command |
| Integration authority | `.harness/manifest/execution-authority.v2.json` | all agents | R0-W08 GO, W09 STOP |

## 范围

- Establish EXT-A9 asset reconciliation method.
- Record current inventory scale.
- Define disposition taxonomy.
- Identify first high-value asset batch.
- Preserve W08/W09 authority boundary.

## 非目标

- No product code change.
- No branch merge.
- No cherry-pick.
- No dirty worktree copy.
- No W09 activation.
- No production deployment, DB migration, or 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Asset has product value but stale implementation | mark `REBUILD` | ledger disposition |
| Asset conflicts with current product spine | mark `CONFLICT_DECISION` | one selected SSOT |
| Asset already exists in EXT | mark `SUPERSEDED_VERIFY` | current test/docs evidence |
| Asset is screenshot/output/history only | mark `ARCHIVE` | ledger entry |
| Asset is unsafe or misleading | mark `REJECT` | rejection reason |

## 风险与回滚边界

- Risk: "100% fusion" is misread as "merge everything". Mitigation: ledger explicitly separates `ABSORB`, `REBUILD`, `ARCHIVE`, `REJECT`, and `CONFLICT_DECISION`.
- Risk: W09 gets activated before W08 closeout. Mitigation: authority check proves W09 STOP.
- Risk: historical creative demos displace current R0 contract product spine. Mitigation: conflict policy prefers product spine and typed backend fact source.
- Rollback: remove this Packet directory; no product code is touched.

## 计划确认记录

- 批准人：用户。
- 批准日期：2026-07-29。
- 批准范围：EXT-A9 full asset reconciliation docs-only baseline.
- 明确未批准：W09 activation, product code modification, branch merge, push, deployment, database migration, 3050 operation.

## 验收标准

- Ledger defines disposition taxonomy.
- Ledger records current inventory scale.
- Ledger lists first high-value asset batch.
- W08 remains GO and W09 remains STOP.

## 验证计划

- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
