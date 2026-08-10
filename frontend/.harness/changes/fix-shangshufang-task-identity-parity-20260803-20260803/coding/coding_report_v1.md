# 实现报告 v1

## 改动

- ShangshufangPage.tsx：confirm 后绑定 task_id；canonical 回奏优先覆盖旧展示；刷新失败不反向宣称下旨失败。
- canonical-memorial-view.ts：增加 canonical kind/source 读取器。
- shangshufang-real-loop.spec.ts：增加可配置、显式 opt-in 的真实闭环测试。
- 未修改后端、数据库、3050 或用户未跟踪资料。

## 取舍

- 保留 EXT 合同交付能力，不合并 dev-ext-test 整支历史。

## 验证

- focused tests、TypeScript、真实 E2E 和 Harness Doctor 均通过。
