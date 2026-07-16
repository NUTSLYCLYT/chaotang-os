# P4.5 独立审查记录

## 审查对象

- 基线：`aca6a5a`
- 初始 P4.5f：`c3e8b3e`
- 首轮修复：`c875612`
- 最终复审 HEAD：`4746d87`
- 模式：独立只读审查；不修改文件、不触碰真实数据库、不推送。

## v1 — NO-GO

发现 route/final memorial 幂等重放未完整校验 tenant、worker 未校验
task/outbox/review 三方，以及冲突与 stale reaper 仍写污染归属的失败时间线。
新增 5 个 RED 后修复，相关核心回归转为 GREEN。

## v2 — NO-GO

发现 nullable 中间节点可桥接两次两两校验：

- task=7、existing event=NULL、replay=8
- task=7、review=NULL、existing memorial=8

参数化回归精确得到 2 failed / 2 passed；随后把每条 replay 边界的全部已知值
放入一次一致性检查，4 个参数化场景全部通过。

## v3 — GO

最终结论：GO for `4746d87`。

- timeline replay 单次校验 task/existing/replay。
- formal memorial replay 单次校验 task/review/existing memorial。
- direct/council worker 单次校验 task/outbox/review。
- lineage 冲突只更新既有 outbox 状态与错误，不新增污染时间线；reaper 同口径。
- 未发现新的高/中风险问题或幂等绕过。

独立证据：相关 7 文件 41 passed；26 个变更 Python 文件 AST 通过；
`git diff --check` 通过；backend/root doctor 均为 0 errors / 0 warnings；工作树 clean。

## 剩余非阻断风险

`record_timeline_event` 首次显式 tenant 写入不独立检查 task；当前生产显式调用仅来自
已完成 task/outbox/review 校验的 worker，其余生产调用默认从 task 派生，因此没有
可达污染路径。本包只冻结 provenance，不声明租户读隔离完成。
