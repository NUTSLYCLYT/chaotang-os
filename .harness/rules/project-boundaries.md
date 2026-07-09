# 规则：项目边界

## 主线

| 主线 | 路径 | 拥有 | 不拥有 |
| --- | --- | --- | --- |
| 前端 | `frontend/` | Next.js UI、浏览器工作流、前端契约、视觉/发布门禁 | 后端蜂群执行、prompt、provider、生产数据库逻辑 |
| 后端 | `backend/` | 蜂群执行、运行时 prompt、flow engine、provider 路由、后端 harness | 浏览器 UI、Next.js 构建产物、前端发布页面 |
| 根项目 | `.harness/`、`docs/` | 跨线协调、架构清单、所有权边界 | 运行时业务逻辑 |

## Harness 术语

- 根 `.harness/`：整个项目的工程操作系统。
- `frontend/.harness/`：前端线的工程操作系统。
- `backend/harness/`：后端运行/评测 harness 包。

不要把一个层级的证据拿去证明另一个层级，除非契约明确说明证据如何跨边界传递。

## 证据规则

- 前端声明需要浏览器、构建或类型检查证据。
- 后端蜂群声明需要 harness、测试或 golden case 证据。
- 跨项目架构声明需要根 doctor 与清单证据。
- 用户可见的运行时事实必须保持 LIVE / MIXED / DEMO 边界清楚。
