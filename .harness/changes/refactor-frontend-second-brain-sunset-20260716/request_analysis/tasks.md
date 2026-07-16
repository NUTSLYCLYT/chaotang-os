# 任务：refactor-frontend-second-brain-sunset-20260716

## 任务 1：P4a 读模型缺口地图

- 目标：从 UI 实际消费字段反推 canonical 读模型缺口，形成可执行施工图。
- 前置条件：P3 已合入 ext，canonical task/brief/memorial 链稳定。
- 输入：军机处/上书房页面、`swarm_review`、memorial、task projection 与 quality gate。
- 输出：已有等价物、纯派生缺口、非目标与 golden 蒸馏清单。
- 涉及文件：`p4a-read-model-gap-map.md` 与本 change 记录。
- 状态 / 数据变化：无运行时或数据变化。
- 验证命令与证据：commit diff check、三层 doctor、backend closeout。
- 回滚边界：可 revert P4a docs commit 和收口记录，不影响产品运行。
- 完成定义：字段映射有源码依据；不新增表/状态机；P4b/P4c 边界明确。
- 状态：COMPLETE。

## 任务 2：P4b 删除已有等价物的前端叠加

- 目标：先删除 `nextAction` / `missingEvidence` 等已有 canonical 等价物的本地叠加。
- 前置条件：为军机处与上书房建立同形消费测试。
- 输出：两页只消费 canonical 字段，展示行为不倒退。
- 状态 / 数据变化：待实现；不得增加第二事实源。
- 完成定义：TDD + 页面/API 契约回归 + 独立审查。
- 状态：PENDING。

## 任务 3：P4c 蒸馏规则并退役前端引擎

- 目标：用 golden cases 固化 verdict/overall/conflict/red-team 规则，再迁入统一投影。
- 前置条件：P4a 蒸馏清单与 P4b 消费边界稳定。
- 输出：后端派生字段、golden cases、前端第二状态机退役证据。
- 状态 / 数据变化：待实现；不新增持久化状态。
- 完成定义：golden 等价、双页复用、旧引擎不可达、独立审查 GO。
- 状态：PENDING。
