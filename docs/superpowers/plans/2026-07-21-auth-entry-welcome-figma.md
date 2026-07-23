# 登录、注册与欢迎入口 Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 V4 Figma 原型中增加欢迎、登录、注册和首次欢迎引导四个入口页面，并连接到既有上书房。

**Architecture:** 四个入口页面作为同一 Figma 页面 `V4 · 皇帝案卷决策台` 下的四个独立顶层 Frame。未登录页面不显示业务导航；注册创建独立朝堂并进入首次引导，登录直接进入上书房，首次引导完成后进入现有 `V4/01 上书房`。

**Tech Stack:** Figma Design、Figma Plugin API、Noto Sans SC、现有 V4 原型视觉语言。

## Global Constraints

- Figma 文件固定使用 `bQAkFbJd9y0INu3m9H4dIu`，目标页面固定使用 `110:2`。
- 既有上书房目标 Frame 固定使用 `110:3`。
- 每个入口功能只保留一个主页面，不为错误态、成功态或引导步骤创建重复 Frame。
- 用户模型为“多用户、独立朝堂”；每个注册用户在自己的朝堂中都是皇帝。
- 不出现人工选择六部、司级、军机处或锦衣卫身份的入口。
- 沿用黑色 Header、暖白背景、白色内容卡、赭红强调色和 Noto Sans SC。
- 本任务只修改 Figma，不修改业务代码；未授权 Git 提交。

---

### Task 1: 欢迎页

**Files:**
- Modify: Figma file `bQAkFbJd9y0INu3m9H4dIu`, page `110:2`

**Interfaces:**
- Consumes: 现有 V4 色彩、字体和 1440×1024 画板规格。
- Produces: 顶层 Frame `V4/入口/01 欢迎页`，包含到注册页与登录页的原型入口。

- [ ] **Step 1: 创建页面骨架**

创建 1440×1024 顶层 Frame，使用黑色简化 Header、暖白背景和通用 Footer；Header 只显示“朝堂 OS”与“登录”，不显示内部业务菜单。

- [ ] **Step 2: 添加产品价值内容**

主标题使用“一句话下旨，Agent 自动办理”；副标题说明案卷全程可查、结论可追溯、完成后进入史馆。

- [ ] **Step 3: 添加入口操作**

主按钮“创建我的朝堂”连接注册页；次按钮“已有朝堂，直接登录”连接登录页。

- [ ] **Step 4: 添加三项能力说明**

展示“上书房下旨”“Agent 分层办理”“史馆永久归档”三项能力，不展示伪造插图或无来源图标。

### Task 2: 注册页与登录页

**Files:**
- Modify: Figma file `bQAkFbJd9y0INu3m9H4dIu`, page `110:2`

**Interfaces:**
- Consumes: Task 1 的入口页视觉语言。
- Produces: `V4/入口/02 注册页` 与 `V4/入口/03 登录页`，两页可相互跳转。

- [ ] **Step 1: 建立统一左右分栏布局**

左侧展示朝堂 OS 品牌、独立朝堂说明和三项可信承诺；右侧为白色表单卡片。

- [ ] **Step 2: 完成注册表单**

注册页包含“朝号或称谓”“邮箱”“密码”“同意服务条款与隐私说明”，主按钮为“创建朝堂”，成功原型路径连接首次欢迎引导。

- [ ] **Step 3: 完成登录表单**

登录页包含“邮箱”“密码”“保持登录”和“忘记密码”，主按钮为“进入朝堂”，成功原型路径连接现有上书房 `110:3`。

- [ ] **Step 4: 连接相互跳转**

注册页“已有账号，去登录”连接登录页；登录页“还没有朝堂，立即创建”连接注册页。

### Task 3: 首次欢迎引导

**Files:**
- Modify: Figma file `bQAkFbJd9y0INu3m9H4dIu`, page `110:2`

**Interfaces:**
- Consumes: 注册页创建的朝堂名称示例“景和朝”。
- Produces: `V4/入口/04 首次欢迎引导`，主操作连接上书房 `110:3`。

- [ ] **Step 1: 创建聚焦式欢迎卡**

页面显示“景和朝已创建”，并明确用户是该独立朝堂中的皇帝。

- [ ] **Step 2: 在一个页面展示三步**

依次展示“一句话下旨”“Agent 自动分流与办理”“正式回奏归入史馆”，不拆分为多个步骤页面。

- [ ] **Step 3: 添加完成操作**

主按钮“进入上书房”连接 `110:3`；不提供角色选择或 Agent 配置。

### Task 4: 原型连接与视觉验收

**Files:**
- Modify: Figma file `bQAkFbJd9y0INu3m9H4dIu`, page `110:2`

**Interfaces:**
- Consumes: Tasks 1–3 创建的四个 Frame。
- Produces: 可从欢迎页走通注册路径与登录路径的完整入口原型。

- [ ] **Step 1: 检查入口链路**

验证“欢迎页 → 注册页 → 首次欢迎引导 → 上书房”以及“欢迎页 → 登录页 → 上书房”均无断链。

- [ ] **Step 2: 检查页面唯一性**

确认入口模块恰好四个主 Frame，未产生 `A`、`B`、错误态或成功态重复页面。

- [ ] **Step 3: 检查字体和布局**

确认全部文字使用 Noto Sans SC 的 Bold、Medium 或 Regular，且无缺失字体、零宽文本、裁切或重叠。

- [ ] **Step 4: 截图复核**

分别截图欢迎页、注册页、登录页和首次欢迎引导；与现有 V4 页面并排比较 Header、背景、卡片、边框、按钮和间距，修复可见差异。

- [ ] **Step 5: 检查原型目标**

读取所有入口页 Reaction，确认所有 `NAVIGATE` 目标均为同一 Figma 页面上的顶层 Frame，且不存在无效目标。
