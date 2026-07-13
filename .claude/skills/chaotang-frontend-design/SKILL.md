---
name: chaotang-frontend-design
description: 朝堂 web lyt 前端"大神级"UI/设计工作流。当用户要在本仓做页面、组件、样式、仪表盘、首屏、改 UI、调视觉、谈"做得高级/好看/大神级"、要设计方向、要素材参考、要美工把关时，必须用本 skill。它强制"先定方向→复用冻结视觉系统→截图自检→大神会审"的纪律，避免产出模板货，并守住本仓视觉资产冻结、端口、构建、依赖等红线。触发词：设计 页面 组件 UI 视觉 美工 配色 排版 仪表盘 首屏 高级 大神 素材 参考 frontend design polish。
metadata:
  type: reference
---

# 朝堂前端 · 大神级 UI/设计工作流

本仓（`/home/ubuntu/workspace/frontend/chaotang-web-lyt`）已经是一套**被冻结的暗金·帝金驾驶舱**视觉系统。大神级效果的来源不是"自由发挥重造"，而是**约束自己复用这套系统 + 看着真实渲染反复磨**。AI 默认输出就是模板货中位数，本 skill 的存在就是把你顶到中位数之上。

## 核心工作流（每次做 UI 必走）

不要直接写代码。按这五步：

0. **先看参考库**：开工前读 `docs/DESIGN_REFERENCES/`（用户存的"高级"截图就是他的品味）。参考是方向盘，冻结的帝金 token 是刹车。`05-our-best-shots/` 里朝堂自己的样板优先级最高。
1. **先 brainstorm，不准先写**：调 `superpowers:brainstorming`，把意图、参考图、风格方向钉死，再碰任何像素。
2. **指定有观点的风格方向**：禁用 "clean minimal" 这类没方向的遮羞布。本仓默认延续**暗金/帝金 + 玻璃拟态有真实景深 + HUD 驾驶舱**方向。要换方向必须明说（编辑杂志 / 暗黑奢侈 / bento / 新粗野）。
3. **走设计技能链**：用 `design-orchestrator`（创意参考库 → `ui-ux-pro-max` 出设计数据 → `frontend-design` 大胆执行 → `web-design-guidelines` 质量门）。数据是刹车，创意是方向盘，目标不是"合规"是"难忘"。
4. **截图驱动自检（视觉类铁律）**：改完用 chrome-devtools 或 playwright 截 **320 / 768 / 1440** 三档，自己先看一眼再交。写完不看渲染=没做完。见仓内 `AGENTS.md §9/§10`。
5. **大神会审**：取舍关键处拉 `website-design-panel` 或 Rams + Jobs + 张小龙过一遍；不可逆决策拉 `expert-panel`。

## 大神十技（方法）

1. **方向先于像素**：先选一个有观点的风格方向，再碰颜色。
2. **尺度对比建层级**：标题与正文戏剧化拉开，别只差 2px。本仓 `.page-title`(24px) vs `.body-copy`(13px) 是刻意的。
3. **节奏 ≠ 均匀 padding**：用疏密对比制造呼吸，到处一样间距就是模板。
4. **景深与层叠**：重叠 / 阴影 / 表面 / 动效造 z 轴。复用 `GlassPanel`(5 variant×3 tone) + `.hud-corner` 金线角标。
5. **颜色语义化**：红黄绿代表状态，帝金 `#F0C66A` 是品牌信号，不是随手装饰。
6. **只动合成器友好属性**：动画只碰 `transform / opacity / clip-path`，绝不碰 `width / top / margin`。掉帧的动效比没动效更廉价。
7. **三态必被设计**：hover / focus / active 都讲究才像真产品。
8. **打破网格做编辑式构图**：适当 bento / 不对称，别永远规整卡片网格。
9. **字体配对是策略**：Noto Serif SC(标题衬线) × Inter/Noto Sans(正文无衬线) 的刻意对比，别全用一个。
10. **截图驱动迭代**：大神与新手的差距就在"看了几轮"。

## 必知十坑（本仓红线，违反=破坏 B 系统或打挂生产）

1. **视觉资产冻结**：禁改 `globals.css`(727行)、`design-tokens.ts`、18 个 keyframe、帝金色值、启动动画时序。新视觉先去 `docs/migration/02-design-tokens.md` 找现成 token/utility。
2. **12 utility class + 12 组件先复用**：`.gold-text` `.display-serif` `.metal-edge` `GlassPanel` `SignalPulseDot` `EnterStagger` 等，别重复造。清单见 `AGENTS.md §5`。
3. **Next.js 16 不是训练时的样子**：App Router 默认、Tailwind 4 用 `globals.css` 里的 `@theme` 块、字体已在 `layout.tsx` 注入——**新组件别自己 import next/font**，直接 `var(--font-sans)`。
4. **端口纪律是生产红线**：dev=3002，prod=3050，3001 弃用。绝不 `next dev -p 3050`（顶掉生产）。端口被占先 `ss -tlnp | grep :3050` 问清再说，别默默 kill。
5. **`pnpm build` 比 `tsc --noEmit` 严**：每改一行 tsx 都要跑 build。
6. **依赖纪律**：`lucide-react` 可用（事实标准）；**禁装** `motion/react`（用 `framer-motion`）、`@radix-ui/*`、`shadcn-ui`。从外部抄组件时**剥掉 radix 依赖**，用普通 div + Tailwind 重写。
7. **反模板红线**：默认 Tailwind/shadcn 卡片网格、居中标题+渐变球+通用 CTA、灰底白字一个点缀色——`web-design-guidelines` 明令禁止。
8. **context 长了会犯规**：开始忘规则/反复犯错时 `/clear` 重开，比继续加提示词有效。
9. **sourceLabel 必须如实**：DEMO/FALLBACK 禁伪装 LIVE；设计上也别用 mock 数据证明"页面好用"。
10. **新页面必带 E2E spec**：照 `e2e/swarm-children.spec.ts` 范式，cookie + localStorage 双门种子，向 80% 覆盖爬。

## 素材源（可直接搬运 vs 只能看）

**先查本仓再外搬**：研究推荐的暗金动效（border beam / shimmer / 脉冲 / 数字绽放 / bento stagger）本仓 globals.css **已做成 ~25 个 `.animate-*` utility class**，优先复用，别去外站搬同款。完整"暗金手法→本仓已有 class"对照表、可量化奢侈纪律（金光预算 ≤8% 等）、性能红线见 `references/dark-luxury-playbook.md`。
本仓确实没有、需外搬时（如全局噪点层 grain、指针聚光灯、磁吸按钮），**先分清许可证**并剥掉 radix——清单见 `references/material-sources.md`。

## 一句话启动

> "先别写代码，用 design-orchestrator 帮我把 X 页面的设计方向定下来，列 3 个风格选项给我选；选定后复用本仓帝金系统实现，并截 1440/768 两档给我看。"
