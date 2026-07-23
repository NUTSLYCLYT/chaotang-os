# V5 数字朝堂 Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在现有 Figma 文件中保留 V4，并创建 V5“公文秩序 · 朱批系统”的设计基础、欢迎页、上书房和司级页面。

**Architecture:** 在同一 Figma 文件中新建独立 V5 页面，先建立可复用变量和组件，再组装三个 1440×1024 代表页面。三个页面分别验证品牌表达、皇帝核心操作和高密度 Agent 工作区；状态变化保留在页内，不创建主页面副本。

**Tech Stack:** Figma Design、Figma Plugin API、`figma-use`、`figma-generate-design`、`figma-generate-library`、Noto Serif SC、Noto Sans SC。

## Global Constraints

- 不修改 `V4 · 皇帝案卷决策台` 页面及其节点。
- V5 首批只创建欢迎页、上书房、司级页面三个主页面。
- 画板统一为 1440×1024，Header 72，Footer 64，左右页边距 72。
- 每屏最多一个主要朱红焦点；朱批只表达皇帝意志或真实案卷因果。
- 业务面板、按钮和输入框使用 4px 圆角；弹层最多 6px。
- 正式标题优先使用 Noto Serif SC；不可用时回退 Noto Sans SC。
- 业务文字统一使用 Noto Sans SC。
- 不使用龙纹、卷轴、祥云、仿纸污渍、红金渐变或古风游戏化装饰。
- 所有创建或修改 Figma 节点的调用必须返回完整节点 ID。

---

### Task 1: V5 页面与视觉基础

**Files:**
- Create in Figma: page `V5 · 公文秩序 · 朱批系统`
- Create in Figma: section `V5/00 Foundations`
- Reference: `docs/superpowers/specs/2026-07-21-v5-digital-court-ui-design.md`

**Interfaces:**
- Consumes: 已确认的 V5 UI 设计规范和现有 V4 页面截图。
- Produces: V5 页面 ID、颜色/间距/圆角变量 ID、字体可用性结果和基础组件 ID。

- [x] **Step 1: 读取现有文件结构与 V4 代表页面**

使用 Figma metadata 和截图读取 `138:2`、`110:3`、`110:327`，确认原型内容和页面尺寸；预期三个截图均为 1440×1024 且 V4 无写入。

- [x] **Step 2: 检查字体与设计系统资产**

在只读 `use_figma` 调用中列出 Noto Serif SC 与 Noto Sans SC 的可用 style，并检查本地变量、样式、组件和已有库；预期明确记录字体回退方案，不假设字体存在。

- [x] **Step 3: 创建独立 V5 页面和 Foundations 区域**

创建页面 `V5 · 公文秩序 · 朱批系统`，在页面上建立 Foundations 区域，放置色板、字体阶梯、间距和圆角示例；预期 V4 页面节点数和节点 ID 不变。

- [x] **Step 4: 创建变量与最小组件**

建立颜色、间距、圆角、描边变量，并创建 Header、Footer、Button、Status Badge、Case Row、朱批签、朱批轨迹组件；预期组件具备清晰命名并能实例化。

- [x] **Step 5: 截图验证 Foundations**

截取 Foundations 区域，检查颜色、字体、对比度、圆角和组件状态；预期没有占位 shimmer、文字裁切或未加载字体。

### Task 2: V5 欢迎页

**Files:**
- Create in Figma: frame `V5/01 欢迎页`

**Interfaces:**
- Consumes: Task 1 的变量、Public Header、Footer、Button 与朱批轨迹。
- Produces: 欢迎页 Frame ID 和“创建我的朝堂”“登录”交互节点 ID。

- [x] **Step 1: 创建画板和公共结构**

创建 1440×1024 Frame，实例化 Public Header 与 Footer；预期 Header 只包含品牌和登录入口，不出现业务导航。

- [x] **Step 2: 构建价值与行动区**

左侧加入“两行以内”的核心标题、两行说明、主按钮“创建我的朝堂”和文字入口“已有朝堂？登录”；预期主 CTA 是唯一强朱红面积。

- [x] **Step 3: 构建真实案卷朱批示例**

右侧使用“整治永定河春汛隐患”的真实示例，展示已经发生的下旨、分流、办理、回奏、归档；历史节点为档案灰，当前/权威节点为朱红。

- [x] **Step 4: 添加原型跳转**

“创建我的朝堂”跳转到现有 V4 注册页 `138:3`，“登录”跳转到现有 V4 登录页 `138:4`；预期点击矩形和文字均可触发跳转。

- [x] **Step 5: 截图验证欢迎页**

