# Task-11 会审修复报告（2026-06-28）

## 状态：DONE

## commit
- `b006bb6` fix(flywheel): 会审修复 C1鉴权/C2铁律4污染/H1H2功能/M1M3稳定性

## 三门结果
| 门 | 结果 |
|---|---|
| `npm run test:node` | ✅ 412 pass / 0 fail（含新增 7 条断言） |
| `pnpm exec tsc --noEmit` | ✅ 0 error |
| `npm run build` | ✅ 成功，.next-buildcheck/server 目录生成 |

---

## 逐条修复明细

### C1 · 鉴权 fail-closed (`auto-raise/route.ts`)
**问题**：`if (required && ...)` → KEY 未设则放行（公网裸 POST 可刷主库）。
**修复**：改为 `if (!required || ...)` → KEY 未配置或不匹配一律 401 fail-closed。
**附**：`run-hubu-flywheel.sh` 新增 FLYWHEEL_KEY 必填注释。

### H1 · 候选状态值 (`auto-raise/route.ts`)
**问题**：`listPrimaryTasks({ status: 'pending' })` 恒 0 行；用户任务入库为 `submitted`。
**修复**：改为 `{ status: 'submitted' }`。

### H2 · 行字段驼峰错配 (`auto-raise/route.ts` + 新文件)
**问题**：`listPrimaryTasks` 返回 `toBackendTask` 驼峰对象（`rawCommand`/`updatedAt`），旧代码读 `raw_command`/`updated_at`（snake_case）→ `command` 恒空。
**修复**：
- 提取纯函数 `rowToSourceTask` 至 `row-to-source-task.ts`（无 next/server 依赖）
- 正确映射 `rawCommand → command`
- 新增 `row-to-source-task.nodetest.ts`（3 条断言，含"不读 snake_case 旧字段"回归）

### C2 · 铁律4 读侧断言（`briefing-queries.ts` + `briefing/route.ts`）
**问题**：`dept_raise_` 飞轮自动任务进主库后会：
  1. 污染人工 KPI（pendingCount/taskTotal 计入飞轮待决）
  2. `petitioner`/`reporter` 硬编码为"朝堂任务系统/丞相"冒充人工

**修复**：
1. **KPI 分流**：`briefing-queries.ts` 新增：
   - `DEPT_RAISE_TASK_ID_PREFIX = 'dept_raise_'`
   - `HUMAN_KPI_EXCLUDE_FILTER`（学习记录 + dept_raise_ 三前缀）
   - `PRIMARY_HUMAN_STATS_SQL`（替换旧 `PRIMARY_STATS_SQL`，仅统计真人工任务）
   - `isAutoRaiseTask(id)` 纯函数
   - `flywheelDeptName(dept)` 纯函数（hubu→户部 等 6 个映射，未知透出 code）
   - `PRIMARY_STATS_SQL` 保留并标 `@deprecated`
2. **来源角标**：`briefing/route.ts` 两处 memorial-building 均改为：
   - `isAutoRaiseTask(id)` 判断后设 `petitioner = '户部(部门派生)'`、`reporter = '飞轮'`
   - 非自动任务保留原 `'朝堂任务系统'` / `'丞相'`
3. **stats SQL 切换**：GET handler 中 `db.execute(PRIMARY_STATS_SQL)` 改为 `db.execute(PRIMARY_HUMAN_STATS_SQL)`

**C2 读侧断言（铁律4 强制）**：新增 4 条 nodetest 钉在 `briefing-queries.nodetest.ts`：
- `dept_raise_ 不计入人工 KPI 但仍出现在奏折列表`（真实 libsql DB 跑）
  - ① `PRIMARY_HUMAN_STATS_SQL.total/pending` 不计 `dept_raise_` → 通过
  - ② `PRIMARY_MEMORIAL_TASKS_SQL` 含 `dept_raise_` → 通过
