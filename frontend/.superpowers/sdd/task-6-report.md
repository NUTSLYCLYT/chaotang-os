# Task 6 实施报告 — 编排器 + 错误隔离

**日期**: 2026-06-28  
**Commit**: `2e52fb6`  
**分支**: `feat/dept-flywheel-v1`

---

## 状态

DONE — 两文件已提交，测试 2/2 PASS，`pnpm exec tsc --noEmit` exit 0。

---

## 实施步骤

### Step 1: 写测试 (RED)

`src/core/courtos/department-flywheel/run-flywheel.nodetest.ts`

两个测试：
1. **主流程**：`tasks=[t1(小额),t2(大额)]` → selectCandidates 留 t1+t2（含"采购"/"预算"）→ passesThreshold 过滤只留 t2（含"万"）→ derive → 无重复 → capPerRun(max=2) → raise → `res.raised=[{t2}]`
2. **错误隔离**：derive 强制抛 Error('boom') → 被 try/catch 捕获 → `res.raised.length===0`，`skipped` 含 `derive-error: boom`

### Step 2: 确认 FAIL

```
# fail 1   (模块不存在)
```

### Step 3: 写实现

`src/core/courtos/department-flywheel/run-flywheel.ts`

关键修正（相对计划代码）：`DeptId` import 提到文件顶部与其它类型一起，避免 `interface Deps` 引用前置问题。

编排逻辑：
```
candidates = hooks.selectCandidates(tasks)
  for each candidate:
    if !passesThreshold → skipped(below-threshold)
    try derive:
      null → skipped(derive-null)
      isDuplicate → deduped + skipped(duplicate)
      ok → drafts.push
    catch → skipped(derive-error: <message>)
  capPerRun(drafts, cfg)
    for each:
      try raise → raised.push
      catch → skipped(raise-error)
```

### Step 4: 验证 PASS + tsc

```
# pass 2  # fail 0   (run-flywheel.nodetest.ts)
pnpm exec tsc --noEmit → exit:0
```

### Step 5: 提交

```
[feat/dept-flywheel-v1 2e52fb6] feat(flywheel): 编排器 + 错误隔离
 2 files changed, 76 insertions(+)
```

---

## 文件摘要

| 文件 | 行数 | 角色 |
|---|---|---|
| `run-flywheel.ts` | 40 | 编排器实现（注入 tasks/ledger/raise） |
| `run-flywheel.nodetest.ts` | 36 | 主流程 + 错误隔离两测 |

---

## 依赖关系

- import `capPerRun` ← `./gate` (Task 3, 已存在)
- import `isDuplicate` ← `./dedupe` (Task 2, 已存在)
- import types ← `./types` (Task 1, 已存在)
- **不依赖真实 DB**：`raise` 注入，单测用 stub

---

## 注意事项

- `nodetest` 编辑器显示 `node:` 报警为预期噪声，tsx --test 运行无误
- 下一步：Task 7（户部钩子）、Task 8（BFF 路由）可继续在此分支推进
