# 朝堂 OS V8 黑金 HUD Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Figma 文件中新增一套完整、可点击、可验收的 V8 原型，使用 V5 黑金写实视觉与游戏 HUD，同时保留 V7 的全部业务结构和权限规则。

**Architecture:** V8 在 Figma 页面 `153:2` 中以独立 Sections 构建，不修改 V5/V6/V7。先从 V5 Foundations 和四张 V5 标杆画板提取设计 token 与组件结构，建立 V8 Foundations；随后用一张上书房标杆页锁定视觉，再按入口、六部链、军机/史馆链分批重绘。所有写入严格使用顺序、小批次 `use_figma`，每个任务结束后由独立 reviewer 通过结构、截图、字体与 reactions 四类证据验收。

**Tech Stack:** Figma Design、Figma Plugin API、Figma variables/styles/components、`use_figma`、`get_metadata`、`get_design_context`、`get_screenshot`。

## Global Constraints

- Figma fileKey 固定为 `bQAkFbJd9y0INu3m9H4dIu`，目标页面固定为 `153:2`。
- V5 唯一视觉基准：Foundations `153:7`、欢迎 `164:2`、登录 `200:43`、上书房 `165:8`、司级 `166:34`。
- V8 新建独立 Sections；禁止删除、覆盖或重命名 V5、V6、V7。
- 全局导航仅包含上书房、军机处、六部、史馆与皇帝身份。
- 锦衣卫不得进入全局导航，只能从司级关键事实不足状态进入。
- 每张正式画板最多一个朱红主动作。
- 完整流程节点只允许出现在统一案卷详情内部。
- 只有皇帝是人工用户；皇帝不得代替 Agent 保存草稿、分流或提交意见。
- 已归档案卷进入史馆；进行中案卷进入当前责任工作区。
- 页面尺寸统一为 `1440×1024`。
- 字体只使用 Noto Serif SC 与 Noto Sans SC，并在每次文字写入前加载真实字体。
- 每次 `use_figma` 只切换一次页面、只处理一个明确组件或画板，并返回所有创建/修改节点 ID。
- `use_figma` 必须严格顺序执行；错误后先只读检查，不立即重复写入。
- 任何 git commit、push 或发布不在本计划授权范围内。

---

### Task 1: 锁定 V5 视觉真值与 V8 差异清单

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-v5-gold-hud-v8-design.md`
- Read: Figma `153:7`, `164:2`, `200:43`, `165:8`, `166:34`
- Create: Figma section `V8/00 Visual Truth & Gap Analysis`

**Interfaces:**
- Consumes: V5 token、组件、字体、效果和截图。
- Produces: `V8_VISUAL_TRUTH_SECTION_ID`，以及颜色、字体、效果、布局和组件清单，供 Task 2–7 使用。

- [ ] **Step 1: 读取 V5 Foundations 与四张标杆画板结构**

  使用只读 `use_figma` 返回节点名、组件 ID、常用 fills/strokes/effects、字体与尺寸；不得修改节点。

- [ ] **Step 2: 分别获取 V5 四张标杆截图**

  调用 `get_screenshot`：`164:2`、`200:43`、`165:8`、`166:34`，每张 `maxDimension=1440`。

- [ ] **Step 3: 创建 V8 Visual Truth section**

  在页面最右侧空白区创建 Section，记录：V5 颜色表、字体表、阴影表、HUD 三层模型、允许与禁止样式。

- [ ] **Step 4: 验证差异清单完整**

  确认清单明确指出 V7 的大面积浅色背景、现代 SaaS 卡片、低场景参与度均不得进入 V8。

### Task 2: 建立 V8 Foundations 与黑金 HUD 组件

**Files:**
- Create: Figma section `V8/01 Foundations & HUD Components`
- Reuse: V5 components `158:2`, `159:2`, `159:5`, `160:2`, `161:2`, `161:8`

**Interfaces:**
- Consumes: Task 1 的视觉真值和 V5 组件结构。
- Produces: `V8_FOUNDATIONS_SECTION_ID`、V8 Header/Footer/Button/Case Row/Status/HUD/Panel 组件 ID。

- [ ] **Step 1: 创建 V8 primitive 与 semantic variables**

  创建并显式设置 scopes：极夜黑 `#050403`、乌木黑 `#080604`、墨黑 `#0C0907`、乌木棕 `#26180F`、面板棕 `#2B1A10`、朱红 `#A33A31`、深朱红 `#8E2E24`、米金纸 `#F2DFC0`、浅米金 `#F3E5C8`、暖金文字 `#FFF0D0`、暗金线 `#A99476`、高光金 `#E3C47E`、完成绿 `#426C58`。