以 1440×1024 截图检查 3 秒价值表达、主次 CTA、字体、单一视觉焦点和所有文字边界；预期无三列能力卡、无装饰性古风素材。

### Task 3: V5 上书房

**Files:**
- Create in Figma: frame `V5/02 上书房`

**Interfaces:**
- Consumes: Task 1 的 App Header、Footer、Button、Case Row、Status Badge、朱批签和朱批轨迹。
- Produces: 上书房 Frame ID、最近案卷交互节点 ID、下旨入口状态。

- [x] **Step 1: 创建工作台骨架**

创建 1440×1024 Frame，实例化 App Header 与 Footer，Header 保留上书房、六部、锦衣卫、军机处、史馆导航和当前朝号。

- [x] **Step 2: 构建一句话下旨主焦点**

在主区上方创建现代批示台，包含 64–96px 高文本输入和“确认下旨”主按钮；预期该区域是页面唯一主要朱红焦点。

- [x] **Step 3: 构建最近三份案卷**

左侧显示三条案卷：分流中、办理中、已归档；使用 Case Row 与朱批签规则，只有当前选中或需要关注的案卷出现朱红批注。

- [x] **Step 4: 构建当前案卷内容**

右侧展示原旨、当前办理、风险与已发生朱批轨迹；不得展示尚未发生的全局流程节点。

- [x] **Step 5: 添加原型跳转并截图验证**

办理中案卷跳转 V5 司级页，已归档案卷暂跳现有史馆 `110:513`；截图检查输入优先级、案卷扫描、文字边界和导航可用性。

### Task 4: V5 六部 · 司级页面

**Files:**
- Create in Figma: frame `V5/03 六部 · 司级页面`

**Interfaces:**
- Consumes: Task 1 的 App Header、Footer、Breadcrumb、Tabs、Filter Bar、Case Row、Status Badge 和朱批轨迹。
- Produces: 司级页面 Frame ID、案卷列表交互节点 ID、锦衣卫调用入口。

- [x] **Step 1: 创建高密度页面骨架**

创建 1440×1024 Frame，顶部显示“六部总览 / 户部 / 度支司”面包屑、处理中/已处理切换、搜索和筛选。

- [x] **Step 2: 构建固定列案卷列表**

左侧或上部列表使用 56–64px 行高，对齐案卷名称、编号、来源、状态和更新时间；包含办理中、待核验、已归档等真实状态。

- [x] **Step 3: 构建证据与事实详情**

详情区展示当前案卷的任务、事实、证据、来源、可信状态与 Agent 办理记录；状态用文字和语义色共同表达。

- [x] **Step 4: 表达锦衣卫条件性调用**

当关键事实不足时显示“锦衣卫正在补证”的上下文消息和查看入口，不使用黑红审讯视觉；历史轨迹仅展示已发生事件。

- [x] **Step 5: 添加原型跳转并截图验证**

已归档案卷跳转现有史馆 `110:513`，锦衣卫入口跳转现有锦衣卫 `123:2`，返回入口跳转 V5 上书房；截图检查高密度扫描、列对齐、截断和单一朱红焦点。

### Task 5: 全量验收与交付

**Files:**
- Validate in Figma: `V5 · 公文秩序 · 朱批系统`
- Update: `docs/superpowers/plans/2026-07-21-v5-digital-court-figma.md`

**Interfaces:**
- Consumes: Tasks 1–4 的所有页面、组件和交互节点。
- Produces: 可分享的 V5 Figma 起始链接、截图证据和验收结果。

- [x] **Step 1: 检查唯一页面规则**

通过 metadata 统计 `V5/01`、`V5/02`、`V5/03`，预期每个名称恰好出现一次，且不存在 01A、02A、状态副本。

- [x] **Step 2: 检查字体与越界**

读取三个画板内全部 Text 节点，验证字体限域并检查任何子节点是否超出画板；预期错误列表为空。

- [x] **Step 3: 检查原型路径**

验证欢迎页创建/登录、上书房办理中/已归档、司级锦衣卫/史馆/返回的 destination ID；预期所有 destination 节点存在。

- [x] **Step 4: 对照截图进行视觉复核**

分别截图 Foundations、欢迎页、上书房、司级页面，检查颜色、字体、圆角、密度、朱红面积和禁止项；发现问题时只做定点修复。

- [x] **Step 5: 更新计划状态并交付**

将完成的 checkbox 更新为 `[x]`，返回 V5 欢迎页 Figma 链接、三个页面清单和已验证范围；不提交或推送仓库文件，除非用户另行授权。
