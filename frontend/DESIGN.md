# 朝堂 OS · 视觉设计系统（DESIGN.md）

> 单一视觉真相源。组件/页面只从这里取设计意图，颜色实值以 `src/lib/design/design-tokens.ts` 为准（B 系统冻结，改值须同步 globals.css）。
> 用途：① 约束 AI 与人不跑偏；② Figma 还原图回来后，把样式名「对号入座」到本表，最小返工。
> 当前落地参考页：`/study` 上书房（参考图 `chaotangos-ui/images/01-shangshufang.webp`）。

---

## 0. 设计意图（先记牢，照"意图"做不照"像素"做）

**上书房 · 御案智能奏折台**——皇帝在上书房批阅今日企业要务。
- 深靛蓝 / 黑蓝背景 · 帝王金高光 · 玉石白/暖米白卷轴 · 暗金边框 · 少量朱红印
- 现代企业 AI 指挥系统 ⊕ 东方上书房秩序美学
- **高级 · 克制 · 庄重 · 清晰**

**红线（反 slop）**：
- ❌ 紫蓝渐变 slop / 玻璃滥用 / 处处双色渐变边
- ❌ 把整张参考图当背景铺（版权 + 糊）；背景只用**自有**底图或 CSS
- ❌ 杂色堆砌——主色金，部门色仅作小徽点/标签，面板统一暗金
- ✅ 字号红线：标签 ≥ 11px，正文 ≥ 13px（`fontSizeRedLine`）

> **demo 例外（2026-05-27 皇上钦定）**：原型/演示阶段允许「整图铺底 + 透明热区」（见 `/study` 当前实现）快速还原参考图，**仅供看效果/演示，不得作为产线最终实现**。最终须按 §4/§5/§6 用 DOM 组件重建（接真数据、响应式、自有底图）。
> 判定线：**数据能接真实接口 = 产线合规；数据画死在图里（如当前 `shangshufang-bg.webp` 的「36 件」「17 件」） = demo**，demo 不得上生产。

---

## 1. 色板（实值锚定 design-tokens.ts）

### 1.1 基底 / 文字（`colors`）
| 语义 | token | hex |
|---|---|---|
| 页面底 | `bg` | `#04060E` |
| 上书房氛围底（更靛） | （DESIGN）`studyBg` | `#06091A` → `#0B1230`（径向） |
| 面板面 | `surface` / `surface1` | `#0A0E1E` / `#0F1428` |
| 暗金边框 | `border` / `borderBright` | `#1A2142` / `#2C3560` |
| 主文 | `text` | `#EAEEFB` |
| 次文 | `textSecondary` / `textDim` | `#C8CDD8` / `#9AA3C4` |
| 弱文 | `textMuted` / `textFaint` | `#6A7299` / `#484F72` |

### 1.2 帝金（主色，CTA / 标题 / 高光）
| 语义 | token | hex |
|---|---|---|
| 亮金（高光/激活） | `goldBright` | `#F0C66A` |
| 金（CTA 主） | `gold` | `#D4A84B` |
| 深金（边/描线） | `goldDeep` | `#8A6A2A` |
| 玉石/暖米白（卷轴文/高级白） | （DESIGN）`jadeWhite` | `#F5E9C9` |

### 1.3 部门色（仅作小徽点 / 标签 / 优先级，勿大面积）
| 部门 | hex | 优先级 | hex |
|---|---|---|---|
| 户部(财政) | `#3DD68C` | 高 | `#F43F5E` |
| 兵部(市场) | `#F5A524` | 中 | `#F5A524` |
| 刑部(法务) | `#8B5CF6` | 低 | `#3DD68C` |
| 礼部(品牌) | `#F43F5E` | | |
| 工部(产研) | `#60A5FA` | 朱印红 | `#B23B30` / 边 `#7C1A16` |
| 锦衣卫(情报) | `#EF4444` | | |

---

## 2. 字体 / 字阶
- 衬线（标题/庄重）：`.display-serif`（Noto Serif SC，挂在 `--font-serif`）
- 无衬线（正文）：`var(--font-sans)`；等宽：`var(--font-mono)`（历法/数字）
- 字阶（对齐 `fontSize`）：hero 44–58 / 区标题 16 / 正文 13–15 / 标签 11–12 / 历法数字 mono 10–11
- 字号 **不得低于** 11（标签）/ 13（正文）

