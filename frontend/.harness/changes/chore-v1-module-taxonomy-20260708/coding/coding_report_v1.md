# 编码报告 v1：chore-v1-module-taxonomy-20260708

## 变更文件

- 前端模块 taxonomy 与路由元数据。
- 顶部导航与 launch whitelist。
- Department page-view 与 vitrine builders。
- Legacy route redirects 与旧 active route pages。

## 关键决策

- 以六个一级模块作为 V1 顶层信息架构。
- office 级页面作为子模块暴露，而不是新的一级模块。
- 保留鉴权、邀请和 外部 API 入口等基础设施路由。

## 验证

- `pnpm exec tsc --noEmit`
- `npx --yes tsx --test src/features/court-console/lib/launch-whitelist.nodetest.ts src/features/departments/lib/department-page-view-builder.nodetest.ts src/features/departments/lib/department-vitrine.nodetest.ts`

