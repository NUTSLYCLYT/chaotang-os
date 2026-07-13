# 实现报告 v1

## 改动

- `frontend/scripts/harness-doctor.mjs`：新增两项检查——`src/app/api/` 目录存在即报错；
  递归扫描 `src/app/` 下任意 `route.(ts|tsx|js|jsx)` 文件，存在即报错并列出具体路径。
- 该逻辑通过 `git cherry-pick cb2b8b99`（原提交于 2026-07-10 在 `feature-changtang-ext`
  分支创建，从未合入 dev）落地，非本轮新写。
- `frontend/AGENTS.md`、`frontend/.harness/rules/product-boundaries.md`、
  `frontend/.harness/rules/project-structure.md`、`frontend/.harness/wiki/api-contracts.md`、
  `frontend/.harness/wiki/architecture.md`：同步补一句"doctor 会阻断 BFF 层回流"的说明，
  跟已有的"不新增前端 BFF"规则文字呼应。
- Cherry-pick 时 `frontend/.harness/wiki/api-contracts.md` 出现 1 处文档冲突（HEAD 侧写了
  "不新增前端 BFF" 的规则条目，cb2b8b99 侧写了"doctor 会阻断"的执行说明），两侧内容互补，
  手动合并保留了双方文字，未丢弃任何一边。

## 取舍

- 检查逻辑按精确文件名 `route.(ts|tsx|js|jsx)` 匹配，不做内容语义分析——简单、确定性强，
  代价是无法识别改名规避（如 `route.mjs`），但 Next.js App Router 本身只认这几个精确文件名，
  改名规避的文件根本不会被 Next.js 当作 route handler 生效，所以不构成漏洞。
- 没有引入白名单/例外机制。当前约定是前端零 BFF，如果未来出现合法例外需求，应该走架构评审
  显式修改这条规则，而不是预留一个绕过口子。

## 验证

- `node scripts/harness-doctor.mjs`：0 errors，含 `[ok] no BFF directory: src/app/api` 与
  `[ok] no App Router route handlers in src/app`。
- 新增 `frontend/scripts/harness-doctor.nodetest.ts`，见 `unit_test/test_plan.md` 与
  `ci_result/ci_summary.md`。
