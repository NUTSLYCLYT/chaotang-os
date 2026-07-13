# 规格说明：chore-ready-for-review-triage-20260714

## 背景

S1 基线发现 11 个长期停留在 `READY_FOR_REVIEW` 的 change record。代码多数早已进入 ext，但缺少独立验收结论，且旧 CI 中存在空白或已过期的 PROD 声明。本变更只清算状态与证据，不修改这些功能的运行代码。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 10 项前端/后端功能均可定位到 ext 已合入提交 | `git show --name-only`；`triage.md` | 独立 reviewer | 否 |
| 已确认事实 | 10 项现行专项共 16 条通过（前端 13、true-chain 3） | tsx/pytest，2026-07-14 | 独立复跑 | 否 |
| 已确认事实 | lease 核心 9/9，但 backend closeout 8/9，且 adapter 无聚焦测试 | Node/pytest 输出；backend change CI | 独立复跑 | 是，阻塞 adapter 验收 |
| 已确认事实 | 当前生产仍 STOP | `pnpm prod:doctor -- --json` | exit 2 | 是，阻塞发布 |
| 推测 | 无 | 不适用 | 不适用 | 否 |
| 未知问题 | 外部 signer/authority 配置后的真实 gate 行为 | 尚未配置外部 trust anchor | S10 演练 | 是，阻塞 READY |

## 数据流与调用链

`change record -> 定位合入 commit -> 运行现行专项 -> 对照当前 prod doctor -> 写唯一结论 -> 更新原 summary -> 从 S1 队列移除`。验收合入只认可确定性代码行为；生产状态由独立发布身份门拥有。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 项目 change 状态 | 原 change summary | 根计划/工程负责人 | `VERIFIED_COMPLETE` 表示代码验收，不表示上线 |
| backend adapter 状态 | backend harness summary | backend/root gate | `RETURNED_FOR_FIX` 表示证据或行为仍需修正 |
| 当前发布结论 | `frontend/scripts/prod-doctor.mjs` | release commander/operator | STOP/READY 不得由历史 CI 覆盖 |

## 范围

- 清算全仓精确状态值为 `READY_FOR_REVIEW` 的 11 项。
- 为每项记录 commit、当前测试和唯一结论。
- 更新上线蓝图与 S1 inventory。

## 非目标

- 不修改被验收功能的运行代码。
- 不重跑 foreign 3050 上的浏览器流程并冒充 ext 证据。
- 不配置外部 trust anchor，不将 lease adapter 判为生产可用。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 已合入且当前专项通过 | 标 `VERIFIED_COMPLETE`，同时写明发布边界 | 10 项 summary + triage |
| 核心库通过但 adapter 自身组合失败 | `RETURNED_FOR_FIX` | lease adapter |
| 旧 CI 声称 PROD、当前 doctor STOP | 旧结论标历史，当前 STOP 优先 | 4 个 summary + prod doctor |
| 无当前浏览器证据 | 可验收确定性代码，但不得计入 release evidence | UI/harness 条目边界 |

## 风险与回滚边界

仅修改 change 元数据、清单与计划。回滚会重新产生未决队列，不影响运行代码；禁止为了全绿删除或弱化当前 STOP。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：继续 S1 下一最小闭环
- 明确未批准：部署、服务接管、外部 authority 配置

## 验收标准

- 11 项均有唯一结论，精确状态值 `READY_FOR_REVIEW` 归零。
- 验收矩阵带 commit 与当前测试证据。
- lease adapter 的失败不被核心 9/9 掩盖。
- 当前生产仍如实 STOP，doctor/diff/security 通过。

## 验证计划

- 前端 6 文件联合 tsx 测试。
- true-chain 后端 3 条测试。
- lease 9 条 Node 测试与 backend closeout 9 条测试。
- `rg` 状态清点、根 doctor、prod doctor、diff/security review。
