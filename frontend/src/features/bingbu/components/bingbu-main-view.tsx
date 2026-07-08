'use client';

/**
 * 兵部中栏视图切换（2026-06-28）：
 *   - 销售决策：成交/签约/报价把关（BingbuDecisionCockpit，原有）。
 *   - 验客备战：锦衣卫验客 → 兵部备战 → 人扳机（BingbuProspectPanel，合法版获客）。
 */
import { useState } from 'react';

import { BingbuDecisionCockpit } from '@/features/bingbu/components/bingbu-decision-cockpit';
import { BingbuProspectPanel } from '@/features/bingbu/components/bingbu-prospect-panel';

const ACCENT = '#7FC9A8';
const TABS = [
  { k: 'decide', label: '销售决策' },
  { k: 'prospect', label: '验客备战' },
] as const;

type TabKey = (typeof TABS)[number]['k'];

export function BingbuMainView() {
  const [tab, setTab] = useState<TabKey>('decide');
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex gap-1.5">
        {TABS.map((t) => {
          const on = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className="rounded-full border px-3.5 py-1 text-[12px] transition"
              style={
                on
                  ? { borderColor: `${ACCENT}55`, background: `${ACCENT}1a`, color: '#E9DDBE' }
                  : { borderColor: '#ffffff14', color: '#8f835f' }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'decide' ? <BingbuDecisionCockpit /> : <BingbuProspectPanel />}
      </div>
    </div>
  );
}
