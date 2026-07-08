# Task 9 执行报告：铁律4 来源可区分回归断言

## 执行摘要

| 项 | 结果 |
|---|---|
| **分支** | `feat/dept-flywheel-v1` |
| **文件** | `src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts` |
| **测试状态** | ✅ **PASS** (2/2) |
| **Commit** | `b50b957` |
| **Commit Message** | `test(flywheel): 铁律4 来源可区分回归断言` |

---

## Step-by-Step 执行过程

### Step 1：写测试文件

**文件路径**：`src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts`

测试断言两条铁律：

1. **铁律4 (部门自动项)** — 验证 `flywheel.auto=true` 字段标记自动派生项，可与人工任务区分
   - 检查 `buildRaiseInput` 返回的 `result.flywheel.auto === true`
   - 检查 `result.flywheel.dept === 'hubu'`（部门标识）

2. **铁律 (来源诚实)** — 验证 `sourceLabel` 真实反映 Draft 的 `reality` 字段，绝不伪装 LIVE
   - 当 `draft.reality === 'real'` 时，`sourceLabel === 'real'`
   - 当 `draft.reality === 'fallback'` 时，`sourceLabel === 'fallback'`（可变性验证）

**导入的依赖**（均为前序任务产物）：
- `buildRaiseInput` from `./raise`（Task 5 实现）
- `RaiseDraft` type from `./types`（Task 1 定义）

### Step 2：运行验证（PASS）

```bash
npx --yes tsx --test src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts
```

**结果**：
```
TAP version 13
# Subtest: 铁律4:部门自动项带 flywheel.auto=true,可与人工任务区分
ok 1 - 铁律4:部门自动项带 flywheel.auto=true,可与人工任务区分
# Subtest: 铁律:绝不冒充 LIVE 假数据 — sourceLabel 真实反映
ok 2 - 铁律:绝不冒充 LIVE 假数据 — sourceLabel 真实反映
1..2
# tests 2
# suites 0
# pass 2
# fail 0
```

**解释**：两个测试都通过，验证了 Task 5 中 `buildRaiseInput` 的实现已正确：
- ✅ 产出的 `result.flywheel` 含 `auto: true` 字段（Task 5 第 346 行）
- ✅ 产出的 `result.sourceLabel` 映射自 `draft.reality`（Task 5 第 344 行）

### Step 3：提交

```bash
git add src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts && \
git commit -m "test(flywheel): 铁律4 来源可区分回归断言"
```

**输出**：
```
[feat/dept-flywheel-v1 b50b957] test(flywheel): 铁律4 来源可区分回归断言
 1 file changed, 18 insertions(+)
 create mode 100644 src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts
```

---

## 验证清单

- [x] 测试文件创建在正确路径：`src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts`
- [x] 测试代码逐字符复制自计划（第 652-674 行）
- [x] 两个测试用例均通过（2/2 PASS）
- [x] 导入的 `buildRaiseInput` 和 `RaiseDraft` 来自既有模块
- [x] 测试覆盖铁律4 的两个核心断言：
  - `flywheel.auto=true` 可区分自动派生项
  - `sourceLabel` 真实反映数据来源（非伪装）
- [x] 提交信息明确指向铁律4
- [x] Commit 短哈希：`b50b957`

---

## 设计意图（铁律4 含义）

此回归断言保护两个防线：

1. **统计不污染**：生成的待决项在 `tasks` 表中标记 `auto=true`，使统计/KPI 查询可按 `flywheel.auto` 过滤，排除自动派生项对人工决策计数的污染。

2. **来源诚实**：每条派生项 `sourceLabel` 必须与其数据真实性挂钩（`real`/`fallback`/其他），禁止伪装为 LIVE 数据。这是 CLAUDE.md 铁律4 中"绝不冒充 LIVE 假数据"的执行保障。

---

## 后续（Task 10-11）

- Task 10：cron 脚本 + 手动验证（不在本报告范围）
- Task 11：独立会审 + 端到端截图（GSTACK）

本 Task 9 完成，待用户指示后续步骤。
