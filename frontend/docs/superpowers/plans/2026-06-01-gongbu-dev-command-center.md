# 工部开发司令部建设方案

> 主舱：`/home/ubuntu/workspace/chaotang-web-lyt`
> 日期：2026-06-01
> 目标：把工部建设成朝堂 OS 的开发生产系统，让它能调度开发助手与开发团队，持续完成户部、锦衣卫、礼部、史馆等板块。

## 1. 总判断

工部不应该只是一个“产品技术交付总控台”展示页，而要成为项目的工程作战中枢。

第一版先做成可用闭环：

```text
上书房收需求
  -> 工部拆 PRD / 架构 / 验收
  -> 军机处立案与裁断阻塞
  -> jiqun / gstack / Codex 执行开发
  -> QA 构建与浏览器验收
  -> 史馆归档复盘
```

核心原则：先把开发流水线跑通，再复制到各业务板块。

## 2. gstack / superpower 用法

### 2.1 可用

当前主舱已经有 `docs/superpowers/plans/`，适合把 gstack/superpower 当成“高阶工作流层”使用。

推荐固定成四道门：

| 阶段 | 使用能力 | 目的 |
| --- | --- | --- |
| 立项 | `spec` / plan 文档 | 把一句话需求变成可执行规格 |
| 方案 | `plan-ceo-review` + `plan-eng-review` | 先审产品价值，再审架构可落地性 |
| 实现 | Codex + OpenClaw / jiqun | 分工开发、局部实现、接入主舱 |
| 验收 | `qa` / `qa-only` / `browse` / `design-review` | 浏览器验收、截图、修 bug、确认可交付 |

### 2.2 不做什么

- 不把 gstack 当“魔法自动开发器”。它要嵌入工部流程，作为审查、QA、浏览器验证、复盘工具。
- 不让多个 agent 同时乱改同一批文件。每个开发单元必须有文件边界。
- 不绕过 `npm run build`。每次合并到主舱前必须构建通过。

## 3. 工部产品形态

工部页面分三层。

### 3.1 工部总览

已有基础：`/manor-dept/gongbu`

需要增强：

- 今日开发战况：运行中、阻塞、待验收、已归档。
- 重点板块：户部、锦衣卫、礼部、史馆、军机处。
- 当前最高优先级：只显示 1-3 件，不做信息瀑布。

### 3.2 开发助手台

入口已开始接入：

- `/jiqun/command-center`：开发总控。
- `/command-center`：需求立案与军机裁断。
- `/jiqun/prompts`：提示词模板库。
- `/jiqun/knowledge`：项目知识索引。
- `/jiqun/runs`：运行记录。
- `/jiqun/compare`：方案对比。

下一步要把这些从“链接”升级成“状态卡片”：

```ts
interface DevAssistantStatus {
  id: string;
  name: string;
  href: string;
  status: 'ready' | 'running' | 'blocked' | 'offline';
  activeRuns: number;
  lastResult?: string;
  health: number;
}
```

### 3.3 开发作战案

每个新板块都变成一个开发作战案：

```ts
interface DevelopmentCase {
  id: string;
  title: string;
  targetModule: 'hubu' | 'jinyiwei' | 'libu' | 'shiguan' | 'gongbu' | 'command-center';
  intent: string;
  owner: string;
  stage: 'brief' | 'spec' | 'architecture' | 'implementation' | 'qa' | 'review' | 'archived';
  acceptance: string[];
  files: string[];
  risks: string[];
  gstackReviews: Array<'ceo' | 'eng' | 'design' | 'qa'>;
}
```

## 4. 工部团队分工

第一版固定 8 个角色，不急着做权限系统：

| 角色 | 负责 |
| --- | --- |
| 产品官 | PRD、边界、验收标准 |
| 架构师 | 模块边界、数据流、失败回退 |
| 前端工匠 | UI、交互、响应式、视觉一致性 |
| 后端工匠 | API、数据模型、权限、任务状态 |
| QA 御史 | 构建、浏览器、截图、回归 |
| SRE 值房 | 启动、部署、监控、回滚 |
| 安全校尉 | 密钥、注入、权限、供应链 |
| 史馆记录 | 决策、复盘、可复用经验 |

这些先用 mock/status card 表达，后续再接 jiqun 或 OpenClaw 的真实运行状态。

## 5. 三阶段落地

### Phase 1：工部成为开发入口

目标：用户一进工部，就知道现在怎么开发、谁在开发、去哪启动。

交付：

- 顶部导航加入工部。
- `/manor-dept/gongbu` 显示开发助手台、开发队、标准闭环。
- 增加“新建开发作战案”入口，预填到 `/command-center`。

验收：

- `npm run build` 通过。
- `/manor-dept/gongbu` 可访问。
- 工部能一键进入开发总控、军机立案、提示词库、知识索引、运行记录。

### Phase 2：工部接入真实任务状态

目标：工部不再只是入口，而是能看到开发运行状态。

交付：

- 新增 `src/features/gongbu/`。
- 新增 `development-case` mock store。
- 聚合 `/jiqun/*` 运行数据，展示 active runs / failed runs / recent completions。
- 开发作战案可以关联目标板块和验收标准。

验收：

- 工部能显示运行中、阻塞、待验收、已完成开发案。
- 每个开发案能跳到军机处或 jiqun run。
- 空态、失败态、加载态完整。

### Phase 3：形成可复制开发流水线

目标：每个业务板块都能按同一流程开发。

交付：

- `docs/superpowers/templates/feature-plan.md`
- `docs/superpowers/templates/qa-checklist.md`
- 工部页面展示最近构建结果和 QA 结论。
- 史馆自动形成开发复盘条目。

验收：

- 新建一个板块时，可以从工部生成计划、进入实现、验收、归档。
- 至少跑通一个样板：锦衣卫投资暗线或户部投资联动。
- QA 截图和构建结果可追踪。

## 6. 当前优先级

立即做：

1. 把工部 Phase 1 做稳。
2. 新建 `src/features/gongbu/`，沉淀类型和 mock 数据。
3. 给工部加“开发作战案”列表。
4. 给每个开发案加一键进入 `/command-center?task=...`。
5. 用 gstack `qa` / browse 对工部做一次页面验收。

暂缓：

- 真实登录 GitHub/Figma/Slack/Notion。
- 复杂权限系统。
- Docker。
- 多 agent 自动提交代码。

## 7. 开发纪律

- 主舱固定：`/home/ubuntu/workspace/chaotang-web-lyt`
- 开发端口：`3002`
- 生产端口：`3050`
- 禁止使用：`3001`
- 每次改动后至少跑：`npm run build`
- 视觉改动必须浏览器验收。
- 涉及密钥只用环境变量，不写入代码和文档。

