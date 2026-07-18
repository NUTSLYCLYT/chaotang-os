# 任务：fix-menxia-veto-enforcement-p16-20260719

## 任务 1：冻结边界并复现 CRITICAL

- 目标：证明最新远端仍在封驳后继续执行。
- 前置条件：B16 = `e38b31f901256a565e6b7900dd7f88b28c100dd6`。
- 输入：`我要去美国看世界杯决赛`。
- 输出：RED：实际 `edict_recorded`，预期 `menxia_veto_pending`。
- 状态 / 数据变化：隔离临时测试，已移除，不进入候选。
- 完成定义：缺陷由行为证据复现，不凭旧 review 推断。

## 任务 2：封住两条后端执行入口

- 目标：canonical compat dispatch 与 Shangshufang confirm 都在副作用前 fail closed。
- 涉及文件：Menxia、canonical dispatch、task projection、Shangshufang router 及后端回归。
- 输出：专属状态/review/纪要；无 outbox、无部门/蜂群执行；重复确认幂等。
- 验证：4 个后端聚焦文件；v2 新增 override 交互负例。
- 回滚边界：无 migration；只允许用等价 fail-closed 实现替代。
- 完成定义：状态与副作用断言同时通过。

## 任务 3：统一 REST / SSE / 页面语义

- 目标：所有消费者把 veto 显示为正常治理阻断，不是成功或系统故障。
- 涉及文件：canonical memorial/status projection、SSE adapter、BattleStream、当前挂载的中心工作面。
- 输出：`blocked` 终态、质量门 RED、明确“未生成奏折、未派发部门或蜂群执行”。
- 验证：node:test 18 passed；Playwright 首跑 RED，修复后 1 passed；tsc/build 通过。
- 完成定义：浏览器中无“已完成/异常终止/仍在执行”误导文案。

## 任务 4：更新架构冻结清单

- 目标：新增合法 writer 不得绕过 tenant 与单写者审计。
- 输入：全量首跑暴露 CourtReview 8→10 的精确差异。
- 输出：inventory 中两个函数计数各 +1，总数精确 10；所有构造显式 tenant。
- 验证：两个 AST 测试 3 passed；backend 全量复跑。
- 完成定义：不放宽扫描范围或比较规则。

## 任务 5：review-v1 NO_GO 回修

- 目标：关闭客户端 `department_override` 作为范围授权的 HIGH 旁路。
- RED：纯函数 marker 路由错误准奏；真实 `/decree/dispatch` 错误返回 `edict_recorded`。
- 输出：先审覆盖前丞相路由，再应用执行约束；删除 override marker 范围例外。
- 验证：世界杯+override 封驳且无 EmperorDecision/timeline/outbox/trigger；低温电池仍正常派单。
- 审计：保留 `packet_review/review-v1.md` 原文，不生成 approval-v1。
- 完成定义：两条 RED 转绿，聚焦/全量无回归。

## 任务 6：证据封包与独立复审 v2

- 目标：固定 25 路径 v2 候选，交 Claude Code review-only。
- 输出：P16 root change 四件套、review-v1 NO_GO、固定 H16-v2；复审只可新增 review-v2/approval-v2。
- 前置：全量、构建、Playwright、三层 doctor、diff check 全绿。
- 非目标：Gongbu HIGH、P17、人工 override、旧证据目录。
- 完成定义：Claude review-v2 `PACKET_REVIEW_GO` 后才允许 D6 no-ff merge 与顺序 push。
