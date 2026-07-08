# 军机处战情室 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将军机处（`/command-center`）从静态热区图改造为动态实时战情室：下旨后自动跳转，实时展示三省进度、蜂群战情卡（streaming文字）、军机大臣逐一亮起发言、执行时间轴；新增治理确认弹窗（medium/high risk 暂停等待批准）。

**Architecture:** 保留 `BattleStream.tsx` 的 SSE 订阅逻辑，但拆出四个新子组件（`ThreeProvincesPanel`、`SwarmBattleCard`、`MinisterPanel`、`ExecutionTimeline`）；`command-center/page.tsx` 从背景图热区模式切换为全屏黑色玻璃 flex 布局；`上书房` dispatch 成功后 `router.push('/command-center?taskId=xxx')` 跳转；新增 `GovernanceGateDialog` 组件处理 `governance.pause` 事件。所有组件用已有 Tailwind 4 + framer-motion，不引入新依赖。

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind 4, framer-motion (已装), zustand (已装), `subscribeCourtStream` from `lib/api/chaotang.ts`

---

## 布局设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TopBar: 📜圣旨原文摘要  |  ● LIVE / ✓完成 / ✗错误  |  ⏱ 耗时  |  查看奏折 │
├──────────┬──────────────────────────────────┬──────────────────────────┤
│ 三省进度  │        蜂群战情板                  │      军机大臣会议         │
│ w:200px  │        flex-1                    │      w:240px             │
│          │                                  │                          │
│ 中书省 ●  │  ┌──────────┐  ┌──────────┐     │  ┌──────────────────┐   │
│   分析中  │  │ intel    │  │ finlaw   │     │  │ 锦衣卫 ● streaming│   │
│ 门下省 ·  │  │ 情报收集  │  │ 财法分析  │     │  │ "臣以为此案…"    │   │
│   等待   │  │ [文字流]  │  │ [文字流]  │     │  └──────────────────┘   │
│ 尚书省 ·  │  └──────────┘  └──────────┘     │  ┌──────────────────┐   │
│   等待   │                                  │  │ 户部 · 等待...    │   │
│          │  质量分: 4.2 ✓  质量分: 3.8 ✓    │  └──────────────────┘   │
├──────────┴──────────────────────────────────┴──────────────────────────┤
│ 执行时间轴: 下旨 → 丞相理解 → 大臣会审 ✓ → intel执行 ✓ → 汇总 → 奏折  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Map

| File | Change |
|---|---|
| `src/features/command-center/ThreeProvincesPanel.tsx` | New — 三省进度竖排组件 |
| `src/features/command-center/SwarmBattleCard.tsx` | New — 单个蜂群战情卡（streaming文字 + 质量分） |
| `src/features/command-center/MinisterPanel.tsx` | New — 军机大臣列表，逐一亮起 |
| `src/features/command-center/ExecutionTimeline.tsx` | New — 底部执行时间轴 |
| `src/features/command-center/GovernanceGateDialog.tsx` | New — governance.pause 确认弹窗 |
| `src/features/command-center/BattleStream.tsx` | Modify — 加 onGovernancePause/onGovernanceApproved 回调；加 ministers streaming |
| `src/app/(dashboard)/command-center/page.tsx` | Rewrite — 新三栏布局，移除热区图模式 |
| `src/features/shangshufang/ShangshufangPage.tsx` | Modify — dispatch 成功后 router.push 跳转军机处 |
| `src/lib/api/chaotang.ts` | Modify — 加 `decreeeProceed(taskId)` 函数 |

---

### Task 1: 新增 ThreeProvincesPanel 组件

