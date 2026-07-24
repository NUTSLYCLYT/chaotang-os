# 规格说明：fix-r0-w05-postmerge-closeout-20260724

## 背景

PR #17 已把 W05 remediation 候选合入 `feature-chaotang-ext`。merge commit
`ad77c16d` 的两个父提交分别是批准 base `3cb508e` 与候选 H3 `a8f78161`，
merge tree 与 H3 tree 完全相同。合并后只剩两个治理缺口：

1. remediation 与历史 W05 证据仍把当前状态写成 local-only、未 push/merge；
2. execution-authority v2 仍把 W05 标为 ACTIVE，使 W06 返回
   `BLOCKED_DEPENDENCY`，而不是静默 closeout 的 `NO_ACTIVE_WORK_PACKAGE`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | PR #17 merge tree 等于已审查 H3 tree | `git show`、`git diff H3..merge` / 2026-07-24 | Project Owner | 否 |
| 已确认事实 | Post-merge 核心行为未漂移 | 六文件 pytest `84 passed`；Ruff/doctor/diff pass | Project Owner | 否 |
| 已确认事实 | 当前证据声明已失真 | remediation/historical summary 与 CI；独立 post-merge review | Reviewer | 是 |
| 已确认事实 | W05 仍 ACTIVE，W06 为 BLOCKED_DEPENDENCY | authority v2 CLI baseline | Project Owner | 是 |
| 未知问题 | PostgreSQL 锁权限/等待/吞吐未实演 | 原 remediation release risk | Release owner | 否，本 Packet 不扩域 |

## 数据流与调用链

```text
Gitee PR #17 merge
  -> origin/feature-chaotang-ext@ad77c16d
  -> merge tree == reviewed candidate tree
  -> correct post-merge evidence
  -> execution-authority ledger: W05 MERGED_AND_VERIFIED
  -> activeWorkPackage=null
  -> W05 STOP/NO_ACTIVE_WORK_PACKAGE
  -> W06 STOP/NO_ACTIVE_WORK_PACKAGE
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| PR/merge identity | Git refs 与 merge commit | closeout evidence | 父提交、tree 等同性和 source head 可复算 |
| W05 ledger | `.harness/manifest/execution-authority.v2.json` | authority v2 resolver/CLI | 只改 W05 status 与 activeWorkPackage |
| closeout behavior | `scripts/execution-authority-v2.nodetest.mjs` | CI/Project Owner | 真实仓库 W05/W06 都必须 STOP/NO_ACTIVE_WORK_PACKAGE |
| 当前证据 | 本 change + W05 remediation/implementation change | 人工审计、root doctor | 历史时点与当前状态分开书写 |

## 范围

- 新建根级 closeout change。
- 纠正 W05 remediation 与历史实现记录的当前状态。
- 把 W05 ledger 从 ACTIVE 改为 MERGED_AND_VERIFIED。
- 把 activeWorkPackage 置为 null。
- 加强 real-repo authority 测试，固定静默 closeout 与 W06 未激活行为。

## 非目标

- 不激活 W06，不创建 W06 ledger entry。
- 不改 amendment、approval digest、W05 原批准范围或产品代码。
- 不改 frontend、backend、migration、API、数据库或部署。
- 不处理 PostgreSQL release 演练和既有三个 backend baseline exclusions。
- 不 push、不 merge、不发布。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| W05 已合并但 manifest 仍 ACTIVE | 测试 RED；closeout 后 W05 STOP/NO_ACTIVE_WORK_PACKAGE | authority nodetest + CLI |
| W06 前驱已完成但未获批准 | W06 仍 STOP/NO_ACTIVE_WORK_PACKAGE，绝不自动 ACTIVE | authority nodetest + CLI |
| merge tree 与候选不同 | STOP，不关闭 ledger | Git tree/diff identity |
| 证据只描述原审查时点 | 保留历史时点，同时追加当前 merge/closeout 事实 | exact review |
| 范围出现 frontend/backend/migration | STOP | allowlist diff |

## 风险与回滚边界

- 风险：误把“W05 完成”推导成“W06 获批”。缓解：activeWorkPackage 必须为
  null，W06 CLI 必须 `STOP/NO_ACTIVE_WORK_PACKAGE`。
- 风险：改写历史证据而丢失当时事实。缓解：保留“候选冻结时”的 local-only
  语义，明确追加“后续合并事实”。
- 回滚：本 Packet 无数据或运行时迁移；若 closeout 证据错误，只能在另行批准的
  治理变更中 revert。不得在已合并事实下静默恢复 W05 ACTIVE。

## 计划确认记录

- 批准人：Product Owner
- 批准日期：2026-07-24
- 批准范围：PR #17 post-merge evidence correction + W05 quiescent closeout。
- 明确未批准：W06 激活、业务代码、前后端、push、merge、发布。

## 验收标准

- exact base 为 `ad77c16d`，tree identity 可复算。
- W05 ledger 为 MERGED_AND_VERIFIED，activeWorkPackage=null。
- W05 与 W06 authorize 都为 STOP/NO_ACTIVE_WORK_PACKAGE。
- 证据明确 PR #17 与 merge SHA，不再声称当前 local-only。
- diff 只含根级治理 allowlist；无 frontend/backend 产品路径。
- authority/amendment/doctors/diff 全绿，exact-SHA review 0 MUST。

## 验证计划

- RED：真实仓库 closeout tests 必须因 W05 仍 ACTIVE 而失败。
- GREEN：27 authority tests、W05/W06 CLI、`--check`。
- 回归：10 amendment tests/checker、root/backend doctor。
- 卫生：allowlist、`git diff --check`、worktree clean。
- 冻结：local exact candidate + independent read-only review；不 push/merge。
