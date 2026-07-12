'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { VerdictCard } from '@/features/shared/office-kit/verdict-card';
import {
  relationshipHealth,
  type RelationshipStage,
  type Stakeholder,
  type StakeholderType,
} from '@/features/lifu/lib/lifu-relationship';
import { VERDICT_TONE, inputClass } from './verdict-tone';

const TYPE_CN: Record<StakeholderType, string> = {
  gov: '政府', partner: '合作方', media: '媒体', client_exec: '客户高层', investor: '投资人', other: '其他',
};
const STAGE_CN: Record<RelationshipStage, string> = {
  cold: '未接触', contacted: '已接触', engaged: '洽谈中', negotiating: '谈判中', partner: '已合作', dormant: '已沉寂',
};

let seq = 0;
function blankRow(): Stakeholder {
  seq += 1;
  return { id: `sk-${seq}`, name: '', type: 'partner', stage: 'contacted', lastContact: '', nextAction: '' };
}

export function RelationshipLedgerTab() {
  const [rows, setRows] = useState<Stakeholder[]>([blankRow(), blankRow()]);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<ReturnType<typeof relationshipHealth> | null>(null);

  function updateRow(id: string, patch: Partial<Stakeholder>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setResult(null);
  }

  function run() {
    const valid = rows.filter((r) => r.name.trim().length > 0);
    setResult(relationshipHealth(valid, `${nowIso}T00:00:00.000Z`));
  }

  const verdict = !result || result.total === 0
    ? VERDICT_TONE.blue
    : result.needsFollowUp.length > 0
      ? VERDICT_TONE.amber
      : VERDICT_TONE.green;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold tracking-[0.14em] text-[#F5E9C9]">对外关系台账</span>
        <label className="flex items-center gap-2 text-[11px] text-[#8a9aaa]">
          今日
          <input type="date" value={nowIso} onChange={(e) => { setNowIso(e.target.value); setResult(null); }} className={`${inputClass} w-auto`} />
        </label>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1.3fr_0.9fr_0.9fr_1fr_1.3fr_auto]">
            <input placeholder="姓名/机构" value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} className={inputClass} />
            <select value={row.type} onChange={(e) => updateRow(row.id, { type: e.target.value as StakeholderType })} className={inputClass}>
              {Object.entries(TYPE_CN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={row.stage} onChange={(e) => updateRow(row.id, { stage: e.target.value as RelationshipStage })} className={inputClass}>
              {Object.entries(STAGE_CN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={row.lastContact ?? ''} onChange={(e) => updateRow(row.id, { lastContact: e.target.value })} className={inputClass} />
            <input placeholder="下一步动作" value={row.nextAction ?? ''} onChange={(e) => updateRow(row.id, { nextAction: e.target.value })} className={inputClass} />
            <button type="button" onClick={() => { setRows((prev) => prev.filter((r) => r.id !== row.id)); setResult(null); }} className="text-[#6a7080] hover:text-[#FF8A8A]" aria-label="删除">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => { setRows((prev) => [...prev, blankRow()]); setResult(null); }}
          className="inline-flex items-center gap-1 text-[11px] text-[#C070D0] hover:brightness-110"
        >
          <Plus size={12} /> 添加一行
        </button>
      </div>

      <button
        type="button"
        onClick={run}
        className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#C070D0]/35 bg-[#C070D0]/12 px-4 text-[12px] font-semibold text-[#E2B8EE] transition hover:brightness-110"
      >
        算关系健康
      </button>

      {result && (
        <VerdictCard
          verdictCn={
            result.total === 0
              ? '无数据'
              : result.needsFollowUp.length > 0
                ? `${result.needsFollowUp.length} 人该跟进`
                : '关系健康,暂无该跟进项'
          }
          cfg={verdict}
          title={`共 ${result.total} 个对外关系`}
          metrics={Object.entries(result.byStage).map(([stage, count]) => `${STAGE_CN[stage as RelationshipStage]} ${count}`)}
          nextStep={result.total === 0 ? '先添加至少一个对外关系' : result.needsFollowUp[0] ? `${result.needsFollowUp[0].name}：${result.needsFollowUp[0].reason}` : '维持现有节奏即可'}
          opinions={result.needsFollowUp.map((a) => `${a.name}：${a.reason}`)}
          sourceNote="LOCAL · 关系台账司 · 数据不出浏览器,不臆测关系好坏"
        />
      )}
    </div>
  );
}
