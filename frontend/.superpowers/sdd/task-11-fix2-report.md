# Task 11 Fix 2 — 飞轮自反馈放大环修复报告

## Bug 描述

`runFlywheel` 在调用 `hooks.selectCandidates(deps.tasks)` 时，传入的是未经过滤的原始任务列表。
飞轮自产的"待决项"（如 `dept_raise_hubu_xxx`）会写回主库 `tasks` 表，下次飞轮运行时这些任务又被当成候选来源，进而产出以另一个 `dept_raise_*` 任务作为 `sourceTaskId` 的新待决项，形成自反馈放大环，无限自我增殖。

## 修改文件

- `src/core/courtos/department-flywheel/run-flywheel.ts`
- `src/core/courtos/department-flywheel/run-flywheel.nodetest.ts`

## 修复方案

### run-flywheel.ts

1. 在顶部新增导出常量 `NON_FLYWHEEL_SOURCE_PREFIXES`，列出三类禁止作为候选来源的 id 前缀：
   - `dept_raise_` — 飞轮自产待决项
   - `department_learning_` — 部门学习产物
   - `qintian_learning_` — 钦天监学习产物

2. 在 `hooks.selectCandidates` 调用之前，先对 `deps.tasks` 做前缀过滤，产出 `eligibleTasks`：

```typescript
const eligibleTasks = deps.tasks.filter(
  (t) => !NON_FLYWHEEL_SOURCE_PREFIXES.some((p) => t.id.startsWith(p))
);
const candidates = hooks.selectCandidates(eligibleTasks);
```

3. `res.scanned` 仍保留 `deps.tasks.length`（记录收到的总任务数），只有候选来源收窄。

### run-flywheel.nodetest.ts

新增回归测试 "runFlywheel: 自产待决项(dept_raise_* 等前缀)不得被当候选来源,防自反馈放大环"：

- 构造一条 `id: 'dept_raise_hubu_xxx'`、命令含"万"的任务（若不过滤它会通过 selectCandidates + passesThreshold 并产出）
- 将其混入合法任务列表 `[t1, t2, dept_raise_hubu_xxx]`
- 断言：`res.raised` 中不含以 `dept_raise_hubu_xxx` 为 `sourceTaskId` 的条目
- 断言：合法候选 `t2` 仍正常产出（共 1 条）
- 断言：`res.scanned === 3`（总数含自产项）

## 验证结果

| 门 | 结果 |
|---|---|
| `npm run test:node` | 413/413 pass, 0 fail |
| `pnpm exec tsc --noEmit` | 0 errors |
| `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-buildcheck npm run build` | 成功，0 errors |

## Commit

```
7e23e61 fix(flywheel): 排除自产待决项作候选(堵自反馈放大环)
```

2 files changed, 36 insertions(+), 1 deletion(-)
