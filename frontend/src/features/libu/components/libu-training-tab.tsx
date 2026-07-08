'use client';

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

import {
  reviewTraining,
  type TrainingInput,
  type TrainingReview,
} from '@/features/libu/lib/training-review';
import { ACCENT } from '@/features/libu/lib/libu-roster';
import { INPUT_BASE, bdr, BoolChip, TrainingResult } from './libu-hr-shared';

const INIT_TRAINING: TrainingInput = {
  role: '',
  trainingCost: null,
  expectedUpliftValue: null,
  hasGapAssessed: false,
  hasPlan: false,
  hasSuccessMetric: false,
};

export function TrainingTab() {
  const [form, setForm] = useState<TrainingInput>(INIT_TRAINING);
  const [result, setResult] = useState<TrainingReview | null>(null);

  function analyse() {
    if (!form.role.trim()) return;
    setResult(reviewTraining(form));
  }
  function upd<K extends keyof TrainingInput>(k: K, v: TrainingInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[20px] border px-4 pt-4 pb-3" style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}>
        <div className="mb-3 flex items-center gap-2">
          <GraduationCap size={15} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold text-[#F5E9C9]">培训发展司 · 培训三件套审查</span>
          <span className="ml-auto text-[10px] text-[#5f5a48]">数据不出浏览器（铁律9）</span>
        </div>

        <input
          value={form.role}
          onChange={(e) => upd('role', e.target.value)}
          placeholder="培训对象（如：华东销售团队 / 张三 · 谈判技能）"
          className={INPUT_BASE}
          style={bdr()}
        />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#6a7080]">培训投入（元）</label>
            <input
              type="number"
              min={0}
              value={form.trainingCost ?? ''}
              onChange={(e) => upd('trainingCost', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
              placeholder="如 20000"
              className={`${INPUT_BASE} mt-0.5`}
              style={bdr()}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#6a7080]">预期年增量价值（元，可选）</label>
            <input
              type="number"
              min={0}
              value={form.expectedUpliftValue ?? ''}
              onChange={(e) => upd('expectedUpliftValue', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
              placeholder="如 80000"
              className={`${INPUT_BASE} mt-0.5`}
              style={bdr()}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#5a6070]">质门（人工判断）：</span>
          <BoolChip label="有技能gap评估" value={form.hasGapAssessed} onChange={(v) => upd('hasGapAssessed', v)} />
          <BoolChip label="有培训计划" value={form.hasPlan} onChange={(v) => upd('hasPlan', v)} />
          <BoolChip label="有成效衡量标准" value={form.hasSuccessMetric} onChange={(v) => upd('hasSuccessMetric', v)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyse}
            disabled={!form.role.trim()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT, color: '#040A10' }}
          >
            <GraduationCap size={14} />
            审查培训
          </button>
          <span className="ml-auto text-[10px] text-[#5f5a48]">LOCAL · gap/计划/成效标准 为人工判断</span>
        </div>
      </div>

      {result && <TrainingResult result={result} />}

      {!result && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed py-10" style={{ borderColor: `${ACCENT}14` }}>
          <GraduationCap size={32} style={{ color: `${ACCENT}38` }} />
          <p className="mt-3 text-[13px] text-[#5f6570]">填入培训信息，点「审查培训」</p>
          <p className="mt-1 text-[11px] text-[#3a3e4c]">培之前验三件套：gap评估 · 计划 · 成效标准</p>
        </div>
      )}
    </div>
  );
}
