'use client';

import { useState } from 'react';
import { Network } from 'lucide-react';

import {
  reviewOrgHeadcount,
  type OrgHeadcountInput,
  type OrgHeadcountReview,
} from '@/features/libu/lib/org-headcount-review';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { INPUT_BASE, bdr, BoolChip, OrgHeadcountResult } from './libu-hr-shared';

const INIT_ORG: OrgHeadcountInput = {
  newRole: '',
  currentAnnualLaborCost: null,
  annualRevenue: null,
  newRoleAnnualCost: null,
  expectedIncrementalValue: null,
  hasWorkloadEvidence: false,
  hasReorgAlternative: false,
  hasBudgetHeadroom: false,
};

function numUpd(v: string): number | null {
  return v === '' ? null : Math.max(0, Number(v));
}

export function OrgHeadcountTab() {
  const [form, setForm] = useState<OrgHeadcountInput>(INIT_ORG);
  const [result, setResult] = useState<OrgHeadcountReview | null>(null);

  function analyse() {
    if (!form.newRole.trim()) return;
    setResult(reviewOrgHeadcount(form));
  }
  function upd<K extends keyof OrgHeadcountInput>(k: K, v: OrgHeadcountInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[20px] border px-4 pt-4 pb-3" style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}>
        <div className="mb-3 flex items-center gap-2">
          <Network size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">组织编制司 · 增岗算账</span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <input
          value={form.newRole}
          onChange={(e) => upd('newRole', e.target.value)}
          placeholder="拟增岗位（如：再招一个前端工程师）"
          className={INPUT_BASE}
          style={bdr()}
        />

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-[#6a7080]">当前总人力成本（元/年）</label>
            <input type="number" min={0} value={form.currentAnnualLaborCost ?? ''} onChange={(e) => upd('currentAnnualLaborCost', numUpd(e.target.value))} placeholder="如 2000000" className={`${INPUT_BASE} mt-0.5`} style={bdr()} />
          </div>
          <div>
            <label className="text-[10px] text-[#6a7080]">新岗年成本（元）</label>
            <input type="number" min={0} value={form.newRoleAnnualCost ?? ''} onChange={(e) => upd('newRoleAnnualCost', numUpd(e.target.value))} placeholder="如 250000" className={`${INPUT_BASE} mt-0.5`} style={bdr()} />
          </div>
          <div>
            <label className="text-[10px] text-[#6a7080]">年营收（元，可选）</label>
            <input type="number" min={0} value={form.annualRevenue ?? ''} onChange={(e) => upd('annualRevenue', numUpd(e.target.value))} placeholder="如 5000000" className={`${INPUT_BASE} mt-0.5`} style={bdr()} />
          </div>
        </div>
        <div className="mt-2">
          <label className="text-[10px] text-[#6a7080]">新岗预期年增量价值（元，可选）</label>
          <input type="number" min={0} value={form.expectedIncrementalValue ?? ''} onChange={(e) => upd('expectedIncrementalValue', numUpd(e.target.value))} placeholder="如 400000" className={`${INPUT_BASE} mt-0.5`} style={bdr()} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#5a6070]">质门（人工判断）：</span>
          <BoolChip label="有工作量证据" value={form.hasWorkloadEvidence} onChange={(v) => upd('hasWorkloadEvidence', v)} />
          <BoolChip label="考虑过重组/挖潜" value={form.hasReorgAlternative} onChange={(v) => upd('hasReorgAlternative', v)} />
          <BoolChip label="编制预算有余" value={form.hasBudgetHeadroom} onChange={(v) => upd('hasBudgetHeadroom', v)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={analyse} disabled={!form.newRole.trim()} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40" style={{ background: ACCENT, color: '#040A10' }}>
            <Network size={14} />
            审查增岗
          </button>
          <span className="ml-auto text-[10px] text-[#5f5a48]">LOCAL · 工作量/重组/预算 为人工判断</span>
        </div>
      </div>

      {result && <OrgHeadcountResult result={result} />}

      {!result && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10" style={{ borderColor: `${ACCENT}14` }}>
          <Network size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入增岗信息，点「审查增岗」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">增岗前验:工作量证据 · 重组替代 · 人力成本占比</p>
        </div>
      )}
    </div>
  );
}
