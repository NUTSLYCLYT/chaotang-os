# 素材源 · 可搬运 vs 只能看

**先讲法律边界，别踩坑**：

- **可直接搬运**＝许可证（MIT / ISC / CC0 / 站点明示免费可商用）允许复制使用的**组件代码、图标、SVG 纹理、插画**。
- **只能看不能抄**＝灵感画廊里别人的**完整页面设计、品牌视觉、独创布局**（Awwwards / Dribbble / Godly 等）。这些受版权保护，只能学手法、学构图思路，**逐像素照搬是侵权**。
- 从任何外部抄组件进本仓，**必须剥掉 `@radix-ui` / `shadcn` 依赖**（本仓禁装），动画统一 `framer-motion`（不是 `motion/react`），用普通 div + Tailwind 4 重写。

---

## 5 个顶级"可直接搬运"素材源（许可证允许，且贴合暗金/framer-motion 技术栈）

### 1. Aceternity UI — `ui.aceternity.com`
复制粘贴式 React + Tailwind + **framer-motion** 动效组件。暗色奢侈风浓，发光边框、聚光灯、网格背景、3D 卡片一抓一大把，**和本仓帝金驾驶舱方向天然契合**。代码免费拷。搬运时把组件里偶尔出现的 radix 依赖换成普通 div。

### 2. Magic UI — `magicui.design`
MIT 许可的动画组件库，可直接 copy-paste。文字闪光、数字滚动、边框流光、粒子背景等"高级感小动效"现成。本仓 `NumberCounter` / `.metal-edge` 可被它的同类组件升级。

### 3. Lucide + Tabler Icons — `lucide.dev` / `tabler.io/icons`
图标。Lucide 是 ISC 许可且**已在本仓 deps**（~200 文件在用），直接用；Tabler 是 MIT，5000+ 线性图标补足缺口。两者风格都细线条，配帝金驾驶舱合适。免费可商用。

### 4. Hero Patterns + Haikei — `heropatterns.com` / `haikei.app`
免费 SVG **纹理与背景**，正好补本仓"texture / 氛围"那一项设计要求。Hero Patterns 是 CC 许可的可平铺 SVG 底纹（改色即用）；Haikei 在线生成波浪/网格/低多边形/渐变 SVG，导出免费可用。把帝金 `#F0C66A` 套进去就是本仓专属底纹。

### 5. unDraw + Phosphor — `undraw.co` / `phosphoricons.com`
unDraw 是开源插画（无需署名，可改色，免费商用），适合空状态/引导页；Phosphor 是 MIT 的多权重图标族。两者都能改主色，套帝金后不违和。

> 备选补充：**Cult UI** (`cult-ui.com`)、**Hover.dev** 也是 framer-motion 暗色组件，部分免费；**Coolors / Realtime Colors** 配色；**Google Fonts**（本仓已用 Noto/Inter，免费）。

---

## 只能看、用来学手法的灵感画廊（**禁逐像素照搬**）

- **Godly** (`godly.website`) — 当代高端网站精选，暗色奢侈风样本密集
- **Awwwards** (`awwwards.com`) — 获奖站，学动效与构图
- **Refero / Mobbin** — 真实产品界面库，学交互模式
- **Land-book / Lapa Ninja** — Landing page 灵感

用法：把你真心觉得"高级"的截图存进仓内 `docs/DESIGN_REFERENCES/`，每次让 agent **先看参考再动手**——给具体参照物比给一百个形容词管用十倍。