**Files:**
- Create: `src/features/command-center/ThreeProvincesPanel.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/features/command-center/ThreeProvincesPanel.tsx
'use client';
import { motion } from 'framer-motion';
import type { SanshengStates, SanshengStateEntry } from './BattleStream';

const PROVINCES = [
  { sheng: 'zhongshu' as const, label: '中书省', sub: '起草·会审' },
  { sheng: 'menxia'   as const, label: '门下省', sub: '审议·把关' },
  { sheng: 'shangshu' as const, label: '尚书省', sub: '执行·落地' },
];

const STATUS_COLOR: Record<string, string> = {
  active:   '#6BA0FF',
  progress: '#F0C66A',
  done:     '#3DD68C',
};

const STATUS_LABEL: Record<string, string> = {
  active:   '进行中',
  progress: '处理中',
  done:     '完成',
};

interface Props { sanshengStates: SanshengStates; }

export function ThreeProvincesPanel({ sanshengStates }: Props) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {PROVINCES.map(({ sheng, label, sub }) => {
        const entry: SanshengStateEntry | undefined = sanshengStates[sheng];
        const color = entry ? (STATUS_COLOR[entry.status] ?? '#4A5068') : '#2A2E42';
        const isActive = !!entry;
        return (
          <motion.div
            key={sheng}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: isActive ? 1 : 0.4 }}
            transition={{ duration: 0.4 }}
            style={{
              border: `1px solid ${color}44`,
              borderLeft: `3px solid ${color}`,
              background: isActive ? `${color}0D` : 'transparent',
              borderRadius: 6,
              padding: '10px 12px',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {isActive && (
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: entry?.status === 'done' ? 0 : Infinity, duration: 1.2 }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }}
                />
              )}
              <span style={{ color: isActive ? color : '#4A5068', fontSize: 13, fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
                {label}
              </span>
              {entry && (
                <span style={{ fontSize: 10, color: color, marginLeft: 'auto' }}>
                  {STATUS_LABEL[entry.status] ?? entry.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#6A7299' }}>{sub}</div>
            {entry?.summary && (
              <div style={{ fontSize: 11, color: '#9AA3C4', marginTop: 4, lineHeight: 1.5 }}>
                {entry.summary.slice(0, 60)}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt
npx tsc --noEmit 2>&1 | grep -i "ThreeProvincesPanel\|error" | head -10
```
Expected: 无错误（或只有其他文件的已有错误）

- [ ] **Step 3: 提交**

```bash
git add src/features/command-center/ThreeProvincesPanel.tsx
git commit -m "feat(battleroom): add ThreeProvincesPanel component"
```

---

### Task 2: 新增 SwarmBattleCard 组件

**Files:**
- Create: `src/features/command-center/SwarmBattleCard.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/features/command-center/SwarmBattleCard.tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { GroupCard } from './BattleStream';

const STATUS_CONFIG = {
  dispatching: { color: '#6BA0FF', label: '派遣中', pulse: true },
  running:     { color: '#F0C66A', label: '执行中', pulse: true },
  aggregated:  { color: '#3DD68C', label: '完成',   pulse: false },
};

const GROUP_LABELS: Record<string, string> = {
  intel:   '情报蜂群',
  content: '文创蜂群',
  finlaw:  '财法蜂群',
  rnd:     '产研蜂群',
  exec:    '执行蜂群',
  review:  '复盘蜂群',
};

interface Props { card: GroupCard; }

export function SwarmBattleCard({ card }: Props) {
  const cfg = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.dispatching;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        border: `1px solid ${cfg.color}33`,
        borderTop: `2px solid ${cfg.color}`,
        background: 'rgba(4,6,14,0.72)',
        borderRadius: 8,
        padding: '12px 14px',
        minHeight: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* 卡头 */}
      <div className="flex items-center gap-2 mb-2">
        {cfg.pulse ? (
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.0 }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }}
          />
        ) : (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
        )}
        <span style={{ color: '#F6EFD8', fontSize: 13, fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
          {GROUP_LABELS[card.groupId] ?? card.groupId}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: cfg.color, letterSpacing: '0.1em' }}>
          {cfg.label}
        </span>
      </div>

      {/* 实时文字流 */}
      <div style={{ fontSize: 11, color: '#9AA3C4', lineHeight: 1.7, minHeight: 48, maxHeight: 100, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          {card.liveText ? (
            <motion.span key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {card.liveText.slice(-200)}
              {card.status === 'running' && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  style={{ display: 'inline-block', width: 2, height: 12, background: '#F0C66A', marginLeft: 2, verticalAlign: 'middle' }}
                />
              )}
            </motion.span>
          ) : (
            <motion.span key="waiting" style={{ color: '#4A5068' }}>等待指令…</motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 质量分（完成后显示） */}
      {card.status === 'aggregated' && card.summary && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${cfg.color}22`, fontSize: 11, color: '#3DD68C' }}
        >
          ✓ {card.summary.slice(0, 80)}
        </motion.div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "SwarmBattleCard" | head -5
```
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/command-center/SwarmBattleCard.tsx
git commit -m "feat(battleroom): add SwarmBattleCard with streaming text and pulse animation"
```