- `isAutoRaiseTask 正确识别自动派生任务`（4 个断言）
- `flywheelDeptName 返回正确中文部门名`（4 个断言含 fallback）
- `HUMAN_KPI_EXCLUDE_FILTER 覆盖学习记录与飞轮三类前缀`（结构门）

### M1 · 去重精确查询 (`ledger.ts` + `run-flywheel.ts`)
**问题**：`loadLedger LIMIT 500` → 老条目超量时溢出漏重。
**修复**：
- `ledger.ts` 新增 `hasRaised(dept, sourceTaskId, contentHash): Promise<boolean>`（`SELECT 1 ... LIMIT 1` 精确查询）
- `run-flywheel.ts`：`Deps` 接口新增可选 `hasRaised?`，`ledger?` 改可选（兼容现有测试）；`runFlywheel` 逻辑：`hasRaised` 有则精确查询，否则回退 `isDuplicate` 内存比对
- `auto-raise/route.ts`：传 `hasRaised` 替代 `loadLedger`，移除 `loadLedger` 依赖

### M3 · 顶层 try/catch (`auto-raise/route.ts`)
**修复**：整个 POST handler 包 try/catch，主库不可达/建表失败返回 `{ error: 'flywheel-error', detail: ... }` + 500，不漏堆栈。

### LOW · cron 脚本 (`scripts/flywheel/run-hubu-flywheel.sh`)
- 加 `mkdir -p "$HOME/.gstack"`（tee 前路径保证）
- 新增 FLYWHEEL_KEY 必填说明注释

---

## C2 读侧断言详述（铁律4 特别说明）

断言位置：`src/app/api/court/shangshufang/briefing-queries.nodetest.ts`

```
test('briefing: dept_raise_ 不计入人工 KPI 但仍出现在奏折列表', async (t) => {
  // 构造 libsql 内存 DB
  // 插入: task_human_submitted(submitted) + dept_raise_hubu_abc123(pending)
  // ① PRIMARY_HUMAN_STATS_SQL.total==1, pending==1（飞轮不计）✅
  // ② PRIMARY_MEMORIAL_TASKS_SQL 包含 dept_raise_hubu_abc123 ✅
});
test('isAutoRaiseTask 正确识别自动派生任务')  // 4 断言 ✅
test('flywheelDeptName 返回正确中文部门名')   // 4 断言 ✅
test('HUMAN_KPI_EXCLUDE_FILTER 覆盖三类前缀') // 结构门 ✅
```

**这条断言直接测读路径 SQL**（`PRIMARY_HUMAN_STATS_SQL` / `PRIMARY_MEMORIAL_TASKS_SQL`），不只测写侧 `buildRaiseInput`。全部通过。

---

## 变更文件清单
| 文件 | 改动 |
|---|---|
| `src/core/courtos/department-flywheel/ledger.ts` | M1: 新增 `hasRaised` 精确查询 |
| `src/core/courtos/department-flywheel/run-flywheel.ts` | M1: Deps 支持 `hasRaised`，import `contentHashOf` |
| `src/app/api/court/hubu/auto-raise/route.ts` | C1/H1/H2/M1/M3 全部修复 |
| `src/app/api/court/hubu/auto-raise/row-to-source-task.ts` | H2: 新建纯函数（无 Next.js 依赖） |
| `src/app/api/court/hubu/auto-raise/row-to-source-task.nodetest.ts` | H2: 3 条回归断言 |
| `src/app/api/court/shangshufang/briefing-queries.ts` | C2: KPI 分流 SQL + 工具函数 |
| `src/app/api/court/shangshufang/briefing/route.ts` | C2: 切换 HUMAN_STATS_SQL + 角标修复 |
| `src/app/api/court/shangshufang/briefing-queries.nodetest.ts` | C2 铁律4 读侧 4 条断言 |
| `scripts/flywheel/run-hubu-flywheel.sh` | LOW: mkdir -p + 注释 |
