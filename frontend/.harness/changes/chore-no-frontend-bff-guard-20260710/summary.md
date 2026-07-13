# 变更摘要：chore-no-frontend-bff-guard-20260710

| Field | Value |
| --- | --- |
| Change ID | chore-no-frontend-bff-guard-20260710 |
| Type | chore |
| Status | DELIVERED |
| Owner | Frontend Agent |
| Created | 20260710 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | DONE | request_analysis/review/spec_review_v1.md |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | DONE | coding/review/code_review_v1.md |
| 5 | 测试计划 | DONE | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | DONE | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | DONE | 见下方"关联提交" |
| 8 | CI 验证 | DONE | ci_result/ci_summary.md |
| 9 | E2E 验证 | N/A | e2e_test/e2e_summary.md（无浏览器可见行为） |
| 10 | 部署验证 | N/A | deployment/preview_report.md（无部署产物） |
| 11 | 用户确认 | AWAITING_REVIEW | 本次补齐（测试 + 变更记录）尚未经用户逐条确认 |

## 说明

- 范围：前端入口文档、前端 harness 边界规则、项目结构规则、API 契约 wiki、架构 wiki 与 `frontend/scripts/harness-doctor.mjs`。
- 风险：阻断所有 `src/app/**/route.*`，如未来确有非 BFF 的 Next.js route handler 需求，必须先通过架构评审调整规则；当前约定下前端不允许增加 BFF 层。
- 验证：运行 `pnpm harness:doctor`，确认 `src/app/api/**` 与 `src/app/**/route.*` 会被前端 harness doctor 拦截；`npx --yes tsx --test scripts/harness-doctor.nodetest.ts` 覆盖正常路径与两条失败路径。
- 2026-07-14 补充：原 cherry-pick（commit `962c6e8`）落地时只验证过检查逻辑存在，没有失败路径回归测试，变更记录也仍是占位模板（Status: DRAFT，多数阶段 TODO）。Codex stop-time review 拦截后补齐：新增 `harness-doctor.nodetest.ts`（含反向验证测试本身有效性）、把本记录所有阶段文档从占位符替换成真实内容。

## 关联提交

| Commit | 说明 |
| --- | --- |
| `962c6e8` | cherry-pick cb2b8b99：BFF guard 检查逻辑 + 文档，落地进 feature-chaotang-ext |
| `3afc397` | 补齐失败路径回归测试 + 把本变更记录从占位模板填成真实内容 |
| `54bb9bc` | 修正回归测试清理逻辑会误删 `src/app/api/` 共享目录的问题 |
| `2d4c8c7` | 改用 `fs.mkdtempSync` 保证测试标记路径唯一，替换不可靠的 `process.pid` 命名 |

**已知缺口**：以上 4 个 commit 的提交信息里都没有带本项目约定的 `Change: chore-no-frontend-bff-guard-20260710` trailer（对照同仓库其它 commit，如
`be2f57c fix: route smoke help to canonical backend launcher` 就正确带了 `Change: fix-canonical-jiqun-smoke-start-help-20260714`）。这是本次流程遗漏，
按项目规矩不对已落地的 commit 做 `--amend`/改写历史，改为在本记录里显式建立"记录 → commit”的反向关联，并从下一个 commit 开始补上 trailer。

