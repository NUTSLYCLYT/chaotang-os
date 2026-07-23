# /study 下旨栏：dev slot 视觉保真

## 目标

把 `/study` 的下旨 textarea 与「下旨」按钮改为 `dev` 当前页面实际使用的
`DecreeInput placement="slot"` 视觉，而不是固定 Dock 版本。

## 允许修改

- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/app/study/study.module.css`
- `frontend/src/app/study/StudyClient.test.ts`

## 必须满足

1. 删除当前近似的 `.imperialComposer` 深色外壳、顶部金线、标题条和“旨 · 预览”标签；dev 的 slot 版没有这些外壳。
2. 输入与按钮置于相当于 dev `inSlot=true` 的透明、全宽、`flex items-center gap: 6px` 行中。
3. textarea 保持现有受控 state、`id="decree-text"`、`data-testid="decree-textarea"`、`maxLength={2000}`、`disabled={!canEdit}`、现有 `onChange` 与现有提交逻辑；使用 `rows={1}`，但不得添加 Enter 提交或任何新业务行为。
4. textarea 视觉精确使用 dev slot token：`height:32px`、`resize:none`、0 圆角、`padding: 6px 12px`、暗色纵向渐变、1px `rgba(240,198,106,.16)` 边框、`#F5E9C9` 文本、`#8F835F` placeholder、聚焦金色边框/柔光。
5. 「下旨」按钮使用 dev slot token：32px 高、12px 水平内边距、圆角 999px、`rgba(240,198,106,.4)` 边框、`rgba(240,198,106,.122)` 背景、金色文本、12px 卷轴图标与文字、hover 上移 1px/亮度 110%、禁用 opacity .5。不得添加依赖；使用本地内联 SVG 实现图标。
6. 保留 `type="button"`、`data-testid="submit-decree-button"`、`onClick={handleSubmitDecree}` 和 `disabled={!canSubmit}`。不改 BFF 调用、认证、响应渲染和费用提示。
7. 不迁移 dev 的模式切换、润色、上传附件、全局事件、键盘提交、蜂群状态机，或任何假功能控件。
8. 先让已有测试针对 dev slot class/token 的断言 RED，再实现到 GREEN；运行定向测试、lint、typecheck。

## 报告

完成后把实施文件、运行的命令及结果、以及未解决问题写入
`.superpowers/sdd/study-slot-input-report.md`；回复只包含状态、测试摘要和关注点。