- [ ] **Step 2: 创建 V8 text styles 与 effect styles**

  文字样式覆盖场景标题、页面标题、详情标题、正文、表格、标签；效果只允许 V5 已存在的暗部投影和内阴影强度。

- [ ] **Step 3: 创建 V8 Header/Public 与 Header/App**

  App Header 必须包含品牌、四项导航、皇帝身份与位置条；Public Header 只允许登录/创建朝堂入口。

- [ ] **Step 4: 创建 V8 Button、Case Row 与 Status Badge**

  Button 至少包含 Primary/Secondary/Text；Case Row 至少包含 Default/Selected/Archived；Status Badge 必须同时含颜色与文字。

- [ ] **Step 5: 创建 HUD 组件**

  创建 HUD Metric、HUD Location、HUD Agent Status、Dark Panel、Parchment Panel、Evidence Row、Timeline Node。

- [ ] **Step 6: 截图与结构验收**

  对 Foundations 和每组组件分别运行 `get_metadata` 与 `get_screenshot`，检查变量绑定、字体、边框、阴影、组件命名和无裁切。

### Task 3: 制作上书房标杆页并与 V5 并排验收

**Files:**
- Create: Figma section `V8/02 Benchmark · 上书房`
- Reference: V5 `165:8`

**Interfaces:**
- Consumes: Task 2 的全部 V8 组件。
- Produces: `V8_SHANGSHUFANG_BENCHMARK_ID` 和锁定后的页面骨架，供 Task 4–6 复用。

- [ ] **Step 1: 创建 1440×1024 上书房画板**

  使用 V5 Header/Footer、黑金场景层、半透明乌木 HUD 与米金案牍面板；保留一句话下旨、最近三道旨意和右侧详情。

- [ ] **Step 2: 填充真实状态内容**

  使用案卷编号、Agent 理解、丞相分流和责任节点，不使用 Title、Lorem 或占位文案。

- [ ] **Step 3: 接入关键 reaction**

  一句话颁旨进入分流状态；归档案卷进入史馆；进行中案卷进入当前责任工作区。

- [ ] **Step 4: 进行 V5 并排视觉验收**

  获取 `165:8` 与 V8 标杆页同尺寸截图，检查颜色、明暗、材质、标题气质、按钮层级、面板透明度和信息密度是否属于同一视觉系统。

- [ ] **Step 5: 独立 reviewer 放行**

  reviewer 必须给出 Pass/Fail；Critical 或 Important 问题修复后重新截图复验，Pass 后才能开始 Task 4。

### Task 4: 重绘入口与上书房全部状态

**Files:**
- Create: Figma section `V8/03 入口与上书房`
- Reference: V5 `164:2`, `200:43`, V8 benchmark from Task 3

**Interfaces:**
- Consumes: Task 3 锁定的骨架。
- Produces: 欢迎、登录、注册、上书房未下旨/分流中/办理中/已归档画板 ID。

- [ ] **Step 1: 创建欢迎页**

  采用 V5 黎明宫门视觉，保留 16:9 AI 视频区域、上朝、已有朝堂登录、跳过视频和静音位置；视频内容本轮不伪造。

- [ ] **Step 2: 创建登录与注册页**

  使用宫禁验符场景和乌木登录面板；未登录 Header 不得暴露业务导航。

- [ ] **Step 3: 创建四种上书房状态**

  四张状态画板共用同一骨架，只改变详情、状态和主动作；最近三道旨意始终保留。

- [ ] **Step 4: 串联入口和下旨流程**

  欢迎 → 登录/注册 → 未下旨 → 分流中 → 办理中；史馆尚未创建时不添加已归档按钮的无效 reaction，Task 6 创建史馆后再连接。

- [ ] **Step 5: 逐张截图验收**

  检查 Public/App Header、唯一朱红主动作、表单清晰度、状态一致性、无死主按钮。

