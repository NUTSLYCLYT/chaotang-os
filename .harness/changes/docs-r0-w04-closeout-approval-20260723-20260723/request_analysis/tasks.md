# 任务：docs-r0-w04-closeout-approval-20260723-20260723

## 任务 1：固定受保护主线与关账身份

- 目标：证明 W04 的已合入事实与关账转换是两个可独立审查的对象。
- 前置条件：已获取 `origin/feature-chaotang-ext`。
- 输入：受保护主线 `2bcd5633`、关账提交 `fbea3761`。
- 输出：commit/tree identity 与两行状态 diff。
- 涉及文件：`.harness/r0-trusted-kernel-work-packages.json`。
- 状态 / 数据变化：仅由后续获批的关账候选表达；本任务本身只记录证据。
- 验证命令与证据：`git rev-parse <commit>^{tree}`、`git diff --stat`、`git diff`。
- 回滚边界：不改远端；废弃本地候选即可。
- 完成定义：基线、关账提交、tree 和 scope 均可精确引用。

## 任务 2：取得命名的 exact closeout 批准

- 目标：让 Project Owner 明确批准 W04 关账，而不是从“继续”或下一包意图推断。
- 前置条件：任务 1 完成，范围和排除项已成文。
- 输入：`owner_approval/exact-h-closeout-approval.md`。
- 输出：Owner 的明确确认及确认日期。
- 涉及文件：本变更记录的 `owner_approval/`。
- 状态 / 数据变化：批准前保持 pending，不推送、不合并。
- 验证命令与证据：Owner 对 exact identity 与批准语句的明确回复。
- 回滚边界：Owner 不批准则候选不进入主线。
- 完成定义：批准人、时间、identity、批准范围、排除范围齐全。

## 任务 3：验证关账静止态

- 目标：证明关闭 W04 不会隐式启动 W05。
- 前置条件：关账候选存在。
- 输入：关账候选工作树。
- 输出：结构、测试、doctor 与授权拒绝证据。
- 涉及文件：账本与验证脚本（只读执行）。
- 状态 / 数据变化：无运行时变化。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：任一门禁失败则不推送。
- 完成定义：全部结构检查通过，W04/W05 均返回 STOP。

## 任务 4：独立双轴复审

- 目标：分别证明仓库规范和需求语义正确。
- 前置条件：根级 change record 与审批证据完整。
- 输入：相对 `2bcd5633` 的完整 closeout diff。
- 输出：Standards/Spec 两份结论。
- 涉及文件：关账 diff 与本变更记录。
- 状态 / 数据变化：无。
- 验证命令与证据：独立 code-review 结果。
- 回滚边界：任何 MUST FIX 未解决都阻止推送。
- 完成定义：两轴均无未解决 MUST FIX。
