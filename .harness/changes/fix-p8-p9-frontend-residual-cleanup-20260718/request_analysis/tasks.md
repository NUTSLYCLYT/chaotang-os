# 任务：fix-p8-p9-frontend-residual-cleanup-20260718

## 任务 1：删除零引用翰林 mock

- 目标：清除 P12 合并时遗留的不可达 DEMO/mock 数据文件。
- 前置条件：基点锁定 P13 远端 `6ee6d8d`；删除前生产源码引用扫描为零。
- 输入：`hanlin-home-mock.ts` 355 行静态 mock。
- 输出：该文件从候选树删除。
- 涉及文件：`frontend/src/features/hanlin/lib/hanlin-home-mock.ts`。
- 状态 / 数据变化：无运行态变化；仅删除不可达源码。
- 验证命令与证据：`rg` 零命中、Hanlin tests、tsc、REAL build。
- 回滚边界：恢复该文件；不涉及 API 或数据迁移。
- 完成定义：删除后类型与构建通过，生产引用仍为零。

## 任务 2：锁定尚书房 canonical completion endpoint

- 目标：防止生产调用回退到旧 court-prefixed 路径。
- 前置条件：生产调用已直读确认使用 canonical 路径。
- 输入：`ShangshufangPage.tsx` 当前 `backendFetch` 调用。
- 输出：`finance-intel-loop-path.nodetest.ts`。
- 涉及文件：新增单个 node test；不改生产页面。
- 状态 / 数据变化：仅测试。
- 验证命令与证据：相关 8 tests passed。
- 回滚边界：移除新增测试。
- 完成定义：匹配 canonical 路径并拒绝旧路径。

## 任务 3：候选收口

- 目标：形成只含一个 root change 的 Packet P14 实现提交 H。
- 前置条件：任务 1–2 完成。
- 输入：2 个前端残余 diff 与本 change 证据。
- 输出：type/build/doctor/diff 全绿的本地候选。
- 涉及文件：任务 1–2 文件和本 change 目录。
- 状态 / 数据变化：Git candidate；不推送。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：提交后 `git revert`；禁止重写共享历史。
- 完成定义：无旧 packet、无运行产物、无生产实现改动，等待 Claude 精确 SHA 复审。
