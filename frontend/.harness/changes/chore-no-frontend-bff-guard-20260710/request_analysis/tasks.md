# 任务拆解

## 任务 1：cherry-pick 原始 BFF guard 变更

- 目标：把 `feature-changtang-ext` 分支孤儿提交 `cb2b8b99` 的检查逻辑和文档落地到 `feature-chaotang-ext`。
- 输入：`git cherry-pick cb2b8b99`。
- 输出：`frontend/scripts/harness-doctor.mjs` 新增两项检查；5 处规则/wiki 文档同步更新。
- 验收：`git cherry-pick` 冲突已全部解决（仅 1 处文档冲突，两侧内容互补合并），`node scripts/harness-doctor.mjs` 0 errors。
- 依赖：无。

## 任务 2：补齐失败路径回归测试

- 目标：证明两项检查真的会在违规时报错，不是只在干净仓库下跑通了事。
- 输入：`frontend/scripts/harness-doctor.mjs` 的 `appApiDir` 与 `collectForbiddenRouteHandlers` 检查。
- 输出：`frontend/scripts/harness-doctor.nodetest.ts`，3 个用例——干净仓库通过、`src/app/api/` 存在时报错、`route.ts` 存在时报错，均在 `finally` 里清理临时文件。
- 验收：正常运行 3/3 通过；把两处检查条件临时改成 `false &&` 禁用后重跑，确认恰好 2 个失败路径测试变红（证明测试不是摆设），随后恢复原文件并确认重新 3/3 通过。
- 依赖：任务 1。

## 任务 3：补齐本变更记录

- 目标：把 cherry-pick 带过来的占位模板（"待填写"、结论未定字样）替换成真实内容，让 `Status: DELIVERED` 时能通过 doctor 的占位符扫描。
- 输入：本目录下 `summary.md` 及各阶段文档。
- 输出：本文件、`summary.md`、`coding/coding_report_v1.md`、`ci_result/ci_summary.md` 等全部填入真实信息。
- 验收：`node scripts/harness-doctor.mjs` 对本 change 目录不再报 `DELIVERED but contains placeholders`。
- 依赖：任务 1、任务 2。
