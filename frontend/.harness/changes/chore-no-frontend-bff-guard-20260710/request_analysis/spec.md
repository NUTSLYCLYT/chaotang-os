# 需求说明

## 背景

原提交 `cb2b8b99`（`chore(frontend): guard against BFF layer`）于 2026-07-10 在
`feature-changtang-ext` 分支上创建，但该分支从未合入 `dev`，随分支孤儿化未落地。
2026-07-14 的仓库重复/冲突设计审计（`docs/chaotang-os-duplication-conflict-audit-2026-07-14.md`
finding medium #9）发现这是真实、未整合的工作，通过 `git cherry-pick cb2b8b99` 落地进
`feature-chaotang-ext`（commit `962c6e8`）。前端已有多条"不新增前端 BFF"的规则文档
（`frontend/AGENTS.md`、`frontend/.harness/wiki/api-contracts.md`），但此前只有文档约定，
没有 harness doctor 强制检查——规则可以被违反而不触发任何自动阻断。

## 范围

- `frontend/scripts/harness-doctor.mjs`：新增两项强制检查——`src/app/api/**` 目录禁止存在；
  `src/app/**` 下任意 `route.(ts|tsx|js|jsx)` App Router route handler 禁止存在。
- `frontend/AGENTS.md`、`frontend/.harness/rules/product-boundaries.md`、
  `frontend/.harness/rules/project-structure.md`、`frontend/.harness/wiki/api-contracts.md`、
  `frontend/.harness/wiki/architecture.md`：同步补充"doctor 会阻断 BFF 层回流"的说明。
- 本变更记录本身（此前以占位模板落地，2026-07-14 补齐真实内容）。

## 非目标

- 不新建任何 Next.js route handler 或 server action。
- 不处理仓库里其它跟 BFF 无关的 harness doctor 检查项。
- 不追溯性扫描 `src/app/**` 是否曾经存在过 BFF 代码（cherry-pick 时确认过当前仓库本来就没有）。

## 验收标准

- `pnpm harness:doctor`（即 `node scripts/harness-doctor.mjs`）在干净仓库下输出
  `[ok] no BFF directory: src/app/api` 与 `[ok] no App Router route handlers in src/app`。
- 人为制造违规（新建 `src/app/api/` 或任意 `route.ts`）时，doctor 必须以非 0 退出码报错，
  错误信息分别匹配 `BFF layer forbidden` 与 `BFF route handlers forbidden`。
- 上述两条失败路径必须有自动化回归测试覆盖，不能只靠人工验证一次。

## 风险

- 阻断规则是硬性的：如果未来确有非 BFF 用途的合法 route handler 需求，必须先走架构评审
  调整这条规则，而不是绕过 doctor。
- 误伤范围：`collectForbiddenRouteHandlers` 递归扫描整个 `src/app/`，任何文件名精确匹配
  `route.(ts|tsx|js|jsx)` 都会被拦截，不区分用途。

## 验证计划

- `cd frontend && node scripts/harness-doctor.mjs`
- `cd frontend && npx --yes tsx --test scripts/harness-doctor.nodetest.ts`
