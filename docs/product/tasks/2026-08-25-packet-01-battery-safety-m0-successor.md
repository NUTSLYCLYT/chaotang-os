# Packet 01 — Battery Safety M0 Successor

任务 ID：`PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825`

新基线：`origin/ext-dev@9bf91023604fb873591f1928de31495a28ca0284`

新基线 tree：`f602e8737cfeca86fd24704f52f914fa4c20d057`

> 本任务遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。Owner 已确认 canonical
> approval digest，并分别授权一次三文件 approval commit、该提交的 fast-forward push，以及 machine GO
> 后一次本地 candidate commit。产品写入仍以 machine GO 为前置；candidate push、merge、pilot、release
> 与 deploy 均未授权。

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-08-25 精确确认 canonical approval digest `sha256:3bd07a0181a03652a629046dc9583e6cf01477bc9473487835214d98ff1ecdbf`，授权一次三文件 approval commit、该提交的 fast-forward push，并条件授权 machine GO 后重物化 exact9 及创建一次本地 candidate commit；candidate push 明确未授权。
- 问题：原 Packet 01 approval 绑定 `dce861a42cf2fb9202415694001c5367cebf10c4`；远端 `ext-dev` 已推进至 `9bf91023604fb873591f1928de31495a28ca0284`，旧 authority 确定性返回 `STOP / APPROVAL_COMMIT_PARENT_INVALID`。
- 目标用户：需要在朝堂 OS 中得到确定性电池事故安全防线的 Owner、审核者和最终使用者。
- 目标：在新基线上以新的 approval 和唯一单亲候选，重物化原 Packet 01 的 exact9 电池安全纵切，并取得新鲜、可复验的身份和验证证据。
- 非目标：不把 legacy、`origin/dev`、Four-Gate 未实施 consumer、Packet 02+、P14/P15、发布执行或第二事实源夹带进本候选。

## Acceptance Criteria

- [x] Owner 精确确认 canonical approval digest `sha256:3bd07a0181a03652a629046dc9583e6cf01477bc9473487835214d98ff1ecdbf`；raw file checksum 只作传输校验，不冒充 approval identity。
- [ ] approval commit 是 `9bf91023604fb873591f1928de31495a28ca0284` 的唯一单亲子，且只修改冻结的三条治理路径。
- [ ] 远端精确等于 approval commit、工作树干净，`--authorize` 返回 `GO / APPROVED_FOR_ONE_CHILD` 和上述 canonical digest。
- [ ] 新 candidate 是 approval commit 的唯一单亲子，只修改 exact9，保持 `2 ADD + 7 MODIFY` 且全部模式为 `100644`。
- [ ] proposed approval 的九项机器矩阵全绿，其中 exact9 byte-identity 门同时校验 9 个 mode/blob OID 和 full-index binary patch digest；独立代码与安全复审无未关闭 P0–P2。
- [ ] 同一 candidate SHA/tree 上连续 10 次 `--verify-candidate` 均返回 `PASS`，每次均重跑同一九项矩阵；任一失败或字节/配置/流程变化从第 1 轮重计。
- [ ] Owner 按 candidate SHA/tree、canonical approval digest 和 10 轮 evidence digest 集合做最终接受；push/merge/deploy 仍分别授权。

## Delivery Constraints

