# Task 8 Report — 户部 auto-raise BFF 路由

**Status:** DONE
**Commit:** 6ac5119
**Branch:** feat/dept-flywheel-v1

## Steps Completed

### Step 1: 创建路由文件
`src/app/api/court/hubu/auto-raise/route.ts` 已创建，逐字取自计划代码。

路由逻辑：
- `runtime = 'nodejs'`（非 edge）
- `POST` 处理器取 `process.env.FLYWHEEL_KEY`，若设置则验证 `x-flywheel-key` 请求头，不匹配返回 401
- 调 `listPrimaryTasks({ status: 'pending', limit: 100 })` 取候选任务
- 映射为 `SourceTask[]`（`raw_command` → `command`，`updated_at` → `updatedAt`）
- 调 `loadLedger('hubu')` 取去重台账
- 调 `runFlywheel(hubuHooks, HUBU_FLYWHEEL_CONFIG, { tasks, ledger, raise: raiseDraft })` 执行飞轮
- 返回 `FlywheelRunResult` JSON

Imports（均已存在于本 worktree）：
- `@/lib/db/primary-store` → `listPrimaryTasks`
- `@/core/courtos/department-flywheel/run-flywheel` → `runFlywheel`
- `@/core/courtos/department-flywheel/ledger` → `loadLedger`
- `@/core/courtos/department-flywheel/raise` → `raiseDraft`
- `@/core/courtos/department-flywheel/hubu/hooks` → `hubuHooks`
- `@/core/courtos/department-flywheel/hubu/config` → `HUBU_FLYWHEEL_CONFIG`
- `@/core/courtos/department-flywheel/types` → `SourceTask` (type)

### Step 2: 类型门 + 构建门

```
pnpm exec tsc --noEmit   → 0 errors (clean)
NEXT_DIST_DIR=.next-buildcheck npm run build → ✓ Compiled successfully in 19.5s
                                              → ✓ Generating static pages (229/229)
```

### Step 3: 提交

```
git commit -m "feat(flywheel): 户部 auto-raise BFF 路由"
commit 6ac5119
```

## 铁律符合性

| 铁律 | 状态 |
|------|------|
| 铁律1 鉴权门在写入门 | ✅ `x-flywheel-key` 验证在同一路由，写入经 `raiseDraft` → `upsertPrimaryTask` |
| 铁律4 高危写入双门 | ⚠️ Task 11 会做独立会审（本 Task 8 只建路由，Task 11 Step 1 负责 code-reviewer 会审） |
| 铁律13.2.9 前端咨询性质 | ✅ 路由为 cron 内网调用入口，触碰真实 tasks 主库经 `upsertPrimaryTask` SSOT |
| 铁律15 不自动提交/推送 | ✅ 用户明确要求后才提交 |
| 严禁 `department_learning_` 前缀 | ✅ taskId 前缀由 `buildRaiseInput` 保证为 `dept_raise_` |
| 来源标 `real` | ✅ 由 Task 7 hubuHooks.derive 负责 |
