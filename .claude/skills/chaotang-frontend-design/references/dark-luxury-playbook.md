# 暗金奢侈手法全集 · 朝堂落地 playbook

礼部实地研究 Aceternity / MagicUI / Cult UI / hover.dev（可搬运组件）+ Godly / Awwwards / Muzli 2026 趋势（灵感）后，按朝堂**真实冻结 token** 校正的落地手册。

## 真实 token 锚点（别记错）

- **底色是深蓝近黑，不是炭灰**：`bg #04060E` / `bgDeep #02030A` / `surface #0A0E1E` / `surface1 #0F1428` / `surface2 #141A34`。
- **帝金三阶**：`goldBright #F0C66A`（最高优先级/hero）/ `gold #D4A84B`（次级/hover）/ `goldDeep #8A6A2A`（仅描边分割，对比度不足不做正文）。
- **第二语义色系**：蓝 `#4A82F0` + 11 个 agent 专属色（吏部蓝/户部绿/礼部朱红/兵部烈金…见 `design-tokens.ts agentColors`）。
- **正文用米灰**，不要用暗金做正文：`textSecondary #C8CDD8` / `.body-copy` / `.page-meta`。
- **现成阴影/发光**：`shadows.glow = 0 0 24px rgba(240,198,106,0.15)`，别手搓发光值。

## 核心结论：朝堂的"Aceternity"是内置的

研究推荐的暗金动效，本仓 globals.css **已做成 utility class**。优先复用，不要去外站搬同款：

| 暗金手法 | 本仓已有 class | 用在哪 |
|---|---|---|
| Border Beam 边框流光 | `.animate-border-trace`(3s) | "运行中/待裁决"卡边框 |
| 文字 Shimmer | `.animate-shimmer-h` + `.metal-edge` | 圣旨/标题扫光 |
| 实时脉冲 | `.animate-live-pulse`(1.2s) + `SignalPulseDot` | **仅** LIVE/LIVE_SWARM 来源 |
| 扫描光束 / 雷达 | `.animate-scan-beam`(8s) `.animate-radar-sweep` | 监控/采集背景 |
| 光晕 aurora | `.animate-decree-aura`(2.6s) `.animate-decree-float`(4s) | 圣旨封印氛围 |
| 数字/文字绽放 | `.animate-number-in` `.animate-stat-bloom` `.animate-text-bloom` | KPI 巨数入场 |
| bento stagger | `.animate-card-in-1..4` `.animate-slide-up-1..4` | 卡片网格依次入场 |
| 呼吸/旋转/慢转 | `.animate-breathe` `.animate-rotate-slow` `.animate-mandala`(80s) | 装饰底纹 |

**只有这些本仓没有、且确认无 radix 依赖时才考虑外搬**（用普通 div + framer-motion 重写）：指针聚光灯 spotlight、磁吸按钮 magnetic、3D tilt、全局噪点层 grain。其中**全局噪点层**最值得加（深蓝近黑底叠 2–4% 噪点，去塑料感），且 globals.css 未提供，是唯一强建议新增的一层。

## 暗金奢侈的可量化纪律（验收标准，不靠感觉）

来自两路研究的共识，落成可被多 agent 共守的硬约束：

1. **金光预算 ≤ 8%**：任意一屏，帝金（含发光/描边/文字）覆盖面积 ≤ 8%，近黑舞台承担 90%+。当前若帝金偏多，是"显廉价"的头号风险。
2. **一屏 ≤ 1 个 hero**：bento 里只让"当前要裁决的那一件"当 hero（跨 6 列×2 行），其余降级 metric/accent tile。
3. **动态金光 ≤ 1 处且必须绑真实状态**：同视口最多 1 处金光在动，且绑定真实状态变化（运行/待裁决/告警）。纯装饰动效砍成静态。金 = 状态信号层，不是美化层——契合红黄绿/sourceLabel 铁律。
4. **同色系明暗渐变，禁撞色**：发光/描边渐变用 `#8A6A2A→#F0C66A`（深金到亮金），不用撞色——撞色显"AI 生成感"，同色明暗显"贵金属"。
5. **bento 甜区**：12 列 grid，gap 16px，容器 padding 24px。<8px 糊成一块，>32px 散成孤岛。
6. **巨数锚点**：御座/上书房核心判断用一个帝金巨数（clamp 48–72px）做锚点，正文压到 11–13px，层级靠尺寸不靠颜色。本仓 `NumberCounter` + `.animate-stat-bloom` 已就位。
7. **衬线×无衬线分工**：圣旨/奏折标题/部门名用 `.display-serif`（衬线=权威气质）；所有数字/状态药丸/时间戳用 sans（=数据可读）。形成"圣旨衬线、台账无衬线"的稳定语义。
8. **玻璃要真景深 + 验对比**：用 `GlassPanel`（已有 backdrop-blur）；暗金 `#8A6A2A` 文字在深底会跌破 4.5:1，玻璃卡正文必须用米灰；配 `prefers-reduced-motion` 降级。
9. **金线只点睛**：`.metal-edge` / `.hud-corner` 金线只给 hero 卡、圣旨封印；常规部门卡用低调 `border #1A2142` 米灰描边。
10. **蓝金分工**：帝金 = 中枢/最高强调；蓝 `#4A82F0` 与 agent 11 色 = 部门/角色语义；红黄绿 = 风险/状态。三套色域各司其职，绝不互抢"奢侈强调"角色，否则界面变花。

## 性能红线（合成器友好审计）

- 动画只许动 `transform / opacity / offset-distance / clip-path`。
- `filter: blur` 只静态设定，**禁 animate blur 数值**（重绘贵）。
- **禁 animate `box-shadow` / `background-position`**——发光用叠一层静态模糊渐变 div + 切 `opacity`；shimmer 用平移高光 div（`transform: translateX`）而非动 background-position。
- 禁 animate `width/height/top/left/margin`。
- canvas 逐帧方案（flickering grid 等）在多实例驾驶舱慎用，优先纯 CSS 静态网格 + 径向遮罩。

## 给朝堂的一句话总纲

2026 暗金奢侈 = **巨数锚点 + 衬线气质 + bento 空间权重 + 单一帝金点睛 + 克制缓动 + 极薄噪点景深**。朝堂的 token 与组件全部就位，趋势校正的重点不是"加新东西"，而是**收敛**：让近黑承担绝大面积、帝金只点睛一处、动效只解释下一步。
