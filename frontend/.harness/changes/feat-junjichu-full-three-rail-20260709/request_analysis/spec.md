# 需求说明

## 背景

用户要求按根级实施方案 100% 推进军机处三栏承载：不改变左 / 中 / 右结构，中栏继续显示卷轴，同时把接案、路由、会审、蜂群、质量门、补证、裁决、治理等待、归档复盘体现到军机处页面。

## 范围

- 新增军机处页面级 view model、状态机、动作策略。
- 新增 `/api/swarm-runs`、governance proceed、archive search / feedback 的前端 client。
- 新增质量门、五键裁决、蜂群产线、史馆飞轮等可见组件。
- 在现有军机处三栏中嵌入状态机、缺证/人工门、质量门/裁决、蜂群/史馆模块。
- 新增 `/command-center` 路由 alias，并从退休路由/登录拦截中恢复为公开军机处入口。
- 保持中栏 `EdictStage` 卷轴为主视觉。

## 非目标

- 不新增顶层页面。
- 不修改后端路由实现。
- 不把军机处改成 dashboard。
- 不移除 `view=council` / `view=cases` 分流。

## 验收标准

- `/chaotang/junjichu` 能打开。
- 中栏仍保留卷轴。
- 页面可见“军机处状态机”“质量门”“五键裁决”。
- 右栏在真实案态下可见蜂群产线和史馆飞轮入口。
- 320 / 768 / 1440 宽度无横向溢出。
- TypeScript 和 production build 通过。

## 风险

- `page.tsx` 历史体量较大，直接大拆风险高；本轮采用增量嵌入。
- 后端 `/api/swarm-runs` 字段可能变化，client 做 normalize 降低组件耦合。
- `/command-center` 与 `/junjichu` 共用同一页面实现，后续若做导航命名统一，需要同步全局路由配置文案。

## 验证计划

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- Playwright 打开 `/chaotang/junjichu` 与 `/chaotang/command-center` 并检查 320 / 768 / 1440 宽度。
