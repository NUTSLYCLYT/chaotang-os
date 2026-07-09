# 任务：chore-v1-module-taxonomy-20260708

## 任务 1

- 目标：定义 V1 前端模块 taxonomy。
- 输入：产品路由清单与朝堂 OS 1.0 范围。
- 输出：规范一级模块与子模块映射。
- 验收：summary 与 README 列出已接受的 taxonomy。
- 依赖：无。

## 任务 2

- 目标：对齐可见导航与路由元数据。
- 输入：顶部导航、路由元数据、launch whitelist、department builders。
- 输出：只有 V1 一级模块作为 active product routes 暴露。
- 验收：聚焦 nodetest 通过。
- 依赖：任务 1。

## 任务 3

- 目标：移除旧 active route surface。
- 输入：旧 pages 与 redirects。
- 输出：旧 route pages 从 active surface 移走或删除。
- 验收：TypeScript 通过，旧 redirects 不再定义 V1 信息架构。
- 依赖：任务 2。