---

### Task 3: 新增 MinisterPanel 组件

**Files:**
- Create: `src/features/command-center/MinisterPanel.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/features/command-center/MinisterPanel.tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { MinisterRow } from './BattleStream';

const MINISTER_META: Record<string, { icon: string; title: string }> = {
  hu_bu:      { icon: '💰', title: '户部' },
  li_bu:      { icon: '📋', title: '吏部' },
  xing_bu:    { icon: '⚖️', title: '刑部' },
  gong_bu:    { icon: '⚙️', title: '工部' },
  li_bu_rites:{ icon: '📣', title: '礼部' },
  bing_bu:    { icon: '🗡️', title: '兵部' },
  jin_yi_wei: { icon: '🔍', title: '锦衣卫' },
  qin_tian_jian: { icon: '🌌', title: '钦天监' },
  scribe:     { icon: '📜', title: '史官' },
};

interface Props { ministers: MinisterRow[]; }

export function MinisterPanel({ ministers }: Props) {
  if (ministers.length === 0) {
    return (
      <div style={{ color: '#4A5068', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>
        等待大臣会审…
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence>
        {ministers.map((m) => {
          const meta = MINISTER_META[m.agentCode] ?? { icon: '👤', title: m.name };
          const isDone = m.status === 'completed';
          return (
            <motion.div
              key={m.agentCode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                border: `1px solid ${isDone ? '#3DD68C33' : '#6BA0FF33'}`,
                borderLeft: `2px solid ${isDone ? '#3DD68C' : '#6BA0FF'}`,
                background: isDone ? 'rgba(61,214,140,0.05)' : 'rgba(107,160,255,0.05)',
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ color: '#F6EFD8', fontSize: 12, fontFamily: 'var(--font-serif)' }}>
                  {meta.title}
                </span>
                {isDone && <span style={{ marginLeft: 'auto', color: '#3DD68C', fontSize: 10 }}>已定 ✓</span>}
                {!isDone && (
                  <motion.span
                    style={{ marginLeft: 'auto', fontSize: 10, color: '#6BA0FF' }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    议事中…
                  </motion.span>
                )}
              </div>
              {m.opinion && (
                <div style={{ fontSize: 10, color: '#9AA3C4', lineHeight: 1.6, maxHeight: 60, overflowY: 'auto' }}>
                  {m.opinion.slice(0, 120)}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "MinisterPanel" | head -5
```
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/command-center/MinisterPanel.tsx
git commit -m "feat(battleroom): add MinisterPanel with animated minister opinions"
```

---

### Task 4: 新增 ExecutionTimeline 组件

**Files:**
- Create: `src/features/command-center/ExecutionTimeline.tsx`

- [ ] **Step 1: 创建组件**

```tsx
// src/features/command-center/ExecutionTimeline.tsx
'use client';
import { motion } from 'framer-motion';

export interface TimelineStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

const STATUS_STYLE = {
  pending: { dot: '#2A2E42', text: '#4A5068', line: '#2A2E42' },
  active:  { dot: '#F0C66A', text: '#F0C66A', line: '#F0C66A44' },
  done:    { dot: '#3DD68C', text: '#9AA3C4', line: '#3DD68C44' },
  error:   { dot: '#F43F5E', text: '#F43F5E', line: '#F43F5E44' },
};

interface Props { steps: TimelineStep[]; }

