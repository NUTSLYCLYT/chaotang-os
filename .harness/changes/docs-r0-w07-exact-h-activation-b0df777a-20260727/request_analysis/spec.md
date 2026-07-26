# 规格说明：R0-W07 Exact-H Activation Recovery

## 背景

本地 `feature-chaotang-ext` 已到
`b0df777a1fe94d98afdc62b4cdd02a2f8a091391`。W06 已静默收口，W07 reviewer
reassignment overlay 已登记，authority 测试夹具修复已验收。当前 manifest 保持
quiescent，W07 必须继续 STOP。

旧 W07 activation 资产绑定过期 candidate 和证据路径，只能作为 Asset Pool。新
Packet 不继承其授权状态、digest、owner approval 或 review verdict。

## 事实与未知项

| 分类 | 结论 | 证据 | 是否阻塞 |
| --- | --- | --- | --- |
| 已确认 | EXT 基线 H/tree 如摘要所列 | `git rev-parse HEAD HEAD^{tree}` | 否 |
| 已确认 | W07 当前未激活 | v2 authorize 返回 `STOP / NO_ACTIVE_WORK_PACKAGE` | 否 |
| 已确认 | W07 reviewer overlay 已登记 | `.harness/manifest/project-harness.json` | 否 |
| 已确认 | loader 仍冻结旧 W07 change root | `scripts/lib/execution-authority-v2.mjs` | 是，阻塞未来激活 |
| 已确认 | loader 要求 EXT ref 等于较早 reviewed candidate H，集成 activation commit 后无法满足 | `verifyActivePacketGitIdentity` | 是 |
| 已确认 | 当前 overlay 固定四个 protected authority blobs 为 `6c01...` 版本 | `verifyReviewerReassignmentActivationHistory` | 是 |
| 未生成 | 新 activation candidate H/tree/diff digest | 必须在后续 quiescent candidate 冻结后生成 | 是 |
| 未生成 | owner approval 与独立 final review | 必须在 exact-H 候选产生后生成 | 是 |

## 唯一事实源

| 契约 | 事实源 | 消费者 | 约束 |
| --- | --- | --- | --- |
| 当前执行状态 | `.harness/manifest/execution-authority.v2.json` | v2 loader/CLI | 本轮不得修改 |
| reviewer overlay | `.harness/manifest/project-harness.json` | amendment governance/v2 loader | 保持已登记字节 |
| W07 evidence profile | `scripts/lib/execution-authority-v2.mjs` | v2 loader/tests | 后续 TDD 收敛到新 root |
| W07 activation intent | 新 Packet 的 `activation_intent/` | owner/reviewer/v2 loader | 候选冻结后生成 |
| owner/review evidence | 新 Packet 的受保护路径 | v2 loader | 不得预写或伪造 |

不得建立第二套任务状态、完成状态或裁决系统。

## 目标状态转换

### Event 0：本 Packet

只记录设计和证据生成规则。manifest 保持 quiescent，W07 保持 STOP。

### Event 1：Authority Identity Remediation Candidate

在另行批准的 TDD 实施中：

1. 将 canonical W07 profile 迁移到本 Change ID。
2. 以 failing tests 证明旧路径不能被新候选冒充。
3. 以 failing integration test 证明 activation H 集成到 EXT 后，旧
   `EXT ref == effectiveBase.sha` 规则不可满足。
4. 将 identity contract 收敛为：
   - `effectiveBase.sha == approvalEvidence.candidateH`，表示已审 authority candidate；
   - candidate H 必须是 registration parent 和 activation H 的第一父祖先；
   - 授权开始和结束时 local EXT ref 必须等于 pinned HEAD；
   - HEAD、EXT ref、candidate ancestry 或 governed bytes 漂移均 fail closed。
5. 将 W07 hardened review base 固定为本次获批基线 `b0df777a...`。
6. 保持 `activeWorkPackage=null` 且 ledger 无 W07。
7. 先提交 authority candidate，再冻结其 exact H/tree。

Event 1 不包含引用自身 H 的 activation intent，也不授权 W07。

### Event 2：Reviewer Overlay Refresh

Event 1 修改了当前 overlay 保护的 authority blobs，因此旧 overlay 只能保留为历史证据，
不能授权新 runtime。必须从 Event 1 exact H/tree 生成新的 reviewer reassignment
review package，执行两轮 fresh/read-only Codex review 和 Product Owner exact-H
approval，再以独立 quiescent commit 原子替换当前 overlay registration。

