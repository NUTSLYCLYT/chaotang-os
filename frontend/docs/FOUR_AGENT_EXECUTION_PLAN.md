# 朝堂 OS 四窗口并行执行方案

> 工作舱：`/home/ubuntu/workspace/chaotang-web-lyt`
> 目标：先把“每日经营建议 -> 下旨 -> 军机处执行 -> 史馆复盘 -> 次日建议”的闭环做成可演示、可验收、可继续接真实后端的产品主线。

## 1. 当前判断

本仓库已经不是空项目。Next.js 16、App Router、Tailwind 4、九个 PRD 主模块、PRD 图片资产、上书房、军机处、史馆、三省审议台、蜂群后台等基础页面都已经存在。

当前最应该避免的是四个窗口各自发散重做页面。最高效路线是只围绕一个主线闭环收口：

```text
经营信号
  -> 上书房生成今日建议
  -> 陛下一键转圣旨
  -> 军机处拆解执行
  -> 三省/六部/蜂群给出过程意见
  -> 史馆沉淀结果与复盘
  -> 次日上书房继续给建议
```

这个闭环做成以后，朝堂 OS 才不是“古风界面集合”，而是一个企业经营操作系统。

## 2. 架构分层

### 2.1 产品层

用户只理解五件事：

- 今日有什么经营问题。
- 为什么现在要处理。
- 系统建议我怎么下令。
- 谁负责执行，什么时候验收。
- 结果怎么样，下一步怎么办。

因此第一版不要追求所有殿宇都完整，而要让 `上书房 -> 军机处 -> 史馆` 三点打通。

### 2.2 领域层

建议统一四个核心对象：

```text
OperatingSignal          经营信号：市场、财务、项目、风险、组织、系统
DailyRecommendation      今日建议：建议动作、原因、优先级、责任部门
ImperialDecree           圣旨：用户确认后的正式任务意图
ExecutionCase            执行案：状态机、责任人、进度、风险、验收标准
ReviewArchive            复盘档案：结果、证据、评分、下次建议
```

### 2.3 状态机

第一版状态不要复杂，统一为：

```text
draft
  -> dispatched
  -> triage
  -> planning
  -> executing
  -> reviewing
  -> report_ready
  -> archived

失败/阻塞分支：
blocked
failed
cancelled
```

军机处页面负责展示状态推进；史馆负责沉淀 `report_ready` 和 `archived`。

### 2.4 前端分层

推荐目录：

```text
src/features/operating-loop/
  contracts/
  lib/
  components/

src/features/shangshufang/
  上书房入口和建议选择

src/features/command-center/
  军机处执行流和任务态

src/features/shiguan/
  史馆复盘和归档

src/lib/contracts/
  跨模块共享契约，稳定后再迁入这里
```

短期先放 `src/features/operating-loop`，等契约稳定再上升到 `src/lib/contracts`。

## 3. 四个窗口分工

### Codex 1：主架构与经营闭环

职责：

- 统一领域模型、状态机、mock 数据和 API 适配层。
- 维护 `src/features/operating-loop/`。
- 保证 `上书房 -> 军机处` 能跑通。
- 每轮合并前跑 `npm run build`。

交付：

- `src/features/operating-loop/contracts/*`
- `src/features/operating-loop/lib/daily-brief.ts`
- `src/features/operating-loop/lib/execution-case.ts`
- 上书房建议可转圣旨。
- 军机处可以识别经营建议来源。

验收：

- 点击上书房今日建议，能生成圣旨草稿。
- 下旨后能进入 `/command-center?taskId=...`。
- 页面上能看见来源、目标、责任部门、验收标准。
- `npm run build` 通过。

### Codex 2：军机处执行体验

职责：

- 专注 `/command-center` 和 `BattleStream`。
- 把任务从“流式日志”升级成“经营作战案”。
- 增加任务摘要、状态时间线、责任部门、风险、验收标准、下一步动作。

交付：

- `src/features/command-center/BattleStream.tsx`
- 必要时新增 `src/features/command-center/components/*`
- 军机处无 `taskId` 时显示今日作战总览；有 `taskId` 时显示单案执行。

验收：

- 有任务：能看到圣旨原文、经营目标、当前阶段、责任部门、验收标准。
- 无任务：能看到最近任务和推荐进入上书房。
- 移动端不溢出，桌面端不遮挡 PRD 图核心区域。
- `npm run build` 通过。

### Claude Code 1：史馆复盘与档案体系

职责：

- 专注 `/archive`、`/shiguan`、`/reports`。
- 设计复盘卡片、评分、证据、下次建议。
- 把执行结果变成可被次日建议使用的经营记忆。

交付：

- 史馆复盘列表。
- 单个任务复盘结构。
- 复盘字段：目标、执行过程、结果、证据、风险、评分、下次建议。

验收：

- 可以从任务进入复盘/报告页。
- 每个归档项能回答：做了什么、结果如何、凭什么判断、下一步是什么。
- 页面视觉遵守现有资产和全局样式，不重写 `globals.css`。
- `npm run build` 通过。

### Claude Code 2：视觉一致性与产品验收

