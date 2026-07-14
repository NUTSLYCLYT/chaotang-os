# 能力入口清算与任务内核治理

## 结论

不把所有功能都塞进导航；把所有**业务能力**收敛进唯一 `DecisionTask` 内核。发布、运维和调试入口不伪装成业务旨意，而是绑定工程任务、release identity 和各自 owner 的运行证据。根 harness 只登记跨线契约、状态和证据，不承接运行时业务逻辑或遥测存储。

## 两类任务内核

| 入口类型 | 必须路由到 | 禁止事项 |
| --- | --- | --- |
| BUSINESS | `DECISION_TASK_KERNEL` | 绕过 DecisionTask 独立产出可裁决结果；导航直接调用平行算法 |
| RELEASE / OPS / DEBUG | `ENGINEERING_TASK_KERNEL` | 伪造奏折链；绕过 canonical repository、artifact、lease 或 release identity |

导航只负责发现、创建或查看 canonical task，不拥有第二套执行状态机。

## 功能清算表

机器事实源是 `.harness/manifest/capability-entry-inventory.json`，单项契约是 `.harness/contracts/capability-entry.schema.json`。每个入口必须记录 owner、入口路径、路由目标、处置状态、替代证据、遥测窗口和决策证据。

生命周期：

`DISCOVERED -> MIGRATE_REQUIRED -> MIGRATED_OBSERVE -> DELETE_CANDIDATE -> RETIRED`

仍属于主线的入口使用 `CANONICAL`，不进入删除流程。

## 调用遥测

统一事件名为 `capability_entry_invoked.v1`，契约在 `.harness/contracts/capability-entry-event.schema.json`。事件必须带：入口 ID、owner、发生时间、业务或工程 task ID，以及可获得的 commit/artifact/schema 身份。

遥测采集和存储归入口 owner：前端记录浏览器/发布入口，后端记录 API、worker 和脚本入口。根 harness 只保存聚合窗口和证据引用。没有遥测必须写 `null`，不得写成零。

## 14 天删除门

旧入口只有同时满足以下条件，才能从 `MIGRATED_OBSERVE` 进入 `DELETE_CANDIDATE`：

1. 连续完整观察至少 14 天；
2. 窗口内调用量严格为 0；
3. canonical replacement 状态为 `VERIFIED`；
4. 所有已知调用者已迁移，且 owner 提供 decision evidence；
5. 对应 RED→GREEN 契约测试和 verification-loop 均通过。

`null`、缺失窗口、部分天数、只有 mock、只有搜索结果都不等于零调用。删除是后续独立变更，不与迁移同提交。

## 每个纵切的证据

业务纵切必须核对：`DecisionTask -> DecreeExecutionEvent -> candidate memorial -> FinalMemorial -> EmperorDecision -> ShiguanArchive`。若某阶段不适用，必须说明原因，不能静默跳过。

发布/运维纵切核对工程 task、事件、artifact/release evidence、裁决与归档；不得为了“看起来全链”制造假的业务奏折。公开发布前另需运行至少 30 条黄金旨意，覆盖真实业务六阶段全链；这不是单个工程入口迁移可以替代的证据。

## 当前限制

- inventory v2 已登记 12 个 BUSINESS 事实面：1 个 canonical 主链、7 个待迁移入口族、4 个待遥测/裁决入口族；该分类只冻结所有权和下一步，不证明运行时已经融合。
- 当前清算表刚进入 `OBSERVE`，尚未建立统一 runtime telemetry sink。
- 因此任何入口都不能仅凭本清单进入删除候选。
- 生产仍受 immutable build、foreign 3050 和外部 trust anchor 门约束。
