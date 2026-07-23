# 规格说明：docs-r0-w04-closeout-approval-20260723-20260723

## 背景

受保护主线 `origin/feature-chaotang-ext@2bcd5633` 已包含 W04 实现与评审结果，但机器可读工作包账本仍把 W04 标为 `ACTIVE`。这会使后续工作误以为 W04 仍在执行，也阻止项目以清晰、可审计的静止态申请 W05。候选提交 `fbea3761` 只执行两项账本转换：清空 active work package，并把 W04 标记为 `MERGED_AND_VERIFIED`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W04 实现已存在于受保护主线；关账候选仅修改账本两处状态 | `origin/feature-chaotang-ext@2bcd5633`；`fbea3761`；2026-07-23 | Git identity、diff 与 authority 检查 / Project Agent | 否 |
| 推测 | 无；不以“准备开始 W05”推导 W05 已获批准 | 不适用 | 明确排除推断授权 | 否 |
| 已确认事实 | Project Owner 已对该 exact closeout identity 作命名确认 | `owner_approval/exact-h-closeout-approval.md`；2026-07-23 | 用户原文确认 / Project Owner | 否 |

## 数据流与调用链

受保护主线合入事实 → Project Owner 对 exact closeout identity 命名批准 → 账本关闭 W04 → authority 验证 W04/W05 均为 STOP → 项目进入静止态。未来 W05 激活必须走另一份 amendment/approval，不由本关账事件串联触发。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 工作包执行状态 | `.harness/r0-trusted-kernel-work-packages.json` | execution-authority-v2、项目 Agent | JSON 结构检查、27 项 authority 测试 |
| W04 关账批准 | 本变更的 `owner_approval/exact-h-closeout-approval.md` | Project Owner、审查者 | 必须由 Owner 明确确认；当前为 pending |

## 范围

- 将 `activeWorkPackage` 从 `R0-W04` 设为 `null`。
- 将 `R0-W04.status` 从 `ACTIVE` 设为 `MERGED_AND_VERIFIED`。
- 固化受保护主线、关账提交、tree identity、验证命令和审批边界。

## 非目标

- 不批准或激活 W05–W09。
- 不修改前端、后端、数据库、provider、蜂群运行逻辑或部署配置。
- 不声称真实客户数据或生产环境已经通过。
- 不推送、合并或部署本地候选。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Owner 尚未明确批准 exact closeout identity | 保持候选在本地，不推送、不合并 | approval 文件状态为 `PENDING_EXACT_OWNER_APPROVAL` |
| 关账后请求 W04 | `STOP / NO_ACTIVE_WORK_PACKAGE` | `execution-authority-v2 --authorize --work-package R0-W04` |
| 关账后请求 W05 | `STOP / NO_ACTIVE_WORK_PACKAGE` | `execution-authority-v2 --authorize --work-package R0-W05` |
| 未来批准 W05 | 必须由独立 amendment 激活，不可由本记录继承 | 本记录的非目标和 approval 排除项 |

## 风险与回滚边界

风险是把关账误读为下一包授权，造成未经批准的实施。控制方式是保持 `activeWorkPackage: null`，在审批文件中列出明确排除项，并以 W04/W05 都返回 STOP 作为验收证据。若不批准或验证失败，保持受保护主线 `2bcd5633` 不变；本地候选可直接废弃，无运行时回滚。

## 计划确认记录

- 批准人：Project Owner（lyt）
- 批准日期：2026-07-23
- 批准范围：仅为 `fbea3761` 所表达的 W04 关账状态转换
- 明确未批准：W05–W09 激活、客户数据、运行时实现、推送、合并、发布、生产切换

## 验收标准

- Owner 明确批准本记录给出的 exact closeout identity 与范围。
- 账本只有两项预期状态变化，且不存在隐式 W05 激活。
- authority v2、amendment、harness doctor 全部通过。
- 关账后 W04 与 W05 的授权请求都返回 STOP。
- Standards 与 Spec 双轴审查不存在未解决的 MUST FIX。

## 验证计划

运行 authority v2 的 27 项单元测试和结构检查、amendment 的 10 项测试和结构检查、harness doctor；分别尝试授权 W04/W05 并确认拒绝；复核 diff；在补齐本根级变更记录后重新进行独立双轴审查。