### Task 5: 重绘六部、部级、司级与锦衣卫

**Files:**
- Create: Figma section `V8/04 六部与锦衣卫`
- Reference: V5 `166:34`

**Interfaces:**
- Consumes: Task 2 HUD 组件和 Task 3 页面骨架。
- Produces: 六部总览、部级、司级、锦衣卫画板 ID。

- [ ] **Step 1: 创建六部总览**

  使用官署轴线场景与六个 HUD 官署牌；所有入口复用同一部级模板，不新增六张部门页面。

- [ ] **Step 2: 创建部级工作区**

  左侧显示本部处理中/处理过案卷，右侧显示下属司汇总和 Agent 状态；已归档案卷进入史馆。

- [ ] **Step 3: 创建司级工作区**

  强调事实、证据、责任 Agent 与补证状态；皇帝只读监察。

- [ ] **Step 4: 创建锦衣卫案卷详情**

  使用暗色密档场景，展示调查令、证据链、来源和预计回报；无全局导航入口。

- [ ] **Step 5: 串联六部链路**

  六部 → 部级 → 司级 → 条件性锦衣卫 → 返回司级；每个主入口必须有 reaction。

- [ ] **Step 6: 逐张截图与权限验收**

  验证 V5 黑金一致性、HUD 不遮挡内容、已归档点击规则、锦衣卫入口规则和皇帝不代办规则。

### Task 6: 重绘军机处、史馆、统一案卷与系统状态

**Files:**
- Create: Figma section `V8/05 军机处、史馆与统一案卷`

**Interfaces:**
- Consumes: Task 2 HUD/Panel/Timeline 组件。
- Produces: 军机处、史馆、统一案卷详情、系统状态画板 ID。

- [ ] **Step 1: 创建军机处**

  使用会审舆图场景，展示跨部门分歧、共享事实、会审状态与已呈送记录；皇帝不能提交会审意见。

- [ ] **Step 2: 创建史馆**

  使用档案库场景，提供案卷搜索、筛选、正式回奏摘要和归档校验；仅展示已原子归档案卷。

- [ ] **Step 3: 创建统一案卷详情**

  仅在该画板内部显示完整流程 HUD、Agent 办理链、条件性军机会审、正式回奏与归档信息。

- [ ] **Step 4: 创建系统状态板**

  在一个画板内呈现空状态和待归档异常，不创建重复功能页面。

- [ ] **Step 5: 回填跨任务 reactions**

  上书房已归档、部级已归档 → 史馆；军机会审 → 统一案卷；史馆正式案卷 → 统一案卷。

- [ ] **Step 6: 逐张截图验收**

  检查史馆只读、异常不丢案卷、流程只在案卷内、每屏唯一主动作和场景定位正确。

### Task 7: 全流程串联与最终独立验收

**Files:**
- Modify: V8 prototype reactions across all V8 sections
- Read: all V8 frame IDs returned by Tasks 2–6

**Interfaces:**
- Consumes: 全部 V8 画板和组件。
- Produces: V8 prototype starting point、最终 prototype URL、验收报告。

- [ ] **Step 1: 串联全局 HUD 导航**

  所有登录后页面的上书房、军机处、六部、史馆导航均指向 V8 目标画板；身份不作为业务页面入口。

- [ ] **Step 2: 串联核心业务流程**

  验证欢迎 → 登录 → 下旨 → 分流 → 办理 → 六部/司级/锦衣卫 → 军机 → 统一案卷 → 史馆的代表性路径。

- [ ] **Step 3: 运行结构与反应审计**

  回读每张正式画板的 children 数、字体族、可见主按钮和 reactions；确认无空白画板、无死主动作和无错误目的地。

- [ ] **Step 4: 运行视觉并排审计**

  将 V5 标杆截图与 V8 对应页面截图按相同视口并排检查，记录 Critical/Important/Minor。

- [ ] **Step 5: 修复并复验**

  修复所有 Critical/Important；Minor 仅可在不影响核心体验时记录。独立 reviewer 必须最终给出 Pass。

- [ ] **Step 6: 设置 V8 欢迎页为 prototype starting point**

  返回可点击的 V8 prototype URL，并保留 V5/V6/V7 原入口不变。
