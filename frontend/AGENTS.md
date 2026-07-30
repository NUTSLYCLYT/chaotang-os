# 前端 Agent 工作入口

## 史馆边界

前端仅消费后端史馆 API；公开档案类型只允许 `MEMORIAL`（奏折）与 `REPLY`（回奏），筛选
只显示“全部 / 奏折 / 回奏”。回奏按后端契约展示来源、参与部门、办理过程、结论、时间和
责任主体；旧类型和字段不完整的回奏必须作为契约错误处理，不得在前端偷偷改名或补全。
`RecallMatch.review_status` 是对象或 `null`。前端不得根据丞相成功响应推断自动归档已成功，
也不得重新定义召回响应形状。完整边界见
`docs/decisions/0017-shiguan-memorial-reply-contract.md`。

## 锦衣卫调查台

- `src/app/jinyiwei/page.tsx`（`/jinyiwei`）是只读证据审计台，展示调查汇总、分页案卷、
  事实槽位、来源尝试、证据出处/质量/置信度/立场、冲突、不得推断项、缓存状态和关联回奏。
  状态不能只靠颜色表达；页面必须保留加载、空、错误、无证据和 360px 窄屏状态。
- 浏览器只调用同源的三个 GET-only BFF：`/api/jinyiwei/summary`、
  `/api/jinyiwei/investigations` 与 `/api/jinyiwei/investigations/[id]`。BFF 在服务端调用
  `src/lib/backendClient.ts`，严格校验查询、ID 和完整后端响应，并只返回固定、脱敏的错误。
- 页面不得提供任意 URL、发起/重试调查、编辑或删除控件，也不得直接访问 FastAPI 或读取
  `BACKEND_BASE_URL`。锦衣卫后端同样不提供变更端点；完整边界见 ADR 0018。

作用域：`frontend/`。已确定最小技术栈：Next.js（App Router）+ React/react-dom +
TypeScript，npm 管理依赖，Node 内置 `node:test` 做单元测试。选型理由、取舍和验证
证据见 `docs/decisions/0006-frontend-backend-foundation-stack.md`（`## 前端` 章节）。

## 边界

- 这里只放前端工程及其验证，不实现后端内部功能。
- `src/app/page.tsx` 承载登录前欢迎页；健康检查展示位于 `src/app/health/page.tsx`（调用后端
  `GET /health` 并展示状态）。欢迎页不承载认证、会话或业务后端调用；新增业务页面前先确认
  是否有对应产品任务。
- `src/lib/backendClient.ts` 是唯一对后端发起网络调用的位置，只在 Next.js 服务端
  （Server Component / Route Handler）中使用；不得引入 `NEXT_PUBLIC_` 前缀的后端
  地址变量，避免把后端地址暴露到浏览器端。
- `src/app/study/page.tsx`（`/study`，“上书房”）是第一个业务页面：客户端组件
  （`"use client"`），提供旨意输入框与“下旨”按钮，用户主动点击后才通过同源相对
  路径 `fetch('/api/decrees/chancellor')` 提交（不自动提交、不直接引用
  `BACKEND_BASE_URL`、不直接请求 FastAPI）。页面明确提示点击“下旨”会触发一次下旨
  流程中的多次模型调用（丞相首次判断、司级意见、部级补充、multi 军机处会审及丞相最终
  汇总）并产生相应的 DeepSeek 调用费用；最坏 single 为 11 次、全六部 multi 为 54 次同步
  模型调用，现有 `submitDecree()` 120 秒超时可能不足。页面
  并展示处理中/成功/失败三种状态；成功状态展示丞相判断说明（`rationale`）、完整流转
  路径（`processingPath.join(" → ")`）、各参与部门的分层意见列表（`ministryOpinions`：每部
  先展示有序 `bureauOpinions`，再展示部级 `opinion`）、仅 multi 展示的军机处会审结论
  （`councilVerdict`）、丞相总结（`finalVerdict`）和恰好三项建议（`recommendations`）。
  这组结构化字段替代了早期版本的单段回奏文本；成功契约及分层 UI 见
  `docs/decisions/0012-decree-six-ministries-joint-review.md` 与
  `docs/decisions/0014-layered-memorial-three-recommendations.md`。
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
  entry 烟雾验证（启动 `next start` 请求 `/`、`/study` 与 `/jinyiwei` 确认 200，然后
  关闭进程）覆盖。

## 账户与 BFF 边界

`/study` 和 `/shiguan` 为登录保护页面；服务端在渲染前验证 `courtos_session`。浏览器只保留 BFF 设置的 `HttpOnly`、`SameSite=Lax` cookie（生产环境为 `Secure`），不得把 session ID、后端地址或可用令牌写入客户端状态。

