# 变更摘要：docs-r0-w07-exact-h-activation-b0df777a-20260727

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本 Packet 只定义治理、设计和证据生成流程；它不是 owner exact-H
> approval，也不激活 R0-W07。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w07-exact-h-activation-b0df777a-20260727 |
| 类型 | `docs` |
| 状态 | `EVENT_3_INPUT_CANDIDATE / OWNER_APPROVAL_PENDING / NON_AUTHORIZING` |
| Owner | `EXT Master Governance` |
| 创建日期 | `2026-07-27` |
| 唯一集成目标 | local `feature-chaotang-ext` |
| 基线 H | `b0df777a1fe94d98afdc62b4cdd02a2f8a091391` |
| 基线 tree | `a7beae653e5c9d2efd38fe1fda61a2cbe8b41565` |
| 当前 authority | `R0-W07 = STOP / NO_ACTIVE_WORK_PACKAGE` |

## 目标

从当前本地 EXT 基线重新建立一份 W07 exact-H activation Packet，消除旧
activation Packet 的过期基线、过期 reviewer 路径和过期测试证据。最终候选必须把
一个 W07 范围绑定到一个 candidate H、tree、review package、activation intent、
owner approval 和 Codex 独立审查。

## 本轮范围

- 固定当前 EXT 基线和现有 reviewer reassignment overlay。
- 定义新的 canonical W07 evidence root 及迁移边界。
- 定义 quiescent evidence candidate 与 atomic activation candidate 的顺序。
- 定义 TDD、验证、独立审查和 exact-H 审批门。
- 记录证据状态，不生成虚构 digest、owner approval 或 review verdict。

## Event 1 受控范围

Product Owner 后续明确批准了 authority/profile TDD 实施。Event 1 只允许：

- 将 W07 canonical profile 迁移到本 Change ID；
- 将固定 review base 更新为 `b0df777a...`；
- 实现 `EXT ref == pinned HEAD` 与 approved candidate 第一父祖先约束；
- 添加旧 root、混合证据、ref drift、second-parent replay 的拒绝性测试；
- 使 exact candidate 的全部 12 个路径进入显式 allowlist；
- 拒绝影响 raw diff 的 repository-local config 与未绑定 `info/attributes`；
- 禁用 system/user attributes，并在 diff 后重复 metadata-neutrality 检查；
- 通过 `GIT_ATTR_SOURCE=candidateH` 将 committed attributes 绑定到候选树；
- 通过 `core.commitGraph=false` 直接使用 commit objects；
- 通过 hardened fsck 校验 object database，并拒绝 alternates、partial-clone
  配置、`fsck.*` 降级配置、`.promisor` pack markers 与 object database
  symbolic links；
- 将 Event 1 changed paths 约束为冻结的 12 条路径完全相等；
- 同步本 wiki、任务和验证记录。

Event 1 候选仍是非授权、静默状态；它只为 Event 2 reviewer overlay refresh 提供
待审查的 authority bytes。

## Event 2 Reviewer Overlay Refresh

Event 1 exact candidate
`eb6e86e586ab5401780e5b49cdcf32af5ee27f86`、tree
`d08538039ad907c54bf1df41feaa3046097c91d9` 已由两轮 fresh/read-only Codex
独立审查判定 `GO / HIGH 0 / MEDIUM 0`。Product Owner 已对 exact H、tree、
review package digest 和两轮 review digest 作出仅限 R0-W07 reviewer overlay
refresh 的批准。

本 Event 2 候选只将上述证据和刷新后的 overlay 原子注册到隔离治理分支。它不修改
W07 ledger，不激活 W07，也不构成本地 EXT 整合批准。

Event 2 quiescent registration candidate
`35ac0e2839be300a295ca63bd99577bbe47a088d`、tree
`4142f785185cdbecc3a34d4d51b8df64ce0ae68c` 后续经明确批准，以纯
fast-forward 受控整合到本地 EXT；整合后 authority 回归仍为 `113/113`，W07
继续 `STOP / NO_ACTIVE_WORK_PACKAGE`。

## Event 3 Activation Evidence Inputs

本 Event 3 输入候选从 Event 1 exact H/tree 和固定 review base 生成：

```text
review base = b0df777a1fe94d98afdc62b4cdd02a2f8a091391
authority candidate = eb6e86e586ab5401780e5b49cdcf32af5ee27f86
authority tree = d08538039ad907c54bf1df41feaa3046097c91d9
review package sha256 =
  ba87835b8bb74aab4782411f8037515e0ea7c09d8798e80419f2e4be06a7fd7a
activation intent sha256 =
  8450ae3ba33da562d75e10220508f38e04f06bf4f84db99249469e136039c328
```

package 精确覆盖 Event 1 的 12 条允许路径。intent 绑定目标 W07 ledger、canonical
evidence paths、scope 和 exclusions，但不携带 owner/review digest。Product Owner
尚未对这些字节作出 exact-H approval；owner evidence 和独立 review 均不存在。

## 明确未授权

- 不激活 R0-W07。
- 不修改 `.harness/manifest/execution-authority.v2.json`。
- 不修改 schema 或产品代码；authority runtime 和测试仅限上方 Event 1 受控范围。
- 不 push、不部署、不迁移数据库、不操作 listener 3050。
- 不使用真实客户数据，不声明 production ready。

## 当前事实

```text
activeWorkPackage = null
R0-W00..R0-W06 = MERGED_AND_VERIFIED
R0-W07 ledger entry = absent
R0-W07 authorize = STOP / NO_ACTIVE_WORK_PACKAGE
reviewer reassignment overlay = registered for R0-W07
activation review package = generated / pre-owner candidate
activation intent = generated / pre-owner candidate
owner activation approval = absent
```

## 决策

旧 `.harness/changes/docs-r0-w07-activation-20260726` profile 不能继续充当新
activation Packet 的证据根。现有 loader 的 EXT ref/effective-base 等值规则也不能
证明 activation commit 已集成到 EXT，且现有 reviewer overlay 会拒绝受保护 authority
文件的任何漂移。

后续实施必须先以 TDD 修复 integrated-mainline identity contract 并将 canonical W07
profile 收敛到本 Change ID，再对新的 authority candidate 重新执行 reviewer overlay
审查和静默刷新。只有 refreshed overlay、activation evidence、owner approval 和独立
review 全部进入 quiescent registration history 后，才允许生成单父、原子的 manifest
activation candidate。

## 回滚

本 Packet 未进入本地 EXT 前，删除其隔离分支即可。进入 EXT 后如需撤销，只能通过
另行批准的前向治理提交；不得改写已登记 overlay 或历史 authority。
