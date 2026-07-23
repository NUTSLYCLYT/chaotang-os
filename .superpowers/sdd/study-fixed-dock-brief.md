# /study：dev 固定底部下旨 Dock

## 目标

满足用户确认的布局：下旨输入和按钮采用 `dev` 的固定底部 Dock；圣旨标题、说明、费用提示和丞相回奏留在上方卷轴内，并在上方独立滚动区展示。

## 基准

只以 `dev:frontend/src/features/shangshufang/components/DecreeInput.tsx` 的 `placement !== "slot"` 分支为固定 Dock 视觉来源。

## 允许修改

- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/app/study/study.module.css`
- `frontend/src/app/study/StudyClient.test.ts`

## 必须满足

1. 将 composer 移出 `EdictScrollShell`；卷轴中只保留圣旨和丞相回奏。固定 Dock 位于页面底部，不能随卷轴内容滚动。
2. 背景主区为受限视口高的纵向 flex 布局；上方 `edictArea` 是 `flex: 1`、`min-height: 0`、可纵向滚动的区域，并为固定 Dock 预留至少 128px 的底部空间。
3. Dock 用 `position: fixed; inset-inline: 0; bottom: calc(32px + env(safe-area-inset-bottom)); z-index: 96`；外层水平 padding 16px、居中。dock shell 最大宽 1180px、圆角 16px、金色 .30 边框、dev 的黑金渐变、14px backdrop blur、对应阴影和顶部 1px 金线/光晕。
4. 操作行在窄屏纵向、`min-width:768px` 起横向；textarea 使用 dev fixed token：36px、高圆角、水平 14px/垂直 8px、深色背景、金色 .267 边框、浅金文字；按钮 36px、16px 水平 padding、金色 .4 边框与 .122 背景、12px 内联卷轴 SVG、hover 上移 1px/亮度 110%、禁用 .5。
5. 保留 current `textarea` 的 state、`id`、`data-testid`、`maxLength`、`disabled={!canEdit}`、`onChange`；保留 current button 的 `type="button"`、`data-testid`、`onClick={handleSubmitDecree}` 与 `disabled={!canSubmit}`。不添加 Enter 提交、模式、附件、润色、全局事件、后端直连或任何假功能。
6. BFF、401 跳转、费用提示、全部响应渲染和 `decree-*` 测试标识不得改动。
7. 先增加/修改针对固定 Dock 和组件顺序的断言，确认 RED 后再实现；完成后运行定向测试、lint、typecheck、git diff --check。

## 报告

把实施说明、命令结果及未解决项写入 `.superpowers/sdd/study-fixed-dock-report.md`；不提交、不推送。
