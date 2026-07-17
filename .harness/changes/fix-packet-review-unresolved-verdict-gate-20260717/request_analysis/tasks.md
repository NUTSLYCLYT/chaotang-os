# 任务：fix-packet-review-unresolved-verdict-gate-20260717

## 任务 1：RED 复现下游绕过

- 目标：候选自身 GO，但实现链夹带另一个 change 最新 NO_GO，旧闸必须暴露误接受。
- 前置条件：现 D6 fixture。
- 输入：标准 `review-v1.md` NO_GO，无 approval。
- 输出：`Missing expected exception` RED。
- 涉及文件：nodetest fixture。
- 状态 / 数据变化：仅 `/tmp` Git fixtures。
- 验证命令与证据：定向 Node test。
- 回滚边界：删除 fixture。
- 完成定义：失败原因是 verifier 未扫全树终态。

## 任务 2：实现终态扫描

- 目标：按 change/numeric version 选择最新标准 review，非 GO 即阻断。
- 前置条件：任务 1 RED。
- 输入：candidate tree Git objects。
- 输出：tree path scanner、terminal parser、unresolved guard。
- 涉及文件：core verifier、wiki、nodetest。
- 状态 / 数据变化：无产品/外部状态。
- 验证命令与证据：unresolved 拒绝、损坏终态 fail-closed、v9→v10 GO 允许、真实候选回放、32 tests。
- 回滚边界：revert 并重装本地 hook bundle。
- 完成定义：无历史误报，现有审批几何测试全绿。

## 任务 3：独立审查与集成

- 目标：精确 B/H review、review-only commit、clean candidate、fast-forward ext。
- 前置条件：完整 suite/doctor 通过，远端零漂移。
- 输入：D6 change 证据。
- 输出：Claude GO、approval、merge、安装新 bundle 状态证据。
- 涉及文件：本 change `packet_review/` 两文件。
- 状态 / 数据变化：更新 Git 远端与显式本地 hook bundle。
- 验证命令与证据：candidate simulation、push、post-push status。
- 回滚边界：远端只用 revert；hook installer 支持保留旧 bundle。
- 完成定义：新 D6 在 ext，P6 才允许恢复。