职责：

- 审查九大 PRD 页的一致性。
- 修导航、空态、移动端、文案层级、按钮交互。
- 给每个模块补“真实产品感”的状态，而不是纯图。

交付：

- 视觉 QA 清单。
- 页面缺陷修复。
- 关键截图或浏览器验收记录。

验收：

- `/court-briefing`、`/command-center`、`/archive`、`/overview` 视觉不割裂。
- 每个可点击入口有明确反馈。
- 不出现文本遮挡、按钮溢出、空白页面。
- `npm run build` 通过。

## 4. 合并纪律

四个窗口不要同时改同一个文件。必须按下面边界执行：

```text
Codex 1:
  src/features/operating-loop/**
  src/features/shangshufang/**
  src/lib/contracts/* 仅必要时

Codex 2:
  src/features/command-center/**
  src/app/(dashboard)/command-center/page.tsx

Claude Code 1:
  src/features/shiguan/**
  src/app/(dashboard)/archive/**
  src/app/(dashboard)/shiguan/**
  src/app/(dashboard)/reports/**

Claude Code 2:
  src/components/**
  src/app/(dashboard)/layout.tsx 仅审慎修改
  各页面小修，但不要改业务契约
```

如果必须跨边界，先在群里说明“改哪个文件、为什么、影响谁”。

## 5. 第一轮 6 小时冲刺

### 第 1 小时：契约冻结

- Codex 1 定义经营闭环字段。
- Codex 2 阅读军机处现有流。
- Claude 1 阅读史馆/报告现状。
- Claude 2 跑一次视觉巡检。

产物：每人提交一段“我负责的边界和会改的文件”。

### 第 2-4 小时：并行实现

- Codex 1 打通建议转圣旨。
- Codex 2 完成军机处任务信息层。
- Claude 1 完成复盘档案首版。
- Claude 2 修最明显视觉和交互问题。

产物：每人一个小 PR 或一个明确 diff。

### 第 5 小时：集成

- 只由 Codex 1 做最终集成。
- 解决类型冲突。
- 跑 `npm run build`。

### 第 6 小时：验收演示

演示脚本：

```text
1. 进入 /court-briefing。
2. 点击“今日经营建议”。
3. 自动生成圣旨草稿。
4. 下旨进入 /command-center?taskId=...
5. 查看军机处拆解、责任部门、风险、验收标准。
6. 进入史馆查看复盘/归档。
7. 回到上书房看到下一步建议。
```

## 6. 给四个窗口的直接 Prompt

### Codex 1 Prompt

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。只负责经营闭环领域模型和上书房入口。
先读 AGENTS.md、src/config/routes.ts、src/features/shangshufang、src/features/operating-loop。
不要重写视觉资产，不要改 globals.css。
目标：定义 DailyRecommendation / ExecutionCase / AcceptanceCriteria，并让上书房建议能生成可下旨草稿。
验收：npm run build 通过，点击建议能进入下旨流程。
```

### Codex 2 Prompt

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。只负责军机处。
先读 AGENTS.md、src/app/(dashboard)/command-center/page.tsx、src/features/command-center/BattleStream.tsx。
不要改上书房和史馆。
目标：把军机处从事件流展示升级为经营作战案展示，补任务来源、经营目标、责任部门、风险、验收标准、下一步动作。
验收：有 taskId 和无 taskId 两种状态都可用，npm run build 通过。
```

### Claude Code 1 Prompt

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。只负责史馆/报告/复盘。
先读 AGENTS.md、src/app/(dashboard)/archive、src/app/(dashboard)/shiguan、src/app/(dashboard)/reports、src/features/shiguan。
不要改军机处和上书房。
目标：把执行结果沉淀为复盘档案，字段包括目标、过程、结果、证据、风险、评分、下次建议。
验收：能从任务语义看懂复盘价值，npm run build 通过。
```

### Claude Code 2 Prompt

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。只做视觉一致性和产品验收。
先读 AGENTS.md、src/config/routes.ts、src/components、src/app/(dashboard)/layout.tsx。
不要改业务契约，不要大改 globals.css。
目标：检查 /court-briefing、/command-center、/archive、/overview 的视觉、空态、点击反馈、移动端溢出。
验收：列出问题并修复高优先级缺陷，npm run build 通过。
```

## 7. 当前最高优先级

P0：

- 经营闭环字段统一。
- 上书房建议转圣旨。
- 军机处显示任务目标和验收标准。
- 史馆能归档复盘。

P1：

- 三省审议台和六部页面接入同一任务状态。
- 每日建议根据历史归档动态生成。
- 经营驾驶舱增加 KPI 和现金流/项目/风险信号。

P2：

- 更复杂的智能体编排。
- 后台 Prompt 管理。
- AB 测试、模型评分、成本看板。

## 8. 不做清单

第一轮不要做：

- 不重做所有页面。
- 不重写视觉系统。
- 不接入复杂真实后端，先稳定 BFF/Mock 契约。
- 不引入新 UI 框架。
- 不让四个窗口同时改同一个核心文件。

第一版成功标准不是“功能多”，而是“经营闭环像真的”。
