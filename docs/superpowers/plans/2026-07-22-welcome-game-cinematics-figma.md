# Welcome Game Cinematics Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `bQAkFbJd9y0INu3m9H4dIu` Figma 文件中重做宫门启朝、玉玺落印、百官入朝三套可真实播放的游戏过场欢迎页。

**Architecture:** 每套动效保留一个正式起始 Frame，并使用命名统一的内部关键帧或 Figma Motion 时间轴承载动作。背景、运动主体、光效、前景和文字交互独立分层；实现者自验后由独立 QA 在 Chrome Figma Present 中重新播放和录制。

**Tech Stack:** Figma Design、Figma Plugin API、Smart Animate 或 Figma Motion、Chrome Figma Present、MP4 导出与逐时刻截图。

## Global Constraints

- 只修改欢迎页三套动效演示，不改登录、上书房及其他业务页面。
- 正式起始 Frame 保留主 CTA、跳过仪式、登录；播放期间隐藏全部按钮和热区；完成态只显示进入上书房。
- 禁止 CSS、网页模拟、整图交叉淡化、包含完整背景的运动主体。
- 每套总时长 2.0–3.2 秒，播放一次后停在完成态且不循环。
- 宫门 7 帧、玉玺 9 帧、百官 10 帧；精确时长和曲线以确认规格第 10 节为准。
- 三套必须分别通过结构验收与真实播放体验验收。

---

### Task 1: 现有页面与素材盘点

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-welcome-game-cinematics-redesign.md`
- Modify: Figma page `153:2`

**Interfaces:**
- Consumes: 现有三个 flow starting point 与欢迎页视觉语言。
- Produces: 起始节点、背景 imageHash、可复用字体和完成态跳转目标清单。

- [ ] **Step 1:** 用只读 Figma 检查定位三个现有起始 Frame、目标上书房 Frame、页面字体与图片填充。
- [ ] **Step 2:** 截取三个起始 Frame，核对尺寸、构图、颜色和现有文案。
- [ ] **Step 3:** 检查门扇、玉玺、人物是否为透明独立素材；不合格素材不得复用为运动主体。
- [ ] **Step 4:** 固化本轮新增节点命名：`V6/Gate/*`、`V6/Seal/*`、`V6/Court/*` 与 `Internal/V6/*`。

### Task 2: 宫门启朝

**Files:**
- Modify: Figma page `153:2`

**Interfaces:**
- Consumes: Task 1 的背景、字体与上书房目标节点。
- Produces: 7 帧或等价时间轴、一个正式 flow starting point、完成态跳转。

- [ ] **Step 1:** 创建闭合宫门起始态，左右门扇分别置于外侧门轴裁切容器。
- [ ] **Step 2:** 按规格 A0–A6 写入回弹、初启、开门、减速、停稳与完成态。
- [ ] **Step 3:** 接线主 CTA、内部自动前进和完成态进入上书房；确认内部帧无热区。
- [ ] **Step 4:** 截取首帧、中段和完成态，检查门缝、接缝、背景固定与标题层级。

### Task 3: 玉玺落印

**Files:**
- Modify: Figma page `153:2`

**Interfaces:**
- Consumes: Task 1 的诏书场景、字体与上书房目标节点。
- Produces: 9 帧或等价时间轴、一个正式 flow starting point、完成态跳转。

- [ ] **Step 1:** 建立独立玉玺、朱印、阴影、冲击环、颗粒与诏书背景层。
- [ ] **Step 2:** 按规格 B0–B8 写入蓄力、加速下落、撞击、压印停顿、揭印和退场。
- [ ] **Step 3:** 接线主 CTA、内部自动前进和完成态进入上书房；确认朱印在揭印前不可见。
- [ ] **Step 4:** 截取接触前、撞击、压印和完成态，检查透视、落点、重量与文案。

### Task 4: 百官入朝

**Files:**
- Modify: Figma page `153:2`

**Interfaces:**
- Consumes: Task 1 的空朝堂背景、字体与上书房目标节点。
- Produces: 10 帧或等价时间轴、六个人物运动层、一个正式 flow starting point、完成态跳转。

- [ ] **Step 1:** 建立 Far/Mid/Front × Left/Right 六个透明人物层，并预留中央御道左右各 12% 安全区。
- [ ] **Step 2:** 按规格 C0–C9 和固定 2.75 秒时序写入晨光、六层错峰入位、停步与完成态。
- [ ] **Step 3:** 接线主 CTA、内部自动前进和完成态进入上书房；完成态标题为百官就位。
- [ ] **Step 4:** 截取远排、中排、前排入位和完成态，检查景深、队列秩序与御道无遮挡。

### Task 5: 结构与视觉自验

**Files:**
- Modify: Figma page `153:2`

**Interfaces:**
- Consumes: Tasks 2–4 的三套完成动效。
- Produces: 无结构错误、无视觉硬伤的候选版本。

- [ ] **Step 1:** 检查三个 flow starting point、全部 reaction、完成态目标和播放期热区。
- [ ] **Step 2:** 在纯色或棋盘格检查底上检查所有运动主体透明边界。
- [ ] **Step 3:** 读取同一主体与背景在各帧的 imageHash，确认主体复用、背景固定。
- [ ] **Step 4:** 检查字体、文本裁切、重影、接缝、错误缩放、遮挡与完成态文案。

### Task 6: 独立真实播放验收

**Files:**
- Create: `docs/product/audits/welcome-motion-v6/`

**Interfaces:**
- Consumes: Task 5 的候选版本。
- Produces: 三套连续录屏、每套五时刻截图与独立 QA Pass/Fail 结论。

- [ ] **Step 1:** 实现者在 Figma Present 从可见点击开始完整播放三套动效并修复自验问题。
- [ ] **Step 2:** 独立 QA 使用自己的 Chrome Present 会话重新播放，不复用实现者截图。
- [ ] **Step 3:** 每套保存连续、不剪辑、有时间码的录屏，以及点击前、启动、中段、停稳、完成态五张截图。
- [ ] **Step 4:** 对照规格第 8、11、12 节输出结构结论和体验结论；两者均 Pass 才交付。
