# 任务拆解

## 任务 1：runOrderDecree 加 mode 参数，runSecretDecree 改薄封装

- 目标：让密旨提交走和下旨完全相同的真实管线，只在措辞上区分。
- 输出：`runOrderDecree(cmd, existingDraft?, mode = 'order')`；`runSecretDecree = (cmd) => runOrderDecree(cmd, undefined, 'secret')`。
- 验收：已完成，见 coding_report_v1.md。

## 任务 2：删除 secretBriefToEdict，复用 confirmedEdictToView

- 目标：不为密旨维护第二套渲染逻辑。
- 验收：已完成——`confirmedEdictToView` 本身是 mode 无关的通用函数，无需修改即可复用。

## 任务 3：退役 orchestrateAll，移除过时的占位徽标

- 目标：清理不再被调用的死代码，以及现在会说谎的"占位"UI(密旨已是真功能)。
- 输出：`chaotang.ts` 移除 `orchestrateAll`；`DecreeInput.tsx` 移除占位徽标 + 更新 `MODE_OPTIONS` 的密旨 title。
- 验收：已完成，`tsc --noEmit` 确认零残留引用(仅注释提及)。

## 任务 4：真实浏览器验证

- 目标：证明密旨真的调用了真实部门引擎，不是又一次"看起来对但实际没测过"。
- 验收：已完成——提交密旨后任务 `task_ede87bf18eaa` 轮询到 `awaiting_emperor_decision`，`户部`/`刑部`/`吏部` 三个部门的 `ministry_outputs[].source_label` 全部是 `LIVE_ENGINE`。
