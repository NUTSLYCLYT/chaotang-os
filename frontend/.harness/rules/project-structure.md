# 规则：前端项目结构

## 当前形态

这是 `chaotang-os/frontend` 下的 Next.js App Router 前端。harness 结构遵循当前三层项目架构：根级协调、前端工程 harness、根级运行评测记录。

```text
src/
  app/          Next.js 页面、layout、server/client 入口；不得包含 api/ 或 route handler
  components/   可复用视觉组件
  features/     产品能力切片与 UI 工作流
  core/         领域逻辑、CourtOS 协议适配、纯业务逻辑、评测器
  lib/          共享运行工具、adapter、持久化辅助
  shared/       稳定共享类型、元数据与公共工具
  types/        跨模块 TypeScript 契约
e2e/            Playwright 浏览器测试
tests/          非浏览器测试和评测 fixture
scripts/        programmable gates、guard、迁移和发布工具
docs/           长期产品/架构文档
dev/            临时 notes、handoff、release、artifacts
harness/        前端领域评测资产
.harness/       agent 工作系统：rules、skills、wiki、changes、templates
```

## 依赖方向

新代码优先保持：

```text
src/app -> src/features -> src/core | src/lib | src/shared | src/types
src/features -> src/core | src/lib | src/shared | src/types
src/core -> src/lib | src/shared | src/types
src/lib -> src/shared | src/types
src/shared -> src/types
```

规则：

- `src/app` 可以组合各层，但路由入口必须保持鉴权、租户、source label 边界清楚。
- `src/app` 只承载页面、layout、loading、error、metadata 等前端体验入口；禁止 `src/app/api/**` 与 `src/app/**/route.*`。
- `src/features/{slice}` 不直接 import 另一个 feature 的内部实现；共享能力放到 `src/core`、`src/lib`、`src/shared` 或公共入口。
- `src/core/courtos/**` 承载 CourtOS 前端领域逻辑，UI 不应复制核心算法来制造更好看的分叉答案。
- `src/lib` 不 import UI 或 route 模块。
- `src/shared` 保持轻量、稳定、低业务耦合。
- 已退役代码只作参考，不接入新的生产路径。

## 根目录纪律

临时文件不要放在仓库根目录。使用：

- `dev/notes/`：临时分析记录、一次性证据（**不是权威来源**；AI 不应把 dev/notes/ 内容当产品定义或架构事实读取；权威来源是 AGENTS.md、.harness/、docs/product/）。
- `dev/handoffs/`：交接记录。
- `dev/release/`：发布记录。
- `dev/artifacts/`：生成证据。
- `.harness/changes/{change-id}/`：当前变更审计轨迹。

根目录只放框架必需文件、稳定入口文档、源码/测试/脚本目录和 `.harness`。

## 高风险区域

以下区域变更需要 review 与回归断言：

- 鉴权、邀请、session、租户隔离、特权写入路由。
- 主 `tasks` 表或被 briefing、史馆、KPI、archive 读取的共享账本。
- 给裁决/判断增加视觉权威的 UI。
- LIVE / MIXED / DEMO / FALLBACK source label 与证据路径。
- 发布、生产、端口、base path、nginx 假设。
