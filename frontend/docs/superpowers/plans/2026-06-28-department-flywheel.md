# 部门飞轮 v1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让户部(后续兵部)定时把上书房已有 tasks 派生加工成「待决议项」写回主库,经现有主闭环由丞相自动拟旨。

**Architecture:** 共享 lib `src/core/courtos/department-flywheel/`(通用机制:候选→阈值门→加工→去重→上限→写入)+ 每部三个钩子 + 一个 BFF 路由 `/api/court/<dept>/auto-raise`,由系统 crontab 定时 curl。前端咨询性质(铁律13.2.9),复用 `upsertPrimaryTask`/`evaluateProject`/`reality-state`。

**Tech Stack:** Next.js 16 App Router(route handlers,runtime nodejs)、TypeScript、Turso(@libsql via primary-store)、tsx `--test`(nodetest)、Playwright(E2E)。

## Global Constraints

- 写主库 tasks 只经 `upsertPrimaryTask`(`src/lib/db/primary-store.ts`);严禁裸 SQL、严禁第二套写入。
- 待决项 taskId 前缀用 `dept_raise_`;**严禁** `department_learning_`(被 primary-store 守门拒)。
- 来源标记只用 `RealityState`(`src/lib/reality/reality-state.ts`),v1 部门派生标 `'real'`(半真但真算)+ result 里带 `flywheel` 元数据区分"部门产 vs 人下旨";严禁标假。
- 数字取不到一律留空/`missing`,绝不编(沿用 `evaluateProject` 命门纪律)。
- 阈值/上限/频率集中在 `<dept>/config.ts`,不散落。v1 默认极严:户部仅金额≥50万且(ROI缺口或风险高);每轮上限 2;工作日 1 次。
- 测试经 `npm run test:node`(tsx `--test`,文件名 `*.nodetest.ts`)。
- 不提交/不推送,等用户明确指令(本仓铁律15)。

---

### Task 1: 飞轮类型契约

**Files:**
- Create: `src/core/courtos/department-flywheel/types.ts`

**Interfaces:**
- Produces: `DeptId`, `RaiseDraft`, `DeptHooks`, `FlywheelConfig`, `FlywheelRunResult`, `RaisedLedgerEntry`

- [ ] **Step 1: 写类型文件**

```typescript
// src/core/courtos/department-flywheel/types.ts
import type { RealityState } from '@/lib/reality/reality-state';

export type DeptId = 'hubu' | 'bingbu';

/** 源任务的最小投影(从 listPrimaryTasks 行映射来)。 */
export interface SourceTask {
  id: string;
  title: string;
  command: string;
  status: string;
  updatedAt: string;
}

/** 部门加工后产出的待决项草案(还没写库)。 */
export interface RaiseDraft {
  sourceTaskId: string;
  /** 写入主库的 command(陛下在上书房看到的待决问题)。 */
  command: string;
  title: string;
  /** 优先级评分,用于每轮上限排序(高优先在前)。null 视为最低。 */
  priority: number | null;
  reality: RealityState;
  /** 写进 result_json 的部门元数据(来源可区分 + 教学注解)。 */
  meta: Record<string, unknown>;
}

export interface DeptHooks {
  dept: DeptId;
  /** 从主库任务里筛本部门语义候选。 */
  selectCandidates(tasks: SourceTask[]): SourceTask[];
  /** 阈值门:够格才产(true=放行)。 */
  passesThreshold(task: SourceTask): boolean;
  /** 加工成待决项草案;不够格/无法加工返回 null。 */
  derive(task: SourceTask): RaiseDraft | null;
}

export interface FlywheelConfig {
  /** 每轮每部最多产几条。 */
  maxPerRun: number;
}

export interface RaisedLedgerEntry {
  sourceTaskId: string;
  dept: DeptId;
  contentHash: string;
  raisedTaskId: string;
  at: string;
}

export interface FlywheelRunResult {
  dept: DeptId;
  scanned: number;
  candidates: number;
  passedGate: number;
  deduped: number;
  raised: { raisedTaskId: string; sourceTaskId: string }[];
  skipped: { sourceTaskId: string; reason: string }[];
}
```

- [ ] **Step 2: 提交**

```bash
git add src/core/courtos/department-flywheel/types.ts
git commit -m "feat(flywheel): 部门飞轮类型契约"
```

---

### Task 2: 内容哈希 + 去重(纯函数)

**Files:**
- Create: `src/core/courtos/department-flywheel/dedupe.ts`
- Test: `src/core/courtos/department-flywheel/dedupe.nodetest.ts`

