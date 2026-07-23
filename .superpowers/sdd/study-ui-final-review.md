+# /study 上书房视觉迁移复核

- 复核日期：2026-07-23
- 范围：`StudyClient.tsx`、`study.module.css`、`ChaotangHeader`、`EdictScrollShell`、相关测试，以及 `dev` 分支的 `ChaotangTopNav` / `EdictStage`。
- 验证：`frontend` 下执行 `npm test -- src/app/study/StudyClient.test.ts src/app/study/decreeStatus.test.ts src/components/chaotang/ChaotangHeader.test.ts src/components/chaotang/EdictScrollShell.test.ts`，29/29 通过。

## Critical

无。

- `frontend/src/app/study/page.tsx:5-7` 仍在渲染客户端组件前执行 `requireUser("/study")`。
- `frontend/src/app/study/StudyClient.tsx:37-94` 仍以原有请求体 POST `/api/decrees/chancellor`；第 53-59 行仍在 401 时跳转 `/login?next=%2Fstudy`。
- 全部既有下旨选择器和结果分支仍在 `StudyClient.tsx:123-202`。

## Important

1. 公共头部尚不是 `dev` 的真实公共头部，视觉/信息架构仍被明显简化。

   - 当前 `frontend/src/components/chaotang/ChaotangHeader.tsx:22-25` 只显示“上书房、史馆”两个导航入口，且以硬编码 `aria-current="page"` 固定上书房。
   - `dev:frontend/src/features/shangshufang/components/ChaotangTopNav.tsx:~340-385` 的真实公共头部按 `CORE_NAV` 渲染全部部门导航，并按当前路径决定 active 状态；其团龙徽记也包含渐变、龙角、须、爪等完整结构。
   - 当前 `ChaotangHeader.tsx:10-15` 仅保留两个龙身路径和两颗圆点。即使排除旧认证、时钟、通知、弹窗及 API，这仍不足以称为迁移后的真实 `dev` 公共 Header。建议至少迁移完整静态团龙 SVG，并以当前项目可访问的公共导航结构/路由激活逻辑替代两个硬编码链接。

## Minor

1. 行为回归测试主要是源码正则断言，未直接验证登录守卫、401 重定向或提交后所有结果 DOM。

   - `frontend/src/app/study/StudyClient.test.ts:5-17` 只确认源码中存在关键字符串。
   - 虽然本次人工复核确认 `page.tsx:6`、`StudyClient.tsx:40-44,53-59,154-202` 保留了目标逻辑，但后续重构可在不触发这些正则的情况下破坏真实行为。建议补充组件/路由级测试，至少覆盖 401 跳转、single/multi 成功展示与 error 展示。

## 已确认符合范围

- 背景使用 `frontend/src/app/study/study.module.css:2` 的 `/shangshufang/bg-shangshufang-full.webp`。工作树文件 blob 与 `dev` 一致，均为 `812a21ee46feebd473b437abd3e2fe1f46981957`。
- `EdictScrollShell` 保留了来自 `dev` `EdictStage` 的厚轴/玉轴、绫纸、云纹边、朱砂印、侧栏线与展卷动画；未引入三栏、Dock 或侧边栏。
- `StudyClient.tsx` 与两个新展示组件未引入 `dev` 的认证、旧 API、SWR、lucide、Tailwind 或 `@/` 别名依赖。

## Header addendum (2026-07-23)

### Important

1. Navigation slot widths do not yet match the dev header's visual rhythm.

   - `frontend/src/components/chaotang/ChaotangHeader.module.css:18` fixes every navigation item at `width: 78px`.
   - `dev:frontend/src/features/shangshufang/components/ChaotangTopNav.tsx:24-26,~379` uses `navSlotWidth`: 74px for two-character labels and 88px for labels of three or more characters. The current "大殿 / 上书房 / 军机处 / 六部 / 专署 / 史馆" strip is therefore visibly more uniform and compact than dev. Use the equivalent 74px/88px sizing (or CSS selectors that implement it) to satisfy the required full dev navigation rhythm.

### Approved

- `ChaotangHeader.tsx:11-18,53-64` now supplies six visible core-navigation slots. Only `/study` and `/shiguan` are Links; absent routes are non-interactive `span aria-disabled="true"` items.
- `ChaotangHeader.tsx:25-46` now uses a full static round-dragon SVG, without introducing an icon dependency.
- No fetch, storage, React state/effects, SWR, Tailwind, or `@/` dependency was found. `npm test -- src/components/chaotang/ChaotangHeader.test.ts` passed (1/1).

### Header slot-width re-review (2026-07-23)

Approved.

- `ChaotangHeader.tsx:54-65` derives `navWide` from `item.label.length >= 3` before rendering either a real Link or the disabled span. Thus the same rule applies to interactive and non-interactive items.
- `ChaotangHeader.module.css:18` sets the shared default to 74px and `.navWide` to 88px, matching `dev`'s `navSlotWidth` behavior.
- Prior interaction semantics remain intact: only `/study` and `/shiguan` are Links; unavailable routes remain `aria-disabled` spans.