所有受保护的 `src/app/api/**` Route Handler 必须在服务端读取 cookie，无 cookie 时返回 401，有 cookie 时仅以 `Authorization: Bearer <session>` 转发给 FastAPI。不得转发或接受 owner ID；FastAPI 从认证上下文决定 owner。退出时先请求后端废止会话，无论废止返回如何都清除本地 cookie。本地验证使用注入图响应，不点击会触发真实模型的路径。见 ADR 0027。

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
测试文件，当前覆盖 `src/lib/backendClient.test.ts` 的成功路径（single/multi 路由完整
字段、成功响应体缺少新契约字段时回退为 `kind: "unknown"`）、失败路径（后端不可达 /
非 200 状态码 / 自定义短 `timeoutMs` 覆盖默认值验证真实超时中止分支）以及
`getBackendBaseUrl` 的环境变量读取逻辑；`src/app/study/decreeStatus.test.ts` 覆盖
idle/submitting/success（single/multi 两种路由的完整流转字段）/各错误 `kind` 的纯函数
映射；`src/app/api/decrees/chancellor/route.test.ts` 直接调用
`POST` 并注入内存后端调用，覆盖成功（single/multi 两种路由的新契约字段透传）、后端校验失败(422)、配置
失败(503)、模型失败(502)、后端不可达以及 Route Handler 自身收到畸形请求体的场景）。
测试直接用相对路径 + 显式 `.ts` 扩展名导入被测模块（例如 `./backendClient.ts`、
`./route.ts`），因为 Node 原生 ESM 解析不支持 `tsconfig.json` 里的 `@/*` 路径别名；
`@/*` 别名只在
Next.js 应用代码（页面）中可用，Route Handler 对 `src/lib` 的导入也统一改用
相对路径以保持可被 `node --test` 直接加载。
纯响应解析/契约拒绝测试不得依赖本地 HTTP 调度或真实超时竞争；健康检查、`submitDecree()`、
史馆客户端和锦衣卫只读客户端均提供 `fetchImpl`、`scheduleTimeout` 与 `cancelTimeout`
测试注入点，这类用例使用内存 `Response` 和确定性调度器。URL、查询与 ID 编码通过注入
`fetchImpl` 观察实际请求验证；AbortController 超时通过注入调度回调和请求
`AbortSignal` 验证。`frontend/src/**/*.test.ts` 不启动本地 HTTP server，防止 Windows
loopback 偶发超时把纯契约错误错误映射成 `network`。

锦衣卫相关测试另覆盖只读客户端的递归 JSON 与严格嵌套契约、分页和 ID 编码、证据组一致性、
史馆回奏证据引用兼容，三个 GET-only BFF 的查询拒绝/脱敏，以及调查状态、置信度、分页和
陈旧响应抑制的纯函数；源码守卫要求页面没有变更请求或编辑控件。跨端 fixture 来自最终
backend schema v4 `model_dump(mode=json)`，同时绑定 `DataScope`、`SourceType.MCP`、
当前/历史证据、访问溯源、逐调用 `call_audits` 以及史馆不可变证据引用；锦衣卫与史馆页面
源码守卫确认对应字段被解析并展示。

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

启动后可用 `curl -i http://localhost:3000/health`（或等效工具）确认页面返回
`200 OK`；页面会展示后端健康检查结果——若 `backend/` 服务同时运行且
`BACKEND_BASE_URL` 指向它，会展示 `后端状态：ok（...）`；若后端不可达，会展示
`后端不可用：<错误描述>`，均不导致页面报错或非 200。还应请求
`http://localhost:3000/study`，确认返回 200 且包含“上书房”、下旨按钮和反映“一次下旨
可能触发多次模型调用”的 DeepSeek 费用提示；烟雾验证不得点击下旨，避免产生真实模型
用量。还应请求 `http://localhost:3000/jinyiwei`，确认返回 200 且显示只读调查台；只允许
浏览汇总、案卷和详情，不得触发采集或变更。验证完成后关闭该进程。

## 环境变量

复制 `.env.example` 为 `.env.local`（或按部署方式设置真实环境变量）：

- `BACKEND_BASE_URL`：后端 FastAPI 服务的基础 URL，默认
  `http://127.0.0.1:8000`；只在服务端读取（无 `NEXT_PUBLIC_` 前缀），不会被打包
  进浏览器端代码。

## 后续变更要求

再次改变框架、包管理器、测试方式或跨端调用路径时，在同一变更中：

`POST /api/chat/chancellor-consult` 是 `/study` 的受认证同源咨询 BFF。它只在服务端把
`courtos_session` 转为 Bearer session 并调用后端独立咨询端点；不得复用下旨 BFF，
不得把后端地址或 session 暴露给浏览器。咨询历史按 ADR 0032 仅保存在当前浏览器
localStorage 中，并使用服务端认证得到的公开 `user.id` 隔离；不得使用用户名、邮箱、
session 或客户端输入作为隔离键，也不得把咨询写入史馆或后端业务存储。

1. 用最小原型验证关键假设。
2. 在 `docs/decisions/` 记录选择和取舍。
3. 更新本文件，登记准确的 setup、lint、typecheck、test、build/run 命令，并接入
   CI。
4. 保持 `src/lib/backendClient.ts` 与 UI 解耦，确保成功/失败两条路径都能在无
   浏览器、无常驻服务的 CI 环境里重复运行。

## 会计报告成果下载

- `/study` 只展示后端成功回奏中严格校验后的可选 `artifacts`；普通回奏继续使用空列表，不推断或自行生成成果。
- 浏览器下载只访问同源 `GET /api/report-artifacts/{id}`。该 BFF 在服务端转发 `courtos_session`，不向浏览器暴露 Bearer session、FastAPI 地址或文件路径。
- BFF 只允许安全成果 ID，只接受 XLSX MIME 与固定安全响应头；401、404、503 使用脱敏稳定错误，跨 owner 的 404 不透露成果是否存在。
- UI 每个成果渲染一个可访问下载链接，使用 `encodeURIComponent` 编码 opaque ID；前端不预取工作簿，也不读取真实财务数据。
