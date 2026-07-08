'use client';

import { useState } from 'react';
import { UserCheck } from 'lucide-react';

import {
  reviewHiring,
  type HiringInput,
  type HiringReview,
} from '@/features/libu/lib/hiring-review';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { INPUT_BASE, bdr, BoolChip, HiringResult } from './libu-hr-shared';
import { LibuRecruitSwarmPanel } from './libu-recruit-swarm-panel';

const INIT_HIRING: HiringInput = {
  role: '',
  monthlySalary: null,
  expectedAnnualValue: null,
  hasBudget: false,
  has90DayGoal: false,
  hasJD: false,
};

export function HiringTab() {
  const [form, setForm] = useState<HiringInput>(INIT_HIRING);
  const [result, setResult] = useState<HiringReview | null>(null);

  function analyse() {
    if (!form.role.trim()) return;
    setResult(reviewHiring(form));
  }

  function upd<K extends keyof HiringInput>(k: K, v: HiringInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-[20px] border px-4 pt-4 pb-3"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <UserCheck size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">
            选才司 · 招人三件套审查
          </span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <div className="space-y-2">
          <input
            value={form.role}
            onChange={(e) => upd('role', e.target.value)}
            placeholder="岗位名称（如：Java 后端工程师）"
            className={INPUT_BASE}
            style={bdr()}
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#6a7080]">拟定月薪（元）</label>
            <input
              type="number"
              min={0}
              value={form.monthlySalary ?? ''}
              onChange={(e) =>
                upd('monthlySalary', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
              }
              placeholder="如 15000"
              className={`${INPUT_BASE} mt-0.5`}
              style={bdr()}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#6a7080]">预期年产出/价值（元，可选）</label>
            <input
              type="number"
              min={0}
              value={form.expectedAnnualValue ?? ''}
              onChange={(e) =>
                upd('expectedAnnualValue', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
              }
              placeholder="如 300000"
              className={`${INPUT_BASE} mt-0.5`}
              style={bdr()}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#5a6070]">质门（人工判断）：</span>
          <BoolChip label="有预算" value={form.hasBudget} onChange={(v) => upd('hasBudget', v)} />
          <BoolChip label="有90天成功标准" value={form.has90DayGoal} onChange={(v) => upd('has90DayGoal', v)} />
          <BoolChip label="有岗位画像/JD" value={form.hasJD} onChange={(v) => upd('hasJD', v)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyse}
            disabled={!form.role.trim()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT, color: '#040A10' }}
          >
            <UserCheck size={14} />
            审查招聘
          </button>
          <span className="ml-auto text-[10px] text-[#5f5a48]">
            LOCAL · 预算/JD/成功标准 为人工判断
          </span>
        </div>
      </div>

      {result && <HiringResult result={result} />}

      <LibuRecruitSwarmPanel />

      {!result && (
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10"
          style={{ borderColor: `${ACCENT}14` }}
        >
          <UserCheck size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入岗位信息，点「审查招聘」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">
            招之前验三件套：预算 · JD · 90天成功标准
          </p>
        </div>
      )}
    </div>
  );
}
