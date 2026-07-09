# API 契约

前端不再拥有运行时 BFF 层。不要新增 `src/app/api/**` route handler 来承接生产运行逻辑或代理运行服务。

## 当前原则

- 浏览器数据通过类型化前端 adapter 调用明确 API 或外部来源。
- 运行事实源以根级 manifest、API 契约和明确验证输出为准。
- 前端可以做展示、编排入口、错误态和 source label，但不能伪造运行执行结果。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `EXTERNAL_RUNTIME_API_URL` | 服务端访问运行 API 的 base URL |
| `NEXT_PUBLIC_EXTERNAL_RUNTIME_API_URL` | 浏览器可见的运行 API base URL，需谨慎暴露 |
| `NEXT_PUBLIC_CHAOTANG_API_URL` | 朝堂 API base URL |
| `NEXT_PUBLIC_API_MODE` | real / mixed / demo 等模式控制 |

## Source Label

| 标签 | 含义 |
| --- | --- |
| LIVE | 真实运行、真实模型、真实记录或真实 API 响应 |
| MIXED | 有真实来源，但存在 fallback、缓存或部分样例 |
| DEMO | 静态样例、fixture、mock 或说明性流程 |
| FALLBACK | 主来源不可用后的降级结果 |

UI 展示运行数据时，应把 source label 带到 view model 或页面说明中。

## 禁止事项

- 禁止用前端 mock 证明运行服务质量。
- 禁止用本地 route handler 临时代理来绕过 API 契约。
- 禁止把运行器、供应方 key、运行记录或质量基线搬到前端。
- 禁止把运行服务不可达时的样例数据标为 LIVE。
