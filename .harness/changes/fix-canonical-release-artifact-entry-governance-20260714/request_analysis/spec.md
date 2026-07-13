# 规格说明：fix-canonical-release-artifact-entry-governance-20260714

## 背景

`frontend/scripts/package-release.mjs` 仍以已退役仓库名 `chaotang-web-lyt` 生成目录、tar 文件和 release manifest。项目也没有机器可读的旧入口清算表、统一调用遥测或删除资格门。用户批准本轮收编该入口，并将“唯一任务内核 + 14 天零调用删除门”纳入 harness。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | release package 的 `appName` 和 INSTALL 标题仍含旧身份 | `frontend/scripts/package-release.mjs:9,147`；RED test exit 1 | Frontend | 是 |
| 已确认事实 | 根 harness 尚无 capability entry governance | 初始 `project-harness.json` 无对应字段；契约测试 2/2 RED | Project Agent | 是 |
| 推测 | 某些外部消费者可能依赖旧 tar/目录名 | 仓库内无可靠外部调用遥测 | 外部部署 owner | 否；因此不删除兼容调用者 |
| 未知问题 | 入口真实 14 天调用量 | 当前无统一 runtime sink，inventory 写 `null` 而非 0 | 各入口 owner | 是；阻止删除，不阻止本次迁移 |

## 数据流与调用链

`pnpm package:release -> package-release.mjs -> Next standalone build -> chaotang-os-frontend/ -> release-manifest.json + INSTALL.md -> tar.gz`。

治理流：`发现旧入口 -> inventory 登记 -> RED 契约 -> 路由到 DecisionTask/EngineeringTask -> capability_entry_invoked.v1 -> 至少 14 天窗口 -> replacement evidence + 0 calls -> 独立删除决策`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| release artifact identity | `frontend/scripts/package-release.mjs` | 部署者、release manifest | `package-release-identity.nodetest.mjs` + 实际 tar 检查 |
| capability entry inventory item | `.harness/contracts/capability-entry.schema.json` | 根 inventory、owner | root contract test + doctor |
| `capability_entry_invoked.v1` | owner runtime | 清算聚合器（后续） | event schema；当前 sink 未实施 |
| 删除资格 | 根 manifest `deletionGate` | 后续清算变更 | 14 天、0 调用、verified replacement、decision evidence |

## 范围

- 只迁移一个旧 release artifact identity。
- 建立根级清算表、事件契约、14 天删除门和纵切证据规则。

## 非目标

- 不删除任何入口。
- 不实现统一 runtime telemetry sink。
- 不改变业务 DecisionTask/API/数据库/UI。
- 不以 43 条回归替代发布前 30 条黄金旨意。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 旧包名仍存在 | 契约测试失败 | RED exit 1 |
| canonical package | tar 顶层、manifest.app、INSTALL 全为 `chaotang-os-frontend` | 真实 package build |
| 遥测未知 | `invocations: null`，不得进入删除候选 | inventory contract test |
| 14 天为 13 天或调用 >0 | 不得 `DELETE_CANDIDATE` | governance test |
| 工程入口 | 绑定 EngineeringTask，不制造假奏折 | governance wiki |
| 生产身份不可信 | 继续 STOP | `prod:doctor` exit 2 |

## 风险与回滚边界

风险是外部部署脚本可能依赖旧包名；由于缺乏遥测，本轮只迁移生成身份并把旧项置为 `MIGRATED_OBSERVE`，不宣称可删除。回滚限定为本提交，不触碰生产进程和数据库。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：每个旧入口 RED→GREEN；每纵切 verification-loop；将清算表、遥测和 14 天门放入 harness。
- 明确未批准：同时迁移剩余两个旧入口、删除入口、生产发布。

## 验收标准

- package release 不再产出 `chaotang-web-lyt` 身份。
- 根 harness 有机器清单、两个 schema、14 天零调用删除门。
- 业务六阶段主链回归不退化；生产不误报 READY。

## 验证计划

聚焦 node tests、真实 package build、TypeScript/语法、43 条业务主链 pytest、三层 doctor、prod doctor、diff/security。