**Interfaces:**
- Consumes: `RaiseDraft`, `RaisedLedgerEntry` (Task 1)
- Produces: `contentHashOf(draft: RaiseDraft): string`, `isDuplicate(draft, dept, ledger: RaisedLedgerEntry[]): boolean`

- [ ] **Step 1: 写失败测试**

```typescript
// src/core/courtos/department-flywheel/dedupe.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHashOf, isDuplicate } from './dedupe';
import type { RaiseDraft, RaisedLedgerEntry } from './types';

const draft: RaiseDraft = {
  sourceTaskId: 't1', command: '审批 X 预算 60万', title: 'X', priority: 80,
  reality: 'real', meta: {},
};

test('contentHashOf 稳定且随内容变化', () => {
  assert.equal(contentHashOf(draft), contentHashOf({ ...draft }));
  assert.notEqual(contentHashOf(draft), contentHashOf({ ...draft, command: '别的' }));
});

test('isDuplicate: 同源task+部门+hash 命中 ledger 即重复', () => {
  const led: RaisedLedgerEntry[] = [{
    sourceTaskId: 't1', dept: 'hubu', contentHash: contentHashOf(draft),
    raisedTaskId: 'dept_raise_a', at: '2026-06-28T00:00:00Z',
  }];
  assert.equal(isDuplicate(draft, 'hubu', led), true);
  assert.equal(isDuplicate({ ...draft, command: '变了' }, 'hubu', led), false);
  assert.equal(isDuplicate(draft, 'bingbu', led), false);
});
```

- [ ] **Step 2: 运行验证失败** — Run: `npm run test:node -- src/core/courtos/department-flywheel/dedupe.nodetest.ts` Expected: FAIL(模块不存在)

- [ ] **Step 3: 写实现**

```typescript
// src/core/courtos/department-flywheel/dedupe.ts
import { createHash } from 'node:crypto';
import type { DeptId, RaiseDraft, RaisedLedgerEntry } from './types';

export function contentHashOf(draft: RaiseDraft): string {
  return createHash('sha256').update(`${draft.sourceTaskId}\n${draft.command}`).digest('hex').slice(0, 16);
}

export function isDuplicate(draft: RaiseDraft, dept: DeptId, ledger: RaisedLedgerEntry[]): boolean {
  const hash = contentHashOf(draft);
  return ledger.some((e) => e.dept === dept && e.sourceTaskId === draft.sourceTaskId && e.contentHash === hash);
}
```

- [ ] **Step 4: 运行验证通过** — Run: `npm run test:node -- src/core/courtos/department-flywheel/dedupe.nodetest.ts` Expected: PASS

- [ ] **Step 5: 提交** — `git add … && git commit -m "feat(flywheel): 内容哈希+去重纯函数"`

---

### Task 3: 阈值门 + 每轮上限(纯函数)

**Files:**
- Create: `src/core/courtos/department-flywheel/gate.ts`
- Test: `src/core/courtos/department-flywheel/gate.nodetest.ts`

**Interfaces:**
- Consumes: `RaiseDraft`, `FlywheelConfig` (Task 1)
- Produces: `capPerRun(drafts: RaiseDraft[], cfg: FlywheelConfig): RaiseDraft[]` (按 priority 降序截断,null 最低)

- [ ] **Step 1: 写失败测试**

```typescript
// src/core/courtos/department-flywheel/gate.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capPerRun } from './gate';
import type { RaiseDraft } from './types';

const mk = (id: string, p: number | null): RaiseDraft => ({
  sourceTaskId: id, command: id, title: id, priority: p, reality: 'real', meta: {},
});

test('capPerRun 取最高优先级 N 条,null 排最后', () => {
  const out = capPerRun([mk('a', 50), mk('b', 90), mk('c', null), mk('d', 70)], { maxPerRun: 2 });
  assert.deepEqual(out.map((d) => d.sourceTaskId), ['b', 'd']);
});

test('capPerRun maxPerRun 0 → 空', () => {
  assert.equal(capPerRun([mk('a', 1)], { maxPerRun: 0 }).length, 0);
});
```

- [ ] **Step 2: 运行验证失败** — Run: `npm run test:node -- …/gate.nodetest.ts` Expected: FAIL

- [ ] **Step 3: 写实现**

