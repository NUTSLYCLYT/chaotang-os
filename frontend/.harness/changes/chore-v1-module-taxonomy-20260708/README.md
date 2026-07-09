# chore-v1-module-taxonomy-20260708

## 意图

将可见的前端信息架构对齐到朝堂 OS 1.0。

一级模块：

- 大殿
- 上书房
- 军机处
- 六部
- 诸司
- 史馆

V1 子模块：

- 诸司：锦衣卫
- 六部 / 户部：预算、出纳
- 六部 / 礼部：任免、招聘
- 六部 / 礼部礼制：暂缓
- 六部 / 兵部：报价、线索
- 六部 / 刑部：合同
- 六部 / 工部：产研

## 范围

- 新增前端 V1 模块与 office 暴露的单一事实源。
- 更新顶部导航与路由元数据，只暴露 V1 一级模块。
- 从 `src/app` 移除旧 active pages，只保留 V1 路由面以及 auth / invite / 外部 API 入口。
- 删除 `dev/_attic` 下旧 `page.tsx` 路由归档。
- 移除 `next.config.ts` 中旧路径 redirects，例如 `/throne`、`/overview`、`/manor-dept/*`、`/departments/*`。

## 验证

- `pnpm exec tsc --noEmit`
- `npx --yes tsx --test src/features/court-console/lib/launch-whitelist.nodetest.ts src/features/departments/lib/department-page-view-builder.nodetest.ts src/features/departments/lib/department-vitrine.nodetest.ts`