Event 2 只刷新 `R0-W07` reviewer overlay，仍保持 W07 STOP；不得修改原 amendment
或历史 evidence。

### Event 3：Activation Evidence Registration Parent

从 Event 1 的已知 H/tree 生成 deterministic review package 和 activation intent。
activation intent 绑定 Event 1 H/tree、package digest、目标 ledger 和 evidence paths，
但位于 Event 1 的后继提交中，因此不存在 self-hash。

Product Owner 必须逐字批准 Event 1 H/tree、review package path/digest、
activation intent path/digest、scope 和 exclusions。随后由 `Codex Independent QA`
在新的只读会话中审查不可变候选，绑定 owner approval digest，要求 `GO`、
`HIGH=0`、`MEDIUM=0`。全部证据进入一个 quiescent registration parent；
该 parent 仍保持 W07 STOP。

### Event 4：Atomic Activation Event

在另行明确批准后，从 Event 3 registration parent 生成恰好一个父提交的
activation event。
该提交只进行已经审查的 manifest 状态转换：

```text
activeWorkPackage = R0-W07
R0-W07 ledger = ACTIVE
R0-W00..R0-W06 = MERGED_AND_VERIFIED
effectiveBase.ref = refs/heads/feature-chaotang-ext
effectiveBase.sha = approved Event 1 authority candidate H
approvalEvidence = exact approved W07 evidence
```

该 exact activation candidate 受控集成后，local EXT ref 与 pinned HEAD 必须同时指向
Event 4 H，而 `effectiveBase.sha` 继续指向其已审 Event 1 祖先。

Event 4 使用两个不同的 gate：

1. **Pre-integration candidate gate**：在 isolated worktree 中运行结构、证据、历史、
   test 和 doctor 验证。由于 canonical EXT ref 尚未移动，真实 loader 必须仅因明确的
   `EXT ref != pinned activation HEAD` identity finding 而 STOP；disposable integration
   simulation 将 ref 指向同一 activation H 后必须 GO。该模拟不算真实授权或集成。
2. **Post-integration acceptance gate**：独立审查和 Product Owner 集成批准通过后，
   才 fast-forward local EXT ref。随后在 exact integrated HEAD 上 fresh 运行 authority；
   只有真实 W07 GO 才解除产品实施等待。

post-integration 验收失败时 authority 保持 STOP，必须使用另行批准的前向修复；不得回滚
EXT ref 或把 simulation GO 描述为真实授权。

## W07 授权范围

W07 只授权既有产品合同中的前端闭环：

- `/shangshufang`
- `/shiguan`
- typed read model 消费
- 从合同审查结果到 `ContractReviewPack` 的用户流程接线

W07 activation 本身不实现上述功能，也不证明产品验收完成。

## 排除项

- `NO_DEPLOYMENT`
- `NO_REAL_CUSTOMER_DATA`
- `NO_DB_MIGRATION`
- `NO_LISTENER_3050_TAKEOVER`
- `NO_R0_W08_TO_R0_W09`
- `NO_AUTOMATIC_MERGE`
- `NO_PRODUCTION_CLAIM`
- `NO_PRODUCT_CODE_IN_ACTIVATION_PACKET`

## Fail-Closed 条件

以下任一条件必须 STOP：

- candidate H/tree、EXT ref 或 governed bytes 漂移；
- EXT ref 不等于 pinned activation HEAD，或 approved candidate 不是其第一父祖先；
- 新旧 W07 evidence root 混用；
- owner/review evidence 缺失、digest 不匹配或身份不独立；
- review package 不等于规定 Git range 的原始字节；
- reviewer refresh 或 activation registration parent 已包含 W07 ledger；
- activation event 不是单父提交；
- W07 之外 scope 被加入；
- authority、生产边界、文件 ownership 或并发 writer 出现冲突。

## 验收标准

- 本 Packet 只含治理文档和证据计划。
- 当前 manifest 与产品代码零变更。
- 当前 W07 authorize 仍为 STOP。
- 新旧证据边界、四事件顺序、owner/reviewer 分权和回滚规则明确。
- 后续每个候选均有 exact H/tree/digest、fresh verification 和独立只读审查。

## 批准记录

- 批准人：Product Owner
- 批准日期：`2026-07-27`
- 批准范围：基于本地 EXT `b0df777a...` 创建全新 non-authorizing Packet；
  仅治理、设计和证据准备。
- 明确未批准：W07 activation、产品代码、push、deployment、DB migration、
  listener 3050。