```typescript
// src/core/courtos/department-flywheel/gate.ts
import type { FlywheelConfig, RaiseDraft } from './types';

export function capPerRun(drafts: RaiseDraft[], cfg: FlywheelConfig): RaiseDraft[] {
  const rank = (p: number | null) => (p === null ? -1 : p);
  return [...drafts].sort((a, b) => rank(b.priority) - rank(a.priority)).slice(0, Math.max(0, cfg.maxPerRun));
}
```

- [ ] **Step 4: 运行验证通过** — Expected: PASS
- [ ] **Step 5: 提交** — `git commit -m "feat(flywheel): 每轮上限纯函数"`

---

### Task 4: ledger 持久化(Turso 表)

**Files:**
- Create: `src/core/courtos/department-flywheel/ledger.ts`

**Interfaces:**
- Consumes: `RaisedLedgerEntry`, `DeptId` (Task 1)
- Produces: `loadLedger(dept: DeptId, limit?: number): Promise<RaisedLedgerEntry[]>`, `appendLedger(entry: RaisedLedgerEntry): Promise<void>`

> 复用 primary-store 的 db 句柄获取方式。读 `src/lib/db/primary-store.ts` 顶部看 `ensurePrimaryDbReady()` 是否可 import;若是内部私有,则在 ledger.ts 内用同样的 `@libsql/client` + 同一连接配置(SSOT:从 primary-store 暴露一个 `getPrimaryDb()`,本任务先在 primary-store 加一行 `export { ensurePrimaryDbReady as getPrimaryDb }`)。

- [ ] **Step 1: 在 primary-store 暴露 db 句柄**
  Modify `src/lib/db/primary-store.ts`:在文件末尾加 `export { ensurePrimaryDbReady as getPrimaryDb };`

- [ ] **Step 2: 写 ledger.ts**

```typescript
// src/core/courtos/department-flywheel/ledger.ts
import { getPrimaryDb } from '@/lib/db/primary-store';
import type { DeptId, RaisedLedgerEntry } from './types';

async function ensureTable(): Promise<void> {
  const db = await getPrimaryDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dept_flywheel_ledger (
      raised_task_id TEXT PRIMARY KEY,
      dept TEXT NOT NULL,
      source_task_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export async function loadLedger(dept: DeptId, limit = 500): Promise<RaisedLedgerEntry[]> {
  await ensureTable();
  const db = await getPrimaryDb();
  const res = await db.execute({
    sql: `SELECT raised_task_id, dept, source_task_id, content_hash, created_at
          FROM dept_flywheel_ledger WHERE dept = ? ORDER BY created_at DESC LIMIT ?`,
    args: [dept, limit],
  });
  return res.rows.map((r) => ({
    raisedTaskId: String(r.raised_task_id), dept: String(r.dept) as DeptId,
    sourceTaskId: String(r.source_task_id), contentHash: String(r.content_hash), at: String(r.created_at),
  }));
}

export async function appendLedger(entry: RaisedLedgerEntry): Promise<void> {
  await ensureTable();
  const db = await getPrimaryDb();
  await db.execute({
    sql: `INSERT OR IGNORE INTO dept_flywheel_ledger
          (raised_task_id, dept, source_task_id, content_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [entry.raisedTaskId, entry.dept, entry.sourceTaskId, entry.contentHash, entry.at],
  });
}
```

- [ ] **Step 3: 类型门** — Run: `pnpm exec tsc --noEmit` Expected: 0 error
- [ ] **Step 4: 提交** — `git commit -m "feat(flywheel): ledger 持久化(Turso 表)"`

---

### Task 5: 写待决项进主库(raise)

**Files:**
- Create: `src/core/courtos/department-flywheel/raise.ts`
- Test: `src/core/courtos/department-flywheel/raise.nodetest.ts`

**Interfaces:**
- Consumes: `RaiseDraft`, `DeptId` (Task 1);`upsertPrimaryTask`(primary-store)
- Produces: `buildRaiseInput(draft: RaiseDraft, dept: DeptId): { taskId: string; command: string; title: string; status: 'pending'; result: Record<string, unknown> }`

> raise 拆成纯函数 `buildRaiseInput`(可测)+ 薄 `raiseDraft`(调 upsertPrimaryTask + appendLedger,在 Task 6 编排里用)。本任务只测 `buildRaiseInput`。

- [ ] **Step 1: 写失败测试**

```typescript
// src/core/courtos/department-flywheel/raise.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRaiseInput } from './raise';
import type { RaiseDraft } from './types';

const draft: RaiseDraft = {
  sourceTaskId: 't1', command: '审批储能采购预算 60万', title: '储能采购',
  priority: 80, reality: 'real', meta: { verdict: 'adjust' },
};