## 3. 间距 / 圆角 / 阴影 / 动效
- 间距：`spacing` 4/8/12/16/24/32/48；面板内距 16–20，区块间距 20（`gap-5`）
- 圆角：卡片 `rounded-2xl`(16) / 小元素 `rounded-lg`(8–12) / 药丸 full
- 边框：`1px` 暗金 `rgba(240,198,106,0.18–0.32)`；顶部 1px 金线渐变高光
- 阴影/辉光：`shadows.glow`= `0 0 24px rgba(240,198,106,0.15)`；面板 `0 8px 32px rgba(0,0,0,.45)`
- 动效语汇（globals.css 既有，复用勿造）：`shimmer-h` / `border-trace` / `pulse-glow` / `live-pulse` / `mandala`；印章用 `clamp(actual_ms,200,1000)` 且**须绑真实事件**（无事件不盖动画章）

## 4. 组件规格（已落地 → `src/features/chaotang/study/*`）
| 组件 | 规格要点 |
|---|---|
| `StudyCourtHeader` | h-14；左 logo+面包屑 / 中 主导航(真跳转) / 右 状态+通知+帮助+治理后台+皇上 |
| `ScrollSection` | 暗金边框 + 顶部金线 + 标题(serif)+计数+查看全部 |
| `ActionButton` | 4 变体：`gold`(主)/`soft`(金描)/`danger`(朱)/`ghost`(中性)；全部真按钮有反馈 |
| `ScrollSealBadge` | 朱红印章：准奏(朱)/驳回(灰)/旋转 -3°~-5° |
| 面板（丞相/王公公） | 画像(gold/blue 框) + 名讳 + 内容 + 底部按钮组 |
| `ImperialCommandBar` | 快捷指令 chips + 输入(羽笔) + 下旨(金)/问丞相(蓝)/召集群臣 |

## 5. 布局 / 响应式
- 沉浸式整屏：`fixed inset-0 z-[60] flex-col`（覆盖 dashboard 壳，不改共享 layout）
- 桌面(xl)：`grid-cols-[296px_minmax(0,1fr)_324px]` = 左丞相 / 中卷轴 / 右王公公；顶 header + 底 command bar
- 平板(lg/md)：单列，**中央卷轴优先**（order 切换：workspace→chancellor→wanggonggong）
- 手机：「建议桌面端访问完整上书房」引导页，禁横向溢出

## 6. 背景策略（逼近"全貌"的关键）
- 现状：纯 CSS 氛围（`StudyAmbient`：靛蓝径向 + 顶部宫灯暖金 + 窗棂格栅 + 底部御案暖光）
- 升级：放一张**自有/授权**宫殿/案几底图作独立图层，opacity **8–15%**，垫在面板后；**不得**用参考 webp 本身
- 面板始终保持 ≥ `rgba(8,11,24,0.72)` 不透明度 + blur，保证文字对比度

---

## 7. Figma 还原图 → 本系统 的回填对照（待你 Figma 好了填）

> 在 Figma 把样式命名好，回来逐行对应；**实值最终以 design-tokens.ts 为准**，新值才进下表「待回填」。

| Figma 样式名 | 映射 token / DESIGN 槽位 | 待回填实值 |
|---|---|---|
| `color/gold-bright` | `colors.goldBright` | `#F0C66A`（确认） |
| `color/study-bg` | `studyBg` | `____`（你的靛蓝底实值） |
| `color/jade-white` | `jadeWhite` | `____` |
| `radius/panel` | `radius.xl` | `16`? |
| `space/panel-pad` | `spacing.lg–xl` | `____` |
| `text/hero` | hero 字号 | `____` |
| `effect/panel-border` | 暗金边框 | `____` |
| 背景图层 | `/public/study/bg-*.webp`（自有） | 你导出的底图 |

---

## 8. 收敛工作流（怎么真的对上图）
1. `/design-consultation` 锁基准（本文即产物，可迭代）
2. Figma 重建结构 → 文件链接 → **Figma MCP** 拉规格 / 或 Dev Mode 导规格（SVG 优先于 PNG）
3. 值回填 §7 → 改 `design-tokens.ts` + 组件
4. **`/design-review` 截图对比循环**：`browse screenshot` 渲染 vs Figma/参考 → 列 top3 偏差 → 修 → 重复，调性一致即停
5. 工具：`browse`(Playwright) 截图量距 · context7 查 Tailwind/Next · frontend-rules-personal 把关

## 9. Do / Don't 速查
- ✅ 金作主、暗金边、朱印点睛、玉白点高级；面板暗、文字亮、对比足
- ✅ 每个按钮有反馈，链接能跳或 toast；mock 数据带"演示数据"角标
- ❌ 杂色满屏 / 紫蓝 slop / 玻璃糊 / 整图当背景 / 字号破红线 / 印章不绑事件乱盖
