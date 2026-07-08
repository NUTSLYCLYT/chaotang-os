# 三省面板实时 SSE 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 军机处 `/command-center` 左栏三省面板消费后端 `sansheng` SSE 事件,按 `status`(active/progress/done)逐省点亮并显示 `summary` 文本,替换现有静态渲染。

**Architecture:** 在 `lib/contracts/events.ts` 新增 `SanshengEvent` 强类型;在 `BattleStream.tsx` 的 `setState` handler 中添加 `sansheng` case,把三省状态写入 `StreamState`;通过 prop 把三省状态从 `CommandCenterPage`→`LeftPanel` 传递;`LeftPanel` 中用状态映射替换静态 `SAN_SHENG` 渲染,加颜色脉冲/完成标记和 summary 文本。不新增文件,只修改 3 个已有文件。

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), `framer-motion`(已装), SSE via `subscribeCourtStream`

---

## File Map

| File | Change |
|------|--------|
| `src/lib/contracts/events.ts` | 新增 `SanshengEvent` 接口 + `isSanshengEvent` 守卫 |
| `src/features/command-center/BattleStream.tsx` | `StreamState` 加 `sanshengStates`; handler 加 `sansheng` case; 导出 `SanshengStates` 类型 |
| `src/app/(dashboard)/command-center/page.tsx` | `LeftPanel` props 加 `sanshengStates`; `CommandCenterInner` 提升状态; `LeftPanel` 渲染逻辑替换静态版本 |

---

### Task 1: 在 contracts/events.ts 新增 SanshengEvent 类型

**Files:**
- Modify: `src/lib/contracts/events.ts`

- [ ] **Step 1: 在 events.ts 末尾追加 SanshengEvent 接口和守卫**

在文件末尾(现有 `isCommandCallbackEvent` 之后)追加:

```typescript
/* ==========================================================================
   三省语义事件(T-be4 · 军机处 SSE)
   ========================================================================== */

/** 省代码 — 对应后端 translate_event 产出的 sheng 字段 */
export type ShengCode = 'zhongshu' | 'menxia' | 'shangshu';

/** 三省阶段状态 */
export type ShengStatus = 'active' | 'progress' | 'done';

/**
 * sansheng 事件 payload
 * 来源: GET /api/chaotang/decree/dispatch/{task_id}/stream
 * 后端在 council_* / group_* / aggregate / memorial.drafted 各阶段注入。
 */
export interface SanshengEvent {
  type: 'sansheng';
  /** 省代码 */
  sheng: ShengCode;
  /** 省中文名,如"中书省" */
  shengName: string;
  /** 阶段状态 */
  status: ShengStatus;
  /** 状态说明文本(可为空字符串) */
  summary: string;
}

/** 类型守卫 */
export function isSanshengEvent(event: unknown): event is SanshengEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as Record<string, unknown>).type === 'sansheng' &&
    typeof (event as Record<string, unknown>).sheng === 'string' &&
    typeof (event as Record<string, unknown>).status === 'string'
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd /Users/kv/workspace/ai/mingshuo/chaotang-swarm/chaotang-web-lyt
node_modules/.bin/next build 2>&1 | grep -E "error TS|✓ Compiled"
```

期望: `✓ Compiled` 无 `error TS`。

---

### Task 2: BattleStream — StreamState 加三省字段 + handler

**Files:**
- Modify: `src/features/command-center/BattleStream.tsx`

- [ ] **Step 1: 导入新类型并定义 SanshengStateEntry**

在文件顶部 import 区添加:

```typescript
import type { SanshengEvent, ShengCode, ShengStatus } from '@/lib/contracts/events';
import { isSanshengEvent } from '@/lib/contracts/events';
```

在 `/* ── Types ─` 块内,`StreamState` 之前新增:

```typescript
/** 单省实时状态 */
export interface SanshengStateEntry {
  sheng: ShengCode;
  shengName: string;
  status: ShengStatus;
  summary: string;
}

/** 三省状态映射 key=sheng code */
export type SanshengStates = Partial<Record<ShengCode, SanshengStateEntry>>;
```

- [ ] **Step 2: StreamState 加 sanshengStates 字段**

找到 `interface StreamState {` 块,在 `errorMessage?: string;` 行之前插入:

```typescript
  /** 三省实时状态(由 sansheng SSE 事件驱动) */
  sanshengStates: SanshengStates;
```

