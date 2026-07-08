# 史馆会审 NO-GO 修复报告

**日期**: 2026-06-28  
**分支**: feat/shiguan-value  
**Commit**: c0d1be7  
**Status**: DONE

---

## 验证三门结果

| 门 | 命令 | 结果 |
|---|---|---|
| `pnpm test:core` | node --experimental-strip-types | **313/319 pass**（6 预存 department-flywheel ERR_MODULE_NOT_FOUND，与本次修改无关） |
| `pnpm exec tsc --noEmit` | TypeScript typecheck | **0 errors** |
| `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-buildcheck npm run build` | Next.js build | **✓ Compiled successfully in 21.2s**，215/215 static pages |

**两个史馆 nodetest（铁律4 真测门）全绿**:
- `ok 20` — 召回 SQL 带 shiguan_archives 相关子查询 → retrospective_status 正确返回
- `ok 21` — 铁律4: buildRecallQuery SQL 包含相关子查询 shiguan_archives + retrospective_status
- `ok 22` — 铁律4·钢轨1: 无 retrospective 的旧案，映射后 retrospectiveStatus 绝不能是"达成"
- `ok 23-26` — 铁律4·钢轨2: recallBadgeLabel 四条断言

---

## HIGH-1：outcome 诚实映射（修复方法）

**根因**: `route.ts:184` 原逻辑 `row.retrospective_status === 'failed' ? 'failed' : 'success'` 只判 `'failed'`，新 UI 写中文 `'达成'/'未达成'/'部分'` 全被映射为 `'success'`，无回填的 `NULL/not_started` 也变成 `'success'`。

**修复**:

`src/app/api/court/shiguan/archive/route.ts` — 新增 `mapRetrospectiveOutcome()`:
```ts
function mapRetrospectiveOutcome(status: string | null | undefined): CaseOutcome {
  if (status === '达成') return 'success';
  if (status === '未达成') return 'failed';
  if (status === '部分') return 'blocked';
  return 'pending';  // NULL/not_started/旧英文值 → pending，不纳入成功率
}
```

`src/features/shiguan-ui/components/ShiguanPage.tsx` — 成功率只对有回填的样本算:
```ts
const filledRecords = tursoRecords.filter(
  (r) => r.retrospectiveStatus !== undefined && r.retrospectiveStatus !== 'not_started',
);
const successfulCount = filledRecords.filter((record) => record.outcome === "success").length;
const computedSuccessRate = filledRecords.length > 0
  ? Math.round((successfulCount / filledRecords.length) * 100)
  : 0;
```

---

## HIGH-2：断言入真测门（修复方法）

**根因**: `shiguan-honesty.nodetest.ts:26` 使用 `@/features/shangshufang/lib/recall-badge.ts` 别名路径，`node --experimental-strip-types` 不解析 `@/` 别名 → `ERR_MODULE_NOT_FOUND` → 4 条断言从未运行。

**修复** — 改相对路径带扩展名:
```ts
// 修复前
import { recallBadgeLabel } from '@/features/shangshufang/lib/recall-badge.ts';

// 修复后（从 src/core/courtos/archive/ 到 src/features/shangshufang/lib/）
import { recallBadgeLabel } from '../../../features/shangshufang/lib/recall-badge.ts';
```

路径验证: `src/core/courtos/archive/` → `../../../` → `src/` → `features/shangshufang/lib/recall-badge.ts` ✓

---

## MED-1：子查询去一对多（修复方法）

**根因**: `recall-guard.ts` 的 SQL 用 `LEFT JOIN shiguan_archives s ON ca.task_id = s.task_id`，`shiguan_archives.task_id` 无唯一约束，同 task 多次归档 → 一条 `court_archives` 行产生 N 行 → 召回结果重复、LIMIT 失效。

**修复** — 相关子查询替代 LEFT JOIN:
```sql
-- 修复前
SELECT ..., s.retrospective_status
FROM court_archives ca
LEFT JOIN shiguan_archives s ON ca.task_id = s.task_id
WHERE ...

-- 修复后（每 ca 行只取最新一条 retrospective_status）
SELECT ...,
       (SELECT s.retrospective_status FROM shiguan_archives s
        WHERE s.task_id = ca.task_id ORDER BY s.created_at DESC LIMIT 1) AS retrospective_status
FROM court_archives ca
WHERE ...
```

同步更新 `recall-outcome.nodetest.ts` 结构断言从 `LEFT JOIN` 改为相关子查询模式。

---

## MED-2：回填写端白名单

`src/app/api/shiguan/archives/[archive_id]/retrospective/route.ts` — 新增:
```ts
const ALLOWED_RETROSPECTIVE_STATUSES = ['达成', '未达成', '部分', 'not_started'] as const;
```
非法值返回 HTTP 400。默认值从旧的 `'updated'` 改为 `'not_started'`（语义正确）。

---

## MED-3：mapRecallRow 抽纯函数（留 TODO）

**原因**: `archive-store.ts` 有 `import 'server-only'`，且 `PriorCase` 类型定义在该文件。抽取 `mapRecallRow` 需把类型移出 server-only 文件，scope 超出本次 fix。已在 `archive-store.ts` 加 TODO 注释说明。

---

## LOW-1：空态 CTA 误报

`ShiguanPage.tsx` 空态判断:
```tsx
// 修复前：只有奏折归档才能隐藏空态提示，有决策归档时仍误报
{chronicleRows.length === 0 && (

// 修复后：chronicleRows + decisionRows 都为 0 才显示空态
{chronicleRows.length + decisionRows.length === 0 && (
```

---

## 不改（IDOR）

`shiguan_archives` 无 `user_id`，写端只判会话不判归属。已在 `retrospective/route.ts` 加 `TODO(IDOR)` 注释，标明需 schema 加 `user_id` 列后补校验，本 v1 不改 schema。

---

## 改动文件列表

| 文件 | 改动类型 |
|---|---|
| `src/app/api/court/shiguan/archive/route.ts` | HIGH-1 outcome 映射 |
| `src/features/shiguan-ui/components/ShiguanPage.tsx` | HIGH-1 成功率 + LOW-1 空态 |
| `src/core/courtos/archive/shiguan-honesty.nodetest.ts` | HIGH-2 import 路径修复 |
| `src/core/courtos/archive/recall-guard.ts` | MED-1 子查询 |
| `src/core/courtos/archive/recall-outcome.nodetest.ts` | MED-1 同步更新断言 |
| `src/app/api/shiguan/archives/[archive_id]/retrospective/route.ts` | MED-2 白名单 + IDOR TODO |
| `src/core/courtos/archive/archive-store.ts` | MED-3 TODO 注释 |