export function ExecutionTimeline({ steps }: Props) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {steps.map((step, idx) => {
        const s = STATUS_STYLE[step.status];
        const isLast = idx === steps.length - 1;
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: step.status === 'active' ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: step.status === 'active' ? Infinity : 0, duration: 1.0 }}
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: s.dot,
                  boxShadow: step.status === 'active' ? `0 0 8px ${s.dot}` : 'none',
                }}
              />
              <div style={{ fontSize: 9, color: s.text, marginTop: 4, whiteSpace: 'nowrap', maxWidth: 72, textAlign: 'center', lineHeight: 1.3 }}>
                {step.status === 'done' && '✓ '}
                {step.status === 'error' && '✗ '}
                {step.label}
              </div>
            </div>
            {!isLast && (
              <div style={{ width: 32, height: 1, background: s.line, margin: '0 2px', marginBottom: 16, flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 从 SSE 事件流状态推导时间轴步骤 */
export function buildTimelineSteps(params: {
  hasDecree: boolean;
  hasCouncil: boolean;
  groupCount: number;
  aggregated: boolean;
  hasMemorial: boolean;
  streamStatus: string;
}): TimelineStep[] {
  const { hasDecree, hasCouncil, groupCount, aggregated, hasMemorial, streamStatus } = params;
  const done = (cond: boolean) => cond ? 'done' as const : 'pending' as const;
  const active = (cond: boolean, fallback: 'pending' | 'done') => cond ? 'active' as const : fallback;

  return [
    { id: 'decree',   label: '下旨',   status: done(hasDecree) },
    { id: 'council',  label: '大臣会审', status: hasDecree ? (hasCouncil ? 'done' : 'active') : 'pending' },
    { id: 'groups',   label: `蜂群(${groupCount})`, status: hasCouncil ? (aggregated ? 'done' : 'active') : 'pending' },
    { id: 'aggregate',label: '汇总',   status: done(aggregated) },
    { id: 'memorial', label: '奏折',   status: streamStatus === 'error' ? 'error' : done(hasMemorial) },
  ];
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "ExecutionTimeline" | head -5
```
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/features/command-center/ExecutionTimeline.tsx
git commit -m "feat(battleroom): add ExecutionTimeline with status derivation"
```

---

### Task 5: 新增 GovernanceGateDialog 组件

**Files:**
- Create: `src/features/command-center/GovernanceGateDialog.tsx`
- Modify: `src/lib/api/chaotang.ts`

- [ ] **Step 1: 在 chaotang.ts 加 decreeeProceed**

在 `src/lib/api/chaotang.ts` 的 `chaotang` 对象里加：

```typescript
decreeProceed: (taskId: string) =>
  post<{ proceeded: boolean; taskId: string }>(`/decree/${encodeURIComponent(taskId)}/proceed`, {}),
```

- [ ] **Step 2: 创建 GovernanceGateDialog**

```tsx
// src/features/command-center/GovernanceGateDialog.tsx
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chaotang } from '@/lib/api/chaotang';

const STAKES_LABEL: Record<string, { label: string; color: string; desc: string }> = {
  medium: { label: '中等风险', color: '#F0C66A', desc: '丞相已完成会审，请确认出动蜂群执行' },
  high:   { label: '高风险决策', color: '#F43F5E', desc: '此任务涉及重大决策，六部已联署，请皇上御批' },
};

interface Props {
  taskId: string;
  stakes: string;
  message: string;
  onProceeded: () => void;
  onCancelled: () => void;
}

export function GovernanceGateDialog({ taskId, stakes, message, onProceeded, onCancelled }: Props) {
  const [loading, setLoading] = useState(false);
  const cfg = STAKES_LABEL[stakes] ?? STAKES_LABEL.medium;

  const handleProceed = async () => {
    setLoading(true);
    try {
      await chaotang.decreeProceed(taskId);
      onProceeded();
    } catch (e) {
      console.error('proceed failed', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(4,6,14,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          style={{
            border: `1px solid ${cfg.color}44`,
            borderTop: `3px solid ${cfg.color}`,
            background: 'rgba(8,12,24,0.96)',
            borderRadius: 12,
            padding: '32px 40px',
            maxWidth: 420,
            width: '90vw',
          }}
        >
          <div style={{ fontSize: 10, color: cfg.color, letterSpacing: '0.2em', marginBottom: 12 }}>
            治理审批 · {cfg.label}
          </div>
          <div style={{ fontSize: 18, color: '#F6EFD8', fontFamily: 'var(--font-serif)', marginBottom: 8 }}>
            {message}
          </div>
          <div style={{ fontSize: 13, color: '#9AA3C4', marginBottom: 28, lineHeight: 1.6 }}>
            {cfg.desc}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancelled}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#6A7299',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              取消任务
            </button>
            <button
              type="button"
              onClick={handleProceed}
              disabled={loading}
              style={{
                flex: 2, padding: '10px 0', borderRadius: 6,
                border: `1px solid ${cfg.color}88`,
                background: `${cfg.color}18`,
                color: cfg.color, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-serif)',
                letterSpacing: '0.1em',
              }}
            >
              {loading ? '批准中…' : '批准出动'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "GovernanceGateDialog\|decreeProceed" | head -5
```
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/features/command-center/GovernanceGateDialog.tsx src/lib/api/chaotang.ts
git commit -m "feat(battleroom): add GovernanceGateDialog and decreeProceed API call"
```

---

### Task 6: 升级 BattleStream.tsx — 加回调 + minister streaming + governance 事件

**Files:**
- Modify: `src/features/command-center/BattleStream.tsx`

- [ ] **Step 1: 读当前文件找 export interface 和 event handler**

```bash
grep -n "onSanshengChange\|interface.*Props\|export.*BattleStream\|governance\|minister\." \
  src/features/command-center/BattleStream.tsx | head -20
```

- [ ] **Step 2: 在 BattleStream Props 接口加新回调**

找到 `BattleStream` 组件的 props interface，加三个回调：

```typescript
interface BattleStreamProps {
  taskId: string;
  onSanshengChange?: (states: SanshengStates) => void;
  onMinistersChange?: (ministers: MinisterRow[]) => void;
  onGroupsChange?: (groups: GroupCard[]) => void;
  onGovernancePause?: (payload: { stakes: string; message: string }) => void;
  onGovernanceApproved?: () => void;
  onStreamStatusChange?: (status: StreamState['streamStatus'], memorialId?: string) => void;
}
```

- [ ] **Step 3: 在 event handler 里处理新事件**

找到 BattleStream 内部处理 SSE 事件的 switch/if 块（应有 `decree.understood`、`minister.opinion` 等 case），在末尾加：

```typescript
// governance events
if (ev.type === 'governance.pause') {
  props.onGovernancePause?.({ stakes: ev.stakes as string, message: ev.message as string });
}
if (ev.type === 'governance.approved') {
  props.onGovernanceApproved?.();
}
// 每次 ministers 更新后通知父组件
// （在 minister.opinion case 末尾加）
props.onMinistersChange?.(newState.ministers);
// （在 group 相关 case 末尾加）
props.onGroupsChange?.(newState.groups);
// （在 sansheng case 末尾加，已有 onSanshengChange 调用则跳过）
```

- [ ] **Step 4: 在 setState 后触发 streamStatus 回调**

找到 `streamStatus` 变为 `done` 或 `error` 的地方，调 `onStreamStatusChange`：

```typescript
// 在 done 事件处理末尾:
props.onStreamStatusChange?.('done', newState.memorialId);
// 在 error 事件处理末尾:
props.onStreamStatusChange?.('error');
```

- [ ] **Step 5: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "BattleStream" | head -10
```
Expected: 无类型错误

- [ ] **Step 6: 提交**

```bash
git add src/features/command-center/BattleStream.tsx
git commit -m "feat(battleroom): add governance/minister/group callbacks to BattleStream"
```

---

### Task 7: 重写 command-center/page.tsx — 新三栏布局

**Files:**
- Modify: `src/app/(dashboard)/command-center/page.tsx`

- [ ] **Step 1: 读现有文件了解状态**

```bash
wc -l src/app/\(dashboard\)/command-center/page.tsx
grep -n "taskId\|useState\|router\|BattleStream" src/app/\(dashboard\)/command-center/page.tsx | head -20
```

- [ ] **Step 2: 替换为新三栏布局**

完整替换 `CommandCenterInner` 组件（保留 `Suspense` 外壳和 `useSearchParams`）：

```tsx
'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { chaotang } from '@/lib/api/chaotang';
import { BattleStream, type MinisterRow, type GroupCard, type SanshengStates } from '@/features/command-center/BattleStream';
import { ThreeProvincesPanel } from '@/features/command-center/ThreeProvincesPanel';
import { SwarmBattleCard } from '@/features/command-center/SwarmBattleCard';
import { MinisterPanel } from '@/features/command-center/MinisterPanel';
import { ExecutionTimeline, buildTimelineSteps, type TimelineStep } from '@/features/command-center/ExecutionTimeline';
import { GovernanceGateDialog } from '@/features/command-center/GovernanceGateDialog';

interface TaskBrief { taskId: string; title: string; status: string; progressPct: number; }

function CommandCenterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const taskId = params.get('taskId') ?? '';

  const [sanshengStates, setSanshengStates] = useState<SanshengStates>({});
  const [ministers, setMinisters] = useState<MinisterRow[]>([]);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'live' | 'done' | 'error'>('idle');
  const [memorialId, setMemorialId] = useState<string>();
  const [taskList, setTaskList] = useState<TaskBrief[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [governancePause, setGovernancePause] = useState<{ stakes: string; message: string } | null>(null);

  // 计时器
  useEffect(() => {
    if (streamStatus !== 'live') return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [streamStatus]);

  // 加载历史任务列表
  const loadList = useCallback(async () => {
    try {
      const res = await chaotang.tasks();
      setTaskList((res as unknown as TaskBrief[]).slice(0, 20));
    } catch {}
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  // 加载当前任务标题
  useEffect(() => {
    if (!taskId) return;
    setElapsed(0);
    chaotang.taskDetail(taskId).then(d => {
      const task = (d as Record<string, unknown>);
      setTaskTitle((task.rawCommand as string)?.slice(0, 40) ?? taskId);
    }).catch(() => {});
  }, [taskId]);

  // 时间轴派生
  const timelineSteps: TimelineStep[] = buildTimelineSteps({
    hasDecree: !!taskId,
    hasCouncil: ministers.length > 0,
    groupCount: groups.length,
    aggregated: groups.every(g => g.status === 'aggregated') && groups.length > 0,
    hasMemorial: !!memorialId,
    streamStatus,
  });

  const formatElapsed = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const STATUS_COLOR: Record<string, string> = { idle: '#6A7299', live: '#6BA0FF', done: '#3DD68C', error: '#F43F5E' };
  const STATUS_LABEL: Record<string, string> = { idle: '待命', live: 'LIVE', done: '完成', error: '错误' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#04060E', color: '#F6EFD8', overflow: 'hidden' }}>

      {/* TopBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid rgba(240,198,106,0.15)', flexShrink: 0, minHeight: 48 }}>
        <span style={{ fontSize: 10, color: '#8F835F', letterSpacing: '0.2em', fontFamily: 'var(--font-serif)' }}>军机处</span>
        <div style={{ flex: 1, fontSize: 13, color: '#F6EFD8', fontFamily: 'var(--font-serif)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {taskTitle || '暂无任务'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[streamStatus], display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: STATUS_COLOR[streamStatus] }}>{STATUS_LABEL[streamStatus]}</span>
        </div>
        {streamStatus === 'live' && (
          <span style={{ fontSize: 11, color: '#6A7299', flexShrink: 0 }}>⏱ {formatElapsed(elapsed)}</span>
        )}
        {memorialId && (
          <button type="button" onClick={() => router.push(`/reports/${memorialId}`)}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(240,198,106,0.4)', background: 'rgba(240,198,106,0.1)', color: '#F0C66A', cursor: 'pointer', flexShrink: 0 }}>
            查看奏折
          </button>
        )}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={() => { setListOpen(v => !v); loadList(); }}
            style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6A7299', cursor: 'pointer' }}>
            历史 ▾
          </button>
          {listOpen && (
            <div style={{ position: 'absolute', right: 0, top: '120%', width: 260, maxHeight: 300, overflowY: 'auto', background: 'rgba(8,12,24,0.98)', border: '1px solid rgba(240,198,106,0.2)', borderRadius: 6, zIndex: 100 }}>
              {taskList.map(t => (
                <button key={t.taskId} type="button"
                  onClick={() => { router.push(`/command-center?taskId=${t.taskId}`); setListOpen(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', color: '#B6BDD5', fontSize: 11, cursor: 'pointer' }}>
                  <span style={{ color: t.status === 'report_ready' ? '#3DD68C' : t.status === 'running' ? '#6BA0FF' : '#6A7299', marginRight: 6 }}>●</span>
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 主三栏 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 左：三省进度 */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: '#6A7299', letterSpacing: '0.2em', marginBottom: 12 }}>三省进度</div>
          <ThreeProvincesPanel sanshengStates={sanshengStates} />
        </div>

        {/* 中：蜂群战情板 */}
        <div style={{ flex: 1, padding: '16px 16px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: '#6A7299', letterSpacing: '0.2em', marginBottom: 12 }}>蜂群战情板</div>
          {!taskId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 16 }}>
              <div style={{ fontSize: 14, color: '#4A5068', fontFamily: 'var(--font-serif)' }}>暂无执行中的任务</div>
              <button type="button" onClick={() => router.push('/court-briefing')}
                style={{ fontSize: 12, padding: '8px 24px', borderRadius: 6, border: '1px solid rgba(240,198,106,0.4)', background: 'rgba(240,198,106,0.1)', color: '#F0C66A', cursor: 'pointer', fontFamily: 'var(--font-serif)' }}>
                前往上书房下旨
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {groups.map(g => <SwarmBattleCard key={g.groupId} card={g} />)}
              {groups.length === 0 && streamStatus === 'live' && (
                <div style={{ color: '#4A5068', fontSize: 12, padding: '24px 0' }}>蜂群即将出动…</div>
              )}
            </div>
          )}
        </div>

        {/* 右：军机大臣会议 */}
        <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: '#6A7299', letterSpacing: '0.2em', marginBottom: 12 }}>军机大臣会议</div>
          <MinisterPanel ministers={ministers} />
        </div>
      </div>

      {/* 底部：执行时间轴 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 20px', flexShrink: 0, overflowX: 'auto' }}>
        <ExecutionTimeline steps={timelineSteps} />
      </div>

      {/* BattleStream — 隐藏 SSE 订阅器 */}
      {taskId && (
        <BattleStream
          taskId={taskId}
          onSanshengChange={setSanshengStates}
          onMinistersChange={setMinisters}
          onGroupsChange={setGroups}
          onGovernancePause={setGovernancePause}
          onGovernanceApproved={() => setGovernancePause(null)}
          onStreamStatusChange={(status, mid) => { setStreamStatus(status); if (mid) setMemorialId(mid); }}
        />
      )}

      {/* 治理审批弹窗 */}
      {governancePause && taskId && (
        <GovernanceGateDialog
          taskId={taskId}
          stakes={governancePause.stakes}
          message={governancePause.message}
          onProceeded={() => setGovernancePause(null)}
          onCancelled={() => { setGovernancePause(null); router.push('/court-briefing'); }}
        />
      )}
    </div>
  );
}

export default function CommandCenterPage() {
  return (
    <Suspense>
      <CommandCenterInner />
    </Suspense>
  );
}
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit 2>&1 | grep "command-center\|error TS" | head -20
```
Expected: 无新增类型错误

- [ ] **Step 4: 验证 dev server 无 crash**

```bash
curl -s --noproxy 127.0.0.1,localhost http://127.0.0.1:3001/command-center 2>/dev/null | grep -c "html" 
```
Expected: `1`（页面返回 HTML）

- [ ] **Step 5: 提交**

```bash
git add src/app/\(dashboard\)/command-center/page.tsx
git commit -m "feat(battleroom): rewrite command-center with three-column battle room layout"
```

---

### Task 8: 上书房 dispatch 后自动跳转军机处

**Files:**
- Modify: `src/features/shangshufang/ShangshufangPage.tsx`

- [ ] **Step 1: 找 dispatch 调用位置**

```bash
grep -n "decreeDispatch\|dispatch\|router.push\|taskId" src/features/shangshufang/ShangshufangPage.tsx | head -15
```

- [ ] **Step 2: dispatch 成功后跳转**

找到调用 `chaotang.decreeDispatch(...)` 的地方，在 `.then()` 或 `await` 后加跳转：

```typescript
const result = await chaotang.decreeDispatch(dispatchBody);
// 跳转军机处实时查看
router.push(`/command-center?taskId=${result.taskId}`);
```

如果 `decreeDispatch` 返回类型里没有 `taskId`，先看 `src/lib/contracts/decree.ts` 里 `DispatchResult` 的定义，确认字段名。

- [ ] **Step 3: 验证跳转**

启动前端，在上书房输入一句话下旨，点派发，应自动跳到 `/command-center?taskId=xxx`。

- [ ] **Step 4: 提交**

```bash
git add src/features/shangshufang/ShangshufangPage.tsx
git commit -m "feat(battleroom): auto-navigate to command-center after decree dispatch"
```

---

## 验收标准

1. `/command-center` 无 taskId 时，中栏显示"暂无任务，前往上书房下旨"
2. 上书房 dispatch 后自动跳转到 `/command-center?taskId=xxx`
3. 三省面板随 SSE `sansheng` 事件逐省点亮（中书→门下→尚书）
4. 每个 group 出现时中栏新增战情卡，subagent.step 实时追加文字并有光标脉冲
5. 大臣右栏随 `minister.opinion` 事件逐一亮起，显示意见前 120 字
6. 底部时间轴随执行进度推进（打勾）
7. `stakes=medium/high` 任务显示 GovernanceGateDialog，点"批准出动"后弹窗消失、蜂群继续
8. 历史任务下拉可切换 taskId 重现已完成任务状态
9. 完成后"查看奏折"按钮出现，点击跳转 `/reports/{memorialId}`
