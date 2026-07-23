# `/study` 上书房视觉保真审计

审计时间：2026-07-23
范围：仅比较公共头部、实体卷轴和背景；基准为 `dev` 的
`frontend/src/features/shangshufang/components/ChaotangTopNav.tsx` 与
`MemorialScroll.tsx`（`EdictStage`），以及 `bg-shangshufang-full.webp`。

## 结论

背景图片文件已正确迁入：当前文件 blob 与 `dev` 完全相同（`812a21ee…`）。但页面
并非 dev 视觉元素的近似逐项迁移：头部导航信息结构被大幅缩减，卷轴两侧轴和纸面
层次是新的简化画法。因此当前页面会给人“同一题材的重画版”而非 dev 上书房的感觉。

## 发现（按优先级）

### P0 — 公共头部被缩减为两项静态导航，桌面信息结构与 dev 不一致

- 当前：[ChaotangHeader.tsx:22-26](../../frontend/src/components/chaotang/ChaotangHeader.tsx#L22-L26)，
  [ChaotangHeader.module.css:18-19](../../frontend/src/components/chaotang/ChaotangHeader.module.css#L18-L19)。
- dev 基准：`ChaotangTopNav.tsx:377-417`（`CORE_NAV` 全部门导航、路由自动高亮、右侧日期/状态区）。
- 影响：桌面头部当前只呈现“上书房 / 史馆”和纯文本位置，dev 的九部门节奏、宽度分配、
  当前路由感知与右侧锚点均消失；这改变了最显眼的公共 chrome，而不仅是移除了旧业务交互。
- 建议：保留无副作用的视觉/导航部分：`CORE_NAV` 等价的链接数据、当前路径高亮、响应式断点和
  右侧静态展示；不迁移通知、能力弹窗、账户菜单等依赖旧业务的交互。

### P0 — 两侧卷轴轴的材质、位置和移动端策略均不是 dev 实现

- 当前：[EdictScrollShell.module.css:10-41](../../frontend/src/components/chaotang/EdictScrollShell.module.css#L10-L41)，
  [EdictScrollShell.module.css:132-138](../../frontend/src/components/chaotang/EdictScrollShell.module.css#L132-L138)。
- dev 基准：`MemorialScroll.tsx:1639-1677`。
- 影响：dev 使用纸面外侧的 `34px` 金木渐变厚轴、40px 玉质端帽、金属箍和高光，且在
  `md` 以下隐藏；当前是贴在舞台边界内的 `27px` 棕色圆柱，端部是扁平椭圆，移动端仍显示。
  卷轴的主要识别元素因此明显不同，并在小屏占用正文空间。
- 建议：按 `SideRoller` 的静态结构与渐变值迁移为隔离 CSS/DOM，使用 `-left/-right` 外置定位，
  并在 `<768px` 隐藏；不需要迁移任何业务状态。

### P1 — 卷轴纸面少了 dev 的关键层次，当前观感更像通用卡片

- 当前：[EdictScrollShell.module.css:43-125](../../frontend/src/components/chaotang/EdictScrollShell.module.css#L43-L125)。
- dev 基准：`MemorialScroll.tsx:1753-1809`、`1858-1927`。
- 影响：当前有基础纸纹、边框、云纹和静态印章，但缺少 dev 的舞台上下光晕、两条纵向金色细线、
  斜向/横纵纸纤维、顶部高光、边缘暗角，以及内边框的同色双层光晕。当前 `paper::before`
  使用的规则横线也与 dev 的纸面纹理组合不同。这会让中央卷轴的深度和丝绫质感显著变平。
- 建议：逐层迁移 `EdictStage` 的纯装饰 spans 和 `memorial-stage::before`，保留现有 children
  作为内容插槽；不要迁移 `EdictView`、分页和动作 Dock。

### P1 — 纸面高度模型不匹配，长回奏时不会拥有 dev 的工作区内滚动行为

- 当前：[EdictScrollShell.module.css:43-55](../../frontend/src/components/chaotang/EdictScrollShell.module.css#L43-L55)，
  [study.module.css:2-5](../../frontend/src/app/study/study.module.css#L2-L5)。
- dev 基准：`MemorialScroll.tsx:1753-1759`、`1854-1866`、`1943-1947`。
- 影响：当前纸张强制 `min-height: 620px`，内容按页面自然向下扩展；dev 的卷轴以父工作区
  `h-full/min-h-0` 为边界，并为内容提供专属滚动容器与定制滚动条。提交后产生较长“丞相回奏”时，
  当前页面会拉长整个页面，失去 dev 的“固定卷轴/案卷内阅读”构图。
- 建议：让 `/study` 工作区提供明确的可用高度，将纸面和内容区改为 `min-height: 0` 的 flex 布局；
  把现有回奏区域置入可滚动正文容器。需同时复核键盘焦点和小屏自然滚动。

### P2 — 印章和展卷仪式只保留了静态简版

- 当前：[EdictScrollShell.module.css:98-115](../../frontend/src/components/chaotang/EdictScrollShell.module.css#L98-L115)，
  [EdictScrollShell.module.css:127-142](../../frontend/src/components/chaotang/EdictScrollShell.module.css#L127-L142)。
- dev 基准：`MemorialScroll.tsx:1819-1849`、`1869-1892`。
- 影响：dev 的印章具有砂砾纹理、不规则蒙版和落印/光环动画；当前为规整、静止的圆形文字。
  虽非功能阻塞，但会明显降低与 dev 所谓“展卷·钤印仪式”的一致性。
- 建议：迁移纯 CSS 的 `seal-drop` / `seal-ring`，并保留 `prefers-reduced-motion` 兜底；印文可继续固定
  为当前“奉天承运”。

### P2 — 背景文件正确，但当前叠加遮罩明显深于 dev 的页面舞台处理

- 当前：[study.module.css:2](../../frontend/src/app/study/study.module.css#L2)。
- dev 基准：背景资产 `frontend/public/shangshufang/bg-shangshufang-full.webp` 与 `EdictStage`
  的局部舞台光晕（`MemorialScroll.tsx:1760-1769`）。
- 影响：当前在全背景上叠加左右 `.90/.82` 的深色遮罩及底部 `.88` 渐变，背景主体被压暗；dev
  把主要氛围光限制在卷轴周围。即便使用同一图片，页面仍会显得更黑、更少空间感。
- 建议：先以 dev 截图确认最终亮度；倾向降低全局横向遮罩，并把视觉聚焦交给卷轴局部光晕。

## 可直接复用的部分

- 背景图片本身已经正确，无需复制或替换。
- 头部的 64px 高度、金色底边、深色半透明渐变、徽记和品牌渐变方向接近 dev：
  [ChaotangHeader.module.css:1-17](../../frontend/src/components/chaotang/ChaotangHeader.module.css#L1-L17)。
- 卷轴的纸色基调、云纹边和无障碍减弱动效兜底已有对应基础，可在其上做保真迁移。

## 实施证据（2026-07-23）

已在限定组件范围内完成下列修正，未迁移 API、状态、图标或无效路由：

- `ChaotangHeader` 保留 `/study` 与 `/shiguan` 两个有效静态链接，并采用 dev 的桌面导航节奏；
  在 `1023px` 以下隐藏中间导航，避免把精简导航伪装成 dev 的九部门导航。
- `EdictScrollShell` 现使用纸面外侧 `34px` 金木厚轴、玉质端帽，并在 `767px` 以下隐藏；新增
  dev 对应的舞台光晕、纸面内侧金线、云纹位置、印章砂砾/蒙版，以及钤印光环与减弱动效兜底。
- 已新增覆盖这些静态结构的组件测试，并遵循先失败后实现的验证过程。

验证：`node --test src/components/chaotang/ChaotangHeader.test.ts src/components/chaotang/EdictScrollShell.test.ts`
与 `npm run typecheck`（均在 `frontend/` 执行）。

### 复审补正：完整顶部导航节奏

复审后，Header 已加入 dev `CORE_NAV` 的完整视觉标签：大殿、上书房、军机处、六部、专署、史馆。
当前分支只将已有的 `/study` 与 `/shiguan` 渲染为真实 Next Links；其余项目均为
`aria-disabled="true"` 的非交互 span，不会制造不存在的页面或伪造可点击链接。徽记也替换为 dev
团龙戏珠的静态 SVG 提取版，仍不依赖状态、API 或图标库。

本补正按测试先行完成：新增标签与禁用语义断言先以预期缺失失败，随后实现通过。
验证：在 `frontend/` 运行 `node --test src/components/chaotang/ChaotangHeader.test.ts`、
`npm run typecheck` 与 `git diff --check`，均通过。

### 复审补正：导航槽位宽度

Header 现遵循 dev `navSlotWidth` 规则：两字标签占 `74px`，三字及以上标签占 `88px`。
该规则同时作用于真实链接和禁用视觉标签，保持完整顶部导航的间距节奏而不改变路由语义。
新增断言先因缺少宽度规则失败；修正后 `node --test src/components/chaotang/ChaotangHeader.test.ts`
与 `npm run typecheck` 均通过。