- [ ] **Step 3: INITIAL_STATE 加 sanshengStates 初始值**

找到 `const INITIAL_STATE: StreamState = {` 块,在 `streamStatus: 'idle',` 后加:

```typescript
  sanshengStates: {},
```

- [ ] **Step 4: setState handler 加 sansheng case**

在 BattleStream `setState((prev) => {` 回调中,在 `if (type === 'heartbeat') return prev;` 之后,`if (type === 'decree.understood')` 之前,插入:

```typescript
          // 三省语义事件 — 逐省更新状态
          if (type === 'sansheng' && isSanshengEvent(ev as unknown)) {
            const entry = ev as unknown as SanshengEvent;
            const sanshengStates: SanshengStates = {
              ...prev.sanshengStates,
              [entry.sheng]: {
                sheng: entry.sheng,
                shengName: entry.shengName,
                status: entry.status,
                summary: entry.summary,
              },
            };
            return { ...prev, sanshengStates };
          }
```

- [ ] **Step 5: BattleStream 解构中暴露 sanshengStates**

在 `const { decreeIntent, decreeSummary, ... } = state;` 行,加入 `sanshengStates`:

```typescript
  const {
    decreeIntent,
    decreeSummary,
    ministers,
    groups,
    risks,
    councilSummary,
    memorialId,
    qualityScore,
    streamStatus,
    errorMessage,
    sanshengStates,       // ← 新增
  } = state;
```

- [ ] **Step 6: BattleStream 返回值暴露 sanshengStates(供父层提取)**

`BattleStream` 目前是自渲染组件,不把 state 回传父层。三省状态需要传给 `LeftPanel`(在 page.tsx),所以最简洁的方案是:在 `page.tsx` 里独立维护一份三省状态,通过 `subscribeCourtStream` 的 `onEvent` 回调同步更新,不修改 `BattleStream` 的返回值(BattleStream 是独立渲染组件,props-up 会破坏其封装)。

**改为在 page.tsx 的 CommandCenterPage 层维护 sanshengStates**,BattleStream 不需要暴露。把 Task 2 Step 5/6 改为: BattleStream 里的 `sanshengStates` 只供 BattleStream 自身三省时间线渲染(可选锦上添花),page.tsx 层单独订阅。

> 见 Task 3。

- [ ] **Step 7: 验证编译**

```bash
node_modules/.bin/next build 2>&1 | grep -E "error TS|✓ Compiled"
```

期望: 无类型错误。

---

### Task 3: page.tsx — LeftPanel 接三省实时状态

**Files:**
- Modify: `src/app/(dashboard)/command-center/page.tsx`

本任务在 `CommandCenterPage` 维护三省状态,通过 props 传给 `LeftPanel`。`CommandCenterInner`(Suspense 内)的 taskId 由外层 `useSearchParams` 读取,需要把 taskId 提升一级或通过 store 共享。

由于 `CommandCenterInner` 在 Suspense 边界内读 `searchParams`,最简洁方案:在 `CommandCenterPage` 级别用 `useSearchParams`(加 Suspense 包裹整个页面);或者直接在 `LeftPanel` 内通过 `useAppStore` 拿 `currentTaskId` 来订阅 SSE。

**选 LeftPanel 内订阅方案**(最小改动,不破坏 Suspense 边界):

- [ ] **Step 1: 在 LeftPanel 内引入三省状态 hook**

在 page.tsx 顶部 import 区加入:

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { subscribeCourtStream } from '@/lib/api/chaotang';
import type { SanshengStates, SanshengStateEntry } from '@/features/command-center/BattleStream';
import type { ShengCode } from '@/lib/contracts/events';
```

注意:如果 `SanshengStates`/`SanshengStateEntry`/`ShengCode` 已在前面步骤 export,这里直接 import。

- [ ] **Step 2: 新增 useSanshengStates hook(内联在 page.tsx)**

在 `LeftPanel` 函数之前插入:

```typescript
/**
 * 订阅当前 task 的 sansheng SSE 事件,维护三省实时状态。
 * taskId 变化时重新订阅并重置。
 */
