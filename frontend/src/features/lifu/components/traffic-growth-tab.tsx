'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { VerdictCard } from '@/features/shared/office-kit/verdict-card';
import { rankChannels, type ChannelMetrics, type ChannelVerdict } from '@/features/lifu/lib/lifu-growth';
import { VERDICT_TONE, inputClass } from './verdict-tone';

const VERDICT_CN: Record<ChannelVerdict, string> = { scale: '加投', keep: '维持', cut: '砍预算', insufficient: '缺数据' };
const VERDICT_COLOR: Record<ChannelVerdict, keyof typeof VERDICT_TONE> = { scale: 'green', keep: 'blue', cut: 'red', insufficient: 'amber' };

type ChannelRow = ChannelMetrics & { id: string };

let seq = 0;
function blankRow(): ChannelRow {
  seq += 1;
  return { id: `ch-${seq}`, channel: '', spend: 0, conversions: 0, revenue: undefined, clicks: undefined };
}

export function TrafficGrowthTab() {
  const [rows, setRows] = useState<ChannelRow[]>([blankRow(), blankRow()]);
  const [result, setResult] = useState<ReturnType<typeof rankChannels> | null>(null);

  function updateRow(id: string, patch: Partial<ChannelRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setResult(null);
  }

  function run() {
    setResult(rankChannels(rows.filter((r) => r.channel.trim().length > 0)));
  }

  return (
    <div className="space-y-4">
      <span className="text-[12px] font-bold tracking-[0.14em] text-[#F5E9C9]">渠道投入产出</span>

      <div className="space-y-2">
        <div className="hidden grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] gap-2 text-[10px] text-[#6a7080] md:grid">
          <span>渠道</span><span>投入(元)</span><span>转化数</span><span>营收(可缺)</span><span>点击(可缺)</span><span />
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]">
            <input placeholder="公众号/抖音/SEM…" value={row.channel} onChange={(e) => updateRow(row.id, { channel: e.target.value })} className={inputClass} />
            <input type="number" min={0} value={row.spend} onChange={(e) => updateRow(row.id, { spend: Number(e.target.value || 0) })} className={inputClass} />
            <input type="number" min={0} value={row.conversions} onChange={(e) => updateRow(row.id, { conversions: Number(e.target.value || 0) })} className={inputClass} />
            <input type="number" min={0} value={row.revenue ?? ''} onChange={(e) => updateRow(row.id, { revenue: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputClass} />
            <input type="number" min={0} value={row.clicks ?? ''} onChange={(e) => updateRow(row.id, { clicks: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputClass} />
            <button type="button" onClick={() => { setRows((prev) => prev.filter((r) => r.id !== row.id)); setResult(null); }} className="text-[#6a7080] hover:text-[#FF8A8A]" aria-label="删除">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => { setRows((prev) => [...prev, blankRow()]); setResult(null); }} className="inline-flex items-center gap-1 text-[11px] text-[#C070D0] hover:brightness-110">
          <Plus size={12} /> 添加渠道
        </button>
      </div>

      <button
        type="button"
        onClick={run}
        className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#C070D0]/35 bg-[#C070D0]/12 px-4 text-[12px] font-semibold text-[#E2B8EE] transition hover:brightness-110"
      >
        算渠道 ROI
      </button>

      {result && (
        <div className="space-y-2">
          <p className="text-[12px] text-[#8a9aaa]">{result.recommendation}</p>
          {result.ranked.map((r) => (
            <VerdictCard
              key={r.channel}
              verdictCn={VERDICT_CN[r.verdict]}
              cfg={VERDICT_TONE[VERDICT_COLOR[r.verdict]]}
              title={r.channel}
              metrics={[
                r.cac != null ? `CAC ¥${r.cac}` : 'CAC 缺',
                r.roas != null ? `ROAS ${r.roas}` : 'ROAS 缺',
                r.thin ? '样本薄' : '样本足',
              ]}
              nextStep={r.reason}
              sourceNote="LOCAL · 流量增长司 · 转化样本 < 10 不下定论"
            />
          ))}
        </div>
      )}
    </div>
  );
}
