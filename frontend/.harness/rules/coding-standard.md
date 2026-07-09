# 规则：前端编码标准

## TypeScript

- 新代码默认写类型，不用 `any` 逃避契约。
- 跨模块数据必须有明确类型来源。
- 共享类型优先放在 `src/lib`、`src/shared` 或 `src/types` 的既有契约位置。

## 数据边界

- 外部数据进入应用时，要在边界做校验或归一化。
- 新契约优先使用 Zod 或项目已有 schema 工具。
- LIVE / MIXED / DEMO / FALLBACK 必须在 view model 或页面状态中保持清楚。

## Next.js

- 当前前端使用 Next.js 16 App Router。
- 不新增前端自有 BFF route handler。运行事实归明确 API 契约、运行证据或根级项目文档。
- 页面、layout、server action、client component 的边界要清楚。
- 需要浏览器状态或交互时才使用 client component。

## UI

- 保持现有设计 token、全局 CSS 和组件风格，除非任务明确要求改设计系统。
- 能融回主闭环页面的能力，不新增独立页面。
- 不用 demo 视觉权重伪装真实能力。
- 高风险裁决、签字、发布、报价等状态必须有清晰风险提示。

## 测试

- 行为改动优先补行为测试。
- 用户可见流程优先 Playwright。
- 纯函数或 adapter 优先小范围 node/unit 测试。
- 现有 guard 是产品 harness 的一部分；删除 guard 必须提供等价保护。
