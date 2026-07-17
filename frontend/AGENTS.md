# 前端 Agent 工作入口

作用域：`frontend/`。已确定最小技术栈：Next.js（App Router）+ React/react-dom +
TypeScript，npm 管理依赖，Node 内置 `node:test` 做单元测试。选型理由、取舍和验证
证据见 `docs/decisions/0006-frontend-backend-foundation-stack.md`（`## 前端` 章节）。

## 边界

- 这里只放前端工程及其验证，不实现后端内部功能。
- `src/app/page.tsx` 只做最小健康检查展示（调用后端 `GET /health` 并展示状态），
  不承载任何业务 UI、状态管理、UI 组件库或鉴权；新增业务页面前先确认是否有对应
  产品任务。
- `src/lib/backendClient.ts` 是唯一对后端发起网络调用的位置，只在 Next.js 服务端
  （Server Component / Route Handler）中使用；不得引入 `NEXT_PUBLIC_` 前缀的后端
  地址变量，避免把后端地址暴露到浏览器端。
- `src/app/study/page.tsx`（`/study`，“上书房”）是第一个业务页面：客户端组件
  （`"use client"`），提供旨意输入框与“下旨”按钮，用户主动点击后才通过同源相对
  路径 `fetch('/api/decrees/chancellor')` 提交（不自动提交、不直接引用
  `BACKEND_BASE_URL`、不直接请求 FastAPI）。页面明确提示点击“下旨”会产生真实
  DeepSeek 调用费用，并展示处理中/成功（丞相身份 + 回奏）/失败三种状态。
  `src/app/study/decreeStatus.ts` 是配套的纯函数模块（不依赖 React/DOM/网络），
  负责把一次下旨提交结果映射为页面可渲染的 UI 状态，供 `decreeStatus.test.ts`
  完全离线单测。
- `src/app/api/**` 下的 `route.ts` 是 Next.js Route Handler 模式的落地范例（详见
  `src/app/api/decrees/chancellor/route.ts`）：`export async function POST(request:
  Request): Promise<Response>`，在服务端调用 `src/lib/backendClient.ts` 的导出
  函数，把其带 `kind`/`ok` 的稳定结果映射为真实 HTTP 状态码与脱敏 JSON 响应体；
  对 Route Handler 自身收到的畸形请求体（无法 `JSON.parse`、字段类型不符）返回
  稳定 4xx，绝不 500，也不会在这种情况下调用后端。Route Handler 内部对
  `src/lib/backendClient.ts` 的导入使用相对路径 + 显式 `.ts` 扩展名（而非
  `@/*` 路径别名），使得对应的 `route.test.ts` 能在纯 `node --test` 环境下
  直接 `import { POST } from "./route.ts"` 并让内部依赖被正确解析（`@/*` 别名
  只在 Next.js 自身构建时生效）。
- 不引入 Playwright、Cypress 等浏览器自动化框架；行为验证以 `node:test` 直接跑
  `backendClient` 的成功/失败路径为主，涉及页面渲染时通过 `next build` + 一次性
  entry 烟雾验证（启动 `next start` 请求 `/` 与 `/study` 确认 200，然后关闭进程）覆盖。

## 环境要求

- Node.js `>=22`（当前开发机与 CI 参考版本 `v24.x`；`node --test` 需要能够直接
  运行 `.ts` 文件的类型剥离能力，Node 22.6+/23.6+ 起默认支持，无需额外 flag）。
- 包管理器为 npm（`package-lock.json` 已提交，使用 `npm ci` 做可复现安装）。

## Setup

```bash
cd frontend
npm ci
```

首次没有 `package-lock.json`（例如升级依赖后）需要用 `npm install` 重新生成锁
文件并提交。

## Lint

```bash
npm run lint
```

等效于 `eslint`（`eslint.config.mjs` 基于 `eslint-config-next` 的
`core-web-vitals` + `typescript` 规则集）。

## Typecheck

```bash
npm run typecheck
```

等效于 `tsc --noEmit`（不产出文件，只做类型检查）。

## Test

```bash
npm test
```

等效于 `node --test`（从 `frontend/` 目录递归发现 `**/*.test.ts` 等默认模式的
测试文件，当前覆盖 `src/lib/backendClient.test.ts` 的成功路径、失败路径（后端
不可达 / 非 200 状态码）以及 `getBackendBaseUrl` 的环境变量读取逻辑；
`src/app/study/decreeStatus.test.ts` 覆盖 idle/submitting/success/各错误 `kind`
的纯函数映射；`src/app/api/decrees/chancellor/route.test.ts` 起本地 HTTP stub
并直接调用 `POST`，覆盖成功、后端校验失败(422)、配置失败(503)、模型失败(502)、
后端不可达以及 Route Handler 自身收到畸形请求体的场景）。测试直接用相对路径 +
显式 `.ts` 扩展名导入被测模块（例如 `./backendClient.ts`、`./route.ts`），因为
Node 原生 ESM 解析不支持 `tsconfig.json` 里的 `@/*` 路径别名；`@/*` 别名只在
Next.js 应用代码（页面）中可用，Route Handler 对 `src/lib` 的导入也统一改用
相对路径以保持可被 `node --test` 直接加载。

## Build

```bash
npm run build
```

等效于 `next build`。

## Run（本地开发）

```bash
npm run dev
```

默认监听 `http://localhost:3000`。

## Run（生产模式 / entry 烟雾验证）

```bash
npm run build
npm run start
```

启动后可用 `curl -i http://localhost:3000/`（或等效工具）确认页面返回
`200 OK`；页面会展示后端健康检查结果——若 `backend/` 服务同时运行且
`BACKEND_BASE_URL` 指向它，会展示 `后端状态：ok（...）`；若后端不可达，会展示
`后端不可用：<错误描述>`，均不导致页面报错或非 200。还应请求
`http://localhost:3000/study`，确认返回 200 且包含“上书房”、下旨按钮和 DeepSeek
费用提示；烟雾验证不得点击下旨，避免产生真实模型用量。验证完成后关闭该进程。

## 环境变量

复制 `.env.example` 为 `.env.local`（或按部署方式设置真实环境变量）：

- `BACKEND_BASE_URL`：后端 FastAPI 服务的基础 URL，默认
  `http://127.0.0.1:8000`；只在服务端读取（无 `NEXT_PUBLIC_` 前缀），不会被打包
  进浏览器端代码。

## 后续变更要求

再次改变框架、包管理器、测试方式或跨端调用路径时，在同一变更中：

1. 用最小原型验证关键假设。
2. 在 `docs/decisions/` 记录选择和取舍。
3. 更新本文件，登记准确的 setup、lint、typecheck、test、build/run 命令，并接入
   CI。
4. 保持 `src/lib/backendClient.ts` 与 UI 解耦，确保成功/失败两条路径都能在无
   浏览器、无常驻服务的 CI 环境里重复运行。
