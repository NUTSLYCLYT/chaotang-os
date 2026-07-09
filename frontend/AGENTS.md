# 朝堂 OS 前端 Agent 入口

本文件是 `chaotang-os/frontend` 的前端 agent 入口。

## 当前定位

`frontend/` 是朝堂 OS 的前端体验线，负责：

- Next.js 页面、组件、布局、导航和交互。
- 浏览器可见的工作流、发布门禁、Playwright/E2E 和截图证据。
- 前端类型契约、数据适配器、LIVE / MIXED / DEMO 边界展示。
- 前端工程 harness：`frontend/.harness/`。

`frontend/` 不负责：

- 非前端运行事实和质量基线。
- 用 mock 或静态样例证明运行服务质量。
- 把真实产线不可逆动作伪装成前端本地能力。

跨线归属以根级 `../.harness/manifest/project-harness.json` 为准；运行事实以 API 契约、根级文档和明确验证输出为准。

## 启动顺序

1. 先读根入口 `../AGENTS.md`，确认本轮任务确实属于前端线。
2. 读 `.harness/agents/frontend-owner.md`。
3. 读 `.harness/rules/product-boundaries.md`、`.harness/rules/project-structure.md`、`.harness/rules/coding-standard.md`、`.harness/rules/dev-workflow.md`。
4. 查看 `.harness/wiki/architecture.md`、`.harness/wiki/api-contracts.md`、`.harness/wiki/release-operations.md`。
5. 新需求在 `.harness/changes/` 创建或更新 change 记录：`pnpm harness:new-change <type> <short-name>`。
6. 修改前端 harness、入口文档或工程规则后，运行 `pnpm harness:doctor`。

## Harness 分层

| 层级 | 路径 | 职责 |
| --- | --- | --- |
| 根级协调 | `../.harness/` | 项目 manifest、跨线边界、根级 doctor |
| 前端工程 harness | `.harness/` | 前端 owner、规则、skills、wiki、模板、change 记录 |
| 运行证据引用 | 根级 manifest / API 契约 | 只记录来源，不展开服务端实现 |

前端 `.harness/` 可以引用根级运行证据，但不能复制或迁移运行记录、质量基线和生产执行逻辑。

## 常用命令

```bash
pnpm harness:doctor
pnpm harness:new-change feat short-name
pnpm exec tsc --noEmit
pnpm build
pnpm test:e2e
```

端口纪律：

| 用途 | 端口 | 命令 |
| --- | ---: | --- |
| Dev HMR | 3002 | `pnpm dev` |
| Production | 3050 | `pnpm start` |
| 禁用 | 3001 | 不要绑定 |

## 验收口径

- 页面和视觉类改动必须提供浏览器验证证据。
- 类型或契约改动至少跑 TypeScript/build 或对应单测。
- 高风险前端能力，如鉴权、租户隔离、特权写入、source label、真实数据声明和发布门禁，必须有 review 与回归验证。
- 涉及运行服务事实时，必须标明证据来源、API 契约或根级验证命令。

## 收口

最终说明需要列出：

1. 本轮目标。
2. 应提交文件。
3. 不应提交文件。
4. 实际验证命令。
5. 回滚方式。
