# 实现报告 v1

## 改动

- 新增 `frontend/src/features/command-center/junjichu/model/*`：`JunjichuPageView`、状态机、来源标签、动作策略。
- 新增 `frontend/src/features/command-center/junjichu/api/*`：蜂群产线、治理放行、史馆知识回流前端 client。
- 新增 `frontend/src/features/command-center/junjichu/hooks/*`：页面 view model、蜂群运行、史馆旧案搜索 hook。
- 新增 `frontend/src/features/command-center/junjichu/components/*`：来源徽标、质量门、五键裁决、蜂群产线、史馆飞轮，以及左/中/右栏目标组件。
- 修改 `frontend/src/app/(dashboard)/junjichu/page.tsx`：生成 `junjichuViewModel`，并把状态机/缺证/人工门、质量门/裁决、蜂群/史馆模块嵌入现有三栏。
- 新增 `frontend/src/app/(dashboard)/command-center/page.tsx`，恢复 `/command-center` 军机处入口。
- 更新 `AuthGate` 与 `middleware`，让 `/command-center` 与 `/junjichu` 一样作为公开军机处页面访问。

## 取舍

- 保持 `EdictStage` 卷轴作为中栏主视觉，没有改成普通卡片。
- `page.tsx` 的三栏槽位已经改为专属三栏组件挂载；历史辅助函数仍保留给案卷、会审室和旧视图兼容。
- `/api/swarm-runs` 采用 normalize 防御字段差异，未把本地推演冒充真实 run。

## 验证

- `pnpm exec tsc --noEmit` 通过。
- `NEXT_PUBLIC_API_MODE=real pnpm build` 通过。
- Playwright 打开 `/chaotang/junjichu` 与 `/chaotang/command-center`，均返回 200，页面可见质量门、五键裁决。
- 320 / 768 / 1440 宽度均无横向溢出。