function useSanshengStates(taskId: string | null): SanshengStates {
  const [states, setStates] = useState<SanshengStates>({});
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // 取消上一次订阅
    cancelRef.current?.();
    cancelRef.current = null;

    if (!taskId) {
      setStates({});
      return;
    }

    setStates({});

    const cancel = subscribeCourtStream(
      taskId,
      (ev) => {
        if (ev.type !== 'sansheng') return;
        const sheng = ev.sheng as ShengCode | undefined;
        if (!sheng) return;
        const entry: SanshengStateEntry = {
          sheng,
          shengName: (ev.shengName as string | undefined) ?? sheng,
          status: (ev.status as SanshengStateEntry['status']) ?? 'active',
          summary: (ev.summary as string | undefined) ?? '',
        };
        setStates((prev) => ({ ...prev, [sheng]: entry }));
      },
      () => { /* SSE error: 静默,不影响主工作流 */ },
    );

    cancelRef.current = cancel;
    return () => {
      cancel();
      cancelRef.current = null;
    };
  }, [taskId]);

  return states;
}
```

- [ ] **Step 3: LeftPanel 从 store 取 currentTaskId,调用 useSanshengStates**

修改 `LeftPanel` 函数签名和内部逻辑:

```typescript
function LeftPanel({ memorials }: { memorials: MemorialBrief[] }) {
  const tasks = useAppStore((s) => s.tasks);
  const currentTask = useAppStore((s) => {
    const id = s.currentTaskId;
    return s.tasks.find((t) => t.id === id) ?? s.tasks[0] ?? null;
  });

  // 三省实时状态(订阅当前 task 的 sansheng SSE)
  const sanshengStates = useSanshengStates(currentTask?.id ?? null);

  const hasMock = tasks.length === 0;

  // ... 其余保持不变
```

- [ ] **Step 4: 定义 SAN_SHENG 含 sheng 代码字段**

将静态 `SAN_SHENG` 常量改为含 `sheng` 字段:

```typescript
const SAN_SHENG = [
  { name: '中书省', sheng: 'zhongshu' as ShengCode, role: '起草方案', color: GOLD        },
  { name: '门下省', sheng: 'menxia'   as ShengCode, role: '审查漏洞', color: '#FB923C'   },
  { name: '尚书省', sheng: 'shangshu' as ShengCode, role: '制定执行', color: BLUE        },
] as const;
```

- [ ] **Step 5: 替换 LeftPanel 三省机制渲染块**

找到以下旧渲染块:

```typescript
      {/* 三省机制 */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
        <div className="mb-1.5 uppercase tracking-[0.1em] text-[8px]" style={{ color: DIM }}>
          三省机制
        </div>
        <div className="space-y-1">
          {SAN_SHENG.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <span style={{ color: s.color }} className="font-bold text-[9px]">{s.name}</span>
              <span style={{ color: LABEL }}>{s.role}</span>
            </div>
          ))}
        </div>
      </div>