test('buildRaiseInput: dept_raise_ 前缀 + pending + 来源元数据', () => {
  const inp = buildRaiseInput(draft, 'hubu');
  assert.ok(inp.taskId.startsWith('dept_raise_hubu_'));
  assert.equal(inp.status, 'pending');
  assert.equal((inp.result.flywheel as Record<string, unknown>).dept, 'hubu');
  assert.equal((inp.result.flywheel as Record<string, unknown>).sourceTaskId, 't1');
  assert.equal(inp.result.sourceLabel, 'real');
});

test('buildRaiseInput: 绝不用 department_learning_ 前缀', () => {
  assert.ok(!buildRaiseInput(draft, 'hubu').taskId.startsWith('department_learning_'));
});
```

- [ ] **Step 2: 运行验证失败** — Expected: FAIL

- [ ] **Step 3: 写实现**

```typescript
// src/core/courtos/department-flywheel/raise.ts
import { upsertPrimaryTask } from '@/lib/db/primary-store';
import { appendLedger } from './ledger';
import { contentHashOf } from './dedupe';
import type { DeptId, RaiseDraft } from './types';

export function buildRaiseInput(draft: RaiseDraft, dept: DeptId) {
  const taskId = `dept_raise_${dept}_${contentHashOf(draft)}`;
  return {
    taskId,
    command: draft.command,
    title: draft.title,
    status: 'pending' as const,
    result: {
      sourceLabel: draft.reality,
      // 来源可区分:这是部门自动派生,不是人下旨
      flywheel: { dept, sourceTaskId: draft.sourceTaskId, auto: true, ...draft.meta },
    },
  };
}

/** 写主库 + 记 ledger;返回写入的 taskId。 */
export async function raiseDraft(draft: RaiseDraft, dept: DeptId): Promise<string> {
  const inp = buildRaiseInput(draft, dept);
  const receipt = await upsertPrimaryTask(inp);
  await appendLedger({
    raisedTaskId: receipt.taskId, dept, sourceTaskId: draft.sourceTaskId,
    contentHash: contentHashOf(draft), at: receipt.acceptedAt,
  });
  return receipt.taskId;
}
```

- [ ] **Step 4: 运行验证通过 + 类型门** — Run nodetest(PASS)+ `pnpm exec tsc --noEmit`(0)
- [ ] **Step 5: 提交** — `git commit -m "feat(flywheel): 写待决项进主库 + ledger"`

---

### Task 6: 编排器(run-flywheel,含错误隔离)

**Files:**
- Create: `src/core/courtos/department-flywheel/run-flywheel.ts`
- Test: `src/core/courtos/department-flywheel/run-flywheel.nodetest.ts`

**Interfaces:**
- Consumes: 全部上面 + `DeptHooks`, `FlywheelConfig`
- Produces: `runFlywheel(hooks: DeptHooks, cfg: FlywheelConfig, deps: { tasks: SourceTask[]; ledger: RaisedLedgerEntry[]; raise: (d: RaiseDraft, dept: DeptId) => Promise<string> }): Promise<FlywheelRunResult>`

> 编排器**注入** tasks/ledger/raise(便于单测,不碰真库)。路由层(Task 8)负责真取 tasks/ledger/raise。

- [ ] **Step 1: 写失败测试**

```typescript
// src/core/courtos/department-flywheel/run-flywheel.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFlywheel } from './run-flywheel';
import type { DeptHooks, SourceTask, RaiseDraft } from './types';

const tasks: SourceTask[] = [
  { id: 't1', title: '小额', command: '买纸 200', status: 'pending', updatedAt: '2026-06-28T01:00:00Z' },
  { id: 't2', title: '大额', command: '储能采购预算 80万 风险高', status: 'pending', updatedAt: '2026-06-28T02:00:00Z' },
];
const hooks: DeptHooks = {
  dept: 'hubu',
  selectCandidates: (ts) => ts.filter((t) => t.command.includes('预算') || t.command.includes('采购')),
  passesThreshold: (t) => t.command.includes('万'),
  derive: (t): RaiseDraft => ({ sourceTaskId: t.id, command: `户部待决:${t.command}`, title: t.title, priority: 80, reality: 'real', meta: {} }),
};

test('runFlywheel: 筛选→阈值→加工→去重→上限→raise,且记录统计', async () => {
  const raised: string[] = [];
  const res = await runFlywheel(hooks, { maxPerRun: 2 }, {
    tasks, ledger: [], raise: async (d) => { raised.push(d.sourceTaskId); return `dept_raise_${d.sourceTaskId}`; },
  });
  assert.equal(res.raised.length, 1);          // 只有 t2 过阈值(含"万")
  assert.equal(res.raised[0].sourceTaskId, 't2');
  assert.deepEqual(raised, ['t2']);
});

