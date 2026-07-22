# 执行权威 v2（R0-W01 范围授权）

`execution-authority.v2` 是 `R0-TRUSTED-KERNEL-AMENDMENT-01` 修正案批准 R0-W01 之后新建的
独立授权闸门。**它不修改、不重钉、不依赖 `execution-authority.v1` 的任何字节**——v1 的 schema、
manifest、resolver、CLI、wiki 全部保持原样，永远输出 `STOP`。v2 是另一套独立的
schema/manifest/resolver/CLI/tests，专门回答一个更窄的问题：

> 当前这个具体的 work package，是否已经拿到批准证据、且轮到它了？

## 命令语义

- `node scripts/execution-authority-v2.mjs --status`：只显示当前 `activeWorkPackage`，退出码 0，
  不构成授权。
- `node scripts/execution-authority-v2.mjs --check`：只证明 manifest/schema 结构合法，退出码 0，
  **不评估 `--work-package`**，不得当成"可以开工"。
- `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx> [--real-customer-data]`：
  唯一真正的开工查询。批准返回 `decision:'GO'`，退出码 **0**；任何 STOP 情形退出码 **2**。

> 这与 v1 的退出码惯例相反：v1 因为永远没有 GO 路径，`--authorize` 永远退出 2。v2 需要一条真正
> 的成功路径供自动化 `&&` 串联，因此改为 0=GO / 2=STOP。PR 里已显式标注，不是笔误。

不识别的参数一律退出 64（`UNSUPPORTED_COMMAND`），与 v1 一致。

## reason code 枚举

| reason | 含义 |
| --- | --- |
| `INVALID_EXECUTION_AUTHORITY` | manifest/schema 结构或字段格式不合法 |
| `AMENDMENT_DIGEST_DRIFT` | manifest 的 `approvedSourceDigest` 与 `amendmentGovernance` 记录的不一致，或治理状态不是 `APPROVED_FOR_W01` |
| `EFFECTIVE_BASE_MISMATCH` | manifest 的 `effectiveBase.sha` 与治理记录的基线不一致 |
| `REVIEW_NOT_GO` | 批准证据里的三路 review verdict 不是 `GO` |
| `WORK_PACKAGE_ARGUMENT_REQUIRED` | `--authorize` 未传 `--work-package` |
| `UNKNOWN_WORK_PACKAGE_FORMAT` | 传入的包 ID 不匹配 `^R0-W0[0-9]$`（挡旧编号如 `P12`/`PKT-04`/`S3`） |
| `MULTIPLE_ACTIVE_WORK_PACKAGES` | ledger 里同时有两个以上 `ACTIVE` 条目（结构性拒绝，属于致命错误分支） |
| `BLOCKED_DEPENDENCY` | 请求的包，其前驱包在 ledger 里还没到 `MERGED_AND_VERIFIED` |
| `WORK_PACKAGE_MISMATCH` | 请求的包前驱已满足，但它不是当前 `activeWorkPackage` |
| `NO_ACTIVE_WORK_PACKAGE` | 回滚态或**静默收口态**：`activeWorkPackage` 为 null，ledger 无 `ACTIVE` 条目 |
| `PROFESSIONAL_REASSIGNMENT_REQUIRED` | 请求 W08/W09 或标记 `--real-customer-data`，但 security/legal/release 三角色仍是默认 owner |
| `APPROVED_WORK_PACKAGE` | 全部条件通过，`decision:'GO'` |

## ledger / 依赖链模型

`workPackageLedger` 只记录已经发生过的包，不预铺 W02-W09 的占位状态（YAGNI：那些包的真实前置
条件现在不存在，占位只会制造未来忘记同步的机会）。每个后续 packet 落地时，在**同一次变更**里把
自己的前驱条目改成 `MERGED_AND_VERIFIED`、追加自己的 `ACTIVE` 条目——这与
`amendmentGovernance` 状态跃迁必须原子发生的纪律完全一致。

依赖顺序是固定常量 `EXPECTED_R0_WORK_PACKAGE_SEQUENCE`（`R0-W00` 到 `R0-W09`），不在 manifest
里重复声明。

**"包完成"不自动推导"下一包获批"**：某个包合入并复验为 `MERGED_AND_VERIFIED` 后，`activeWorkPackage`
必须先落回 `null`（静默收口态），不能在同一次变更里顺带把下一个包标成 `ACTIVE`。收口和下一包
激活是两个独立的、各自需要具名批准证据的治理事件（amendment §10："任何笼统的'继续'不能替代对
未来 exact digest/base 的批准证据"这条纪律，同样适用于"包与包之间的推进"，不只是"进入修正案"
这一次）。静默收口态下，重新请求刚收口的包、或请求任何后续包，一律 `NO_ACTIVE_WORK_PACKAGE`。

## 专业负责人重新指定门（运行时强制）

`R0-TRUSTED-KERNEL-AMENDMENT-01` §4 曾把这条要求记成"声明式前置，尚未运行时强制"。v2 落地后，
这条门**已经是运行时强制**：请求 `R0-W08`/`R0-W09` 或显式传 `--real-customer-data` 时，只要
`security`/`legal`/`release` 三个角色的指派仍等于 `professionalReassignment.defaultOwner`
（当前是 `lyt`），一律 `STOP/PROFESSIONAL_REASSIGNMENT_REQUIRED`。这条分支目前无法构造出"通过"
的真实 fixture——这是设计使然，不是覆盖率缺口。

## v1 与 v2 共存说明

在 `AGENTS.md`/`.harness/agents/project-owner.md`/`.harness/rules/project-workflow.md`（v1 的
`governedDocuments`）被一次独立的受控摘要重钉变更改成同时点名 v2 之前，两套命令并存不矛盾：
v1 回答"最底层的失效关闭护栏结构是否完好"（永远 STOP），v2 回答"这个具体 work package 现在是否
被授权"（可以是真 GO）。W01 自身的授权不依赖 v2 存在——它来自已经落盘的 Product Owner exact-H
批准 + 三路独立 Claude Code 审查证据，v2 只是把"接下来怎么继续往前走"这件事管起来。