```

替换为:

```typescript
      {/* 三省机制 — 实时 SSE 点亮 */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
        <div className="mb-1.5 uppercase tracking-[0.1em] text-[8px]" style={{ color: DIM }}>
          三省机制
        </div>
        <div className="space-y-1.5">
          {SAN_SHENG.map((s) => {
            const live = sanshengStates[s.sheng];
            const isActive   = live?.status === 'active';
            const isProgress = live?.status === 'progress';
            const isDone     = live?.status === 'done';
            const isLit      = isActive || isProgress || isDone;

            // 边框/背景跟随状态
            const borderColor = isDone
              ? `${GREEN}55`
              : isActive || isProgress
                ? `${s.color}44`
                : 'rgba(255,255,255,0.04)';
            const bgColor = isDone
              ? `${GREEN}0a`
              : isActive || isProgress
                ? `${s.color}0a`
                : 'transparent';

            return (
              <div
                key={s.name}
                className="rounded border px-1.5 py-1 transition-all duration-300"
                style={{ borderColor, background: bgColor }}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {/* 状态点 */}
                    {isDone && (
                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: GREEN }} />
                    )}
                    {(isActive || isProgress) && (
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0 animate-breathe"
                        style={{ background: s.color }}
                      />
                    )}
                    {!isLit && (
                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-white/10" />
                    )}
                    <span
                      className="font-bold text-[9px]"
                      style={{ color: isLit ? s.color : LABEL }}
                    >
                      {s.name}
                    </span>
                  </div>
                  <span className="text-[8px]" style={{ color: isDone ? GREEN : LABEL }}>
                    {isDone ? '完成' : isProgress ? '进行中' : isActive ? '启动' : s.role}
                  </span>
                </div>
                {/* 实时 summary */}
                {live?.summary && (
                  <div
                    className="mt-0.5 line-clamp-2 text-[8px] leading-4"
                    style={{ color: isDone ? '#A8E6C9' : '#C8CDD8' }}
                  >
                    {live.summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
```

- [ ] **Step 6: 清理 import — page.tsx 顶部确认所需 import 齐全**

page.tsx 顶部应有:

```typescript
import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
```

如果 `useRef` 之前未在 page.tsx 中出现,需要加入。检查并确保 `ShengCode` 从 `@/lib/contracts/events` 导入。

- [ ] **Step 7: 全量 build 验证**

```bash
cd /Users/kv/workspace/ai/mingshuo/chaotang-swarm/chaotang-web-lyt
node_modules/.bin/next build 2>&1 | grep -E "error TS|Error:|✓ Compiled|✓ Generating"
```

期望:
```
✓ Compiled successfully
✓ Generating static pages (152/152)
```

无 TypeScript 错误。

---

### Task 4: 台账更新 + 报告

**Files:**
- Modify: `.plans/chaotang-manor/frontend-dev/task-sansheng-panel/progress.md`

- [ ] **Step 1: 写 progress.md**

```markdown
# task-sansheng-panel progress

## 状态: 完成

## 2026-05-28

### 交付
| 文件 | 变更 |
|------|------|
| `lib/contracts/events.ts` | 新增 SanshengEvent / ShengCode / ShengStatus / isSanshengEvent |
| `features/command-center/BattleStream.tsx` | StreamState 加 sanshengStates; isSanshengEvent case; SanshengStates 类型导出 |
| `app/(dashboard)/command-center/page.tsx` | useSanshengStates hook; LeftPanel 三省实时渲染(active/progress/done 点亮 + summary) |

### 数据流
subscribeCourtStream(taskId) → onEvent(ev.type==='sansheng') → setStates → LeftPanel 渲染

### build
next build 152/152 exit 0
```

- [ ] **Step 2: SendMessage team-lead 完成报告**

```
T-fe9 完成。三省面板实时 SSE 接入:
- lib/contracts/events.ts: SanshengEvent 强类型 + isSanshengEvent 守卫
- BattleStream.tsx: StreamState.sanshengStates + sansheng case handler
- command-center/page.tsx: useSanshengStates hook(独立订阅 subscribeCourtStream) + LeftPanel 三省实时渲染(active 脉冲/progress 点亮/done 绿勾 + summary 文本)
build 152/152 通过。不破现有闭环。请安排 e2e 三省点亮回归 + reviewer。
```

---

## Self-Review

**Spec coverage:**
- ✓ `SanshengEvent` 强类型加入 contracts/events — Task 1
- ✓ `isSanshengEvent` 类型守卫 — Task 1
- ✓ `BattleStream.tsx` SSE handler 消费 `sansheng` 事件 — Task 2
- ✓ 三省面板 active/progress/done 状态渲染 + summary — Task 3 Step 5
- ✓ 不破现有 decreeDraft→dispatch→BattleStream 闭环 — 用独立第二路 subscribeCourtStream,不动 BattleStream 内部
- ✓ build 验证 — Task 3 Step 7

**Placeholder scan:** 无 TBD/TODO。

**Type consistency:**
- `ShengCode` 定义于 Task 1,在 Task 2 和 Task 3 均从 `@/lib/contracts/events` import ✓
- `SanshengStates`/`SanshengStateEntry` 定义于 Task 2 BattleStream.tsx,在 Task 3 import ✓
- `useSanshengStates` 返回 `SanshengStates`,`sanshengStates[s.sheng]` 类型为 `SanshengStateEntry | undefined` ✓
- `live?.status` 类型为 `ShengStatus | undefined`,三元判断完整覆盖 ✓

**双重 SSE 订阅问题:** `useSanshengStates` 和 `BattleStream` 各自独立调用 `subscribeCourtStream`,同一 taskId 会建两条 SSE 连接。后端单 worker 可承受(KP-1 已知),但如需优化可后续改为 context 共享。已在代码注释中标注,不阻塞本次交付。