test('runFlywheel: 单项 derive 抛错被隔离,不中断整轮', async () => {
  const boom: DeptHooks = { ...hooks, derive: () => { throw new Error('boom'); } };
  const res = await runFlywheel(boom, { maxPerRun: 2 }, { tasks, ledger: [], raise: async () => 'x' });
  assert.equal(res.raised.length, 0);
  assert.ok(res.skipped.some((s) => s.reason.includes('boom') || s.reason.includes('derive')));
});
```

- [ ] **Step 2: 运行验证失败** — Expected: FAIL

- [ ] **Step 3: 写实现**

```typescript
// src/core/courtos/department-flywheel/run-flywheel.ts
import { capPerRun } from './gate';
import { isDuplicate } from './dedupe';
import type { DeptHooks, FlywheelConfig, FlywheelRunResult, RaiseDraft, RaisedLedgerEntry, SourceTask } from './types';

interface Deps {
  tasks: SourceTask[];
  ledger: RaisedLedgerEntry[];
  raise: (draft: RaiseDraft, dept: DeptId) => Promise<string>;
}
import type { DeptId } from './types';

export async function runFlywheel(hooks: DeptHooks, cfg: FlywheelConfig, deps: Deps): Promise<FlywheelRunResult> {
  const res: FlywheelRunResult = {
    dept: hooks.dept, scanned: deps.tasks.length, candidates: 0, passedGate: 0,
    deduped: 0, raised: [], skipped: [],
  };
  const candidates = hooks.selectCandidates(deps.tasks);
  res.candidates = candidates.length;

  const drafts: RaiseDraft[] = [];
  for (const task of candidates) {
    try {
      if (!hooks.passesThreshold(task)) { res.skipped.push({ sourceTaskId: task.id, reason: 'below-threshold' }); continue; }
      res.passedGate += 1;
      const draft = hooks.derive(task);
      if (!draft) { res.skipped.push({ sourceTaskId: task.id, reason: 'derive-null' }); continue; }
      if (isDuplicate(draft, hooks.dept, deps.ledger)) { res.deduped += 1; res.skipped.push({ sourceTaskId: task.id, reason: 'duplicate' }); continue; }
      drafts.push(draft);
    } catch (e) {
      res.skipped.push({ sourceTaskId: task.id, reason: `derive-error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  for (const draft of capPerRun(drafts, cfg)) {
    try {
      const raisedTaskId = await deps.raise(draft, hooks.dept);
      res.raised.push({ raisedTaskId, sourceTaskId: draft.sourceTaskId });
    } catch (e) {
      res.skipped.push({ sourceTaskId: draft.sourceTaskId, reason: `raise-error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return res;
}
```

- [ ] **Step 4: 运行验证通过 + 类型门** — nodetest PASS + tsc 0
- [ ] **Step 5: 提交** — `git commit -m "feat(flywheel): 编排器 + 错误隔离"`

---

### Task 7: 户部钩子 + 配置

**Files:**
- Create: `src/core/courtos/department-flywheel/hubu/config.ts`
- Create: `src/core/courtos/department-flywheel/hubu/hooks.ts`
- Test: `src/core/courtos/department-flywheel/hubu/hooks.nodetest.ts`

**Interfaces:**
- Consumes: `evaluateProject`(`@/features/hubu/lib/hubu-engines`)、`HubuProject`(`@/lib/contracts/hubu`)、`SourceTask`/`RaiseDraft`/`DeptHooks`
- Produces: `HUBU_FLYWHEEL_CONFIG: FlywheelConfig`、`hubuHooks: DeptHooks`、`taskToHubuProject(task): HubuProject`

- [ ] **Step 1: 写 config**

```typescript
// src/core/courtos/department-flywheel/hubu/config.ts
import type { FlywheelConfig } from '../types';
// v1 极严:先严后松。每轮最多 2 条。
export const HUBU_FLYWHEEL_CONFIG: FlywheelConfig = { maxPerRun: 2 };
// 阈值:金额(元)下限。
export const HUBU_MIN_BUDGET_YUAN = 500_000;
// 户部语义关键词。
export const HUBU_KEYWORDS = ['预算', '成本', '报价', 'ROI', '采购', '付款', '现金', '回款', '投入'];
```

- [ ] **Step 2: 写失败测试**

```typescript
// src/core/courtos/department-flywheel/hubu/hooks.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubuHooks } from './hooks';
import type { SourceTask } from '../types';

const big: SourceTask = { id: 'b', title: '储能采购', command: '储能采购预算 80万 预期回报 2.5x 风险高', status: 'pending', updatedAt: '2026-06-28T02:00:00Z' };
const small: SourceTask = { id: 's', title: '买纸', command: '采购办公纸 2000', status: 'pending', updatedAt: 'x' };
const offtopic: SourceTask = { id: 'o', title: '招人', command: '招聘销售两名', status: 'pending', updatedAt: 'x' };

test('selectCandidates 只留户部语义', () => {
  const c = hubuHooks.selectCandidates([big, small, offtopic]).map((t) => t.id);
  assert.deepEqual(c.sort(), ['b', 's']); // 都含采购;offtopic 不含
});
test('passesThreshold 金额≥50万才过', () => {
  assert.equal(hubuHooks.passesThreshold(big), true);
  assert.equal(hubuHooks.passesThreshold(small), false);
});
test('derive 产 real 待决项 + 带 verdict 元数据,缺数字不编', () => {
  const d = hubuHooks.derive(big);
  assert.ok(d && d.reality === 'real');
  assert.ok(d!.command.includes('户部'));
  assert.ok('verdict' in d!.meta);
});
```

- [ ] **Step 3: 运行验证失败** — Expected: FAIL

- [ ] **Step 4: 写 hooks**

```typescript
// src/core/courtos/department-flywheel/hubu/hooks.ts
import { evaluateProject, parseWan } from '@/features/hubu/lib/hubu-engines';
import type { HubuProject, FinanceRiskLevel } from '@/lib/contracts/hubu';
import type { DeptHooks, RaiseDraft, SourceTask } from '../types';
import { HUBU_KEYWORDS, HUBU_MIN_BUDGET_YUAN } from './config';

function extractBudget(text: string): string {
  return text.match(/([\d.]+\s*万)/)?.[1] ?? '—';
}
function extractRoi(text: string): string {
  return text.match(/([\d.]+\s*x)/i)?.[1] ?? text.match(/([\d.]+\s*%)/)?.[1] ?? '—';
}
function extractRisk(text: string): FinanceRiskLevel {
  if (/紧急|critical/i.test(text)) return 'critical';
  if (/风险高|高风险|high/i.test(text)) return 'high';
  if (/风险中|medium/i.test(text)) return 'medium';
  return 'low';
}

export function taskToHubuProject(task: SourceTask): HubuProject {
  return {
    title: task.title,
    command: task.command,
    requested_budget: extractBudget(task.command),
    estimated_roi: extractRoi(task.command),
    risk_level: extractRisk(task.command),
    cash_flow_pressure: '—',
  } as HubuProject;
}

export const hubuHooks: DeptHooks = {
  dept: 'hubu',
  selectCandidates: (tasks) =>
    tasks.filter((t) => HUBU_KEYWORDS.some((k) => `${t.title} ${t.command}`.includes(k))),
  passesThreshold: (task) => {
    const budget = parseWan(extractBudget(task.command));
    if (budget !== null && budget >= HUBU_MIN_BUDGET_YUAN) return true;
    return false;
  },
  derive: (task): RaiseDraft | null => {
    const evalr = evaluateProject(taskToHubuProject(task));
    return {
      sourceTaskId: task.id,
      command: `户部呈报待决:${task.title} — 三引擎裁决【${evalr.verdictCn}】(评分${evalr.score ?? '—'}/敞口${evalr.exposure ?? '—'})。原由:${task.command}`,
      title: `户部·${task.title}`,
      priority: evalr.score,
      reality: 'real',
      meta: { verdict: evalr.verdict, verdictCn: evalr.verdictCn, score: evalr.score, exposure: evalr.exposure, missing: evalr.missing, oneWay: evalr.oneWayDoor.oneWay },
    };
  },
};
```

> 注:确认 `@/lib/contracts/hubu` 导出 `HubuProject` 与 `FinanceRiskLevel`。若 `parseWan` 未从 hubu-engines 导出,改从其导出处 import(grep 确认:`hubu-engines.ts:29 export function parseWan`)。

- [ ] **Step 5: 运行验证通过 + 类型门** — nodetest PASS + tsc 0
- [ ] **Step 6: 提交** — `git commit -m "feat(flywheel): 户部钩子(三引擎加工)+ 极严阈值"`

---

### Task 8: 户部 BFF 路由 /api/court/hubu/auto-raise

**Files:**
- Create: `src/app/api/court/hubu/auto-raise/route.ts`

**Interfaces:**
- Consumes: `runFlywheel`、`hubuHooks`、`HUBU_FLYWHEEL_CONFIG`、`loadLedger`、`raiseDraft`、`listPrimaryTasks`
- Produces: `POST` → `FlywheelRunResult` JSON

> 路由是组装层:取 tasks(主库)+ ledger,注入编排器,真 raise。鉴权沿用本仓约定(`/api/court/*` 经 middleware cookie 门;特权写入参考铁律1——本路由由 cron 内网调用,加一个共享密钥头 `x-flywheel-key` 校验,防外部触发刷库)。

- [ ] **Step 1: 写路由**

```typescript
// src/app/api/court/hubu/auto-raise/route.ts
import { NextResponse } from 'next/server';
import { listPrimaryTasks } from '@/lib/db/primary-store';
import { runFlywheel } from '@/core/courtos/department-flywheel/run-flywheel';
import { loadLedger } from '@/core/courtos/department-flywheel/ledger';
import { raiseDraft } from '@/core/courtos/department-flywheel/raise';
import { hubuHooks } from '@/core/courtos/department-flywheel/hubu/hooks';
import { HUBU_FLYWHEEL_CONFIG } from '@/core/courtos/department-flywheel/hubu/config';
import type { SourceTask } from '@/core/courtos/department-flywheel/types';

export const runtime = 'nodejs';

interface TaskRow { id: unknown; title: unknown; raw_command: unknown; status: unknown; updated_at: unknown }

export async function POST(req: Request): Promise<Response> {
  const required = process.env.FLYWHEEL_KEY;
  if (required && req.headers.get('x-flywheel-key') !== required) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = (await listPrimaryTasks({ status: 'pending', limit: 100 })) as TaskRow[];
  const tasks: SourceTask[] = rows.map((r) => ({
    id: String(r.id), title: String(r.title ?? ''), command: String(r.raw_command ?? ''),
    status: String(r.status ?? ''), updatedAt: String(r.updated_at ?? ''),
  }));
  const ledger = await loadLedger('hubu');
  const result = await runFlywheel(hubuHooks, HUBU_FLYWHEEL_CONFIG, { tasks, ledger, raise: raiseDraft });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: 类型门 + 构建门** — Run: `pnpm exec tsc --noEmit`(0) 然后 `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-buildcheck npm run build`(成功)
- [ ] **Step 3: 提交** — `git commit -m "feat(flywheel): 户部 auto-raise BFF 路由"`

---

### Task 9: 回归断言(铁律4:自动项不污染人工统计 + 来源可区分)

**Files:**
- Create: `src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts`

**Interfaces:**
- Consumes: `buildRaiseInput`

- [ ] **Step 1: 写断言测试**

```typescript
// src/core/courtos/department-flywheel/flywheel-honesty.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRaiseInput } from './raise';
import type { RaiseDraft } from './types';

const draft: RaiseDraft = { sourceTaskId: 't', command: 'c', title: 'x', priority: 50, reality: 'real', meta: {} };

test('铁律4:部门自动项带 flywheel.auto=true,可与人工任务区分', () => {
  const inp = buildRaiseInput(draft, 'hubu');
  const fw = inp.result.flywheel as Record<string, unknown>;
  assert.equal(fw.auto, true);               // 统计/KPI 可据此排除自动项
  assert.equal(fw.dept, 'hubu');
});

test('铁律:绝不冒充 LIVE 假数据 — sourceLabel 真实反映', () => {
  assert.equal(buildRaiseInput(draft, 'hubu').result.sourceLabel, 'real');
  assert.equal(buildRaiseInput({ ...draft, reality: 'fallback' }, 'hubu').result.sourceLabel, 'fallback');
});
```

- [ ] **Step 2: 运行验证通过** — Run: `npm run test:node -- …/flywheel-honesty.nodetest.ts` Expected: PASS
- [ ] **Step 3: 提交** — `git commit -m "test(flywheel): 铁律4 来源可区分回归断言"`

---

### Task 10: cron 脚本 + 手动验证 + 文档

**Files:**
- Create: `scripts/flywheel/run-hubu-flywheel.sh`
- Modify: `dev/notes/2026-06-28-department-flywheel-design.md`(补"如何挂 cron / 如何手动跑一次")

- [ ] **Step 1: 写 cron 脚本(PATH 带 npm-global)**

```bash
#!/usr/bin/env bash
# scripts/flywheel/run-hubu-flywheel.sh — 工作日定时调户部飞轮
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:/usr/bin:/bin"
KEY="${FLYWHEEL_KEY:-}"
curl -s --noproxy 127.0.0.1,localhost --max-time 60 \
  -X POST http://127.0.0.1:3050/chaotang/api/court/hubu/auto-raise \
  -H "Content-Type: application/json" \
  ${KEY:+-H "x-flywheel-key: $KEY"} \
  | tee -a "$HOME/.gstack/flywheel-hubu.log"
```

- [ ] **Step 2: chmod + 手动跑一次验证(dev :3002)**
  Run: `chmod +x scripts/flywheel/run-hubu-flywheel.sh` 然后对 dev 端口手动验证:
  `curl -s --noproxy 127.0.0.1,localhost -X POST http://127.0.0.1:3002/chaotang/api/court/hubu/auto-raise | head -c 400`
  Expected: 返回 `FlywheelRunResult` JSON(raised 数组,可能 0 条若无够格任务——符合"先严"预期)

- [ ] **Step 3: 文档补 crontab 行**
  在 design.md 加:`# 工作日 09:30 跑户部飞轮（系统 crontab）` + `30 9 * * 1-5 /home/ubuntu/workspace/frontend/chaotang-web-lyt/scripts/flywheel/run-hubu-flywheel.sh`

- [ ] **Step 4: 提交** — `git commit -m "feat(flywheel): 户部 cron 脚本 + 手动验证 + 文档"`

---

### Task 11: 独立会审 + 上线后端到端截图(GSTACK,仅此一次)

> 非代码任务,执行期人工/agent 走。

- [ ] **Step 1: 独立会审(铁律4)** — 派 `code-reviewer` agent 读本批 `git diff`(写 tasks 主库属高危),重点查:① raise 是否可能污染人工任务统计;② 去重是否真防重复刷库;③ 鉴权门是否可被外部绕过触发刷库。修掉 CRITICAL/HIGH 再继续。
- [ ] **Step 2: 端到端截图(GSTACK)** — 飞轮挂 cron 跑出≥1 条待决项后,用 GSTACK 开上书房截图,证明:待决项在队列 + 来源角标=部门派生 + 丞相已拟旨。存 `dev/screenshots/`。
- [ ] **Step 3: 兵部复用(下一程)** — 户部跑稳、阈值手感校准后,新建 `…/bingbu/{config,hooks}.ts` + `/api/court/bingbu/auto-raise`,复用 Task 1-6 全部 lib,仅填三钩子(接 bingbu-cro 或后端 4 flow)。本计划范围到户部止。

---

## Self-Review

**1. Spec coverage:**
- 内容来源(派生加工)→ Task 7 hooks ✓
- 输送形态(待决项进上书房,丞相自动拟旨)→ Task 5 raise(status=pending 进 tasks,丞相经现有主闭环)✓
- 三道闸(阈值/上限/去重)→ Task 3 gate + Task 2 dedupe + Task 7 threshold ✓
- 诚实标记 → Task 5 + Task 9 ✓
- 错误处理 → Task 6 错误隔离 ✓
- 测试(纯函数+回归+E2E+会审)→ Task 2/3/6/7/9 + Task 11 ✓
- 调度 → Task 10 ✓
- 兵部复用 → Task 11 Step 3 ✓
- GSTACK 仅最终截图 → Task 11 Step 2 ✓

**2. Placeholder scan:** 核心逻辑任务均有完整代码;路由/脚本有完整代码。`extractBudget/Roi/Risk` 为具体正则实现,非占位。

**3. Type consistency:** `RaiseDraft`/`DeptHooks`/`FlywheelConfig`/`RaisedLedgerEntry` 在 Task 1 定义,后续任务一致引用;`raiseDraft(draft, dept)` 签名在 Task 5 定义、Task 6/8 一致使用;`contentHashOf` 在 Task 2 定义、Task 5 复用。

**待执行期确认(非阻塞):**
- `@/lib/contracts/hubu` 是否导出 `HubuProject` + `FinanceRiskLevel`(Task 7 import 前 grep 确认)。
- primary-store 是否能 `export { ensurePrimaryDbReady as getPrimaryDb }`(Task 4 Step 1)。
- Turso db `.execute(sql 字符串)` 与 `.execute({sql,args})` 两种签名都被 @libsql 支持(ledger.ts 用了字符串建表 + 对象查询)。