- 范围：先完成治理三文件；只有 authority GO 后才允许 exact9 产品路径，不得扩为第十条产品路径。
- 兼容性：保持 ADR 0028 单一奏折→上书房→六部或军机处→三策→史馆 REPLY 主链，不创建第二 authority、数据库、API namespace、前端控制面或现实设备动作。
- 风险与限制：旧候选只能作为内容寻址输入；旧 approval、nonce、candidate/tree/evidence 身份均不得复用；真实模型、密钥、公网、生产数据和外部设备保持关闭。
- 技能计划：`caveman:migration` 用于兼容安全的渐进融合；项目 `codex-engineering-workflow` 用于 authority、验证和连续 10 轮验收。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：中书省拟旨前电池安全分类、三层不可降级安全门、API 注册/执行前复核及对应回归测试。
- 允许路径：`backend/app/agents/chancellor/graph.py`、`backend/app/agents/chancellor_draft/battery_safety.py`、`backend/app/agents/chancellor_draft/graph.py`、`backend/app/api/chancellor_drafts.py`、`backend/tests/test_battery_safety.py`、`backend/tests/test_chancellor_draft_graph.py`、`backend/tests/test_chancellor_drafts_api.py`、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_sqlite_backup.py`。
- 依赖模块：现有中书省 draft/decree 执行链、工部·技术司路由、SQLite backup 门和根级 product authority/harness；依赖只复用，不扩边界。

## Technical Plan

- 架构边界：认证/会话身份读取可以先行；原始业务输入必须在任何模型、外网、业务缓存、authority 注册、业务数据库写入、证据会话或部司调用前分类；draft、API 注册和执行前形成三层 fail-closed 防线；旧候选不得直接 merge、cherry-pick、rebase 或 amend。
- 接口与依赖：P0/P1 均为 `BLACK`、要求人工确认并强制工部·技术司；P0 还必须包含现场断电、撤离、消防待命和禁止远程复位/直接维修；decree、route snapshot 与 fingerprint 绑定同一语义。
- 实施顺序：Owner 确认 canonical digest → 一次性 approval commit/push 授权 → 远端精确头 machine GO → 重物化 exact9 → 一次性本地 candidate commit 授权 → 新 candidate → 新鲜验证/独立复审/连续 10 轮 → Owner 精确接受 → 如获授权再 push。
- 验证计划：以 proposed approval 中冻结的九条 command/args/cwd/timeout 为机器事实源；identity 命令先验证 exact9 blob/mode 与 patch digest；P0/P1 负例验证模型、authority 注册/撤销/消费和 route snapshot 等业务副作用计数保持零；`--verify-candidate` 每次重跑九项并输出 candidate SHA/tree、approval digest 和 evidence digest；最终在未改变的同一候选上连续通过 10 次。
- 技术风险：远端漂移、工作树污染、第十路径、approval/candidate 父子关系错误、安全路由被后层降级或把旧 evidence 当新证据；任何一项触发即 STOP。

## Implementation Report

- 改动摘要：已拉取并审计当前 `origin/ext-dev@9bf910236`、`origin/dev@6332d597b`、legacy 两提交和旧 Packet 01 candidate；已把易失的旧 candidate 保存为持久本地分支；本 approval commit 将只包含正式 approval、本 Task 与 Plan。
- 自审：9bf 与旧 exact9 无路径冲突，旧补丁可干净应用；但它们是共同父 `dce861a4` 的兄弟提交，旧 approval 已失效，因此必须新建 successor，不能普通合并旧候选。
- 验证：旧 authority 在 9bf 返回 `STOP / APPROVAL_COMMIT_PARENT_INVALID`；修订后的 manifest 通过闭合 schema/parser，exact9 identity probe 通过；Root Harness、Harness Doctor、V2 check/regression 均通过；product-authority 回归在其冻结环境中 `12/12 PASS`；独立治理与安全复审均为 GO，无未关闭 P0–P3。
- 实际使用的 skill：`caveman:migration`、项目 `codex-engineering-workflow`。
- 验证命令与结果：已完成只读 fetch、拓扑/路径/补丁检查、manifest parser、exact9 blob/patch identity probe、Root Harness、Harness Doctor、V2 check/regression 和 product-authority `12/12` 回归；产品候选九项矩阵尚未获权运行。
- 未运行项与原因：authority GO、exact9 重物化、候选提交、九项机器矩阵和 10 轮候选验证必须等待本 approval commit 成为远端精确头；candidate push 未获授权。
- 剩余风险：本治理提交不自动构成产品 authority；远端若再次移动必须重建基线和 approval，不能沿用本 digest。

## Governance Evidence

### 旧候选（仅内容输入）

- commit：`e67beabc50ccb338e851053577f963516b9834f7`
- tree：`9132d10dc83032eeef6ff197ec406fc6e5d6c361`
- parent：`dce861a42cf2fb9202415694001c5367cebf10c4`
- 差异：9 paths，1892 insertions / 31 deletions
- 持久本地分支：`codex/packet01-battery-safety-e67beabc-20260825`
- full-index binary patch digest：`sha256:ad7ea7901d67a94212aa44d970eb68604faaed479db7c55d1481bb1da1fcae96`

| 路径 | mode | 目标 blob OID |
| --- | --- | --- |
| `backend/app/agents/chancellor/graph.py` | `100644` | `8d2c445eb473786aa4bab0ef9ad69945bd0c9dfe` |
| `backend/app/agents/chancellor_draft/battery_safety.py` | `100644` | `7bd88ec54fd25b6067b024a658c0d28a2ef3b2bf` |
| `backend/app/agents/chancellor_draft/graph.py` | `100644` | `01f30e2ebed30918b9c97c609a2f040a3564b1b7` |
| `backend/app/api/chancellor_drafts.py` | `100644` | `f37b74b82459baf177853d1b1d1ff153328ff7c1` |
| `backend/tests/test_battery_safety.py` | `100644` | `ace340b9cf738b5a66c6c0e8d5fd87743abdb86a` |
| `backend/tests/test_chancellor_draft_graph.py` | `100644` | `c118412e1c1c502ab92b6a26f73147783b139425` |
| `backend/tests/test_chancellor_drafts_api.py` | `100644` | `085a9e3891f8a6cd367a316da5ba1759b195367f` |
| `backend/tests/test_chancellor_graph.py` | `100644` | `b6097c0ec0e37cd0e15e30f6c1850193427a3e45` |
| `backend/tests/test_sqlite_backup.py` | `100644` | `520184718e31fb74ac553d1fcce7a802c68da64f` |

上述清单和 patch digest 已嵌入 `candidate-exact9-byte-identity` 机器命令；候选验证不依赖本地旧 commit
仍可达，且实现与测试任一字节、模式或相对父提交的补丁变化都会失败关闭。

### 9bf Four-Gate 状态

9bf 内的 Four-Gate consolidated replan 绑定 `dce861a4`，其“远端离开基线即 STOP / REPLAN_REQUIRED”
条件已由 9bf 自身成为远端头触发。该工作包现明确记为
`DRAFT_NON_AUTHORIZING_STOP / TERMINATED_BY_BASE_DRIFT / TASK_LOCAL_STOP / AUTHORITY_NOT_INHERITED`，
只保留审计证据：

- 未实施的 Four-Gate consumer 不参与本 M0 决策；
- 本 successor 不继承、不修改、不重开其 authority；
- Four-Gate 四条治理路径与 exact9 无交集不等于它已获激活。

### Approval materialization

Owner 确认的 proposed 字节已原样物化到
`.harness/approvals/PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825.json`；临时 proposed 路径不进入
本提交。approval commit 的 changed paths 必须精确等于 manifest 内的三条 `approvalCommitPaths`，
commit 后 `git status --porcelain` 必须为空。

## Stop And Rollback

远端离开未来 successor approval commit、需要第十产品路径、候选不是 approval 的唯一单亲子、任一矩阵
或连续轮次失败、出现新 P0–P2、工作树不干净或需要扩大产品范围时立即 STOP。

新候选无 schema/数据迁移。回滚单位是未来唯一候选整提交，并需要独立授权；禁止 reset、force-push
或局部保留四层安全链。

## Acceptance Review

- 验收结果：Governance Ready；Product Pending
- 验收证据：Owner 已确认 canonical approval digest；独立治理与安全复审均为 GO；机器 authority 尚未 GO，新候选尚未物化。
- 未通过项：除 Owner digest 确认外，其余 Acceptance Criteria 待执行。
