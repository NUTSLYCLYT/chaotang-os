# 产品与工程边界

朝堂 OS 是唯一项目主线。`frontend/` 是前端体验线，不是整个项目，也不是运行服务线。

| 责任线 | 当前路径 | 职责 |
| --- | --- | --- |
| 前端体验线 | `frontend/` | 页面、组件、浏览器工作流、前端契约、发布门禁、视觉证据 |
| 根级协调层 | `../.harness/` | 跨线边界、项目 manifest、根级 doctor、变更审计 |
| 运行证据引用 | 根级 manifest / API 契约 | 只记录来源，不展开服务端实现 |

`CourtOS` 是朝堂 OS 内部决策协议/内核名，不是第三条产品线。

## 前端拥有

- `src/app/**` 页面与路由。
- `src/features/**` 前端功能 UI 与工作流。
- `src/core/**` 中不触碰真实产线资产的前端领域逻辑。
- `src/lib/**` 中的前端适配器、类型、工具和 view model。
- `e2e/**`、浏览器验证、截图证据和发布门禁。
- `frontend/.harness/**` 前端工程 harness。

## 前端不拥有

- 非前端运行事实和质量基线。
- 非前端评测资产、运行账本、质量门禁和生产执行逻辑。
- 对外承诺、报价、BOM、供应商锁定、安全建议等真实产线不可逆动作。
- BFF 层、API route handler、运行服务代理、服务端编排入口或任何把后端能力包进 `frontend/src/app/api/**` 的实现。

## BFF 禁令

前端不得新增、恢复或迁移 BFF 层。具体禁止：

- 禁止创建 `src/app/api/**`。
- 禁止创建 `src/app/**/route.ts`、`route.tsx`、`route.js` 或 `route.jsx`。
- 禁止用 Next.js route handler 临时代理后端、拼装运行结果、隐藏真实 API 契约或绕过跨线边界。
- 禁止把后端 provider key、运行 prompt、蜂群编排、质量基线、运行账本或生产执行逻辑放入前端。

需要服务端能力时，应在后端线实现明确 API，并由前端通过类型化 adapter 调用。

## 运行事实引用

当前端展示运行事实时，必须指向明确来源：

- API 契约。
- 根级 manifest 登记的验证来源。
- API 契约、doctor 或运行报告输出。
- 明确标注为 MIXED、DEMO 或 FALLBACK 的样例数据。

无法证明来源时，不得标记为 LIVE。
